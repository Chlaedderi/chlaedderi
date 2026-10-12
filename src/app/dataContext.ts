/**
 * The context the mounted mappacks travel in, and the hook that reads it.
 *
 * Separate from DataProvider.tsx so that file exports components only -- fast refresh replaces a
 * module's components in place, and cannot do that for a module that also exports a hook.
 */

import { createContext, useContext } from "react";

import type { PackLoad } from "@core/packs/storage";
import type { MountedData } from "@domain/model";

export interface DataContextValue extends MountedData {
    /** The stored packs have been read and mounted. Until then `byId` is still empty. */
    readonly booted: boolean;
    /** Only the showcase is mounted: no real pack has been installed yet. */
    readonly onlyShowcase: boolean;
    /** A pack is being installed or removed. */
    readonly busy: boolean;
    readonly installFromUrl: (url: string, key?: string) => Promise<PackLoad>;
    readonly installFromFile: (file: File, key?: string) => Promise<PackLoad>;
    /**
     * Install a pack that has already been fetched and checked.
     *
     * The confirmation dialog has the pack in its hand by the time the viewer says yes; fetching
     * again would be a second 644 kB on a mobile connection, because `fetchPack` deliberately
     * asks with `cache: "no-store"`. The text is required, not optional: a pack installed without
     * it never reaches the Cache Storage and is gone at the next start, while its note stays.
     */
    readonly installLoaded: (
        load: PackLoad & { readonly text: string },
        source: { type: "url"; url: string; key?: string },
    ) => Promise<PackLoad>;
    readonly uninstall: (id: string) => Promise<void>;
}

export const DataContext = createContext<DataContextValue | null>(null);

export const useData = (): DataContextValue => {
    const value = useContext(DataContext);
    if (!value) throw new Error("useData outside DataProvider");
    return value;
};
