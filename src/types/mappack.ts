/**
 * The *stored* shape of a mappack, mirroring mappack.schema.json by hand.
 *
 * The schema stays the single source of truth at runtime: src/core/packs/validate.ts compiles it
 * with Ajv and every pack is validated against it before it is mounted, and CI checks the packs in
 * maps/ against it too. These types are the compile-time view of the same thing, and
 * src/types/mappack.coverage.test.ts fails if the schema grows a field this file does not mention.
 *
 * Written by hand on purpose: the schema is JSON Schema 2020-12 and describes routes and pictures
 * with `prefixItems`, which json-schema-to-typescript does not understand -- it turns both into
 * `[unknown, unknown, ...]`, which is precisely the part that needs to be typed.
 *
 * `additionalProperties: true` throughout the schema is deliberate forward compatibility ("an older
 * app ignores fields it does not know"). That is a runtime property: Ajv lets unknown fields pass.
 * It is not expressed as an index signature here, because that would widen every property access.
 *
 * What the app works with after mounting a pack is in src/types/model.ts.
 */

/** Every text that reaches the screen comes in both languages. */
export interface I18nText {
    en: string;
    de: string;
}

/** `YYYY-MM-DD`. */
export type IsoDate = string;

export type Precision = "pin" | "approx" | "anchor";
export type ApproachQuality = "ok" | "gap" | "detour";
export type PicKind = "photo" | "topo" | "sketch" | "approach";
export type PicContent = "named" | "people" | "plain";
export type RouteOrder = "tc" | "tcp" | "vl";
export type StyleKey = "sport" | "mixed";
export type Orientation = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type SunWindow = "all" | "am" | "pm" | "noon" | "none";
export type RainShelter = "yes" | "no";
export type DrySpeed = "fast" | "mid" | "slow";
export type DryHow = "est" | "src";
export type BoltSpacing = "close" | "good" | "part" | "spaced";
export type BoltCondition = "new" | "old" | "part";
export type WalkHow = "src" | "calc";
export type Confidence = "High" | "Medium" | "Low" | "Unverified";

/**
 * A route as a pack stores it: `[name, grade, pitches, gradeIdx]`.
 *
 * `minItems: 4` with no maximum, so a newer pack may append. The app does not read a stored route
 * positionally beyond this -- src/core/packs/mount.ts turns it into a named `Route` at once.
 */
export type StoredRoute = [
    name: string,
    grade: string | null,
    /** 0 or null where no source says how many; the app then says nothing about pitches. */
    pitches: number | null,
    /** Place in the app's grade ladder, or null for a grade it does not know. */
    gradeIdx: number | null,
    ...rest: unknown[],
];

/**
 * A picture, exactly ten entries. A `0` stands for "none" in the slots that allow it, and the
 * `picSrc` index points into the pack's `picSrc` array.
 */
export type Pic = [
    url: string,
    altUrl: string | 0,
    pageUrl: string,
    picSrcIndex: number,
    kind: PicKind,
    wholeCrag: number | boolean,
    caption: string | 0,
    author: string | 0,
    licence: string | 0,
    content: PicContent,
];

export interface Coord {
    lat: number;
    lon: number;
    precision?: Precision;
    added?: boolean;
}

export interface Approach {
    /** Key into the pack's `parks`. */
    pk: string;
    /** Distance in m. */
    d?: number;
    up?: number;
    down?: number;
    /** Walking time in minutes. */
    t?: number;
    gap?: number;
    straight?: number;
    /** Encoded polyline. */
    line: string;
    q?: ApproachQuality;
    alt?: boolean;
}

export interface Area {
    name: string;
    /** Number of crags, filled in by tools/make-packs.sh. */
    n?: number;
    tcUrl?: string;
    reg?: string;
}

export interface Park {
    name: string;
    nameDe?: string | null;
    lat: number;
    lon: number;
    /** Position is an estimate. */
    est?: boolean | null;
    note?: string | null;
    noteDe?: string | null;
    /** Capacity. */
    n?: number | null;
}

/** A wall inside a crag: its name and the index of its first route. */
export interface SectorPart {
    n: string;
    i: number;
}

/** Community ratings for a crag. */
export interface Rating {
    avg?: number;
    n?: number;
    top?: number;
    asc?: number;
}

/** Bolting, only where a source says it outright. */
export interface Bolting {
    sp?: BoltSpacing;
    c?: BoltCondition;
    /** The wording, as `[route or empty, English, German]`. */
    q?: [route: string, en: string, de: string][];
}

/** What an outside route database holds for a crag. */
export interface ExternalCrag {
    name: string;
    routes?: number | null;
    height?: number | null;
}

export interface NamedLink {
    name: string;
    url: string;
}

/**
 * Links of a crag: `t`/`c` topo and crag pages, `o` official, `f` photos, `g` gallery, `l` list,
 * `p` pdf, `r` route list, `w` further web pages.
 */
export interface SectorLinks {
    w?: NamedLink[];
    [key: string]: string | NamedLink[] | undefined;
}

/** A crag. The schema calls it a sector; the app calls it a crag («Gebiet»). */
export interface StoredSector {
    id: string;
    name: string;
    /** Must name one of the pack's `areas`. */
    area: string;
    routes: StoredRoute[];

    locality?: string;
    full?: string;
    nr?: number | null;
    nrInferred?: boolean | null;
    status?: string | null;
    reg?: string;
    region?: string;
    municipality?: string | null;
    province?: string | null;

    coord?: Coord | null;
    coordDropped?: boolean | null;
    alt?: number | null;

    gmin?: string | null;
    gmax?: string | null;
    gminI?: number | null;
    gmaxI?: number | null;
    nRoutes?: number | null;
    nSingle?: number | null;
    nMulti?: number | null;
    /** Routes per grade band, five entries, same bands as the bar chart. */
    bands?: [number, number, number, number, number] | null;

