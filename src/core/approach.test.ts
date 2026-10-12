import { describe, expect, it } from "vitest";

import {
    PATH_WEIGHT,
    type TrailLine,
    buildGraph,
    climbOf,
    findLeg,
    hikeMinutes,
    lengthByCategory,
    nearest,
    reverseProfile,
} from "./approach";

/**
 * The planner on hand-made networks, in LV95 metres.
 *
 * Small grids rather than real trail data: each test states the shape it builds, so what the
 * router is supposed to prefer is visible in the test itself.
 */

/** A straight trail from (x0,y0) to (x1,y1). */
const line = (x0: number, y0: number, x1: number, y1: number, cat: 1 | 2 | 3 = 1): TrailLine => ({
    c: [
        [x0, y0],
        [x1, y1],
    ],
    cat,
});

const lengthOf = (leg: readonly { x: number; y: number }[]): number => {
    let d = 0;
    for (let i = 1; i < leg.length; i++) {
        d += Math.hypot(leg[i]!.x - leg[i - 1]!.x, leg[i]!.y - leg[i - 1]!.y);
    }
    return d;
};

describe("buildGraph", () => {
    it("makes one vertex where two lines share an end", () => {
        // ──┐  two segments meeting at (100,0)
        const g = buildGraph([line(0, 0, 100, 0), line(100, 0, 100, 100)]);
        expect(g.n).toBe(3);
        // The shared vertex has both ways leading from it.
        const middle = g.X.findIndex((x, i) => x === 100 && g.Y[i] === 0);
        expect(g.adj[middle]).toHaveLength(2);
    });

    it("merges vertices that are within a couple of metres", () => {
        // Surveys do not repeat a coordinate exactly; 2 m apart is the same junction.
        const g = buildGraph([line(0, 0, 100, 0), line(101, 1, 200, 0)]);
        expect(g.n).toBe(3);
    });

    it("joins a trail that ends on another without sharing a vertex", () => {
        // A long path, and a spur that stops *on* it:
        //    ────────────   y=0
        //         │          the spur ends at (50,0), which is not a vertex of the long path
        const g = buildGraph([line(0, 0, 100, 0), line(50, 60, 50, 0)]);
        // Without the T-junction stitch the spur is a dead end, so a leg from its far end to the
        // right-hand side would have to go cross-country.
        const leg = findLeg(g, [50, 60], [100, 0]);
        expect(lengthByCategory(leg)[0]).toBeLessThan(5);
    });

    it("puts a node where two trails cross without sharing a vertex", () => {
        //  ──┼──  a horizontal and a vertical path crossing at (50,0)
        const g = buildGraph([line(0, 0, 100, 0), line(50, -50, 50, 50)]);
        const leg = findLeg(g, [0, 0], [50, 50]);
        // The route turns at the crossing rather than cutting across country.
        expect(lengthByCategory(leg)[0]).toBeLessThan(5);
        expect(lengthOf(leg)).toBeCloseTo(100, 0);
    });
});

describe("nearest", () => {
    const g = buildGraph([line(0, 0, 100, 0)]);

    it("finds the closest point on a segment, not just its ends", () => {
        const [hit] = nearest(g, 50, 30, 100, 1);
        expect(hit?.x).toBeCloseTo(50, 5);
        expect(hit?.y).toBeCloseTo(0, 5);
        expect(hit?.d).toBeCloseTo(30, 5);
    });

    it("finds nothing beyond the range it is given", () => {
        expect(nearest(g, 50, 500, 100, 1)).toEqual([]);
    });

    it("does not offer two points at the same place", () => {
        const dense = buildGraph([line(0, 0, 100, 0), line(0, 1, 100, 1)]);
        const hits = nearest(dense, 50, 10, 100, 4);
        for (let i = 0; i < hits.length; i++) {
            for (let j = i + 1; j < hits.length; j++) {
                expect(
                    Math.hypot(hits[i]!.x - hits[j]!.x, hits[i]!.y - hits[j]!.y),
                ).toBeGreaterThan(25);
            }
        }
    });
});

