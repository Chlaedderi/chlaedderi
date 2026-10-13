/**
 * Rain rate to colour, for a radar the app draws itself.
 *
 * The tile services arrive already coloured; the Swiss composite arrives as millimetres an hour and
 * has to be painted here. The ramp is **the same five colours the radar bar already shows** as its
 * key (`.radarbar .scale` in `src/styles/mapchrome.css`), so the strip on the bar means what the
 * map means -- `rainRamp.test.ts` reads that stylesheet and fails if the two ever part company.
 *
 * Rates are spaced logarithmically because rain is: the difference between 0.2 and 2 mm/h is the
 * difference between «damp» and «going home», and the difference between 40 and 60 is neither here
 * nor there once you are under it.
 */

/**
 * Below this, nothing is drawn. Covers `undetect` (0) and the no-data NaN alike.
 *
 * It is the first stop of the ramp, so the faintest thing the map can show is the faintest colour
 * the bar's key shows, and nothing is painted in a colour the key does not have.
 */
export const RAIN_FLOOR = 0.1;

/** The stops, as the bar's gradient paints them, against the rate each one means. */
export const RAIN_STOPS: readonly (readonly [mmh: number, hex: string])[] = [
    [0.1, "#9be1ff"],
    [1, "#0a7cff"],
    [5, "#ffd400"],
    [20, "#ff6a00"],
    [60, "#d4005a"],
];

const LO = Math.log(RAIN_FLOOR);
const HI = Math.log(100);

/**
 * A rain rate as a ramp index: 0 for nothing at all, 1..255 up the ramp.
 *
 * Zero is given its own index rather than falling out of the arithmetic, because «the radar looked
 * and there is nothing» and «the radar is not looking here» must both come out invisible.
 */
export const rainIndex = (mmh: number): number => {
    if (!Number.isFinite(mmh) || mmh < RAIN_FLOOR) return 0;
    const t = (Math.log(mmh) - LO) / (HI - LO);
    return Math.max(1, Math.min(255, Math.round(t * 254) + 1));
};

/** The rate an index stands for -- the inverse of `rainIndex`, for the tests and for a legend. */
export const rainRate = (index: number): number =>
    index < 1 ? 0 : Math.exp(LO + ((index - 1) / 254) * (HI - LO));

const hex = (colour: string): [number, number, number] => [
    Number.parseInt(colour.slice(1, 3), 16),
    Number.parseInt(colour.slice(3, 5), 16),
    Number.parseInt(colour.slice(5, 7), 16),
];

/**
 * The 256 colours of the ramp, each packed as one little-endian RGBA word.
 *
 * Packed rather than four bytes because painting a tile writes a `Uint32Array` view over the image
 * data: one store per pixel instead of four.
 */
export const rainPalette = (): Uint32Array => {
    const stops = RAIN_STOPS.map(([mmh, colour]) => ({ mmh, rgb: hex(colour) }));
    const palette = new Uint32Array(256);
    for (let i = 1; i < 256; i++) {
        const rate = rainRate(i);
        let lower = stops[0]!;
        let upper = stops[stops.length - 1]!;
        for (let s = 0; s < stops.length - 1; s++) {
            if (rate >= stops[s]!.mmh && rate <= stops[s + 1]!.mmh) {
                lower = stops[s]!;
                upper = stops[s + 1]!;
                break;
            }
            if (rate < stops[0]!.mmh) upper = stops[0]!;
            if (rate > stops[stops.length - 1]!.mmh) lower = stops[stops.length - 1]!;
        }
        const span = Math.log(upper.mmh) - Math.log(lower.mmh);
        const t =
            span > 0 ? Math.min(1, Math.max(0, (Math.log(rate) - Math.log(lower.mmh)) / span)) : 0;
        const [r, g, b] = [0, 1, 2].map((c) =>
            Math.round(lower.rgb[c]! + (upper.rgb[c]! - lower.rgb[c]!) * t),
        ) as [number, number, number];
        // Drizzle is nearly transparent and a downpour is nearly solid. A flat alpha plates a
        // whole canton in blue the moment anything at all is falling, and widespread drizzle is
        // the commonest thing a radar has to show -- so the bottom of the ramp is faint enough to
        // read the map through, and it is the heavy cells that announce themselves.
        const alpha = Math.round(55 + (200 * (i - 1)) / 254);
        palette[i] = (alpha << 24) | (b << 16) | (g << 8) | r;
    }
    return palette;
};
