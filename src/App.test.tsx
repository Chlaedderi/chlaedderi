import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { makeStore, mountedShowcase, renderApp } from "./test/harness";

/**
 * The whole app, screen by screen.
 *
 * react-leaflet is mocked: Leaflet measures its container and jsdom reports every element as 0×0,
 * so a real MapContainer here would tell us nothing. The map is checked in a browser instead; what
 * this verifies is the wiring -- routes, state, and that every screen renders with real pack data.
 */
vi.mock("react-leaflet", () => ({
    MapContainer: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="map">{children}</div>
    ),
    TileLayer: () => null,
    Marker: () => null,
    // PointCallout listens for the long press; nothing here fires one.
    useMapEvents: () => null,
    // Enough of a map for the layer components to attach to and clean up after.
    useMap: () => ({
        fitBounds: vi.fn(),
        flyToBounds: vi.fn(),
        invalidateSize: vi.fn(),
        stop: vi.fn(),
        getBounds: () => ({
            getSouth: () => 44,
            getNorth: () => 45,
            getWest: () => 8,
            getEast: () => 9,
        }),
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        hasLayer: () => false,
        on: vi.fn(),
        off: vi.fn(),
        getZoom: () => 13,
        getSize: () => ({ x: 800, y: 600 }),
        closePopup: vi.fn(),
        createPane: vi.fn(),
        getPane: () => ({ style: {} }),
    }),
}));
vi.mock("./features/map/CragMarkers", () => ({ CragMarkers: () => null }));
vi.mock("./features/map/ApproachLayer", () => ({ ApproachLayer: () => null }));
vi.mock("./features/map/AllPathsLayer", () => ({ AllPathsLayer: () => null }));
vi.mock("./features/map/ParkMarkers", () => ({ ParkMarkers: () => null }));
vi.mock("./features/map/MapLabels", () => ({ MapLabels: () => null }));
vi.mock("./features/map/CragCallout", () => ({ CragCallout: () => null }));

