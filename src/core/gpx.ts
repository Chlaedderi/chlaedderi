/**
 * The planned approach as a GPX track, for a watch or a hiking app.
 *
 * Built as a string rather than through the DOM, so every value that goes in is escaped here --
 * a crag name comes from a mappack and must not be able to close a tag.
 */

import { APP_NAME } from "./name";

/** XML needs these five escaped; `&` first, or it would escape its own replacements. */
const xml = (s: string): string =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

export interface GpxOptions {
    /** The track's name, usually «Approach to <crag>». */
    readonly name: string;
    /** `[lat, lon]` in WGS84. */
    readonly points: readonly (readonly [number, number])[];
}

export const toGpx = ({ name, points }: GpxOptions): string =>
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<gpx version="1.1" creator="${xml(APP_NAME)}" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `<trk><name>${xml(name)}</name><type>hiking</type><trkseg>\n` +
    points
        .map(([lat, lon]) => `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`)
        .join("\n") +
    "\n</trkseg></trk>\n</gpx>\n";

/** Hand the file to the browser. */
export const downloadGpx = (filename: string, gpx: string): void => {
    const url = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
    }, 1000);
};
