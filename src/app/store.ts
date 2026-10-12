/**
 * The store holds the *user's* state: filters, favourites, logbook, settings and what the interface
 * is showing. The mounted mappacks are deliberately **not** in here -- they are large (8100 routes),
 * immutable once mounted, and derived from the packs rather than edited, so they live in a context
 * of their own (src/app/DataProvider.tsx) where they cost nothing to keep.
 */

import { configureStore } from "@reduxjs/toolkit";

import favourites from "./slices/favouritesSlice";
import filters from "./slices/filtersSlice";
import logbook from "./slices/logbookSlice";
import prefs from "./slices/prefsSlice";
import ui from "./slices/uiSlice";

export const store = configureStore({
    reducer: { filters, favourites, logbook, prefs, ui },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
