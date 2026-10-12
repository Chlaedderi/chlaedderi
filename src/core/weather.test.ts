import { describe, expect, it } from "vitest";

import {
    cell,
    cellKey,
    dryingHours,
    formatMm,
    rainChart,
    readWeather,
    type WeatherSeries,
} from "./weather";

/**
 * The dry rule, against fixed series.
 *
 * This is the rule the whole weather filter and every marker badge rest on, and it is the kind of
 * thing that is easy to port *almost* right. Every case below states the hour it is testing.
 */

const HOUR = 3600;
/** Midday, so "two days back" never crosses anything awkward. */
const NOW = 1_760_000_000;

/** A series of `hours` hourly readings ending `after` hours from now; mm per hour. */
const series = (entries: { at: number; mm: number; pr?: number }[]): WeatherSeries => ({
    t: entries.map((e) => NOW + e.at * HOUR),
    p: entries.map((e) => e.mm),
    pr: entries.map((e) => e.pr ?? 0),
});

describe("the drying window", () => {
    it("is 12 h for a fast wall, 48 h for a slow one, 24 h otherwise", () => {
        expect(dryingHours("fast")).toBe(12);
        expect(dryingHours("slow")).toBe(48);
        expect(dryingHours("mid")).toBe(24);
        expect(dryingHours(null)).toBe(24);
    });
});

describe("readWeather", () => {
    it("says nothing without a series", () => {
        expect(readWeather(null, "mid", NOW)).toBeNull();
        expect(readWeather({ t: [], p: [] }, "mid", NOW)).toBeNull();
    });

    it("is dry when nothing has fallen and nothing is coming", () => {
        const s = series([
            { at: -24, mm: 0 },
            { at: -1, mm: 0 },
            { at: 1, mm: 0 },
            { at: 6, mm: 0 },
        ]);
        expect(readWeather(s, "mid", NOW)?.st).toBe("dry");
    });

    it("is raining when the current hour has 0.2 mm", () => {
        // The hour that ends within the next hour is "now".
        expect(readWeather(series([{ at: 0.5, mm: 0.2 }]), "mid", NOW)?.st).toBe("rain");
        expect(readWeather(series([{ at: 0.5, mm: 0.19 }]), "mid", NOW)?.st).not.toBe("rain");
    });

    it("is raining when 0.3 mm fell in the last three hours", () => {
        expect(readWeather(series([{ at: -2, mm: 0.3 }]), "mid", NOW)?.st).toBe("rain");
        // Just outside the three hours, and too little to wet the wall.
        expect(readWeather(series([{ at: -4, mm: 0.3 }]), "mid", NOW)?.st).toBe("dry");
    });

    it("is wet when 1 mm fell inside the drying window", () => {
        const twentyHoursAgo = series([{ at: -20, mm: 1 }]);
        // A fast wall (12 h) has had time; a normal one (24 h) has not.
        expect(readWeather(twentyHoursAgo, "fast", NOW)?.st).toBe("dry");
        expect(readWeather(twentyHoursAgo, "mid", NOW)?.st).toBe("wet");
        expect(readWeather(twentyHoursAgo, "slow", NOW)?.st).toBe("wet");
    });

    it("warns when rain is expected within six hours", () => {
        expect(readWeather(series([{ at: 3, mm: 1 }]), "mid", NOW)?.st).toBe("soon");
        // Beyond the six hours it is not «soon» any more.
        expect(readWeather(series([{ at: 9, mm: 5 }]), "mid", NOW)?.st).toBe("dry");
    });

    it("warns on a high probability even with little rain in the model", () => {
        expect(readWeather(series([{ at: 2, mm: 0.1, pr: 60 }]), "mid", NOW)?.st).toBe("soon");
        expect(readWeather(series([{ at: 2, mm: 0.1, pr: 59 }]), "mid", NOW)?.st).toBe("dry");
    });

    it("applies the states in order: rain beats wet beats soon", () => {
        const everything = series([
            { at: -30, mm: 10 },
            { at: -1, mm: 5 },
            { at: 0.5, mm: 5 },
            { at: 3, mm: 5, pr: 90 },
        ]);
        expect(readWeather(everything, "slow", NOW)?.st).toBe("rain");

        const wetAndSoon = series([
            { at: -10, mm: 5 },
            { at: 3, mm: 5, pr: 90 },
        ]);
        expect(readWeather(wetAndSoon, "mid", NOW)?.st).toBe("wet");
    });

    it("adds up the past and the coming rain", () => {
        const s = series([
            { at: -40, mm: 3 },
            { at: -10, mm: 2 },
            { at: 2, mm: 1, pr: 40 },
            { at: 10, mm: 4 },
        ]);
        const r = readWeather(s, "mid", NOW)!;
        expect(r.p24).toBeCloseTo(2, 5);
        expect(r.p48).toBeCloseTo(5, 5);
        expect(r.n6).toBeCloseTo(1, 5);
        expect(r.n24).toBeCloseTo(5, 5);
        expect(r.pr6).toBe(40);
    });

    it("says how long ago it last rained, ignoring a trace", () => {
        const s = series([
            { at: -30, mm: 2 },
            { at: -5, mm: 0.05 },
        ]);
        // 0.05 mm is not rain; the last real rain was 30 hours ago.
        expect(readWeather(s, "mid", NOW)?.since).toBeCloseTo(30, 1);
        expect(readWeather(series([{ at: -3, mm: 0 }]), "mid", NOW)?.since).toBeNull();
    });
});

