/**
 * The mounted mappacks.
 *
 * Deliberately not in the Redux store: a mounted set is ~400 crags and ~8100 routes of immutable,
 * derived data, which is cheap to hold in a context and expensive to serialise through devtools on
 * every action. Redux keeps what the viewer changes; this keeps what the packs say.
 *
 * The showcase travels inside the app so that a fresh install has something to look at. It is
 * dropped as soon as a real pack is installed, and comes back when the last one is removed.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { mountPacks } from "@core/packs/mount";
import {
    type PackLoad,
    fetchPack,
    forgetPack,
    loadStoredPack,
    packNote,
    readPackFile,
    storePack,
} from "@core/packs/storage";
import type { Mappack } from "@domain/mappack";
import showcaseJson from "@maps/pack.showcase.json";

import { DataContext, type DataContextValue } from "./dataContext";
import { useAppDispatch, useAppSelector } from "./hooks";
import { prefsActions } from "./slices/prefsSlice";
import { uiActions } from "./slices/uiSlice";

const showcase = showcaseJson as unknown as Mappack;

/** Supply the mounted data directly. Used by the test harness, which has no Cache Storage. */
export const DataTestProvider = ({
    value,
    children,
}: {
    value: DataContextValue;
    children: ReactNode;
}) => <DataContext.Provider value={value}>{children}</DataContext.Provider>;

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const dispatch = useAppDispatch();
    const installed = useAppSelector((s) => s.prefs.packs);
    const [packs, setPacks] = useState<Mappack[]>([]);
    const [busy, setBusy] = useState(false);
    const [booted, setBooted] = useState(false);

    // At start, read every installed pack back out of the Cache Storage, so the app works offline.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const loaded: Mappack[] = [];
            for (const note of installed) {
                const result = await loadStoredPack(note.id);
                if (result.ok) loaded.push(result.pack);
            }
            if (!cancelled) {
                // Merge, never replace. A pack installed from a link while this was still reading
                // three big ones out of the cache would otherwise be wiped back out of `packs` --
                // leaving a region the viewer was just told is loaded, and is not, until a reload.
                setPacks((current) => [
                    ...loaded.filter((p) => !current.some((c) => c.id === p.id)),
                    ...current,
                ]);
                setBooted(true);
            }
        })();
        return () => {
            cancelled = true;
        };
        // Only at start: later changes go through install/uninstall, which set `packs` themselves.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const mounted = useMemo(() => mountPacks(packs.length ? packs : [showcase]), [packs]);

    const install = useCallback(
        async (
            load: PackLoad & { text?: string },
            source: { type: "url" | "file"; url?: string; name?: string },
        ): Promise<PackLoad> => {
            if (!load.ok) return load;
            setBusy(true);
            try {
                // A pack that cannot be kept must not be half-installed: the note would survive
                // the data and the region would be listed as loaded while nothing could read it.
                // Safari in private mode is where this actually happens.
                if (load.text && !(await storePack(load.pack.id, load.text))) {
                    return {
                        ok: false,
                        problems: [
                            {
                                where: "",
                                message: "could not be kept on this device",
                                code: "nostore",
                            },
                        ],
                    };
                }
                setPacks((current) => [...current.filter((p) => p.id !== load.pack.id), load.pack]);
                const note = packNote(load.pack, source, load.bytes);
                dispatch(
                    prefsActions.setPacks([...installed.filter((p) => p.id !== note.id), note]),
                );
                dispatch(prefsActions.setRegion(load.pack.id));
                return load;
            } finally {
                setBusy(false);
            }
        },
        [dispatch, installed],
    );

    const installFromUrl = useCallback(
        async (url: string) => {
            const load = await fetchPack(url);
            // What is remembered is the address that answered, not the one that was pasted: it is
            // what «fetch again» asks for, and what a link to this region will carry.
            return install(load, { type: "url", url: load.url });
        },
        [install],
    );

    /** The confirmation dialog's way in: it has already fetched and checked the pack. */
    const installLoaded = useCallback(
        async (load: PackLoad & { text: string }, source: { type: "url"; url: string }) =>
            install(load, source),
        [install],
    );

    const installFromFile = useCallback(
        async (file: File) => install(await readPackFile(file), { type: "file", name: file.name }),
        [install],
    );

    const uninstall = useCallback(
        async (id: string) => {
            setBusy(true);
            try {
                await forgetPack(id);
                setPacks((current) => current.filter((p) => p.id !== id));
                dispatch(prefsActions.setPacks(installed.filter((p) => p.id !== id)));
            } finally {
                setBusy(false);
            }
        },
        [dispatch, installed],
    );

    // Keep the region shown pointing at something that is actually mounted.
    const region = useAppSelector((s) => s.prefs.region);
    useEffect(() => {
        if (!booted) return;
        const keys = mounted.regions.map((r) => r.key);
        if (region && !keys.includes(region)) {
            dispatch(prefsActions.setRegion(keys[0] ?? null));
        } else if (!region && keys.length) {
            dispatch(prefsActions.setRegion(keys[0]!));
        }
    }, [booted, dispatch, mounted.regions, region]);

    // Tell the viewer once when the app is running on the showcase alone.
    useEffect(() => {
        if (booted && !packs.length) dispatch(uiActions.setListOpen(false));
    }, [booted, dispatch, packs.length]);

    const value = useMemo<DataContextValue>(
        () => ({
            ...mounted,
            booted,
            onlyShowcase: packs.length === 0,
            busy,
            installFromUrl,
            installFromFile,
            installLoaded,
            uninstall,
        }),
        [
            mounted,
            booted,
            packs.length,
            busy,
            installFromUrl,
            installFromFile,
            installLoaded,
            uninstall,
        ],
    );

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
