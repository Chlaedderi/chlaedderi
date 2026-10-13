import { describe, expect, it } from "vitest";

import { SWISS_RADAR_GRID, cellAt } from "./radarGrid";

/**
 * The corner coordinates the frames carry in their own `/where` attributes, degrees WGS84.
 *
 * This is the test that catches a north/south flip, and it matters more than it looks: a flipped
 * grid draws a perfectly convincing picture of rain 640 kilometres from where it fell, and nothing
 * else in the suite -- or on a screenshot -- would notice.
 */
const CORNERS = {
    southWest: [43.6290016, 3.1687801],
    northWest: [49.3744011, 2.68942],
    northEast: [49.3633003, 12.4623003],
    southEast: [43.6189995, 11.9555998],
} as const;

const grid = SWISS_RADAR_GRID;
const rowOf = (cell: number): number => Math.floor(cell / grid.nx);
const colOf = (cell: number): number => cell % grid.nx;

/**
 * A corner coordinate is the outer corner of the outermost cell, so it sits exactly on the edge --
 * and half of them therefore fall just outside the grid. Step half a kilometre inwards, which is
 * far more than the projection's error and far less than a cell.
 */
const inwards = (corner: readonly [number, number], lat: 1 | -1, lon: 1 | -1): [number, number] => [
    corner[0] + lat * 0.005,
    corner[1] + lon * 0.005,
];

describe("the Swiss radar grid", () => {
    it("has its first row at the top, as the files do", () => {
        const [lat, lon] = inwards(CORNERS.northWest, -1, 1);
        expect(rowOf(cellAt(grid, lat, lon))).toBe(0);
        expect(colOf(cellAt(grid, lat, lon))).toBe(0);
    });

    it("reaches each of the four corners the data declares", () => {
        const at = (corner: readonly [number, number], lat: 1 | -1, lon: 1 | -1): number[] => {
            const [a, o] = inwards(corner, lat, lon);
            const cell = cellAt(grid, a, o);
            expect(cell).toBeGreaterThanOrEqual(0);
            return [rowOf(cell), colOf(cell)];
        };
        expect(at(CORNERS.northWest, -1, 1)).toEqual([0, 0]);
        expect(at(CORNERS.northEast, -1, -1)).toEqual([0, grid.nx - 1]);
        expect(at(CORNERS.southWest, 1, 1)).toEqual([grid.ny - 1, 0]);
        expect(at(CORNERS.southEast, 1, -1)).toEqual([grid.ny - 1, grid.nx - 1]);
    });

    it("puts Bern where Bern is", () => {
        // The LV95 fundamental point is 2 600 000 / 1 200 000, so 345 km east of the western edge
        // and 280 km south of the northern one.
        const cell = cellAt(grid, 46.9524056, 7.4395833);
        expect(colOf(cell)).toBe(345);
        expect(rowOf(cell)).toBe(279);
    });

    it("knows the region that ships is inside it", () => {
        // The showcase, in the Bernese Oberland.
        expect(cellAt(grid, 46.595, 7.596)).toBeGreaterThanOrEqual(0);
    });

    it("says nothing for a place the Swiss radar does not cover", () => {
        expect(cellAt(grid, 41.9, 12.5)).toBe(-1); // Rome
        expect(cellAt(grid, 51.5, 0)).toBe(-1); // London
        expect(cellAt(grid, 0, 0)).toBe(-1);
    });
});
