import { describe, expect, it } from "vitest";

import { linkTo, packLinkTo } from "./useShare";

/**
 * What a shared link actually says.
 *
 * A crag link used to work only for somebody who already had that region; anybody else was told
 * the crag is not in the atlas. It now names the region's own address so the app can offer it --
 * which also means the link carries an address, and an address that could not be fetched by
 * whoever receives it is worse than none at all.
 */

const here = (): string => `${location.origin}${location.pathname}`;

describe("linkTo", () => {
    it("is the hand-written app's own link when there is no address to carry", () => {
        // The format in people's bookmarks and messages: `#<cragId>`, not a router path.
        expect(linkTo("finale-placche")).toBe(`${here()}#finale-placche`);
        expect(linkTo("finale-placche~diedro", null)).toBe(`${here()}#finale-placche~diedro`);
    });

    it("carries the region's address when there is one", () => {
        expect(linkTo("ow-engi", "https://example.org/pack.ow.json")).toBe(
            `${here()}#ow-engi?pack=${encodeURIComponent("https://example.org/pack.ow.json")}`,
        );
    });

    it("carries the corrected address, not the one the region was installed from", () => {
        // A region installed before the address was being corrected still shares a working link.
        expect(
            linkTo("ow-engi", "https://github.com/somebody/packs/blob/main/pack.ow.json"),
        ).toContain(
            encodeURIComponent(
                "https://raw.githubusercontent.com/somebody/packs/main/pack.ow.json",
            ),
        );
    });

    it("drops an address the recipient could not use", () => {
        // Relative: it would resolve against whoever opens the link. The link still works as the
        // plain crag link it has always been.
        expect(linkTo("ow-engi", "/maps/pack.ow.json")).toBe(`${here()}#ow-engi`);
        expect(linkTo("ow-engi", "data:application/json,%7B%7D")).toBe(`${here()}#ow-engi`);
    });

    it("drops a fragment out of the address, which would cut the link in half", () => {
        // A location is split at the first `#` before the first `?`, so a `#` inside the address
        // would take the rest of the link with it.
        const link = linkTo("ow-engi", "https://example.org/pack.ow.json#section");
        expect(link).toBe(
            `${here()}#ow-engi?pack=${encodeURIComponent("https://example.org/pack.ow.json")}`,
        );
    });

    it("escapes the token, as the app has always done", () => {
        expect(linkTo("a b")).toBe(`${here()}#a%20b`);
    });
});

describe("packLinkTo", () => {
    it("names a region and nothing else", () => {
        expect(packLinkTo("https://example.org/pack.ow.json")).toBe(
            `${here()}#/pack?url=${encodeURIComponent("https://example.org/pack.ow.json")}`,
        );
    });

    it("has no link to give for an address nobody else could fetch", () => {
        expect(packLinkTo("/maps/pack.ow.json")).toBeNull();
        expect(packLinkTo("data:application/json,%7B%7D")).toBeNull();
    });
});
