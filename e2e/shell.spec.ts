import { expect, gotoTab, openCallout, test, waitForApp } from "./fixtures";

/**
 * The shell: what is on screen before you touch anything.
 *
 * This is the first thing the React rewrite lost -- search and the quick filters were buried
 * inside the list pane, which the map screen never shows -- so it is the first thing pinned down.
 */

test.describe("the app bar", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
    });

    test("has search, the filters and the region switch on the map screen", async ({ page }) => {
        await expect(page.getByRole("searchbox", { name: /search crags/i })).toBeVisible();
        // The filters open from the button at every size now. The original kept a permanent
        // 292px column on a wide screen; it cost the map a quarter of the window for something
        // most people set once, and it hid «reset» from exactly the people with room for it.
        await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
        const seg = page.getByRole("group", { name: "Region" });
        await expect(seg).toBeVisible();
        // «+» is there even with one region: it is the way to load another.
        await expect(seg.getByRole("button", { name: /load a region/i })).toBeVisible();
    });

    test("shows the quick filters the original had", async ({ page }) => {
        const chips = page.getByRole("group", { name: "Filters" });
        for (const label of ["3–4", "5a–5c", "6a–6c", "7a–7c", "8a+"]) {
            await expect(chips.getByRole("button", { name: label })).toBeVisible();
        }
        for (const label of [/★★★★/, /dry now/i, /rainproof/i, /topo/i]) {
            await expect(chips.getByRole("button", { name: label })).toBeVisible();
        }
    });

    test("narrows the list from the search box", async ({ page }) => {
        const before = await page.locator(".MuiCard-root").count();
        expect(before).toBeGreaterThan(1);

        await page.getByRole("searchbox", { name: /search crags/i }).fill("beispiel");
        await expect(page.locator(".MuiCard-root")).not.toHaveCount(before);

        // The search box's own clear button: other «Close» buttons can be on screen.
        await page.getByRole("banner").getByRole("button", { name: "Close" }).click();
        await expect(page.locator(".MuiCard-root")).toHaveCount(before);
    });

    test("a quick chip filters and un-filters", async ({ page }) => {
        const chips = page.getByRole("group", { name: "Filters" });
        const preset = chips.getByRole("button", { name: "8a+" });

        await expect(preset).toHaveAttribute("aria-pressed", "false");
        await preset.click();
        await expect(preset).toHaveAttribute("aria-pressed", "true");
        // The filter badge counts it; search would not have.
        await expect(page.locator(".MuiBadge-badge").first()).toHaveText("1");

        await preset.click();
        await expect(preset).toHaveAttribute("aria-pressed", "false");
    });
});

test.describe("getting back", () => {
    // The wide layout has no bottom tab bar, and for a while it had no way home either: you
    // could open Favourites and were simply stuck there.
    for (const [name, label] of [
        ["favourites", /^Favourites$/],
        ["logbook", /^Logbook$/],
        ["more", /^More$/],
    ] as const) {
        test(`leads back to the map from ${name}`, async ({ page }) => {
            await page.goto("/");
            await waitForApp(page);

            await gotoTab(page, label);
            await expect(page.locator(".leaflet-container")).toHaveCount(0);

            await gotoTab(page, /^Map$/);
            await expect(page).toHaveURL(/#\/$|\/$/);
            await expect(page.locator(".leaflet-container")).toBeVisible();
        });
    }
});

test.describe("the map", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
    });

    test("draws crag markers in the app's own shapes, not Leaflet's defaults", async ({ page }) => {
        // `.mk` is the app's marker. Its absence is what made the map look wrong.
        await expect(page.locator(".leaflet-container .mk").first()).toBeVisible();
        // Leaflet.markercluster's own coloured bubbles must never show.
        await expect(
            page.locator(".marker-cluster-small div, .marker-cluster-large div"),
        ).toHaveCount(0);
    });

    test("has the legend and the control stack", async ({ page }) => {
        await expect(page.locator(".legend")).toBeVisible();
        await expect(page.locator(".mapctl .mbtn")).toHaveCount(2);
    });

    test("opens the base-map menu from the map itself", async ({ page }) => {
        await page.getByRole("button", { name: /base map/i }).click();
        const menu = page.locator(".basemenu");
        await expect(menu).toBeVisible();
        await expect(menu.getByRole("menuitemradio", { name: "OpenTopoMap" })).toBeVisible();
        await expect(menu.getByText(/all approaches/i)).toBeVisible();
    });

    /**
     * The icon has to shut the menu it opened. Under touch it did not: MUI's click-away listener
     * sits on `document` and gets `touchend` before the synthesised `click`, so it closed the menu
     * and the button's own toggle opened it straight back up. `tap()` needs `hasTouch`, which only
     * the phone project has -- and that is the project where this was broken.
     */
    test("closes the base-map menu when the icon is pressed again", async ({ page, isMobile }) => {
        const button = page.getByRole("button", { name: /base map/i });
        const menu = page.locator(".basemenu");

        if (isMobile) await button.tap();
        else await button.click();
        await expect(menu).toBeVisible();

        if (isMobile) await button.tap();
        else await button.click();
        await expect(menu).toBeHidden();
    });

    test("still closes the base-map menu when the map is pressed", async ({ page, isMobile }) => {
        const button = page.getByRole("button", { name: /base map/i });
        const menu = page.locator(".basemenu");

        if (isMobile) await button.tap();
        else await button.click();
        await expect(menu).toBeVisible();

        // The guard that fixed the toggle must not have cost us press-outside-to-close. The
        // legend rather than the map canvas: a base map that did not load puts a dismissable
        // alert over the corner of the map, and this is about the menu, not about aiming.
        const outside = page.locator(".legend");
        if (isMobile) await outside.tap();
        else await outside.click();
        await expect(menu).toBeHidden();
    });

    test("a marker opens the call-out, with the figures and a way to the page", async ({
        page,
    }) => {
        await openCallout(page);
        const pop = page.locator(".pop");
        await expect(pop.getByRole("button", { name: /open crag/i })).toBeVisible();

        await pop.getByRole("button", { name: /open crag/i }).click();
        await expect(page.locator("h2")).toBeVisible();
    });

    test("draws the approach from the car park once a crag is open", async ({ page }) => {
        // The showcase crags carry approach lines; selecting one must draw them.
        await openCallout(page);
        // A park marker and a polyline for the way to the wall.
        await expect(page.locator(".leaflet-container .pk").first()).toBeVisible();
        await expect(page.locator(".leaflet-overlay-pane path").first()).toBeVisible();
    });
});
