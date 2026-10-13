import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { E2E_HOST, E2E_ORIGIN, expect, test } from "./fixtures";

/**
 * Installing a region that was published encrypted.
 *
 * A region may be published as a `.chlpack`: gzipped, sealed with AES-GCM, and opened by a key
 * that rides in the share link after the `#`, so no server is ever sent it. Everything after the
 * bytes are opened is the path a plain pack already took -- which is what the last test here is
 * about, and why it matters that it is in this file.
 *
 * maps/pack.testing.chlpack is the invented region, sealed by tools/seal-fixture.mjs with the key
 * in maps/pack.testing.key. Both are fixtures and both are meant to be public: the plaintext is
 * committed two files away.
 */

const HOST = E2E_ORIGIN;
const SEALED = `${HOST}/maps/pack.testing.chlpack`;
const PLAIN = `${HOST}/maps/pack.testing.json`;
const KEY = readFileSync("maps/pack.testing.key", "utf8").trim();

const linkTo = (url: string, key?: string): string =>
    `/#/pack?url=${encodeURIComponent(url)}${key === undefined ? "" : `&k=${encodeURIComponent(key)}`}`;

const offer = async (page: Page) => {
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(new RegExp(`from ${E2E_HOST}`, "i"))).toBeVisible({
        timeout: 15_000,
    });
    return dialog;
};

test.describe("a link to a locked region", () => {
    test("opens it when it carries the key, and installs it like any other", async ({ page }) => {
        await page.goto(linkTo(SEALED, KEY));

        const dialog = await offer(page);
        await dialog.getByRole("button", { name: /check this region/i }).click();

        // The region's own name and figures: proof the bytes were decrypted, not merely fetched.
        await expect(dialog.getByText(/demo region|demo-gebiet/i)).toBeVisible({
            timeout: 15_000,
        });
        await expect(dialog.getByText(/15 crags · 310 routes/i)).toBeVisible();

        await dialog.getByRole("button", { name: /load region/i }).click();
        await expect(page.getByText(/region loaded/i)).toBeVisible({ timeout: 15_000 });

        // And it really is installed: its crags are the ones the list shows. The crag page's own
        // heading, by level: on a wide screen the list stands beside the page, and the entry for
        // the same crag is a heading too -- which matched as well as often as the timing allowed.
        await page.goto("/#/crag/testing-demofels");
        await expect(page.getByRole("heading", { level: 2, name: /Demofels/i })).toBeVisible({
            timeout: 15_000,
        });
    });

    test("says it is locked when the link lost its key", async ({ page }) => {
        await page.goto(linkTo(SEALED));

        const dialog = await offer(page);
        await dialog.getByRole("button", { name: /check this region/i }).click();

        await expect(dialog.getByText(/locked|verschlossen/i)).toBeVisible({ timeout: 15_000 });
        // Nothing is installed from a region that could not be opened.
        await expect(dialog.getByText(/load region/i)).toHaveCount(0);
    });

    test("says the key is the wrong one, which is a different thing", async ({ page }) => {
        // A real key, and not this region's.
        const other = "a".repeat(43);
        await page.goto(linkTo(SEALED, other));

        const dialog = await offer(page);
        await dialog.getByRole("button", { name: /check this region/i }).click();

        await expect(dialog.getByText(/does not open|öffnet dieses gebiet nicht/i)).toBeVisible({
            timeout: 15_000,
        });
    });
});

test.describe("a link to a plain region", () => {
    test("still works, and a key offered for it is simply not needed", async ({ page }) => {
        // Encryption is an addition. A pack somebody else hosts as plain JSON must keep loading
        // exactly as it did -- with a stray key on the link, or without one.
        await page.goto(linkTo(PLAIN, KEY));

        const dialog = await offer(page);
        await dialog.getByRole("button", { name: /check this region/i }).click();
        await expect(dialog.getByText(/15 crags · 310 routes/i)).toBeVisible({ timeout: 15_000 });

        await dialog.getByRole("button", { name: /load region/i }).click();
        await expect(page.getByText(/region loaded/i)).toBeVisible({ timeout: 15_000 });
    });
});
