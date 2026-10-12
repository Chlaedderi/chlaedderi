import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { LogEntry } from "@core/logbook";

export interface LogbookState {
    entries: LogEntry[];
    saved: { ok: boolean; verified: boolean; at: number } | null;
}

export const initialLogbookState: LogbookState = { entries: [], saved: null };

const logbookSlice = createSlice({
    name: "logbook",
    initialState: initialLogbookState,
    reducers: {
        /** Add a new entry, or replace the one with the same id. */
        upsert: (state, action: PayloadAction<LogEntry>) => {
            const at = state.entries.findIndex((e) => e.id === action.payload.id);
            if (at < 0) state.entries.push(action.payload);
            else state.entries[at] = action.payload;
        },
        remove: (state, action: PayloadAction<string>) => {
            state.entries = state.entries.filter((e) => e.id !== action.payload);
        },
        /** Throw the whole logbook away. The original asked first, and so does the page. */
        clear: (state) => {
            state.entries = [];
        },
        restore: (state, action: PayloadAction<LogEntry[]>) => {
            state.entries = action.payload;
        },
        saveResult: (state, action: PayloadAction<LogbookState["saved"]>) => {
            state.saved = action.payload;
        },
    },
});

export const logbookActions = logbookSlice.actions;
export default logbookSlice.reducer;
