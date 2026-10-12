/**
 * The context the rain forecast travels in, and the hook that reads it.
 *
 * Separate from WeatherProvider.tsx so that file exports components only, which is what React
 * fast refresh needs.
 */

import { createContext, useContext } from "react";

import type { WeatherSeries, WeatherState } from "@core/weather";
import type { Crag } from "@domain/model";

export interface WeatherContextValue {
    /** When the data was fetched, or null when there is none yet. */
    readonly at: number | null;
    readonly loading: boolean;
    /** What went wrong last time, in the service's own words. */
    readonly error: string | null;
    readonly stateOf: (crag: Crag) => WeatherState | null;
    readonly seriesOf: (crag: Crag) => WeatherSeries | null;
    /** Ask for the forecast. Does nothing when it is fresh, unless `force`. */
    readonly load: (force?: boolean) => void;
}

export const WeatherContext = createContext<WeatherContextValue | null>(null);

export const useWeather = (): WeatherContextValue => {
    const value = useContext(WeatherContext);
    if (!value) throw new Error("useWeather outside WeatherProvider");
    return value;
};
