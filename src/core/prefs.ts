/**
 * The settings, kept by the triple store under `prefs` and read once at start, so that language and
 * theme are right from the first paint.
 *
 * `packs` holds only the *description* of the installed mappacks -- id, name, version, where they
 * came from, how big they are. The data itself lives in the Cache Storage; here it would blow up
 * every save.
 */

import { type Lang, isLang } from "./lang";
import { LOG_STYLES, type LogStyle, isLogStyle } from "./logbook";
import { APP_SLUG } from "./name";
import { PREVIEW_SUFFIX } from "./preview";

export type Theme = "auto" | "light" | "dark";
export type BaseMap = "topo" | "osm" | "sat";
export type BaseMapCh = "ch" | "chsat" | "topo";
export type RadarMode = "off" | "rv" | "dpc";

/** Where a pack came from, so that «fetch again» knows what to ask for. */
export interface PackSource {
    readonly type: "url" | "file";
    readonly url?: string;
    readonly name?: string;
    /**
     * The key a locked region was opened with, so «fetch again» and «share» still work.
     *
     * It is on this device already -- it came in the link that installed the region, and the data
     * it opens is in the cache beside it. Keeping it changes nothing about who can read what.
     */
    readonly key?: string;
}

/** What is remembered about an installed pack. Never its data -- that is in the Cache Storage. */
export interface InstalledPack {
    readonly id: string;
    readonly name?: { en: string; de: string };
    readonly version?: string;
    readonly partial?: boolean;
    readonly crags?: number;
    readonly routes?: number;
    readonly bytes?: number;
    /** When it was installed. */
    readonly at?: number;
    /** Where it came from, so that «fetch again» knows what to ask for. Null for neither. */
    readonly src?: PackSource | null;
}

export interface Prefs {
    lang: Lang | null;
    theme: Theme;
    base: BaseMap;
    baseCH: BaseMapCh;
    region: string | null;
    allPaths: boolean;
    radar: RadarMode;
    wx: boolean;
    allParks: boolean;
    chTrails: boolean;
    chWrz: boolean;
    /** The map legend is unfolded. Off to start with: it is reference, not furniture. */
    legend: boolean;
    logStyle: LogStyle;
    packs: InstalledPack[];
}

export const PREFS_KEY = "prefs";
/**
 * The localStorage item the first paint reads directly, before the store has woken up. Suffixed in
 * a pull request preview, like the namespace it belongs to: see preview.ts.
 */
export const PREFS_ITEM = `${APP_SLUG}${PREVIEW_SUFFIX}:${PREFS_KEY}`;

export const defaultPrefs = (): Prefs => ({
    lang: null,
    theme: "auto",
    base: "topo",
    baseCH: "ch",
    region: null,
    allPaths: false,
    radar: "off",
    wx: true,
    allParks: false,
    chTrails: true,
    chWrz: false,
    legend: false,
    logStyle: "rp",
    packs: [],
});

const ONE_OF = {
    theme: ["auto", "light", "dark"],
    base: ["topo", "osm", "sat"],
    baseCH: ["ch", "chsat", "topo"],
    radar: ["off", "rv", "dpc"],
} as const;

const FLAGS = ["allPaths", "wx", "allParks", "chTrails", "chWrz", "legend"] as const;

/** Read stored settings back, checking every value so an older version cannot break the app. */
export const cleanPrefs = (v: unknown): Prefs => {
    const prefs = defaultPrefs();
    if (!v || typeof v !== "object") return prefs;
    const x = v as Record<string, unknown>;

    if (isLang(x.lang)) prefs.lang = x.lang;
    for (const key of Object.keys(ONE_OF) as (keyof typeof ONE_OF)[]) {
        const allowed: readonly string[] = ONE_OF[key];
        if (typeof x[key] === "string" && allowed.includes(x[key] as string)) {
            (prefs as unknown as Record<string, unknown>)[key] = x[key];
        }
    }
    for (const key of FLAGS) {
        if (typeof x[key] === "boolean") prefs[key] = x[key];
    }
    if (typeof x.region === "string") prefs.region = x.region;
    if (isLogStyle(x.logStyle)) prefs.logStyle = x.logStyle;
    else if (x.logStyle != null && !LOG_STYLES.includes(x.logStyle as LogStyle))
        prefs.logStyle = "rp";
    if (Array.isArray(x.packs)) {
        prefs.packs = x.packs.filter(
            (p): p is InstalledPack =>
                Boolean(p) && typeof p === "object" && typeof (p as InstalledPack).id === "string",
        );
    }
    return prefs;
};

/**
 * Settings read back from the store, except for what the viewer has already changed.
 *
 * The slower layers of the store answer a moment after the first paint, and what they say used to
 * replace the whole settings object -- so a switch flipped during that moment was silently undone,
 * and the debounced writer then saved the undone value. Immer hands out a new object on every
 * change, so comparing each key against the state the app started with says exactly which ones the
 * viewer has touched. Those win; the rest come from storage.
 */
export const keepTouched = (stored: Prefs, current: Prefs, start: Prefs): Prefs => {
    const merged = { ...stored } as Record<string, unknown>;
    const now = current as unknown as Record<string, unknown>;
    const then = start as unknown as Record<string, unknown>;
    for (const key of Object.keys(now)) {
        if (now[key] !== then[key]) merged[key] = now[key];
    }
    return merged as unknown as Prefs;
};

/**
 * The settings as the very first paint can get at them: straight out of localStorage, before the
 * asynchronous layers of the store have answered. Mirrors what the old app did inline.
 */
export const readPrefsSync = (): Prefs => {
    try {
        const raw = localStorage.getItem(PREFS_ITEM);
        if (!raw) return defaultPrefs();
        const rec = JSON.parse(raw) as { v?: unknown };
        return cleanPrefs(rec?.v);
    } catch {
        return defaultPrefs();
    }
};