describe("findLeg", () => {
    it("always answers, even with no trail at all", () => {
        const g = buildGraph([]);
        const leg = findLeg(g, [0, 0], [300, 400]);
        // A straight line that says «this is the direction», marked as off-trail.
        expect(leg).toHaveLength(2);
        expect(leg[1]?.cat).toBe(0);
        expect(lengthOf(leg)).toBeCloseTo(500, 0);
    });

    it("walks the path rather than cutting across country", () => {
        // A path around three sides of a square: 300 m on the trail against 100 m straight.
        const g = buildGraph([line(0, 0, 0, 100), line(0, 100, 100, 100), line(100, 100, 100, 0)]);
        const leg = findLeg(g, [0, 0], [100, 0]);
        // Off-trail costs four times, so 300 m of path beats 100 m of scrambling.
        expect(lengthOf(leg)).toBeCloseTo(300, 0);
        expect(lengthByCategory(leg)[0]).toBeLessThan(5);
    });

    it("takes the shortcut when the detour is long enough", () => {
        // The same square, but the path now goes a very long way round.
        const g = buildGraph([
            line(0, 0, 0, 2000),
            line(0, 2000, 100, 2000),
            line(100, 2000, 100, 0),
        ]);
        const leg = findLeg(g, [0, 0], [100, 0]);
        expect(lengthOf(leg)).toBeCloseTo(100, 0);
        expect(leg[leg.length - 1]?.cat).toBe(0);
    });

    it("prefers a hiking path to an alpine route", () => {
        // Two ways of nearly equal length; the alpine one costs 1.6× per metre.
        const g = buildGraph([
            {
                c: [
                    [0, 0],
                    [50, 120],
                    [100, 0],
                ],
                cat: 1,
            },
            {
                c: [
                    [0, 0],
                    [50, -100],
                    [100, 0],
                ],
                cat: 3,
            },
        ]);
        const leg = findLeg(g, [0, 0], [100, 0]);
        // The route runs north, over the hiking path.
        expect(Math.max(...leg.map((p) => p.y))).toBeGreaterThan(0);
        const byCat = lengthByCategory(leg);
        expect(byCat[1]).toBeGreaterThan(byCat[3]);
    });

    it("weights the ways the way the app says it does", () => {
        expect(PATH_WEIGHT[1]).toBe(1);
        expect(PATH_WEIGHT[0]).toBe(4);
        expect(PATH_WEIGHT[3]).toBeGreaterThan(PATH_WEIGHT[2]);
    });

    it("leaves the graph as it found it, so it can be reused", () => {
        const g = buildGraph([line(0, 0, 100, 0)]);
        const before = g.X.length;
        findLeg(g, [0, 50], [100, 50]);
        findLeg(g, [0, 50], [100, 50]);
        expect(g.X.length).toBe(before);
    });
});

describe("hikeMinutes", () => {
    it("is zero for standing still", () => {
        expect(hikeMinutes([{ d: 0, h: 0 }])).toBe(0);
        expect(hikeMinutes([])).toBe(0);
    });

    it("walks a flat kilometre in about a quarter of an hour", () => {
        const flat = hikeMinutes([
            { d: 0, h: 500 },
            { d: 1000, h: 500 },
        ]);
        expect(flat).toBeGreaterThan(12);
        expect(flat).toBeLessThan(17);
    });

    it("costs more going up than on the flat", () => {
        const up = hikeMinutes([
            { d: 0, h: 500 },
            { d: 1000, h: 700 },
        ]);
        const flat = hikeMinutes([
            { d: 0, h: 500 },
            { d: 1000, h: 500 },
        ]);
        expect(up).toBeGreaterThan(flat);
    });

    it("costs more going steeply down than on the flat, as the real formula does", () => {
        // A steep descent is slow, not fast: this is the part a linear estimate gets wrong.
        const steepDown = hikeMinutes([
            { d: 0, h: 1000 },
            { d: 1000, h: 500 },
        ]);
        const flat = hikeMinutes([
            { d: 0, h: 500 },
            { d: 1000, h: 500 },
        ]);
        expect(steepDown).toBeGreaterThan(flat);
    });

    it("adds its sections up", () => {
        const whole = hikeMinutes([
            { d: 0, h: 500 },
            { d: 1000, h: 600 },
            { d: 2000, h: 700 },
        ]);
        const half = hikeMinutes([
            { d: 0, h: 500 },
            { d: 1000, h: 600 },
        ]);
        expect(whole).toBeCloseTo(half * 2, 3);
    });
});

describe("climbOf", () => {
    it("counts ascent and descent apart", () => {
        expect(
            climbOf([
                { d: 0, h: 100 },
                { d: 10, h: 150 },
                { d: 20, h: 120 },
                { d: 30, h: 170 },
            ]),
        ).toEqual({ up: 100, down: 30 });
    });
});

describe("reverseProfile", () => {
    it("walks the same ground from the other end", () => {
        expect(
            reverseProfile([
                { d: 0, h: 500 },
                { d: 300, h: 650 },
                { d: 1000, h: 700 },
            ]),
        ).toEqual([
            { d: 0, h: 700 },
            { d: 700, h: 650 },
            { d: 1000, h: 500 },
        ]);
    });

    it("makes the way back cheaper when the way there was a climb", () => {
        const up = [
            { d: 0, h: 500 },
            { d: 1000, h: 700 },
        ];
        expect(hikeMinutes(reverseProfile(up))).toBeLessThan(hikeMinutes(up));
    });

    it("survives an empty or single-point profile", () => {
        expect(reverseProfile([])).toEqual([]);
        expect(reverseProfile([{ d: 0, h: 100 }])).toEqual([{ d: 0, h: 100 }]);
    });
});
