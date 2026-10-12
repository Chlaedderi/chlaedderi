/**
 * German for text that arrives *with the data* rather than from the interface.
 *
 * Three layers, in the order the old `tx()` and `LT()` used:
 *
 * 1. a field's own German twin -- `rockDe` next to `rock`, `warnDe` next to `warn` (`longText`);
 * 2. the pack's own `de` map, for short strings a region adds;
 * 3. the app's table, `DATA_DE` and then `DATA_DE_RX` (`shortText`).
 *
 * English is returned untouched: only German needs any of this.
 */

import { DATA_DE, DATA_DE_RX } from "@i18n/dataTranslations";

import type { Lang } from "./lang";

/** Compass points as German abbreviates them. */
export const ORIENT_DE: Readonly<Record<string, string>> = {
    N: "N",
    NE: "NO",
    E: "O",
    SE: "SO",
    S: "S",
    SW: "SW",
    W: "W",
    NW: "NW",
};

export const orientLabel = (o: string, lang: Lang): string =>
    lang === "de" ? (ORIENT_DE[o] ?? o) : o;

/** `X gives NE, Y gives SE` -- a sentence the data builds, so it needs its own pattern. */
const GIVES = /^(.+) gives (\w+), (.+) gives (\w+)$/;

/**
 * A short string from the data, e.g. a rock name or a source note.
 *
 * `packDe` is the pack's own `de` map, which wins over the app's table: a region knows its own
 * vocabulary better than the app does.
 */
export const shortText = (
    s: string | null | undefined,
    lang: Lang,
    packDe: Readonly<Record<string, string>> = {},
): string | null | undefined => {
    if (lang !== "de" || s == null) return s;
    if (Object.prototype.hasOwnProperty.call(packDe, s)) return packDe[s];
    if (Object.prototype.hasOwnProperty.call(DATA_DE, s)) return DATA_DE[s];
    for (const [pattern, to] of DATA_DE_RX) {
        if (pattern.test(s)) return s.replace(pattern, to);
    }
    const m = GIVES.exec(s);
    if (m) {
        return `${m[1]} nennt ${ORIENT_DE[m[2] ?? ""] ?? m[2]}, ${m[3]} nennt ${ORIENT_DE[m[4] ?? ""] ?? m[4]}`;
    }
    return s;
};

/**
 * A long text that has a German twin in the data: `longText(crag, "warn", lang)` reads `warnDe`
 * in German when it is there, and `warn` otherwise.
 */
export const longText = <K extends string, T extends Partial<Record<K | `${K}De`, string | null>>>(
    o: T | null | undefined,
    field: K,
    lang: Lang,
): string | null => {
    if (!o) return null;
    if (lang === "de") {
        const twin = o[`${field}De` as keyof T] as string | null | undefined;
        if (twin) return twin;
    }
    return (o[field as keyof T] as string | null | undefined) ?? null;
};
