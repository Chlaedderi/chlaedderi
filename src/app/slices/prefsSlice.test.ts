import { describe, expect, it } from "vitest";

import reducer, { initialPrefsState, prefsActions } from "./prefsSlice";

describe("the installed-pack notes", () => {
    const withPacks = (...ids: string[]) =>
        reducer(initialPrefsState, prefsActions.setPacks(ids.map((id) => ({ id, version: "1" }))));

    it("adds or replaces one note against the list as it is now", () => {
        // An update of A that started before B was removed must not bring B back.
        let state = withPacks("a", "b");
        state = reducer(state, prefsActions.dropPack("b"));
        state = reducer(state, prefsActions.putPack({ id: "a", version: "2" }));
        expect(state.packs).toEqual([{ id: "a", version: "2" }]);
    });

    it("keeps a pack another install added meanwhile", () => {
        let state = withPacks("a");
        state = reducer(state, prefsActions.putPack({ id: "b", version: "1" }));
        state = reducer(state, prefsActions.putPack({ id: "a", version: "2" }));
        expect(state.packs.map((p) => p.id).sort()).toEqual(["a", "b"]);
    });
});
