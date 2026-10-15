/**
 * The bridge between the store state and the device.
 *
 * Reads favourites, logbook and settings back at start, writes them on every change (debounced),
 * and listens for what another tab wrote. Filters are kept in plain localStorage, as before: they
 * are a convenience, not data worth the triple store.
 *
 * A link may carry filters of its own (filterCode.ts). Those win over what is stored -- somebody
 * followed a link to see *that* view -- but they are not written to the device until the viewer
 * makes them their own by changing something. Opening somebody's link should not quietly replace
 * the setup they had.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { cleanFavourites, toStoredFavourites } from "@core/favourites";
import { FILTER_PARAM, decodeFilterCode } from "@core/filterCode";
import { FILTER_KEY, type StoredFilters, fromStored, toStored } from "@core/filters";
import { activeCount } from "@core/filters";
import { cleanLog } from "@core/logbook";
import { type Prefs, cleanPrefs, keepTouched } from "@core/prefs";
import { openStore } from "@core/store";

import { useData } from "./dataContext";
import { useAppDispatch, useAppSelector } from "./hooks";
import { selectFilters } from "./selectors";
import { favouritesActions } from "./slices/favouritesSlice";
import { filtersActions, fromFilters } from "./slices/filtersSlice";
import { logbookActions } from "./slices/logbookSlice";
import { initialPrefsState, prefsActions } from "./slices/prefsSlice";
import { uiActions } from "./slices/uiSlice";
import { useDebouncedWrite } from "./useDebouncedWrite";

const store = openStore();

/** How long a read-back that found nothing gives the slower layers before asking again. */
const LATE_LAYER_MS = 3000;

