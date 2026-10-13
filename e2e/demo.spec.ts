/**
 * The marking on the invented region that ships with the app.
 *
 * Every other spec starts as a reader who has already read the dialog (`seenTheDemoDialog` in
 * `fixtures.ts`), because a modal in front of the app would stand in front of them too. This is
 * the one that drops that again and checks the marking is really there -- which matters more than
 * it looks: the demo crags sit on real Swiss ground, with real contours and a real trail network
 * under them, so an unmarked demo would read as an atlas of somewhere.
 */

import { test as base } from "@playwright/test";

import { expect, stubNetwork, test, waitForApp } from "./fixtures";

/**
 * A reader arriving for the first time: the network stubbed like everywhere else, but nothing
 * seeded into the settings. It cannot be done by clearing storage afterwards -- the settings are
 * kept in the triple store as well as in localStorage, and the stored copy wins on the next load.
 */
const firstVisit = base.extend({
    page: async ({ page }, use) => {
        await stubNetwork(page);
        await use(page);
    },
});

test("says on every screen that the crags are invented", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);

    const strip = page.getByTestId("demo-strip");
    await expect(strip).toBeVisible();

    // Not just the map: the strip belongs to the shell, so it survives going somewhere else.
    for (const path of ["/#/fav", "/#/log", "/#/more"]) {
        await page.goto(path);
        await expect(page.getByTestId("demo-strip")).toBeVisible();
    }
});

firstVisit("stops once in front of the app, and only once", async ({ page }) => {
    await page.goto("/");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/invented|erfunden/i);

    await page.getByTestId("demo-ok").click();
    await expect(dialog).toBeHidden();
    await waitForApp(page);

    // Settings are written back debounced, so wait for it to be on disk rather than racing the
    // reload against it.
    await expect
        .poll(() => page.evaluate(() => window.localStorage.getItem("chlaedderi:prefs") ?? ""))
        .toContain('"demoSeen":true');

    // Read once is read for good; the strip stays behind to carry the message.
    await page.reload();
    await waitForApp(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("demo-strip")).toBeVisible();
});

test("offers no way to walk to a crag that is not there", async ({ page }) => {
    // Straight to the crag, so not `waitForApp`: on a phone the crag page takes the app bar, and
    // the search box it waits for is not on screen.
    await page.goto("/#/crag/testing-musterwand");

    const approach = page.locator("#apsec");
    await expect(approach).toBeVisible();

    // No maps app, no planner: the coordinate is open hillside.
    await expect(approach.getByRole("link", { name: /google maps/i })).toHaveCount(0);
    await expect(approach.getByRole("button", { name: /plan|zustieg planen/i })).toHaveCount(0);
    await expect(approach.getByText(/does not exist|gibt es nicht/i).first()).toBeVisible();
});
