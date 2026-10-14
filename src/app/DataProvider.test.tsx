import { act, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PackLoad } from "@core/packs/storage";

import { makeStore, showcase } from "../test/harness";

import { useData } from "./dataContext";
import { DataProvider } from "./DataProvider";
import { prefsActions } from "./slices/prefsSlice";

vi.mock("@core/packs/storage", async (original) => ({
    ...(await original<typeof import("@core/packs/storage")>()),
    // Whatever is asked for is on the device, as the showcase renamed.
    loadStoredPack: (id: string) =>
        Promise.resolve({ ok: true, pack: { ...(showcase as object), id }, bytes: 1 }),
}));

afterEach(() => vi.restoreAllMocks());

const answer = (body: unknown): Response =>
    new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

describe("DataProvider", () => {
    it("does not let «fetch again» overwrite a different region", async () => {
        // The address of region «ow» now serves a pack with the id «other».
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(answer({ ...(showcase as object), id: "other" })),
        ) as unknown as typeof fetch;
        const base = makeStore().getState();
        const store = makeStore({
            prefs: {
                ...base.prefs,
                packs: [
                    { id: "ow", src: { type: "url", url: "https://example.org/pack.ow.json" } },
                    { id: "other", src: { type: "url", url: "https://example.org/other.json" } },
                ],
            },
        });
        let api: ReturnType<typeof useData> | null = null;
        const Probe = () => {
            api = useData();
            return null;
        };
        render(
            <Provider store={store}>
                <DataProvider>
                    <Probe />
                </DataProvider>
            </Provider>,
        );
        await waitFor(() => expect(api?.booted).toBe(true));

        let load: PackLoad | null = null;
        await act(async () => {
            load = await api!.installFromUrl("https://example.org/pack.ow.json", undefined, "ow");
        });

        expect(load).toMatchObject({ ok: false, problems: [{ code: "otherid", detail: "other" }] });
        // The other region keeps the address it came from.
        const other = store.getState().prefs.packs.find((p) => p.id === "other");
        expect(other?.src?.url).toBe("https://example.org/other.json");
    });

    it("loads a region whose note arrives after the start", async () => {
        const store = makeStore();
        let api: ReturnType<typeof useData> | null = null;
        const Probe = () => {
            api = useData();
            return null;
        };
        render(
            <Provider store={store}>
                <DataProvider>
                    <Probe />
                </DataProvider>
            </Provider>,
        );
        await waitFor(() => expect(api?.booted).toBe(true));
        expect(api!.onlyShowcase).toBe(true);

        // The installed list read back late, from IndexedDB, after localStorage had lost it.
        act(() => {
            store.dispatch(
                prefsActions.restore({
                    ...store.getState().prefs,
                    packs: [{ id: "ow", src: { type: "url", url: "https://example.org/ow.json" } }],
                }),
            );
        });

        await waitFor(() => expect(api!.regions.map((r) => r.key)).toEqual(["ow"]));

        // Unloaded in another tab: it goes here too.
        act(() => {
            store.dispatch(prefsActions.restore({ ...store.getState().prefs, packs: [] }));
        });
        await waitFor(() => expect(api!.onlyShowcase).toBe(true));
    });

    it("keeps a region read back late while it is still being loaded", async () => {
        const store = makeStore();
        let api: ReturnType<typeof useData> | null = null;
        const Probe = () => {
            api = useData();
            return null;
        };
        render(
            <Provider store={store}>
                <DataProvider>
                    <Probe />
                </DataProvider>
            </Provider>,
        );
        await waitFor(() => expect(api?.booted).toBe(true));

        // Two regions, and the viewer had left the second one open.
        act(() => {
            store.dispatch(
                prefsActions.restore({
                    ...store.getState().prefs,
                    region: "zz",
                    packs: [
                        { id: "aa", src: { type: "url", url: "https://example.org/aa.json" } },
                        { id: "zz", src: { type: "url", url: "https://example.org/zz.json" } },
                    ],
                }),
            );
        });

        await waitFor(() => expect(api!.regions).toHaveLength(2));
        expect(store.getState().prefs.region).toBe("zz");
    });
});
