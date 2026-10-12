import { readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * What a shared link looks like in a chat window.
 *
 * None of this is visible in the app. A page can carry a perfectly wrong card for years without a
 * screen looking any different, because the only reader is somebody else's crawler -- so the parts
 * that have to hold are checked here against the bytes, the way `src/name.test.ts` checks the name.
 *
 * The three things that actually break a card, in the order they break it:
 *
 *   - An address that is not absolute. A crawler has no page to resolve `og.png` against; several
 *     of them simply drop the picture. And it has to be the punycode host, because `chlädderi.ch`
 *     is not a name a URI can hold.
 *   - A picture that is not there, or not the size Open Graph asks for. 1200x630 is what every one
 *     of these clients lays out against.
 *   - A picture too heavy to fetch quickly. WhatsApp gives up and shows the small card instead.
 *
 * The description is pinned to the other two copies of itself for the same reason the name is: it
 * is written out in three files that cannot import anything, and nothing else would notice them
 * drifting apart.
 */

const read = (path: string): string => readFileSync(path, "utf8");

const INDEX = read("src/index.html");
const MANIFEST = JSON.parse(read("manifest.webmanifest")) as Record<string, unknown>;

/** The first capture of `re` in `text`, or the empty string -- so a miss fails on the value. */
const grab = (text: string, re: RegExp): string => re.exec(text)?.[1]?.trim() ?? "";

const meta = (name: string): string =>
    grab(INDEX, new RegExp(`property="${name}"\\s+content="([^"]*)"`));

/** The app's one address, written the way a machine reads it. */
const SITE = "https://xn--chldderi-2za.ch/";

/** The card is fetched before anything about the link is shown, so it has a weight limit. */
const BUDGET = 300 * 1024;

describe("a shared link carries a card", () => {
    it("describes the page to a search engine and to the manifest in the same words", () => {
        const description = grab(INDEX, /name="description"\s+content="([^"]*)"/);
        expect(description).not.toBe("");
        expect(MANIFEST.description).toBe(description);
    });

    it("says it shorter on the card, in a sentence that ends", () => {
        // The card's own line, not the page description: a search result shows about 160
        // characters, a chat window a good deal fewer, and it cuts rather than shortens. The first
        // card out of here carried the page's description and arrived as «… Die Gebiete kommen».
        const line = meta("og:description");
        expect(line).not.toBe("");
        expect(line.length).toBeLessThanOrEqual(120);
        expect(line.endsWith(".")).toBe(true);
    });

    it("names the pictures and pages by an address a crawler can fetch", () => {
        expect(meta("og:url")).toBe(SITE);
        expect(grab(INDEX, /rel="canonical"\s+href="([^"]*)"/)).toBe(SITE);
        expect(meta("og:image")).toBe(`${SITE}og.png`);
    });

    it("asks for the large card, which is the one with a picture in it", () => {
        expect(grab(INDEX, /name="twitter:card"\s+content="([^"]*)"/)).toBe("summary_large_image");
        expect(meta("og:type")).toBe("website");
        expect(meta("og:image:alt")).not.toBe("");
    });
});

describe("the card's picture", () => {
    // The file the page names, read as it is published: at the root, beside the icons.
    const file = meta("og:image").slice(SITE.length);
    const png = readFileSync(file);

    it("is a PNG of the size the page claims", () => {
        expect(file).toBe("og.png");
        // The signature, then the width and height out of the IHDR chunk that follows it.
        expect([...png.subarray(0, 4)]).toStrictEqual([0x89, 0x50, 0x4e, 0x47]);
        expect({ w: png.readUInt32BE(16), h: png.readUInt32BE(20) }).toStrictEqual({
            w: Number(meta("og:image:width")),
            h: Number(meta("og:image:height")),
        });
        expect(meta("og:image:width")).toBe("1200");
        expect(meta("og:image:height")).toBe("630");
    });

    it("carries its own background", () => {
        // Colour type 2 is RGB with no alpha channel: the card has no transparent pixel to let a
        // chat window's own colour through. It sits on white in a light chat and on near-black in
        // a dark one, and a cut-out picture looks broken in one of the two. The card paints its
        // background (tools/og-card.html), which is what makes the encoder drop the channel.
        expect(png[25]).toBe(2);
    });

    it("is light enough to be fetched before the card is drawn", () => {
        expect(statSync(file).size).toBeLessThanOrEqual(BUDGET);
    });
});
