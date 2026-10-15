import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { countVisit, dismissInstallHint } from "@core/installHint";
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
                key: "allPaths" | "wx" | "allParks" | "chTrails" | "chWrz" | "legend" | "demoSeen";
                value: boolean;
            }>,
        ) => {
            state[action.payload.key] = action.payload.value;
        },
        setPacks: (state, action: PayloadAction<InstalledPack[]>) => {
            state.packs = action.payload;
        },
        /**
         * Add or replace one pack's note, against the list as it is *now*. An install awaits a
         * download and a write, and a list taken when it started would undo whatever another
         * install or removal did meanwhile.
         */
        putPack: (state, action: PayloadAction<InstalledPack>) => {
            state.packs = [
                ...state.packs.filter((p) => p.id !== action.payload.id),
                action.payload,
            ];
        },
        /** Drop one pack's note, against the list as it is now. */
        dropPack: (state, action: PayloadAction<string>) => {
            state.packs = state.packs.filter((p) => p.id !== action.payload);
        },
        /** The page was opened; `payload` is the time. */
        countVisit: (state, action: PayloadAction<number>) => {
            state.install = countVisit(state.install, action.payload);
        },
        /** «Not now» on the install hint; `payload` is the time. */
        dismissInstallHint: (state, action: PayloadAction<number>) => {
            state.install = dismissInstallHint(state.install, action.payload);
        },
        /** Installed: the hint has nothing left to say. */
        installDone: (state) => {
            state.install = { ...state.install, done: true };
        },
        restore: (_state, action: PayloadAction<Prefs>) => action.payload,
        reset: () => defaultPrefs(),
    },
});

export const prefsActions = prefsSlice.actions;
export default prefsSlice.reducer;
