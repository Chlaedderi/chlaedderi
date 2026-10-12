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

/** Read the body, giving up rather than growing past the cap. Null when it is too big. */
const readCapped = async (response: Response): Promise<string | null> => {
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_PACK_BYTES) return null;

    // No stream to read in jsdom, and none in a browser answering from a synthetic Response.
    if (!response.body) {
        const whole = await response.text();
        return whole.length > MAX_PACK_BYTES ? null : whole;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        if (text.length > MAX_PACK_BYTES) {
            await reader.cancel();
            return null;
        }
    }
    return text + decoder.decode();
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
        text = read;
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

/** The same, from a file the viewer picked. */
export const readPackFile = async (file: File): Promise<PackLoad & { readonly text?: string }> => {
    let text: string;
    try {
        text = await file.text();
    } catch {
        return problem("unreadable", "could not be read");
    }
    if (text.length > MAX_PACK_BYTES) return problem("toobig", "is too big to be a mappack");
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
    source: { type: "url" | "file"; url?: string; name?: string } | null,
    bytes: number,
): {
    id: string;
    name: { en: string; de: string };
    version: string;
    partial: boolean;
    crags: number;
    routes: number;
    bytes: number;
    src: { type: "url" | "file"; url?: string; name?: string } | null;
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
