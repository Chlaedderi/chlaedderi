import { describe, expect, it } from "vitest";

import { APP_NAME } from "@core/name";

import { linkTo, packLinkTo, shareText, viewLinkTo } from "./useShare";

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

describe("viewLinkTo", () => {
    it("offers the region first, because filters without it are an empty screen", () => {
        const link = viewLinkTo("F1.abc", "https://example.org/pack.ow.json");
        expect(link).toBe(
            `${here()}#/pack?url=${encodeURIComponent("https://example.org/pack.ow.json")}&f=F1.abc`,
        );
    });

    it("carries the key of a region that arrived locked", () => {
        const link = viewLinkTo("F1.abc", "https://example.org/pack.ow.chlpack", "k3y-_");
        expect(link).toContain("&k=k3y-_");
        expect(link).toContain("&f=F1.abc");
    });

    it("is a plain link to the map for a region with no address to give", () => {
        // The built-in showcase, and anything installed from a file: there is nothing to offer,
        // but the filters still mean something to somebody who has the same region already.
        expect(viewLinkTo("F1.abc")).toBe(`${here()}#/?f=F1.abc`);
        expect(viewLinkTo("F1.abc", "/maps/pack.ow.json")).toBe(`${here()}#/?f=F1.abc`);
    });

    it("says nothing about a view nobody has narrowed", () => {
        // `encodeFilterCode` answers null for a list at rest, and then there is no view to share.
        expect(viewLinkTo(null)).toBe(`${here()}#/`);
    });

    it("drops a fragment out of the address, which would cut the link in half", () => {
        expect(viewLinkTo("F1.abc", "https://example.org/pack.ow.json#section")).toBe(
            `${here()}#/pack?url=${encodeURIComponent("https://example.org/pack.ow.json")}&f=F1.abc`,
        );
    });
});

describe("shareText", () => {
    it("names the crag, because the link itself cannot", () => {
        // The card a chat window draws is the app's own -- what the crag is called has to be in
        // the message. The label is what the crag page and the route list already show.
        expect(shareText("Gelbe Wand, Chli Aubrig")).toBe(`Gelbe Wand, Chli Aubrig – ${APP_NAME}`);
    });

    it("does not say the app's name twice", () => {
        // A share with nothing to name -- the region dialog's own link -- is labelled with the app.
        expect(shareText(APP_NAME)).toBe(APP_NAME);
    });
});
