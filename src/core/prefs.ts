/**
 * The settings, kept by the triple store under `prefs` and read once at start, so that language and
 * theme are right from the first paint.
 *
 * `packs` holds only the *description* of the installed mappacks -- id, name, version, where they
 * came from, how big they are. The data itself lives in the Cache Storage; here it would blow up
 * every save.
 */

import {
    type InstallHintState,
    cleanInstallHint,
    defaultInstallHint,
    mergeInstallHint,
} from "./installHint";
import { type Lang, isLang } from "./lang";
import { LOG_STYLES, type LogStyle, isLogStyle } from "./logbook";
import { APP_SLUG } from "./name";
import { PREVIEW_SUFFIX } from "./preview";

export type Theme = "auto" | "light" | "dark";
export type BaseMap = "topo" | "osm" | "sat";
export type BaseMapCh = "ch" | "chsat" | "topo";

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
    /** The rain radar is on. Which service draws it follows the region: see core/radar.ts. */
    radar: boolean;
    wx: boolean;
    allParks: boolean;
    chTrails: boolean;
    chWrz: boolean;
    /** The map legend is unfolded. Off to start with: it is reference, not furniture. */
    legend: boolean;
    /** The «these crags are invented» dialog has been read. It is shown once, not every visit. */
    demoSeen: boolean;
    logStyle: LogStyle;
    packs: InstalledPack[];
    /** When the app last said it can be installed, and what came of it: see installHint.ts. */
    install: InstallHintState;
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
    radar: false,
    wx: true,
    allParks: false,
    chTrails: true,
    chWrz: false,
    legend: false,
    demoSeen: false,
    logStyle: "rp",
    packs: [],
    install: defaultInstallHint(),
});

const ONE_OF = {
    theme: ["auto", "light", "dark"],
    base: ["topo", "osm", "sat"],
    baseCH: ["ch", "chsat", "topo"],
} as const;

const FLAGS = ["allPaths", "wx", "allParks", "chTrails", "chWrz", "legend", "demoSeen"] as const;

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
    // The radar was «off» | «rv» | «dpc» until the source stopped being a choice. Somebody who had
    // picked a radar goes on having one; only «off» ever meant off. Without this arm their stored
    // string fails the boolean check below and their radar switches itself off, silently.
    if (typeof x.radar === "boolean") prefs.radar = x.radar;
    else if (typeof x.radar === "string") prefs.radar = x.radar !== "off";
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
    prefs.install = cleanInstallHint(x.install);
    return prefs;
};

/**
 * Settings read back from the store, except for what the viewer has already changed.
 *
 * The slower layers of the store answer a moment after the first paint, and what they say used to
 * replace the whole settings object -- so a switch flipped during that moment was silently undone,
 * and the debounced writer then saved the undone value. Comparing each key, by value, against
 * what the store was last known to hold (`start`) says which ones the viewer has changed since.
 * Those win; the rest come from storage.
 */
/** Stored regions, with what this tab added, replaced or removed since `start` laid over them. */
const mergePacks = (
    stored: readonly InstalledPack[],
    current: readonly InstalledPack[],
    start: readonly InstalledPack[],
): InstalledPack[] => {
    const was = new Map(start.map((p) => [p.id, JSON.stringify(p)]));
    const now = new Map(current.map((p) => [p.id, p]));
    const changed = (p: InstalledPack): boolean => was.get(p.id) !== JSON.stringify(p);
    const out = stored
        // Removed here since: stays removed.
        .filter((p) => !(was.has(p.id) && !now.has(p.id)))
        .map((p) => {
            const mine = now.get(p.id);
            return mine && changed(mine) ? mine : p;
        });
    for (const p of current) if (changed(p) && !out.some((o) => o.id === p.id)) out.push(p);
    // The same list kept as the same array: a new one would read as a change downstream.
    const text = JSON.stringify(out);
    if (text === JSON.stringify(current)) return current as InstalledPack[];
    if (text === JSON.stringify(stored)) return stored as InstalledPack[];
    return out;
};

export const keepTouched = (stored: Prefs, current: Prefs, start: Prefs): Prefs => {
    const merged = { ...stored } as Record<string, unknown>;
    const now = current as unknown as Record<string, unknown>;
    const then = start as unknown as Record<string, unknown>;
    for (const key of Object.keys(now)) {
        // By value: a restore hands out new arrays and objects, and a new array holding the same
        // packs is not a change anybody made.
        if (JSON.stringify(now[key]) !== JSON.stringify(then[key])) merged[key] = now[key];
    }
    // The install hint's history is counted, not chosen: neither side simply wins.
    merged.install = mergeInstallHint(stored.install, current.install);
    // The installed regions by region, not as one value: a region installed from a link while
    // the store was still being read must not throw away every region the store holds.
    merged.packs = mergePacks(stored.packs, current.packs, start.packs);
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
