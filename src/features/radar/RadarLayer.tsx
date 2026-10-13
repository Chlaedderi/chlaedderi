/**
 * The rain radar on the map.
 *
 * Two sources, and the region decides which (`core/radar.ts`). **RainViewer** gives the last two
 * hours as frames, which animate -- seeing where a band of rain is moving is the whole point of a
 * radar. **Protezione Civile** is a single, much finer image, over Italy and nowhere else.
 *
 * All the frames are added as layers at once and switched by opacity rather than being added and
 * removed: a tile layer that has to load on every step flickers.
 */

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import type { RadarFrames, RadarSource } from "@core/radar";
import {
    CRS_900913,
    DPC_ATTRIBUTION,
    DPC_LAYER,
    DPC_MAX_NATIVE_ZOOM,
    DPC_URL,
} from "@services/dpcRadar";
import { RADAR_MAX_NATIVE_ZOOM, RAINVIEWER_ATTRIBUTION } from "@services/rainviewer";

/** The frame that is showing is drawn at this opacity; the rest at zero. */
const SHOWN = 0.65;

export const RadarLayer = ({
    source,
    frames,
    index,
    onError,
}: {
    readonly source: RadarSource;
    readonly frames: RadarFrames | null;
    readonly index: number;
    readonly onError: (source: RadarSource) => void;
}) => {
    const map = useMap();
    const layers = useRef<L.TileLayer[]>([]);
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    // The radar belongs under the markers and must not swallow clicks.
    useEffect(() => {
        if (map.getPane("radar")) return;
        const pane = map.createPane("radar");
        pane.style.zIndex = "350";
        pane.style.pointerEvents = "none";
    }, [map]);

    useEffect(() => {
        // Every branch shares one cleanup. The Italian branch and the no-frames branch used to
        // return without one, so their layers and tile handlers stayed on the map after it was
        // taken down -- which happens on a phone every time a crag is opened.
        const added: L.TileLayer[] = [];

        if (source === "dpc") {
            const layer = L.tileLayer.wms(DPC_URL, {
                layers: DPC_LAYER,
                styles: "",
                format: "image/png",
                transparent: true,
                version: "1.1.1",
                crs: CRS_900913 as L.CRS,
                pane: "radar",
                opacity: 0.7,
                maxNativeZoom: DPC_MAX_NATIVE_ZOOM,
                maxZoom: 18,
                attribution: DPC_ATTRIBUTION,
            });
            // The service is sometimes unreachable; after a few failures fall back rather than
            // leaving an empty radar switched on.
            let ok = false;
            let errors = 0;
            layer.on("tileload", () => {
                ok = true;
            });
            layer.on("tileerror", () => {
                if (!ok && ++errors >= 3) onErrorRef.current("dpc");
            });
            layer.addTo(map);
            added.push(layer);
        } else if (source === "rv" && frames?.urls.length) {
            for (const [n, url] of frames.urls.entries()) {
                added.push(
                    L.tileLayer(url, {
                        pane: "radar",
                        opacity: n === index ? SHOWN : 0,
                        maxNativeZoom: RADAR_MAX_NATIVE_ZOOM,
                        maxZoom: 18,
                        attribution: RAINVIEWER_ATTRIBUTION,
                    }).addTo(map),
                );
            }
        }

        layers.current = added;

        return () => {
            for (const layer of added) {
                // `off()` as well as removing it: the Italian layer carries tileload/tileerror
                // handlers that would otherwise outlive the map.
                layer.off();
                map.removeLayer(layer);
            }
            if (layers.current === added) layers.current = [];
        };
        // `index` is deliberately not a dependency: it only picks which frame starts visible, and
        // the effect below moves the opacity. Rebuilding every tile layer on each frame would make
        // the animation reload its tiles and flicker.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, source, frames]);

    // Stepping through the frames: only the opacity changes.
    useEffect(() => {
        if (source !== "rv") return;
        layers.current.forEach((layer, n) => layer.setOpacity(n === index ? SHOWN : 0));
    }, [source, index]);

    return null;
};
