/**
 * The filters, as a link carries them.
 *
 * Two things are being guarded here. One is that a default view encodes to nothing at all: three
 * separate things depend on it -- the URL mirror leaving `#/` alone, the read-back not preferring
 * a code it invented itself to what is on the device, and a row of anchored URL assertions in the
 * browser suite.
 *
 * The other is that a code from a stranger cannot do more than the viewer's own filter sheet can.
 * It goes back through `fromStored`, which checks every value against its own list, so nonsense
 * falls back to the default for that one field. A filter state must never be able to hide the
 * whole list.
 */

import { describe, expect, it } from "vitest";

import { decodeFilterCode, encodeFilterCode } from "./filterCode";
import { type Filters, type RestoreContext, type SortKey, emptyFilters } from "./filters";
import { GRADE_HI, GRADE_LO, GRADES } from "./grades";

const where: RestoreContext = {
    areas: new Set(["Placche", "Grotta"]),
    municipalities: new Set(["Finale Ligure"]),
};

/** Encode, then read straight back: what a link does to a view on the way through. */
const round = (f: Filters, sort: SortKey = "area", dir: 1 | -1 = 1) => {
    const code = encodeFilterCode(f, sort, dir);
    expect(code).not.toBeNull();
    return decodeFilterCode(code!, where);
};

describe("encodeFilterCode", () => {
    it("says nothing about a view nobody has narrowed", () => {
        expect(encodeFilterCode(emptyFilters(), "area", 1)).toBeNull();
    });

    it("is URL-safe and names its version", () => {
        const code = encodeFilterCode({ ...emptyFilters(), star: "4" }, "area", 1);
        expect(code).toMatch(/^F1\.[A-Za-z0-9_-]+$/);
    });

    it("carries only what was set, so a link stays short", () => {
        const one = encodeFilterCode({ ...emptyFilters(), star: "4" }, "area", 1) ?? "";
        const two = encodeFilterCode({ ...emptyFilters(), star: "4", walk: "10" }, "area", 1) ?? "";
        expect(one.length).toBeLessThan(two.length);
        // Twenty-odd fields saying «any» would make both of these the same length, and long.
        expect(one.length).toBeLessThan(60);
    });

    it("notices the sort and the direction", () => {
        expect(encodeFilterCode(emptyFilters(), "name", 1)).not.toBeNull();
        expect(encodeFilterCode(emptyFilters(), "area", -1)).not.toBeNull();
    });
});

describe("decodeFilterCode", () => {
    it("brings a whole considered view back", () => {
        const sent = {
            ...emptyFilters(),
            star: "4" as const,
            walk: "10" as const,
            gmin: GRADES.indexOf("6a"),
            gmax: GRADES.indexOf("6c+"),
            minIn: 3,
            orient: new Set(["S", "SW"]),
            area: "Placche",
            muni: "Finale Ligure",
            hideClosure: true,
            q: "platte",
        };
        const back = round(sent, "name", -1);
        expect(back?.filters.star).toBe("4");
        expect(back?.filters.walk).toBe("10");
        expect(GRADES[back!.filters.gmin]).toBe("6a");
        expect(GRADES[back!.filters.gmax]).toBe("6c+");
        expect(back?.filters.minIn).toBe(3);
        expect([...(back?.filters.orient ?? [])].sort()).toEqual(["S", "SW"]);
        expect(back?.filters.area).toBe("Placche");
        expect(back?.filters.muni).toBe("Finale Ligure");
        expect(back?.filters.hideClosure).toBe(true);
        expect(back?.filters.q).toBe("platte");
        expect(back?.sort).toBe("name");
        expect(back?.dir).toBe(-1);
    });

    it("keeps a one-sided grade range, whose other end is the default", () => {
        // «8a and up» is the preset chip, and its upper end is the top of the ladder -- the
        // default. Dropped as unchanged, it left `fromStored` with half a pair, which it refuses,
        // and the link arrived with no grade filter at all.
        const back = round({
            ...emptyFilters(),
            gmin: GRADES.indexOf("8a"),
            gmax: GRADE_HI,
        });
        expect(GRADES[back!.filters.gmin]).toBe("8a");
        expect(back?.filters.gmax).toBe(GRADE_HI);

        // And the same from the other end.
        const low = round({ ...emptyFilters(), gmin: GRADE_LO, gmax: GRADES.indexOf("5c") });
        expect(low?.filters.gmin).toBe(GRADE_LO);
        expect(GRADES[low!.filters.gmax]).toBe("5c");
    });

    it("carries the search text, which localStorage deliberately does not keep", () => {
        // Half of what one wants to share is «look for Platte»; but a search typed yesterday
        // should not be waiting at the next start, so only the link has it.
        expect(round({ ...emptyFilters(), q: "gelbe wand" })?.filters.q).toBe("gelbe wand");
    });

    it("will not carry more search text than a field can hold", () => {
        const back = round({ ...emptyFilters(), q: "x".repeat(500) });
        expect(back?.filters.q.length).toBe(100);
    });

    it("is null for anything that is not a code of ours", () => {
        expect(decodeFilterCode("", where)).toBeNull();
        expect(decodeFilterCode("F1.", where)).toBeNull();
        expect(decodeFilterCode("F2.AQID", where)).toBeNull();
        expect(decodeFilterCode("F1.not base64!", where)).toBeNull();
        // Truncated by a chat window, or cut off at a `#`.
        const whole = encodeFilterCode({ ...emptyFilters(), star: "4" }, "area", 1) ?? "";
        expect(decodeFilterCode(whole.slice(0, whole.length - 4), where)).toBeNull();
    });

    it("drops an area or a municipality this region has never heard of", () => {
        // The commonest way a link goes stale: it was made in another region, or in a newer
        // version of the same one.
        const back = round({ ...emptyFilters(), area: "Nowhere", muni: "Atlantis" });
        expect(back?.filters.area).toBe("");
        expect(back?.filters.muni).toBe("");
    });

    it("refuses a value no control could have produced", () => {
        // Hand-written rather than encoded: a code is opaque, but not secret, and somebody will
        // eventually make one up.
        const forged = (F: Record<string, unknown>, rest: Record<string, unknown> = {}) => {
            const json = JSON.stringify({ F, ...rest });
            const b64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            return decodeFilterCode(`F1.${b64}`, where);
        };
        expect(forged({ star: "9" })?.filters.star).toBe("any");
        expect(forged({ walk: "<script>" })?.filters.walk).toBe("any");
        expect(forged({ minIn: 9999 })?.filters.minIn).toBe(1);
        expect(forged({ hideClosure: "yes" })?.filters.hideClosure).toBe(false);
        expect(forged({ orient: ["S", "UP", 7] })?.filters.orient).toEqual(new Set(["S"]));
        expect(forged({ gmin: "0a", gmax: "99z" })?.filters.gmin).toBe(GRADE_LO);
        expect(forged({ gmin: "0a", gmax: "99z" })?.filters.gmax).toBe(GRADE_HI);
        // An inverted range would hide every route there is.
        expect(forged({ gmin: "7a", gmax: "5a" })?.filters.gmin).toBe(GRADE_LO);
        expect(forged({}, { sort: "nonsense" })?.sort).toBe("area");
        // «nearest to me» needs a fresh location, so no link may ask for it.
        expect(forged({}, { sort: "me" })?.sort).toBe("area");
        expect(forged({}, { dir: 7 })?.dir).toBe(1);
    });

    it("ignores the reliability filter, which has no control any more", () => {
        const back = round({ ...emptyFilters(), star: "4", conf: new Set(["high"]) });
        expect(back?.filters.conf.size).toBe(0);
    });
});
