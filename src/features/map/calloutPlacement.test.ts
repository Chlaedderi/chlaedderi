import { describe, expect, it } from "vitest";

import { CALLOUT_FALLBACK, inView, placeCallout } from "./calloutPlacement";

/**
 * Checked against the hand-written app, not against the port.
 *
 * `placeCallout` was never ported, so there is no earlier React behaviour to agree with -- and
 * writing these from the new code would only have pinned whatever it happens to do. The original
 * (`git show 3574a92^:index.html`, around line 3733) read:
 *
 *     const dLat = bounds.getNorth()-bounds.getSouth(), dLon = bounds.getEast()-bounds.getWest();
 *     const fy = dLat>1e-6 ? (c.lat-bounds.getSouth())/dLat : 1,
 *           fx = dLon>1e-6 ? (c.lon-bounds.getWest())/dLon : .5;
 *     const below = fy < .45;
 *     const mx = Math.min(w/2+16, size.x*.42), my = Math.min(h+52, size.y*.6);
 *     return { below, tl:[fx<.5?mx:26, below?62:my], br:[fx>=.5?mx:26, below?my:66] };
 *
 * Every number below comes from reading that, not from running this.
 */

/** A box one degree square, so a fraction of it reads straight off the coordinate. */
const SPAN = { south: 44, north: 45, west: 8, east: 9 };
/** A desktop map and a card of the pinned width. */
const MAP = { x: 1000, y: 800 };
const CARD = { w: 280, h: 300 };

/** `my` for the card above: min(300 + 52, 800 * .6) = 352. */
const MY = 352;
/** `mx` for that card on that map: min(280 / 2 + 16, 1000 * .42) = 156. */
const MX = 156;

const at = (lat: number, lon: number) => placeCallout({ lat, lon }, SPAN, MAP, CARD);

describe("placeCallout", () => {
    it("hangs the card below when the approach runs north of the crag", () => {
        // The crag low in the box: everything it is joined to lies north of it.
        const p = at(44.2, 8.5);
        expect(p.below).toBe(true);
        // Below, the room above the marker is the fixed 62 and the card's own height goes under.
        expect(p.tl[1]).toBe(62);
        expect(p.br[1]).toBe(MY);
    });

    it("keeps the card above when the approach runs south", () => {
        const p = at(44.9, 8.5);
        expect(p.below).toBe(false);
        expect(p.tl[1]).toBe(MY);
        expect(p.br[1]).toBe(66);
    });

    it("draws the line at 0.45 exactly, and stays above on it", () => {
        // The original compares with a strict `<`, so 0.45 itself is «above».
        expect(at(44.45, 8.5).below).toBe(false);
        expect(at(44.4499, 8.5).below).toBe(true);
    });

    it("keeps the card above for a box with no height at all", () => {
        // A crag with no approach: the box is the crag. `fy` falls back to 1, not to the middle,
        // so such a crag behaves like one whose car park is to the south.
        const flat = { south: 44.5, north: 44.5, west: 8, east: 9 };
        expect(placeCallout({ lat: 44.5, lon: 8.5 }, flat, MAP, CARD).below).toBe(false);
    });

    it("gives the wide padding to the east when the crag sits in the west half", () => {
        const p = at(44.9, 8.3);
        expect(p.tl[0]).toBe(MX);
        expect(p.br[0]).toBe(26);
    });

    it("gives it to the west when the crag sits in the east half", () => {
        const p = at(44.9, 8.8);
        expect(p.tl[0]).toBe(26);
        expect(p.br[0]).toBe(MX);
    });

    it("breaks the tie eastwards for a box with no width", () => {
        // `fx` falls back to .5: `fx < .5` is false and `fx >= .5` is true, so the right-hand side
        // gets the room. An even-looking fallback that is not symmetric -- hence this test.
        const flat = { south: 44, north: 45, west: 8.5, east: 8.5 };
        const p = placeCallout({ lat: 44.9, lon: 8.5 }, flat, MAP, CARD);
        expect(p.tl[0]).toBe(26);
        expect(p.br[0]).toBe(MX);
    });

    it("never asks for side padding past 42 per cent of a narrow map", () => {
        const narrow = placeCallout({ lat: 44.9, lon: 8.3 }, SPAN, { x: 320, y: 800 }, CARD);
        // min(156, 134.4) -- the map, not the card, decides.
        expect(narrow.tl[0]).toBeCloseTo(134.4, 5);
        const wide = placeCallout({ lat: 44.9, lon: 8.3 }, SPAN, { x: 1200, y: 800 }, CARD);
        expect(wide.tl[0]).toBe(MX);
    });

    it("never asks for vertical padding past 60 per cent of a short map", () => {
        const tall = placeCallout({ lat: 44.9, lon: 8.5 }, SPAN, MAP, { w: 280, h: 600 });
        // min(652, 480).
        expect(tall.tl[1]).toBe(480);
    });

    it("stays finite when the card could not be measured", () => {
        // Fonts not yet loaded, or a hidden container: zero is a plausible measurement.
        const p = placeCallout({ lat: 44.9, lon: 8.3 }, SPAN, MAP, { w: 0, h: 0 });
        expect(p.tl).toEqual([16, 52]);
        expect(p.br).toEqual([26, 66]);
    });

    it("has a fallback for when there is no card to measure", () => {
        expect(CALLOUT_FALLBACK).toEqual({ below: false, tl: [36, 40], br: [36, 44] });
    });
});

describe("inView", () => {
    const view = { south: 44, north: 45, west: 8, east: 9 };

    it("accepts a target well inside the view", () => {
        expect(inView(view, { south: 44.3, north: 44.7, west: 8.3, east: 8.7 }, 15)).toBe(true);
    });

    it("refuses the same target when the map is zoomed too far out", () => {
        // Contained is not enough: below zoom 14 the approach is a smudge, so fit anyway.
        expect(inView(view, { south: 44.3, north: 44.7, west: 8.3, east: 8.7 }, 13)).toBe(false);
    });

    it("refuses a target inside the view but within the trimmed margin", () => {
        // 6 per cent of a one-degree view is 0.06: a north edge at 44.97 is inside the view but
        // inside the margin too, so it is not «comfortably» shown.
        expect(inView(view, { south: 44.3, north: 44.97, west: 8.3, east: 8.7 }, 15)).toBe(false);
    });

    it("refuses a target that runs off the side", () => {
        expect(inView(view, { south: 44.3, north: 44.7, west: 7.5, east: 8.7 }, 15)).toBe(false);
    });
});
