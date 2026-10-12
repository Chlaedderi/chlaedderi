/**
 * Whether the map moves when a crag is chosen, and how.
 *
 * The rule the whole thing turns on: **the camera follows a reveal, never a selection.** Tapping a
 * marker is pointing at something that is already on screen, and the app used to answer that by
 * panning and zooming the ground out from under the viewer. Picking a crag out of the list is the
 * opposite -- the map has to travel -- and that used to happen as a jump, with nothing to follow.
 *
 * Nothing here touches Leaflet or the DOM, which is what makes it testable: jsdom reports every
 * element as 0x0, so a version of this that measured anything could not be checked at all. The two
 * boxes are degrees at the same latitude, so every ratio below is already dimensionless and the
 * size of the map in pixels is not needed.
 */

import { inView, type Span } from "./calloutPlacement";

export type CameraPlan =
    /** Stay exactly where the viewer put it. */
    | { readonly kind: "none" }
    /** Be there at once, with no animation. */
    | { readonly kind: "cut" }
    /** Travel there, so the eye can follow. */
    | { readonly kind: "fly"; readonly seconds: number };

export interface CameraRequest {
    /** Someone asked the map to go and show this crag. A plain selection never does. */
    readonly reveal: boolean;
    /** `prefers-reduced-motion`. */
    readonly calm: boolean;
    /** The crag page lies over the map, so no one can watch it move. */
    readonly covered: boolean;
    /** What the map is showing now. */
    readonly view: Span;
    /** What it should show: the wall and the ways to it. */
    readonly target: Span;
    readonly zoom: number;
}

/**
 * Beyond this many screens of travel, cut.
 *
 * Leaflet's `flyTo` arcs out towards world scale on a long flight, and the cluster group swallows
 * the very marker the viewer is trying to follow (`CragMarkers` stops clustering only at zoom 15).
 * A flight nobody can follow is worse than a jump, so far travel is simply a jump.
 */
const TOO_FAR = 3;

/** A crag with no approach at all is a point; dividing the view by it would give infinity. */
const FLAT = 1e-5;

/** Seconds: long enough to read as movement, short enough not to be in the way. */
const SHORTEST = 0.5;
const LONGEST = 1.6;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const mid = (a: number, b: number): number => (a + b) / 2;

export const cameraPlan = ({
    reveal,
    calm,
    covered,
    view,
    target,
    zoom,
}: CameraRequest): CameraPlan => {
    if (!reveal) return { kind: "none" };
    // Already framed: the original's own test, and still the right one. Asking twice for the crag
    // in front of you must not twitch the map.
    if (inView(view, target, zoom)) return { kind: "none" };
    if (calm || covered) return { kind: "cut" };

    const viewW = Math.max(view.east - view.west, FLAT);
    const viewH = Math.max(view.north - view.south, FLAT);

    // How far the centre has to travel, measured in screens.
    const dx = (mid(target.west, target.east) - mid(view.west, view.east)) / viewW;
    const dy = (mid(target.south, target.north) - mid(view.south, view.north)) / viewH;
    const travel = Math.hypot(dx, dy);
    if (travel > TOO_FAR) return { kind: "cut" };

    // How many zoom levels it has to gain or lose. Depth never forces a cut -- a zoom straight
    // down at a fixed centre is followable however deep it goes, and that is the common case: a
    // list click from the region overview is nearly all zoom and hardly any travel.
    const ratio = Math.max(
        viewW / Math.max(target.east - target.west, FLAT),
        viewH / Math.max(target.north - target.south, FLAT),
    );
    const levels = clamp(Math.abs(Math.log2(ratio)), 0, 8);

    return { kind: "fly", seconds: clamp(0.45 + 0.3 * travel + 0.1 * levels, SHORTEST, LONGEST) };
};
