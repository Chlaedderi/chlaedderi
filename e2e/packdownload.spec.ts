import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { E2E_ORIGIN, confirmPack, expect, test } from "./fixtures";

/**
 * Saving a loaded region as a file, to pass it on by hand.
 *
 * What comes out has to be the pack that went in, byte for byte, so whoever it is sent to loads
 * the same region. A region that arrived sealed is saved too, and comes out opened -- the app
 * holds it opened, and a file is the only copy that outlives the publication it was fetched from.
 */

const KEY = readFileSync("maps/pack.testing.key", "utf8").trim();

const packsDialog = async (page: Page) => {
    await page.getByRole("button", { name: /load a region|region laden/i }).click();
    return page.getByRole("dialog").filter({ hasText: /mappacks/i });
};

test("a region loaded from a file is saved as the same file", async ({ page }) => {
    await page.goto("/");
    const dialog = await packsDialog(page);
    await dialog.locator('input[type="file"]').setInputFiles("maps/pack.testing.json");
    await expect(page.getByText(/region loaded|region geladen/i)).toBeVisible({ timeout: 15_000 });

    const again = await packsDialog(page);
    const card = again.locator(".MuiCard-root").filter({ hasText: /pack\.testing\.json/i });
    const [download] = await Promise.all([
        page.waitForEvent("download"),
        card.getByRole("button", { name: /save as a file|datei speichern/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("testing.json");
    const saved = readFileSync(await download.path(), "utf8");
    expect(saved).toBe(readFileSync("maps/pack.testing.json", "utf8"));
});

test("a region that arrived sealed is saved as the JSON it was opened into", async ({ page }) => {
    const url = `${E2E_ORIGIN}/maps/pack.testing.chlpack`;
    await page.goto(`/#/pack?url=${encodeURIComponent(url)}&k=${encodeURIComponent(KEY)}`);
    await confirmPack(page);

    const dialog = await packsDialog(page);
    await expect(dialog.getByText(/pack\.testing\.chlpack/i)).toBeVisible();
    // Both ways of passing it on are there: the link while the publication stands, the file after.
    await expect(dialog.getByRole("button", { name: /share this region|teilen/i })).toBeVisible();
    const card = dialog.locator(".MuiCard-root").filter({ hasText: /pack\.testing\.chlpack/i });
    const [download] = await Promise.all([
        page.waitForEvent("download"),
        card.getByRole("button", { name: /save as a file|datei speichern/i }).click(),
    ]);
    // Opened, not sealed, and named as such -- `tools/seal-fixture.mjs` seals exactly this file.
    expect(download.suggestedFilename()).toBe("testing.json");
    const saved = readFileSync(await download.path(), "utf8");
    expect(saved).toBe(readFileSync("maps/pack.testing.json", "utf8"));
});
