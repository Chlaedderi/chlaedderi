import { expect, test, waitForApp } from "./fixtures";

/**
 * Arriving with your data in the address.
 *
 * The app changed address, and browser storage belongs to the host: at the new one everybody would
 * otherwise start empty. The page left behind at the old address reads what is there and sends the
 * viewer here with it in the fragment — so it is never sent to a server, not even the one serving
 * the page.
 *
 * `stub/index.html` is the page that builds these codes. What is checked here is the other half:
 * that a code in the address really does arrive, and that nothing already here is lost to it.
 */

const CRAG = "rian-cornei-cordon-bleu";

const code = (payload: Record<string, unknown>): string => {
    const json = JSON.stringify({ v: 2, ...payload });
    const b64 = Buffer.from(json, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return `FA2.${b64}`;
};

const favourites = async (page: import("@playwright/test").Page) => {
    await page.goto("/#/fav");
    await expect(page.getByRole("heading", { name: /favourites/i })).toBeVisible({
        timeout: 15_000,
    });
};

test.describe("a hand-over link", () => {
    test("brings favourites, the logbook and the settings with it", async ({ page }) => {
        const link = code({
            fav: { c: [CRAG], r: [] },
            log: [
                {
                    id: "moved-1",
                    k: `${CRAG}~cordon-bleu`,
                    s: CRAG,
                    n: "Cordon Bleu",
                    g: "6a",
                    d: "2026-10-01",
                    st: "rp",
                    r: 3,
                    t: 1,
                },
            ],
            prefs: { theme: "dark" },
        });

        await page.goto(`/#/transfer?c=${encodeURIComponent(link)}`);
        await waitForApp(page);

        // It says what arrived rather than succeeding silently.
        await expect(page.getByText(/Added: 1 favourite crags|1 Favoriten/i)).toBeVisible({
            timeout: 15_000,
        });

        await favourites(page);
        await expect(page.getByText(/Cordon Bleu/i).first()).toBeVisible();

        await page.goto("/#/log");
        await expect(page.getByText(/Cordon Bleu/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test("adds to what is already here instead of replacing it", async ({ page }) => {
        // Favourite a crag by hand first.
        await page.goto("/");
        await waitForApp(page);
        const card = page.locator(".MuiCard-root").first();
        // Whichever crag the list happens to put first: the test is about not losing it, not
        // about which one it is.
        const mine = (await card.getByRole("heading").first().innerText()).trim();
        // The heart on the card -- `getByRole` alone would find the Favourites tab first.
        await card.getByRole("button", { name: /favourites/i }).click();
        await favourites(page);
        await expect(page.getByText(mine, { exact: false }).first()).toBeVisible();

        // Then follow a code that knows nothing about it.
        const empty = code({ fav: { c: [], r: [] }, log: [] });
        await page.goto(`/#/transfer?c=${encodeURIComponent(empty)}`);
        await waitForApp(page);

        await favourites(page);
        await expect(page.getByText(mine, { exact: false }).first()).toBeVisible();
    });

    test("says so when the code is not one", async ({ page }) => {
        await page.goto("/#/transfer?c=not-a-code");
        await waitForApp(page);
        await expect(page.getByText(/not a valid code|kein gültiger Code/i).first()).toBeVisible({
            timeout: 15_000,
        });
    });
});
