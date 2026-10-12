/**
 * The hooks that join the store state to the mounted packs: the filtered list, the region shown,
 * the pack's own words. Everything that needs both halves goes through here.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useData } from "@app/dataContext";
import { useAppSelector } from "@app/hooks";
import {
    selectDir,
    selectFilterContextBase,
    selectFilters,
    selectLogIndex,
    selectSort,
} from "@app/selectors";
import { useWeather } from "@app/weatherContext";
import { type CragMatch, type FilterContext, applyFilters } from "@core/filters";
import { haversine } from "@core/geo";
import { type Lang, isLang } from "@core/lang";
import type { Crag, Region } from "@domain/model";

/** The language actually in force, from i18next rather than from the stored preference. */
export const useLang = (): Lang => {
    const { i18n } = useTranslation();
    return isLang(i18n.language) ? i18n.language : "en";
};

/** The region whose crags and words are on screen. */
export const useRegion = (): Region | null => {
    const { regions } = useData();
    const key = useAppSelector((s) => s.prefs.region);
    return useMemo(() => regions.find((r) => r.key === key) ?? regions[0] ?? null, [regions, key]);
};

/** The region a given crag came with -- the pack that holds its words. */
export const useRegionOf = (crag: Crag | null | undefined): Region | null => {
    const { regions } = useData();
    return useMemo(
        () => (crag ? (regions.find((r) => r.key === crag.packId) ?? null) : null),
        [regions, crag],
    );
};

/**
 * The address the region holding this crag was loaded from, for a link that carries it.
 *
 * Null for the showcase and for anything installed from a file: neither has an address, and a
 * link to such a crag stays exactly what it always was. Read in the parent rather than inside
 * `useShare`, which is called once per route row.
 */
export const usePackUrlOf = (crag: Crag | null | undefined): string | null => {
    const packs = useAppSelector((s) => s.prefs.packs);
    return useMemo(() => {
        if (!crag) return null;
        const note = packs.find((p) => p.id === crag.packId);
        return note?.src?.type === "url" ? (note.src.url ?? null) : null;
    }, [packs, crag]);
};

/**
 * The key a region was opened with, for the link that carries it on. Null for a plain region,
 * which is most of them -- see src/core/packs/chlpack.ts for why a locked one needs it.
 */
export const usePackKeyOf = (crag: Crag | null | undefined): string | null => {
    const packs = useAppSelector((s) => s.prefs.packs);
    return useMemo(() => {
        if (!crag) return null;
        const note = packs.find((p) => p.id === crag.packId);
        return note?.src?.type === "url" ? (note.src.key ?? null) : null;
    }, [packs, crag]);
};

/**
 * Where the region on screen came from, for a link that carries it.
 *
 * The same answer `usePackUrlOf`/`usePackKeyOf` give for a crag, asked of the region itself --
 * which is what a link to a *view* needs, a view having no one crag to ask about. Null for the
 * built-in showcase and for anything installed from a file: neither has an address to hand on.
 */
export const useRegionSource = (): { url: string; key: string | null } | null => {
    const packs = useAppSelector((s) => s.prefs.packs);
    const region = useRegion();
    return useMemo(() => {
        if (!region) return null;
        const note = packs.find((p) => p.id === region.key);
        if (note?.src?.type !== "url" || !note.src.url) return null;
        return { url: note.src.url, key: note.src.key ?? null };
    }, [packs, region]);
};

/** The crags of the region shown. Filters apply inside one region, as they always have. */
export const useRegionCrags = (): readonly Crag[] => {
    const { crags } = useData();
    const region = useRegion();
    return useMemo(
        () => (region ? crags.filter((c) => c.packId === region.key) : crags),
        [crags, region],
    );
};

/** The whole context the filter functions need. */
export const useFilterContext = (): FilterContext => {
    const base = useAppSelector(selectFilterContextBase);
    const me = useAppSelector((s) => s.ui.me);
    const region = useRegion();
    const { stateOf, at: weatherAt } = useWeather();

    return useMemo(() => {
        const areaIndex: Record<string, number> = {};
        region?.areas.forEach((a, i) => {
            areaIndex[a.name] = i;
        });
        return {
            ...base,
            // «dry» or «wet» as far as the rain model knows; null until a forecast is loaded, which
            // is what makes the weather filter show nothing rather than everything.
            wxState: weatherAt
                ? (crag: Crag) => {
                      const state = stateOf(crag);
                      return state == null ? null : state === "dry" ? "dry" : "wet";
                  }
                : undefined,
            areaIndex,
            distance: me
                ? (crag: Crag) =>
                      crag.lat == null || crag.lon == null
                          ? null
                          : haversine(me.lat, me.lon, crag.lat, crag.lon)
                : undefined,
        };
    }, [base, region, me, stateOf, weatherAt]);
};

/** The filtered, sorted list the map and the list both read. */
export const useShownCrags = (): readonly CragMatch[] => {
    const crags = useRegionCrags();
    const filters = useAppSelector(selectFilters);
    const sort = useAppSelector(selectSort);
    const dir = useAppSelector(selectDir);
    const ctx = useFilterContext();
    return useMemo(
        () => applyFilters(crags, filters, sort, dir, ctx),
        [crags, filters, sort, dir, ctx],
    );
};

export const useLogIndex = (): ReturnType<typeof selectLogIndex> => useAppSelector(selectLogIndex);
