/**
 * swisstopo: the hiking-trail network, spot heights and height profiles.
 *
 * Everything here speaks LV95 (EPSG:2056), which is what the services want; `toLV95`/`fromLV95`
 * in @core/geo do the conversion.
 */

import { type TrailLine, type PathCategory } from "@core/approach";

const API = "https://api3.geo.admin.ch/rest/services/";

/** The layer the approach planner walks on. */
const TRAIL_LAYER = "ch.swisstopo.swisstlm3d-wanderwege";

export const SWISSTOPO_ATTRIBUTION =
    '© <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener">swisstopo</a>';

const json = async (url: string, signal?: AbortSignal): Promise<unknown> => {
    const response = await fetch(url, signal ? { signal } : {});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
};

/**
 * Which kind of way this is. swisstopo spells the grade differently per language and per layer
 * version, so the whole feature is searched rather than one field: an alpine route must never be
 * mistaken for a hiking path.
 */
export const categoryOf = (properties: unknown): PathCategory => {
    const text = JSON.stringify(properties ?? {});
    if (/alpin/i.test(text)) return 3;
    if (/bergwander|mountain|montagne|montagna/i.test(text)) return 2;
    return 1;
};

interface IdentifyResult {
    geometry?: {
        type?: string;
        paths?: number[][][];
        coordinates?: number[][] | number[][][];
    };
    properties?: unknown;
    attributes?: unknown;
}

/**
 * The trail lines inside a box `[E0, N0, E1, N1]` in LV95.
 *
 * The service pages its answers and rejects a page size it does not like with a 400, so the first
 * failure halves the request rather than giving up.
 */
export const fetchTrails = async (
    bbox: readonly [number, number, number, number],
    lang: "de" | "en" = "en",
    signal?: AbortSignal,
): Promise<TrailLine[]> => {
    const lines: TrailLine[] = [];
    const box = bbox.map((v) => Math.round(v)).join(",");
    let limit = 200;

    for (let offset = 0; offset < 2000; offset += limit) {
        const url =
            `${API}all/MapServer/identify?geometryType=esriGeometryEnvelope&geometry=${box}` +
            `&imageDisplay=1000,1000,96&mapExtent=${box}&tolerance=0&layers=all:${TRAIL_LAYER}&sr=2056` +
            `&returnGeometry=true&geometryFormat=geojson&lang=${lang}&limit=${limit}&offset=${offset}`;

        let answer: unknown;
        try {
            answer = await json(url, signal);
        } catch (e) {
            // A page size it will not take: try a smaller one, once.
            if (offset === 0 && limit === 200 && /HTTP 400/.test(String(e))) {
                limit = 50;
                offset = -limit;
                continue;
            }
            throw e;
        }

        const results = ((answer as { results?: IdentifyResult[] })?.results ??
            []) as IdentifyResult[];
        for (const feature of results) {
            const g = feature.geometry ?? {};
            const cat = categoryOf(feature.properties ?? feature.attributes);
            const parts: number[][][] =
                g.paths ??
                (g.type === "LineString"
                    ? [g.coordinates as number[][]]
                    : g.type === "MultiLineString"
                      ? (g.coordinates as number[][][])
                      : []);
            for (const part of parts) {
                if (Array.isArray(part) && part.length > 1) {
                    lines.push({
                        c: part.map((p) => [Number(p[0]), Number(p[1])] as const),
                        cat,
                    });
                }
            }
        }
        if (results.length < limit) break;
    }
    return lines;
};

/** The height at one point, in metres. */
export const fetchHeight = async (
    east: number,
    north: number,
    signal?: AbortSignal,
): Promise<number> => {
    const answer = (await json(
        `${API}height?easting=${east.toFixed(1)}&northing=${north.toFixed(1)}&sr=2056`,
        signal,
    )) as { height?: string };
    const h = parseFloat(String(answer.height));
    if (!(h > 0)) throw new Error("no height");
    return h;
};

export interface ProfilePoint {
    readonly d: number;
    readonly h: number;
}

/**
 * Heights along a line, from the Swiss height model.
 *
 * The line is thinned to 150 points before being sent -- the service has a limit on the geometry
 * it accepts -- and the number of samples follows the length, so a short approach is not described
 * by 400 points and a long one by 40.
 */
export const fetchProfile = async (
    points: readonly { x: number; y: number }[],
    signal?: AbortSignal,
): Promise<ProfilePoint[]> => {
    let line = points.map((p) => [p.x, p.y] as [number, number]);
    if (line.length > 150) {
        const step = (line.length - 1) / 149;
        line = Array.from({ length: 150 }, (_, i) => line[Math.round(i * step)]!);
    }

    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    }
    const samples = Math.round(Math.max(40, Math.min(400, length / 20)));

    const geom = encodeURIComponent(
        JSON.stringify({
            type: "LineString",
            coordinates: line.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]),
        }),
    );
    const answer = await json(
        `${API}profile.json?sr=2056&nb_points=${samples}&geom=${geom}`,
        signal,
    );

    const raw = (Array.isArray(answer) ? answer : [])
        .map((p: { dist?: number; alts?: Record<string, number> }) => {
            const a = p.alts ?? {};
            const h = Number(a.COMB ?? a.DTM25 ?? a.DTM2);
            return { d: Number(p.dist), h: h > 0 ? h : null };
        })
        .filter((p) => Number.isFinite(p.d));

    // Mostly holes means the line runs outside the model -- better to say so than to guess.
    if (raw.length < 2 || raw.filter((p) => p.h != null).length < raw.length * 0.6) {
        throw new Error("outside the height model");
    }

    // A few holes are filled from the neighbours on either side.
    for (let i = 0; i < raw.length; i++) {
        if (raw[i]!.h != null) continue;
        let a = i - 1;
        while (a >= 0 && raw[a]!.h == null) a--;
        let b = i + 1;
        while (b < raw.length && raw[b]!.h == null) b++;
        raw[i]!.h =
            a < 0
                ? raw[b]!.h
                : b >= raw.length
                  ? raw[a]!.h
                  : raw[a]!.h! +
                    ((raw[b]!.h! - raw[a]!.h!) * (raw[i]!.d - raw[a]!.d)) /
                        (raw[b]!.d - raw[a]!.d || 1);
    }

    return raw as ProfilePoint[];
};
