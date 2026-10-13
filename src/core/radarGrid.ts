/**
 * Where the Swiss radar composite sits on the ground.
 *
 * The frames are a 710 x 640 grid of one-kilometre cells on the Swiss grid (LV95), north up, so
 * finding the cell under a coordinate is a projection and two divisions -- and `toLV95` is already
 * here, for the swisstopo height and trail services. Checked against the four corner coordinates
 * the files themselves carry: the approximate formulas land within eleven metres at the far
 * corners, which is a ninetieth of a cell.
 *
 * The constants are the whole of the geometry, and getting one of them wrong draws a perfectly
 * convincing map of rain that is somewhere else -- a north/south flip is 640 km of error and looks
 * like weather. `radarGrid.test.ts` pins them to the corners the data declares.
 */

import { toLV95 } from "./geo";

export interface RadarGrid {
    readonly nx: number;
    readonly ny: number;
    /** LV95 easting of the western edge, and northing of the *northern* edge: row 0 is north. */
    readonly west: number;
    readonly north: number;
    /** Cell size, metres. */
    readonly step: number;
}

export const SWISS_RADAR_GRID: RadarGrid = {
    nx: 710,
    ny: 640,
    west: 2_255_000,
    north: 1_480_000,
    step: 1000,
};

/**
 * The cell a coordinate falls in, or -1 outside the grid.
 *
 * Returns the index into the frame's values, so the caller can read `values[cellAt(...)]` without
 * knowing how the rows are laid out.
 */
export const cellAt = (grid: RadarGrid, lat: number, lon: number): number => {
    const [east, north] = toLV95(lat, lon);
    const col = Math.floor((east - grid.west) / grid.step);
    const row = Math.floor((grid.north - north) / grid.step);
    if (col < 0 || col >= grid.nx || row < 0 || row >= grid.ny) return -1;
    return row * grid.nx + col;
};
