/**
 * Fetching the multi-day forecast for one crag.
 *
 * A port of the original's `fcFor` (index.html:3468). Two things in it are not obvious:
 *
 * - **Two models are asked, and merged.** In Switzerland MeteoSwiss' ICON-CH1/CH2 is far finer
 *   (1-2 km) than the global model, but it only reaches a few days out. So both are requested and
 *   each hour takes the Swiss value when there is one, falling back to the global model after
 *   that. `chUntil` records where the fine model stopped, which is what the source line reports.
 * - **The elevation is overridden where we know better.** A model cell's mean height can be
 *   hundreds of metres off in a valley, and temperature follows height. For Swiss crags the
 *   height comes from swisstopo and is passed to Open-Meteo, so the temperatures are for the
 *   crag rather than for the valley floor.
 */

import type { ForecastData } from "@core/forecast";

import { fetchHeight } from "./swisstopo";

const URL_BASE = "https://api.open-meteo.com/v1/forecast";

const VARS = [
    "temperature_2m",
    "precipitation",
    "weather_code",
    "is_day",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "sunshine_duration",
    "precipitation_probability",
    "freezing_level_height",
].join(",");

const CH_MODEL = "meteoswiss_icon_seamless";

/** Kept for half an hour, as the original's `FC_TTL`. */
export const FC_TTL = 30 * 60 * 1000;

interface Hourly {
    time?: number[];
    [key: string]: (number | null)[] | number[] | undefined;
}

interface Answer {
    hourly?: Hourly;
    elevation?: number;
}

const getJson = async (url: string): Promise<Answer> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as Answer;
};

export interface ForecastRequest {
    readonly lat: number;
    readonly lon: number;
    /** A Swiss crag asks MeteoSwiss as well, and gets its height from swisstopo. */
    readonly ch: boolean;
    /** A height already known from swisstopo, so a repeat does not ask again. */
    readonly knownElevation?: number | null;
}

export const loadForecast = async ({
    lat,
    lon,
    ch,
    knownElevation = null,
}: ForecastRequest): Promise<ForecastData> => {
    let elevation = knownElevation;
    if (ch && elevation == null) {
        elevation = await fetchHeight(lat, lon).catch(() => null);
    }

    const query =
        `${URL_BASE}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
        (elevation != null ? `&elevation=${Math.round(elevation)}` : "") +
        `&hourly=${VARS}&wind_speed_unit=kmh&timeformat=unixtime` +
        "&timezone=Europe%2FZurich&forecast_days=7";

    const [swiss, global] = await Promise.allSettled([
        ch ? getJson(`${query}&models=${CH_MODEL}`) : Promise.reject(new Error("not CH")),
        getJson(query),
    ]);

    const A = swiss.status === "fulfilled" && swiss.value.hourly ? swiss.value : null;
    const B = global.status === "fulfilled" && global.value.hourly ? global.value : null;
    if (!A && !B) {
        throw global.status === "rejected"
            ? (global.reason as Error)
            : new Error("no forecast data");
    }

    const base = B ?? A!;
    const times = base.hourly?.time ?? [];
    // The request asks for `timeformat=unixtime`, so these are seconds. Anything else -- a proxy
    // or a captive portal answering with something of its own, a changed contract -- would reach
    // `new Date(NaN)` deep in the rendering and throw «Invalid time value» out of a render, which
    // takes the whole page down rather than this one card. Refuse it here, where the card's own
    // error line can say so.
    if (!times.length || times.some((at) => !Number.isFinite(at))) {
        throw new Error("no forecast data");
    }
    const swissAt = A ? new Map((A.hourly?.time ?? []).map((x, i) => [x, i])) : null;

    /** Prefer the Swiss model's value for an hour; fall back to the global one. */
    const pick = (key: string): (number | null)[] =>
        times.map((at, i) => {
            const j = swissAt?.get(at);
            const fine = j != null ? ((A?.hourly?.[key]?.[j] as number | null) ?? null) : null;
            if (fine != null) return fine;
            return (B?.hourly?.[key]?.[i] as number | null) ?? null;
        });

    // How far the fine model actually reaches: the hours for which it gave rain at all.
    const chHours = A
        ? times.filter((at) => {
              const j = swissAt?.get(at);
              return j != null && A.hourly?.precipitation?.[j] != null;
          }).length
        : 0;

    return {
        at: Date.now(),
        t: times,
        temp: pick("temperature_2m"),
        rr: pick("precipitation"),
        wc: pick("weather_code"),
        day: pick("is_day"),
        ws: pick("wind_speed_10m"),
        wg: pick("wind_gusts_10m"),
        wd: pick("wind_direction_10m"),
        sun: pick("sunshine_duration"),
        pp: pick("precipitation_probability"),
        fz: pick("freezing_level_height"),
        elev: elevation ?? (Number.isFinite(base.elevation) ? (base.elevation ?? null) : null),
        elevSrc: elevation != null ? "swisstopo" : "model",
        model: chHours ? "ch" : "om",
        chUntil: chHours ? (times[chHours - 1] ?? null) : null,
    };
};
