/**
 * The filters and the sort of the crag list.
 *
 * Pure: the old `test()` wrote its findings onto the crag it was judging (`_rhit`, `_in`, `_top`)
 * so that the list renderer could read them afterwards. Here they come back as part of the result,
 * so nothing is mutated and the same crag can be judged against two filter sets at once.
 *
 * Every stored value is checked when it is read, so a filter state left over from an older version
 * can never hide everything by accident.
 */

import type { Orientation } from "@domain/mappack";
import type { Crag, Route } from "@domain/model";

import { GRADE_HI, GRADE_LO, GRADES, type Grade } from "./grades";
import { PREVIEW_SUFFIX } from "./preview";
import { fold } from "./text";

export const ORIENTS: readonly Orientation[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** The allowed values of every one-of filter. Anything else falls back to the default. */
export const FILTER_VALUES = {
    fav: ["any", "crags", "routes"],
    star: ["any", "3", "4", "5"],
    log: ["any", "todo", "done"],
    pic: ["any", "pic", "topo", "link"],
    walk: ["any", "5", "10", "20", "30", "30+", "unknown"],
    count: ["any", "10", "20", "30", "50"],
    style: ["any", "sport", "mixed"],
    rain: ["any", "yes", "no"],
    dry: ["any", "fast", "ok"],
    len: ["any", "20", "30", "40", "40+"],
    wx: ["any", "dry", "ok"],
    bolt: ["any", "close", "spaced", "notSpaced"],
    boltC: ["any", "new", "notOld"],
} as const;

export type FilterKey = keyof typeof FILTER_VALUES;
type ValueOf<K extends FilterKey> = (typeof FILTER_VALUES)[K][number];

export const FILTER_FLAGS = ["hideClosure", "hideCaution", "hideNoFamily", "onlyMapped"] as const;
export type FilterFlag = (typeof FILTER_FLAGS)[number];

/** How many matching routes a crag needs before it is shown. */
export const MIN_IN_CHOICES = [1, 3, 5, 10] as const;

export interface Filters {
    fav: ValueOf<"fav">;
    star: ValueOf<"star">;
    log: ValueOf<"log">;
    pic: ValueOf<"pic">;
    walk: ValueOf<"walk">;
    count: ValueOf<"count">;
    style: ValueOf<"style">;
    rain: ValueOf<"rain">;
    dry: ValueOf<"dry">;
    len: ValueOf<"len">;
    wx: ValueOf<"wx">;
    bolt: ValueOf<"bolt">;
    boltC: ValueOf<"boltC">;
    /** Free text over the crag names and, failing that, the route names. */
    q: string;
    gmin: number;
    gmax: number;
    minIn: number;
    orient: ReadonlySet<string>;
    area: string;
    /** A municipality name, or `?` for the crags that name none. */
    muni: string;
    conf: ReadonlySet<string>;
    hideClosure: boolean;
    hideCaution: boolean;
    hideNoFamily: boolean;
    onlyMapped: boolean;
}

export const emptyFilters = (): Filters => ({
    fav: "any",
    star: "any",
    log: "any",
    pic: "any",
    q: "",
    gmin: GRADE_LO,
    gmax: GRADE_HI,
    minIn: 1,
    orient: new Set(),
    walk: "any",
    count: "any",
    style: "any",
    area: "",
    muni: "",
    conf: new Set(),
    hideClosure: false,
    hideCaution: false,
    hideNoFamily: false,
    onlyMapped: false,
    rain: "any",
    dry: "any",
    len: "any",
    wx: "any",
    bolt: "any",
    boltC: "any",
});

export const SORTS = [
    "area",
    "name",
    "match",
    "gmin",
    "gmax",
    "n",
    "walk",
    "len",
    "orient",
    "rate",
    "me",
    "nr",
] as const;
export type SortKey = (typeof SORTS)[number];

/** The grade presets of the filter bar: `[from|to, label]`. */
export const GRADE_PRESETS: readonly (readonly [from: Grade, to: Grade, label: string])[] = [
    ["3a", "4c+", "3–4"],
    ["5a", "5c+", "5a–5c"],
    ["6a", "6c+", "6a–6c"],
    ["7a", "7c+", "7a–7c"],
    ["8a", "9a", "8a+"],
];

/** What the filters need to know that is not in the crag itself. */
export interface FilterContext {
    /** Favourite crag ids. */
    readonly favCrags: ReadonlySet<string>;
    /** Favourite route keys. */
    readonly favRoutes: ReadonlySet<string>;
    /** Route keys that have a send in the logbook. */
    readonly sent: ReadonlySet<string>;
    /** Dry/ok for a crag from the rain model, or null when no forecast is loaded. */
    readonly wxState?: (crag: Crag) => "dry" | "wet" | null;
    /** Place of an area group in the region's list, for the default sort. */
    readonly areaIndex?: Readonly<Record<string, number>>;
    /** Distance in m from the viewer, for the «nearest to me» sort. */
    readonly distance?: (crag: Crag) => number | null;
}

/** What judging one crag found out. */
export interface CragMatch {
    readonly crag: Crag;
    /** The search text matched a route name, not the crag's own names. */
    readonly routeHit: boolean;
    /** How many of its routes pass the route filters, or null when none are active. */
    readonly inCount: number | null;
    /** The three best-rated matching routes, shown on the card. */
    readonly top: readonly Route[] | null;
}

export const gradeActive = (f: Filters): boolean => f.gmin > GRADE_LO || f.gmax < GRADE_HI;

/** True when any filter judges single routes rather than whole crags. */
export const routeFilterOn = (f: Filters): boolean =>
    gradeActive(f) || f.star !== "any" || f.fav === "routes" || f.log !== "any";

/**
 * How many matching routes a crag needs before it is shown.
 *
 * «At least n such routes» belongs to grade and stars only: those describe what you want to climb,
 * so asking for several of them is meaningful. With «my logbook» or «favourite routes» it is not --
 * one unclimbed route is reason enough for the crag to appear -- so there the floor stays 1.
 */
export const minNeeded = (f: Filters): number =>
    gradeActive(f) || f.star !== "any" ? Math.max(1, f.minIn) : 1;

/** Does one route pass the route filters? */
export const routeOk = (route: Route, f: Filters, ctx: FilterContext): boolean => {
    if (gradeActive(f)) {
        if (route.gradeIdx == null) return false;
        if (route.gradeIdx < f.gmin || route.gradeIdx > f.gmax) return false;
    }
    if (f.star !== "any") {
        const stars = route.stars?.[0];
        if (stars == null || stars < Number(f.star)) return false;
    }
    if (f.fav === "routes" && !ctx.favRoutes.has(route.key)) return false;
    if (f.log === "todo" && ctx.sent.has(route.key)) return false;
    if (f.log === "done" && !ctx.sent.has(route.key)) return false;
    return true;
};

const walkOk = (walkEff: number | null, f: Filters): boolean => {
    if (f.walk === "any") return true;
    if (f.walk === "unknown") return walkEff == null;
    if (walkEff == null) return false;
    if (f.walk === "30+") return walkEff > 30;
    return walkEff <= Number(f.walk);
};

const lenOk = (lenMax: number | null, f: Filters): boolean => {
    if (f.len === "any") return true;
    if (lenMax == null) return false;
    return f.len === "40+" ? lenMax > 40 : lenMax <= Number(f.len);
};

const boltOk = (crag: Crag, f: Filters): boolean => {
    const spaced = crag.boltSp === "spaced" || crag.boltSp === "part";
    if (f.bolt === "close" && crag.boltSp !== "close" && crag.boltSp !== "good") return false;
    if (f.bolt === "spaced" && !spaced) return false;
    if (f.bolt === "notSpaced" && spaced) return false;
    if (f.boltC === "new" && crag.boltC !== "new") return false;
    if (f.boltC === "notOld" && (crag.boltC === "old" || crag.boltC === "part")) return false;
    return true;
};

const orientOk = (crag: Crag, f: Filters): boolean => {
    if (!f.orient.size) return true;
    if (crag.oriKey && f.orient.has(crag.oriKey)) return true;
    if (crag.oriKey === "unknown") return false;
    return crag.orient.some((o) => f.orient.has(o));
};

/** Judge one crag. Returns null when it is filtered out. */
export const judge = (crag: Crag, f: Filters, ctx: FilterContext): CragMatch | null => {
    if (f.fav === "crags" && !ctx.favCrags.has(crag.id)) return null;

    const q = fold(f.q.trim());
    let routeHit = false;
    if (q) {
        const inName = crag.hay.includes(q);
        const inRoute = Boolean(crag.rhay?.some((r) => r.includes(q)));
        routeHit = !inName && inRoute;
        if (!inName && !inRoute) return null;
    }

    let inCount: number | null = null;
    let top: readonly Route[] | null = null;

    if (routeFilterOn(f)) {
        if (crag.routes.length) {
            let n = 0;
            const rated: Route[] = [];
            for (const route of crag.routes) {
                if (!routeOk(route, f, ctx)) continue;
                // With a search text that only matched route names, narrow to those routes too.
                if (q && routeHit && !fold(route.name).includes(q)) continue;
                n++;
                if (route.stars) rated.push(route);
            }
            if (n < minNeeded(f)) return null;
            inCount = n;
            if (rated.length && (gradeActive(f) || f.star !== "any")) {
                top = rated
                    .slice()
                    .sort(
                        (a, b) =>
                            (b.stars?.[0] ?? 0) - (a.stars?.[0] ?? 0) ||
                            (b.stars?.[1] ?? 0) - (a.stars?.[1] ?? 0),
                    )
                    .slice(0, 3);
            }
        } else {
            // A crag with no route list: judged on what it says about itself.
            if (f.star !== "any" || f.fav === "routes" || f.log === "done") return null;
            if (gradeActive(f)) {
                if (crag.gminI == null) return null;
                if ((crag.gmaxI ?? crag.gminI) < f.gmin || crag.gminI > f.gmax) return null;
            }
        }
    }

    if (f.pic === "pic" && !crag.pics.length) return null;
    if (f.pic === "topo" && !crag.topoPic) return null;
    if (f.pic === "link" && !(crag.topoPic || crag.topoLink)) return null;
    if (!orientOk(crag, f)) return null;
    if (!walkOk(crag.walkEff, f)) return null;
    if (f.rain !== "any" && crag.rain !== f.rain) return null;
    if (f.wx !== "any" && ctx.wxState) {
        const state = ctx.wxState(crag);
        if (!state) return null;
        // «also fine» lets a crag through that is sheltered from the rain.
        if (state !== "dry" && !(f.wx === "ok" && crag.rain === "yes")) return null;
    }
    if (f.dry === "fast" && crag.dry !== "fast") return null;
    if (f.dry === "ok" && crag.dry !== "fast" && crag.dry !== "mid") return null;
    if (!lenOk(crag.lenMax, f)) return null;
    // «at least n routes in the crag»
    if (f.count !== "any" && (crag.nRoutes == null || crag.nRoutes < Number(f.count))) return null;
    if (!boltOk(crag, f)) return null;
    if (f.style !== "any" && crag.styleKey !== f.style) return null;
    if (f.area && crag.area !== f.area) return null;
    if (f.muni) {
        if (f.muni === "?") {
            if (crag.municipality) return null;
        } else if (crag.municipality !== f.muni) return null;
    }
    if (f.conf.size && !(crag.confidence && f.conf.has(crag.confidence))) return null;
    if (f.hideClosure && crag.closure) return null;
    if (f.hideCaution && crag.caution) return null;
    if (f.hideNoFamily && crag.noFamily) return null;
    if (f.onlyMapped && (!crag.coord || crag.anchor)) return null;

    return { crag, routeHit, inCount, top };
};

/** The value a crag sorts by, or null when it has none -- those go last, whichever way round. */
export const sortValue = (
    match: CragMatch,
    sort: SortKey,
    f: Filters,
    ctx: FilterContext,
): number | string | null => {
    const s = match.crag;
    switch (sort) {
        case "name":
            return fold(s.name);
        case "match":
            return match.inCount ?? (routeFilterOn(f) ? null : s.routes.length || null);
        case "gmin":
            return s.gminI;
        case "gmax":
            return s.gmaxI;
        case "n":
            return s.nRoutes;
        case "walk":
            return s.walkEff;
        case "len":
            return s.lenMax;
        case "orient":
            if (s.orient.length >= 4) return 8;
            return s.orient.length ? ORIENTS.indexOf(s.orient[0]!) : null;
        case "rate":
            return s.rate?.avg ?? null;
        case "me":
            return ctx.distance?.(s) ?? null;
        case "nr":
            return s.nr;
        default:
            // Grouped by area, then by the crag's number inside it.
            return (ctx.areaIndex?.[s.area] ?? 0) * 1000 + (s.nr ?? 900);
    }
};

/** Filter and sort the whole list. Equal values, and missing ones, fall back to the name. */
export const applyFilters = (
    crags: readonly Crag[],
    f: Filters,
    sort: SortKey,
    dir: 1 | -1,
    ctx: FilterContext,
): CragMatch[] => {
    const shown: CragMatch[] = [];
    for (const crag of crags) {
        const match = judge(crag, f, ctx);
        if (match) shown.push(match);
    }
    return shown.sort((a, b) => {
        const x = sortValue(a, sort, f, ctx);
        const y = sortValue(b, sort, f, ctx);
        const byName = fold(a.crag.name) < fold(b.crag.name) ? -1 : 1;
        if (x == null && y == null) return byName;
        if (x == null) return 1;
        if (y == null) return -1;
        if (x < y) return -dir;
        if (x > y) return dir;
        return byName;
    });
};

// ---- storing the filter state

/**
 * Filters and sort are one preference for the whole app, kept on this device. Both names are
 * suffixed in a pull request preview, which shares the host with the app: see preview.ts.
 */
export const FILTER_KEY = `finale-atlas-filters-v2${PREVIEW_SUFFIX}`;
/** Before that there was one set per region; the region last shown is taken over. */
export const FILTER_KEY_V1 = `finale-atlas-filters-v1${PREVIEW_SUFFIX}`;

export interface StoredFilters {
    F?: Record<string, unknown>;
    sort?: string;
    dir?: number;
}

/** What goes into localStorage: grades as their names, so the ladder may grow without breaking it. */
export const toStored = (f: Filters, sort: SortKey, dir: 1 | -1): StoredFilters => ({
    F: {
        fav: f.fav,
        star: f.star,
        log: f.log,
        pic: f.pic,
        walk: f.walk,
        count: f.count,
        style: f.style,
        rain: f.rain,
        dry: f.dry,
        len: f.len,
        wx: f.wx,
        bolt: f.bolt,
        boltC: f.boltC,
        gmin: GRADES[f.gmin],
        gmax: GRADES[f.gmax],
        minIn: f.minIn,
        orient: [...f.orient],
        conf: [...f.conf],
        area: f.area,
        muni: f.muni,
        hideClosure: f.hideClosure,
        hideCaution: f.hideCaution,
        hideNoFamily: f.hideNoFamily,
        onlyMapped: f.onlyMapped,
    },
    sort,
    dir,
});

export interface RestoreContext {
    /** Area names that exist in the data right now. */
    readonly areas: ReadonlySet<string>;
    /** Municipality names that exist right now. */
    readonly municipalities: ReadonlySet<string>;
}

/**
 * Read a stored state back. Every value is checked, and anything unrecognised keeps its default --
 * a state written by an older version must not be able to hide the whole list.
 */
export const fromStored = (
    stored: StoredFilters | null | undefined,
    ctx: RestoreContext,
): { filters: Filters; sort: SortKey; dir: 1 | -1 } => {
    const filters = emptyFilters();
    let sort: SortKey = "area";
    let dir: 1 | -1 = 1;

    const x = stored?.F;
    if (!x) return { filters, sort, dir };

    for (const key of Object.keys(FILTER_VALUES) as FilterKey[]) {
        const allowed: readonly string[] = FILTER_VALUES[key];
        const value = x[key];
        if (typeof value === "string" && allowed.includes(value)) {
            // Safe: `value` was just checked against this key's own list.
            (filters as unknown as Record<string, unknown>)[key] = value;
        }
    }
    for (const key of FILTER_FLAGS) {
        if (typeof x[key] === "boolean") filters[key] = x[key];
    }

    const a = GRADES.indexOf(x.gmin as Grade);
    const b = GRADES.indexOf(x.gmax as Grade);
    if (a >= GRADE_LO && b <= GRADE_HI && a >= 0 && b >= 0 && a <= b) {
        filters.gmin = a;
        filters.gmax = b;
    }
    if (MIN_IN_CHOICES.includes(x.minIn as (typeof MIN_IN_CHOICES)[number])) {
        filters.minIn = x.minIn as number;
    }
    if (Array.isArray(x.orient)) {
        filters.orient = new Set(
            (x.orient as unknown[]).filter(
                (o): o is string =>
                    typeof o === "string" &&
                    (ORIENTS.includes(o as Orientation) || o === "mixed" || o === "unknown"),
            ),
        );
    }
    // The reliability filter was dropped; a stored one is ignored rather than restored.
    filters.conf = new Set();
    if (typeof x.area === "string" && ctx.areas.has(x.area)) filters.area = x.area;
    if (x.muni === "?" || (typeof x.muni === "string" && ctx.municipalities.has(x.muni))) {
        filters.muni = x.muni;
    }
    // «nearest to me» needs a fresh location, so it is never restored.
    if (SORTS.includes(stored.sort as SortKey) && stored.sort !== "me") {
        sort = stored.sort as SortKey;
    }
    if (stored.dir === -1) dir = -1;

    return { filters, sort, dir };
};

/** How many filters the viewer has set, for the badge on the filter button. */
export const activeCount = (f: Filters): number => {
    let n = 0;
    for (const key of Object.keys(FILTER_VALUES) as FilterKey[]) {
        if (f[key] !== "any") n++;
    }
    for (const key of FILTER_FLAGS) if (f[key]) n++;
    if (gradeActive(f)) n++;
    if (f.orient.size) n++;
    if (f.conf.size) n++;
    if (f.area) n++;
    if (f.muni) n++;
    // The search text is deliberately not counted: it has its own field in the app bar, and the
    // badge is about what the filter drawer is hiding.
    return n;
};

/**
 * One sentence saying what the route criteria mean together.
 *
 * «Shows crags with at least 3 routes: 6a to 6c+ · ★★★★ or more.» The original built this in
 * `routeSummary` (index.html:2847) so that the combination of filters -- which is easy to set and
 * hard to read back off a row of chips -- is stated in words. Empty when no route filter is on.
 *
 * The texts are passed in rather than imported: `@core` knows nothing about i18next.
 */
export const routeSummary = (
    f: Filters,
    t: (key: string, values?: Record<string, unknown>) => string,
): string => {
    if (!routeFilterOn(f)) return "";

    const parts: string[] = [];
    if (gradeActive(f)) {
        parts.push(
            f.gmin === f.gmax
                ? t("sum.grade1", { 0: GRADES[f.gmin] })
                : t("sum.grade", { 0: GRADES[f.gmin], 1: GRADES[f.gmax] }),
        );
    }
    if (f.star !== "any") {
        const stars = "★".repeat(Number(f.star));
        parts.push(f.star === "5" ? t("sum.star5", { 0: stars }) : t("sum.star", { 0: stars }));
    }
    if (f.fav === "routes") parts.push(t("sum.fav"));
    if (f.log !== "any") parts.push(t(f.log === "todo" ? "sum.todo" : "sum.done"));

    const need = minNeeded(f);
    return t(need === 1 ? "sum.one" : "sum.many", { 0: need, 1: parts.join(t("sum.and")) });
};
