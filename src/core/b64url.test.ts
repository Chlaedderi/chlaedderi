/**
 * base64url, which two things in the app already spelled out for themselves.
 *
 * The transfer code and the pack key had each hand-rolled this, and the two had already drifted on
 * what they would accept back -- one padded before decoding, one did not. A link now carries a
 * third such string, so the alphabet is in one place and tested once.
 */

import { describe, expect, it } from "vitest";

import { fromB64url, jsonFromB64url, jsonToB64url, toB64url } from "./b64url";

const bytes = (...n: number[]): Uint8Array => Uint8Array.from(n);

describe("toB64url", () => {
    it("spends no character a URL would read as punctuation", () => {
        // 0xFB 0xFF encodes to `+/8=` in plain base64: every character this has to replace.
        const text = toB64url(bytes(0xfb, 0xff));
        expect(text).toBe("-_8");
        expect(text).not.toMatch(/[+/=]/);
    });

    it("strips the padding, which carries no information", () => {
        expect(toB64url(bytes(1))).toBe("AQ");
        expect(toB64url(bytes(1, 2))).toBe("AQI");
        expect(toB64url(bytes(1, 2, 3))).toBe("AQID");
    });

    it("has an answer for nothing at all", () => {
        expect(toB64url(bytes())).toBe("");
    });
});

describe("fromB64url", () => {
    it("reads back what was written, at every length", () => {
        for (let n = 0; n < 40; n++) {
            const original = Uint8Array.from({ length: n }, (_v, i) => (i * 37) % 256);
            expect([...(fromB64url(toB64url(original)) ?? [])]).toEqual([...original]);
        }
    });

    it("puts the padding back, so a stripped string decodes", () => {
        expect([...(fromB64url("AQ") ?? [])]).toEqual([1]);
        expect([...(fromB64url("AQI") ?? [])]).toEqual([1, 2]);
    });

    it("forgives whitespace, which a chat window adds", () => {
        expect([...(fromB64url(" AQ ID ") ?? [])]).toEqual([1, 2, 3]);
    });

    it("refuses anything that is not this alphabet", () => {
        // `+` and `/` are plain base64: close enough to be worth refusing explicitly.
        expect(fromB64url("AQ+D")).toBeNull();
        expect(fromB64url("AQ/D")).toBeNull();
        expect(fromB64url("AQID=")).toBeNull();
        expect(fromB64url("hello world!")).toBeNull();
        expect(fromB64url("")).toBeNull();
    });
});

describe("jsonToB64url and back", () => {
    it("carries an object through unchanged, accents and all", () => {
        const value = { a: 1, b: "Chlädderi", c: [true, null, "7a+"] };
        expect(jsonFromB64url(jsonToB64url(value))).toEqual(value);
    });

    it("answers null rather than throwing, whatever arrives", () => {
        // All of this comes from somewhere else -- a link, a pasted code -- and none of it is
        // worth taking the app down for.
        expect(jsonFromB64url("not base64url!")).toBeNull();
        expect(jsonFromB64url(toB64url(new TextEncoder().encode("{broken")))).toBeNull();
        // Valid base64url, but not UTF-8: decoded `fatal`, so it is refused rather than mangled.
        expect(jsonFromB64url(toB64url(bytes(0xff, 0xfe, 0xfd)))).toBeNull();
        // Valid JSON, but not an object.
        expect(jsonFromB64url(jsonToB64url(42))).toBeNull();
        expect(jsonFromB64url(jsonToB64url(null))).toBeNull();
    });
});
