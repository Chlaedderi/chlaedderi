import { describe, expect, it } from "vitest";

import type { LogEntry } from "./logbook";
import { defaultPrefs } from "./prefs";
import { encodeTransfer } from "./store";
import { mergeTransfer, readTransfer } from "./transfer";

/**
 * Taking favourites, the logbook and the settings from one browser to another.
 *
 * The rule that matters most here is that nothing is ever lost: a code adds to what this browser
 * already has and never takes anything away. Someone who pastes a year-old backup, or follows the
 * hand-over link twice, must come out with more than they went in with, never less.
 */

const codeFor = (payload: Record<string, unknown>, version: 1 | 2 = 2): string =>
    encodeTransfer(version === 2 ? { v: 2, ...payload } : payload, version);

const here = (over: Partial<Parameters<typeof mergeTransfer>[1]> = {}) => ({
    crags: [] as string[],
    routes: [] as string[],
    log: [],
    prefs: defaultPrefs(),
    ...over,
});

const entry = (id: string): LogEntry => ({
    id,
    k: "a~b",
    s: "a",
    n: "a route",
    g: "6a",
    d: "2026-10-01",
    st: "rp",
    r: 0,
    t: 0,
});

describe("reading a code", () => {
    it("reads an FA2 code, settings and all", () => {
        const got = readTransfer(
            codeFor({
                fav: { c: ["one"], r: ["one~route"] },
                log: [entry("a")],
                prefs: { lang: "de", packs: [{ id: "ow" }] },
            }),
        );
        expect(got?.version).toBe(2);
        expect([...(got?.crags ?? [])]).toEqual(["one"]);
        expect(got?.log).toHaveLength(1);
        expect(got?.prefs?.lang).toBe("de");
        expect(got?.prefs?.packs).toEqual([{ id: "ow" }]);
    });

    it("reads an FA1 code and invents no settings for it", () => {
        // `cleanPrefs` would hand back a full set of defaults, and merging those in would quietly
        // reset this browser's settings to the factory ones.
        const got = readTransfer(codeFor({ fav: { c: ["one"], r: [] }, log: [] }, 1));
        expect(got?.version).toBe(1);
        expect(got?.prefs).toBeNull();
    });

    it("is null for anything that is not a code", () => {
        expect(readTransfer("")).toBeNull();
        expect(readTransfer("hello")).toBeNull();
        expect(readTransfer("FA2.!!!")).toBeNull();
    });
});

describe("folding a code into what is here", () => {
    it("adds and never replaces", () => {
        const merged = mergeTransfer(
            readTransfer(codeFor({ fav: { c: ["theirs"], r: [] }, log: [entry("t")] }))!,
            here({ crags: ["mine"], log: [entry("m")] }),
        );
        expect(merged.crags.sort()).toEqual(["mine", "theirs"]);
        expect(merged.log.map((e) => e.id).sort()).toEqual(["m", "t"]);
        expect(merged.gained).toMatchObject({ crags: 1, entries: 1 });
    });

    it("counts the same code twice as nothing the second time", () => {
        const code = codeFor({ fav: { c: ["one"], r: [] }, log: [entry("a")] });
        const first = mergeTransfer(readTransfer(code)!, here());
        const again = mergeTransfer(
            readTransfer(code)!,
            here({ crags: first.crags, log: first.log }),
        );
        expect(again.nothingNew).toBe(true);
        expect(again.crags).toEqual(first.crags);
        expect(again.log).toHaveLength(1);
    });

    it("keeps a setting this browser has already been given", () => {
        // What the viewer chose here wins over what the code says, exactly as the store's own
        // `keepTouched` rule does when a slow layer answers after a switch was flipped.
        const mine = { ...defaultPrefs(), theme: "dark" as const };
        const merged = mergeTransfer(
            readTransfer(codeFor({ fav: { c: [], r: [] }, log: [], prefs: { theme: "light" } }))!,
            here({ prefs: mine }),
        );
        expect(merged.prefs?.theme).toBe("dark");
    });

    it("takes a setting this browser has never touched", () => {
        const merged = mergeTransfer(
            readTransfer(codeFor({ fav: { c: [], r: [] }, log: [], prefs: { theme: "light" } }))!,
            here(),
        );
        expect(merged.prefs?.theme).toBe("light");
    });

    it("unions the installed regions, and what is here wins", () => {
        // The copy on this device is the one whose data is actually in this browser's cache.
        const mine = {
            ...defaultPrefs(),
            packs: [{ id: "ow", name: { en: "here", de: "hier" } }],
        };
        const merged = mergeTransfer(
            readTransfer(
                codeFor({
                    fav: { c: [], r: [] },
                    log: [],
                    prefs: {
                        packs: [{ id: "ow", name: { en: "there", de: "dort" } }, { id: "finale" }],
                    },
                }),
            )!,
            here({ prefs: mine }),
        );
        expect(merged.prefs?.packs.map((p) => p.id).sort()).toEqual(["finale", "ow"]);
        expect(merged.prefs?.packs.find((p) => p.id === "ow")?.name?.en).toBe("here");
        expect(merged.gained.packs).toBe(1);
    });

    it("leaves the settings alone for an FA1 code, which carries none", () => {
        const mine = { ...defaultPrefs(), theme: "dark" as const };
        const merged = mergeTransfer(
            readTransfer(codeFor({ fav: { c: ["one"], r: [] }, log: [] }, 1))!,
            here({ prefs: mine }),
        );
        expect(merged.prefs).toBeNull();
        expect(merged.gained.crags).toBe(1);
    });
});
