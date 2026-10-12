/**
 * The base maps and overlays, with the attributions the licences require.
 *
 * Switzerland gets swisstopo, which is both better in the mountains and the source of the trails
 * the approach planner walks on; everywhere else gets OpenTopoMap or OSM.
 */

export interface TileLayerSpec {
    readonly url: string;
    readonly attribution: string;
    readonly maxZoom: number;
    readonly subdomains?: string;
}

export const BASE_LAYERS: Record<string, TileLayerSpec> = {
    topo: {
        url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        subdomains: "abc",
        attribution:
            '© <a href="https://opentopomap.org/">OpenTopoMap</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 17,
    },
    osm: {
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    },
    sat: {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "© Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
    },
};

const SWISSTOPO_ATTR = '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>';

/** swisstopo's WMTS, the pseudo-Mercator variant so it lines up with the other base maps. */
const wmts = (layer: string, format = "jpeg"): string =>
    `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.${format}`;

export const CH_LAYERS: Record<string, TileLayerSpec> = {
    ch: {
        url: wmts("ch.swisstopo.pixelkarte-farbe", "jpeg"),
        attribution: SWISSTOPO_ATTR,
        maxZoom: 18,
    },
    chsat: {
        url: wmts("ch.swisstopo.swissimage", "jpeg"),
        attribution: SWISSTOPO_ATTR,
        maxZoom: 18,
    },
};

/** Overlays only Switzerland has: the hiking-path network and the wildlife rest areas. */
export const CH_OVERLAYS = {
    trails: {
        url: wmts("ch.swisstopo.swisstlm3d-wanderwege", "png"),
        attribution: `${SWISSTOPO_ATTR} (Wanderwege)`,
        maxZoom: 18,
    },
    wrz: {
        url: wmts("ch.bafu.wrz-wildruhezonen_portal", "png"),
        attribution: "© BAFU / Kantone (Wildruhezonen)",
        maxZoom: 18,
    },
} satisfies Record<string, TileLayerSpec>;
