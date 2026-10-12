/**
 * The lifecycle every map call-out shares: a Leaflet popup whose content is React.
 *
 * Leaflet owns the popup shell and we own what is inside it, which the three call-outs each used to
 * arrange for themselves -- the same thirty lines, three times, including the same mistake. The
 * content went in through a portal *after* `openOn`, so Leaflet laid the popup out around an empty
 * box. Here the children are already in the container when the popup opens, because `createPortal`
 * renders into a detached node perfectly well and React commits this component's own returned tree
 * before its layout effect runs.
 *
 * Two things are deliberately not done. The content is never re-measured when it changes: Leaflet's
 * `update()` ends in `_adjustPan()`, so a forecast arriving would shove the map under the reader's
 * thumb, and it detaches and re-appends the container, which drops focus out of the card. With the
 * width pinned in CSS (see `--popw`), a later change can only alter the height, and Leaflet anchors
 * a popup by its bottom edge -- the card grows upward and the tip stays on the marker.
 */

import L from "leaflet";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useMap } from "react-leaflet";

/** How far below the marker a card that hangs under it starts, measured from the card's foot. */
const BELOW_GAP = 47;

export interface CalloutSpec {
    /** Where the call-out points, or null when there must not be one. */
    readonly at: readonly [number, number] | null;
    /** Leaflet closed the popup: the map was tapped, or Escape was pressed. */
    readonly onClose: () => void;
    readonly options?: L.PopupOptions;
    /**
     * Open the popup later rather than at once, given the map and the card's measured size.
     *
     * The crag call-out uses it to fit the map to the approach first and open the card when the
     * movement has finished, so that the two do not animate against each other. Whatever it
     * returns is run when the call-out goes away, to cancel what it started. The map is handed
     * over rather than reached for, so that the caller does not have to live inside `MapContainer`.
     */
    readonly defer?: (
        map: L.Map,
        card: { readonly w: number; readonly h: number },
        open: (below: boolean) => void,
    ) => (() => void) | void;
    /**
     * Bumped to run the whole sequence again for a call-out that is already open.
     *
     * The crag call-out needs it because a crag can be revealed while it is already the chosen one
     * -- the viewer tapped its marker, saw the map stay put, and then picked the same crag out of
     * the list. Without this the effect below would not run again and the map would not travel.
     * Going through this path rather than moving the camera from somewhere else is what keeps the
     * card measured, placed clear of the approach, and opened only once the map has stopped.
     */
    readonly revision?: number;
}

/**
 * Measure the card at the width it will really have, off-screen.
 *
 * The container is moved out and back; React does not notice, because its identity never changes.
 * `.popmeasure` is `visibility: hidden`, so nothing can catch the card mid-measurement.
 */
const measureCard = (node: HTMLElement): { w: number; h: number } => {
    const box = document.createElement("div");
    box.className = "popmeasure";
    document.body.appendChild(box);
    box.appendChild(node);
    const size = { w: box.offsetWidth, h: box.offsetHeight };
    box.removeChild(node);
    box.remove();
    return size;
};

/** The detached `div.pop` to portal the call-out's content into. Stable for the component's life. */
export const useCallout = (spec: CalloutSpec): HTMLElement => {
    const map = useMap();
    const container = useRef<HTMLDivElement | null>(null);
    container.current ??= Object.assign(document.createElement("div"), { className: "pop" });

    const popup = useRef<L.Popup | null>(null);
    // Held in a ref so that a parent re-rendering cannot tear the popup down and build it again.
    const latest = useRef(spec);
    latest.current = spec;

    const lat = spec.at?.[0] ?? null;
    const lon = spec.at?.[1] ?? null;
    // Read off `spec` rather than out of the ref, so that it is a real dependency below.
    const revision = spec.revision ?? 0;

    useLayoutEffect(() => {
        if (lat == null || lon == null) return;
        const node = container.current!;
        const { options, defer } = latest.current;

        const open = (below: boolean): void => {
            const p = L.popup({
                autoPan: true,
                closeButton: false,
                maxWidth: 320,
                minWidth: 200,
                offset: [0, -8],
                ...options,
            })
                .setLatLng([lat, lon])
                .setContent(node)
                .openOn(map);
            popup.current = p;

            if (below) {
                // Leaflet only ever places a popup above its anchor, so hanging one below means
                // pushing it down by its own height. The class flips the tip; the offset moves
                // the card. Both have to happen before anyone sees the first frame.
                const el = p.getElement();
                if (el) {
                    el.classList.add("below");
                    p.options.offset = L.point(0, el.offsetHeight + BELOW_GAP);
                    p.update();
                }
            }
        };

        const card = measureCard(node);
        const cancel = defer ? defer(map, card, open) : (open(false), undefined);

        const closed = (e: L.PopupEvent): void => {
            if (e.popup === popup.current) latest.current.onClose();
        };
        map.on("popupclose", closed);

        return () => {
            // Off before close: tearing the popup down ourselves is not the viewer closing it,
            // and `onClose` deselects the crag.
            map.off("popupclose", closed);
            cancel?.();
            if (popup.current) map.closePopup(popup.current);
            popup.current = null;
        };
    }, [map, lat, lon, revision]);

    // The card's width is `min(280px, calc(100vw - 44px))`, which the browser keeps up to date --
    // but the width Leaflet positions the card by is measured once and cached. A rotated phone, or
    // the map column narrowing when the crag panel opens, would leave the tip beside its marker.
    useEffect(() => {
        const resized = (): void => popup.current?.update();
        map.on("resize", resized);
        return () => {
            map.off("resize", resized);
        };
    }, [map]);

    return container.current;
};
