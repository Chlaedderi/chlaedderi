/**
 * What each filter option is called.
 *
 * The hand-written app labelled its options ad hoc -- `walk.le` with the number in it,
 * `style.sport`, `wx.f.dry` -- rather than by any scheme that could be derived from the option
 * value. This table keeps every one of those translations instead of inventing new ones, and it is
 * the single place that knows how an option reads.
 *
 * Several of them take a **count**: the original told you how many crags an option would leave
 * before you chose it (`style.sport` is «Sport (42)», `bolt.f.close` «Close or well bolted (17)»).
 * The first React pass dropped the counts and invented countless `opt.*` texts in their place;
 * `count` here puts the figure back, and is 0 where the caller has nothing to count with.
 */

import type { TFunction } from "i18next";

import { FILTER_VALUES, type FilterKey } from "@core/filters";
import type { Crag } from "@domain/model";

type Labeller = (t: TFunction, option: string, count: number) => string;

const LABELS: Record<FilterKey, Labeller> = {
    fav: (t, o) => (o === "crags" ? t("fav.crags") : t("fav.routes")),
    star: (t, o) => t("opt.star", { 0: o }),
    log: (t, o) => (o === "todo" ? t("log.f.todo") : t("log.f.done")),
    pic: (t, o) => (o === "pic" ? t("pic.pic") : o === "topo" ? t("pic.topo") : t("pic.link")),
    walk: (t, o) =>
        o === "unknown" ? t("unknown") : o === "30+" ? t("walk.gt") : t("walk.le", { 0: o }),
    count: (t, o) => t("count.ge", { 0: o }),
    style: (t, o, n) => (o === "sport" ? t("style.sport", { 0: n }) : t("style.mixed", { 0: n })),
    rain: (t, o) => (o === "yes" ? t("rain.yes") : t("rain.no")),
    dry: (t, o) => (o === "fast" ? t("dry.f.fast") : t("dry.f.ok")),
    len: (t, o) => (o === "40+" ? t("len.gt", { 0: "40" }) : t("len.le", { 0: o })),
    wx: (t, o) => (o === "dry" ? t("wx.f.dry") : t("wx.f.ok")),
    bolt: (t, o, n) =>
        o === "close"
            ? t("bolt.f.close", { 0: n })
            : o === "spaced"
              ? t("bolt.f.spaced", { 0: n })
              : t("bolt.f.notSpaced"),
    boltC: (t, o, n) => (o === "new" ? t("bolt.f.new", { 0: n }) : t("bolt.f.notOld")),
};

/** The label of one option of one filter. `any` is the same word everywhere. */
export const optionLabel = (t: TFunction, key: FilterKey, option: string, count = 0): string =>
    option === "any" ? t("any") : LABELS[key](t, option, count);

/** Every (filter, option) pair, for the tests that check the labels resolve. */
export const ALL_OPTIONS: readonly (readonly [FilterKey, string])[] = (
    Object.keys(FILTER_VALUES) as FilterKey[]
).flatMap((key) => FILTER_VALUES[key].map((option) => [key, option] as const));

/**
 * How many crags of the region each counted option would leave.
 *
 * `S` in the original is the region's crags before the filters are applied, which is what makes
 * the figure useful: it says what is there, not what the current filter has already narrowed to.
 */
export const optionCounts = (
    crags: readonly Crag[],
): Partial<Record<FilterKey, Record<string, number>>> => {
    const by = (test: (c: Crag) => boolean): number => crags.filter(test).length;
    return {
        style: {
            sport: by((c) => c.styleKey === "sport"),
            mixed: by((c) => c.styleKey === "mixed"),
        },
        bolt: {
            close: by((c) => c.boltSp === "close" || c.boltSp === "good"),
            spaced: by((c) => c.boltSp === "spaced" || c.boltSp === "part"),
        },
        boltC: { new: by((c) => c.boltC === "new") },
    };
};
