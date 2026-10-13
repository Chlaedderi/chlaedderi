import { expect, gotoTab, openCallout, test, waitForApp } from "./fixtures";

/**
 * Screenshots of every screen, so the result can be *looked at* rather than assumed.
 *
 * Run with `screens`; the files land in .screens/. Not an assertion suite -- it fails only if a
 * screen cannot be reached at all.
 */

const shot = async (page: import("@playwright/test").Page, name: string): Promise<void> => {
    await page.screenshot({ path: `.screens/${name}.png`, fullPage: false });
};

/**
 * One element rather than the whole screen.
 *
 * For a dialog standing over the map: the map behind it is a detailed topographic raster that
 * makes a megabyte and a half of PNG, which the published screenshots will not carry -- and the
 * subject is the dialog anyway.
 */
const shotOf = async (locator: import("@playwright/test").Locator, name: string): Promise<void> => {
    await locator.screenshot({ path: `.screens/${name}.png` });
};

for (const theme of ["light", "dark"] as const) {
    test(`every screen, ${theme}`, async ({ page }, info) => {
        const tag = `${info.project.name}-${theme}`;
        await page.emulateMedia({ colorScheme: theme });
        await page.goto("/");
        await waitForApp(page);
        await shot(page, `${tag}-01-map`);

        // On a wide screen the filters are a permanent column, as they were in the original, so
        // there is no button to open them -- the first screenshot already shows them.
        const filterButton = page.getByRole("button", { name: "Filters" });
        if (await filterButton.isVisible()) {
            await filterButton.click();
            await expect(page.getByRole("presentation")).toBeVisible();
            await shot(page, `${tag}-02-filters`);
            await page.keyboard.press("Escape");
        }

        await openCallout(page);
        await shot(page, `${tag}-03-callout`);

        await page
            .locator(".pop")
            .getByRole("button", { name: /open crag/i })
            .click();
        await expect(page.locator("h2")).toBeVisible();
        await shot(page, `${tag}-04-crag`);

        for (const [name, label] of [
            ["05-favourites", /^Favourites$/],
            ["06-logbook", /^Logbook$/],
            ["07-more", /^More$/],
        ] as const) {
            await gotoTab(page, label);
            await page.waitForTimeout(250);
            await shot(page, `${tag}-${name}`);
        }

        await page.goto("/#/know");
        await page.waitForTimeout(400);
        await shot(page, `${tag}-08-know`);

        await page.goto("/");
        await waitForApp(page);
        await page.getByRole("button", { name: /load a region/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        // The dialog alone, for the reason `shotOf` exists: now that the region that ships is in
        // Switzerland, the map behind this one is a swisstopo raster, and the whole screen came to
        // over a megabyte of PNG -- which `publish-pages.sh` refuses to carry.
        await shotOf(page.getByRole("dialog"), `${tag}-09-packs`);

        // The offer, in both of its steps. This is the one dialog where somebody decides whether
        // to trust a stranger, so what it looks like is the whole of it: the host has to be
        // readable, and a region's own name must not be able to push it off the screen.
        //
        // A fresh page first -- an install link arrives with nothing else open -- and a pause
        // after each, because a dialog counts as visible the moment it starts fading in, and a
        // half-faded one photographs as transparent.
        const pack = "http://127.0.0.1:4173/maps/pack.testing.json";
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.goto(`/#/pack?url=${encodeURIComponent(pack)}`);
        const offer = page.getByRole("dialog");
        await expect(offer.getByText(/from 127\.0\.0\.1/i)).toBeVisible();
        await page.waitForTimeout(400);
        await shotOf(offer, `${tag}-10-offer-host`);

        await offer.getByRole("button", { name: /check this region/i }).click();
        await expect(offer.getByText(/crags · .* routes · version/i)).toBeVisible({
            timeout: 15_000,
        });
        await page.waitForTimeout(400);
        await shotOf(offer, `${tag}-11-offer-region`);
    });
}
