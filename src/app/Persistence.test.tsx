import { act } from "@testing-library/react";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { makeStore, renderApp } from "../test/harness";

import { favouritesActions } from "./slices/favouritesSlice";
import { prefsActions } from "./slices/prefsSlice";

/** A store whose read-back is held until the test lets it go. */
const fake = vi.hoisted(() => {
    let release: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
        release = resolve;
    });
    const saved: Record<string, unknown> = {};
    const broken = { now: false };
    const set = vi.fn<
        (key: string, value: unknown) => Promise<{ ok: boolean; verified: boolean; t: number }>
    >(() => Promise.resolve({ ok: true, verified: true, t: Date.now() }));
    return {
        release: () => release(),
        saved,
        broken,
        set,
        store: {
            ready,
            get: (key: string) =>
                broken.now
                    ? Promise.reject(new Error("unreadable"))
                    : Promise.resolve(saved[key] ?? null),
            set,
            subscribe: () => {},
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
    });
});
