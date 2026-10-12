import { describe, expect, it } from "vitest";

import { bboxOf, decodePolyline, formatDistance, fromLV95, haversine, toLV95 } from "./geo";

describe("haversine", () => {
    it("is zero for the same point", () => {
        expect(haversine(46.0, 8.0, 46.0, 8.0)).toBe(0);
    });

    it("measures a degree of latitude as about 111 km", () => {
        expect(haversine(46, 8, 47, 8)).toBeGreaterThan(111_000);
        expect(haversine(46, 8, 47, 8)).toBeLessThan(111_400);
    });

    it("is symmetric", () => {
        expect(haversine(44.17, 8.33, 46.3, 7.98)).toBeCloseTo(
            haversine(46.3, 7.98, 44.17, 8.33),
            6,
        );
    });

    it("gets Finale to Oberwallis roughly right", () => {
        // Finale Ligure to Brig, about 240 km as the crow flies.
        const d = haversine(44.17, 8.34, 46.32, 7.99) / 1000;
        expect(d).toBeGreaterThan(230);
        expect(d).toBeLessThan(250);
    });
});

describe("formatDistance", () => {
    it("rounds the way the old app did", () => {
        expect(formatDistance(123)).toBe("120 m");
        expect(formatDistance(949)).toBe("950 m");
        expect(formatDistance(1234)).toBe("1.2 km");
        expect(formatDistance(19_900)).toBe("19.9 km");
        expect(formatDistance(23_400)).toBe("23 km");
    });
});

describe("the Swiss grid", () => {
    it("reproduces swisstopo's own constants at the Bern reference", () => {
        // The approximate formulas are written around Bern (46° 57' 08.66" N, 7° 26' 22.50" E),
        // where every term but the constant vanishes. The constants are the published LV03 ones
        // (600072.37 / 200147.07) shifted into LV95 by 2000000 / 1000000 -- so the reference does
        // *not* land on the round 2600000 / 1200000 of the fundamental point.
        const [east, north] = toLV95(46 + 57 / 60 + 8.66 / 3600, 7 + 26 / 60 + 22.5 / 3600);
        expect(east).toBeCloseTo(2_600_072.37, 2);
        expect(north).toBeCloseTo(1_200_147.07, 2);
    });

    it("places the regions in the right part of the grid", () => {
        // Oberwallis is east and south of Bern; Finale Ligure is off the grid altogether.
        const [eastOw, northOw] = toLV95(46.3167, 7.9881);
        expect(eastOw).toBeGreaterThan(2_600_000);
        expect(eastOw).toBeLessThan(2_680_000);
        expect(northOw).toBeGreaterThan(1_100_000);
        expect(northOw).toBeLessThan(1_200_000);
    });

    it("round-trips a point in Oberwallis to within a metre", () => {
        const lat = 46.3167;
        const lon = 7.9881;
        const [east, north] = toLV95(lat, lon);
        // Valais is east and south of Bern.
        expect(east).toBeGreaterThan(2_600_000);
        expect(north).toBeLessThan(1_200_000);
        const [backLat, backLon] = fromLV95(east, north);
        // A degree is ~111 km, so 1e-5 degrees is about a metre.
        expect(backLat).toBeCloseTo(lat, 4);
        expect(backLon).toBeCloseTo(lon, 4);
    });
});

describe("decodePolyline", () => {
    it("decodes the example from the format's own documentation", () => {
        expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
            [38.5, -120.2],
            [40.7, -120.95],
            [43.252, -126.453],
        ]);
    });

    it("gives nothing back for an empty line", () => {
        expect(decodePolyline("")).toEqual([]);
    });

    it("decodes every approach line in the showcase pack", async () => {
        const pack = await import("../../maps/pack.showcase.json");
        let lines = 0;
        for (const sector of pack.default.sectors as { ap?: { line: string }[] }[]) {
            for (const approach of sector.ap ?? []) {
                const points = decodePolyline(approach.line);
                expect(points.length).toBeGreaterThan(1);
                for (const [lat, lon] of points) {
                    // Finale Ligure: northern Italy, not the middle of the ocean.
                    expect(lat).toBeGreaterThan(43);
                    expect(lat).toBeLessThan(47);
                    expect(lon).toBeGreaterThan(7);
                    expect(lon).toBeLessThan(9);
                }
                lines++;
            }
        }
        expect(lines).toBeGreaterThan(0);
    });
});

describe("bboxOf", () => {
    it("wraps the points and pads", () => {
        expect(
            bboxOf([
                [46, 8],
                [47, 9],
            ]),
        ).toEqual([46, 8, 47, 9]);
        expect(bboxOf([[46, 8]], 0.5)).toEqual([45.5, 7.5, 46.5, 8.5]);
        expect(bboxOf([])).toBeNull();
    });
});
