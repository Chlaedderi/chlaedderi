import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RadarUnavailable } from "@core/radar";
import { SWISS_RADAR_GRID } from "@core/radarGrid";

import { fetchChFrames, forgetChFrames, frameTime } from "./meteoswissRadar";

const FRAME = readFileSync("src/test/fixtures/rzc262830400vl.001.h5");

/** The name of a frame covering `minutesAgo`, in the form the service publishes. */
const nameFor = (minutesAgo: number): string => {
    const at = new Date(Date.now() - minutesAgo * 60_000);
    const yy = String(at.getUTCFullYear() % 100).padStart(2, "0");
    const doy = Math.floor((at.getTime() - Date.UTC(at.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
    const hh = String(at.getUTCHours()).padStart(2, "0");
    const mm = String(Math.floor(at.getUTCMinutes() / 5) * 5).padStart(2, "0");
    return `rzc${yy}${String(doy).padStart(3, "0")}${hh}${mm}vl.001.h5`;
};

/** A catalogue holding these names, and the real fixture behind every frame. */
const serving = (names: readonly string[]): ReturnType<typeof vi.fn> => {
    const assets = Object.fromEntries(names.map((name) => [name, {}]));
    const fetcher = vi.fn((url: string) => {
        if (url.includes("/api/stac/")) {
            return Promise.resolve(new Response(JSON.stringify({ assets }), { status: 200 }));
        }
        const copy = new Uint8Array(FRAME);
        return Promise.resolve(new Response(copy, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
};

beforeEach(() => {
    forgetChFrames();
});

afterEach(() => {
    vi.unstubAllGlobals();
    forgetChFrames();
});

describe("reading a frame's name", () => {
    it("takes the time the file says it covers", () => {
        // 2026, day 283 (10 October), 04:00 UTC -- the fixture's own name.
        expect(frameTime("rzc262830400vl.001.h5")).toBe(Date.UTC(2026, 9, 10, 4, 0));
    });

    it("takes a frame published while a radar was down", () => {
        // The two-letter code says which sites were up; `tl` is as valid as `vl`.
        expect(frameTime("rzc262860320tl.001.h5")).toBe(Date.UTC(2026, 9, 13, 3, 20));
    });

    it("refuses what is not a rain-rate frame", () => {
        expect(frameTime("cpc262830400vl_00060.001.h5")).toBeNull(); // hourly totals
        expect(frameTime("tzc262830400vl.801.h5")).toBeNull(); // the side-view product
        expect(frameTime("rzc269990400vl.001.h5")).toBeNull(); // day 999
        expect(frameTime("readme.txt")).toBeNull();
    });
});

describe("the last two hours of Swiss radar", () => {
    it("decodes the frames the catalogue lists, oldest first", async () => {
        serving([nameFor(10), nameFor(5), nameFor(0)]);

        const frames = await fetchChFrames();

        expect(frames.kind).toBe("grids");
        expect(frames.grid).toBe(SWISS_RADAR_GRID);
        expect(frames.cells).toHaveLength(3);
        expect(frames.times).toHaveLength(3);
        expect(frames.times[0]).toBeLessThan(frames.times[2]!);
        // One byte a cell: the ramp index, not the rain rate. 454 400 of them.
        expect(frames.cells[0]).toHaveLength(SWISS_RADAR_GRID.nx * SWISS_RADAR_GRID.ny);
        expect(frames.cells[0]!.some((index) => index > 0)).toBe(true);
    });

    it("leaves out what is older than the window", async () => {
        serving([nameFor(600), nameFor(5)]);

        const frames = await fetchChFrames();

        // Ten hours ago is not «the last two hours», however faithfully the catalogue lists it.
        const oldest = Date.now() - 2 * 60 * 60 * 1000;
        expect(frames.times.every((at) => at > oldest)).toBe(true);
    });

    it("shows the newest frame before the rest have arrived", async () => {
        serving([nameFor(10), nameFor(5), nameFor(0)]);
        const partials: number[] = [];

        await fetchChFrames(undefined, (frames) => partials.push(frames.times.length));

        // Newest first, so the first thing on screen is what it is doing now.
        expect(partials[0]).toBe(1);
        expect(partials.at(-1)).toBe(3);
    });

    /**
     * The refresh runs every five minutes, for ever, on somebody's phone at a crag. Today's
     * catalogue grows to 290 KB by midnight, so re-reading it each time to learn one new file name
     * would be most of a megabyte an hour for nothing -- the names that follow are worked out from
     * the last one instead, and only a guess that turns out wrong sends us back to the catalogue.
     */
    it("asks for the new frame only, and not for the catalogue again", async () => {
        serving([nameFor(10), nameFor(5), nameFor(0)]);
        await fetchChFrames();

        const again = serving([nameFor(10), nameFor(5), nameFor(0)]);
        await fetchChFrames();

        const urls = again.mock.calls.map((call) => String(call[0]));
        expect(urls.filter((url) => url.includes("/api/stac/"))).toEqual([]);
        // At most the one slot that has turned over since; the frames already held are not refetched.
        expect(urls.length).toBeLessThanOrEqual(1);
    });

    it("says it cannot answer when nothing is published", async () => {
        serving([]);
        await expect(fetchChFrames()).rejects.toBeInstanceOf(RadarUnavailable);
    });

    it("says it cannot answer when the catalogue is not there", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve(new Response("", { status: 404 }))),
        );
        await expect(fetchChFrames()).rejects.toBeInstanceOf(RadarUnavailable);
    });

    it("says it cannot answer when the files are not frames", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((url: string) =>
                Promise.resolve(
                    url.includes("/api/stac/")
                        ? new Response(JSON.stringify({ assets: { [nameFor(0)]: {} } }), {
                              status: 200,
                          })
                        : new Response(new Uint8Array(4096), { status: 200 }),
                ),
            ),
        );
        await expect(fetchChFrames()).rejects.toBeInstanceOf(RadarUnavailable);
    });
});
