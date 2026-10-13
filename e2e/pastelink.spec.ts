import type { Page } from "@playwright/test";

import { E2E_HOST, E2E_ORIGIN, expect, test, waitForApp } from "./fixtures";

/**
 * Pasting a link into the packs dialog.
 *
 * The path matters on iOS, where it is the only one there is: a home-screen web app keeps its
 * storage apart from Safari's, and iOS has neither share targets nor link capture. So the link is
 * copied in the browser and pasted in the app -- and this is the button that does it.
 *
 * The clipboard is stubbed rather than granted, the way e2e/share.spec.ts stubs the writing half.
 * Granting `clipboard-read` would test Chromium's permission prompt, which is not the thing under
 * test and is not what an iPhone does either; a stubbed `readText` exercises every line the app
 * owns, from the button being there to the offer coming up.
 *
 * tools/serve.pl serves maps/ next to the app, so the suite's own host stands in for somebody's host.
 */

const HOST = E2E_ORIGIN;
const PACK = `${HOST}/maps/pack.testing.json`;

/** A clipboard holding exactly this, or refusing to be read when `text` is null. */
const useClipboard = async (page: Page, text: string | null): Promise<void> => {
    await page.addInitScript((held) => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                readText: () =>
                    held === null
                        ? Promise.reject(new Error("Read permission denied."))
                        : Promise.resolve(held),
            },
        });
    }, text);
};

const openPacks = async (page: Page): Promise<void> => {
    await page.goto("/");
    await waitForApp(page);
    await page.getByRole("button", { name: /load a region|region laden/i }).click();
    await expect(page.getByRole("button", { name: /paste a link|link einfügen/i })).toBeVisible();
};

const pasteIt = async (page: Page): Promise<void> => {
    await page.getByRole("button", { name: /paste a link|link einfügen/i }).click();
};

test.describe("a link pasted into the packs dialog", () => {
    test("offers the region the link names, and the packs dialog gets out of the way", async ({
        page,
    }) => {
        await useClipboard(page, `Demo-Gebiet\n${HOST}/#/pack?url=${encodeURIComponent(PACK)}`);
        await openPacks(page);

        await pasteIt(page);

        // One dialog on screen, and it is the offer: two modals whose lives overlap leave a
        // backdrop above the buttons, which is a question that cannot be answered.
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByText(new RegExp(`from ${E2E_HOST}`, "i"))).toBeVisible({
            timeout: 15_000,
        });
        await expect(dialog).toHaveCount(1);

        await dialog.getByRole("button", { name: /check this region|gebiet prüfen/i }).click();
        await expect(dialog.getByText(/crags · .* routes · version/i)).toBeVisible({
            timeout: 15_000,
        });
    });

    test("reads a bare pack address as a region too", async ({ page }) => {
        await useClipboard(page, PACK);
        await openPacks(page);

        await pasteIt(page);

        await expect(page.getByText(new RegExp(`from ${E2E_HOST}`, "i"))).toBeVisible({
            timeout: 15_000,
        });
    });

    test("says so when the clipboard holds no link, and stays where it is", async ({ page }) => {
        await useClipboard(page, "bring the rope, I have the quickdraws");
        await openPacks(page);

        await pasteIt(page);

        await expect(
            page.getByText(/no link to a region|kein link zu einer region/i),
        ).toBeVisible();
        await expect(page.getByText(new RegExp(`from ${E2E_HOST}`, "i"))).toHaveCount(0);
        // Still the packs dialog, so the viewer can try the address field instead.
        await expect(
            page.getByRole("button", { name: /paste a link|link einfügen/i }),
        ).toBeVisible();
    });

    test("says the same when the clipboard refuses to be read", async ({ page }) => {
        await useClipboard(page, null);
        await openPacks(page);

        await pasteIt(page);

        await expect(
            page.getByText(/no link to a region|kein link zu einer region/i),
        ).toBeVisible();
    });

    test("is not there at all when the browser hands out no clipboard", async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
        });
        await page.goto("/");
        await waitForApp(page);
        await page.getByRole("button", { name: /load a region|region laden/i }).click();

        await expect(
            page.getByRole("button", { name: /choose a file|datei wählen/i }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: /paste a link|link einfügen/i })).toHaveCount(
            0,
        );
    });
});

test.describe("the file picker", () => {
    test("offers the sealed packs the app can already read", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await page.getByRole("button", { name: /load a region|region laden/i }).click();

        // A `.chlpack` is what `readPackFile` opens; greying it out refused a file the app can
        // read, before anybody could choose it.
        const accept = await page
            .locator('input[type="file"]')
            .first()
            .getAttribute("accept", { timeout: 15_000 });
        expect(accept).toContain(".chlpack");
        expect(accept).toContain(".json");
    });
});