describe("the app", () => {
    it("opens on the map with the loaded region named", async () => {
        const data = mountedShowcase();
        renderApp(<App />);
        await waitFor(() => expect(screen.getByTestId("map")).toBeInTheDocument());
        // The showcase is a part of Finale, and the region segment says which region is shown.
        const seg = screen.getByRole("group", { name: "Region" });
        expect(
            within(seg).getByRole("button", { name: data.regions[0]!.name.en }),
        ).toBeInTheDocument();
        // «+» is always there, also with a single region: it is the way to load another.
        expect(within(seg).getByRole("button", { name: /Load a region/i })).toBeInTheDocument();
    });

    it("has the four places of the bottom navigation", async () => {
        renderApp(<App />);
        // "Favourites" names a quick chip too, so look inside the bottom bar itself.
        await screen.findByTestId("map");
        const bar = document.querySelector(".MuiBottomNavigation-root");
        expect(bar).not.toBeNull();
        for (const label of ["Map", "Favourites", "Logbook", "More"]) {
            expect(
                within(bar as HTMLElement).getByRole("button", { name: label }),
            ).toBeInTheDocument();
        }
    });

    // Given room: this picks the crag with the most routes, and the map now stays mounted beside
    // it rather than being torn down, so jsdom has 78 route rows and a whole map to lay out before
    // the lazily loaded page is on screen. It is the environment that is slow, not the app.
    it("opens a crag and lists its routes", { timeout: 20_000 }, async () => {
        const data = mountedShowcase();
        const crag = data.crags.find((c) => c.routes.length > 3)!;
        renderApp(<App />, { route: `/crag/${crag.id}` });

        // Level 2 is the crag page's own title; a list card carries the same name at level 5.
        expect(
            await screen.findByRole("heading", { name: crag.name, level: 2 }, { timeout: 15_000 }),
        ).toBeInTheDocument();
        for (const route of crag.routes.slice(0, 5)) {
            expect(screen.getByText(route.name)).toBeInTheDocument();
        }
    });

    /**
     * The map travels only when it is asked to, and these are the two asks that do not happen on
     * the map itself. A tap on a marker is the third case and the whole reason for the split -- it
     * must leave the view where the viewer put it -- but Leaflet is mocked out here, so that half
     * is pinned in `features/map/cameraPlan.test.ts` and watched for real in `e2e/camera.spec.ts`.
     */
    it("asks the map to travel for a link straight to a crag", async () => {
        const data = mountedShowcase();
        const crag = data.crags[0]!;
        const store = makeStore();
        renderApp(<App />, { route: `/crag/${crag.id}`, store, data });

        await waitFor(() => expect(store.getState().ui.selectedId).toBe(crag.id));
        expect(store.getState().ui.revealNonce).toBe(1);
    });

    it("asks the map to travel for a row in the list", async () => {
        const data = mountedShowcase();
        const store = makeStore();
        renderApp(<App />, { store, data });
        await waitFor(() => expect(screen.getByTestId("map")).toBeInTheDocument());
        // Nothing has asked it to move yet: it is still showing the region it opened on.
        expect(store.getState().ui.revealNonce).toBe(0);

        // A card's own title; the click reaches the whole row.
        fireEvent.click(screen.getAllByRole("heading", { level: 5 })[0]!);
        expect(store.getState().ui.revealNonce).toBe(1);
        expect(store.getState().ui.selectedId).not.toBeNull();
    });

    it("answers the old #<crag-id> deep link", async () => {
        const data = mountedShowcase();
        const crag = data.crags[0]!;
        renderApp(<App />, { route: `/${crag.id}` });
        expect(
            await screen.findByRole("heading", { name: crag.name, level: 2 }),
        ).toBeInTheDocument();
    });

    it("shows the favourites page, empty and then with a crag", async () => {
        const data = mountedShowcase();
        const crag = data.crags[0]!;
        const store = makeStore();
        const { unmount } = renderApp(<App />, { route: "/fav", store });
        expect(await screen.findByText(/Nothing saved yet/i)).toBeInTheDocument();
        unmount();

        store.dispatch({ type: "favourites/toggleCrag", payload: crag.id });
        renderApp(<App />, { route: "/fav", store });
        expect(await screen.findByText(crag.name)).toBeInTheDocument();
    });

    it("shows the logbook, empty and then with an entry", async () => {
        const data = mountedShowcase();
        const crag = data.crags[0]!;
        const store = makeStore();
        const { unmount } = renderApp(<App />, { route: "/log", store });
        expect(await screen.findByText(/No ascent entered yet/i)).toBeInTheDocument();
        unmount();

        store.dispatch({
            type: "logbook/upsert",
            payload: {
                id: "t1",
                k: crag.routes[0]?.key ?? null,
                s: crag.id,
                n: "Testroute",
                g: "6a",
                d: "2026-10-01",
                st: "rp",
                r: 4,
                t: 1,
            },
        });
        renderApp(<App />, { route: "/log", store });
        expect(await screen.findByText("Testroute")).toBeInTheDocument();
    });

    // Longer than the default: the converter now carries the sport table and the bouldering
    // table, which is a few hundred MUI table cells. That is slow in jsdom and quick in a real
    // browser -- e2e/screens.spec.ts renders the same page in well under a second.
    it("shows «Worth knowing» with the grade converter", { timeout: 20_000 }, async () => {
        renderApp(<App />, { route: "/know" });
        // A heading, not the intro paragraph -- that now mentions the converter too. MUI wraps
        // an accordion summary in a heading of its own, so there is more than one match.
        expect(
            (await screen.findAllByRole("heading", { name: /grade converter/i })).length,
        ).toBeGreaterThan(0);
        // The table converts French to UIAA by default. «6a» appears in the bouldering table
        // too, so one match is enough -- the point is that the table rendered at all.
        expect((await screen.findAllByText("6a")).length).toBeGreaterThan(0);
        // And the bouldering scale the original also carried -- named both in the column head
        // and in the section's own heading.
        expect((await screen.findAllByText(/V scale/i)).length).toBeGreaterThan(0);
    });

    it("lists the pack's own pages under More and opens one", async () => {
        const data = mountedShowcase();
        const pages = data.regions[0]!.text.pages ?? [];
        renderApp(<App />, { route: "/more" });
        // The sections the hand-written app had: settings, the app itself, and the way on.
        expect(await screen.findByText(/manage regions/i)).toBeInTheDocument();
        expect(screen.getByText(/what is covered|coverage/i)).toBeInTheDocument();

        if (!pages.length) return; // the showcase carries no pages: nothing more to check
        const page = pages[0]!;
        fireEvent.click(await screen.findByText(page.title.en));
        expect(await screen.findByRole("heading", { name: page.title.en })).toBeInTheDocument();
    });

    it("opens the filter drawer and narrows the list", async () => {
        const store = makeStore();
        renderApp(<App />, { store });
        fireEvent.click(await screen.findByRole("button", { name: "Filters" }));
        const drawer = await screen.findByRole("presentation");
        // Hiding the closures is a switch in the drawer.
        fireEvent.click(within(drawer).getByLabelText(/Hide crags with a closure/i));
        expect(store.getState().filters.flags.hideClosure).toBe(true);
    });

    it("switches language and keeps it in the settings", async () => {
        const store = makeStore();
        renderApp(<App />, { route: "/more", store });
        const select = await screen.findByLabelText("Language");
        fireEvent.mouseDown(select);
        fireEvent.click(await screen.findByRole("option", { name: "Deutsch" }));
        expect(store.getState().prefs.lang).toBe("de");
    });
});

