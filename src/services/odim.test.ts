import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { NotOdim, readOdimGrid } from "./odim";

/**
 * A real frame, 2026-10-10 04:00 UTC, a wet morning -- see the README beside it.
 *
 * The numbers below were read out of the same file with an independent HDF5 reader, so this is a
 * comparison and not a recording of whatever this code happened to do first.
 */
const FRAME = "src/test/fixtures/rzc262830400vl.001.h5";

const frame = (): ArrayBuffer => {
    const buffer = readFileSync(FRAME);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

/** A copy with one byte changed, to check that the reader refuses rather than guesses. */
const patched = (offset: number, value: number): ArrayBuffer => {
    const copy = new Uint8Array(frame());
    copy[offset] = value;
    return copy.buffer;
};

describe("reading a radar frame", () => {
    it("is the Swiss composite: 710 by 640, one kilometre a cell", async () => {
        const grid = await readOdimGrid(frame());
        expect(grid.nx).toBe(710);
        expect(grid.ny).toBe(640);
        expect(grid.values.length).toBe(454_400);
    });

    it("gives rain rates, in mm/h, with nothing where the radar sees nothing", async () => {
        const { values } = await readOdimGrid(frame());
        let nan = 0;
        let rain = 0;
        let max = 0;
        for (const value of values) {
            if (Number.isNaN(value)) nan++;
            else if (value > 0) {
                rain++;
                if (value > max) max = value;
            }
        }
        // The composite's domain is a rounded shape inside the rectangle; the rest is `nodata`.
        expect(nan).toBe(101_411);
        // A wet morning: a seventh of the grid had something falling on it.
        expect(rain).toBe(63_314);
        // A plausible rain rate, not a raw byte and not a saturated 255.
        expect(max).toBeCloseTo(10.79, 2);
    });

    /*
     * The refusals. Each one is a byte that, if the reader shrugged at it, would be read as
     * something else entirely -- and a radar drawn from a misread file looks exactly like a radar.
     */
    it("refuses a file that is not one of these at all", async () => {
        await expect(readOdimGrid(new ArrayBuffer(8))).rejects.toThrow(NotOdim);
        await expect(readOdimGrid(new ArrayBuffer(4096))).rejects.toThrow(NotOdim);
    });

    it("refuses a superblock it has never seen", async () => {
        // Byte 8 is the superblock version; 2 and 3 exist and are laid out differently.
        await expect(readOdimGrid(patched(8, 2))).rejects.toThrow(/superblock/);
    });

    it("refuses offsets that are not eight bytes", async () => {
        await expect(readOdimGrid(patched(13, 4))).rejects.toThrow(/offsets/);
    });

    it("refuses a truncated file rather than reading past it", async () => {
        const whole = new Uint8Array(frame());
        await expect(readOdimGrid(whole.slice(0, whole.length - 4000).buffer)).rejects.toThrow(
            NotOdim,
        );
    });
});
