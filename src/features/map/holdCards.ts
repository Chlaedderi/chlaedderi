import L from "leaflet";

/**
 * Keep a tap on a car park from closing the cards that are open.
 *
 * Leaflet fires `preclick` before `click`, from the marker up to the map, and an open card closes
 * on the map's `preclick`. The crag's card closing is the viewer letting the crag go -- so a tap
 * on one of its car parks deselected the crag before the tap itself was handled, and the car park
 * vanished with the approach it belongs to. Stopped here, the map never hears it, and MapPane puts
 * the crag's card away itself without letting the crag go. `click` is stopped for the same reason.
 */
export const holdCards = (e: L.LeafletMouseEvent): void => {
    L.DomEvent.stopPropagation(e);
};
