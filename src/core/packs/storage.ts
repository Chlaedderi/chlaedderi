/**
 * Where an installed mappack lives: the Cache Storage, under `<APP_SLUG>-packs`.
 *
 * The name is load-bearing -- packs people have already installed are in there -- and so is the
 * fact that the service worker leaves this cache alone: the app manages it itself, which is why
 * `pack*.json` and `version.json` are kept out of the precache manifest (see vite.config.ts).
 */

import { APP_SLUG } from "@core/name";
import { PREVIEW_SUFFIX } from "@core/preview";
import type { Mappack } from "@domain/mappack";

import { ChlpackError, isChlpack, openChlpack } from "./chlpack";
import { packUrl } from "./url";
import { type PackCheck, type PackProblem, checkPack } from "./validate";

/** Suffixed in a pull request preview, so that it cannot touch the packs people have installed. */
export const PACK_CACHE = `${APP_SLUG}-packs${PREVIEW_SUFFIX}`;

/** `^[a-z0-9][a-z0-9-]{0,31}$` -- an id has to be a plain lower-case name. */
export const PACK_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** A key inside the cache only; it is not an address anyone can fetch. */
const cacheKey = (id: string): string => `pack/${encodeURIComponent(id)}.json`;

const openCache = async (): Promise<Cache | null> => {
    try {
        return await caches.open(PACK_CACHE);
    } catch {
        return null;
    }
};

export const storePack = async (id: string, text: string): Promise<boolean> => {
    const cache = await openCache();
    if (!cache) return false;
    try {
        await cache.put(
            cacheKey(id),
            new Response(text, { headers: { "Content-Type": "application/json" } }),
        );
        return true;
    } catch {
        return false;
    }
};

export const readStoredPack = async (id: string): Promise<unknown> => {
    const cache = await openCache();
    if (!cache) return null;
    try {
        const hit = await cache.match(cacheKey(id));
        return hit ? ((await hit.json()) as unknown) : null;
    } catch {
        return null;
    }
};

/**
 * The pack's JSON exactly as it was stored, to be saved as a file and passed on.
 *
 * Sealed or not: a region that arrived sealed is stored opened, so what comes out is the opened
 * text, and whoever it is handed to loads it without a key. That is on purpose. The seal is not
 * access control -- the key is in every link it was ever sent in -- and a publication is not
 * forever: a superseded one is swept after thirty days, and a region can be taken down any day,
 * which ends the link and its key for everybody who was sent one. A saved file is the copy that
 * outlives that.
 */
export const storedPackText = async (id: string): Promise<string | null> => {
    const cache = await openCache();
    if (!cache) return null;
    try {
        const hit = await cache.match(cacheKey(id));
        return hit ? await hit.text() : null;
    } catch {
        return null;
    }
};

/** `<id>.json`, with anything a file system might choke on replaced. */
export const packFileName = (id: string): string =>
    `${id.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+/, "") || "mappack"}.json`;

export const forgetPack = async (id: string): Promise<void> => {
    const cache = await openCache();
    if (!cache) return;
    try {
        await cache.delete(cacheKey(id));
    } catch {
        /* nothing to do: the pack is simply still there */
    }
};

export type PackLoad =
    | { readonly ok: true; readonly pack: Mappack; readonly bytes: number }
    | { readonly ok: false; readonly problems: readonly PackProblem[] };

/**
 * As much of an answer as is worth reading.
 *
 * Nothing bounded this before, and `checkPack` then runs Ajv with `allErrors` over whatever came
 * back, on the main thread. An address that answers with something enormous -- by accident or
 * because a link from a stranger pointed there -- took the tab with it. The real regions are
 * around 650 kB.
 */
export const MAX_PACK_BYTES = 8 * 1024 * 1024;

/** One problem, as the app itself raises them: with a code, so the dialog can say it in German. */
const problem = (code: PackProblem["code"], message: string, detail?: string): PackLoad => ({
    ok: false,
    problems: [{ where: "", message, code, detail }],
});

/**
 * Read the body, giving up rather than growing past the cap. Null when it is too big.
 *
 * Bytes rather than text, because a pack may arrive encrypted (see chlpack.ts) and a TextDecoder
 * would make nonsense of it before anything got the chance to look. A plain pack is decoded a few
 * lines further down, exactly as before.
 */
const readCapped = async (response: Response): Promise<Uint8Array | null> => {
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_PACK_BYTES) return null;

    // No stream to read in jsdom, and none in a browser answering from a synthetic Response.
    if (!response.body) {
        const whole = new Uint8Array(await response.arrayBuffer());
        return whole.length > MAX_PACK_BYTES ? null : whole;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_PACK_BYTES) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, at);
        at += chunk.length;
    }
    return bytes;
};

