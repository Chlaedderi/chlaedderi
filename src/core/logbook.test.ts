import { describe, expect, it } from "vitest";

import {
    bestEntry,
    byDate,
    cleanLog,
    csvText,
    entryGradeIdx,
    gradePyramid,
    indexLog,
    isSend,
    logStats,
    newLogId,
    todayIso,
    type LogEntry,
} from "./logbook";

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
    id: "a1",
    k: "crag~route",
    s: "crag",
    n: "Route",
    g: "6a",
    d: "2026-10-01",
    st: "rp",
    r: 0,
    t: 1,
    ...over,
});

describe("cleanLog", () => {
    it("keeps a sound entry", () => {
        expect(cleanLog([entry()])).toEqual([entry()]);
    });

    it("drops anything that is not an entry", () => {
        expect(cleanLog(null)).toEqual([]);
        expect(cleanLog("nope")).toEqual([]);
        expect(cleanLog([null, 42, "x", {}])).toEqual([]);
        expect(cleanLog([entry({ d: "01.10.2026" })])).toEqual([]);
        expect(cleanLog([entry({ st: "sent" as never })])).toEqual([]);
        expect(cleanLog([{ ...entry(), id: 7 } as never])).toEqual([]);
    });

    it("clamps the fields, because the data came off a device", () => {
        const [out] = cleanLog([
            entry({ id: "x".repeat(50), n: "y".repeat(300), g: "z".repeat(40), r: 99 }),
        ]);
        expect(out!.id).toHaveLength(24);
        expect(out!.n).toHaveLength(120);
        expect(out!.g).toHaveLength(14);
        expect(out!.r).toBe(0);
    });

    it("keeps stars only in range, rounded", () => {
        expect(cleanLog([entry({ r: 3.4 })])[0]!.r).toBe(3);
        expect(cleanLog([entry({ r: 0 })])[0]!.r).toBe(0);
        expect(cleanLog([entry({ r: 6 })])[0]!.r).toBe(0);
    });

    it("accepts a numeric string for the write time, as the old code did", () => {
        expect(cleanLog([entry({ t: "1700000000" as never })])[0]!.t).toBe(1700000000);
        expect(cleanLog([entry({ t: "nonsense" as never })])[0]!.t).toBe(0);
    });

    it("turns a missing route key into null, never undefined", () => {
        expect(cleanLog([{ ...entry(), k: undefined } as never])[0]!.k).toBeNull();
    });
});

describe("sends and styles", () => {
    it("counts everything but an attempt as a send", () => {
        expect(isSend(entry({ st: "os" }))).toBe(true);
        expect(isSend(entry({ st: "tr" }))).toBe(true);
        expect(isSend(entry({ st: "att" }))).toBe(false);
    });

    it("picks the hardest style, and the latest among equals", () => {
        expect(bestEntry([entry({ id: "a", st: "rp" }), entry({ id: "b", st: "os" })])!.id).toBe(
            "b",
        );
        expect(
            bestEntry([
                entry({ id: "a", st: "rp", d: "2026-01-01" }),
                entry({ id: "b", st: "rp", d: "2026-05-05" }),
            ])!.id,
        ).toBe("b");
        expect(bestEntry([])).toBeNull();
    });
});

describe("indexLog", () => {
    it("indexes by route and by crag, and collects the sends", () => {
        const entries = [
            entry({ id: "a", k: "c1~r1", s: "c1" }),
            entry({ id: "b", k: "c1~r1", s: "c1", st: "att" }),
            entry({ id: "c", k: "c2~r1", s: "c2", st: "att" }),
            entry({ id: "d", k: null, s: "c2", custom: true }),
        ];
        const idx = indexLog(entries);
        expect(idx.byRoute["c1~r1"]).toHaveLength(2);
        expect(idx.byCrag.c1).toHaveLength(2);
        expect(idx.byCrag.c2).toHaveLength(2);
        // c1~r1 has a redpoint; c2~r1 only an attempt; the keyless entry counts for no route.
        expect([...idx.sent]).toEqual(["c1~r1"]);
    });
});

describe("entryGradeIdx", () => {
    it("prefers the route's own place on the ladder", () => {
        expect(entryGradeIdx(entry({ g: "4a" }), 30)).toBe(30);
    });

    it("reads the hardest grade out of what was typed", () => {
        expect(entryGradeIdx(entry({ g: "6a" }))).toBe(30);
        expect(entryGradeIdx(entry({ g: "6a/6b" }))).toBe(32);
        expect(entryGradeIdx(entry({ g: "5c, 6a+" }))).toBe(31);
        expect(entryGradeIdx(entry({ g: "V4" }))).toBeNull();
        expect(entryGradeIdx(entry({ g: "" }))).toBeNull();
    });
});

