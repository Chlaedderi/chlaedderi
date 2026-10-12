/**
 * Which shape the shell is in, as one answer both `App` and the map can ask.
 *
 * The two breakpoints are a single decision with consequences in two places. `App` builds the grid
 * out of them; the map needs to know whether a camera move can be watched at all, which depends on
 * where the crag page landed:
 *
 *   below `md`   the crag covers the map -- they are siblings over the same area
 *   `md`..`lg`   the crag covers the *list* column; the map stays beside it at full width
 *   from `lg`    the crag gets a column of its own and the map column narrows
 *
 * Only the first of those hides the map, which is why `useMapCovered` turns on `!wide` and not on
 * «a crag is open».
 */

import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useMatch } from "react-router-dom";

export interface Layout {
    /** Map and list side by side, rather than the list sliding over the map. */
    readonly wide: boolean;
    /** Wide enough for the crag to have a column of its own beside the map. */
    readonly threeCol: boolean;
}

export const useLayout = (): Layout => {
    const theme = useTheme();
    const wide = useMediaQuery(theme.breakpoints.up("md"));
    // Three columns only from `lg`. Between `md` and `lg` a third one would leave about 210px of
    // map, which is not a map -- there the crag covers the list, as it used to.
    const threeCol = useMediaQuery(theme.breakpoints.up("lg"));
    return { wide, threeCol };
};

/**
 * The crag page lies over the map, so moving the camera is something nobody can see.
 *
 * The map still moves -- it has to be looking at the right crag when the viewer comes back -- but
 * it does so instantly rather than flying somewhere behind a sheet of paper.
 */
export const useMapCovered = (): boolean => {
    const { wide } = useLayout();
    // Both hooks run unconditionally: `!wide && useMatch(...)` would skip one on a wide screen.
    const onCrag = useMatch("/crag/:id") != null;
    return !wide && onCrag;
};
