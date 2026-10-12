import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PACK_BYTES, fetchPack, readPackFile } from "./storage";

/**
 * What the install dialog is told when a pack cannot be read at all.
 *
 * These are the only problems a viewer can act on -- a wrong address, no connection, a host that
 * forbids access -- so each one carries a code the dialog turns into German. Before this they all
 * arrived as one English sentence out of `fetch`, «Failed to fetch», which says nothing about what
 * to do. The codes are what the test here is about; the words live in `src/i18n`.
 */

const answer = (body: string, init: ResponseInit = {}): Response =>
    new Response(body, { status: 200, headers: { "Content-Type": "application/json" }, ...init });

const codeOf = (load: Awaited<ReturnType<typeof fetchPack>>): string | undefined =>
    load.ok ? undefined : load.problems[0]?.code;

describe("fetchPack", () => {
    const realFetch = globalThis.fetch;

    beforeEach(() => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    });

    afterEach(() => {
        globalThis.fetch = realFetch;
        vi.restoreAllMocks();
    });

    it("corrects the address before fetching, and says which one it used", async () => {
        const seen: string[] = [];
        globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
            seen.push(String(input));
            return Promise.resolve(answer("{}"));
        }) as typeof fetch;

        const load = await fetchPack("https://github.com/enteee/packs/blob/main/pack.json");

        expect(seen).toEqual(["https://raw.githubusercontent.com/enteee/packs/main/pack.json"]);
        expect(load.url).toBe("https://raw.githubusercontent.com/enteee/packs/main/pack.json");
    });

    it("says it is a web page when the address answers with one", async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(
                answer("<!doctype html><title>GitHub</title>", {
                    headers: { "Content-Type": "text/html; charset=utf-8" },
                }),
            ),
        ) as typeof fetch;

        expect(codeOf(await fetchPack("https://example.org/p.json"))).toBe("html");
    });

    it("gives the status its own code, and carries the number for the words", async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(answer("nope", { status: 404 })),
        ) as typeof fetch;

        const load = await fetchPack("https://example.org/p.json");
        expect(load.ok).toBe(false);
        if (load.ok) return;
        expect(load.problems[0]?.code).toBe("http");
        expect(load.problems[0]?.detail).toBe("404");
    });

    it("says the answer is not JSON", async () => {
        globalThis.fetch = vi.fn(() => Promise.resolve(answer("not json at all"))) as typeof fetch;

        expect(codeOf(await fetchPack("https://example.org/p.json"))).toBe("notjson");
    });

    it("blames the connection when the browser is offline", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        globalThis.fetch = vi.fn(() =>
            Promise.reject(new TypeError("Failed to fetch")),
        ) as typeof fetch;

        expect(codeOf(await fetchPack("https://example.org/p.json"))).toBe("offline");
    });

    it("blames CORS when the browser is online and the answer never arrives", async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.reject(new TypeError("Failed to fetch")),
        ) as typeof fetch;

        // Online, and not a mixed-content address: whatever else it is, it is unreadable from
        // here, and the host is the only one who can change that.
        expect(codeOf(await fetchPack("https://example.org/p.json"))).toBe("cors");
    });

    it("names mixed content, which is the one case the browser does tell us about", async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.reject(new TypeError("Failed to fetch")),
        ) as typeof fetch;

        // jsdom serves the tests from http://localhost, so this is asserted on the rule rather
        // than on the page: an http:// address from an https:// page can never be fetched.
        const load = await fetchPack("http://example.org/p.json");
        expect(codeOf(load)).toBe(location.protocol === "https:" ? "mixed" : "cors");
    });

    it("does not report a cancelled fetch as a broken pack", async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.reject(new DOMException("aborted", "AbortError")),
        ) as typeof fetch;

        expect(codeOf(await fetchPack("https://example.org/p.json"))).toBe("aborted");
    });

    it("refuses an answer that declares itself too big", async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(
                new Response("{}", {
                    headers: {
                        "Content-Type": "application/json",
                        "Content-Length": String(MAX_PACK_BYTES + 1),
                    },
                }),
            ),
        ) as typeof fetch;

        expect(codeOf(await fetchPack("https://example.org/p.json"))).toBe("toobig");
    });

    it("refuses an answer that grows past the cap while it is read", async () => {
        // No Content-Length: the only way to find out is to stop reading at the cap.
        const huge = "x".repeat(MAX_PACK_BYTES + 1);
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(
                new Response(huge, { headers: { "Content-Type": "application/json" } }),
            ),
        ) as typeof fetch;

        expect(codeOf(await fetchPack("https://example.org/p.json"))).toBe("toobig");
    });
});

describe("readPackFile", () => {
    it("says a file that is not JSON is not JSON", async () => {
        const file = new File(["nope"], "pack.json", { type: "application/json" });
        const load = await readPackFile(file);
        expect(load.ok).toBe(false);
        if (!load.ok) expect(load.problems[0]?.code).toBe("notjson");
    });

    it("refuses a file bigger than a mappack could be", async () => {
        const file = new File(["x".repeat(MAX_PACK_BYTES + 1)], "pack.json");
        const load = await readPackFile(file);
        expect(load.ok).toBe(false);
        if (!load.ok) expect(load.problems[0]?.code).toBe("toobig");
    });
});
