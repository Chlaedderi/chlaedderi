/**
 * How wet a crag is, from the rain model.
 *
 * The rule, unchanged from the hand-written app, in the order it is applied:
 *
 *   **rain**  it is raining now (≥ 0.2 mm in the current hour) or has just rained
 *             (≥ 0.3 mm in the last 3 hours)
 *   **wet**   ≥ 1 mm fell inside the time this wall needs to dry -- 12 h for a wall the data
 *             calls fast-drying, 48 h for a slow one, 24 h otherwise
 *   **soon**  ≥ 1 mm expected in the next 6 hours, or a probability of ≥ 60 %
 *   **dry**   none of the above
 *
 * These are **model values**, not a measurement at the wall, and a model misses thunderstorms. The
 * app says so wherever it shows them; this module only computes.
 *
 * Pure on purpose: everything that talks to the network is in src/services/openMeteo.ts, so the
 * rule itself can be tested against a fixed series without a fixture server.
 */

import type { Crag } from "@domain/model";

export type WeatherState = "dry" | "soon" | "wet" | "rain";

/** The hourly series for one grid cell. `t` in seconds, `p` in mm, `pr` in per cent. */
export interface WeatherSeries {
    readonly t: readonly number[];
    readonly p: readonly (number | null)[];
    readonly pr?: readonly (number | null)[];
    /** "ch" when the rain came from the MeteoSwiss model rather than the default blend. */
    readonly m?: string;
}

export interface WeatherReading {
    readonly st: WeatherState;
    /** Rain in the last 24 and 48 hours, in mm. */
    readonly p24: number;
    readonly p48: number;
    /** Rain expected in the next 6 and 24 hours, in mm. */
    readonly n6: number;
    readonly n24: number;
    /** The highest probability in the next 6 hours, in per cent. */
    readonly pr6: number;
    /** Hours since it last rained, or null when it has not in the series. */
    readonly since: number | null;
}

/** How long this wall takes to dry, in hours. */
export const dryingHours = (dry: Crag["dry"]): number =>
    dry === "fast" ? 12 : dry === "slow" ? 48 : 24;

/** The grid the forecast is asked for: about one kilometre. */
export const WX_GRID = 0.01;

export const cell = (v: number): string => (Math.round(v / WX_GRID) * WX_GRID).toFixed(2);

/** A crag's own position, or its car park when the wall is not located. */
export const positionOf = (
    crag: Crag,
    parks: Readonly<Record<string, { lat: number; lon: number }>>,
): { lat: number; lon: number } | null => {
    if (crag.coord) return { lat: crag.coord.lat, lon: crag.coord.lon };
    const park = crag.pk ? parks[crag.pk] : null;
    return park ? { lat: park.lat, lon: park.lon } : null;
};

export const cellKey = (
    crag: Crag,
    parks: Readonly<Record<string, { lat: number; lon: number }>>,
): string | null => {
    const p = positionOf(crag, parks);
    return p ? `${cell(p.lat)},${cell(p.lon)}` : null;
};

/**
 * Read one crag's state out of its series.
 *
 * `now` is a parameter rather than `Date.now()` so the rule can be tested against a fixed series.
 */
export const readWeather = (
    series: WeatherSeries | null | undefined,
    dry: Crag["dry"],
    now: number = Date.now() / 1000,
): WeatherReading | null => {
    if (!series?.t.length) return null;

    const window = dryingHours(dry) * 3600;
    let p3 = 0;
    let p24 = 0;
    let p48 = 0;
    let inWindow = 0;
    let n6 = 0;
    let n24 = 0;
    let pr6 = 0;
    let current = 0;
    let last: number | null = null;

    for (let i = 0; i < series.t.length; i++) {
        const at = series.t[i]!;
        const mm = Number(series.p[i]) || 0;
        // A value covers the hour that *ends* at its time stamp.
        const age = now - at;

        if (age >= 0) {
            if (age < 3 * 3600) p3 += mm;
            if (age < 86400) p24 += mm;
            if (age < 2 * 86400) p48 += mm;
            if (age < window) inWindow += mm;
            if (mm >= 0.1 && (last == null || at > last)) last = at;
        } else if (age > -86400) {
            n24 += mm;
            if (age > -6 * 3600) {
                n6 += mm;
                pr6 = Math.max(pr6, Number(series.pr?.[i]) || 0);
            }
            if (age > -3600) current = mm;
        }
    }

    const st: WeatherState =
        current >= 0.2 || p3 >= 0.3
            ? "rain"
            : inWindow >= 1
              ? "wet"
              : n6 >= 1 || pr6 >= 60
                ? "soon"
                : "dry";

    return { st, p24, p48, n6, n24, pr6, since: last == null ? null : (now - last) / 3600 };
};

/** `0`, `3.4 mm`, `12 mm` -- the precision the old `mmTxt` chose. */
export const formatMm = (v: number): string =>
    `${v < 0.05 ? "0" : v < 10 ? v.toFixed(1) : Math.round(v)} mm`;

/** One bar of the hourly rain chart: how much fell (or is expected), and whether it is forecast. */
export interface RainBar {
    readonly mm: number;
    readonly future: boolean;
}

export interface RainChart {
    readonly bars: readonly RainBar[];
    /** The tallest bar's value, which the chart labels and scales against. */
    readonly top: number;
    /** Where «now» sits, as a percentage across the chart. */
    readonly nowAt: number;
}

/**
 * The 48 hourly bars the original drew: 24 behind, 24 ahead.
 *
 * Quoting it (`wxHTML`, index.html:3361): bar `k` covers the hour *ending* at `base + k*3600`, the
 * run goes `k = -23 … 24`, the scale is `max(2, …)` so a dry week is not drawn as a wall of noise,
 * and the «now» line sits at `(23 + (now-base)/3600) / 48` across.
 */
export const rainChart = (
    series: WeatherSeries | null | undefined,
    now: number = Date.now() / 1000,
): RainChart | null => {
    if (!series?.t.length) return null;

    const base = Math.floor(now / 3600) * 3600;
    const bars: RainBar[] = [];
    for (let k = -23; k <= 24; k++) {
        const at = base + k * 3600;
        const i = series.t.indexOf(at);
        bars.push({ mm: i < 0 ? 0 : Number(series.p[i]) || 0, future: at > now });
    }

    return {
        bars,
        top: Math.max(2, ...bars.map((b) => b.mm)),
        nowAt: ((23 + (now - base) / 3600) / 48) * 100,
    };
};
