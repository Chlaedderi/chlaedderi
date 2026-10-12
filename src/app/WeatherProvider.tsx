/**
 * The rain forecast for the loaded crags.
 *
 * It is fetched when something actually asks for it -- the «Dry now» chip, the weather filter, or
 * a crag page -- rather than on start: it is a network request per region and most visits never
 * need it. What was fetched last is kept in localStorage, so the app can show something at once
 * and refresh behind it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useData } from "@app/dataContext";
import { useAppSelector } from "@app/hooks";
import { WeatherContext, type WeatherContextValue } from "@app/weatherContext";
import { type WeatherSeries, type WeatherState, cellKey, readWeather } from "@core/weather";
import type { Crag } from "@domain/model";
import {
    type WeatherByCell,
    WX_TTL,
    loadWeather,
    readStoredWeather,
    writeStoredWeather,
} from "@services/openMeteo";

/** Supply the forecast directly. Used by the tests, which have no network. */
export const WeatherTestProvider = ({
    value,
    children,
}: {
    value: WeatherContextValue;
    children: ReactNode;
}) => <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;

export const WeatherProvider = ({ children }: { children: ReactNode }) => {
    const { crags, regions, parks } = useData();
    const enabled = useAppSelector((s) => s.prefs.wx);
    const stored = useRef(readStoredWeather());
    const [cells, setCells] = useState<WeatherByCell>(stored.current?.pts ?? {});
    const [at, setAt] = useState<number | null>(stored.current?.at ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const running = useRef<AbortController | null>(null);

    const swissRegions = useMemo(
        () => new Set(regions.filter((r) => r.ch).map((r) => r.key)),
        [regions],
    );

    const load = useCallback(
        (force = false) => {
            if (loading) return;
            if (!force && at && Date.now() - at < WX_TTL) return;
            if (navigator.onLine === false) return;

            const wanted = new Set<string>();
            const swiss = new Set<string>();
            for (const crag of crags) {
                const key = cellKey(crag, parks);
                if (!key) continue;
                wanted.add(key);
                if (swissRegions.has(crag.packId)) swiss.add(key);
            }
            if (!wanted.size) return;

            running.current?.abort();
            const controller = new AbortController();
            running.current = controller;
            setLoading(true);

            void loadWeather({ cells: [...wanted], swissCells: swiss, signal: controller.signal })
                .then((found) => {
                    if (controller.signal.aborted) return;
                    const now = Date.now();
                    setCells(found);
                    setAt(now);
                    setError(null);
                    writeStoredWeather({ at: now, pts: found });
                })
                .catch((e: unknown) => {
                    if (controller.signal.aborted) return;
                    setError(e instanceof Error ? e.message : String(e));
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoading(false);
                });
        },
        [at, crags, loading, parks, swissRegions],
    );

    // The filter is on from a previous visit: fetch without being asked, as the old app did.
    const wxFilter = useAppSelector((s) => s.filters.one.wx);
    useEffect(() => {
        if (enabled && wxFilter !== "any") load();
    }, [enabled, wxFilter, load]);

    const seriesOf = useCallback(
        (crag: Crag): WeatherSeries | null => {
            const key = cellKey(crag, parks);
            return key ? (cells[key] ?? null) : null;
        },
        [cells, parks],
    );

    const stateOf = useCallback(
        (crag: Crag): WeatherState | null => {
            if (!enabled || !at) return null;
            return readWeather(seriesOf(crag), crag.dry)?.st ?? null;
        },
        [enabled, at, seriesOf],
    );

    const value = useMemo<WeatherContextValue>(
        () => ({ at, loading, error, stateOf, seriesOf, load }),
        [at, loading, error, stateOf, seriesOf, load],
    );

    return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
};
