import type { Page } from "@playwright/test";

import { E2E_HOST, E2E_ORIGIN, confirmPack, expect, loadPack, test, waitForApp } from "./fixtures";

/**
 * Sharing a region, not just a crag.
 *
 * The app's share links used to work only for somebody who already had the region: anybody else
 * was told the crag is not in the atlas, and that was the end of it. A link now names the region
 * it came from, and `#/pack?url=…` names a region and nothing else -- but nothing is installed
 * without being asked, because the address in such a link was chosen by whoever sent it.
 *
 * tools/serve.pl serves maps/ next to the app, so the suite's own host stands in for somebody's host.
 * fixtures.ts aborts every request that does not go there, which is also why the address has to
 * be the absolute one: that is what a link carries.
 */

const HOST = E2E_ORIGIN;
const PACK = `${HOST}/maps/pack.testing.json`;

/**
 * The offer, once it is on screen.
 *
 * `waitForApp` is no use here: an open MUI dialog marks everything behind it `aria-hidden`, so
 * the searchbox it waits for is not there to be found while the offer is up.
 */
const offer = async (page: Page) => {
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(new RegExp(`from ${E2E_HOST}`, "i"))).toBeVisible({
        timeout: 15_000,
    });
    return dialog;
};

test.describe("a link that carries a region", () => {
    test("offers the region, names the host, and installs nothing until asked", async ({
        page,
    }) => {
        await page.goto(`/#/pack?url=${encodeURIComponent(PACK)}`);

        const dialog = await offer(page);
        // Before the viewer asks, the region's own name is nowhere -- nothing has been fetched.
        await expect(dialog.getByText(/demo region|demo-gebiet/i)).toHaveCount(0);

        await dialog.getByRole("button", { name: /check this region/i }).click();
        await expect(dialog.getByText(/crags · .* routes · version/i)).toBeVisible({
            timeout: 15_000,
        });

        await dialog.getByRole("button", { name: /load region/i }).click();
        await expect(page.getByText(/region loaded/i)).toBeVisible({ timeout: 15_000 });
    });

    test("goes away again when the offer is declined", async ({ page }) => {
        await page.goto(`/#/pack?url=${encodeURIComponent(PACK)}`);
        await offer(page);

        await page.getByRole("button", { name: /not now/i }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByText(/region loaded/i)).toHaveCount(0);
    });

    test("refuses a link whose address could not be a region", async ({ page }) => {
        // `fetch` really does read a data: URL -- a pack from a stranger, with no host to name.
        await page.goto(`/#/pack?url=${encodeURIComponent("data:application/json,%7B%7D")}`);
        await waitForApp(page);

        await expect(page.getByText(/does not name a region/i)).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
    });
});

test.describe("a crag link that carries its region", () => {
    test("offers the region a shared crag came from, then opens the crag", async ({ page }) => {
        // Exactly the link the app now puts on the clipboard: a crag of a region this device has
        // never had, with the address that region came from.
        await page.goto(`/#testing-demofels?pack=${encodeURIComponent(PACK)}`);
        await offer(page);
        await confirmPack(page);

        // The link is followed once the region is really mounted, not a commit earlier.
        await expect(page).toHaveURL(/#\/crag\/testing-/, { timeout: 15_000 });
        // The crag page is a lazy chunk, and it is asked for at the moment 10 crags and 51
        // routes are being mounted -- so it arrives behind its spinner, not instantly.
        await expect(page.getByRole("heading", { level: 2 })).toBeVisible({ timeout: 15_000 });
    });

    test("a crag page shares a link that carries the region's address", async ({ page }) => {
        await page.addInitScript(() => {
            const w = window as unknown as { __copied?: string };
            Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    writeText: (text: string) => {
                        w.__copied = text;
                        return Promise.resolve();
                    },
                },
            });
        });
        await page.goto("/");
        await waitForApp(page);
        await loadPack(page, "testing");

        await page.goto("/#testing-demofels");
        await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
        await page.getByRole("button", { name: /share/i }).first().click();

        const copied = await page.evaluate(() => (window as { __copied?: string }).__copied);
        expect(copied).toContain("#testing-demofels?pack=");
        expect(copied).toContain(encodeURIComponent("/maps/pack.testing.json"));
    });
});
