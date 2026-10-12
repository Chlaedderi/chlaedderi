/**
 * Favourites: a set of crag ids and a set of route keys, kept by the triple store under `fav`.
 *
 * Route keys rather than positions, so a favourite survives a pack being reloaded and a route list
 * being reordered. A key whose crag is not loaded is kept untouched until the pack comes back.
 */

export interface Favourites {
    readonly c: ReadonlySet<string>;
    readonly r: ReadonlySet<string>;
}

export const emptyFavourites = (): Favourites => ({ c: new Set(), r: new Set() });

/** Read a stored value back; anything that is not a list of strings is ignored. */
export const cleanFavourites = (v: unknown): Favourites => {
    const strings = (x: unknown): Set<string> =>
        new Set((Array.isArray(x) ? x : []).filter((s): s is string => typeof s === "string"));
    const o = (v ?? {}) as { c?: unknown; r?: unknown };
    return { c: strings(o.c), r: strings(o.r) };
};

/** What goes into the store: plain arrays, sorted so the value is stable. */
export const toStoredFavourites = (f: Favourites): { c: string[]; r: string[] } => ({
    c: [...f.c].sort(),
    r: [...f.r].sort(),
});

const toggleIn = (set: ReadonlySet<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
};

export const toggleCrag = (f: Favourites, id: string): Favourites => ({
    ...f,
    c: toggleIn(f.c, id),
});

export const toggleRoute = (f: Favourites, key: string): Favourites => ({
    ...f,
    r: toggleIn(f.r, key),
});

export const favouriteCount = (f: Favourites): number => f.c.size + f.r.size;
