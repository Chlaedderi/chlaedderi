import { describe, expect, it } from "vitest";

import reducer, { initialUiState, uiActions } from "./uiSlice";

/**
 * The one distinction the map's camera rests on.
 *
 * `select` and `reveal` leave the same crag chosen; what separates them is whether anyone asked
 * the map to travel. Tapping a marker selects, because the viewer is pointing at something already
 * on the screen and the ground must not move under them; a row in the list reveals, because there
 * they cannot see where the crag is. Lose the difference and every tap pans and zooms again.
 */
describe("the ui slice", () => {
    it("asks the map to travel on a reveal, and says so once per ask", () => {
        const first = reducer(initialUiState, uiActions.reveal("c1"));
        expect(first.selectedId).toBe("c1");
        expect(first.revealNonce).toBe(1);

        // Revealing the same crag again is a fresh ask: the viewer tapped its marker, watched the
        // map stay put, and then picked it out of the list.
        const again = reducer(first, uiActions.reveal("c1"));
        expect(again.revealNonce).toBe(2);
    });

    it("leaves the map alone on a plain select", () => {
        const after = reducer(
            reducer(initialUiState, uiActions.reveal("c1")),
            uiActions.select("c2"),
        );
        expect(after.selectedId).toBe("c2");
        expect(after.revealNonce).toBe(1);
    });

    it("brings a put-away card back, whichever way the crag was chosen", () => {
        const hidden = reducer(initialUiState, uiActions.hideCallout());
        expect(reducer(hidden, uiActions.select("c1")).calloutOpen).toBe(true);
        expect(reducer(hidden, uiActions.reveal("c1")).calloutOpen).toBe(true);
    });
});
