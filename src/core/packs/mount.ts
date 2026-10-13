/**
 * Turning a pack as it is stored into what the app works with.
 *
 * The old `prepCrag()` ran once per crag when its pack was loaded and wrote its results back into
 * the same objects -- derived fields onto the crag, and the route key, stars, length and ordinal
 * into free slots of the stored route tuple. That is replaced here by a single pass that builds new
 * objects, so the mounted data is immutable and React and Redux can rely on identity.
 */

import { bandOf, classOf } from "@core/grades";
import { fold, slug } from "@core/text";
import type { Bolting, Mappack, Park, StoredRoute, StoredSector } from "@domain/mappack";
import type { Crag, MountedData, Region, Route } from "@domain/model";

/** A confirmed ban. */
const RX_CLOSURE = /CLOSURE|nesting|banned|prohibited|not permitted|closed because|closed for/i;
/** A ban nobody has confirmed: a warning, not a closure. */
const RX_MAYBE = /unconfirmed|not confirmed|is said to apply|may apply/i;
const RX_FAMILY = /famil|children|kids|animals|pets/i;
const RX_CAUTION =
    /dangerous|abandon|outdated|old (and )?(dangerous|bolt|peg|equipment)|poorly maintained|re-bolt|restyling|dated bolt|not well bolted|sparse|weakness|rockfall|loose/i;
// «unsuitable», «unsafe», «unfit» -- but not the un-words that negate nothing: «children under 6
// need a helmet» or «until noon» used to mark a family crag as not one.
const RX_NEGATED = /\b(not|(?!under|until|unit|univers|uniqu)un\w+)\b/i;

/** Split a warning into sentences, so that one clause cannot colour the whole text. */
const sentences = (s: string): string[] => s.match(/[^.!]+[.!]*\s*/g) ?? [];

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Route keys: `<cragId>~<slug of the name>`, with `.2`, `.3`… for a name that repeats. A pack may
 * carry `rk`, the keys the routes had before the list was reordered; those win, so that favourites
 * and logbook entries stay attached to the right route.
 */
const routeKeys = (sector: StoredSector): string[] => {
    const held = new Set((sector.rk ?? []).filter((k): k is string => Boolean(k)));
    const seen = new Set<string>();
    return sector.routes.map((route, i) => {
        const kept = sector.rk?.[i];
        if (kept) {
            seen.add(kept);
            return kept;
        }
        const base = slug(route[0]) || `r${i + 1}`;
        let key = base;
        let n = 1;
        while (seen.has(key) || held.has(key)) {
            n++;
            key = `${base}.${n}`;
        }
        seen.add(key);
        return key;
    });
};

const toRoute = (stored: StoredRoute, index: number, key: string, sector: StoredSector): Route => {
    const star = sector.st?.[index] ?? null;
    return {
        name: stored[0],
        grade: stored[1],
        pitches: stored[2],
        gradeIdx: stored[3],
        key: `${sector.id}~${key}`,
        stars: star ? [star[0], star[1]] : null,
        length: sector.rl?.[index] ?? null,
        ord: index,
    };
};

/** Community stars per grade band: `[sum, rated routes]` for each of the five bands. */
const bandStarsOf = (routes: readonly Route[]): [number, number][] => {
    const bands: [number, number][] = [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
    ];
    for (const route of routes) {
        if (!route.stars || route.gradeIdx == null) continue;
        const band = bands[bandOf(route.gradeIdx)];
        if (!band) continue;
        band[0] += route.stars[0];
        band[1] += 1;
    }
    return bands;
};

