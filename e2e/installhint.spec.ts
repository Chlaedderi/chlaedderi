import { expect, test, waitForApp } from "./fixtures";

/**
 * «You can also install this», at the moment a favourite is saved.
 *
 * The hint never shows in an automated browser -- there is nobody to install anything, and it
 * would sit over the buttons every other test taps -- so these tests are the ones that say they are
 * a person. Everything else about when it shows is in src/core/installHint.test.ts.
 */

const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
    });
});

const saveAFavourite = async (page: import("@playwright/test").Page): Promise<void> => {
    await page
        .locator(".MuiCard-root")
        .first()
        .getByRole("button", { name: /favourites/i })
        .click();
};

test.describe("on an iPhone", () => {
    test.use({ userAgent: IPHONE });

    test("gives the storage reason and shows the steps", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await saveAFavourite(page);

        const hint = page.getByTestId("install-hint");
        await expect(hint).toContainText(/safari deletes a website's data/i, { timeout: 15_000 });
        await hint.getByRole("button", { name: /show me how/i }).click();

        const steps = page.getByRole("dialog", { name: /add to home screen/i });
        await expect(steps).toBeVisible();
        await expect(steps).toContainText(/backup code/i);
        await steps.getByRole("button", { name: /got it/i }).click();
        await expect(steps).toBeHidden();
        await expect(hint).toBeHidden();
    });
});

test.describe("where the browser offers its own dialog", () => {
    test("opens it from the hint", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        // What Chromium sends when the app is installable, minus the real dialog.
        await page.evaluate(() => {
            const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
                prompt: async () => {
                    (window as { prompted?: boolean }).prompted = true;
                },
                userChoice: Promise.resolve({ outcome: "accepted" }),
            });
            window.dispatchEvent(event);
        });
        await saveAFavourite(page);

        const hint = page.getByTestId("install-hint");
        await expect(hint).toContainText(/saved on this device/i, { timeout: 15_000 });
        await hint.getByRole("button", { name: /^install$/i }).click();
        await expect
            .poll(() => page.evaluate(() => (window as { prompted?: boolean }).prompted))
            .toBe(true);
        await expect(hint).toBeHidden();
    });
});
