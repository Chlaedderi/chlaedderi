/**
 * The weather pictograms, as geometry with no DOM.
 *
 * A port of the hand-written app's `MS_SPEC`, `wxInner` and `WMO_MS` (index.html:3391-3454): the
 * symbols MeteoSwiss uses, drawn the way the Wind app draws them -- a sun or a moon, a cloud in one
 * of three weights, drops or flakes beneath it, a bolt, fog. They were lost in the React pass,
 * which put the words «partly cloudy» in the column instead, and a week of words is a week nobody
 * reads at a glance.
 *
 * The shapes come out as data rather than as SVG strings, because nothing in this app builds HTML:
 * `src/features/weather/WxIcon.tsx` renders them as React children. Colours are named, not mixed
 * in here -- the component resolves a tone to the theme's `--wx-*` variable, so the symbols follow
 * the dark scheme like everything else.
 */

/**
 * The colours a pictogram is drawn in; `src/theme.ts` holds their values. `halo` is the page
 * behind the symbol, which the bolt is outlined in so it stays legible on a dark cloud.
 */
export type WxTone =
    "sun" | "ray" | "moon" | "cloud" | "cloudEdge" | "dark" | "rain" | "snow" | "halo";

/**
 * One drawn element.
 *
 * `moon` is its own kind because a crescent is a disc with a disc bitten out of it, which needs a
 * mask and therefore an id the renderer has to hand out.
 */
export type WxShape =
    | {
          readonly k: "path";
          readonly d: string;
          readonly fill?: WxTone;
          readonly stroke?: WxTone;
          readonly w?: number;
          readonly opacity?: number;
          readonly transform?: string;
      }
    | {
          readonly k: "circle";
          readonly cx: number;
          readonly cy: number;
          readonly r: number;
          readonly fill: WxTone;
          readonly stroke?: WxTone;
          readonly w?: number;
      }
    | { readonly k: "moon"; readonly cx: number; readonly cy: number; readonly r: number };

/**
 * What each MeteoSwiss pictogram is made of, verbatim from the original:
 * `[sun 0 none/1 free/2 behind the cloud/3 half covered, cloud 0 none/1 small/2 normal/3 dark,
 *   precipitation ''|r|s|m, how many, thunder, fog 1 high fog/2 fog, high cloud]`.
 */
const MS_SPEC: Record<number, readonly [number, number, string, number, number, number, number]> = {
    1: [1, 0, "", 0, 0, 0, 0],
    2: [1, 1, "", 0, 0, 0, 0],
    3: [2, 2, "", 0, 0, 0, 0],
    4: [3, 2, "", 0, 0, 0, 0],
    5: [0, 2, "", 0, 0, 0, 0],
    35: [0, 2, "", 0, 0, 0, 0],
    26: [1, 0, "", 0, 0, 0, 1],
    27: [0, 2, "", 0, 0, 1, 0],
    28: [0, 0, "", 0, 0, 2, 0],
    6: [2, 2, "r", 1, 0, 0, 0],
    29: [2, 1, "r", 1, 0, 0, 0],
    32: [2, 2, "r", 2, 0, 0, 0],
    7: [2, 2, "m", 1, 0, 0, 0],
    31: [2, 2, "m", 2, 0, 0, 0],
    8: [2, 2, "s", 1, 0, 0, 0],
    30: [2, 1, "s", 1, 0, 0, 0],
    9: [0, 2, "r", 2, 0, 0, 0],
    33: [0, 2, "r", 3, 0, 0, 0],
    10: [0, 2, "m", 2, 0, 0, 0],
    11: [0, 2, "s", 2, 0, 0, 0],
    34: [0, 2, "s", 3, 0, 0, 0],
    12: [2, 2, "", 0, 1, 0, 0],
    13: [2, 2, "r", 1, 1, 0, 0],
    36: [2, 2, "r", 1, 1, 0, 0],
    37: [2, 2, "s", 1, 1, 0, 0],
    14: [0, 3, "r", 1, 0, 0, 0],
    17: [0, 3, "r", 2, 0, 0, 0],
    20: [0, 3, "r", 3, 0, 0, 0],
    15: [0, 3, "m", 1, 0, 0, 0],
    18: [0, 3, "m", 2, 0, 0, 0],
    21: [0, 3, "m", 3, 0, 0, 0],
    16: [0, 3, "s", 1, 0, 0, 0],
    19: [0, 3, "s", 2, 0, 0, 0],
    22: [0, 3, "s", 3, 0, 0, 0],
    23: [0, 3, "", 0, 1, 0, 0],
    24: [0, 3, "r", 2, 1, 0, 0],
    25: [0, 3, "r", 3, 1, 0, 0],
    40: [0, 3, "r", 1, 1, 0, 0],
    41: [0, 2, "r", 1, 1, 0, 0],
    38: [0, 2, "r", 2, 1, 0, 0],
    39: [0, 2, "s", 2, 1, 0, 0],
    42: [0, 3, "s", 2, 1, 0, 0],
};

