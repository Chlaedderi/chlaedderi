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
    it("marks an invented crag on its page while a real region is selected", () => {
        // Opened from the favourites, the logbook or a record, a crag keeps the region it was
        // opened from -- the strip must follow the crag on the page too.
        const data = twoRegions();
        const invented = data.crags.find((c) => c.packId === showcase.id)!;
        const store = makeStore();
        store.dispatch(prefsActions.setRegion("real"));
        renderApp(<DemoNotice />, { data, store, route: `/crag/${invented.id}` });
        expect(screen.getByTestId("demo-strip")).toBeInTheDocument();
    });

    it("stays on the invented region's screens after a real crag was opened", () => {
        // A real crag opened from the favourites leaves its id selected; back on the list of the
        // invented region, that stale selection must not take the strip away.
        const data = twoRegions();
        const real = data.crags.find((c) => c.packId === "real")!;
        const store = makeStore();
        store.dispatch(prefsActions.setRegion(showcase.id));
        store.dispatch(uiActions.select(real.id));
        renderApp(<DemoNotice />, { data, store, route: "/" });
        expect(screen.getByTestId("demo-strip")).toBeInTheDocument();
    });

    it("marks an invented crag's card on the map while a real region is selected", () => {
        // «Show on the map» from an invented crag's page opens its card over the real region.
        const data = twoRegions();
        const invented = data.crags.find((c) => c.packId === showcase.id)!;
        const store = makeStore();
        store.dispatch(prefsActions.setRegion("real"));
        store.dispatch(uiActions.reveal(invented.id));
        renderApp(<DemoNotice />, { data, store, route: "/" });
        expect(screen.getByTestId("demo-strip")).toBeInTheDocument();
    });

    it("keeps marking it when the card is put away and its approach stays drawn", () => {
        const data = twoRegions();
        const invented = data.crags.find((c) => c.packId === showcase.id)!;
        const store = makeStore();
        store.dispatch(prefsActions.setRegion("real"));
        store.dispatch(uiActions.reveal(invented.id));
        store.dispatch(uiActions.hideCallout());
        renderApp(<DemoNotice />, { data, store, route: "/" });
        expect(screen.getByTestId("demo-strip")).toBeInTheDocument();
    });

    it("leaves a real region's screens unmarked", () => {
        const data = twoRegions();
        const real = data.crags.find((c) => c.packId === "real")!;
        const store = makeStore();
        store.dispatch(prefsActions.setRegion("real"));
        renderApp(<DemoNotice />, { data, store, route: `/crag/${real.id}` });
        expect(screen.queryByTestId("demo-strip")).toBeNull();
    });
});
