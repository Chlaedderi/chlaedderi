import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_NAME } from "@core/name";

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

    it("reads this site's own domain back into the name it is served under", async () => {
        const fetched = vi.fn(() => Promise.resolve(answer(pack())));
        globalThis.fetch = fetched as unknown as typeof fetch;

        renderApp(<PackOffer />, {
            store: offering({ url: "https://xn--chldderi-2za.ch/maps/pack.ow.json" }),
        });

        // The line that asks somebody to recognise something has to be in the spelling they
        // would recognise. The address under it stays what the machine will really go and get.
        expect(await screen.findByText(`from ${APP_NAME.toLowerCase()}.ch`)).toBeInTheDocument();
        expect(
            screen.getByText("https://xn--chldderi-2za.ch/maps/pack.ow.json"),
        ).toBeInTheDocument();
        expect(fetched).not.toHaveBeenCalled();
    });

    it("leaves a host it cannot vouch for in the spelling the machine uses", async () => {
        globalThis.fetch = vi.fn(() => Promise.resolve(answer(pack()))) as unknown as typeof fetch;

        renderApp(<PackOffer />, {
            store: offering({ url: "https://xn--80ak6aa92e.com/p.json" }),
        });

        // It reads as аррӏе.com in Cyrillic, and a trust prompt is the worst place to learn that.
        expect(await screen.findByText(/from xn--80ak6aa92e\.com/i)).toBeInTheDocument();
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

    it("names the host it is replacing the same way, and still calls it a different one", async () => {
        globalThis.fetch = vi.fn(() => Promise.resolve(answer(pack()))) as unknown as typeof fetch;
        const base = makeStore().getState();
        const store = makeStore({
            ui: { ...base.ui, packOffer: { url: "https://example.org/p.json", fetchNow: true } },
            prefs: {
                ...base.prefs,
                packs: [
                    {
                        id: "ow",
                        name: { en: "Obwalden", de: "Obwalden" },
                        version: "2026-01-01",
                        crags: 94,
                        src: {
                            type: "url",
                            url: "https://xn--chldderi-2za.ch/maps/pack.ow.json",
                        },
                    },
                ],
            },
        });

        renderApp(<PackOffer />, { store });

        // Both hosts in this dialog are read the same way, because the dialog is asking for them
        // to be compared -- and the comparison itself is made on the host, never on the reading.
        const said = await screen.findByText(
            new RegExp(`from ${APP_NAME.toLowerCase()}\\.ch`, "i"),
        );
        expect(said.closest(".MuiAlert-root")?.className).toMatch(/Error/);
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

        const data = mountedShowcase();
        renderApp(<PackOffer />, {
            store,
            data: {
                ...data,
                onlyShowcase: false,
                regions: [...data.regions, { ...data.regions[0]!, key: "ow" }],
            },
        });

        await waitFor(() => expect(store.getState().ui.packOffer).toBeNull());
        expect(fetched).not.toHaveBeenCalled();
        expect(store.getState().prefs.region).toBe("ow");
    });

    it("fetches a listed region again when its stored copy did not mount", async () => {
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

        // Listed, but evicted by the browser: only the showcase is mounted. Switching to it would
        // bounce straight back off, so the link has to bring it in again.
        renderApp(<PackOffer />, { store, data: mountedShowcase() });

        await waitFor(() => expect(fetched).toHaveBeenCalledOnce());
        expect(store.getState().ui.packOffer).not.toBeNull();
    });

    it("does not take the built-in showcase for an evicted region that shares its id", async () => {
        const fetched = vi.fn(() => Promise.resolve(answer(pack({ id: "testing" }))));
        globalThis.fetch = fetched as unknown as typeof fetch;
        const base = makeStore().getState();
        const url = "https://example.org/pack.testing.json";
        const store = makeStore({
            ui: { ...base.ui, packOffer: { url, fetchNow: true } },
            prefs: { ...base.prefs, packs: [{ id: "testing", src: { type: "url", url } }] },
        });

        // The full region was evicted; what is mounted under its id is only the showcase.
        renderApp(<PackOffer />, { store, data: mountedShowcase() });

        await waitFor(() => expect(fetched).toHaveBeenCalledOnce());
    });
});
