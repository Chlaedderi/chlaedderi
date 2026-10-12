/**
 * The Italian civil protection radar (Dipartimento della Protezione Civile).
 *
 * Much finer than RainViewer over Italy, which is where most of this atlas is, so it is the better
 * choice for Finale and Oltrefinale. It is a WMS in EPSG:900913 -- the older spelling of web
 * Mercator -- which Leaflet does not define, so the CRS is built here.
 */

import L from "leaflet";

export const DPC_ATTRIBUTION =
    'Radar: <a href="https://radar.protezionecivile.it/" target="_blank" rel="noopener">Radar-DPC, Protezione Civile</a> (CC BY-SA 4.0)';

/**
 * EPSG:900913. Identical to EPSG:3857 in everything but the name, which this service insists on.
 */
export const CRS_900913 = L.extend({}, L.CRS.EPSG3857, { code: "EPSG:900913" });

export const DPC_URL = "https://radar-geowebcache.protezionecivile.it/service/wms";

/** `radar:sri`: rain intensity at ground level. */
export const DPC_LAYER = "radar:sri";

export const DPC_MAX_NATIVE_ZOOM = 11;
