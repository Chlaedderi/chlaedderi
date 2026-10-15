/**
 * The rain forecast, from Open-Meteo.
 *
 * Crags are grouped into grid cells of about a kilometre and asked for in batches of a hundred, so
 * a whole region costs a handful of requests rather than one per crag.
 *
 * Swiss crags get **MeteoSwiss' own model** (ICON-CH1 at 1 km for about 33 hours, ICON-CH2 at 2 km
 * beyond that) for the rain itself, because it is markedly better in the Alps. The probability,
 * which a single model run cannot give, and any hour that model leaves empty come from Open-Meteo's
 * default blend -- so the two requests are made together and merged, and either one failing still
 * leaves a usable answer.
 */

import { APP_SLUG } from "@core/name";
import { PREVIEW_SUFFIX } from "@core/preview";
import type { WeatherSeries } from "@core/weather";

const URL = "https://api.open-meteo.com/v1/forecast";

/** Half an hour: the model itself does not update faster. */
export const WX_TTL = 30 * 60 * 1000;
/** Suffixed in a pull request preview, like every other storage name: see preview.ts. */
export const WX_KEY = `${APP_SLUG}${PREVIEW_SUFFIX}:wx`;

export const WX_ATTRIBUTION =
    'Weather: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)';
export const WX_CH_ATTRIBUTION =
    'Wetter Schweiz: <a href="https://www.meteoswiss.admin.ch/" target="_blank" rel="noopener">MeteoSchweiz</a> ICON-CH1/CH2 (CC BY 4.0)';

const CH_MODEL = "meteoswiss_icon_seamless";
const BATCH = 100;

export type WeatherByCell = Record<string, WeatherSeries>;

interface HourlyResponse {
    hourly?: {
        time?: number[];
        precipitation?: (number | null)[];
        precipitation_probability?: (number | null)[];
    };
}

const get = async (url: string, signal?: AbortSignal): Promise<HourlyResponse[]> => {
    const response = await fetch(url, { cache: "no-store", ...(signal ? { signal } : {}) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json: unknown = await response.json();
    return Array.isArray(json) ? (json as HourlyResponse[]) : [json as HourlyResponse];
};

const batchUrl = (cells: readonly string[], model?: string): string => {
    const lat = cells.map((k) => k.split(",")[0]).join(",");
    const lon = cells.map((k) => k.split(",")[1]).join(",");
    const hourly = model ? "precipitation" : "precipitation,precipitation_probability";
    return (
        `${URL}?latitude=${lat}&longitude=${lon}` +
        `&hourly=${hourly}&past_days=2&forecast_days=2&timeformat=unixtime&timezone=GMT` +
        (model ? `&models=${model}` : "")
    );
};

/**
 * Merge the two answers for a Swiss cell: MeteoSwiss' rain where it has an hour, the blend's
 * otherwise, and the blend's probability throughout.
 */
const merge = (blend?: HourlyResponse, swiss?: HourlyResponse): WeatherSeries | null => {
    const a = blend?.hourly;
    const b = swiss?.hourly;
    const base = a ?? b;
    if (!base?.time) return null;

    const byTime = new Map((b?.time ?? []).map((x, i) => [x, i]));
    const p = base.time.map((at, i) => {
        const j = byTime.get(at);
        const fromSwiss = b && j != null ? b.precipitation?.[j] : null;
        return fromSwiss ?? a?.precipitation?.[i] ?? null;
    });

    return {
        t: base.time,
        p,
        pr: a?.precipitation_probability ?? [],
        ...(b ? { m: "ch" } : {}),
    };
};

export interface LoadWeatherOptions {
    /** Every cell the app wants, and which of them are in Switzerland. */
    readonly cells: readonly string[];
    readonly swissCells: ReadonlySet<string>;
    readonly signal?: AbortSignal;
}

/**
 * Fetch the rain for a set of cells. A batch survives one of its two requests failing; a batch
 * with no answer at all throws, so that the caller keeps the whole set it had rather than
 * replacing it with part of one.
 */
export const loadWeather = async ({
    cells,
    swissCells,
    signal,
}: LoadWeatherOptions): Promise<WeatherByCell> => {
    const groups = [
        cells.filter((k) => !swissCells.has(k)),
        cells.filter((k) => swissCells.has(k)),
    ];
    const out: WeatherByCell = {};

    for (const [index, group] of groups.entries()) {
        const swiss = index === 1;
        for (let i = 0; i < group.length; i += BATCH) {
            const batch = group.slice(i, i + BATCH);
            const [blend, ch] = await Promise.allSettled([
                get(batchUrl(batch), signal),
                swiss ? get(batchUrl(batch, CH_MODEL), signal) : Promise.reject(new Error("skip")),
            ]);
            if (blend.status !== "fulfilled" && ch.status !== "fulfilled") throw blend.reason;

            const blendRows = blend.status === "fulfilled" ? blend.value : [];
            const chRows = ch.status === "fulfilled" ? ch.value : [];
            batch.forEach((key, n) => {
                const merged = merge(blendRows[n], chRows[n]);
                if (merged) out[key] = merged;
            });
        }
    }
    return out;
};

/** What was fetched last, so the app starts with something while the request runs. */
export interface StoredWeather {
    readonly at: number;
    readonly pts: WeatherByCell;
}

export const readStoredWeather = (): StoredWeather | null => {
    try {
        const raw = localStorage.getItem(WX_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as Partial<StoredWeather>;
        // Older than two days is not worth showing, even as a placeholder.
        if (!value.at || Date.now() - value.at > 2 * 86_400_000) return null;
        return { at: value.at, pts: value.pts ?? {} };
    } catch {
        return null;
    }
};

export const writeStoredWeather = (value: StoredWeather): void => {
    try {
        localStorage.setItem(WX_KEY, JSON.stringify(value));
    } catch {
        // A full or blocked localStorage costs the cache, nothing more.
    }
};
