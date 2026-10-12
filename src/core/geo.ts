/**
 * Distances, the Swiss grid, and the encoded polylines the approach lines arrive as.
 */

const RAD = Math.PI / 180;
const EARTH_R = 6371000;

/** Great-circle distance in m. */
export const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const x =
        Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 +
        Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.sqrt(x));
};

/** `950 m`, `1.2 km`, `23 km` -- the precision the old `fmtDist()` chose. */
export const formatDistance = (m: number): string => {
    if (m < 950) return `${Math.round(m / 10) * 10} m`;
    if (m < 20000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m / 1000)} km`;
};

/**
 * WGS84 to the Swiss LV95 grid (EPSG:2056), the approximate formulas swisstopo publishes. Needed
 * because the swisstopo height and trail services speak LV95, not degrees.
 */
export const toLV95 = (lat: number, lon: number): [east: number, north: number] => {
    const phi = (lat * 3600 - 169028.66) / 10000;
    const lam = (lon * 3600 - 26782.5) / 10000;
    const east =
        2600072.37 +
        211455.93 * lam -
        10938.51 * lam * phi -
        0.36 * lam * phi ** 2 -
        44.54 * lam ** 3;
    const north =
        1200147.07 +
        308807.95 * phi +
        3745.25 * lam ** 2 +
        76.63 * phi ** 2 -
        194.56 * lam ** 2 * phi +
        119.79 * phi ** 3;
    return [east, north];
};

/** LV95 back to WGS84. */
export const fromLV95 = (east: number, north: number): [lat: number, lon: number] => {
    const y = (east - 2600000) / 1000000;
    const x = (north - 1200000) / 1000000;
    const lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x ** 2 - 0.0436 * y ** 3;
    const lat =
        16.9023892 +
        3.238272 * x -
        0.270978 * y ** 2 -
        0.002528 * x ** 2 -
        0.0447 * y ** 2 * x -
        0.014 * x ** 3;
    return [(lat * 100) / 36, (lon * 100) / 36];
};

/**
 * Decode an encoded polyline (the Google format, precision 5) into `[lat, lon]` pairs. The approach
 * lines in a pack and the trail geometry from swisstopo both arrive this way.
 */
export const decodePolyline = (encoded: string): [number, number][] => {
    const points: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lon = 0;
    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte: number;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;

        shift = 0;
        result = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lon += result & 1 ? ~(result >> 1) : result >> 1;

        points.push([lat / 1e5, lon / 1e5]);
    }
    return points;
};

/** A bounding box around a set of points, padded by `pad` degrees. */
export const bboxOf = (
    points: readonly (readonly [number, number])[],
    pad = 0,
): [south: number, west: number, north: number, east: number] | null => {
    if (!points.length) return null;
    let s = Infinity;
    let w = Infinity;
    let n = -Infinity;
    let e = -Infinity;
    for (const [lat, lon] of points) {
        if (lat < s) s = lat;
        if (lat > n) n = lat;
        if (lon < w) w = lon;
        if (lon > e) e = lon;
    }
    return [s - pad, w - pad, n + pad, e + pad];
};
