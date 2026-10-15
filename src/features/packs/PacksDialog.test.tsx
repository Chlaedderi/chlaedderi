import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { makeStore, renderApp } from "../../test/harness";

import { PacksDialog } from "./PacksDialog";

const Where = () => {
    const { pathname, search } = useLocation();
    return <output data-testid="where">{pathname + search}</output>;
};

const opened = () => makeStore({ ui: { ...makeStore().getState().ui, packsOpen: true } });

describe("PacksDialog", () => {
    it("follows a link to the app typed into the address field, key and all", () => {
        const store = opened();
        renderApp(
            <>
                <PacksDialog />
                <Where />
            </>,
            { store },
        );
        const pack = "https://example.org/pack.ow.chlpack";
        fireEvent.change(screen.getByLabelText(/address of a mappack/i), {
            target: {
                value: `https://xn--chldderi-2za.ch/#/pack?url=${encodeURIComponent(pack)}&k=abc`,
            },
        });
        fireEvent.click(screen.getByRole("button", { name: /^load$/i }));

        // Not fetched as an address -- that would be the app's own page, and the key lost.
        expect(store.getState().ui.packOffer).toBeNull();
        expect(screen.getByTestId("where").textContent).toBe(
            `/pack?url=${encodeURIComponent(pack)}&k=abc`,
        );
    });

    it("still fetches a plain address straight away", () => {
        const store = opened();
        renderApp(<PacksDialog />, { store });
        fireEvent.change(screen.getByLabelText(/address of a mappack/i), {
            target: { value: "https://example.org/data.json" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^load$/i }));
        expect(store.getState().ui.packOffer).toMatchObject({
            url: "https://example.org/data.json",
            fetchNow: true,
        });
    });

    it("fetches a pack address that carries a fragment of its own", () => {
        const store = opened();
        renderApp(<PacksDialog />, { store });
        fireEvent.change(screen.getByLabelText(/address of a mappack/i), {
            target: { value: "https://example.org/pack.json#v2" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^load$/i }));
        expect(store.getState().ui.packOffer).toMatchObject({
            url: "https://example.org/pack.json#v2",
            fetchNow: true,
        });
    });

    it("follows a hand-written link without the slash, too", () => {
        const store = opened();
        renderApp(
            <>
                <PacksDialog />
                <Where />
            </>,
            { store },
        );
        const pack = "https://example.org/pack.ow.chlpack";
        fireEvent.change(screen.getByLabelText(/address of a mappack/i), {
            target: {
                value: `https://xn--chldderi-2za.ch/#pack?url=${encodeURIComponent(pack)}&k=abc`,
            },
        });
        fireEvent.click(screen.getByRole("button", { name: /^load$/i }));
        expect(store.getState().ui.packOffer).toBeNull();
        expect(screen.getByTestId("where").textContent).toMatch(/^\/pack\?/);
    });
});
