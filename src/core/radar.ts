/**
 * Which rain radar covers a region, and the frames a source hands to the map.
 *
 * Whether the radar is on is the viewer's choice. *Which service answers* is not a choice worth
 * offering, because the right answer is a fact about where the region is: the Protezione Civile
 * composite is finer than anything else over Italy and draws nothing whatsoever outside its own
 * domain, while RainViewer draws something everywhere. Offering both as radio buttons meant the
 * Swiss region that ships could be shown a radar that is simply blank, with nothing on screen to
 * say why.
 */

import type { Region } from "@domain/model";

/** The services the map can draw. `off` is not one of them -- then there is no layer at all. */
export type RadarSource = "rv" | "dpc";

export interface RadarFrames {
    /** Tile URL template per frame, oldest first. */
    readonly urls: readonly string[];
    /** The time each frame covers, in ms. One per frame, so `times.length` is the frame count. */
    readonly times: readonly number[];
}

/**
 * Where the Italian radar is worth asking: roughly the peninsula, deliberately drawn inside its
 * real reach rather than around it.
 *
 * Probing the service shows its domain as the union of the radar sites' range circles, which takes
 * in Chamonix, Grenoble, Innsbruck and the southern Swiss valleys but not Chur, Munich or Lyon --
 * a shape no box describes. Being too small costs resolution where RainViewer then answers; being
 * too large costs an empty map. So: too small, on purpose.
 */
const DPC_BOX = { south: 35.5, west: 6, north: 47.5, east: 19 } as const;

/** The middle of a region: what it opens on, or failing that the middle of what it declares. */
const centreOf = (region: Region): readonly [number, number] | null => {
    if (region.view) return region.view.center;
    // `bbox` comes straight out of the pack and nothing else in the app reads it, so check it.
    const box = region.bbox;
    if (box?.length !== 4 || !box.every((n) => Number.isFinite(n))) return null;
    // [south, west, north, east], the order a pack declares and `bboxOf` returns.
    return [(box[0]! + box[2]!) / 2, (box[1]! + box[3]!) / 2];
};

/**
 * The radar for this region. RainViewer is the answer wherever nothing finer is known to cover the
 * ground, including Switzerland -- the Italian radar reaches the southern valleys only across the
 * Alpine crest, where its beam is kilometres above the rain.
 */
export const radarSource = (region: Region | null): RadarSource => {
    if (!region || region.ch) return "rv";
    const centre = centreOf(region);
    if (!centre) return "rv";
    const [lat, lon] = centre;
    return lat >= DPC_BOX.south &&
        lat <= DPC_BOX.north &&
        lon >= DPC_BOX.west &&
        lon <= DPC_BOX.east
        ? "dpc"
        : "rv";
};
