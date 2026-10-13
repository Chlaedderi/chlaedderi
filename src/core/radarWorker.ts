/**
 * Decoding a radar frame off the main thread.
 *
 * One frame is 454 400 cells and takes about sixty milliseconds to inflate and read; a two-hour
 * loop is twenty-four of them. On the main thread that is a second and a half of arithmetic on a
 * laptop and several on a phone -- all of it while somebody is dragging the map. So it goes to a
 * worker, which also keeps the transient three-and-a-half megabytes of float64 out of the way of
 * whatever the map is allocating.
 *
 * The worker is a transport, not a design: the decoding itself is `readOdimGrid`, which the tests
 * call directly. Where there is no `Worker` at all -- jsdom, an old browser, a policy that blocks
 * them -- this falls back to decoding in place, so the feature degrades to «slower» and never to
 * «missing».
 *
 * It lives in `core/` rather than beside the radar's components because `reachable.test.ts` walks
 * `import` statements, and a worker is referenced by URL: a file under `features/` that nothing
 * imports would fail that test for being unreachable, which here would be a lie.
 */

import { rainIndex } from "./rainRamp";

/** What the worker is asked for, and what it answers with. */
export interface DecodeRequest {
    readonly id: number;
    readonly file: ArrayBuffer;
}

export interface DecodeReply {
    readonly id: number;
    readonly nx?: number;
    readonly ny?: number;
    readonly cells?: Uint8Array;
    readonly error?: string;
}

/**
 * Quantise a decoded grid to one byte a cell.
 *
 * Done here, next to the decoder, so that the three-and-a-half megabytes of float64 never leave
 * the worker: what crosses is 454 KB of ramp indices, transferred rather than copied. Keeping the
 * rates instead would be 87 MB for a two-hour loop.
 */
export const toCells = (values: Float64Array): Uint8Array => {
    const cells = new Uint8Array(values.length);
    for (let i = 0; i < values.length; i++) cells[i] = rainIndex(values[i]!);
    return cells;
};
