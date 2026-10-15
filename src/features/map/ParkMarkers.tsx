/**
 * Every car park of the region, behind `prefs.allParks` and only from zoom 12.5 upwards.
 *
 * Without the zoom floor a whole region's car parks cover the map; a crag's own car parks always
 * appear anyway when the crag is opened (ApproachLayer).
 */

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import type { Park } from "@domain/mappack";

import { holdCards } from "./holdCards";
import { parkIcon, textTip } from "./icons";

const FROM_ZOOM = 12.5;

export const ParkMarkers = ({
    parks,
    parkName,
    enabled,
    onParkClick,
}: {
    readonly parks: Readonly<Record<string, Park>>;
    readonly parkName: (key: string) => string;
    readonly enabled: boolean;
    readonly onParkClick: (key: string) => void;
}) => {
    const map = useMap();
    const layer = useRef<L.LayerGroup | null>(null);
    const onParkClickRef = useRef(onParkClick);
    onParkClickRef.current = onParkClick;

    useEffect(() => {
        const group = L.layerGroup();
        layer.current = group;
        const sync = (): void => {
            const wanted = enabled && map.getZoom() >= FROM_ZOOM;
            if (wanted && !map.hasLayer(group)) map.addLayer(group);
            if (!wanted && map.hasLayer(group)) map.removeLayer(group);
        };
        map.on("zoomend", sync);
        sync();
        return () => {
            map.off("zoomend", sync);
            if (map.hasLayer(group)) map.removeLayer(group);
            layer.current = null;
        };
    }, [map, enabled]);

    useEffect(() => {
        const group = layer.current;
        if (!group) return;
        group.clearLayers();
        if (!enabled) return;

        for (const [key, park] of Object.entries(parks)) {
            L.marker([park.lat, park.lon], {
                icon: parkIcon(park.est === true),
                alt: parkName(key),
            })
                .on("preclick", holdCards)
                .on("click", (e) => {
                    L.DomEvent.stopPropagation(e);
                    onParkClickRef.current(key);
                })
                .bindTooltip(textTip(parkName(key)), { direction: "bottom", offset: [0, 12] })
                .addTo(group);
        }
    }, [parks, parkName, enabled]);

    return null;
};
