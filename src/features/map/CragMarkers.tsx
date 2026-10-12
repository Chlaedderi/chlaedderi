/**
 * The crag markers.
 *
 * Two cluster groups, as the hand-written app had: `cluster` for walls that are located, and
 * `clusterA` for the crags whose wall is not located and which therefore all sit on their car
 * park -- those would otherwise pile up invisibly on one spot, so they get their own bubble that
 * fans out when tapped, and only from zoom 13 upwards.
 */

import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";

import type { CragMatch } from "@core/filters";
import type { Crag } from "@domain/model";

import { anchorClusterIcon, clusterIcon, cragIcon } from "./icons";
import type { WeatherState } from "./markerState";

export interface CragMarkersProps {
    readonly shown: readonly CragMatch[];
    readonly selectedId: string | null;
    readonly favourites: ReadonlySet<string>;
    readonly weatherOf: (crag: Crag) => WeatherState | null;
    readonly onSelect: (crag: Crag) => void;
}

const DISABLE_CLUSTER_AT = 15;
/** Below this zoom the crags pinned to a car park stay in one bubble. */
const ANCHOR_FROM = 13;

export const CragMarkers = ({
    shown,
    selectedId,
    favourites,
    weatherOf,
    onSelect,
}: CragMarkersProps) => {
    const map = useMap();
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    const groups = useMemo(() => {
        const located = L.markerClusterGroup({
            maxClusterRadius: 36,
            disableClusteringAtZoom: DISABLE_CLUSTER_AT,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            iconCreateFunction: (c) => clusterIcon(c.getChildCount()),
        });
        const byPark = L.markerClusterGroup({
            maxClusterRadius: 24,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            zoomToBoundsOnClick: true,
            spiderfyDistanceMultiplier: 1.5,
            iconCreateFunction: (c) => anchorClusterIcon(c.getChildCount()),
        });
        return { located, byPark };
    }, []);

    useEffect(() => {
        map.addLayer(groups.located);
        // The by-park bubble only from zoom 13, as before.
        const sync = (): void => {
            const wanted = map.getZoom() >= ANCHOR_FROM;
            if (wanted && !map.hasLayer(groups.byPark)) map.addLayer(groups.byPark);
            if (!wanted && map.hasLayer(groups.byPark)) map.removeLayer(groups.byPark);
        };
        map.on("zoomend", sync);
        sync();
        return () => {
            map.off("zoomend", sync);
            map.removeLayer(groups.located);
            if (map.hasLayer(groups.byPark)) map.removeLayer(groups.byPark);
        };
    }, [map, groups]);

    useEffect(() => {
        groups.located.clearLayers();
        groups.byPark.clearLayers();

        const located: L.Marker[] = [];
        const byPark: L.Marker[] = [];

        for (const { crag } of shown) {
            if (crag.lat == null || crag.lon == null) continue;
            const marker = L.marker([crag.lat, crag.lon], {
                icon: cragIcon(crag, {
                    selected: crag.id === selectedId,
                    favourite: favourites.has(crag.id),
                    weather: weatherOf(crag),
                }),
                // The open crag draws over its neighbours.
                zIndexOffset: crag.id === selectedId ? 400 : 0,
                keyboard: true,
                alt: crag.name,
                title: crag.name,
            });
            marker.on("click", (e) => {
                L.DomEvent.stopPropagation(e);
                onSelectRef.current(crag);
            });
            (crag.anchor ? byPark : located).push(marker);
        }

        groups.located.addLayers(located);
        groups.byPark.addLayers(byPark);
    }, [groups, shown, selectedId, favourites, weatherOf]);

    return null;
};
