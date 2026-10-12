/**
 * Leaflet icons, as the hand-written app built them.
 *
 * Leaflet takes icon content as an HTML **string**, so these cannot be React components and the
 * styling cannot be `sx` -- the classes live in src/styles/markers.css. What a shape means:
 *
 *   filled circle   the wall is located
 *   dashed circle   the position is approximate
 *   diamond         the wall is NOT located; the marker stands by its car park
 *
 * Nothing interpolated here comes from a mappack except the car park's letter, which is the
 * constant "P" -- crag and park names go in as Leaflet tooltip/popup *nodes*, never as markup.
 */

import L from "leaflet";

import type { Crag } from "@domain/model";

import type { WeatherState } from "./markerState";

/** The rain mark that sits on a marker. Only shown when it is not "dry". */
const weatherBadge = (state: WeatherState | null): string =>
    state && state !== "dry" ? `<i class="wx ${state}"></i>` : "";

export interface CragIconState {
    readonly selected: boolean;
    readonly favourite: boolean;
    readonly weather: WeatherState | null;
}

/** Which marker shape a crag gets. `anchor` wins: it says the wall itself is not located. */
export const cragMarkerClass = (crag: Crag, state: CragIconState): string => {
    const shape = crag.anchor ? " anchor" : crag.coord?.precision === "approx" ? " approx" : "";
    return [
        "mk",
        crag.cls,
        shape.trim(),
        crag.closure ? "closure" : "",
        state.selected ? "sel" : "",
        state.favourite ? "fav" : "",
    ]
        .filter(Boolean)
        .join(" ");
};

export const cragIcon = (crag: Crag, state: CragIconState): L.DivIcon =>
    L.divIcon({
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<span class="${cragMarkerClass(crag, state)}">${weatherBadge(state.weather)}</span>`,
    });

/** A car park. `est` when its position is an estimate, `hl`/`alt` when a crag is open. */
export const parkIcon = (estimated: boolean, extra?: "hl" | "alt hl"): L.DivIcon =>
    L.divIcon({
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<span class="pk${estimated ? " est" : ""}${extra ? ` ${extra}` : ""}">P</span>`,
    });

/** Where the viewer is. A diamond when the position was set by hand. */
export const meIcon = (manual: boolean): L.DivIcon =>
    L.divIcon({
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<span class="me${manual ? " manual" : ""}"></span>`,
    });

/** The cluster bubble: a white circle with a violet rim, never Leaflet's own colour blobs. */
export const clusterIcon = (count: number): L.DivIcon =>
    L.divIcon({
        className: "",
        iconSize: [34, 34],
        html: `<span class="cl">${count}</span>`,
    });

/** The bubble for crags that share a spot by their car park. */
export const anchorClusterIcon = (count: number): L.DivIcon =>
    L.divIcon({
        className: "",
        iconSize: [30, 30],
        html: `<span class="cl anchor">${count}</span>`,
    });
