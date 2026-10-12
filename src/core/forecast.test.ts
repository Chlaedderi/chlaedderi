import { describe, expect, it } from "vitest";

import {
    daySymbol,
    forecastDays,
    forecastHours,
    freezingText,
    tempText,
    windDir,
    wmoText,
    type ForecastData,
} from "./forecast";

/** What one hour of the made-up series carries. */
interface Hour {
    temp?: number;
    rr?: number;
    wc?: number;
    ws?: number;
    wg?: number;
    wd?: number;
    sun?: number;
    pp?: number;
    fz?: number;
}

/** A whole number of days of hourly data, starting at midnight Zurich time. */
const series = (days: number, at: (i: number, hour: number) => Hour): ForecastData => {
    // 2026-03-10T00:00 Europe/Zurich is 2026-03-09T23:00Z.
    const start = Date.UTC(2026, 2, 9, 23, 0, 0) / 1000;
    const n = days * 24;
    const out: Record<string, unknown[]> = {
        t: [],
        temp: [],
        rr: [],
        wc: [],
        day: [],
        ws: [],
        wg: [],
        wd: [],
        sun: [],
        pp: [],
        fz: [],
    };
    for (let i = 0; i < n; i++) {
        const hour = i % 24;
        const o = at(i, hour);
        out.t!.push(start + i * 3600);
        out.temp!.push(o.temp ?? 10);
        out.rr!.push(o.rr ?? 0);
        out.wc!.push(o.wc ?? 0);
        out.day!.push(1);
        out.ws!.push(o.ws ?? 5);
        out.wg!.push(o.wg ?? 9);
        out.wd!.push(o.wd ?? 0);
        out.sun!.push(o.sun ?? 0);
        out.pp!.push(o.pp ?? 0);
        out.fz!.push(o.fz ?? 3000);
    }
    return {
        ...(out as unknown as ForecastData),
        at: Date.now(),
        elev: 500,
        elevSrc: "model",
        model: "om",
        chUntil: null,
    };
};

describe("daySymbol", () => {
    // The original: two or more wet hours *and* at least 0.5 mm means the worst wet code wins.
    it("shows the worst wet code when the day is genuinely wet", () => {
        expect(daySymbol([0, 0, 61, 95], 2)).toBe(95);
    });

    it("ignores a lone wet hour", () => {
        expect(daySymbol([0, 0, 0, 95], 2)).toBe(0);
    });

    it("ignores wet hours that brought almost no rain", () => {
        expect(daySymbol([0, 61, 95], 0.2)).toBe(0);
    });

    it("otherwise takes the commonest dry code", () => {
        expect(daySymbol([3, 3, 3, 0], 0)).toBe(3);
    });

    it("breaks a tie towards the duller sky, as the original did", () => {
        // Equal counts: the higher code wins, so «overcast» beats «clear».
        expect(daySymbol([0, 3], 0)).toBe(3);
    });
});

describe("forecastDays", () => {
    it("groups the hours into local days", () => {
        const days = forecastDays(series(3, () => ({})));
        expect(days).toHaveLength(3);
        expect(days[0]!.d).toBe("2026-03-10");
        expect(days[0]!.h).toHaveLength(24);
    });

    it("drops a day with too few hours, rather than showing a stub", () => {
        const full = series(2, () => ({}));
        // Chop the last day down to 19 hours: below the original's threshold of 20.
        const cut: ForecastData = {
            ...full,
            t: full.t.slice(0, 24 + 19),
            temp: full.temp.slice(0, 24 + 19),
            rr: full.rr.slice(0, 24 + 19),
            wc: full.wc.slice(0, 24 + 19),
            day: full.day.slice(0, 24 + 19),
            ws: full.ws.slice(0, 24 + 19),
            wg: full.wg.slice(0, 24 + 19),
            wd: full.wd.slice(0, 24 + 19),
            sun: full.sun.slice(0, 24 + 19),
            pp: full.pp.slice(0, 24 + 19),
            fz: full.fz.slice(0, 24 + 19),
        };
        expect(forecastDays(cut)).toHaveLength(1);
    });

    it("sums the rain, keeps the worst probability and the strongest gust", () => {
        const days = forecastDays(
            series(1, (_i, hour) => (hour === 12 ? { rr: 3, pp: 80, wg: 70 } : { rr: 1, pp: 10 })),
        );
        expect(days[0]!.rr).toBeCloseTo(3 + 23, 5);
        expect(days[0]!.pp).toBe(80);
        expect(days[0]!.wg).toBe(70);
    });

    it("takes the symbol and the freezing level from the daylight hours only", () => {
        // Thunderstorms at night must not decide the day's symbol.
        const days = forecastDays(
            series(1, (_i, hour) => (hour < 8 ? { wc: 95, rr: 5, fz: 500 } : { wc: 0, fz: 3000 })),
        );
        expect(days[0]!.code).toBe(0);
        expect(days[0]!.fz.every((f) => f === 3000)).toBe(true);
    });
});

describe("forecastHours", () => {
    it("gives every third hour from 03:00", () => {
        const data = series(1, () => ({}));
        const rows = forecastHours(data, forecastDays(data)[0]!, data.t[0]!);
        expect(rows.map((r) => r.hour)).toEqual([3, 6, 9, 12, 15, 18, 21]);
    });

    it("carries the rain of the three hours ending at the row", () => {
        const data = series(1, (_i, hour) => ({ rr: hour >= 4 && hour <= 6 ? 2 : 0 }));
        const rows = forecastHours(data, forecastDays(data)[0]!, data.t[0]!);
        // 04:00, 05:00 and 06:00 each brought 2 mm, and all three end at the 06:00 row.
        expect(rows.find((r) => r.hour === 6)!.rr3).toBeCloseTo(6, 5);
        expect(rows.find((r) => r.hour === 3)!.rr3).toBeCloseTo(0, 5);
    });

    it("marks the hours that have already passed", () => {
        const data = series(1, () => ({}));
        const day = forecastDays(data)[0]!;
        const rows = forecastHours(data, day, data.t[0]! + 12 * 3600);
        expect(rows.find((r) => r.hour === 3)!.past).toBe(true);
        expect(rows.find((r) => r.hour === 18)!.past).toBe(false);
    });
});

describe("the small formatters", () => {
    it("names the weather in both languages, and says nothing for a code it lacks", () => {
        expect(wmoText(95, "en")).toBe("thunderstorms");
        expect(wmoText(95, "de")).toBe("Gewitter");
        expect(wmoText(4242, "en")).toBe("");
    });

    it("rounds the freezing level to 50 m, and gives a range when it moves", () => {
        expect(freezingText([2480, 2480])).toBe("2500");
        expect(freezingText([2480, 3120])).toBe("2500–3100");
        expect(freezingText([])).toBeNull();
    });

    it("shows a missing temperature as a dash, not as 0°", () => {
        expect(tempText(null)).toBe("–");
        expect(tempText(12.4)).toBe("12°");
        expect(tempText(-3.6)).toBe("-4°");
    });

    it("puts a wind direction on one of the eight points", () => {
        expect(windDir(0)).toBe("N");
        expect(windDir(90)).toBe("E");
        expect(windDir(359)).toBe("N");
        expect(windDir(-90)).toBe("W");
        expect(windDir(null)).toBeNull();
    });
});
