/**
 * Taking favourites, the logbook and the settings from one browser to another.
 *
 * There are three ways in and they must agree, so the deciding is here rather than in any of them:
 * the code pasted under «Favoriten» (`BackupCode.tsx`), the `#/transfer?c=…` address the hand-over
 * page at the old origin sends people to (`TransferLink.tsx`), and whatever comes next.
 *
 * Two payload versions:
 *
 *   FA1  `{ fav, log }`             what the app has written since the beginning
 *   FA2  `{ v: 2, fav, log, prefs }`  the same, plus the settings
 *
 * FA2 exists because of the move to a new origin. Browser storage belongs to the host, so moving
 * house empties everything -- and `prefs` is where `packs` lives: the list of installed regions
 * *and the addresses they came from*. Without it «your regions are easy to install again» means
 * copying addresses by hand out of a chat. FA1 keeps being read, for ever: codes are kept in notes
 * apps and pasted a year later.
 *
 * Nothing here replaces: a code from another device adds to what is here and never takes anything
 * away. Someone who imports an old backup must not lose today's climbing.
 */

import { cleanFavourites } from "./favourites";
import { cleanLog, type LogEntry } from "./logbook";
import { type Prefs, cleanPrefs, defaultPrefs, keepTouched } from "./prefs";
import { decodeTransfer } from "./store";

/** What a code turned out to carry. `prefs` is null for an FA1 code, which has none. */
export interface Transfer {
    version: 1 | 2;
    crags: ReadonlySet<string>;
    routes: ReadonlySet<string>;
    log: readonly LogEntry[];
    prefs: Prefs | null;
}

/** What changed, so the app can say so instead of claiming success silently. */
export interface TransferGain {
    crags: number;
    routes: number;
    entries: number;
    packs: number;
}

export interface Merged {
    crags: string[];
    routes: string[];
    log: LogEntry[];
    prefs: Prefs | null;
    gained: TransferGain;
    /** True when the code was valid but brought nothing this browser did not already have. */
    nothingNew: boolean;
}

/** Read a code. Null for anything that is not one -- never throws, whatever is pasted. */
export const readTransfer = (code: string): Transfer | null => {
    const value = decodeTransfer(code) as {
        v?: unknown;
        fav?: unknown;
        log?: unknown;
        prefs?: unknown;
    } | null;
    if (!value) return null;

    const fav = cleanFavourites(value.fav);
    const version = value.v === 2 ? 2 : 1;
    return {
        version,
        crags: fav.c,
        routes: fav.r,
        log: cleanLog(value.log),
        // An FA1 code carries no settings, and `cleanPrefs` would invent a full set of defaults --
        // which, merged in, would quietly reset this browser's settings to the factory ones.
        prefs: version === 2 && value.prefs ? cleanPrefs(value.prefs) : null,
    };
};

/**
 * Fold a transfer into what this browser already has.
 *
 * Favourites and the logbook are unions -- by id for the logbook, so the same entry carried twice
 * stays one. Settings are taken from the code *except* where this browser has already been set
 * away from the defaults: `keepTouched` is the same rule the store uses when a slower layer answers
 * after the viewer has already flipped a switch. Installed regions are a union by pack id, newest
 * kept, because two devices may each know a region the other does not.
 */
export const mergeTransfer = (
    incoming: Transfer,
    now: {
        crags: readonly string[];
        routes: readonly string[];
        log: readonly LogEntry[];
        prefs: Prefs;
    },
): Merged => {
    const crags = new Set([...now.crags, ...incoming.crags]);
    const routes = new Set([...now.routes, ...incoming.routes]);

    const known = new Set(now.log.map((e) => e.id));
    const added = incoming.log.filter((e) => !known.has(e.id));

    let prefs: Prefs | null = null;
    let packsGained = 0;
    if (incoming.prefs) {
        const merged = keepTouched(incoming.prefs, now.prefs, defaultPrefs());
        const byId = new Map(incoming.prefs.packs.map((p) => [p.id, p]));
        // What is installed here wins: it is the copy whose data actually sits in this browser's
        // cache. The code only adds regions this browser has never seen.
        for (const pack of now.prefs.packs) byId.set(pack.id, pack);
        packsGained = byId.size - now.prefs.packs.length;
        prefs = { ...merged, packs: [...byId.values()] };
    }

    const gained: TransferGain = {
        crags: crags.size - now.crags.length,
        routes: routes.size - now.routes.length,
        entries: added.length,
        packs: packsGained,
    };

    return {
        crags: [...crags],
        routes: [...routes],
        log: added.length ? [...now.log, ...added] : [...now.log],
        prefs,
        gained,
        nothingNew: gained.crags + gained.routes + gained.entries + gained.packs === 0,
    };
};
