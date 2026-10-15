import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { encodeFilterCode } from "@core/filterCode";
import { emptyFilters } from "@core/filters";

import { makeStore, mountedShowcase, renderApp } from "../test/harness";

import { favouritesActions } from "./slices/favouritesSlice";
import { prefsActions } from "./slices/prefsSlice";
import { uiActions } from "./slices/uiSlice";

/** A store whose read-back is held until the test lets it go. */
const fake = vi.hoisted(() => {
    let release: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
        release = resolve;
    });
    const saved: Record<string, unknown> = {};
    const broken = { now: false };
    /** Whether a layer that outlives localStorage answered, and what the slow ones hold. */
    const layers = { durable: true, late: null as Record<string, unknown> | null };
    const set = vi.fn<
        (key: string, value: unknown) => Promise<{ ok: boolean; verified: boolean; t: number }>
    >(() => Promise.resolve({ ok: true, verified: true, t: Date.now() }));
    return {
        release: () => release(),
        saved,
        broken,
        layers,
        set,
        store: {
            ready,
            get: (key: string) =>
                broken.now
                    ? Promise.reject(new Error("unreadable"))
                    : Promise.resolve(saved[key] ?? null),
            set,
            subscribe: () => {},
            status: () => {
                const durable = layers.durable;
                // The slow layers answer after all, a moment later.
                if (!durable && layers.late) {
                    Object.assign(saved, layers.late);
                    layers.durable = true;
                }
                return { durable };
            },
        },
    };
});

vi.mock("@core/store", () => ({ openStore: () => fake.store }));

const { Persistence } = await import("./Persistence");

describe("Persistence", () => {
    it("writes no settings before the stored ones are read back", async () => {
        // localStorage had lost them; IndexedDB and the Cache still hold the installed region.
        const note = { id: "ow", src: { type: "url", url: "https://example.org/pack.ow.json" } };
        fake.saved.prefs = { ...makeStore().getState().prefs, packs: [note], region: "ow" };

        const store = makeStore();
        const legend = store.getState().prefs.legend;
        renderApp(<Persistence />, { store });
        // A setting changed at start, while the store is still being read.
        act(() => {
            store.dispatch(prefsActions.setFlag({ key: "legend", value: !legend }));
            // And the app, finding nothing installed, showed the showcase meanwhile.
            store.dispatch(prefsActions.setRegion("testing"));
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 600));
        });
        expect(fake.set.mock.calls.filter(([key]) => key === "prefs")).toEqual([]);

        fake.release();
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 600));
        });

        // The region came back, the change made meanwhile was kept, and what is written has both.
        expect(store.getState().prefs.packs.map((p) => p.id)).toEqual(["ow"]);
        expect(store.getState().prefs.legend).toBe(!legend);
        // The region the viewer left, not the stand-in picked while it was missing.
        expect(store.getState().prefs.region).toBe("ow");
        const written = fake.set.mock.calls.filter(([key]) => key === "prefs");
        expect(written.length).toBeGreaterThan(0);
        for (const [, value] of written) {
            expect((value as { packs: { id: string }[] }).packs.map((p) => p.id)).toEqual(["ow"]);
        }
    });

    it("writes nothing when what is stored could not be read at all", async () => {
        fake.release();
        fake.broken.now = true;
        onTestFinished(() => {
            fake.broken.now = false;
        });
        fake.set.mockClear();
        const store = makeStore();
        renderApp(<Persistence />, { store });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });
        // One favourite added: written now, it would be newer than every stored list and replace them.
        act(() => {
            store.dispatch(favouritesActions.toggleCrag("testing-musterwand"));
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 600));
        });
        expect(fake.set).not.toHaveBeenCalled();
        // And the viewer is told that what they change now will not be kept.
        expect(store.getState().ui.toasts.some((x) => x.severity === "warning")).toBe(true);
    });

    it("reads a view link's filters only once the region it offers is here", async () => {
        fake.release();
        const code = encodeFilterCode({ ...emptyFilters(), area: "Neuland" }, "area", 1)!;
        const base = makeStore().getState();
        const store = makeStore({
            ui: { ...base.ui, packOffer: { url: "https://example.org/pack.ow.json" } },
        });
        // While the offer stands, only the showcase is mounted, and it has no area «Neuland».
        const data = { ...mountedShowcase() };
        const { rerender } = renderApp(<Persistence />, { store, data, route: `/?f=${code}` });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // The region arrives with that area, and the offer closes.
        data.regions = [{ ...data.regions[0]!, key: "ow", areas: [{ name: "Neuland", n: 1 }] }];
        act(() => {
            store.dispatch(uiActions.clearOffer());
        });
        rerender(<Persistence />);
        await waitFor(() => expect(store.getState().filters.hydrated).toBe(true));
        expect(store.getState().filters.area).toBe("Neuland");
    });

    it("asks again before taking an empty answer from slow layers for «nothing stored»", async () => {
        fake.release();
        delete fake.saved.prefs;
        delete fake.saved.fav;
        delete fake.saved.log;
        fake.set.mockClear();
        const note = { id: "ow", src: { type: "url", url: "https://example.org/pack.ow.json" } };
        // IndexedDB and the Cache timed out on the first read; they hold the region all along.
        fake.layers.durable = false;
        fake.layers.late = { prefs: { ...makeStore().getState().prefs, packs: [note] } };
        onTestFinished(() => {
            fake.layers.durable = true;
            fake.layers.late = null;
        });

        const store = makeStore();
        renderApp(<Persistence />, { store });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        });
        // Nothing written over it in the meantime.
        expect(fake.set).not.toHaveBeenCalled();
        await waitFor(() => expect(store.getState().prefs.packs.map((p) => p.id)).toEqual(["ow"]), {
            timeout: 5000,
        });
    }, 10_000);
});
