import { expect, openCallout, test, waitForApp } from "./fixtures";

/**
 * Sharing a link, and opening one that was shared.
 *
 * Both halves were missing: `useShare` existed but nothing imported it, and the links the
 * hand-written app produced (`#<cragId>`, `#<cragId>~<routeKey>`) landed on an unmatched route and
 * silently went to the home screen. These tests exercise the behaviour, not the file.
 */

/** No share sheet, and a clipboard we can read back -- the desktop path the original fell back to. */
const useClipboardFallback = async (page: import("@playwright/test").Page): Promise<void> => {
    await page.addInitScript(() => {
        const w = window as unknown as { __copied?: string };
        // `navigator.share` must be absent so the hook takes the clipboard branch.
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

const openFirstCrag = async (page: import("@playwright/test").Page): Promise<string> => {
    await page.goto("/");
    await waitForApp(page);
    await openCallout(page);
    await page
        .locator(".pop")
        .getByRole("button", { name: /open crag/i })
        .click();
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    return new URL(page.url()).hash.replace(/^#\/crag\//, "");
};

test.describe("sharing", () => {
    test.beforeEach(async ({ page }) => useClipboardFallback(page));

    test("a crag page offers a share button that copies its own link", async ({ page }) => {
        const id = await openFirstCrag(page);

        await page.getByRole("button", { name: /share/i }).first().click();

        const copied = await page.evaluate(() => (window as { __copied?: string }).__copied);
        expect(copied).toBeTruthy();
        // The hand-written app's format: the bare crag id after the hash, not a router path.
        expect(copied).toBe(`${new URL(page.url()).origin}/#${id}`);
        await expect(page.getByText(/copied/i)).toBeVisible();
    });

    test("the log sheet offers a link to the single route", async ({ page }) => {
        await openFirstCrag(page);

        await page
            .getByRole("button", { name: /add .*logbook|new entry/i })
            .first()
            .click();
        const sheet = page.getByRole("presentation").last();
        await sheet.getByRole("button", { name: /share a link to this route/i }).click();

        const copied = await page.evaluate(() => (window as { __copied?: string }).__copied);
        // A route link is `#<cragId>~<routeKey>`, which is what `route.key` already holds.
        expect(copied).toMatch(/#[^~]+~.+$/);
    });
});

test.describe("opening a shared link", () => {
    test("a bare #<cragId> opens that crag", async ({ page }) => {
        const id = await openFirstCrag(page);

        // Exactly the link the old app put on the clipboard. It lands on the crag page, so the
        // map-and-searchbox wait does not apply here.
        await page.goto(`/#${id}`);

        await expect(page).toHaveURL(new RegExp(`#/crag/${id}$`));
        await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    });

    test("an unknown crag says so instead of silently going home", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await page.goto("/#no-such-crag-at-all");

        await expect(page.getByText(/not in the atlas/i)).toBeVisible();
    });

    test("a known crag with an unknown route opens the crag and says the route is missing", async ({
        page,
    }) => {
        const id = await openFirstCrag(page);
        await page.goto(`/#${id}~not-a-real-route`);

        await expect(page.getByText(/not the route/i)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`#/crag/${id}$`));
    });
});
