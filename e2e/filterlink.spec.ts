import { expect, test, waitForApp } from "./fixtures";

/**
 * The filters in the link.
 *
 * A link could name a crag, a route or a whole region, but never a *view* -- and the view is the
 * work. These tests are about the round trip in a real browser: narrow the list, copy the address
 * bar, open it somewhere else, and find the same list.
 *
 * The first one matters most. A view at rest must leave the URL alone, because three separate
 * things lean on that: the mirror not racing the read-back of what is stored, the opener's own
 * filters surviving somebody else's link, and every anchored `#/` assertion in this suite.
 */

/** No share sheet, so the hook takes the clipboard branch and the link can be read back. */
const useClipboardFallback = async (page: import("@playwright/test").Page): Promise<void> => {
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
};

/** The grade preset in the chip row -- the quickest way a viewer narrows the list. */
const preset = (page: import("@playwright/test").Page) =>
    page.getByRole("group", { name: "Filters" }).getByRole("button", { name: "8a+" });

const setAFilter = async (page: import("@playwright/test").Page): Promise<void> => {
    await preset(page).click();
    await expect(page.locator(".MuiBadge-badge").first()).toHaveText("1");
};

const openFilters = async (page: import("@playwright/test").Page): Promise<void> => {
    await page.getByRole("button", { name: /^(filters|filter)$/i }).click();
    await expect(page.getByRole("heading", { name: /^(filters|filter)$/i })).toBeVisible();
};

const SHARE_VIEW = /share these filters|diese filter teilen/i;

test.describe("the filters in the address bar", () => {
    test("a view nobody has narrowed leaves the URL alone", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);

        // Long enough for the mirror's debounce to have fired, had it anything to say.
        await page.waitForTimeout(800);
        await expect(page).not.toHaveURL(/[?&]f=/);
    });

    test("setting a filter puts it in the URL, and clearing it takes it out again", async ({
        page,
    }) => {
        await page.goto("/");
        await waitForApp(page);

        await setAFilter(page);
        await expect(page).toHaveURL(/[?&]f=F1\.[A-Za-z0-9_-]+/);

        await preset(page).click();
        await expect(page).not.toHaveURL(/[?&]f=/);
    });

    test("a copied URL brings the same list back, and says where it came from", async ({
        page,
    }) => {
        await page.goto("/");
        await waitForApp(page);
        await setAFilter(page);
        await expect(page).toHaveURL(/[?&]f=/);
        const shared = page.url();
        const count = await page
            .getByText(/of \d+ crags|von \d+ gebieten/i)
            .first()
            .innerText();

        // A different page, with nothing of this one behind it -- what the recipient opens.
        await page.goto("about:blank");
        await page.goto(shared);
        await waitForApp(page);

        await expect(page.locator(".MuiBadge-badge").first()).toHaveText("1");
        await expect(page.getByText(/from this link|aus diesem link/i)).toBeVisible();
        await expect(page.getByText(/of \d+ crags|von \d+ gebieten/i).first()).toHaveText(count);
    });
});

test.describe("sharing a view", () => {
    test.beforeEach(async ({ page }) => useClipboardFallback(page));

    test("the drawer has nothing to share until something is set", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await openFilters(page);

        await expect(page.getByRole("button", { name: SHARE_VIEW })).toBeDisabled();
    });

    test("the share button copies a link that carries the filters", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await setAFilter(page);
        await openFilters(page);

        await page.getByRole("button", { name: SHARE_VIEW }).click();

        const copied = await page.evaluate(() => (window as { __copied?: string }).__copied);
        // The showcase has no address to give, so the link is the plain one to the map.
        expect(copied).toMatch(/#\/\?f=F1\.[A-Za-z0-9_-]+$/);
        await expect(page.getByText(/copied|kopiert/i)).toBeVisible();
    });

    test("a region loaded from an address is offered along with the view", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        // A link to a view has to carry the region, or the recipient gets filters and an empty
        // screen -- so it goes through the region route, which offers the pack and carries the
        // code on to the map.
        await page.getByRole("button", { name: /load a region|region laden/i }).click();
        await page.getByLabel(/address of a mappack|adresse/i).fill("/maps/pack.testing.json");
        await page.getByRole("button", { name: /^(load|laden)$/i }).click();
        const dialog = page
            .getByRole("dialog")
            .filter({ hasText: /load this region|gebiet laden/i });
        const check = dialog.getByRole("button", { name: /check this region|gebiet prüfen/i });
        if (await check.isEnabled().catch(() => false)) await check.click();
        await dialog
            .getByRole("button", { name: /load region|replace region|gebiet (laden|ersetzen)/i })
            .click({ timeout: 15_000 });
        await expect(page.getByText(/region loaded|region geladen/i)).toBeVisible({
            timeout: 15_000,
        });

        await setAFilter(page);
        await openFilters(page);
        await page.getByRole("button", { name: SHARE_VIEW }).click();

        const copied = await page.evaluate(() => (window as { __copied?: string }).__copied);
        expect(copied).toContain("#/pack?url=");
        expect(copied).toMatch(/&f=F1\./);
    });
});

test.describe("the way back, with filters on", () => {
    test.skip(({ isMobile }) => !isMobile, "the back arrow is the phone layout's");

    test("a crag opened by a shared link still goes to the map", async ({ page }) => {
        // The arrow asks whether the app was opened straight onto this page. Mirroring the filters
        // replaces the history entry, which used to destroy the only evidence of that -- and the
        // arrow then offered to go back to somebody else's page, or out of the installed app.
        // Nothing here has to be shared *with* filters: having any of one's own is enough.
        await page.goto("/");
        await waitForApp(page);
        await setAFilter(page);
        await expect(page).toHaveURL(/[?&]f=/);
        // Long enough for the filters to have reached localStorage, which is what the next visit
        // reads them back out of.
        await page.waitForTimeout(600);

        // The hand-written app's own link, opened cold: nothing of the app before it.
        await page.goto("about:blank");
        await page.goto("/#testing-musterwand");
        await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
        // The filters come back from the device and are mirrored, replacing the history entry.
        await expect(page).toHaveURL(/[?&]f=/);

        await page.getByRole("button", { name: /^(back|zurück)$/i }).click();
        await expect(page.locator(".leaflet-container")).toBeVisible();
        await expect(page).toHaveURL(/#\/(\?|$)/);
    });
});
