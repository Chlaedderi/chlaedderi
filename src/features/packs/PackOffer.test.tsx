import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeStore, mountedShowcase, renderApp, showcase } from "../../test/harness";

import { PackOffer } from "./PackOffer";

/**
 * The dialog that stands between a link somebody sent and a region on the device.
 *
 * It is the whole of the feature's safety, so what is asserted here is what a viewer needs in
 * order to answer: which host it really comes from, whether it would replace a region they have,
 * and that nothing is fetched until they say so.
 */

/**
 * A real pack, renamed. Built from the showcase rather than by hand so that it actually passes
 * the schema -- a fixture that does not is a test of the validator, not of the dialog.
 */
const pack = (over: Record<string, unknown> = {}) => ({
    ...(showcase as unknown as Record<string, unknown>),
    id: "ow",
    name: { en: "Obwalden", de: "Obwalden" },
    version: "2026-10-10",
    partial: false,
    ...over,
});

const answer = (body: unknown): Response =>
    new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

const offering = (offer: Record<string, unknown>) =>
    makeStore({ ui: { ...makeStore().getState().ui, packOffer: offer } });

afterEach(() => vi.restoreAllMocks());

describe("PackOffer", () => {
    it("names the host before anything is fetched, and fetches only when asked", async () => {
        const fetched = vi.fn(() => Promise.resolve(answer(pack())));
        globalThis.fetch = fetched as unknown as typeof fetch;

        renderApp(<PackOffer />, {
            store: offering({ url: "https://example.org/packs/pack.ow.json" }),
        });

        expect(await screen.findByText(/from example\.org/i)).toBeInTheDocument();
        expect(fetched).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /check this region/i }));
        await waitFor(() => expect(fetched).toHaveBeenCalledOnce());
        expect(await screen.findByText("Obwalden")).toBeInTheDocument();
    });

    it("shows the host the browser would really reach, not the one the address reads as", async () => {
        globalThis.fetch = vi.fn(() => Promise.resolve(answer(pack()))) as unknown as typeof fetch;

        renderApp(<PackOffer />, {
            store: offering({ url: "https://raw.githubusercontent.com@evil.example/p.json" }),
        });

        // Credentials in the address disguise the host, so such a link is refused outright.
        expect(screen.queryByText(/evil\.example/)).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /check this region/i }),
        ).not.toBeInTheDocument();
    });

    it("refuses a data: link, which would install a pack with no host at all", () => {
        renderApp(<PackOffer />, {
            store: offering({ url: "data:application/json,%7B%7D" }),
        });

        expect(
            screen.queryByRole("button", { name: /check this region/i }),
        ).not.toBeInTheDocument();
    });

    it("says so, loudly, when the region would replace one that is already loaded", async () => {
        globalThis.fetch = vi.fn(() => Promise.resolve(answer(pack()))) as unknown as typeof fetch;
        const base = makeStore().getState();
        const store = makeStore({
            ui: { ...base.ui, packOffer: { url: "https://evil.example/p.json", fetchNow: true } },
            prefs: {
                ...base.prefs,
                packs: [
                    {
                        id: "ow",
                        name: { en: "Obwalden", de: "Obwalden" },
                        version: "2026-01-01",
                        crags: 94,
                        src: { type: "url", url: "https://example.org/pack.ow.json" },
                    },
                ],
            },
        });

        renderApp(<PackOffer />, { store });

        // The ids in the wild are guessable, and replacing one silently would leave favourites
        // and logbook entries pointing at a stranger's routes.
        expect(await screen.findByText(/replaces the loaded region Obwalden/i)).toBeInTheDocument();
        expect(screen.getByText(/version 2026-01-01/i)).toBeInTheDocument();
        expect(await screen.findByRole("button", { name: /replace region/i })).toBeInTheDocument();
    });

    it("keeps a name that would reshape the dialog to one line", async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(
                answer(
                    pack({
                        name: { en: `${"A".repeat(400)}\n\nB`, de: "x" },
                    }),
                ),
            ),
        ) as unknown as typeof fetch;

        renderApp(<PackOffer />, {
            store: offering({ url: "https://example.org/p.json", fetchNow: true }),
        });

        const shown = await screen.findByText(/^A+…$/);
        expect(shown.textContent).toHaveLength(80);
    });

    it("says what went wrong, in the interface's own words", async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(new Response("nope", { status: 404 })),
        ) as unknown as typeof fetch;

        renderApp(<PackOffer />, {
            store: offering({ url: "https://example.org/p.json", fetchNow: true }),
        });

        expect(await screen.findByText(/HTTP 404/)).toBeInTheDocument();
    });

    it("does not offer a region that is already loaded from the same address", async () => {
        const fetched = vi.fn(() => Promise.resolve(answer(pack())));
        globalThis.fetch = fetched as unknown as typeof fetch;
        const base = makeStore().getState();
        const store = makeStore({
            ui: {
                ...base.ui,
                packOffer: { url: "https://example.org/pack.ow.json", fetchNow: true },
            },
            prefs: {
                ...base.prefs,
                packs: [
                    { id: "ow", src: { type: "url", url: "https://example.org/pack.ow.json" } },
                ],
            },
        });

        renderApp(<PackOffer />, { store, data: mountedShowcase() });

        await waitFor(() => expect(store.getState().ui.packOffer).toBeNull());
        expect(fetched).not.toHaveBeenCalled();
        expect(store.getState().prefs.region).toBe("ow");
    });
});
