import { describe, expect, it } from "vitest";

import { cameraPlan } from "./cameraPlan";

/**
 * The behaviour these pin is the complaint that started it: tapping a marker on the map panned and
 * zoomed somewhere nobody asked for. So the first case below is the one that matters -- a request
 * that is not a reveal never moves the map, however far away the crag is -- and the rest say when
 * a reveal travels, when it jumps, and that it never does either for longer than it should.
 *
 * Nothing here is inherited from the hand-written app: it had no notion of a reveal, and its one
 * guard (`inView`, which this still defers to) is tested next door against the original.
 */

/** What the map is showing: one degree square, so a fraction of it reads off the coordinate. */
const VIEW = { south: 44, north: 45, west: 8, east: 9 };

/** A crag in the middle of that view, with an approach about a sixteenth of it across. */
const MIDDLE = { south: 44.47, north: 44.53, west: 8.47, east: 8.53 };

const plan = (over: Partial<Parameters<typeof cameraPlan>[0]> = {}) =>
    cameraPlan({
        reveal: true,
        calm: false,
        covered: false,
        view: VIEW,
        target: MIDDLE,
        zoom: 11,
        ...over,
    });

/** Shift a box by whole screens, to ask for travel of a known size. */
const moved = (screens: number) => ({
    south: MIDDLE.south,
    north: MIDDLE.north,
    west: MIDDLE.west + screens,
    east: MIDDLE.east + screens,
});

describe("cameraPlan", () => {
    it("leaves the map alone when nobody asked it to move", () => {
        // A tap on a marker, which is the whole point: the viewer pointed at something they could
        // already see, four screens away or not.
        expect(plan({ reveal: false })).toEqual({ kind: "none" });
        expect(plan({ reveal: false, target: moved(4) })).toEqual({ kind: "none" });
    });

    it("leaves it alone when the approach is already framed", () => {
        // `inView` wants the box inside the view's middle 88% and zoom 14 or closer.
        expect(plan({ zoom: 15 })).toEqual({ kind: "none" });
    });

    it("cuts rather than flies when the viewer asked for less motion", () => {
        expect(plan({ calm: true })).toEqual({ kind: "cut" });
    });

    it("cuts when the crag page is lying over the map", () => {
        // Nobody can watch a flight behind a sheet of paper, but the map still has to be looking
        // at the right crag when they come back.
        expect(plan({ covered: true })).toEqual({ kind: "cut" });
    });

    it("flies when the map only has to zoom in, however deep", () => {
        // The common case: a row in the list, tapped at the region's own zoom. The centre barely
        // moves and the view is about sixteen times the approach -- four levels straight down.
        // 0.45 + 0.3 * 0 travel + 0.1 * log2(1 / 0.06) = 0.856.
        const p = plan();
        expect(p.kind).toBe("fly");
        expect(p.kind === "fly" && p.seconds).toBeCloseTo(0.856, 3);
    });

    it("cuts when the flight would cross more screens than the eye can follow", () => {
        // Leaflet would arc out towards world scale and the clusters would swallow the marker.
        expect(plan({ target: moved(4) })).toEqual({ kind: "cut" });
    });

    it("flies for longer the further it has to go", () => {
        const near = plan({ target: moved(0.5) });
        const far = plan({ target: moved(2) });
        expect(near.kind).toBe("fly");
        expect(far.kind).toBe("fly");
        expect(near.kind === "fly" && far.kind === "fly" && far.seconds > near.seconds).toBe(true);
    });

    it("stays between half a second and 1.6, whatever it is given", () => {
        // A crag with no approach at all is a single point: the ratio of the view to it is not a
        // number anyone should divide by, and the answer must still be a time. The depth is capped
        // at eight levels, so this is 0.45 + 0.8 rather than something unbounded.
        const point = { south: 44.5, north: 44.5, west: 8.5, east: 8.5 };
        const p = plan({ target: point });
        expect(p.kind === "fly" && Number.isFinite(p.seconds)).toBe(true);
        expect(p.kind === "fly" && p.seconds).toBe(1.25);

        // Both at once -- the far side of what is still flown, and a point to land on -- is what
        // the upper clamp is for: 0.45 + 0.3 * 3 + 0.8 would be 2.15.
        const most = plan({ target: { ...point, west: 11.5, east: 11.5 } });
        expect(most.kind === "fly" && most.seconds).toBe(1.6);

        // And the shortest possible hop still takes long enough to be seen as movement.
        const shortest = plan({ target: { south: 44.1, north: 44.9, west: 8.1, east: 8.9 } });
        expect(shortest.kind === "fly" && shortest.seconds).toBe(0.5);
    });

    it("flies, not cuts, for a crag just outside the frame", () => {
        // `inView` trims 6% off each side, so this one fails it by a hair -- and a hair is not a
        // reason to jump.
        const p = plan({ target: { south: 44.02, north: 44.1, west: 8.02, east: 8.1 }, zoom: 15 });
        expect(p.kind).toBe("fly");
    });
});
