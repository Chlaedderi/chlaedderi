import { expect, openCallout, test, waitForApp } from "./fixtures";

/**
 * Nothing untranslated, unfilled or half-rendered may reach the screen.
 *
 * Three different bugs of this shape survived unit tests and only showed up in a screenshot:
 * `61 route|routes` (a plural key printed whole), `Version {0}: dev` (an unfilled placeholder) and
 * `m.know.h` (i18next falling back to the key for a deliberately empty text). One check catches
 * all three, on every screen.
 */

/** `some.key.here` on its own -- a translation key that was never resolved. */
const RAW_KEY = /^[a-z][a-z0-9]*(\.[a-z0-9.+-]+){1,}$/i;

const screens: [name: string, go: (page: import("@playwright/test").Page) => Promise<void>][] = [
    [
        "map",
        async (page) => {
            await page.goto("/");
            await waitForApp(page);
        },
    ],
    [
        "crag",
        async (page) => {
            await page.goto("/");
            await waitForApp(page);
            await openCallout(page);
            await page
                .locator(".pop")
                .getByRole("button", { name: /open crag/i })
                .click();
            await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
        },
    ],
    [
        "favourites",
        async (page) => {
            await page.goto("/#/fav");
            await page.waitForTimeout(400);
        },
    ],
    [
        "logbook",
        async (page) => {
            await page.goto("/#/log");
            await page.waitForTimeout(400);
        },
    ],
    [
        "more",
        async (page) => {
            await page.goto("/#/more");
            await page.waitForTimeout(500);
        },
    ],
    [
        "know",
        async (page) => {
            await page.goto("/#/know");
            await page.waitForTimeout(500);
        },
    ],
    [
        "coverage",
        async (page) => {
            await page.goto("/#/coverage");
            await page.waitForTimeout(500);
        },
    ],
];

for (const [name, go] of screens) {
    test(`${name}: no raw keys, placeholders or plural bars`, async ({ page }) => {
        await go(page);

        const offenders = await page.evaluate(() => {
            const bad: string[] = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const text = (node.textContent ?? "").trim();
                if (!text) continue;
                // An unfilled interpolation, or a plural key rendered whole.
                if (/\{\d\}/.test(text) || /\w\|\w/.test(text)) bad.push(text);
                // A bare key: no spaces, dotted, all lower case.
                else if (!text.includes(" ") && /^[a-z][a-z0-9]*(\.[a-z0-9.+-]+){1,}$/.test(text)) {
                    bad.push(text);
                }
            }
            return bad;
        });

        // A filename or a URL is fine; a translation key is not.
        const real = offenders.filter(
            (s) => !/\.(json|html|js|css|png|svg)$/.test(s) && !s.includes("://"),
        );
        expect(real, `untranslated text on the ${name} screen`).toEqual([]);
        expect(RAW_KEY.test("m.know.h")).toBe(true); // the matcher itself still works
    });
}

/**
 * The name in the browser tab and on the homescreen. `src/name.test.ts` holds the files that
 * carry it to one spelling; this checks the one the built app actually serves.
 */
test("the tab carries the app's name", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await expect(page).toHaveTitle("Chlädderi");
});