/**
 * Bytes to the pack's JSON text: plain ones straight through, an encrypted one through its key.
 *
 * This is the only place that decides what the network handed over. Encryption is an addition --
 * no magic, no key, nothing changes -- so a pack somebody else hosts as plain JSON keeps working
 * exactly as it did, and a key offered for one is simply not needed.
 */
const asPackText = async (bytes: Uint8Array, key?: string): Promise<string | PackLoad> => {
    if (!isChlpack(bytes)) return new TextDecoder().decode(bytes);
    if (!key) {
        return problem("locked", "is a locked region, and the link did not carry its key");
    }
    try {
        return await openChlpack(bytes, key);
    } catch (error) {
        const code = error instanceof ChlpackError ? error.code : "badkey";
        const message = error instanceof Error ? error.message : "could not be opened";
        return problem(code, message);
    }
};

const fromCheck = (check: PackCheck, bytes: number): PackLoad =>
    check.ok ? { ok: true, pack: check.pack, bytes } : { ok: false, problems: check.problems };

/** Read one back out of the cache and check it again -- it may have been written long ago. */
export const loadStoredPack = async (id: string): Promise<PackLoad> => {
    const value = await readStoredPack(id);
    if (value == null) {
        return { ok: false, problems: [{ where: "", message: "is not in the cache" }] };
    }
    const text = JSON.stringify(value);
    return fromCheck(await checkPack(value), text.length);
};

/**
 * What a `TypeError` out of `fetch` actually means.
 *
 * The browser refuses to say whether a cross-origin answer was withheld by CORS or never arrived
 * at all -- telling those apart is exactly what it is hiding. Two of the three cases are knowable
 * from here, though, and they are the two with a different thing to do about them.
 */
const whyNoAnswer = (url: string): PackProblem["code"] => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
    if (typeof location !== "undefined" && location.protocol === "https:") {
        if (url.startsWith("http://")) return "mixed";
    }
    return "cors";
};

/**
 * Fetch a pack from an address, check it, and keep the text so it can be stored unchanged.
 *
 * The address is corrected first (`packUrl`) and handed back in `url`, so that what is remembered
 * as the pack's source -- and later shared, and re-fetched -- is the one that actually answers.
 */
export const fetchPack = async (
    raw: string,
    signal?: AbortSignal,
    key?: string,
): Promise<PackLoad & { readonly text?: string; readonly url: string }> => {
    const url = packUrl(raw);
    let text: string;
    try {
        const response = await fetch(url, { signal, cache: "no-store" });
        if (!response.ok) {
            return {
                ...problem(
                    "http",
                    `could not be fetched (HTTP ${response.status})`,
                    String(response.status),
                ),
                url,
            };
        }
        // A web page where a pack was expected: the GitHub address nobody can be blamed for
        // pasting. Saying so beats a syntax error from the first `<`.
        const type = response.headers.get("content-type") ?? "";
        if (type.includes("text/html")) {
            return { ...problem("html", "is a web page, not a mappack"), url };
        }
        const read = await readCapped(response);
        if (read === null) {
            return { ...problem("toobig", "is too big to be a mappack"), url };
        }
        const opened = await asPackText(read, key);
        if (typeof opened !== "string") return { ...opened, url };
        text = opened;
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return { ...problem("aborted", "was not fetched"), url };
        }
        const message = error instanceof Error ? error.message : "could not be fetched";
        return { ...problem(whyNoAnswer(url), message), url };
    }

    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return { ...problem("notjson", "is not valid JSON"), url };
    }
    return { ...fromCheck(await checkPack(value), text.length), text, url };
};

/** The same, from a file the viewer picked -- a .json, or a .chlpack with its key. */
export const readPackFile = async (
    file: File,
    key?: string,
): Promise<PackLoad & { readonly text?: string }> => {
    let text: string;
    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length > MAX_PACK_BYTES) return problem("toobig", "is too big to be a mappack");
        const opened = await asPackText(bytes, key);
        if (typeof opened !== "string") return opened;
        text = opened;
    } catch {
        return problem("unreadable", "could not be read");
    }
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return problem("notjson", "is not valid JSON");
    }
    return { ...fromCheck(await checkPack(value), text.length), text };
};

/** What is remembered about an installed pack, without its data. */
export const packNote = (
    pack: Mappack,
    source: { type: "url" | "file"; url?: string; name?: string; key?: string } | null,
    bytes: number,
): {
    id: string;
    name: { en: string; de: string };
    version: string;
    partial: boolean;
    crags: number;
    routes: number;
    bytes: number;
    src: { type: "url" | "file"; url?: string; name?: string; key?: string } | null;
    at: number;
} => ({
    id: pack.id,
    name: { en: pack.name.en || pack.id, de: pack.name.de || pack.id },
    version: pack.version,
    partial: pack.partial === true,
    crags: pack.sectors.length,
    routes: pack.sectors.reduce((n, s) => n + (s.routes?.length ?? 0), 0),
    bytes,
    src: source,
    at: Date.now(),
});
