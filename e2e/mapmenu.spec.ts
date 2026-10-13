import { expect, test, waitForApp } from "./fixtures";

/**
 * The base-map menu has to fit the map it hangs in.
 *
 * It did not. All ten rows of it -- about 500px in Switzerland, which is where the showcase region
 * is, so it is what every first visitor gets -- hung from a Popper on the viewport and ran off the
 * bottom of any window shorter than roughly 750px: 86px of it at 412x667, 57px at 1280x720, 417px
 * in landscape. The page itself does not scroll: `body` is `overflow: hidden` and `html` is
 * `visible`, so that propagates to the viewport. «All approaches» and «All car parks» could
 * therefore not be reached by any gesture at all -- a real wheel over them moved nothing, and only
 * a programmatic `scrollTo` could bring them back.
 *
 * A Popper cannot be made to fit: `flip` moves a box that is too tall from one overflowing edge to
 * the other, and `preventOverflow` leaves the vertical axis alone for a `bottom-end` placement. So
 * the menu now hangs in the control stack, which the map's own height bounds.
 *
 * Nothing in the suite stood on that case -- the shortest viewport anywhere else is 700px and
 * nothing is ever landscape -- which is why these tests are deliberately short and wide ones.
 */

type Page = import("@playwright/test").Page;

const SHORT = { width: 412, height: 667 };

/**
 * Harsher than a real phone on its side (a Pixel 7 rotated is 915x412, and leaves the menu about
 * 114px), and chosen for that: the app's own bars take 166px off the top whatever the width, so
 * this is where «bounded by the map» is worth proving. What is left of the menu here is a couple of
 * rows -- cramped, but every row is reachable, which is the thing that was not true before.
 */
const LANDSCAPE = { width: 740, height: 360 };

const openMenu = async (page: Page) => {
    await page.getByRole("button", { name: /base map/i }).click();
    const menu = page.locator(".basemenu");
    await expect(menu).toBeVisible();
    return menu;
};

/** Open the app at a viewport of our own, rather than the project's. */
const start = async (page: Page, size: { width: number; height: number }): Promise<void> => {
    await page.setViewportSize(size);
    await page.goto("/");
    await waitForApp(page);
};

/** The menu may not reach past the map, nor stretch the page to make room for itself. */
const expectItFits = async (page: Page): Promise<void> => {
    const menu = (await (await openMenu(page)).boundingBox())!;
    const map = (await page.locator(".leaflet-container").boundingBox())!;
    expect(menu.y + menu.height).toBeLessThanOrEqual(map.y + map.height + 1);

    // The old menu grew the document to 844px on a 667px screen, and that is the overflow nothing
    // could scroll to.
    const grown = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        inner: window.innerHeight,
    }));
    expect(grown.scroll).toBeLessThanOrEqual(grown.inner + 1);
};

test.describe("the base-map menu on a short screen", () => {
    test("stays inside the map in portrait", async ({ page }) => {
        await start(page, SHORT);
        await expectItFits(page);
    });

    test("stays inside the map in landscape", async ({ page }) => {
        await start(page, LANDSCAPE);
        await expectItFits(page);
    });

    test("scrolls inside itself rather than off the bottom", async ({ page }) => {
        await start(page, SHORT);
        const menu = await openMenu(page);

        // Capped, with the rest reachable by scrolling: that is the whole mechanism.
        const size = await menu.evaluate((el) => ({
            scroll: el.scrollHeight,
            client: el.clientHeight,
        }));
        expect(size.scroll).toBeGreaterThan(size.client);
    });

    /**
     * A wheel over the menu reaches the rows that hung off the bottom.
     *
     * This is the one that pins the bug as a viewer met it. The others go through Playwright,
     * which scrolls an element into view programmatically -- and that worked even when the menu
     * was broken, because `scrollTo` moves a document whose overflow is hidden. A wheel does not:
     * on the old build this moved nothing at all, and nor did a finger.
     */
    test("scrolls under a real wheel, which it did not before", async ({ page }) => {
        await start(page, SHORT);
        const menu = await openMenu(page);

        await menu.hover();
        await page.mouse.wheel(0, 400);

        await expect.poll(async () => menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    });

    /** And the row at the end of that scroll is a working control, not just a reachable one. */
    test("reaches the last row, and it still works", async ({ page }) => {
        await start(page, SHORT);
        const menu = await openMenu(page);

        const parks = menu.locator("label").filter({ hasText: /all car parks/i });
        const box = parks.locator('input[type="checkbox"]');
        await expect(box).not.toBeChecked();

        await parks.scrollIntoViewIfNeeded();
        await expect(parks).toBeInViewport();

        await parks.click();
        await expect(box).toBeChecked();
    });

    /**
     * An open menu makes the stack as wide as itself, which leaves a band of empty box beside the
     * two 42px buttons. That band belongs to the map: the controls are targets, the box they sit
     * in is not. Without `pointer-events: none` on `.mapctl` this is a press the map never gets.
     */
    test("lets a press beside the buttons through to the map", async ({ page }) => {
        await start(page, SHORT);

        // A base map that did not load puts a dismissable alert across the top of the map, which
        // would take the probe below instead of the map. It is not always there -- it depends on
        // how the stubbed tiles happen to land -- and it is not what this test is about.
        const note = page.getByRole("alert").filter({ hasText: /did not load/i });
        if (await note.isVisible().catch(() => false)) {
            await note.getByRole("button").click();
            await expect(note).toBeHidden();
        }

        await openMenu(page);

        const stack = (await page.locator(".mapctl").boundingBox())!;
        const button = (await page.locator(".mapctl .mbtn").first().boundingBox())!;
        // Left of the buttons, level with them: inside the stack, on none of its controls.
        const at = { x: Math.round(stack.x + 8), y: Math.round(button.y + button.height / 2) };
        expect(at.x).toBeLessThan(button.x - 8);

        const hit = await page.evaluate((point) => {
            const el = document.elementFromPoint(point.x, point.y);
            return {
                stack: Boolean(el?.closest(".mapctl")),
                map: Boolean(el?.closest(".leaflet-container")),
            };
        }, at);
        expect(hit.stack).toBe(false);
        expect(hit.map).toBe(true);
    });
});