describe("the shell the pre-React app had", () => {
    it("has search in the app bar, reachable from the map", async () => {
        renderApp(<App />);
        // Not inside the list: on the map -- the screen the app opens on -- it must still be there.
        const search = await screen.findByRole("searchbox", { name: /search crags/i });
        expect(search).toBeInTheDocument();
        expect(screen.getByTestId("map")).toBeInTheDocument();
    });

    it("narrows the list as you type, and clears again", async () => {
        const data = mountedShowcase();
        const first = data.crags[0]!;
        const other = data.crags.find((c) => c.name !== first.name)!;
        const store = makeStore();
        renderApp(<App />, { store });

        const search = await screen.findByRole("searchbox", { name: /search crags/i });
        fireEvent.change(search, { target: { value: first.name } });
        expect(store.getState().filters.q).toBe(first.name);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(store.getState().filters.q).toBe("");
        expect(other).toBeDefined();
    });

    it("offers the quick filters the original had, as toggles", async () => {
        const store = makeStore();
        renderApp(<App />, { store });

        // The five grade presets, then the one-tap filters.
        for (const label of ["3–4", "5a–5c", "6a–6c", "7a–7c", "8a+"]) {
            expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
        }
        const chips = screen.getByRole("group", { name: "Filters" });
        for (const label of [
            /★★★★/,
            /Favourites/,
            /Dry now/,
            /Rainproof/,
            /Dries fast/,
            /10 min/,
            /Topo/,
        ]) {
            expect(within(chips).getByRole("button", { name: label })).toBeInTheDocument();
        }

        // A preset sets the grade range, and tapping it again clears it.
        const preset = within(chips).getByRole("button", { name: "6a–6c" });
        fireEvent.click(preset);
        expect(store.getState().filters.gmin).toBe(30);
        expect(preset).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(preset);
        expect(store.getState().filters.gmin).toBe(12);
        expect(preset).toHaveAttribute("aria-pressed", "false");

        // And a plain chip toggles its own filter.
        const rainproof = within(chips).getByRole("button", { name: /Rainproof/ });
        fireEvent.click(rainproof);
        expect(store.getState().filters.one.rain).toBe("yes");
        fireEvent.click(rainproof);
        expect(store.getState().filters.one.rain).toBe("any");
    });

    it("counts the filters in the badge but not the search text", async () => {
        const store = makeStore();
        renderApp(<App />, { store });
        fireEvent.change(await screen.findByRole("searchbox", { name: /search crags/i }), {
            target: { value: "rocca" },
        });
        // The badge is about what the drawer hides; search has its own field, so it stays hidden.
        expect(document.querySelector(".MuiBadge-invisible")).not.toBeNull();

        const chips = screen.getByRole("group", { name: "Filters" });
        fireEvent.click(within(chips).getByRole("button", { name: /Rainproof/ }));
        expect(document.querySelector(".MuiBadge-invisible")).toBeNull();
        expect(screen.getByRole("button", { name: "Filters" }).textContent).toMatch(/1/);
    });

    it("shows how many crags match, and how many are on the map", async () => {
        const data = mountedShowcase();
        renderApp(<App />);
        const count = new RegExp(`${data.crags.length} of ${data.crags.length} crags`);
        expect(await screen.findByText(count)).toBeInTheDocument();
    });
});
