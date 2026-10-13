import { describe, expect, it } from "vitest";

import type { Mappack } from "@domain/mappack";
import type { Region } from "@domain/model";

import testing from "../../maps/pack.testing.json";

import { toRegion } from "./packs/mount";
import { radarSource } from "./radar";

/** The invented region the suite runs on: Swiss, in the Bernese Oberland. */
const swiss = toRegion(testing as unknown as Mappack);

const at = (lat: number, lon: number, over: Partial<Region> = {}): Region => ({
    ...swiss,
    ch: false,
    bbox: null,
    view: { center: [lat, lon], zoom: 12 },
    ...over,
});

describe("the radar a region gets", () => {
    it("is the Swiss radar in Switzerland", () => {
        expect(radarSource(swiss)).toBe("ch");
    });

    /*
     * The Italian radar's domain does reach Ticino and the southern Valais, but only at the far
     * edge of the sites' range and across the Alpine crest, where the beam is kilometres above the
     * ground. A Swiss region is answered by a source that is looking at it.
     */
    it("is the Swiss radar even where the Italian one nominally reaches", () => {
        expect(radarSource(at(46.17, 8.8, { ch: true }))).toBe("ch");
    });

    it("is the Italian radar in Italy", () => {
        expect(radarSource(at(44.17, 8.34))).toBe("dpc");
        expect(radarSource(at(41.9, 12.5))).toBe("dpc");
    });

    it("is RainViewer well outside Italy", () => {
        expect(radarSource(at(48.14, 11.58))).toBe("rv"); // Munich
        expect(radarSource(at(45.76, 4.84))).toBe("rv"); // Lyon
    });

    it("falls back to the declared box when a region opens on nothing", () => {
        // [south, west, north, east], the order a pack declares.
        expect(radarSource(at(0, 0, { view: null, bbox: [44.1, 8.3, 44.2, 8.4] }))).toBe("dpc");
    });

    it("is RainViewer when there is nothing to judge", () => {
        expect(radarSource(null)).toBe("rv");
        expect(radarSource(at(0, 0, { view: null, bbox: null }))).toBe("rv");
        expect(radarSource(at(0, 0, { view: null, bbox: [44.1, 8.3] }))).toBe("rv");
    });
});
