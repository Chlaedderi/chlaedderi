/**
 * The filters, mirrored into the address bar.
 *
 * So that copying the URL shares the view, and not merely the screen it was taken from. The code
 * itself is filterCode.ts; this is only the question of when to write it.
 *
 * Three rules, each of which something depends on:
 *
 *   - **Only on `/` and `/crag/:id`**, the screens where filters do anything. `/fav`, `/log`,
 *     `/more` and the rest keep clean URLs -- and, just as much to the point, `*` is `LegacyLink`
 *     and `/pack` is `PackLink`, both of which read the query and act on it.
 *   - **Nothing before the filters are hydrated.** The read-back in Persistence.tsx waits for the
 *     data to arrive; on a cold cache that is later than this component's first chance to write.
 *     Writing a code for the defaults in the meantime would leave the read-back reading a URL this
 *     component had just invented, and the filters on the device would be gone.
 *   - **Nothing at all for a view at rest**: `encodeFilterCode` answers null and the parameter is
 *     removed, so an untouched app leaves `#/` exactly as it found it.
 *
 * Always `replace`, never a push: one history entry per pixel of the grade slider would bury the
 * back button. A change to the query alone cannot remount the map -- react-router renders matches
 * without a key, so the same routes keep the same component instances, and Leaflet is not torn
 * down.
 */

import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { FILTER_PARAM, encodeFilterCode } from "@core/filterCode";

import { useAppSelector } from "./hooks";
import { selectDir, selectFilters, selectSort } from "./selectors";
import { useDebouncedWrite } from "./useDebouncedWrite";

/** The screens the filters are about. */
const filtersApplyTo = (pathname: string): boolean =>
    pathname === "/" || pathname.startsWith("/crag/");

export const FilterUrl = () => {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    const filters = useAppSelector(selectFilters);
    const sort = useAppSelector(selectSort);
    const dir = useAppSelector(selectDir);
    const hydrated = useAppSelector((s) => s.filters.hydrated);

    const write = useCallback(
        ({ code, at, from }: { code: string | null; at: string; from: string }) => {
            const params = new URLSearchParams(from);
            // Compare the one parameter rather than the whole string: `URLSearchParams` is free to
            // spell `pack=…` back differently from how it arrived, and a navigate for that alone
            // would re-render the map for no change anybody asked for.
            if ((params.get(FILTER_PARAM) ?? null) === code) return;
            if (code) params.set(FILTER_PARAM, code);
            else params.delete(FILTER_PARAM);
            void navigate({ pathname: at, search: params.toString() }, { replace: true });
        },
        [navigate],
    );

    const mirror = useMemo(() => {
        const on = hydrated && filtersApplyTo(pathname);
        return {
            on,
            code: on ? encodeFilterCode(filters, sort, dir) : null,
            at: pathname,
            from: search,
        };
    }, [hydrated, pathname, search, filters, sort, dir]);

    useDebouncedWrite(mirror, ({ on, ...rest }) => {
        if (on) write(rest);
    });

    return null;
};
