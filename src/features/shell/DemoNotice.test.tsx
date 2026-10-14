import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { mountPacks } from "@core/packs/mount";
import type { Mappack } from "@domain/mappack";

import { makeStore, mountedShowcase, renderApp, showcase } from "../../test/harness";

import { DemoNotice } from "./DemoNotice";

/** The invented showcase beside a «real» region: the same pack, renamed and not fictional. */
const twoRegions = () => {
    const real = {
        ...showcase,
        id: "real",
        fictional: false,
        sectors: showcase.sectors.map((s) => ({ ...s, id: `real-${s.id}` })),
    } as unknown as Mappack;
    return { ...mountedShowcase(), ...mountPacks([showcase, real]) };
};

describe("the demo notice", () => {
    it("marks an invented crag on screen while a real region is selected", () => {
        // Opened from the favourites, the logbook or a record, a crag keeps the region it was
        // opened from -- the strip must follow the crag, not the selection.
        const data = twoRegions();
        const invented = data.crags.find((c) => c.packId === showcase.id)!;
        const store = makeStore();
        store.dispatch(prefsActions.setRegion("real"));
        store.dispatch(uiActions.select(invented.id));
        renderApp(<DemoNotice />, { data, store });
        expect(screen.getByTestId("demo-strip")).toBeInTheDocument();
    });

    it("does not mark a real crag while the invented region is selected", () => {
        const data = twoRegions();
        const real = data.crags.find((c) => c.packId === "real")!;
        const store = makeStore();
        store.dispatch(prefsActions.setRegion(showcase.id));
        store.dispatch(uiActions.select(real.id));
        renderApp(<DemoNotice />, { data, store });
        expect(screen.queryByTestId("demo-strip")).toBeNull();
    });
});
