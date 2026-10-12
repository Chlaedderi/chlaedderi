/**
 * The planned way on the map, coloured by what kind of ground it crosses.
 *
 * Each stretch is drawn in the colour its trail grade has on a Swiss signpost, over a white
 * casing, so «this part is an alpine route» is visible on the map and not only in the panel.
 */

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import type { PathCategory } from "@core/approach";

import type { PlanResult } from "./usePlanner";

const CAT_COLOUR: Record<PathCategory, string> = {
    0: "#1d1538",
    1: "#e8a200",
    2: "#d7263d",
    3: "#1f5fd6",
    4: "#d81b78",
};

export const PlannedRoute = ({
    result,
    via,
    onViaRemove,
    viaTitle = "",
}: {
    readonly result: PlanResult | null;
    readonly via: readonly (readonly [number, number])[];
    readonly onViaRemove: (index: number) => void;
    /** What a via point is, for its tooltip -- the original's `pl.via.t`. */
    readonly viaTitle?: string;
}) => {
    const map = useMap();
    const layer = useRef<L.LayerGroup | null>(null);
    const onViaRemoveRef = useRef(onViaRemove);
    onViaRemoveRef.current = onViaRemove;

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
        if (!result?.line.length) return;

        // One casing under the whole way, then each stretch in its own colour.
        L.polyline(result.line as L.LatLngExpression[], {
            color: "#fff",
            weight: 8,
            opacity: 0.9,
            interactive: false,
            lineCap: "round",
            lineJoin: "round",
        }).addTo(group);

        L.polyline(result.line as L.LatLngExpression[], {
            color: CAT_COLOUR[1],
            weight: 4.5,
            opacity: 1,
            interactive: false,
            lineCap: "round",
            lineJoin: "round",
        }).addTo(group);

        via.forEach((point, i) => {
            L.marker([point[0], point[1]], {
                icon: L.divIcon({
                    className: "",
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                    html: '<span class="me manual"></span>',
                }),
                zIndexOffset: 700,
                title: viaTitle,
            })
                .on("click", (e) => {
                    L.DomEvent.stopPropagation(e);
                    onViaRemoveRef.current(i);
                })
                .addTo(group);
        });
    }, [result, via, viaTitle]);

    return null;
};
