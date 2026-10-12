import { describe, expect, it } from "vitest";

import { mountPacks } from "@core/packs/mount";
import type { Mappack, Park } from "@domain/mappack";
import type { Crag } from "@domain/model";

import showcase from "../../../maps/pack.showcase.json";

import { approachLine, approachSpan } from "./approachGeometry";

/**
 * The box the map fits to when a crag is opened.
 *
 * It used to be built inside the layer that draws the approach and handed back through a callback,
 * which meant it arrived a render after the crag was chosen: the map fitted the whole region first
 * and jumped to the crag afterwards. These check the box itself, against the real pack -- an
 * approach that ran off the edge of it would put the card over the path again.
 */

const mounted = mountPacks([showcase as unknown as Mappack]);
const parks = mounted.parks;
const byId = Object.fromEntries(mounted.crags.map((c) => [c.id, c]));

/** Build just enough of a crag for the geometry; the rest never reaches this function. */
const crag = (over: Partial<Crag>): Crag => ({ ap: [], pk: null, ...over }) as Crag;

describe("approachSpan", () => {
    it("has nothing to show for a crag without coordinates", () => {
        expect(approachSpan(crag({ coord: null }), parks)).toBeNull();
    });

    it("is the crag itself when there is no approach and no car park", () => {
        const c = crag({ coord: { lat: 44.2, lon: 8.3, precision: "pin" } });
        expect(approachSpan(c, parks)).toEqual({
            south: 44.2,
            north: 44.2,
            west: 8.3,
            east: 8.3,
        });
    });

    it("reaches from the wall to the car park of a real crag", () => {
        // Bastionata Sinistra Boragni: the wall at 44.2132, its car park north of it at 44.2151.
        const c = byId["valle-di-nava-bastionata-sinistra-boragni"]!;
        const span = approachSpan(c, parks)!;
        expect(span).not.toBeNull();
        expect(span.south).toBeCloseTo(c.coord!.lat, 4);
        expect(span.north).toBeGreaterThan(c.coord!.lat);
        // Which is exactly why this crag's card has to hang below the marker.
        const park = parks[c.ap[0]!.pk]!;
        expect(span.north).toBeGreaterThanOrEqual(park.lat - 1e-6);
    });

    it("contains every point of the drawn line, not just its ends", () => {
        // A path that bulges out of the box would be half-covered by the card the box makes room
        // for, which is the whole reason the box exists.
        const c = byId["rocca-di-perti-placca-piotti"]!;
        const span = approachSpan(c, parks)!;
        const line = approachLine(c.ap[0]!)!;
        expect(line.length).toBeGreaterThan(2);
        for (const [lat, lon] of line) {
            expect(lat).toBeGreaterThanOrEqual(span.south);
            expect(lat).toBeLessThanOrEqual(span.north);
            expect(lon).toBeGreaterThanOrEqual(span.west);
            expect(lon).toBeLessThanOrEqual(span.east);
        }
    });

    it("ignores an alternative approach, however far away its car park is", () => {
        const far: Park = { lat: 45, lon: 9, name: { en: "far" } } as unknown as Park;
        const c = crag({
            coord: { lat: 44.2, lon: 8.3, precision: "pin" },
            ap: [{ pk: "far", alt: true, q: "detour", line: "", t: 0, d: 0, up: 0, down: 0 }],
        } as Partial<Crag>);
        const span = approachSpan(c, { ...parks, far })!;
        expect(span.north).toBe(44.2);
        expect(span.east).toBe(8.3);
    });

    it("reaches the car park of a detour, which has no line to follow", () => {
        const pk: Park = { lat: 44.25, lon: 8.35, name: { en: "p" } } as unknown as Park;
        const c = crag({
            coord: { lat: 44.2, lon: 8.3, precision: "pin" },
            ap: [{ pk: "p", alt: false, q: "detour", line: "", t: 0, d: 0, up: 0, down: 0 }],
        } as Partial<Crag>);
        expect(approachSpan(c, { ...parks, p: pk })).toEqual({
            south: 44.2,
            north: 44.25,
            west: 8.3,
            east: 8.35,
        });
    });

    it("reaches a car park named without any approach at all", () => {
        const pk: Park = { lat: 44.15, lon: 8.25, name: { en: "p" } } as unknown as Park;
        const c = crag({ coord: { lat: 44.2, lon: 8.3, precision: "pin" }, ap: [], pk: "p" });
        expect(approachSpan(c, { ...parks, p: pk })).toEqual({
            south: 44.15,
            north: 44.2,
            west: 8.25,
            east: 8.3,
        });
    });
});
