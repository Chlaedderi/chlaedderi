/**
 * Links that hand a car park to a map app.
 *
 * No starting point is given, so the map app starts from wherever the phone is; `dir_action` asks
 * it to begin guiding at once.
 */

import type { Park } from "@domain/mappack";

export const navUrl = (p: Park): string =>
    `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=driving&dir_action=navigate`;

export const appleUrl = (p: Park): string =>
    `https://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=d`;

export const isApple = (): boolean =>
    /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * The plain web map, for when neither app is installed -- `nav.web` in the original.
 */
export const webUrl = (p: Park): string =>
    `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=16/${p.lat}/${p.lon}`;