    /** Route keys from before the list was reordered, so favourites and logbook stay attached. */
    rk?: (string | null)[] | null;
    /** Length per route in m, parallel to `routes`. */
    rl?: (number | null)[] | null;
    /** Community stars per route: `[stars, number of ratings]`. */
    st?: ([stars: number, votes: number] | null)[] | null;
    ord?: RouteOrder;
    secs?: SectorPart[] | null;
    rate?: Rating | null;

    style?: string;
    styleKey?: StyleKey;
    rock?: string | null;
    rockDe?: string | null;
    orient?: Orientation[];
    /** Route lengths of the crag in m: `[shortest, longest]`. */
    len?: [number | null, number | null] | null;
    lenIsMax?: boolean | null;
    lenIsTypical?: boolean | null;

    season?: string | null;
    seasonDe?: string | null;
    sun?: SunWindow | null;
    sunWhole?: boolean | null;
    rain?: RainShelter | null;
    dry?: DrySpeed | null;
    dryHow?: DryHow;
    dryWhy?: string[];
    dryNote?: string | null;
    dryNoteDe?: string | null;
    bolt?: Bolting | null;

    /** Keys into the pack's `parks`. */
    pk?: string | null;
    pkAssumed?: boolean | null;
    pkOff?: string | null;
    park?: string | null;
    parkDe?: string | null;
    walk?: string | null;
    walkDe?: string | null;
    walkMin?: number | null;
    walkEff?: number | null;
    walkHow?: WalkHow | null;
    ap?: Approach[] | null;

    desc?: string | null;
    descDe?: string | null;
    warn?: string | null;
    warnDe?: string | null;
    rnote?: string | null;
    rnoteDe?: string | null;
    family?: string | null;
    pt?: string | null;
    guide?: string | null;
    confidence?: Confidence;

    tcOnly?: boolean | null;
    tc?: ExternalCrag | null;
    links?: SectorLinks | null;
    pics?: Pic[] | null;
}

/** Exactly one of `h`, `p`, `hint` or `ul`. */
export interface Block {
    h?: I18nText;
    p?: I18nText;
    hint?: I18nText;
    ul?: I18nText[];
}

export interface Page {
    /** `topos` is linked from the crag pages; any other id only appears under «More». */
    id: string;
    title: I18nText;
    blocks: Block[];
}

export interface LinkLabel {
    label?: I18nText;
    note?: I18nText;
}

export interface FactGroup {
    key: string;
    en?: string;
    de?: string;
}

export interface Fact {
    en: string;
    de: string;
    group?: string;
    /** Where the fact comes from. */
    src?: string;
    url?: string;
    /** `[crag name, route name]`, a jump target. */
    go?: [crag: string, route: string];
}

export interface Facts {
    groups?: FactGroup[];
    items?: Fact[];
}

export interface GlossaryItem {
    term: string;
    en: string;
    de: string;
}

export interface Glossary {
    title?: I18nText;
    hint?: I18nText;
    /** Language tag of the terms, e.g. «it», so that screen readers pronounce them. */
    lang?: string;
    items?: GlossaryItem[];
}

/** Everything the app would otherwise have to know about a region. All of it optional. */
export interface PackText {
    rock?: I18nText;
    guide?: I18nText;
    noPics?: I18nText;
    guideRef?: I18nText;
    licence?: I18nText;
    /** Keyed like `sector.links`, plus `tc` for the area link. */
    links?: Record<string, LinkLabel>;
    pages?: Page[];
    facts?: Facts;
    glossary?: Glossary;
}

export interface MapView {
    /** `[lat, lon]`. */
    center: [number, number];
    zoom?: number;
}

export interface PackCounts {
    crags?: number;
    routes?: number;
    areas?: number;
    parks?: number;
    [key: string]: number | undefined;
}

export interface MapLabel {
    name: string;
    lat: number;
    lon: number;
}

/** GeoJSON FeatureCollection drawn under the tiles. */
export interface Outline {
    type: "FeatureCollection";
    features: Record<string, unknown>[];
}

export const PACK_FORMAT = "chlaedderi-mappack";
export const PACK_FORMAT_VERSION = 1;

/** One climbing region: crags, their routes, the car parks, the area groups and the metadata. */
export interface Mappack {
    format: typeof PACK_FORMAT;
    formatVersion: typeof PACK_FORMAT_VERSION;
    /** `^[a-z0-9][a-z0-9-]{0,31}$`, unique across the packs a user has loaded. */
    id: string;
    name: I18nText;
    version: string;
    sectors: StoredSector[];

    fullName?: I18nText;
    accessed?: IsoDate;
    updated?: IsoDate;
    /** A showcase: only a part of the region. */
    partial?: boolean;
    /** Switzerland: swisstopo maps, trails and MeteoSwiss apply. */
    ch?: boolean;
    /** Invented crags: the app marks every screen and withholds navigation. */
    fictional?: boolean;
    text?: PackText;
    view?: MapView;
    /** `[south, west, north, east]`. */
    bbox?: number[];
    counts?: PackCounts;
    areas?: Area[];
    /** Car parks, keyed by the id used in `sector.pk`, `sector.pkOff` and `sector.ap[].pk`. */
    parks?: Record<string, Park>;
    picSrc?: string[];
    labels?: MapLabel[];
    outline?: Outline;
    /** Coverage numbers, free-form; the app computes what it shows itself. */
    stats?: Record<string, unknown>;
    /** German for short English strings in the data that have no «…De» twin. */
    de?: Record<string, string>;
    /** A sentence about the pack, shown while it is being installed. */
    notes?: I18nText;
}
