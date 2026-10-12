import { describe, expect, it } from "vitest";

import { wmoToMs, wxShapes, type WxShape, type WxTone } from "./wxSymbol";

/** What a symbol is made of, in the terms a reader sees: a sun, a cloud, drops, a bolt. */
const parts = (ms: number) => {
    const shapes: readonly WxShape[] = wxShapes(ms);
    const strokes: WxTone[] = shapes.flatMap((s) => (s.k === "path" && s.stroke ? [s.stroke] : []));
    const fills: WxTone[] = shapes.flatMap((s) =>
        s.k === "circle" ? [s.fill] : s.k === "path" && s.fill ? [s.fill] : [],
    );
    const count = (tone: WxTone): number => strokes.filter((x) => x === tone).length;

    return {
        sun: shapes.some((s) => s.k === "circle" && s.fill === "sun"),
        rays: strokes.includes("ray"),
        moon: shapes.some((s) => s.k === "moon"),
        cloud: fills.includes("cloud"),
        darkCloud: fills.includes("dark"),
        drops: count("rain"),
        flakes: count("snow"),
        // Only the bolt is a filled path; the cloud is the other one, and it is never yellow.
        bolt: shapes.some((s) => s.k === "path" && s.fill === "sun"),
        grey: count("cloudEdge"),
    };
};

describe("wmoToMs", () => {
    it("names the MeteoSwiss pictogram for a WMO code", () => {
        expect(wmoToMs(0, true)).toBe(1); // clear
        expect(wmoToMs(3, true)).toBe(5); // overcast
        expect(wmoToMs(95, true)).toBe(24); // thunderstorms
    });

    it("adds 100 at night, which is what swaps the sun for a moon", () => {
        expect(wmoToMs(0, false)).toBe(101);
        expect(parts(wmoToMs(0, true)).sun).toBe(true);
        expect(parts(wmoToMs(0, false)).moon).toBe(true);
        expect(parts(wmoToMs(0, false)).sun).toBe(false);
    });

    it("falls back to overcast for a code it does not know", () => {
        expect(wmoToMs(4242, true)).toBe(5);
    });
});

describe("wxShapes", () => {
    it("draws a clear day as a sun with rays and nothing else", () => {
        const p = parts(1);
        expect(p).toMatchObject({ sun: true, rays: true, cloud: false, drops: 0, flakes: 0 });
    });

    it("draws overcast as a cloud with no sun", () => {
        const p = parts(5);
        expect(p).toMatchObject({ cloud: true, sun: false, moon: false, drops: 0, flakes: 0 });
    });

    it("counts the drops: one for a shower, three for heavy rain", () => {
        expect(parts(wmoToMs(80, true)).drops).toBe(1); // rain showers
        expect(parts(wmoToMs(63, true)).drops).toBe(2); // rain
        expect(parts(wmoToMs(65, true)).drops).toBe(3); // heavy rain
    });

    it("draws snow as flakes, not drops", () => {
        const p = parts(wmoToMs(75, true)); // heavy snow
        expect(p.flakes).toBe(3);
        expect(p.drops).toBe(0);
    });

    it("alternates drops and flakes for sleet", () => {
        const p = parts(7); // sleet shower: one in the spec, at least two on the page
        expect(p.drops).toBe(1);
        expect(p.flakes).toBe(1);
    });

    it("darkens the cloud when the rain is not a shower", () => {
        expect(parts(wmoToMs(63, true)).darkCloud).toBe(true); // steady rain
        expect(parts(wmoToMs(80, true)).darkCloud).toBe(false); // a shower, sun beside it
        expect(parts(wmoToMs(80, true)).sun).toBe(true);
    });

    it("puts a bolt in a thunderstorm and leaves it out otherwise", () => {
        expect(parts(wmoToMs(95, true)).bolt).toBe(true);
        expect(parts(wmoToMs(96, true)).bolt).toBe(true);
        expect(parts(wmoToMs(61, true)).bolt).toBe(false);
    });

    it("draws fog as bands and no cloud", () => {
        const p = parts(wmoToMs(45, true));
        expect(p.grey).toBeGreaterThan(0);
        expect(p).toMatchObject({ cloud: false, sun: false, drops: 0 });
    });

    it("falls back to overcast for a pictogram it does not know", () => {
        expect(wxShapes(999)).toEqual(wxShapes(5));
    });

    it("gives the four kinds of sky four different symbols", () => {
        const seen = [0, 3, 61, 95].map((c) => JSON.stringify(wxShapes(wmoToMs(c, true))));
        expect(new Set(seen).size).toBe(4);
    });

    it("draws every code the forecast can deliver", () => {
        // The WMO codes `src/core/forecast.ts` carries words for. A code with no shapes at all
        // would be an empty column, which is worse than the words it replaced.
        const codes = [
            0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82,
            85, 86, 95, 96, 99,
        ];
        for (const c of codes) {
            expect(wxShapes(wmoToMs(c, true)).length, `day ${c}`).toBeGreaterThan(0);
            expect(wxShapes(wmoToMs(c, false)).length, `night ${c}`).toBeGreaterThan(0);
        }
    });
});
