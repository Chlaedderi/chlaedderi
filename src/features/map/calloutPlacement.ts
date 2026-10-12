/**
 * Where the crag call-out hangs, and how much room the map must leave for it.
 *
 * A port of the hand-written app's `placeCallout`. It was the half of the call-out that the React
 * rewrite dropped: the card has hung above the marker ever since, which on every crag whose car
 * park lies north of the wall is exactly where the approach runs.
 *
 * Nothing here touches Leaflet or the DOM, which is the point -- jsdom reports every element as
 * 0x0, so a version of this that measured anything could not be tested at all.
 */

/** A latitude/longitude box, in the terms Leaflet's `LatLngBounds` and the packs both use. */
export interface Span {
    readonly south: number;
    readonly north: number;
    readonly west: number;
    readonly east: number;
}

export interface Placement {
    /** True when the approach runs north of the crag, so the card hangs under the marker. */
    readonly below: boolean;
    /** `fitBounds` paddingTopLeft: room kept free above and left of the approach. */
    readonly tl: readonly [number, number];
    /** `fitBounds` paddingBottomRight. */
    readonly br: readonly [number, number];
}

/** A degenerate box -- a crag with no approach at all -- must not be divided by. */
const FLAT = 1e-6;

/**
 * Decide the placement from where the crag sits inside the box the map is about to show.
 *
 * The crag in the southern part of the box means the approach extends north from it, so the card
 * goes below; `fx` picks which side gets the wide padding, so the card is not placed over the line
 * it is describing.
 */
export const placeCallout = (
    coord: { readonly lat: number; readonly lon: number },
    span: Span,
    map: { readonly x: number; readonly y: number },
    card: { readonly w: number; readonly h: number },
): Placement => {
    const dLat = span.north - span.south;
    const dLon = span.east - span.west;
    // No height to the box: treat the crag as being at its top, which keeps the card above.
    const fy = dLat > FLAT ? (coord.lat - span.south) / dLat : 1;
    const fx = dLon > FLAT ? (coord.lon - span.west) / dLon : 0.5;

    const below = fy < 0.45;
    const mx = Math.min(card.w / 2 + 16, map.x * 0.42);
    const my = Math.min(card.h + 52, map.y * 0.6);

    return {
        below,
        tl: [fx < 0.5 ? mx : 26, below ? 62 : my],
        br: [fx >= 0.5 ? mx : 26, below ? my : 66],
    };
};

/** The placement when there is no card to measure, as the original's `o.popup === false` path. */
export const CALLOUT_FALLBACK: Placement = {
    below: false,
    tl: [36, 40],
    br: [36, 44],
};

/** How much of a box the original's `bounds.pad(-0.06)` trimmed off each side. */
const PAD = 0.06;

/** Below this the view is too coarse to call the approach «shown», whatever it contains. */
const CLOSE_ENOUGH = 14;

/**
 * Is the approach already comfortably on screen?
 *
 * The original's `map.getBounds().pad(-0.06).contains(bounds) && map.getZoom() >= 14`: a tap on a
 * crag the viewer is already looking at must not move the map at all.
 */
export const inView = (view: Span, target: Span, zoom: number): boolean => {
    if (zoom < CLOSE_ENOUGH) return false;
    const dLat = (view.north - view.south) * PAD;
    const dLon = (view.east - view.west) * PAD;
    return (
        target.south >= view.south + dLat &&
        target.north <= view.north - dLat &&
        target.west >= view.west + dLon &&
        target.east <= view.east - dLon
    );
};
