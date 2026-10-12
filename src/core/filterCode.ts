/**
 * The filters, small enough to put in a link.
 *
 * A link could name a crag, a route, or a whole region, but never a *view* -- and a view is the
 * work: «6a to 6c+, four stars, under ten minutes' walk». This turns the filter state into one
 * opaque parameter, `f=F1.…`, so that copying the address bar hands the whole setup to somebody
 * else.
 *
 * Opaque on purpose. The storage names and the pack format string are load-bearing precisely
 * because they were written down somewhere else; a readable `?star=4&walk=10` would make every one
 * of those parameter names a promise to everyone who ever pasted a link. A versioned blob promises
 * only `F1.`, and an `F2.` could be read beside it.
 *
 * Nothing new is validated here. The code is `StoredFilters` -- what localStorage has always held
 * -- minus every field still at its default, and it comes back through `fromStored`, which checks
 * each value against its own list of what is allowed. That rule matters more in a link than in
 * localStorage: this state arrives from a stranger, and a filter state must never be able to hide
 * the whole list.
 */

import { jsonFromB64url, jsonToB64url } from "./b64url";
import {
    type Filters,
    MAX_QUERY,
    type RestoreContext,
    type SortKey,
    type StoredFilters,
    emptyFilters,
    toStored,
    fromStored,
} from "./filters";

/** The parameter a link carries the filters in. */
export const FILTER_PARAM = "f";

/** The version this app writes. A reader for an older one would sit beside this, not replace it. */
const PREFIX = "F1.";

const CODE = /^F1\.([A-Za-z0-9_-]+)$/;

/** What a view at rest looks like, to measure every other one against. */
const atRest = (): Record<string, unknown> => toStored(emptyFilters(), "area", 1).F ?? {};

/**
 * Only what the viewer actually set.
 *
 * Without this the code would be the same length for a default view as for a considered one, and
 * every link would carry twenty-odd fields saying «any». `conf` goes whatever its value: the
 * reliability filter was dropped, has no control, and `fromStored` clears it anyway.
 */
const onlyChanged = (full: Record<string, unknown>): Record<string, unknown> => {
    const rest = atRest();
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(full)) {
        if (key === "conf") continue;
        // JSON rather than `===`, for `orient`, which is an array.
        if (JSON.stringify(value) !== JSON.stringify(rest[key])) out[key] = value;
    }
    // The grades go together or not at all. `fromStored` reads them as a pair and takes neither
    // unless both are there and in order -- so «8a and up», whose upper end *is* the default, must
    // still say what that end is. Dropping it took the whole range with it.
    if ("gmin" in out || "gmax" in out) {
        out.gmin = full.gmin;
        out.gmax = full.gmax;
    }
    return out;
};

/**
 * The code for this view, or null when there is nothing to say about it.
 *
 * Null matters: it is what keeps a default view from writing anything into the URL at all, which
 * three separate things depend on -- see FilterUrl.tsx.
 */
export const encodeFilterCode = (f: Filters, sort: SortKey, dir: 1 | -1): string | null => {
    try {
        const stored = toStored(f, sort, dir);
        const F = onlyChanged(stored.F ?? {});
        const code: StoredFilters = {};
        if (Object.keys(F).length) code.F = F;
        if (sort !== "area") code.sort = sort;
        if (dir !== 1) code.dir = dir;
        // `toStored` does not write the search text, because localStorage should not keep it. A
        // link should: half of what one wants to share is «look for Platte».
        if (f.q) code.q = f.q.slice(0, MAX_QUERY);
        if (!Object.keys(code).length) return null;
        return `${PREFIX}${jsonToB64url(code)}`;
    } catch {
        // A link is a convenience. Never let one stop the app.
        return null;
    }
};

/**
 * Read one back. Null for anything that is not a code of ours -- a truncated paste, a `#` that ate
 * half of it, somebody else's parameter that happens to be called `f`.
 *
 * Anything that *is* a code of ours but holds nonsense comes back as the default for that one
 * field, never as a throw: that is `fromStored`'s rule and it is kept here deliberately.
 */
export const decodeFilterCode = (
    code: string,
    ctx: RestoreContext,
): { filters: Filters; sort: SortKey; dir: 1 | -1 } | null => {
    const found = CODE.exec(String(code).replace(/\s+/g, ""));
    if (!found?.[1]) return null;
    const parsed = jsonFromB64url(found[1]);
    if (!parsed) return null;
    return fromStored(parsed as StoredFilters, ctx);
};
