/**
 * A crag arrived at from outside the app: show it on the map.
 *
 * A link, a bookmark, a reload, the back button -- nobody dispatched anything, so nothing has told
 * the map to travel, and it would sit on the whole region with the page open beside it showing one
 * crag in particular. Everything *inside* the app reveals for itself: a row in the list, «auf der
 * Karte zeigen».
 *
 * Which is exactly why this looks at the selection as well as the route. It is not the sync that
 * copies the route to the map -- `CragPage` owns that, one way, reading only the route. This is a
 * camera decision, and the question it asks is «has anyone already chosen this crag?»: if they
 * have, they have already decided whether the map should move, and it must not be overruled. That
 * matters most for a tap on a marker while the page is open, which navigates (`MapPane`'s
 * `choose`) -- the route changes, but the viewer pointed at something on the screen and the ground
 * must stay put.
 *
 * It hangs off `App` itself, above the routes, so that nothing it watches can take it down and
 * build it again. `CragPage` could not do it: it is loaded lazily, so the map would wait on a
 * chunk download before moving, and it is mounted in two different places depending on the width,
 * so crossing the three-column breakpoint with a crag open would build it again and yank the map
 * for no reason at all.
 */

import { useEffect } from "react";
import { useMatch } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";

export const RevealRoute = () => {
    const cragId = useMatch("/crag/:id")?.params.id ?? null;
    const selectedId = useAppSelector((s) => s.ui.selectedId);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (cragId && cragId !== selectedId) dispatch(uiActions.reveal(cragId));
        // `selectedId` is read, not watched: this fires when the *route* changes, and a selection
        // made later must not send the map off on its own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cragId, dispatch]);

    return null;
};
