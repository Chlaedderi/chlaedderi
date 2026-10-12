/**
 * The forecast for one crag, fetched on request and kept for half an hour.
 *
 * Per crag rather than in a global store, because that is how it is used: only the open crag's
 * page shows one, and the data is large. The cache is a module-level map so that stepping back to
 * the list and into the same crag again does not fetch twice -- the original kept `fc.data` for
 * exactly that reason.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ForecastData } from "@core/forecast";
import { FC_TTL, loadForecast } from "@services/forecast";

const cache = new Map<string, ForecastData>();
const inFlight = new Map<string, Promise<ForecastData | null>>();

export interface ForecastState {
    readonly data: ForecastData | null;
    readonly loading: boolean;
    readonly error: string | null;
    readonly load: (force?: boolean) => void;
}

/** Anywhere a forecast can be asked for: a crag, or a point somebody tapped. */
export interface Place {
    readonly id: string;
    readonly lat: number;
    readonly lon: number;
}

export const useForecast = (place: Place, ch: boolean): ForecastState => {
    const { t } = useTranslation();
    const [data, setData] = useState<ForecastData | null>(() => cache.get(place.id) ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // A different place: show what is already known about it, and nothing else.
    useEffect(() => {
        setData(cache.get(place.id) ?? null);
        setError(null);
    }, [place.id]);

    const load = useCallback(
        (force = false) => {
            const held = cache.get(place.id);
            if (!force && held && Date.now() - held.at < FC_TTL) {
                setData(held);
                return;
            }
            if (navigator.onLine === false) {
                setError(t("fc.offline"));
                return;
            }
            setLoading(true);
            setError(null);

            const pending =
                inFlight.get(place.id) ??
                loadForecast({
                    lat: place.lat,
                    lon: place.lon,
                    ch,
                    knownElevation: held?.elevSrc === "swisstopo" ? held.elev : null,
                })
                    .then((value) => {
                        cache.set(place.id, value);
                        return value;
                    })
                    .catch((e: unknown) => {
                        setError(e instanceof Error ? e.message : String(e));
                        return null;
                    })
                    .finally(() => inFlight.delete(place.id));

            inFlight.set(place.id, pending);
            void pending.then((value) => {
                if (value) setData(value);
                setLoading(false);
            });
        },
        [place, ch, t],
    );

    return { data, loading, error, load };
};
