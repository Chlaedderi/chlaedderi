import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Crag ids and route keys. Arrays, so the state stays serialisable. */
export interface FavouritesState {
    crags: string[];
    routes: string[];
    /** Whether the last write reached a durable layer, for the line under «Favourites». */
    saved: { ok: boolean; verified: boolean; at: number } | null;
}

export const initialFavouritesState: FavouritesState = { crags: [], routes: [], saved: null };

const toggle = (list: string[], id: string): void => {
    const at = list.indexOf(id);
    if (at < 0) list.push(id);
    else list.splice(at, 1);
};

const favouritesSlice = createSlice({
    name: "favourites",
    initialState: initialFavouritesState,
    reducers: {
        toggleCrag: (state, action: PayloadAction<string>) => {
            toggle(state.crags, action.payload);
        },
        toggleRoute: (state, action: PayloadAction<string>) => {
            toggle(state.routes, action.payload);
        },
        /** From the store, or from another tab. */
        /** Throw them all away. The page asks first, as the original did. */
        clear: (state) => {
            state.crags = [];
            state.routes = [];
        },
        restore: (state, action: PayloadAction<{ crags: string[]; routes: string[] }>) => {
            state.crags = action.payload.crags;
            state.routes = action.payload.routes;
        },
        saveResult: (state, action: PayloadAction<FavouritesState["saved"]>) => {
            state.saved = action.payload;
        },
    },
});

export const favouritesActions = favouritesSlice.actions;
export default favouritesSlice.reducer;
