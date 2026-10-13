import { beforeEach, describe, expect, it } from "vitest";

import { PREFS_ITEM, cleanPrefs, defaultPrefs, keepTouched, readPrefsSync } from "./prefs";

describe("cleanPrefs", () => {
    it("falls back to the defaults for nothing at all", () => {
        expect(cleanPrefs(null)).toEqual(defaultPrefs());
        expect(cleanPrefs("nope")).toEqual(defaultPrefs());
        expect(cleanPrefs(42)).toEqual(defaultPrefs());
    });

    it("takes the values it recognises", () => {
        const prefs = cleanPrefs({
            lang: "de",
            theme: "dark",
            base: "osm",
            baseCH: "chsat",
            region: "ow",
            radar: true,
            wx: false,
            chWrz: true,
            logStyle: "os",
        });
        expect(prefs.lang).toBe("de");
        expect(prefs.theme).toBe("dark");
        expect(prefs.base).toBe("osm");
        expect(prefs.baseCH).toBe("chsat");
        expect(prefs.region).toBe("ow");
        expect(prefs.radar).toBe(true);
        expect(prefs.wx).toBe(false);
        expect(prefs.chWrz).toBe(true);
        expect(prefs.logStyle).toBe("os");
    });

    it("ignores values it does not recognise", () => {
        const prefs = cleanPrefs({
            lang: "fr",
            theme: "neon",
            base: "moon",
            radar: 7,
            wx: "yes",
            logStyle: "flash",
        });
        const d = defaultPrefs();
        expect(prefs.lang).toBe(d.lang);
        expect(prefs.theme).toBe(d.theme);
        expect(prefs.base).toBe(d.base);
        expect(prefs.radar).toBe(d.radar);
        expect(prefs.wx).toBe(d.wx);
        expect(prefs.logStyle).toBe("rp");
    });

    /**
     * The radar was «off» | «rv» | «dpc» until the source stopped being a choice. Everybody who
     * had chosen a radar has one of those strings on their device, and dropping it would switch
     * their radar off without a word.
     */
    it("reads a radar chosen before the source became automatic", () => {
        expect(cleanPrefs({ radar: "rv" }).radar).toBe(true);
        expect(cleanPrefs({ radar: "dpc" }).radar).toBe(true);
        expect(cleanPrefs({ radar: "off" }).radar).toBe(false);
    });

    it("keeps only pack descriptions that have an id", () => {
        const prefs = cleanPrefs({
            packs: [{ id: "ow", version: "1" }, null, 42, { version: "no id" }],
        });
        expect(prefs.packs).toEqual([{ id: "ow", version: "1" }]);
    });
});

describe("keepTouched", () => {
    /**
     * The slower layers of the store answer a moment after the first paint. That answer used to
     * replace the whole settings object, so a switch flipped in that moment was silently undone --
     * one of the ways the radar «turned itself off again».
     */
    it("takes the stored settings when nothing has been touched", () => {
        const start = defaultPrefs();
        const stored = { ...defaultPrefs(), radar: true, theme: "dark" as const };
        expect(keepTouched(stored, start, start)).toEqual(stored);
    });

    it("keeps a value the viewer changed while the store was still answering", () => {
        const start = defaultPrefs();
        // Immer hands out a new object on any change; the app does the same here.
        const current = { ...start, radar: true };
        const stored = { ...defaultPrefs(), radar: false, theme: "dark" as const };

        const merged = keepTouched(stored, current, start);

        expect(merged.radar).toBe(true);
        // Everything untouched still comes from storage.
        expect(merged.theme).toBe("dark");
    });

    it("keeps a touched list by reference", () => {
        const start = defaultPrefs();
        const packs = [{ id: "ow" }];
        const current = { ...start, packs };
        const merged = keepTouched(defaultPrefs(), current, start);
        expect(merged.packs).toBe(packs);
    });
});

describe("readPrefsSync", () => {
    beforeEach(() => localStorage.clear());

    it("reads the item the first paint depends on", () => {
        localStorage.setItem(PREFS_ITEM, JSON.stringify({ v: { lang: "de", theme: "dark" } }));
        const prefs = readPrefsSync();
        expect(prefs.lang).toBe("de");
        expect(prefs.theme).toBe("dark");
    });

    it("never throws on rubbish, so the first paint cannot fail", () => {
        localStorage.setItem(PREFS_ITEM, "{not json");
        expect(readPrefsSync()).toEqual(defaultPrefs());
        localStorage.removeItem(PREFS_ITEM);
        expect(readPrefsSync()).toEqual(defaultPrefs());
    });
});
