/**
 * BRouter on OpenStreetMap data: the stand-in when swisstopo's network cannot be read, and the
 * only routing available outside Switzerland.
 *
 * The panel says which of the two produced a line, because their quality in the mountains differs
 * and a climber should know which one they are looking at.
 */

import { toLV95 } from "@core/geo";

export const BROUTER_ATTRIBUTION =
    'Routing: <a href="https://brouter.de" target="_blank" rel="noopener">BRouter</a>';

export interface RoutePoint {
    readonly x: number;
    readonly y: number;
    /** 4: an OSM path. */
    readonly cat: 4;
}

/** A hiking route between two WGS84 points, returned in LV95 like the swisstopo legs. */
export const fetchRoute = async (
    a: readonly [number, number],
    b: readonly [number, number],
    signal?: AbortSignal,
): Promise<RoutePoint[]> => {
    const url =
        `https://brouter.de/brouter?lonlats=${a[1].toFixed(6)},${a[0].toFixed(6)}` +
        `%7C${b[1].toFixed(6)},${b[0].toFixed(6)}` +
        "&profile=hiking-mountain&alternativeidx=0&format=geojson";

    const response = await fetch(url, signal ? { signal } : {});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as {
        features?: { geometry?: { coordinates?: number[][] } }[];
    };

    const coordinates = json.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error("no route");

    return coordinates.map((p) => {
        const [x, y] = toLV95(Number(p[1]), Number(p[0]));
        return { x, y, cat: 4 as const };
    });
};
