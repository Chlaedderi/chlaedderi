import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
    type FilterFlag,
    type FilterKey,
    type Filters,
    type SortKey,
    emptyFilters,
} from "@core/filters";
import { GRADE_HI, GRADE_LO } from "@core/grades";

/**
 * The filter state. Sets are kept as arrays here, because Redux state has to be serialisable; the
 * `Filters` object the pure functions in @core/filters want is built by a selector.
 */
export interface FiltersState {
    one: Record<FilterKey, string>;
    flags: Record<FilterFlag, boolean>;
    q: string;
    gmin: number;
    gmax: number;
    minIn: number;
    orient: string[];
    conf: string[];
    area: string;
    muni: string;
    sort: SortKey;
    dir: 1 | -1;
}

const base = emptyFilters();

export const initialFiltersState: FiltersState = {
    one: {
        fav: base.fav,
        star: base.star,
        log: base.log,
        pic: base.pic,
        walk: base.walk,
        count: base.count,
        style: base.style,
        rain: base.rain,
        dry: base.dry,
        len: base.len,
        wx: base.wx,
        bolt: base.bolt,
        boltC: base.boltC,
    },
    flags: {
        hideClosure: false,
        hideCaution: false,
        hideNoFamily: false,
        onlyMapped: false,
    },
    q: "",
    gmin: GRADE_LO,
    gmax: GRADE_HI,
    minIn: 1,
    orient: [],
    conf: [],
    area: "",
    muni: "",
    sort: "area",
    dir: 1,
};

/** Put a `FiltersState` back together as the shape the pure filter functions take. */
export const toFilters = (s: FiltersState): Filters =>
    ({
        ...s.one,
        ...s.flags,
        q: s.q,
        gmin: s.gmin,
        gmax: s.gmax,
        minIn: s.minIn,
        orient: new Set(s.orient),
        conf: new Set(s.conf),
        area: s.area,
        muni: s.muni,
    }) as unknown as Filters;

/** And the other way round, for restoring a stored state. */
export const fromFilters = (f: Filters, sort: SortKey, dir: 1 | -1): FiltersState => ({
    one: {
        fav: f.fav,
        star: f.star,
        log: f.log,
        pic: f.pic,
        walk: f.walk,
        count: f.count,
        style: f.style,
        rain: f.rain,
        dry: f.dry,
        len: f.len,
        wx: f.wx,
        bolt: f.bolt,
        boltC: f.boltC,
    },
    flags: {
        hideClosure: f.hideClosure,
        hideCaution: f.hideCaution,
        hideNoFamily: f.hideNoFamily,
        onlyMapped: f.onlyMapped,
    },
    q: f.q,
    gmin: f.gmin,
    gmax: f.gmax,
    minIn: f.minIn,
    orient: [...f.orient],
    conf: [...f.conf],
    area: f.area,
    muni: f.muni,
    sort,
    dir,
});

const filtersSlice = createSlice({
    name: "filters",
    initialState: initialFiltersState,
    reducers: {
        setOne: (state, action: PayloadAction<{ key: FilterKey; value: string }>) => {
            state.one[action.payload.key] = action.payload.value;
        },
        setFlag: (state, action: PayloadAction<{ key: FilterFlag; value: boolean }>) => {
            state.flags[action.payload.key] = action.payload.value;
        },
        setQuery: (state, action: PayloadAction<string>) => {
            state.q = action.payload;
        },
        setGrades: (state, action: PayloadAction<{ gmin: number; gmax: number }>) => {
            state.gmin = Math.min(action.payload.gmin, action.payload.gmax);
            state.gmax = Math.max(action.payload.gmin, action.payload.gmax);
        },
        /** Back to the whole ladder: what a grade preset chip does when it is switched off. */
        resetGrades: (state) => {
            state.gmin = GRADE_LO;
            state.gmax = GRADE_HI;
        },
        setMinIn: (state, action: PayloadAction<number>) => {
            state.minIn = action.payload;
        },
        toggleOrient: (state, action: PayloadAction<string>) => {
            const at = state.orient.indexOf(action.payload);
            if (at < 0) state.orient.push(action.payload);
            else state.orient.splice(at, 1);
        },
        setArea: (state, action: PayloadAction<string>) => {
            state.area = action.payload;
        },
        setMuni: (state, action: PayloadAction<string>) => {
            state.muni = action.payload;
        },
        setSort: (state, action: PayloadAction<SortKey>) => {
            state.sort = action.payload;
        },
        toggleDir: (state) => {
            state.dir = state.dir === 1 ? -1 : 1;
        },
        /** The reset button: everything back to default, but the search text stays. */
        reset: (state) => ({ ...initialFiltersState, q: state.q }),
        restore: (_state, action: PayloadAction<FiltersState>) => action.payload,
    },
});

export const filtersActions = filtersSlice.actions;
export default filtersSlice.reducer;