export const Persistence = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    // The lists only, not the slice: the slice also holds `saved`, which every write below sets
    // anew -- watching it would make each write schedule the next one, forever.
    const favCrags = useAppSelector((s) => s.favourites.crags);
    const favRoutes = useAppSelector((s) => s.favourites.routes);
    const favourites = useMemo(
        () => ({ crags: favCrags, routes: favRoutes }),
        [favCrags, favRoutes],
    );
    const entries = useAppSelector((s) => s.logbook.entries);
    const prefs = useAppSelector((s) => s.prefs);
    const filters = useAppSelector(selectFilters);
    const sort = useAppSelector((s) => s.filters.sort);
    const dir = useAppSelector((s) => s.filters.dir);
    const hydrated = useAppSelector((s) => s.filters.hydrated);
    const offerPending = useAppSelector((s) => s.ui.packOffer !== null);
    const { crags, regions, booted } = useData();
    const { search } = useLocation();

    // The settings as they are *now*, for the asynchronous read-back below: a closure over `prefs`
    // would hold whatever they were when the effect ran, which is the stale value we are guarding
    // against in the first place.
    const latestPrefs = useRef(prefs);
    latestPrefs.current = prefs;
    // The settings as the store holds them, as far as this tab knows: what was read at the first
    // paint, then whatever was read back, arrived from another tab, or written from here. A key is
    // the viewer's own change only while it differs from this -- measured against the first paint
    // instead, every key a read-back had replaced stayed «touched» for the whole session, and two
    // tabs answered each other's settings with their own, for ever.
    const storedPrefs = useRef<Prefs>(initialPrefsState);

    // The favourites and the logbook as they are now, for the read-back below to merge into.
    const latestFav = useRef({ crags: favCrags, routes: favRoutes });
    latestFav.current = { crags: favCrags, routes: favRoutes };
    const latestEntries = useRef(entries);
    latestEntries.current = entries;

    // What the store holds for each key, as JSON, as far as this tab knows: read back at start,
    // arrived from another tab, or written from here. A value equal to it is not written again --
    // otherwise two open tabs answer each other's every write with one of their own, for ever,
    // and a change made in between is overwritten by the echo of the one before it.
    const known = useRef<Partial<Record<"fav" | "log" | "prefs", string>>>({});
    // Nothing is written for a key before it has been read back: favourites and the logbook start
    // empty, and a write of one new favourite in that window would be newer than everything stored
    // and replace it, on every layer.
    const loaded = useRef(false);
    // The same, as state, for the settings: their write waits on it and has to run once it flips.
    const [ready, setReady] = useState(false);

    // ---- read back once
    useEffect(() => {
        void (async () => {
            try {
                await store.ready;
                const readAll = () =>
                    Promise.all([store.get("fav"), store.get("log"), store.get("prefs")]);
                let [fav, log, saved] = await readAll();
                // Nothing anywhere, and neither layer that outlives localStorage answering: that is
                // a first visit -- or IndexedDB and the Cache too slow to answer in time, as on a
                // cold start, with everything still in them. Opened now, the writes would put
                // this tab's defaults over all of it. A layer that answers late counts again, so
                // ask once more before taking «nothing» for an answer.
                if (!fav && !log && !saved && !store.status().durable) {
                    await new Promise((resolve) => setTimeout(resolve, LATE_LAYER_MS));
                    [fav, log, saved] = await readAll();
                }
                if (fav) known.current.fav = JSON.stringify(fav);
                if (log) known.current.log = JSON.stringify(log);
                if (saved) known.current.prefs = JSON.stringify(saved);

                // Merged with whatever was added here while the store was still being read.
                const clean = fav
                    ? cleanFavourites(fav)
                    : { c: new Set<string>(), r: new Set<string>() };
                const now = latestFav.current;
                if (fav || now.crags.length || now.routes.length) {
                    dispatch(
                        favouritesActions.restore({
                            crags: [...new Set([...clean.c, ...now.crags])],
                            routes: [...new Set([...clean.r, ...now.routes])],
                        }),
                    );
                }
                const stored = log ? cleanLog(log) : [];
                const added = latestEntries.current.filter(
                    (e) => !stored.some((s) => s.id === e.id),
                );
                if (log || added.length) dispatch(logbookActions.restore([...stored, ...added]));
                if (saved) {
                    const clean = cleanPrefs(saved);
                    const now = latestPrefs.current;
                    const merged = keepTouched(clean, now, storedPrefs.current);
                    // A region picked while nothing of the viewer's was mounted yet -- the showcase,
                    // chosen because the settings had come up empty -- is the app's doing, not theirs.
                    // The region they left stays, when it is one of the regions coming back.
                    const ownRegion = merged.packs.some((p) => p.id === clean.region);
                    const pickedForThem = !now.packs.some((p) => p.id === now.region);
                    dispatch(
                        prefsActions.restore(
                            ownRegion && pickedForThem
                                ? { ...merged, region: clean.region }
                                : merged,
                        ),
                    );
                    storedPrefs.current = clean;
                }
                // Writes open only now, with everything stored merged in: before, a write of what
                // this tab holds would be the newest record on every layer and replace it.
                loaded.current = true;
                setReady(true);
            } catch {
                // Not merged, so not written -- a lost change is the lesser harm than lost
                // regions, favourites or ascents. (The store itself never rejects; this is for a
                // failure in the merging above.)
            }
        })();

        // Another tab or window wrote something.
        store.subscribe((key, value) => {
            if (key === "fav" || key === "log" || key === "prefs") {
                known.current[key] = JSON.stringify(value);
            }
            if (key === "fav") {
                const clean = cleanFavourites(value);
                dispatch(favouritesActions.restore({ crags: [...clean.c], routes: [...clean.r] }));
            }
            if (key === "log") dispatch(logbookActions.restore(cleanLog(value)));
            // Another tab's settings must not undo a switch flipped here a moment ago either.
            if (key === "prefs") {
                const clean = cleanPrefs(value);
                dispatch(
                    prefsActions.restore(
                        keepTouched(clean, latestPrefs.current, storedPrefs.current),
                    ),
                );
                storedPrefs.current = clean;
            }
        });
    }, [dispatch]);

    /** Whether `value` is news to the store under `key`; remembers it if so. */
    const isNew = (key: "fav" | "log" | "prefs", value: unknown): boolean => {
        if (!loaded.current) return false;
        const text = JSON.stringify(value);
        if (known.current[key] === text) return false;
        known.current[key] = text;
        return true;
    };

    // ---- the filters, out of the link or out of plain localStorage, once the data is there to
    // check them against
    const restoredFilters = useRef(false);
    // What the link asked for, as it would be stored, so that merely looking at it is not written
    // to the device below.
    const fromLink = useRef<string | null>(null);
    useEffect(() => {
        // Not before the installed packs are read back: until then only the showcase is mounted,
        // and an area or municipality of an installed region would be thrown away as unknown.
        // Nor while a region is on offer: a view link offers its region and carries its filters
        // to the map, and an area of that region read before it is installed is thrown away.
        if (restoredFilters.current || !booted || !crags.length || offerPending) return;
        restoredFilters.current = true;
        try {
            const where = {
                areas: new Set(regions.flatMap((r) => r.areas.map((a) => a.name))),
                municipalities: new Set(
                    crags.map((c) => c.municipality).filter((m): m is string => !!m),
                ),
            };

            // The link first: somebody followed it to see that view, not the one they left here.
            const code = new URLSearchParams(search).get(FILTER_PARAM);
            const linked = code ? decodeFilterCode(code, where) : null;
            if (linked) {
                const restored = fromFilters(linked.filters, linked.sort, linked.dir);
                fromLink.current = JSON.stringify(
                    toStored(linked.filters, linked.sort, linked.dir),
                );
                dispatch(filtersActions.restore(restored));
                dispatch(uiActions.toast({ message: t("f.fromlink") }));
                return;
            }

            const raw = localStorage.getItem(FILTER_KEY);
            const stored = raw ? (JSON.parse(raw) as StoredFilters) : null;
            if (!stored) return;
            const back = fromStored(stored, where);
            const restored = fromFilters(back.filters, back.sort, back.dir);
            dispatch(filtersActions.restore(restored));
            // Filters that survive a reload are easy to forget about and then puzzling. The
            // original said so once, for seven seconds.
            const n = activeCount(selectFilters({ filters: restored } as never));
            if (n > 0) {
                dispatch(uiActions.toast({ message: t("f.restored", { 0: n }) }));
            }
        } catch {
            /* a filter state is a convenience; never let it stop the app */
        } finally {
            // Every way out of here has to say so, including the two early returns and the catch:
            // the URL mirror stays silent until it knows this state is the viewer's own.
            dispatch(filtersActions.hydrated());
        }
    }, [booted, crags, regions, search, offerPending, dispatch, t]);

    // ---- write on change
    useDebouncedWrite(favourites, (value) => {
        const stored = toStoredFavourites({ c: new Set(value.crags), r: new Set(value.routes) });
        if (!isNew("fav", stored)) return;
        void store.set("fav", stored).then((result) => {
            dispatch(
                favouritesActions.saveResult({
                    ok: result.ok,
                    verified: result.verified,
                    at: result.t,
                }),
            );
            // A silent failure here loses somebody's favourites. Say so, and name the page
            // that explains what this browser can and cannot keep.
            if (!result.ok) {
                dispatch(uiActions.toast({ message: t("save.fail"), severity: "warning" }));
            }
        });
    });

    useDebouncedWrite(entries, (value) => {
        if (!isNew("log", value)) return;
        void store.set("log", value).then((result) => {
            dispatch(
                logbookActions.saveResult({
                    ok: result.ok,
                    verified: result.verified,
                    at: result.t,
                }),
            );
            if (!result.ok) {
                dispatch(uiActions.toast({ message: t("save.fail.log"), severity: "warning" }));
            }
        });
    });

    // The settings too wait for the read-back. Read synchronously at start they come from
    // localStorage alone; where that copy was lost they are the defaults -- no installed regions,
    // no keys -- and a write of them before the read-back would be the newest record on every
    // layer, and the read-back would hand those defaults back. Once it is in, whatever was
    // changed meanwhile is written (keepTouched kept it).
    const prefsToWrite = useMemo(() => (ready ? prefs : null), [ready, prefs]);
    useDebouncedWrite(prefsToWrite, (value) => {
        if (value === null || !isNew("prefs", value)) return;
        storedPrefs.current = value;
        void store.set("prefs", value);
    });

    // Memoised, so that only a change of the filters writes them, not every render of this component.
    const filterState = useMemo(() => ({ filters, sort, dir }), [filters, sort, dir]);
    useDebouncedWrite(filterState, ({ filters: f, sort: s, dir: d }) => {
        // Not before the stored filters were read back: this would overwrite them with the defaults.
        if (!hydrated) return;
        try {
            const text = JSON.stringify(toStored(f, s, d));
            // Still exactly what the link asked for: the viewer has looked at somebody else's view
            // and changed nothing, so their own stored filters stay as they left them. The moment
            // they touch anything this stops matching and writing resumes for good.
            if (fromLink.current !== null && fromLink.current === text) return;
            fromLink.current = null;
            localStorage.setItem(FILTER_KEY, text);
        } catch {
            /* a full or blocked localStorage must not break anything */
        }
    });

    return null;
};
