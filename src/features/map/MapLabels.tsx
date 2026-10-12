/**
 * Place names a pack draws on the map where the base map has none (`labels` in the mappack).
 *
 * A label is a tooltip with no marker behind it, so it reads as part of the map rather than as a
 * pin. The text comes from the pack, so it goes in as a Leaflet *content node*, never as markup.
 */

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import type { MapLabel } from "@domain/mappack";

export const MapLabels = ({ labels }: { readonly labels: readonly MapLabel[] }) => {
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

        for (const label of labels) {
            const span = document.createElement("span");
            span.className = "mlabel";
            span.textContent = label.name;
            L.marker([label.lat, label.lon], {
                icon: L.divIcon({ className: "", iconSize: [0, 0] }),
                interactive: false,
                keyboard: false,
            })
                .bindTooltip(span, {
                    permanent: true,
                    direction: "center",
                    className: "plain",
                    opacity: 1,
                })
                .addTo(group);
        }
    }, [labels]);

    return null;
};