export const toCrag = (sector: StoredSector, packId: string): Crag => {
    const keys = routeKeys(sector);
    const routes = sector.routes.map((stored, i) =>
        toRoute(stored, i, keys[i] ?? `r${i + 1}`, sector),
    );

    const warn = sector.warn ?? "";
    const parts = sentences(warn);
    const maybe = RX_CLOSURE.test(warn) && RX_MAYBE.test(warn);
    const aka = sector.tc && fold(sector.tc.name) !== fold(sector.name) ? sector.tc.name : null;
    const orient = sector.orient ?? [];
    const bolt: Bolting | null = sector.bolt ?? null;

    return {
        id: sector.id,
        name: sector.name,
        area: sector.area,
        routes,
        packId,

        locality: str(sector.locality),
        full: str(sector.full),
        nr: num(sector.nr),
        nrInferred: sector.nrInferred === true,
        status: sector.status ?? null,
        region: str(sector.region),
        municipality: sector.municipality ?? null,
        province: sector.province ?? null,

        coord: sector.coord ?? null,
        coordDropped: sector.coordDropped === true,
        lat: sector.coord?.lat ?? null,
        lon: sector.coord?.lon ?? null,
        alt: sector.alt ?? null,

        gmin: sector.gmin ?? null,
        gmax: sector.gmax ?? null,
        gminI: sector.gminI ?? null,
        gmaxI: sector.gmaxI ?? null,
        nRoutes: sector.nRoutes ?? null,
        nSingle: sector.nSingle ?? null,
        nMulti: sector.nMulti ?? null,
        bands: sector.bands ?? null,

        ord: sector.ord ?? null,
        secs: sector.secs ?? null,
        rate: sector.rate ?? null,

        style: str(sector.style),
        styleKey: sector.styleKey ?? null,
        rock: sector.rock ?? null,
        rockDe: sector.rockDe ?? null,
        orient,
        len: sector.len ?? null,
        lenIsMax: sector.lenIsMax === true,
        lenIsTypical: sector.lenIsTypical === true,

        season: sector.season ?? null,
        seasonDe: sector.seasonDe ?? null,
        sun: sector.sun ?? null,
        sunWhole: sector.sunWhole === true,
        rain: sector.rain ?? null,
        dry: sector.dry ?? null,
        dryHow: sector.dryHow ?? null,
        dryWhy: sector.dryWhy ?? [],
        dryNote: sector.dryNote ?? null,
        dryNoteDe: sector.dryNoteDe ?? null,
        bolt,

        pk: sector.pk ?? null,
        pkAssumed: sector.pkAssumed === true,
        pkOff: sector.pkOff ?? null,
        park: sector.park ?? null,
        parkDe: sector.parkDe ?? null,
        walk: sector.walk ?? null,
        walkDe: sector.walkDe ?? null,
        walkMin: sector.walkMin ?? null,
        walkEff: sector.walkEff ?? null,
        walkHow: sector.walkHow ?? null,
        ap: sector.ap ?? [],

        desc: sector.desc ?? null,
        descDe: sector.descDe ?? null,
        warn: sector.warn ?? null,
        warnDe: sector.warnDe ?? null,
        rnote: sector.rnote ?? null,
        rnoteDe: sector.rnoteDe ?? null,
        family: sector.family ?? null,
        pt: sector.pt ?? null,
        guide: sector.guide ?? null,
        confidence: sector.confidence ?? null,

        tcOnly: sector.tcOnly === true,
        tc: sector.tc ?? null,
        links: sector.links ?? null,
        pics: sector.pics ?? [],

        // ---- derived
        closure: RX_CLOSURE.test(warn) && !maybe,
        caution: maybe || parts.some((p) => !RX_FAMILY.test(p) && RX_CAUTION.test(p)),
        noFamily: parts.some((p) => RX_FAMILY.test(p) && RX_NEGATED.test(p)),
        cls: classOf(sector.bands),
        aka,
        hay: fold(
            [sector.name, sector.area, sector.locality, sector.municipality, aka, sector.full].join(
                " | ",
            ),
        ),
        rhay: routes.length ? routes.map((r) => fold(r.name)) : null,
        oriKey: orient.length === 0 ? "unknown" : orient.length >= 4 ? "mixed" : null,
        lenMax: sector.len?.[1] ?? null,
        topoPic: Boolean(sector.pics?.some((p) => p[4] === "topo" || p[4] === "sketch")),
        topoLink: Boolean(sector.links && (sector.links.o || sector.links.f || sector.links.p)),
        anchor: sector.coord?.precision === "anchor",
        boltSp: bolt?.sp ?? null,
        boltC: bolt?.c ?? null,
        bandStars: sector.rate ? bandStarsOf(routes) : null,
    };
};