/** Open-Meteo's WMO code to a MeteoSwiss pictogram. */
const WMO_MS: Record<number, number> = {
    0: 1,
    1: 2,
    2: 3,
    3: 5,
    45: 28,
    48: 28,
    51: 14,
    53: 14,
    55: 17,
    56: 15,
    57: 18,
    61: 14,
    63: 17,
    65: 20,
    66: 15,
    67: 18,
    71: 16,
    73: 19,
    75: 22,
    77: 16,
    80: 6,
    81: 32,
    82: 33,
    85: 8,
    86: 11,
    95: 24,
    96: 25,
    99: 25,
};

/** The pictogram for a WMO code; night adds 100, which swaps the sun for a moon. */
export const wmoToMs = (code: number, isDay: boolean): number => {
    const c = WMO_MS[code] ?? 5;
    return isDay ? c : c + 100;
};

const CLOUD = "M8 26h21a7 7 0 0 0 0.6-13.97A10 10 0 0 0 10.4 10.5 7.8 7.8 0 0 0 8 26z" as const;

/**
 * The elements of one pictogram, in painting order: the disc first, then the veils and the fog
 * bank, the cloud over them, and the precipitation and the bolt in front of everything.
 *
 * Unknown codes fall back to «overcast», which is what the original's `|| [0, 2, …]` did.
 */
export const wxShapes = (msCode: number): readonly WxShape[] => {
    const night = msCode > 100;
    const [sun, cloud, precip, precipN, thunder, fog, high] =
        MS_SPEC[night ? msCode - 100 : msCode] ?? ([0, 2, "", 0, 0, 0, 0] as const);
    const out: WxShape[] = [];
    const small = cloud === 1;

    // Sun or moon. Where it sits depends on how much of it the cloud covers.
    if (sun) {
        const free = !cloud;
        const peek = sun === 3;
        const cx = free ? (high ? 27 : 24) : small ? 20 : peek ? 27 : 17;
        const cy = free ? (high ? 26 : 24) : small ? 19 : peek ? 14 : 16;
        const r = free ? 9.5 : small ? 8.5 : peek ? 6.5 : 7.5;

        if (night) {
            out.push({ k: "moon", cx, cy, r });
        } else {
            let rays = "";
            for (let k = 0; k < 8; k++) {
                const a = (k * Math.PI) / 4;
                const r1 = r + 2.6;
                const r2 = r + 6.2;
                rays +=
                    `M${(cx + r1 * Math.cos(a)).toFixed(1)} ${(cy + r1 * Math.sin(a)).toFixed(1)}` +
                    `L${(cx + r2 * Math.cos(a)).toFixed(1)} ${(cy + r2 * Math.sin(a)).toFixed(1)}`;
            }
            out.push({ k: "path", d: rays, stroke: "ray", w: 2.6 });
            out.push({ k: "circle", cx, cy, r, fill: "sun", stroke: "ray", w: 0.8 });
        }
    }

    // High cloud: grey veils drawn across the sun, top left.
    if (high)
        out.push({
            k: "path",
            d: "M5 13.5h19M9 19.5h16M3 25.5h13M10 31.5h9",
            stroke: "cloudEdge",
            w: 2.4,
            opacity: 0.9,
        });

    if (fog === 2)
        out.push({ k: "path", d: "M8 17h32M5 24h38M8 31h32M12 38h24", stroke: "cloudEdge", w: 3 });

    if (cloud)
        out.push({
            k: "path",
            d: CLOUD,
            fill: cloud === 3 ? "dark" : "cloud",
            stroke: "cloudEdge",
            w: 1.3,
            transform: small
                ? "translate(19 20) scale(0.72)"
                : sun || fog === 1 || precip || thunder
                  ? "translate(9 10)"
                  : "translate(8 13)",
        });

    // High fog: the bank lies under the cloud rather than over the whole symbol.
    if (fog === 1) out.push({ k: "path", d: "M9 41h30M13 46h22", stroke: "cloudEdge", w: 2.6 });

    if (precip && precipN) {
        // Mixed precipitation alternates drops and flakes, so it needs at least two of them.
        const n = precip === "m" ? Math.max(2, precipN) : precipN;
        const xs = thunder
            ? n === 1
                ? [16]
                : n === 2
                  ? [15, 37]
                  : [12, 17, 37]
            : n === 1
              ? [26]
              : n === 2
                ? [21, 31]
                : [17, 26, 35];
        xs.forEach((x, i) => {
            const kind = precip === "m" ? (i % 2 ? "s" : "r") : precip;
            if (kind === "r")
                out.push({
                    k: "path",
                    d: `M${x + 1.5} 39L${x - 1.5} 45.5`,
                    stroke: "rain",
                    w: 2.6,
                });
            else
                out.push({
                    k: "path",
                    d: `M${x} 38.5v7M${x - 3} 40.2l6 3.6M${x + 3} 40.2l-6 3.6`,
                    stroke: "snow",
                    w: 1.7,
                });
        });
    }

    if (thunder)
        out.push({
            k: "path",
            d: "M27 32l-6.5 8.5h5l-3 7.5 9.5-10.5h-5.2l3-5.5z",
            fill: "sun",
            stroke: "halo",
            w: 1,
        });

    return out;
};
