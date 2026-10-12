import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { Lang } from "@core/lang";
import type { LogStyle } from "@core/logbook";
import { type InstalledPack, type Prefs, defaultPrefs, readPrefsSync } from "@core/prefs";

/** Read straight out of localStorage, so language and theme are right from the first paint. */
export const initialPrefsState: Prefs = readPrefsSync();

const prefsSlice = createSlice({
    name: "prefs",
    initialState: initialPrefsState,
    reducers: {
        setLang: (state, action: PayloadAction<Lang>) => {
            state.lang = action.payload;
        },
        setTheme: (state, action: PayloadAction<Prefs["theme"]>) => {
            state.theme = action.payload;
        },
        setBase: (state, action: PayloadAction<Prefs["base"]>) => {
            state.base = action.payload;
        },
        setBaseCh: (state, action: PayloadAction<Prefs["baseCH"]>) => {
            state.baseCH = action.payload;
        },
        setRegion: (state, action: PayloadAction<string | null>) => {
            state.region = action.payload;
        },
        setRadar: (state, action: PayloadAction<Prefs["radar"]>) => {
            state.radar = action.payload;
        },
        setLogStyle: (state, action: PayloadAction<LogStyle>) => {
            state.logStyle = action.payload;
        },
        setFlag: (
            state,
            action: PayloadAction<{
                key: "allPaths" | "wx" | "allParks" | "chTrails" | "chWrz" | "legend";
                value: boolean;
            }>,
        ) => {
            state[action.payload.key] = action.payload.value;
        },
        setPacks: (state, action: PayloadAction<InstalledPack[]>) => {
            state.packs = action.payload;
        },
        restore: (_state, action: PayloadAction<Prefs>) => action.payload,
        reset: () => defaultPrefs(),
    },
});

export const prefsActions = prefsSlice.actions;
export default prefsSlice.reducer;
