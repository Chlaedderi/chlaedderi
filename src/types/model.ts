/**
 * What the app works with once a pack is mounted.
 *
 * A pack stores a route as a four-item tuple and leaves the rest to the app; the old code then
 * assigned the derived values back into the tuple (`r[4]` key, `r[5]`/`r[6]` stars, `r[8]` length,
 * `r[9]` ordinal) and set a dozen fields on the crag object in place. Here those become named,
 * read-only fields computed once in src/core/packs/mount.ts, so nothing mutates shared state and
 * React and Redux can rely on identity.
 */

import type {
    Approach,
    Area,
    Bolting,
    Confidence,
    Coord,
    DryHow,
    DrySpeed,
    ExternalCrag,
    I18nText,
    MapLabel,
    Orientation,
    Outline,
    PackText,
    Park,
    Pic,
    Rating,
    RainShelter,
    RouteOrder,
    SectorLinks,
    SectorPart,
    StyleKey,
    SunWindow,
    WalkHow,
} from "./mappack";

/** Which end of the grade range a crag mostly sits at. Drives the colour of its marker. */
export type GradeClass = "easy" | "mid" | "hard" | "unk";

export interface Route {
    readonly name: string;
    readonly grade: string | null;
    /** 0 or null in the pack means "no source says"; the app then says nothing about pitches. */
    readonly pitches: number | null;
    /** Index into the grade ladder, or null for a grade the app does not know. */
    readonly gradeIdx: number | null;
    /** `<cragId>~<slug>`. Stable across a reordering of the list, so logbook entries stay attached. */
    readonly key: string;
    /** Community stars, `[stars, votes]`. */
    readonly stars: readonly [stars: number, votes: number] | null;
    /** Length in m. */
    readonly length: number | null;
    /** Place in the crag's route list. */
    readonly ord: number;
}

export interface Crag {
    readonly id: string;
    readonly name: string;
    readonly area: string;
    readonly routes: readonly Route[];

    /** Which pack this crag came from. */
    readonly packId: string;

    readonly locality: string | null;
    readonly full: string | null;
    readonly nr: number | null;
    readonly nrInferred: boolean;
    readonly status: string | null;
    readonly region: string | null;
    readonly municipality: string | null;
    readonly province: string | null;

    readonly coord: Coord | null;
    readonly coordDropped: boolean;
    readonly lat: number | null;
    readonly lon: number | null;
    readonly alt: number | null;

    readonly gmin: string | null;
    readonly gmax: string | null;
    readonly gminI: number | null;
    readonly gmaxI: number | null;
    readonly nRoutes: number | null;
    readonly nSingle: number | null;
    readonly nMulti: number | null;
    readonly bands: readonly [number, number, number, number, number] | null;

    readonly ord: RouteOrder | null;
    readonly secs: readonly SectorPart[] | null;
    readonly rate: Rating | null;

    readonly style: string | null;
    readonly styleKey: StyleKey | null;
    readonly rock: string | null;
    readonly rockDe: string | null;
    readonly orient: readonly Orientation[];
    readonly len: readonly [number | null, number | null] | null;
    readonly lenIsMax: boolean;
    readonly lenIsTypical: boolean;

    readonly season: string | null;
    readonly seasonDe: string | null;
    readonly sun: SunWindow | null;
    readonly sunWhole: boolean;
    readonly rain: RainShelter | null;
    readonly dry: DrySpeed | null;
    readonly dryHow: DryHow | null;
    readonly dryWhy: readonly string[];
    readonly dryNote: string | null;
    readonly dryNoteDe: string | null;
    readonly bolt: Bolting | null;

    readonly pk: string | null;
    readonly pkAssumed: boolean;
    readonly pkOff: string | null;
    readonly park: string | null;
    readonly parkDe: string | null;
    readonly walk: string | null;
    readonly walkDe: string | null;
    readonly walkMin: number | null;
    readonly walkEff: number | null;
    /** Whether the walking time was stated by a source or computed from the car park. */
    readonly walkHow: WalkHow | null;
    readonly ap: readonly Approach[];

    readonly desc: string | null;
    readonly descDe: string | null;
    readonly warn: string | null;
    readonly warnDe: string | null;
    readonly rnote: string | null;
    readonly rnoteDe: string | null;
    readonly family: string | null;
    readonly pt: string | null;
    readonly guide: string | null;
    readonly confidence: Confidence | null;

    readonly tcOnly: boolean;
    readonly tc: ExternalCrag | null;
    readonly links: SectorLinks | null;
    readonly pics: readonly Pic[];

    // ---- derived, what prepCrag() used to set in place
    /** A confirmed ban. */
    readonly closure: boolean;
    /** Something in the warning needs care, or a ban nobody has confirmed. */
    readonly caution: boolean;
    /** The warning says it is *not* suitable for families. */
    readonly noFamily: boolean;
    readonly cls: GradeClass;
    /** The crag's name in an outside database, when it differs. */
    readonly aka: string | null;
    /** Folded haystack of the names, for the free-text filter. */
    readonly hay: string;
    /** Folded route names, or null when the crag has no route list. */
    readonly rhay: readonly string[] | null;
    /** "unknown" with no orientation, "mixed" with four or more, else null. */
    readonly oriKey: "unknown" | "mixed" | null;
    readonly lenMax: number | null;
    /** The crag has a picture that is a topo or a sketch. */
    readonly topoPic: boolean;
    /** The crag has an official page, a photo page or a pdf. */
    readonly topoLink: boolean;
    /** The wall itself is not located: the marker stands by the car park. */
    readonly anchor: boolean;
    readonly boltSp: Bolting["sp"] | null;
    readonly boltC: Bolting["c"] | null;
    /** Community stars per grade band, `[sum, rated routes]` for each of the five. */
    readonly bandStars: readonly (readonly [sum: number, rated: number])[] | null;
}

/** One mounted region. The pack's own words travel with it; the app knows none of them. */
export interface Region {
    readonly key: string;
    readonly name: I18nText;
    readonly fullName: I18nText | null;
    readonly version: string;
    readonly accessed: string | null;
    readonly updated: string | null;
    readonly partial: boolean;
    /** Switzerland: swisstopo maps and trails, MeteoSwiss weather. */
    readonly ch: boolean;
    readonly text: PackText;
    readonly view: { readonly center: readonly [number, number]; readonly zoom: number } | null;
    readonly bbox: readonly number[] | null;
    readonly labels: readonly MapLabel[];
    readonly outline: Outline | null;
    readonly stats: Readonly<Record<string, unknown>>;
    readonly de: Readonly<Record<string, string>>;
    readonly picSrc: readonly string[];
    readonly areas: readonly Area[];
    readonly parks: Readonly<Record<string, Park>>;
    /** Number of crags. */
    readonly n: number;
    /** Where this pack's pictures start in the joined picSrc list of the mounted set. */
    readonly picOffset: number;
}

/** Everything the mounted packs add up to. */
export interface MountedData {
    readonly crags: readonly Crag[];
    readonly regions: readonly Region[];
    /** Car parks of every region, keyed as the crags refer to them. */
    readonly parks: Readonly<Record<string, Park>>;
    readonly byId: Readonly<Record<string, Crag>>;
    /** The picSrc lists of every mounted pack, joined; pic[3] indexes into this. */
    readonly picSrc: readonly string[];
}
