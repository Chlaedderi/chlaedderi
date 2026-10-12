/**
 * The layers button has to close the menu it opened.
 *
 * MUI's `ClickAwayListener` registers both of its handlers on `document`, and on a touch screen
 * `touchend` reaches them before the browser synthesises the `click`. So the listener closed the
 * menu and the button's own toggle immediately reopened it: the icon only ever opened. jsdom
 * reproduces that ordering faithfully, which is why this is worth a unit test and not only an
 * end-to-end one on the phone project.
 */

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderApp } from "../../test/harness";

import { MapControls } from "./MapControls";

const open = async (): Promise<HTMLElement> => {
    const button = screen.getByRole("button", { name: /base map/i });
    fireEvent.click(button);
    // ClickAwayListener arms itself a tick after mounting; without this the handler bails out
    // early and the test would pass for the wrong reason.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return button;
};

const renderControls = () =>
    renderApp(<MapControls inSwitzerland={false} locate={() => {}} locateState="off" />, {});

describe("the layers menu", () => {
    it("opens on the first press", async () => {
        renderControls();
        await open();
        expect(document.querySelector(".basemenu")).not.toBeNull();
    });

    it("closes again when the icon is tapped a second time", async () => {
        renderControls();
        const button = await open();

        // A tap, in the order a touch screen delivers it.
        fireEvent.touchEnd(button);
        fireEvent.click(button);

        expect(document.querySelector(".basemenu")).toBeNull();
    });

    it("closes again when the icon is clicked a second time", async () => {
        renderControls();
        const button = await open();

        fireEvent.click(button);

        expect(document.querySelector(".basemenu")).toBeNull();
    });

    it("still closes when something else is touched", async () => {
        renderControls();
        await open();

        // The guard must not cost us tap-outside-to-close.
        fireEvent.touchEnd(document.body);

        expect(document.querySelector(".basemenu")).toBeNull();
    });
});
