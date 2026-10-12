/**
 * What each base map is called.
 *
 * Its own module so that MapControls.tsx exports components only -- React fast refresh replaces a
 * module's components in place and cannot do that for a module that also exports constants. The
 * same reason jumpSections.ts is separate from JumpRail.tsx.
 *
 * These are proper names, so they are not translated.
 */

import type { Prefs } from "@core/prefs";

export const BASES: { key: Prefs["base"]; label: string }[] = [
    { key: "topo", label: "OpenTopoMap" },
    { key: "osm", label: "OpenStreetMap" },
    { key: "sat", label: "Satellit" },
];

export const BASES_CH: { key: Prefs["baseCH"]; label: string }[] = [
    { key: "ch", label: "swisstopo" },
    { key: "chsat", label: "swisstopo Luftbild" },
    { key: "topo", label: "OpenTopoMap" },
];
