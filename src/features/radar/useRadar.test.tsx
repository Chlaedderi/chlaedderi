/**
 * The radar must survive a bad moment of reception.
 *
 * This hook used to answer a failed `weather-maps.json` by dispatching `setRadar("off")`. The
 * settings are persisted, so that one line turned a dropped request at a crag into «the radar is
 * always off» for good, on every device the viewer owned. These tests pin down the rule that
 * replaced it: a failure may say so, and may stand something else in, but it may never touch what
 * the viewer chose.
 */

import { readFileSync } from "node:fs";

import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prefsActions } from "@app/slices/prefsSlice";
import { fetchFrames } from "@services/rainviewer";

import { makeStore, renderApp } from "../../test/harness";

import type { RadarKind } from "./RadarLayer";
import { useRadar } from "./useRadar";

vi.mock("@services/rainviewer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@services/rainviewer")>()),
    fetchFrames: vi.fn(),
}));

const mockFetchFrames = vi.mocked(fetchFrames);

const frames = { urls: ["a/{z}/{x}/{y}.png", "b/{z}/{x}/{y}.png"], times: [1, 2] };

/** The hook's result, so a test can read what the map would draw. */
let seen: ReturnType<typeof useRadar> | null = null;

const Probe = ({ kind = "rv" }: { readonly kind?: RadarKind }) => {
    seen = useRadar(kind, true);
    return null;
};

beforeEach(() => {
    seen = null;
    mockFetchFrames.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("a radar that cannot be fetched", () => {
    it("leaves the viewer's choice alone", async () => {
        mockFetchFrames.mockRejectedValue(new Error("offline"));
        const store = makeStore({ prefs: { ...makeStore().getState().prefs, radar: "rv" } });

        await act(async () => {
            renderApp(<Probe />, { store });
        });

        // The whole point: the choice is still what it was.
        expect(store.getState().prefs.radar).toBe("rv");
        expect(store.getState().ui.radarDown).toBe(true);
        expect(seen?.failed).toBe(true);
    });

    it("says so once, not once per retry", async () => {
        mockFetchFrames.mockRejectedValue(new Error("offline"));
        const store = makeStore({ prefs: { ...makeStore().getState().prefs, radar: "rv" } });

        await act(async () => {
            renderApp(<Probe />, { store });
        });
        const after = store.getState().ui.toasts.length;
        expect(after).toBe(1);

        // A second failure on the retry timer must not stack another one up.
        await act(async () => {
            await vi.waitFor(() => expect(mockFetchFrames).toHaveBeenCalled());
        });
        expect(store.getState().ui.toasts.length).toBe(after);
    });

    it("clears the failure once a retry succeeds", async () => {
        mockFetchFrames.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(frames);
        const store = makeStore({ prefs: { ...makeStore().getState().prefs, radar: "rv" } });

        await act(async () => {
            renderApp(<Probe />, { store });
        });
        expect(store.getState().ui.radarDown).toBe(true);

        // Coming back into reception is what the `online` listener is for.
        await act(async () => {
            window.dispatchEvent(new Event("online"));
            await vi.waitFor(() => expect(store.getState().ui.radarDown).toBe(false));
        });
        expect(store.getState().prefs.radar).toBe("rv");
        expect(seen?.frames).toEqual(frames);
    });
});

describe("the Italian radar falling over", () => {
    it("stands RainViewer in without rewriting the choice", async () => {
        mockFetchFrames.mockResolvedValue(frames);
        const store = makeStore({ prefs: { ...makeStore().getState().prefs, radar: "dpc" } });

        await act(async () => {
            renderApp(<Probe kind="dpc" />, { store });
        });

        await act(async () => {
            seen?.onLayerError("dpc");
        });

        expect(store.getState().prefs.radar).toBe("dpc");
        expect(store.getState().ui.radarDpcDown).toBe(true);
    });

    it("is forgotten when the viewer picks a radar again", () => {
        const store = makeStore();
        store.dispatch({ type: "ui/setRadarDpcDown", payload: true });
        store.dispatch({ type: "ui/setRadarDown", payload: true });

        store.dispatch(prefsActions.setRadar("dpc"));

        expect(store.getState().ui.radarDpcDown).toBe(false);
        expect(store.getState().ui.radarDown).toBe(false);
    });
});

describe("the rule itself", () => {
    /**
     * The guard that keeps this from coming back. `keys.test.ts` does the same trick for toasts
     * that would print a raw key -- a rule a reviewer cannot be relied on to remember is cheaper
     * to assert against the source.
     */
    it("never reaches for a preference from this hook", () => {
        const source = readFileSync("src/features/radar/useRadar.ts", "utf8");
        expect(source).not.toContain("prefsActions");
    });
});
