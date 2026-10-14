import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mountedShowcase, renderApp } from "../../test/harness";

import { DryEstimate } from "./DryEstimate";

const crag = (id: string) => {
    const found = mountedShowcase().byId[id];
    if (!found) throw new Error(`no ${id} in the showcase`);
    return found;
};

describe("how fast a wall dries", () => {
    it("quotes the source's reason when it is given as the reason, not as a note", () => {
        // The showcase puts the source's words in `dryWhy` and leaves `dryNote` empty; the line
        // used to end in a bare dash.
        const wall = crag("testing-beispielwand");
        expect(wall.dryHow).toBe("src");
        renderApp(<DryEstimate crag={wall} />);
        const line = screen.getByText(/Open south face/);
        expect(line.textContent).toMatch(/ – Open south face, wind from the valley\.$/);
    });

    it("never shows a reason as a raw text key", () => {
        const wall = { ...crag("testing-beispielwand"), dryHow: "est" as const };
        const { container } = renderApp(<DryEstimate crag={wall} />);
        expect(container.textContent).not.toMatch(/dry\.w\./);
        expect(container.textContent).toMatch(/Open south face/);
    });
});