describe("the forecast grid", () => {
    it("rounds a position to about a kilometre, so near crags share a request", () => {
        expect(cell(44.1734)).toBe("44.17");
        expect(cell(44.1766)).toBe("44.18");
        expect(cell(8.3)).toBe("8.30");
    });

    it("falls back to the car park when the wall is not located", () => {
        const parks = { "finale/x": { lat: 44.17, lon: 8.34 } };
        const base = { id: "c", coord: null, pk: "finale/x" } as never;
        expect(cellKey(base, parks)).toBe("44.17,8.34");

        const located = { id: "c", coord: { lat: 46.3, lon: 7.99 }, pk: "finale/x" } as never;
        expect(cellKey(located, parks)).toBe("46.30,7.99");

        expect(cellKey({ id: "c", coord: null, pk: null } as never, parks)).toBeNull();
    });
});

describe("formatMm", () => {
    it("shows what the number is worth, not more", () => {
        expect(formatMm(0)).toBe("0 mm");
        expect(formatMm(0.04)).toBe("0 mm");
        expect(formatMm(3.42)).toBe("3.4 mm");
        expect(formatMm(12.6)).toBe("13 mm");
    });
});

describe("rainChart", () => {
    // 09:00 exactly, so `base` and `now` coincide and the arithmetic is easy to check by hand.
    const NOW = Math.floor(1_760_000_000 / 3600) * 3600;
    const series = (entries: Record<number, number>): WeatherSeries => {
        const t: number[] = [];
        const p: number[] = [];
        for (let k = -30; k <= 30; k++) {
            t.push(NOW + k * 3600);
            p.push(entries[k] ?? 0);
        }
        return { t, p, pr: p.map(() => 0) };
    };

    it("draws 48 bars: 24 behind and 24 ahead", () => {
        const chart = rainChart(series({}), NOW)!;
        expect(chart.bars).toHaveLength(48);
        // The original ran k = -23 … 24, so exactly half are in the future.
        expect(chart.bars.filter((b) => b.future)).toHaveLength(24);
    });

    it("puts each hour's rain in its own bar", () => {
        // A value covers the hour that *ends* at its stamp, so -1 h is the last past bar.
        const chart = rainChart(series({ [-1]: 4, [2]: 7 }), NOW)!;
        expect(chart.bars[22]!.mm).toBe(4);
        expect(chart.bars[22]!.future).toBe(false);
        expect(chart.bars[25]!.mm).toBe(7);
        expect(chart.bars[25]!.future).toBe(true);
    });

    it("never scales below 2 mm, so a dry week is not drawn as noise", () => {
        expect(rainChart(series({}), NOW)!.top).toBe(2);
        expect(rainChart(series({ [-3]: 0.4 }), NOW)!.top).toBe(2);
        expect(rainChart(series({ [-3]: 9 }), NOW)!.top).toBe(9);
    });

    it("puts the now line just under halfway, where the original did", () => {
        // (23 + 0) / 48 -- the original's own expression.
        expect(rainChart(series({}), NOW)!.nowAt).toBeCloseTo((23 / 48) * 100, 5);
        // Half an hour later it has moved by half an hour's worth.
        expect(rainChart(series({}), NOW + 1800)!.nowAt).toBeCloseTo((23.5 / 48) * 100, 5);
    });

    it("has nothing to draw without a series", () => {
        expect(rainChart(null, NOW)).toBeNull();
        expect(rainChart({ t: [], p: [] }, NOW)).toBeNull();
    });
});
