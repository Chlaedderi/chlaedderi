/**
 * The way from the car park to the crag, drawn on the map.
 *
 * A port of the hand-written `drawSelection`. Every detail here carries meaning, so it is kept:
 *
 * - **White casing under the coloured line.** The approach has to stay readable over a dark
 *   satellite tile and over a busy topo map alike.
 * - **Alternatives are drawn first**, so the main approach lies on top of them, and dashed and
 *   thinner so the two cannot be confused.
 * - **A dotted stub** closes the last stretch when the computed path ends more than 35 m from the
 *   wall (`ap.gap`): the route data ends at the last known path, and pretending otherwise would
 *   suggest a trail that nobody surveyed.
 * - **No computed path at all** (`q === "detour"`, or a crag with a car park but no approach): a
 *   dotted straight line from the car park to the wall, which says "this is the direction, not
 *   the way".
 *
 * This draws and nothing else. The box the map fits to is `approachSpan`, worked out from the same
 * data without waiting for a layer to render -- see `approachGeometry.ts`.
 */

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import type { Park } from "@domain/mappack";
import type { Crag } from "@domain/model";

import { GAP_M, ROUTE_ATTRIBUTION, ROUTE_COLOUR, approachLine } from "./approachGeometry";
import { parkIcon } from "./icons";

export interface ApproachLayerProps {
    readonly crag: Crag | null;
    readonly parks: Readonly<Record<string, Park>>;
    readonly parkName: (key: string) => string;
    readonly onParkClick: (key: string) => void;
}

export const ApproachLayer = ({ crag, parks, parkName, onParkClick }: ApproachLayerProps) => {
    const map = useMap();
    const layer = useRef<L.LayerGroup | null>(null);
    const onParkClickRef = useRef(onParkClick);
    onParkClickRef.current = onParkClick;

    useEffect(() => {
        const group = L.layerGroup().addTo(map);
        layer.current = group;
        return () => {
            map.removeLayer(group);
            layer.current = null;
        };
    }, [map]);

    useEffect(() => {
        const group = layer.current;
        if (!group) return;
        group.clearLayers();

        if (!crag?.coord) return;

        const here: [number, number] = [crag.coord.lat, crag.coord.lon];

        const park = (key: string, extra: "hl" | "alt hl", permanent: boolean): void => {
            const p = parks[key];
            if (!p) return;
            L.marker([p.lat, p.lon], {
                icon: parkIcon(p.est === true, extra),
                zIndexOffset: 600,
                alt: parkName(key),
            })
                .on("click", (e) => {
                    L.DomEvent.stopPropagation(e);
                    onParkClickRef.current(key);
                })
                .bindTooltip(parkName(key), {
                    permanent,
                    direction: "bottom",
                    offset: [0, 12],
                    className: "plain",
                    opacity: 1,
                })
                .addTo(group);
        };

        // Reverse, so that the main approach is drawn over the alternative.
        for (const ap of [...(crag.ap ?? [])].reverse()) {
            const p = parks[ap.pk];
            const line = approachLine(ap);

            if (line) {
                L.polyline(line, {
                    color: "#fff",
                    weight: ap.alt ? 6 : 8,
                    opacity: 0.9,
                    interactive: false,
                    lineCap: "round",
                    lineJoin: "round",
                }).addTo(group);
                L.polyline(line, {
                    color: ROUTE_COLOUR,
                    weight: ap.alt ? 3 : 4.5,
                    opacity: 1,
                    ...(ap.alt ? { dashArray: "7 9" } : {}),
                    interactive: false,
                    lineCap: "round",
                    lineJoin: "round",
                    attribution: ROUTE_ATTRIBUTION,
                }).addTo(group);

                // The path stops short of the wall: say so with a dotted stub.
                if ((ap.gap ?? 0) > GAP_M) {
                    const last = line[line.length - 1];
                    if (last) {
                        L.polyline([last, here], {
                            color: ROUTE_COLOUR,
                            weight: 3,
                            dashArray: "1 7",
                            interactive: false,
                        }).addTo(group);
                    }
                }
            } else if (p) {
                // No usable path: the direction, dotted, and nothing that looks like a trail.
                const straight: [number, number][] = [[p.lat, p.lon], here];
                L.polyline(straight, {
                    color: "#fff",
                    weight: 5,
                    opacity: 0.85,
                    interactive: false,
                }).addTo(group);
                L.polyline(straight, {
                    color: "#1d1538",
                    weight: 2.5,
                    dashArray: "2 7",
                    interactive: false,
                }).addTo(group);
            }

            park(ap.pk, ap.alt ? "alt hl" : "hl", !ap.alt);
        }

        // No approach at all, but the sources name a car park: still mark it.
        if (!crag.ap?.length && crag.pk && parks[crag.pk]) park(crag.pk, "hl", true);
    }, [crag, parks, parkName]);

    return null;
};
