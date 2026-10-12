/**
 * The constants and the one pure function the approach layers share.
 *
 * Their own module so that ApproachLayer.tsx and AllPathsLayer.tsx export components only, which
 * is what React fast refresh needs.
 */

import { decodePolyline } from "@core/geo";
import type { Approach, Park } from "@domain/mappack";
import type { Crag } from "@domain/model";

import type { Span } from "./calloutPlacement";

/** Magenta: the approach colour the app has always used. */
export const ROUTE_COLOUR = "#d81b78";

export const ROUTE_ATTRIBUTION =
    'Routing: <a href="https://brouter.de" target="_blank" rel="noopener">BRouter</a>';

/**
 * The points of an approach, or null when there is no usable line.
 *
 * A `detour` is deliberately not drawn: the path that was found is not the way people take, and a
 * line on the map would be read as a recommendation.
 */
export const approachLine = (ap: Approach): [number, number][] | null =>
    ap.q === "detour" ? null : decodePolyline(ap.line);

/** Beyond this many metres between the end of the path and the wall, the gap is drawn dotted. */
export const GAP_M = 35;

/**
 * The box the map should show when a crag is open: the wall and the ways to it.
 *
 * It is computed here rather than reported by the layer that draws the lines, because the map has
 * to know it in the same render that the crag is chosen. Reported from a drawing effect it arrived
 * a tick late, and the map fitted the whole region first and lurched to the crag afterwards.
 *
 * Alternative approaches are deliberately left out, as they always were: a second car park half a
 * valley away would zoom the map out past the point of showing anything.
 */
export const approachSpan = (crag: Crag, parks: Readonly<Record<string, Park>>): Span | null => {
    if (!crag.coord) return null;

    const span = {
        south: crag.coord.lat,
        north: crag.coord.lat,
        west: crag.coord.lon,
        east: crag.coord.lon,
    };
    const extend = (lat: number, lon: number): void => {
        span.south = Math.min(span.south, lat);
        span.north = Math.max(span.north, lat);
        span.west = Math.min(span.west, lon);
        span.east = Math.max(span.east, lon);
    };

    for (const ap of crag.ap ?? []) {
        if (ap.alt) continue;
        const line = approachLine(ap);
        if (line) {
            for (const [lat, lon] of line) extend(lat, lon);
        } else {
            // A detour, or no geometry: the car park is still where the walk starts.
            const p = parks[ap.pk];
            if (p) extend(p.lat, p.lon);
        }
    }

    // No approach at all, but the sources name a car park: it is drawn, so it must fit.
    if (!crag.ap?.length && crag.pk) {
        const p = parks[crag.pk];
        if (p) extend(p.lat, p.lon);
    }

    return span;
};
