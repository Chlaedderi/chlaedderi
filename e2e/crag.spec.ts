import { expect, openCallout, test, waitForApp } from "./fixtures";

/**
 * The crag page: the long tail of features the first React pass left out.
 */

const openFirstCrag = async (page: import("@playwright/test").Page): Promise<void> => {
    await page.goto("/");
    await waitForApp(page);
    await openCallout(page);
    await page
        .locator(".pop")
        .getByRole("button", { name: /open crag/i })
        .click();
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
};

test.describe("a crag page", () => {
    test.beforeEach(async ({ page }) => openFirstCrag(page));

    test("has the rail that jumps to its sections", async ({ page }) => {
        const rail = page.getByRole("navigation", { name: /sections of this page/i });
        await expect(rail).toBeVisible();
        await expect(rail.getByRole("button", { name: /routes/i })).toBeVisible();

        await rail.getByRole("button", { name: /routes/i }).click();
        await expect(page.locator("#routesec")).toBeInViewport();
    });

    test("lists the routes, numbered and graded", async ({ page }) => {
        const routes = page.locator("#routesec");
        await expect(routes).toBeVisible();
        // The grade column is there for the first route.
        await expect(
            page.getByRole("button", { name: /add .*logbook|new entry/i }).first(),
        ).toBeVisible();
    });

    test("says how fast the wall dries, and why", async ({ page }) => {
        // Either a verdict with its reasoning, or an honest «not known».
        await expect(page.getByText(/dries|not known|no estimate/i).first()).toBeVisible();
    });

    test("shows this crag's own logbook, and a way to add a route not in the list", async ({
        page,
    }) => {
        const log = page.locator("#cragLog");
        await expect(log).toBeVisible();
        await expect(log.getByRole("button", { name: /not in the list/i })).toBeVisible();
    });

    test("enters an ascent and shows it straight away", async ({ page }) => {
        await page
            .locator("#routesec")
            .getByRole("button", { name: /new entry/i })
            .first()
            .click();

        // The sheet is a drawer; its save button is the one of its kind on the page.
        const save = page.getByRole("button", { name: /enter in logbook/i });
        await expect(save).toBeVisible();
        await page.getByRole("button", { name: "Redpoint", exact: true }).click();
        await save.click();

        await expect(page.getByText(/entered in the logbook/i)).toBeVisible();
        // And this crag's own logbook now shows it.
        await expect(
            page
                .locator("#cragLog")
                .getByText(/redpoint/i)
                .first(),
        ).toBeVisible();
    });
});

test.describe("favourites and the logbook", () => {
    test("makes a backup code and takes one back", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        // A favourite to back up.
        await page
            .locator(".MuiCard-root")
            .first()
            .getByRole("button", { name: /favourites/i })
            .click();

        await page.goto("/#/fav");
        await expect(page.getByRole("heading", { name: /favourites/i })).toBeVisible();

        await page.getByRole("button", { name: /copy code/i }).click();
        const code = page.getByRole("textbox", { name: /copy this code/i });
        await expect(code).toBeVisible();
        const value = await code.inputValue();
        // FA2: the code carries the settings too now, which is how the list of installed regions
        // and the addresses they came from travel between devices. FA1 is still read -- codes are
        // kept in notes apps and pasted a year later. See src/core/transfer.ts.
        expect(value.startsWith("FA2.")).toBe(true);

        // Taking it back changes nothing, and says so rather than duplicating.
        await page.getByLabel(/paste a code here/i).fill(value);
        await page.getByRole("button", { name: /add from code/i }).click();
        await expect(page.getByText(/already saved/i)).toBeVisible();
    });

    test("says whether saving actually worked", async ({ page }) => {
        await page.goto("/#/fav");
        await expect(
            page.getByText(/storage works on this device|saved on this device/i),
        ).toBeVisible();
    });
});

test.describe("«Worth knowing»", () => {
    test("has the grade converter and records from the loaded data", async ({ page }) => {
        await page.goto("/#/know");
        // The accordion's own summary. Not `getByText`: the intro paragraph mentions the
        // converter too, and MUI wraps a summary in a heading of its own.
        await expect(page.getByRole("button", { name: /^Grade converter$/ })).toBeVisible();

        await page.getByText(/records from the atlas/i).click();
        await expect(page.getByText(/crag with the most routes/i)).toBeVisible();
    });
});