describe("ids and dates", () => {
    it("makes an id that is short and does not repeat", () => {
        const ids = new Set(Array.from({ length: 500 }, newLogId));
        expect(ids.size).toBe(500);
        for (const id of ids) expect(id.length).toBeLessThanOrEqual(24);
    });

    it("writes today in the local zone, not UTC", () => {
        // A local date, so an evening ascent is not filed under tomorrow.
        expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
        expect(todayIso(new Date(2026, 11, 31, 1, 0))).toBe("2026-12-31");
    });

    it("orders by date, then by when the entry was written", () => {
        const sorted = [
            entry({ id: "late", d: "2026-02-01", t: 1 }),
            entry({ id: "second", d: "2026-01-01", t: 2 }),
            entry({ id: "first", d: "2026-01-01", t: 1 }),
        ].sort(byDate);
        expect(sorted.map((e) => e.id)).toEqual(["first", "second", "late"]);
    });
});

describe("csvText", () => {
    const columns = {
        date: "Date",
        route: "Route",
        grade: "Grade",
        style: "Style",
        stars: "Stars",
        crag: "Crag",
        area: "Area",
        region: "Region",
    };
    const lookup = {
        crag: (id: string) =>
            id === "c1" ? { name: "Rocca", area: "Perti", region: "Finale" } : null,
        styleLabel: (st: string) => st.toUpperCase(),
    };

    it("starts with a byte-order mark so Excel reads the accents", () => {
        expect(csvText([entry()], columns, lookup).charCodeAt(0)).toBe(0xfeff);
    });

    it("separates with semicolons and ends lines with CRLF", () => {
        const csv = csvText([entry({ s: "c1" })], columns, lookup);
        expect(csv).toContain("Date;Route;Grade;Style;Stars;Crag;Area;Region\r\n");
        expect(csv.endsWith("\r\n")).toBe(true);
        expect(csv).toContain("2026-10-01;Route;6a;RP;;Rocca;Perti;Finale");
    });

    it("quotes a field that holds a semicolon, a quote or a newline", () => {
        const csv = csvText([entry({ n: 'A;B "C"\nD', s: "c1" })], columns, lookup);
        expect(csv).toContain('"A;B ""C""\nD"');
    });

    it("leaves the crag columns empty when its pack is not loaded", () => {
        const csv = csvText([entry({ s: "not-loaded" })], columns, lookup);
        expect(csv).toContain("2026-10-01;Route;6a;RP;;;;");
    });
});

describe("logStats", () => {
    it("counts entries, sends, routes, crags and days", () => {
        const stats = logStats(
            [
                entry({ id: "a", k: "c1~r1", s: "c1", d: "2026-01-01", g: "6a" }),
                entry({ id: "b", k: "c1~r1", s: "c1", d: "2026-01-01", st: "att" }),
                entry({ id: "c", k: "c1~r2", s: "c1", d: "2026-02-02", g: "7a" }),
                entry({ id: "d", k: "c2~r1", s: "c2", d: "2026-02-02", g: "5c" }),
            ],
            (e) => entryGradeIdx(e),
        );
        expect(stats.entries).toBe(4);
        expect(stats.sends).toBe(3);
        expect(stats.routes).toBe(3);
        expect(stats.crags).toBe(2);
        expect(stats.days).toBe(2);
        expect(stats.hardest[0]?.g).toBe("7a");
    });
});

describe("gradePyramid", () => {
    const at = (e: LogEntry): number | null => (e.g === "6a" ? 10 : e.g === "7a" ? 16 : null);

    it("counts sends per grade", () => {
        const bars = gradePyramid([entry({ g: "6a" }), entry({ g: "6a" }), entry({ g: "7a" })], at);
        expect(bars.get(10)).toBe(2);
        expect(bars.get(16)).toBe(1);
    });

    it("leaves attempts out, as lb.pyr.hint promises", () => {
        const bars = gradePyramid([entry({ g: "6a", st: "att" }), entry({ g: "6a" })], at);
        expect(bars.get(10)).toBe(1);
    });

    it("ignores an entry whose grade the ladder does not know", () => {
        expect(gradePyramid([entry({ g: "VI+" })], at).size).toBe(0);
    });
});
