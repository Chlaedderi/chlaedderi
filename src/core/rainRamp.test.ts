import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RAIN_FLOOR, RAIN_STOPS, rainIndex, rainPalette, rainRate } from "./rainRamp";

describe("the rain ramp", () => {
    it("draws nothing where there is nothing", () => {
        expect(rainIndex(0)).toBe(0);
        expect(rainIndex(NaN)).toBe(0);
        expect(rainIndex(-1)).toBe(0);
        expect(rainIndex(RAIN_FLOOR / 2)).toBe(0);
        expect(rainPalette()[0]).toBe(0);
    });

    it("rises with the rain and never falls", () => {
        let last = 0;
        for (const mmh of [0.1, 0.3, 1, 2, 5, 12, 20, 50, 100, 200]) {
            const index = rainIndex(mmh);
            expect(index).toBeGreaterThanOrEqual(last);
            last = index;
        }
        expect(rainIndex(200)).toBe(255);
    });

    it("says what each index means, to within its own step", () => {
        // 254 steps from 0.08 to 100 mm/h is a factor of about 1.028 a step, so a rate read back
        // out of its index is within about one and a half percent whatever the rate.
        for (const mmh of [0.2, 1, 7.5, 42]) {
            expect(Math.abs(rainRate(rainIndex(mmh)) / mmh - 1)).toBeLessThan(0.015);
        }
    });

    it("gives a colour to every step above the floor", () => {
        const palette = rainPalette();
        for (let i = 1; i < 256; i++) expect(palette[i]).not.toBe(0);
        // Alpha climbs: drizzle is faint, a downpour is not.
        const alpha = (word: number): number => (word >>> 24) & 0xff;
        expect(alpha(palette[1]!)).toBeLessThan(alpha(palette[255]!));
    });

    /**
     * The guard that keeps the map and the bar honest.
     *
     * The bar shows a five-colour strip as the key to the radar. It was written as a CSS gradient
     * long before anything here painted a pixel, and the two would drift apart silently -- a
     * legend that does not match its map is worse than no legend, because it is believed.
     */
    it("is the same five colours the bar shows as its key", () => {
        const css = readFileSync("src/styles/mapchrome.css", "utf8");
        const scale = /\.radarbar \.scale \{[^}]*linear-gradient\(90deg,([^)]*)\)/.exec(css);
        expect(scale, "the .scale gradient is still in mapchrome.css").not.toBeNull();
        const colours = [...scale![1]!.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]!.toLowerCase());
        expect(colours).toEqual(RAIN_STOPS.map(([, hex]) => hex));
    });
});
