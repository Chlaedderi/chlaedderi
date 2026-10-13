/**
 * RainViewer: the last couple of hours of rain radar, worldwide, in ten-minute frames.
 *
 * Its free service stops at zoom 7, so the tiles are stretched beyond that rather than vanishing --
 * a coarse radar picture is still worth looking at when you are deciding whether to drive out.
 */

import type { RadarFrames } from "@core/radar";

export const RAINVIEWER_ATTRIBUTION =
    'Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>';

interface MapsResponse {
    host?: string;
    radar?: { past?: { time: number; path: string }[] };
}

export const fetchFrames = async (signal?: AbortSignal): Promise<RadarFrames> => {
    const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
        cache: "no-store",
        ...(signal ? { signal } : {}),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = (await response.json()) as MapsResponse;
    const past = json.radar?.past ?? [];
    if (!past.length) throw new Error("no frames");

    return {
        kind: "tiles",
        // 2/1_1: the colour scheme with smoothing, which is what the app has always shown.
        urls: past.map((f) => `${json.host ?? ""}${f.path}/256/{z}/{x}/{y}/2/1_1.png`),
        times: past.map((f) => f.time * 1000),
    };
};

export const RADAR_MAX_NATIVE_ZOOM = 7;
