/**
 * The multi-day forecast, as arithmetic with no network and no DOM.
 *
 * The hand-written app's `fcDays`, `daySymbol`, `fcHourRows` and the WMO vocabulary
 * (index.html:3535-3580). All of it was missing from the React port: the crag page had the rain
 * verdict and the hourly chart, but nothing that answered «what is the week going to do».
 *
 * Everything here works on whole hours in the crag's own time zone, because the day boundaries
 * have to be local ones -- a forecast split on UTC midnight would put the evening of one day with
 * the next.
 */

/** The hourly series the forecast service returns, one entry per hour. */
export interface ForecastData {
    /** Unix seconds. */
    readonly t: readonly number[];
    readonly temp: readonly (number | null)[];
    /** Rain in mm for the hour ending at `t`. */
    readonly rr: readonly (number | null)[];
    /** WMO weather code. */
    readonly wc: readonly (number | null)[];
    readonly day: readonly (number | null)[];
    readonly ws: readonly (number | null)[];
    readonly wg: readonly (number | null)[];
    readonly wd: readonly (number | null)[];
    /** Sunshine in seconds. */
    readonly sun: readonly (number | null)[];
    readonly pp: readonly (number | null)[];
    readonly fz: readonly (number | null)[];
    readonly at: number;
    readonly elev: number | null;
    readonly elevSrc: "swisstopo" | "model";
    readonly model: "ch" | "om";
    readonly chUntil: number | null;
}

export interface ForecastDay {
    /** `2026-10-11`, in the crag's own time zone. */
    readonly d: string;
    /** Indices into the hourly series. */
    readonly h: readonly number[];
    readonly tmin: number;
    readonly tmax: number;
    /** Total rain for the day, mm. */
    readonly rr: number;
    /** Highest hourly probability, %. */
    readonly pp: number;
    /** Sunshine, seconds. */
    readonly sun: number;
    readonly ws: number;
    readonly wg: number;
    readonly fz: readonly number[];
    readonly code: number;
}

/** Split a timestamp into the local day and hour the forecast's time zone puts it in. */
export const localParts = (ts: number, zone: string): { d: string; h: number } => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
    }).formatToParts(new Date(ts * 1000));
    const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
    return { d: `${get("year")}-${get("month")}-${get("day")}`, h: Number(get("hour")) % 24 };
};

/**
 * The one symbol that stands for a whole day.
 *
 * The original's rule, verbatim: if at least two hours are wet (code ≥ 51) and the day's rain
 * reaches 0.5 mm, show the *worst* of the wet codes -- a day with two thunderstorm hours is a
 * thunderstorm day even if the rest is clear. Otherwise show the most common dry code, and on a
 * tie the higher one, so «overcast» beats «clear».
 */
export const daySymbol = (codes: readonly number[], rain: number): number => {
    const wet = codes.filter((c) => c >= 51);
    if (wet.length >= 2 && rain >= 0.5) return Math.max(...wet);

    const counts = new Map<number, number>();
    for (const c of codes) if (c < 51) counts.set(c, (counts.get(c) ?? 0) + 1);

    let best = codes.length ? codes[0]! : 3;
    let bestN = -1;
    for (const [code, n] of counts) {
        if (n > bestN || (n === bestN && code > best)) {
            best = code;
            bestN = n;
        }
    }
    return best;
};

/**
 * Group the hourly series into days.
 *
 * A day is kept only when it has at least 20 of its hours, which is what drops the ragged first
 * and last day of the window instead of showing a «day» made of three hours.
 */
export const forecastDays = (o: ForecastData, zone = "Europe/Zurich"): ForecastDay[] => {
    interface Acc {
        d: string;
        h: number[];
        tmin: number;
        tmax: number;
        rr: number;
        pp: number;
        sun: number;
        ws: number;
        wg: number;
        fz: number[];
        codes: number[];
    }
    const by = new Map<string, Acc>();

    o.t.forEach((ts, i) => {
        const z = localParts(ts, zone);
        let day = by.get(z.d);
        if (!day) {
            day = {
                d: z.d,
                h: [],
                tmin: Infinity,
                tmax: -Infinity,
                rr: 0,
                pp: 0,
                sun: 0,
                ws: 0,
                wg: 0,
                fz: [],
                codes: [],
            };
            by.set(z.d, day);
        }
        day.h.push(i);

        const temp = o.temp[i];
        if (temp != null) {
            day.tmin = Math.min(day.tmin, temp);
            day.tmax = Math.max(day.tmax, temp);
        }
        day.rr += Number(o.rr[i]) || 0;
        day.pp = Math.max(day.pp, Number(o.pp[i]) || 0);
        day.sun += Number(o.sun[i]) || 0;
        day.ws = Math.max(day.ws, Number(o.ws[i]) || 0);
        day.wg = Math.max(day.wg, Number(o.wg[i]) || 0);

        // Only the daylight hours decide the symbol and the freezing level.
        if (z.h >= 8 && z.h <= 19) {
            if (o.wc[i] != null) day.codes.push(Number(o.wc[i]));
            if (o.fz[i] != null) day.fz.push(Number(o.fz[i]));
        }
    });

    return [...by.values()]
        .filter((d) => d.h.length >= 20 && Number.isFinite(d.tmax))
        .map((d) => ({ ...d, code: daySymbol(d.codes, d.rr) }));
};

