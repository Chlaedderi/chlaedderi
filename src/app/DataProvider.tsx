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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { openStore } from "@core/store";
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

    // Every installed pack read back out of the Cache Storage, so the app works offline. Not only
    // at start: the list of installed packs may itself arrive late, read back from IndexedDB or
    // the Cache when localStorage had lost it -- and a region listed then and never read would be
    // «installed» in the packs dialog while the map showed the showcase.
    const tried = useRef(new Set<string>());
    /** Regions being read out of the cache right now: listed, not mounted yet, not given up on. */
    // A ref for the check, which runs in the same commit as the effect that starts the read, and
    // state so that the check runs again once the read is over, whichever way it went.
    const loadingNow = useRef(new Set<string>());
    const [loading, setLoading] = useState<ReadonlySet<string>>(() => new Set());
    const started = useRef(false);
    const latestInstalled = useRef(installed);
    latestInstalled.current = installed;
    /** Put in place by install() and not yet in the list a pending effect may still be holding. */
    const justInstalled = useRef(new Set<string>());
    useEffect(() => {
        for (const note of installed) justInstalled.current.delete(note.id);
        // A region unloaded elsewhere -- another tab -- goes here too, and may be read anew later.
        const listed = new Set([...installed.map((note) => note.id), ...justInstalled.current]);
        for (const id of [...tried.current]) if (!listed.has(id)) tried.current.delete(id);
        setPacks((current) =>
            current.every((p) => listed.has(p.id))
                ? current
                : current.filter((p) => listed.has(p.id)),
        );
        const fresh = installed.filter((note) => !tried.current.has(note.id));
        for (const note of fresh) tried.current.add(note.id);
        // Nothing new after the first pass: nothing to do. The first pass always runs, so that
        // `booted` is said even with nothing installed -- and only it says so the first time.
        if (!fresh.length && started.current) return;
        const first = !started.current;
        started.current = true;
        const ids = fresh.map((note) => note.id);
        for (const id of ids) loadingNow.current.add(id);
        if (ids.length) setLoading(new Set(loadingNow.current));
        void (async () => {
            const loaded: Mappack[] = [];
            for (const note of fresh) {
                // One region that cannot be read must not keep the others -- and the app's start
                // -- from happening.
                const result = await loadStoredPack(note.id).catch(() => null);
                if (result?.ok) loaded.push(result.pack);
            }
            // Merge, never replace. A pack installed from a link while this was still reading
            // three big ones out of the cache would otherwise be wiped back out of `packs` --
            // leaving a region the viewer was just told is loaded, and is not, until a reload.
            // Not cancelled on unmount either: a second run skips what the first already took on,
            // so the first has to see it through.
            // And only what is still listed: a region unloaded while it was being read stays gone.
            const still = new Set(latestInstalled.current.map((note) => note.id));
            setPacks((current) => [
                ...loaded.filter((p) => still.has(p.id) && !current.some((c) => c.id === p.id)),
                ...current,
            ]);
            if (ids.length) {
                for (const id of ids) loadingNow.current.delete(id);
                setLoading(new Set(loadingNow.current));
            }
            if (first) setBooted(true);
        })();
    }, [installed]);

    const mounted = useMemo(() => mountPacks(packs.length ? packs : [showcase]), [packs]);

    const install = useCallback(
        async (
            load: PackLoad & { text?: string },
            source: { type: "url" | "file"; url?: string; name?: string; key?: string },
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
                // A region is now really on the device, so this is the moment to ask the browser
                // to keep it. Nothing asked before, and `persisted()` answers false until
                // something does -- so the packs dialog warned every installed viewer that their
                // region could be evicted, whatever the device would actually have done.
                // Not awaited: Firefox puts a permission prompt in front of this, and the
                // `finally` below would hold the progress bar up for as long as it stands there.
                // The answer lands in the store's status either way, which is what the favourites
                // page reads.
                void openStore().persist();
                // Already in hand: the read-back above has nothing to fetch for it.
                tried.current.add(load.pack.id);
                justInstalled.current.add(load.pack.id);
                setPacks((current) => [...current.filter((p) => p.id !== load.pack.id), load.pack]);
                const note = packNote(load.pack, source, load.bytes);
                dispatch(prefsActions.putPack(note));
                dispatch(prefsActions.setRegion(load.pack.id));
                // The region is on the device now, which is the best reason there is to put the
                // app on the home screen as well.
                dispatch(uiActions.installMoment("pack"));
                return load;
            } finally {
                setBusy(false);
            }
        },
        [dispatch],
    );

    const installFromUrl = useCallback(
        async (url: string, key?: string, expect?: string): Promise<PackLoad> => {
            // Busy from the first byte, not only once the download is in: «unload» pressed while
            // «fetch again» was still downloading was undone the moment the download finished.
            setBusy(true);
            try {
                const load = await fetchPack(url, undefined, key);
                // «Fetch again» is for the region it sits beside. An address that now serves some
                // other id would overwrite that region unasked -- the warning that says so lives
                // in the offer dialog, which this path never passes through.
                if (load.ok && expect !== undefined && load.pack.id !== expect) {
                    const problem = {
                        where: "",
                        message: `the address now serves ${load.pack.id}, not ${expect}`,
                        code: "otherid",
                        detail: load.pack.id,
                    } as const;
                    return { ok: false, problems: [problem] };
                }
                // What is remembered is the address that answered, not the one that was pasted: it
                // is what «fetch again» asks for, and what a link to this region will carry -- with
                // the key beside it, for a region that arrived locked.
                return await install(load, { type: "url", url: load.url, key });
            } finally {
                setBusy(false);
            }
        },
        [install],
    );

    /** The confirmation dialog's way in: it has already fetched and checked the pack. */
    const installLoaded = useCallback(
        async (
            load: PackLoad & { text: string },
            source: { type: "url"; url: string; key?: string },
        ) => install(load, source),
        [install],
    );

    const installFromFile = useCallback(
        async (file: File, key?: string) => {
            setBusy(true);
            try {
                return await install(await readPackFile(file, key), {
                    type: "file",
                    name: file.name,
                    key,
                });
            } finally {
                setBusy(false);
            }
        },
        [install],
    );

    const uninstall = useCallback(
        async (id: string) => {
            setBusy(true);
            try {
                await forgetPack(id);
                tried.current.delete(id);
                justInstalled.current.delete(id);
                setPacks((current) => current.filter((p) => p.id !== id));
                dispatch(prefsActions.dropPack(id));
            } finally {
                setBusy(false);
            }
        },
        [dispatch],
    );

    // Keep the region shown pointing at something that is actually mounted.
    const region = useAppSelector((s) => s.prefs.region);
    useEffect(() => {
        if (!booted) return;
        const keys = mounted.regions.map((r) => r.key);
        // A region still being read is about to be here: switching away now would lose the
        // viewer's region -- read back late, or chosen in another tab -- to whichever comes first.
        if (region && loadingNow.current.has(region)) return;
        if (region && !keys.includes(region)) {
            dispatch(prefsActions.setRegion(keys[0] ?? null));
        } else if (!region && keys.length) {
            dispatch(prefsActions.setRegion(keys[0]!));
        }
    }, [booted, dispatch, mounted.regions, region, loading]);

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
