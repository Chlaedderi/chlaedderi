import { expect, gotoTab, test, waitForApp } from "./fixtures";

/**
 * «More»: the page where the first React pass showed `Version {0}: dev` and had no way to fetch a
 * new version at all.
 */

test.describe("the More page", () => {
    test.beforeEach(async ({ page }) => {
        // version.json is written by the deploy; locally there is none, so the test supplies one.
        await page.route("**/version.json", (route) =>
            route.fulfill({
                json: { version: "2026.10.11-abc1234", built: "2026-10-11T08:30:00Z" },
            }),
        );
        await page.goto("/");
        await waitForApp(page);
        await gotoTab(page, /^More$/);
    });

    test("shows the running version, not a placeholder", async ({ page }) => {
        const line = page.getByText(/2026\.10\.11-abc1234/);
        await expect(line).toBeVisible();
        // Neither the raw placeholder nor the unfetched default may reach the screen.
        await expect(page.getByText("{0}")).toHaveCount(0);
        await expect(page.getByText(/version.*:\s*dev/i)).toHaveCount(0);
    });

    test("offers to fetch the newest version", async ({ page }) => {
        await expect(page.getByRole("button", { name: /load newest version/i })).toBeVisible();
    });

    test("leads to the settings, «Worth knowing», coverage and the packs", async ({ page }) => {
        await expect(page.getByLabel("Language")).toBeVisible();
        await expect(page.getByLabel("Appearance")).toBeVisible();
        await expect(page.getByText(/grade converter, records/i)).toBeVisible();
        await expect(page.getByText(/^Coverage$/)).toBeVisible();
        await expect(page.getByText(/load and manage regions/i)).toBeVisible();
    });

    test("says what the app is, by name and with its figures filled in", async ({ page }) => {
        // The one piece of prose that names the app. It carries three counts; an unfilled {0} here
        // is exactly the bug `notraw.spec.ts` exists for, and the name is what the rename moved.
        const about = page.getByText(/shows the climbing regions you load into it/i);
        await expect(about).toBeVisible();
        await expect(about).toContainText("Chlädderi");
        await expect(about).toContainText(/\d+ crags/);
        await expect(about).toContainText(/\d+ routes/);
        // Someone who installed it under the old name has to be able to tell it is the same app.
        await expect(about).toContainText("Kletteratlas");
    });

    test("opens the coverage page, which says what is missing", async ({ page }) => {
        await page.getByText(/^Coverage$/).click();
        await expect(page.getByRole("heading", { level: 2 })).toContainText(/finale/i);
        // The figures, and the honest part: which crags have no route list.
        await expect(page.getByText(/crags with a route list|route lists/i).first()).toBeVisible();
    });

    test("switches language and the page follows", async ({ page }) => {
        await page.getByLabel("Language").click();
        await page.getByRole("option", { name: "Deutsch" }).click();
        // The whole page follows, not just the one field.
        await expect(page.getByLabel("Sprache").first()).toBeVisible();
        await expect(page.getByText(/regionen laden und verwalten/i)).toBeVisible();
    });
});
