import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import showcase from "../../../maps/pack.showcase.json";
import testing from "../../../maps/pack.testing.json";

import { ChlpackError, isChlpack, openChlpack } from "./chlpack";

/**
 * The sealing side, written from the format description rather than from the reader.
 *
 * tools/encrypt.mjs in the private Chlaedderi/maps repository is what actually publishes, and this
 * repository never sees it. So the reader is tested against an independent implementation of the
 * same five lines of specification -- if the two agree, the description is what both of them obey.
 */
const HEADER = 18;

const seal = async (
    json: string,
    keyB64: string,
    options: { gzip?: boolean; version?: number; flags?: number } = {},
): Promise<Uint8Array> => {
    const { gzip = true, version = 1, flags = gzip ? 1 : 0 } = options;
    const body = gzip
        ? new Uint8Array(gzipSync(Buffer.from(json, "utf8")))
        : new TextEncoder().encode(json);
    const head = new Uint8Array(HEADER);
    head.set([0x43, 0x48, 0x4c, 0x50], 0); // "CHLP"
    head[4] = version;
    head[5] = flags;
    const nonce = webcrypto.getRandomValues(new Uint8Array(12));
    head.set(nonce, 6);

    const raw = Uint8Array.from(atob(keyB64.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
        c.charCodeAt(0),
    );
    const key = await webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
        "encrypt",
    ]);
    const sealed = new Uint8Array(
        await webcrypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce, additionalData: head.subarray(0, 6), tagLength: 128 },
            key,
            body,
        ),
    );

    const out = new Uint8Array(HEADER + sealed.length);
    out.set(head, 0);
    out.set(sealed, HEADER);
    return out;
};

const newKey = (): string =>
    btoa(String.fromCharCode(...webcrypto.getRandomValues(new Uint8Array(32))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

const JSON_TEXT = JSON.stringify(showcase);

describe("an encrypted mappack", () => {
    it("comes back exactly as it went in", async () => {
        const key = newKey();
        const blob = await seal(JSON_TEXT, key);
        expect(isChlpack(blob)).toBe(true);
        expect(await openChlpack(blob, key)).toBe(JSON_TEXT);
    });

    it("comes back when it was not compressed either", async () => {
        const key = newKey();
        const blob = await seal(JSON_TEXT, key, { gzip: false });
        expect(await openChlpack(blob, key)).toBe(JSON_TEXT);
    });

    it("is smaller than the region it holds", async () => {
        const blob = await seal(JSON_TEXT, newKey());
        expect(blob.length).toBeLessThan(JSON_TEXT.length / 2);
    });

    it("needs the right key, and says so without saying which part was wrong", async () => {
        const blob = await seal(JSON_TEXT, newKey());
        await expect(openChlpack(blob, newKey())).rejects.toMatchObject({ code: "badkey" });
    });

    it("refuses a key that is not a key", async () => {
        const blob = await seal(JSON_TEXT, newKey());
        for (const bad of ["", "short", "not base64 at all !!!"]) {
            await expect(openChlpack(blob, bad)).rejects.toBeInstanceOf(ChlpackError);
        }
    });

    it("fails as a forgery when the header is changed", async () => {
        // The first six bytes are the additional authenticated data. Claiming the body is not
        // gzipped must not merely produce rubbish -- it must not decrypt at all.
        const key = newKey();
        const blob = await seal(JSON_TEXT, key);
        const tampered = Uint8Array.from(blob);
        tampered[5] = 0;
        await expect(openChlpack(tampered, key)).rejects.toMatchObject({ code: "badkey" });
    });

    it("fails as a forgery when a single byte of the body is changed", async () => {
        const key = newKey();
        const blob = await seal(JSON_TEXT, key);
        const tampered = Uint8Array.from(blob);
        tampered.set([(tampered.at(-1) ?? 0) ^ 0xff], tampered.length - 1);
        await expect(openChlpack(tampered, key)).rejects.toMatchObject({ code: "badkey" });
    });

    it("names a version it cannot read instead of guessing", async () => {
        const key = newKey();
        const blob = await seal(JSON_TEXT, key, { version: 2 });
        await expect(openChlpack(blob, key)).rejects.toMatchObject({ code: "badblob" });
    });

    it("refuses flags it does not know", async () => {
        const key = newKey();
        const blob = await seal(JSON_TEXT, key, { flags: 0b1000_0001 });
        await expect(openChlpack(blob, key)).rejects.toMatchObject({ code: "badblob" });
    });

    it("never encrypts the same region to the same bytes", async () => {
        const key = newKey();
        const a = await seal(JSON_TEXT, key);
        const b = await seal(JSON_TEXT, key);
        // A repeated nonce under a repeated key is the one mistake AES-GCM does not survive.
        expect(a.subarray(6, 18)).not.toEqual(b.subarray(6, 18));
        expect(a.subarray(18)).not.toEqual(b.subarray(18));
    });
});

describe("a plain mappack", () => {
    it("is not mistaken for an encrypted one", () => {
        expect(isChlpack(new TextEncoder().encode(JSON_TEXT))).toBe(false);
        expect(isChlpack(new Uint8Array([]))).toBe(false);
        expect(isChlpack(new Uint8Array([0x43, 0x48, 0x4c]))).toBe(false);
    });

    it("is not an encrypted one merely for starting with the right letters", () => {
        // Four bytes of magic and nothing else: too short to be a container at all.
        expect(isChlpack(new Uint8Array([0x43, 0x48, 0x4c, 0x50]))).toBe(false);
    });
});

describe("the sealed fixture the browser suite installs", () => {
    // maps/pack.testing.chlpack is committed, so that the e2e suite can install an encrypted
    // region from an address the way a viewer does. It is sealed by tools/seal-fixture.mjs, and
    // nothing re-seals it automatically -- so this is the guard that it still holds what
    // maps/pack.testing.json says. Edit the region, run the sealer, or this fails.
    it("opens with the fixture key, and holds exactly the region beside it", async () => {
        const blob = new Uint8Array(readFileSync("maps/pack.testing.chlpack"));
        const key = readFileSync("maps/pack.testing.key", "utf8").trim();
        expect(isChlpack(blob)).toBe(true);
        const opened = await openChlpack(blob, key);
        expect(JSON.parse(opened)).toEqual(testing);
    });

    it("is published as bytes nobody can read without the key", () => {
        const blob = readFileSync("maps/pack.testing.chlpack", "latin1");
        // The region's own name is in the plaintext; none of it may be in the file.
        expect(blob).not.toContain("Testing Range");
        expect(blob).not.toContain("chlaedderi-mappack");
        expect(blob).not.toContain("testing-chalchofe-sued");
    });
});
