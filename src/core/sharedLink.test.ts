import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { routeFromShared } from "./sharedLink";

/**
 * What comes out of a share sheet, and what the app makes of it.
 *
 * The message is written by whoever shared it: WhatsApp puts the link on a line of its own,
 * Chrome sends the page title beside it, a person adds a full stop. None of that may change which
 * region is opened -- and in particular none of it may change the bytes of a sealed region's key,
 * which rides in the fragment and is percent-encoded there.
 */

const PACK = "https://example.org/packs/pack.ow.json";
const ENCODED = encodeURIComponent(PACK);

/** Base64 of 32 bytes can hold all three of the characters a URL argues about. */
const KEY = "aB+cd/ef+gh/ij+kl/mn+op/qr+st/uvw=";

describe("a link this app handed out", () => {
    it("reads a region link", () => {
        expect(routeFromShared(`https://xn--chldderi-2za.ch/#/pack?url=${ENCODED}`)).toBe(
            `/pack?url=${ENCODED}`,
        );
    });

    it("keeps a sealed region's key byte for byte", () => {
        const k = encodeURIComponent(KEY);
        // The one test that catches a decode-and-encode-again round trip: `+`, `/` and `=` all
        // mean something else in a query, and a key that comes back changed opens nothing.
        const route = routeFromShared(`https://xn--chldderi-2za.ch/#/pack?url=${ENCODED}&k=${k}`);
        expect(route).toBe(`/pack?url=${ENCODED}&k=${k}`);
        expect(new URLSearchParams(route?.split("?")[1]).get("k")).toBe(KEY);
    });

    it("gives a crag link its leading slash back", () => {
        expect(routeFromShared(`https://xn--chldderi-2za.ch/#ow-chlus?pack=${ENCODED}`)).toBe(
            `/ow-chlus?pack=${ENCODED}`,
        );
    });

    it("reads a link to one route of a crag", () => {
        const token = encodeURIComponent("ow-chlus~sonnenplatte");
        expect(routeFromShared(`https://xn--chldderi-2za.ch/#${token}?pack=${ENCODED}`)).toBe(
            `/${token}?pack=${ENCODED}`,
        );
    });

    it("carries the filters of a view link across", () => {
        expect(routeFromShared(`https://xn--chldderi-2za.ch/#/pack?url=${ENCODED}&f=6a-7b`)).toBe(
            `/pack?url=${ENCODED}&f=6a-7b`,
        );
    });

    it.each([
        "https://xn--chldderi-2za.ch/pr-12/#/pack?url=",
        "http://127.0.0.1:5173/#/pack?url=",
        "https://chlaedderi.ch/#/pack?url=",
    ])("does not care which host it came from: %s", (prefix) => {
        // A preview, a dev server and the ASCII domain are all the same link. Shape decides.
        expect(routeFromShared(`${prefix}${ENCODED}`)).toBe(`/pack?url=${ENCODED}`);
    });
});

describe("a bare address somebody hosts a region at", () => {
    it.each([
        "https://example.org/packs/pack.ow.json",
        "https://example.org/packs/pack.ow.chlpack",
    ])("offers it: %s", (address) => {
        expect(routeFromShared(address)).toBe(`/pack?url=${encodeURIComponent(address)}`);
    });

    it("reads an address with the scheme left off", () => {
        expect(routeFromShared("example.org/packs/pack.ow.json")).toBe(
            `/pack?url=${encodeURIComponent("https://example.org/packs/pack.ow.json")}`,
        );
    });

    it("moves a GitHub page to the host the file can be fetched from", () => {
        // Proof that this leans on packUrl rather than reimplementing it: the correction is a
        // change of host, not only of path, and dropping it would break every GitHub-hosted pack.
        expect(routeFromShared("https://github.com/someone/packs/blob/main/pack.ow.json")).toBe(
            `/pack?url=${encodeURIComponent(
                "https://raw.githubusercontent.com/someone/packs/main/pack.ow.json",
            )}`,
        );
    });

    it("refuses an address that is not shaped like a pack", () => {
        // Otherwise sharing any article at all would ask «Load this region? from nzz.ch».
        expect(routeFromShared("https://www.nzz.ch/sport/klettern-ld.1812345")).toBeNull();
    });
});

