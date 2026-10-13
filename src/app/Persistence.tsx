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

import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { cleanFavourites, toStoredFavourites } from "@core/favourites";
import { FILTER_PARAM, decodeFilterCode } from "@core/filterCode";
import { FILTER_KEY, type StoredFilters, fromStored, toStored } from "@core/filters";
import { activeCount } from "@core/filters";
import { cleanLog } from "@core/logbook";
import { cleanPrefs, keepTouched } from "@core/prefs";
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
    const { crags, regions, booted } = useData();
    const { search } = useLocation();

    // The settings as they are *now*, for the asynchronous read-back below: a closure over `prefs`
    // would hold whatever they were when the effect ran, which is the stale value we are guarding
    // against in the first place.
    const latestPrefs = useRef(prefs);
    latestPrefs.current = prefs;

    // ---- read back once
    useEffect(() => {
        void (async () => {
            await store.ready;
            const [fav, log, saved] = await Promise.all([
                store.get("fav"),
                store.get("log"),
                store.get("prefs"),
            ]);
            if (fav) {
                const clean = cleanFavourites(fav);
                dispatch(
                    favouritesActions.restore({
                        crags: [...clean.c],
                        routes: [...clean.r],
                    }),
                );
            }
            if (log) dispatch(logbookActions.restore(cleanLog(log)));
            if (saved) {
                dispatch(
                    prefsActions.restore(
                        keepTouched(cleanPrefs(saved), latestPrefs.current, initialPrefsState),
                    ),
                );
            }
        })();

        // Another tab or window wrote something.
        store.subscribe((key, value) => {
            if (key === "fav") {
                const clean = cleanFavourites(value);
                dispatch(favouritesActions.restore({ crags: [...clean.c], routes: [...clean.r] }));
            }
            if (key === "log") dispatch(logbookActions.restore(cleanLog(value)));
            // Another tab's settings must not undo a switch flipped here a moment ago either.
            if (key === "prefs") {
                dispatch(
                    prefsActions.restore(
                        keepTouched(cleanPrefs(value), latestPrefs.current, initialPrefsState),
                    ),
                );
            }
        });
    }, [dispatch]);

    // ---- the filters, out of the link or out of plain localStorage, once the data is there to
    // check them against
    const restoredFilters = useRef(false);
    // What the link asked for, as it would be stored, so that merely looking at it is not written
    // to the device below.
    const fromLink = useRef<string | null>(null);
    useEffect(() => {
        // Not before the installed packs are read back: until then only the showcase is mounted,
        // and an area or municipality of an installed region would be thrown away as unknown.
        if (restoredFilters.current || !booted || !crags.length) return;
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
    }, [booted, crags, regions, search, dispatch, t]);

    // ---- write on change
    useDebouncedWrite(favourites, (value) => {
        void store
            .set("fav", toStoredFavourites({ c: new Set(value.crags), r: new Set(value.routes) }))
            .then((result) => {
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

    useDebouncedWrite(prefs, (value) => {
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
