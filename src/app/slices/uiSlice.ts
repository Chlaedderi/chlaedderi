import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { prefsActions } from "./prefsSlice";

/** A short message at the bottom of the screen. */
export interface Toast {
    readonly id: number;
    readonly message: string;
    readonly severity?: "info" | "success" | "warning" | "error";
}

export interface UiState {
    /** The crag whose callout is open on the map. */
    selectedId: string | null;
    /**
     * Bumped every time someone asks the map to go and show the chosen crag.
     *
     * The camera follows a `reveal` and never a plain `select`, which is the whole difference
     * between tapping a marker -- pointing at something already on screen, where the ground must
     * not move under the viewer -- and picking a crag out of the list, where the map has to travel.
     * A bare counter rather than the id: `selectedId` already carries that.
     */
    revealNonce: number;
    /**
     * Whether that crag's card is on screen.
     *
     * Putting the card away is not the same as letting the crag go: the viewer closes it to see
     * the way to the car park underneath, which the card was covering. So the marker stays
     * highlighted and the approach stays drawn, and tapping the marker brings the card back.
     */
    calloutOpen: boolean;
    /** The crag list is open over the map (on a phone). */
    listOpen: boolean;
    filtersOpen: boolean;
    packsOpen: boolean;
    /** The approach planner is open over the map. */
    planning: boolean;
    /** Via points the viewer tapped, in WGS84. */
    planVia: [number, number][];
    toasts: Toast[];
    /** Where the viewer is, when they asked for it. */
    /** Where the viewer is. `manual` when they tapped the map rather than the browser finding it. */
    me: { lat: number; lon: number; acc: number; manual?: boolean } | null;
    /** Waiting for a tap on the map to set the position by hand. */
    picking: boolean;
    /** A newer version has been published. */
    updateReady: boolean;
    /**
     * The chosen radar did not answer. Session only, and deliberately not a preference: a failed
     * request must never rewrite what the viewer chose -- that is how the radar used to switch
     * itself off for good after one bad moment of reception.
     */
    radarDown: boolean;
    /**
     * The Italian radar did not answer, so the map falls back to RainViewer for this session. It
     * lives here rather than in the hook so that it outlives any one mounting of the map -- a
     * region switch, say -- instead of being forgotten and toasted all over again.
     */
    radarDpcDown: boolean;
    /**
     * A region somebody is being offered, from a link or from the address they typed.
     *
     * One slot: a second offer arriving while one is on screen is ignored rather than swapping the
     * dialog's content out from under whoever is reading it. `then` is the link that asked for the
     * region, followed once it is loaded; `fetchNow` says the viewer already consented to the
     * download by typing the address themselves.
     */
    /** `key` is the one a share link carried; a plain pack has none and needs none. */
    packOffer: { url: string; key?: string; then?: string; fetchNow?: boolean } | null;
}

export const initialUiState: UiState = {
    selectedId: null,
    revealNonce: 0,
    calloutOpen: true,
    listOpen: false,
    filtersOpen: false,
    packsOpen: false,
    planning: false,
    planVia: [],
    toasts: [],
    me: null,
    picking: false,
    updateReady: false,
    radarDown: false,
    radarDpcDown: false,
    packOffer: null,
};

let nextToastId = 1;

const uiSlice = createSlice({
    name: "ui",
    initialState: initialUiState,
    reducers: {
        select: (state, action: PayloadAction<string | null>) => {
            state.selectedId = action.payload;
            // Choosing a crag always shows its card, so tapping a marker whose card was put away
            // brings it back rather than appearing to do nothing.
            state.calloutOpen = true;
        },
        /**
         * Choose a crag *and* ask the map to go there: a row in the list, «auf der Karte zeigen»,
         * a link straight to a crag. Everything that happens on the map itself uses `select`
         * instead, and leaves the view exactly where the viewer put it.
         */
        reveal: (state, action: PayloadAction<string>) => {
            state.selectedId = action.payload;
            state.calloutOpen = true;
            state.revealNonce += 1;
        },
        hideCallout: (state) => {
            state.calloutOpen = false;
        },
        setListOpen: (state, action: PayloadAction<boolean>) => {
            state.listOpen = action.payload;
        },
        setFiltersOpen: (state, action: PayloadAction<boolean>) => {
            state.filtersOpen = action.payload;
        },
        setPacksOpen: (state, action: PayloadAction<boolean>) => {
            state.packsOpen = action.payload;
        },
        setPlanning: (state, action: PayloadAction<boolean>) => {
            state.planning = action.payload;
            if (!action.payload) state.planVia = [];
        },
        addVia: (state, action: PayloadAction<[number, number]>) => {
            state.planVia.push(action.payload);
        },
        clearVia: (state) => {
            state.planVia = [];
        },
        toast: (state, action: PayloadAction<Omit<Toast, "id">>) => {
            state.toasts.push({ id: nextToastId++, ...action.payload });
        },
        dismissToast: (state, action: PayloadAction<number>) => {
            state.toasts = state.toasts.filter((t) => t.id !== action.payload);
        },
        setMe: (state, action: PayloadAction<UiState["me"]>) => {
            state.me = action.payload;
        },
        setPicking: (state, action: PayloadAction<boolean>) => {
            state.picking = action.payload;
        },
        setUpdateReady: (state, action: PayloadAction<boolean>) => {
            state.updateReady = action.payload;
        },
        setRadarDown: (state, action: PayloadAction<boolean>) => {
            state.radarDown = action.payload;
        },
        setRadarDpcDown: (state, action: PayloadAction<boolean>) => {
            state.radarDpcDown = action.payload;
        },
        offerPack: (state, action: PayloadAction<NonNullable<UiState["packOffer"]>>) => {
            // First one wins: a link opened while an offer is being read must not replace it.
            if (!state.packOffer) state.packOffer = action.payload;
        },
        clearOffer: (state) => {
            state.packOffer = null;
        },
    },
    // Picking a radar by hand is the viewer saying «try again»: forget what failed last time, so
    // the Italian radar is attempted afresh and the bar stops claiming to be broken.
    extraReducers: (builder) =>
        builder.addCase(prefsActions.setRadar, (state) => {
            state.radarDown = false;
            state.radarDpcDown = false;
        }),
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;
