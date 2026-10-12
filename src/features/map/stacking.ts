/**
 * Which marker is drawn over which, in one place.
 *
 * Leaflet puts every marker in the same pane and orders them by their pixel row plus this offset,
 * so a marker lower on the screen covers the one above it -- unless an offset says otherwise. The
 * offsets used to live in three files, and two of them disagreed: the open crag had 400 and the car
 * parks drawn for it had 600. Wherever the two met, the car park covered the crag it belonged to,
 * and for a crag placed by its car park (`anchor`) that meant the crag disappeared under it
 * entirely, and could not be tapped.
 *
 * From the bottom up: every other crag (0), the open crag's car parks, the open crag itself, and
 * the planner's via points, which are what the viewer is placing by hand.
 */

/** The car parks drawn for the open crag: over every other crag on the map. */
export const Z_PARK = 600;
/** The open crag: over its own car parks, which are only there because of it. */
export const Z_SELECTED_CRAG = 650;
/** The approach planner's via points: over everything, because they are being placed. */
export const Z_PLAN_VIA = 700;