/** One three-hourly row of an opened day. */
export interface ForecastHour {
    readonly i: number;
    readonly hour: number;
    /** Rain of the three hours up to and including this one, mm. */
    readonly rr3: number;
    readonly code: number;
    readonly past: boolean;
}

/**
 * The rows inside an opened day: every third hour from 03:00, each carrying the rain of the three
 * hours that end with it -- which is why the column is headed «Rain 3 h».
 */
export const forecastHours = (
    o: ForecastData,
    day: ForecastDay,
    now: number = Date.now() / 1000,
    zone = "Europe/Zurich",
): ForecastHour[] => {
    const rows: ForecastHour[] = [];
    for (let k = 0; k < day.h.length; k++) {
        const i = day.h[k]!;
        const z = localParts(o.t[i]!, zone);
        if (z.h % 3 || z.h < 3) continue;

        let rr3 = 0;
        for (let m = Math.max(0, k - 2); m <= k; m++) rr3 += Number(o.rr[day.h[m]!]) || 0;

        rows.push({
            i,
            hour: z.h,
            rr3,
            code: o.wc[i] != null ? Number(o.wc[i]) : 3,
            past: o.t[i]! < now - 1800,
        });
    }
    return rows;
};

/** The WMO code vocabulary the original carried, English and German. */
const WMO: Record<number, readonly [string, string]> = {
    0: ["clear", "sonnig"],
    1: ["mainly clear", "meist sonnig"],
    2: ["partly cloudy", "teilweise bewölkt"],
    3: ["overcast", "bedeckt"],
    45: ["fog", "Nebel"],
    48: ["fog with rime", "Nebel mit Raureif"],
    51: ["light drizzle", "leichter Nieselregen"],
    53: ["drizzle", "Nieselregen"],
    55: ["dense drizzle", "starker Nieselregen"],
    56: ["freezing drizzle", "gefrierender Nieselregen"],
    57: ["freezing drizzle", "gefrierender Nieselregen"],
    61: ["light rain", "leichter Regen"],
    63: ["rain", "Regen"],
    65: ["heavy rain", "starker Regen"],
    66: ["freezing rain", "gefrierender Regen"],
    67: ["freezing rain", "gefrierender Regen"],
    71: ["light snow", "leichter Schneefall"],
    73: ["snow", "Schneefall"],
    75: ["heavy snow", "starker Schneefall"],
    77: ["snow grains", "Schneegriesel"],
    80: ["rain showers", "Regenschauer"],
    81: ["heavy showers", "kräftige Regenschauer"],
    82: ["violent showers", "heftige Regenschauer"],
    85: ["snow showers", "Schneeschauer"],
    86: ["heavy snow showers", "kräftige Schneeschauer"],
    95: ["thunderstorms", "Gewitter"],
    96: ["thunderstorms with hail", "Gewitter mit Hagel"],
    99: ["thunderstorms with hail", "Gewitter mit Hagel"],
};

export const wmoText = (code: number, lang: string): string =>
    WMO[code]?.[lang === "de" ? 1 : 0] ?? "";

/** Rounded to the nearest 50 m, and given as a range when the day's levels differ. */
export const freezingText = (levels: readonly number[]): string | null => {
    if (!levels.length) return null;
    const r50 = (v: number): number => Math.round(v / 50) * 50;
    const lo = r50(Math.min(...levels));
    const hi = r50(Math.max(...levels));
    return lo === hi ? String(lo) : `${lo}–${hi}`;
};

export const tempText = (v: number | null | undefined): string =>
    v == null ? "–" : `${Math.round(v)}°`;

const DIRS8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Which of the eight points a wind direction falls on. */
export const windDir = (deg: number | null | undefined): string | null =>
    deg == null ? null : (DIRS8[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? null);
