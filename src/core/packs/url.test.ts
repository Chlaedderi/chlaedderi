import { describe, expect, it } from "vitest";

import { packAddress, packUrl } from "./url";

describe("packUrl", () => {
    it.each([
        [
            "https://github.com/somebody/packs/blob/main/pack.finale.json",
            "https://raw.githubusercontent.com/somebody/packs/main/pack.finale.json",
        ],
        [
            "https://github.com/somebody/packs/raw/main/pack.finale.json",
            "https://raw.githubusercontent.com/somebody/packs/main/pack.finale.json",
        ],
        [
            "https://www.github.com/somebody/packs/blob/main/pack.finale.json",
            "https://raw.githubusercontent.com/somebody/packs/main/pack.finale.json",
        ],
        [
            "https://github.com/somebody/packs/blob/main/regions/pack.ow.json?raw=1",
            "https://raw.githubusercontent.com/somebody/packs/main/regions/pack.ow.json",
        ],
        [
            "https://github.com/somebody/packs/blob/refs/heads/main/pack.oltre.json",
            "https://raw.githubusercontent.com/somebody/packs/refs/heads/main/pack.oltre.json",
        ],
    ])("takes the file out of the GitHub page: %s", (given, wanted) => {
        expect(packUrl(given)).toBe(wanted);
    });

    it.each([
        [
            "https://gist.github.com/somebody/8f3b2c1d",
            "https://gist.githubusercontent.com/somebody/8f3b2c1d/raw",
        ],
        [
            "https://gist.github.com/somebody/8f3b2c1d/raw",
            "https://gist.githubusercontent.com/somebody/8f3b2c1d/raw",
        ],
        [
            "https://gist.github.com/somebody/8f3b2c1d/raw/pack.json",
            "https://gist.githubusercontent.com/somebody/8f3b2c1d/raw/pack.json",
        ],
    ])("moves a gist to the host that allows access: %s", (given, wanted) => {
        // `gist.github.com/…/raw` only redirects there, and a cross-origin redirect is itself
        // checked against CORS -- so the host has to move, not just the path.
        expect(packUrl(given)).toBe(wanted);
    });

    it("puts a scheme in front of an address that was given without one", () => {
        expect(packUrl("example.org/chlaedderi/pack.finale.json")).toBe(
            "https://example.org/chlaedderi/pack.finale.json",
        );
    });

    it.each([
        "/maps/pack.ow.json",
        "./pack.showcase.json",
        "../packs/pack.ow.json",
        "maps/pack.ow.json",
    ])("leaves a relative address alone: %s", (given) => {
        // Prefixing a scheme here would turn a path on this host into somebody else's domain.
        expect(packUrl(given)).toBe(given);
    });

    it.each([
        "https://packs.example.org/pack.finale.json",
        "https://raw.githubusercontent.com/somebody/packs/main/pack.finale.json",
        "https://example.org/pack.json",
        "http://127.0.0.1:4173/maps/pack.ow.json",
    ])("leaves an address that already works alone: %s", (given) => {
        expect(packUrl(given)).toBe(given);
    });

    it("leaves a GitHub address that names no file alone", () => {
        expect(packUrl("https://github.com/somebody/packs")).toBe(
            "https://github.com/somebody/packs",
        );
    });

    it("trims the whitespace that comes with a pasted address", () => {
        expect(packUrl("  https://example.org/pack.json\n")).toBe("https://example.org/pack.json");
    });

    it("hands back an empty address unchanged", () => {
        expect(packUrl("   ")).toBe("");
    });

    it("does not mistake a scheme it cannot parse for a host", () => {
        expect(packUrl("not a url at all")).toBe("not a url at all");
    });
});

/**
 * A link from a stranger can ask the app to install a region, so what the link names is checked
 * before anything is fetched and before the viewer is told where it comes from.
 */
describe("packAddress", () => {
    it("accepts an ordinary https address and says which host it reaches", () => {
        expect(packAddress("https://example.org/packs/pack.finale.json")).toEqual({
            url: "https://example.org/packs/pack.finale.json",
            host: "example.org",
        });
    });

    it("corrects the address first, so the host shown is the one really reached", () => {
        expect(packAddress("https://github.com/somebody/packs/blob/main/p.json")?.host).toBe(
            "raw.githubusercontent.com",
        );
    });

    it("keeps the port, which is part of the host", () => {
        expect(packAddress("http://127.0.0.1:4173/maps/pack.ow.json")?.host).toBe("127.0.0.1:4173");
    });

    it.each([
        "data:application/json,%7B%7D",
        "blob:https://example.org/8f3b",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "chrome-extension://abcd/p.json",
    ])("refuses a scheme that is not the web: %s", (given) => {
        // `fetch` really does read a data: URL -- that is a pack from a stranger with no host to
        // name and no network to notice it.
        expect(packAddress(given)).toBeNull();
    });

    it.each(["/maps/pack.ow.json", "./pack.json", "pack.json", ""])(
        "refuses a relative address, which would resolve against the wrong origin: %s",
        (given) => {
            expect(packAddress(given)).toBeNull();
        },
    );

    it("resolves a relative address against a base, for the one caller that has one", () => {
        // The packs dialog: an address typed there means this very site, and always has.
        expect(packAddress("/maps/pack.ow.json", "http://127.0.0.1:4173/#/x")).toEqual({
            url: "http://127.0.0.1:4173/maps/pack.ow.json",
            host: "127.0.0.1:4173",
        });
    });

    it("refuses an address carrying credentials, which disguises the host", () => {
        // Reads as GitHub to a person; goes to evil.example in the browser.
        expect(packAddress("https://raw.githubusercontent.com@evil.example/p.json")).toBeNull();
        expect(packAddress("https://user:pw@example.org/p.json")).toBeNull();
    });

    it("hands back the punycode host, which is what should be shown", () => {
        // A host written in another script reads as that script and resolves as this: the one
        // the browser really goes to is the one the dialog has to name.
        expect(packAddress("https://пример.org/p.json")?.host).toBe("xn--e1afmkfd.org");
    });
});
