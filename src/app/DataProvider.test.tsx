import { act, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PackLoad } from "@core/packs/storage";

import { makeStore, showcase } from "../test/harness";

import { useData } from "./dataContext";
import { DataProvider } from "./DataProvider";

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
});