describe("the message around the link", () => {
    it.each([
        ["a full stop after it", "Look at this: https://example.org/pack.ow.json."],
        ["a line of its own", "Chalchofe Süd – Chlädderi\nhttps://example.org/pack.ow.json\n"],
        ["an autolink", "<https://example.org/pack.ow.json>"],
        ["a non-breaking space", "here:\u00a0https://example.org/pack.ow.json\u00a0"],
        ["brackets round it", "(https://example.org/pack.ow.json)"],
    ])("finds the link despite %s", (_what, text) => {
        expect(routeFromShared(text)).toBe(
            `/pack?url=${encodeURIComponent("https://example.org/pack.ow.json")}`,
        );
    });

    it("takes ours even when it is the second link", () => {
        const text = `https://www.nzz.ch/sport/klettern-ld.1 and https://xn--chldderi-2za.ch/#/pack?url=${ENCODED}`;
        expect(routeFromShared(text)).toBe(`/pack?url=${ENCODED}`);
    });
});

describe("a message with nothing in it to open", () => {
    it.each([
        ["prose", "Meet at the car park at eight and bring the rope"],
        ["an empty share", "   "],
        ["a data: address", "data:application/json,%7B%22format%22%3A%22x%22%7D"],
        ["a javascript: address", "javascript:alert(1)"],
        ["a news article", "https://www.nzz.ch/sport/klettern-ld.1812345"],
    ])("is nothing: %s", (_what, text) => {
        expect(routeFromShared(text)).toBeNull();
    });

    it.each([
        ["an ours-shaped link whose address is a data: URL", "data:application/json,%7B%7D"],
        [
            "an ours-shaped link whose address carries credentials",
            "https://raw.githubusercontent.com@evil.example/p.json",
        ],
    ])("refuses %s", (_what, address) => {
        const text = `https://xn--chldderi-2za.ch/#/pack?url=${encodeURIComponent(address)}`;
        expect(routeFromShared(text)).toBeNull();
    });
});

describe("a link to the app rather than to a thing in it", () => {
    it.each([
        "https://xn--chldderi-2za.ch/#/fav",
        "https://xn--chldderi-2za.ch/",
        "https://xn--chldderi-2za.ch/pr-12/#/",
    ])("just opens the app: %s", (text) => {
        expect(routeFromShared(text)).toBe("/");
    });
});

describe("the manifest and the service worker name the same path", () => {
    /*
     * In the style of src/name.test.ts: three files have to agree on one word and none of them can
     * import the others. The manifest tells Android where to POST, tools/share-target.js is what
     * catches that POST inside the worker, and App.tsx mounts the route it redirects to. A change
     * to any one of them alone is a share that silently goes nowhere.
     */
    const MANIFEST = JSON.parse(readFileSync("manifest.webmanifest", "utf8")) as {
        share_target?: {
            action: string;
            method: string;
            enctype: string;
            params: Record<string, string>;
        };
    };
    const WORKER = readFileSync("tools/share-target.js", "utf8");
    const APP = readFileSync("src/App.tsx", "utf8");

    it("posts a form, so the shared text never becomes a query string", () => {
        // A GET target would percent-encode the whole link -- fragment, key and all -- into the
        // request line, which goes to whoever hosts the site whenever no worker is controlling.
        expect(MANIFEST.share_target?.method).toBe("POST");
        expect(MANIFEST.share_target?.enctype).toBe("multipart/form-data");
    });

    it("catches the action the manifest names", () => {
        const action = MANIFEST.share_target?.action ?? "";
        // Relative, so a preview's manifest points at /pr-12/share and not at the deployed app.
        expect(action.startsWith("./")).toBe(true);
        expect(WORKER).toContain(`new URL("${action.slice(2)}", self.registration.scope)`);
    });

    it("reads every field a sender may fill", () => {
        for (const field of Object.values(MANIFEST.share_target?.params ?? {})) {
            expect(WORKER).toContain(`"${field}"`);
        }
    });

    it("redirects to a route the app actually mounts", () => {
        expect(WORKER).toContain('"./#/share?text="');
        expect(APP).toContain('path="/share"');
    });
});
