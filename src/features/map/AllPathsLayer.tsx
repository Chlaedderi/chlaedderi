/**
 * Every shown crag's main approach at once, faint, behind everything else.
 *
 * Behind `prefs.allPaths` (the layers menu). The crag that is open is skipped, because
 * ApproachLayer already draws it properly; drawing both would double the line.
 */

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import type { CragMatch } from "@core/filters";
import { decodePolyline } from "@core/geo";

import { ROUTE_ATTRIBUTION, ROUTE_COLOUR } from "./approachGeometry";

export const AllPathsLayer = ({
    shown,
    selectedId,
    enabled,
}: {
    readonly shown: readonly CragMatch[];
    readonly selectedId: string | null;
    readonly enabled: boolean;
}) => {
    const map = useMap();
    const layer = useRef<L.LayerGroup | null>(null);

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
        if (!enabled) return;

        for (const { crag } of shown) {
            const ap = crag.ap?.[0];
            if (!ap || ap.q === "detour" || crag.id === selectedId) continue;
            L.polyline(decodePolyline(ap.line), {
                color: ROUTE_COLOUR,
                weight: 2.5,
                opacity: 0.55,
                interactive: false,
                attribution: ROUTE_ATTRIBUTION,
            }).addTo(group);
        }
    }, [shown, selectedId, enabled]);

    return null;
};