export const toRegion = (pack: Mappack, picOffset = 0): Region => ({
    /** Where this pack's pictures start in the joined picSrc list of the mounted set. */
    picOffset,
    key: pack.id,
    name: pack.name,
    fullName: pack.fullName ?? null,
    version: pack.version,
    accessed: pack.accessed ?? null,
    updated: pack.updated ?? null,
    partial: pack.partial === true,
    ch: pack.ch === true,
    fictional: pack.fictional === true,
    text: pack.text ?? {},
    view: pack.view
        ? { center: [pack.view.center[0], pack.view.center[1]], zoom: pack.view.zoom ?? 13 }
        : null,
    bbox: pack.bbox ?? null,
    labels: pack.labels ?? [],
    outline: pack.outline ?? null,
    stats: pack.stats ?? {},
    de: pack.de ?? {},
    picSrc: pack.picSrc ?? [],
    areas: pack.areas ?? [],
    parks: pack.parks ?? {},
    n: pack.sectors.length,
});

/** A car park key, made unique across packs: `<packId>/<key>`. */
export const parkKey = (packId: string, key: string): string => `${packId}/${key}`;

/**
 * Mount a set of packs.
 *
 * Two things have to be renumbered while pouring several packs into one set, both of them carried
 * over from the old `packMount()`:
 *
 * - **Car park keys are namespaced** with the pack's id, because two packs may each have a car park
 *   called «cornei». Every reference a crag makes (`pk`, `pkOff`, `ap[].pk`) is rewritten to match.
 * - **Picture indices are offset**, because `pic[3]` points into the pack's own `picSrc` list and
 *   those lists are concatenated.
 *
 * A crag id may appear in only one pack -- tools/make-packs.sh --check enforces that for the packs
 * in maps/ -- and if two loaded packs ever did collide, the first one keeps the id.
 */
export const mountPacks = (packs: readonly Mappack[]): MountedData => {
    const crags: Crag[] = [];
    const regions: Region[] = [];
    // Without a prototype: these are looked up by ids out of links, backup codes and packs, and
    // `byId["constructor"]` on a plain object is a function, not «no such crag».
    const parks: Record<string, Park> = Object.create(null) as Record<string, Park>;
    const byId: Record<string, Crag> = Object.create(null) as Record<string, Crag>;
    const picSrc: string[] = [];

    for (const pack of packs) {
        const picOffset = picSrc.length;
        const own = pack.picSrc ?? [];
        picSrc.push(...own);

        const renamed: Record<string, string> = Object.create(null) as Record<string, string>;
        for (const [key, park] of Object.entries(pack.parks ?? {})) {
            const unique = parkKey(pack.id, key);
            renamed[key] = unique;
            parks[unique] = park;
        }

        regions.push(toRegion(pack, picOffset));

        for (const sector of pack.sectors) {
            if (sector.id in byId) continue;
            const pointed: StoredSector = {
                ...sector,
                pk: sector.pk ? (renamed[sector.pk] ?? sector.pk) : sector.pk,
                pkOff: sector.pkOff ? (renamed[sector.pkOff] ?? sector.pkOff) : sector.pkOff,
                ap: sector.ap?.map((a) => ({ ...a, pk: renamed[a.pk] ?? a.pk })) ?? sector.ap,
                // Every index is moved into the joined list, and one that is not this pack's --
                // past its own list, or into none at all -- points at no source rather than at
                // the next pack's: a picture must never be credited to somebody else's source.
                pics: sector.pics
                    ? sector.pics.map(
                          (p) =>
                              [
                                  p[0],
                                  p[1],
                                  p[2],
                                  (p[3] || 0) >= 0 && (p[3] || 0) < own.length
                                      ? (p[3] || 0) + picOffset
                                      : -1,
                                  p[4],
                                  p[5],
                                  p[6],
                                  p[7],
                                  p[8],
                                  p[9],
                              ] as typeof p,
                      )
                    : sector.pics,
            };
            const crag = toCrag(pointed, pack.id);
            byId[crag.id] = crag;
            crags.push(crag);
        }
    }

    return { crags, regions, parks, byId, picSrc };
};
