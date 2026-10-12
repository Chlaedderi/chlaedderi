/**
 * The selectors that turn the serialisable store state into what the pure functions in @core want,
 * memoised so the filter pass does not run again on every render.
 */

import { createSelector } from "@reduxjs/toolkit";

import type { FilterContext } from "@core/filters";
import { indexLog } from "@core/logbook";

import { toFilters } from "./slices/filtersSlice";
import type { RootState } from "./store";

export const selectFiltersState = (s: RootState): RootState["filters"] => s.filters;
export const selectSort = (s: RootState): RootState["filters"]["sort"] => s.filters.sort;
export const selectDir = (s: RootState): RootState["filters"]["dir"] => s.filters.dir;
export const selectPrefs = (s: RootState): RootState["prefs"] => s.prefs;
export const selectUi = (s: RootState): RootState["ui"] => s.ui;

export const selectFilters = createSelector([selectFiltersState], toFilters);

export const selectFavouriteCrags = createSelector(
    [(s: RootState) => s.favourites.crags],
    (crags) => new Set(crags),
);

export const selectFavouriteRoutes = createSelector(
    [(s: RootState) => s.favourites.routes],
    (routes) => new Set(routes),
);

export const selectLogEntries = (s: RootState): RootState["logbook"]["entries"] =>
    s.logbook.entries;

export const selectLogIndex = createSelector([selectLogEntries], indexLog);

/** The context the filter functions need, without the parts that depend on the mounted data. */
export const selectFilterContextBase = createSelector(
    [selectFavouriteCrags, selectFavouriteRoutes, selectLogIndex],
    (favCrags, favRoutes, log): Pick<FilterContext, "favCrags" | "favRoutes" | "sent"> => ({
        favCrags,
        favRoutes,
        sent: log.sent,
    }),
);

export const selectIsFavouriteCrag = createSelector(
    [selectFavouriteCrags, (_s: RootState, id: string) => id],
    (crags, id) => crags.has(id),
);
