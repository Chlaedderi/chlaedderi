import { expect, settled, test, view, waitForApp } from "./fixtures";

/**
 * The wide layout: the crag overview on the left, the map in the middle, a crag on the right.
 *
 * Two things are pinned here. The side columns must scroll **themselves**: a CSS grid item
 * defaults to `min-height: auto`, so a tall column stretches its row past the container and the
 * column's own `overflow: auto` never fires -- the list was simply unreachable below the fold and
 * the whole page scrolled instead.
 *
 * And the map must survive a trip into a crag and back. `/` and `/crag/:id` used to render
 * different components in the same place, so React threw the map away and Leaflet came back at
 * the region's default view: every pan and zoom the viewer had done was lost on the way in, and
 * lost again on the way out.
 */

type Page = import("@playwright/test").Page;

/**
 * The crag's own column: the third child of the grid `Home` lays out. Scoped, because «close» is a
 * common enough word on a screen -- the filter sheet has one of its own.
 */
const detail = (page: Page) => page.locator("main > div > div").nth(2);

test.describe("the wide layout", () => {
    test.use({ viewport: { width: 1400, height: 900 } });
    test.skip(({ viewport }) => (viewport?.width ?? 0) < 1200, "the three-column layout only");

    test("scrolls the side column, not the page", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);

        const measured = await page.evaluate(() => {
            const deepest = (root: Element | null): number =>
                Math.max(
                    0,
                    ...[...(root?.querySelectorAll("*") ?? [])]
                        .filter((e) => e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 200)
                        .map((e) => e.scrollHeight),
                );
            const grid = document.querySelector("main > div");
            return {
                viewport: window.innerHeight,
                document: document.documentElement.scrollHeight,
                listContent: deepest((grid?.children[0] as Element) ?? null),
            };
        });

        expect(measured.document).toBeLessThanOrEqual(measured.viewport + 1);
        expect(measured.listContent).toBeGreaterThan(300);
    });

    test("opens a crag beside the map, keeping both the list and the map", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);

        // Mark the live Leaflet container. A rebuilt map is a new element without the mark --
        // which is what used to happen, and why the viewer's pan and zoom were thrown away.
        await page.evaluate(() => {
            (document.querySelector(".leaflet-container") as HTMLElement).dataset.probe = "same";
        });

        const card = page.locator(".MuiCard-root").first();
        const name = (await card.getByRole("heading").first().textContent())!.trim();
        await card.click();

        // The crag gets a column of its own, and the list stays beside it rather than under it.
        await expect(page.getByRole("heading", { level: 2, name })).toHaveCount(1);
        await expect(page.locator(".MuiCard-root").first()).toBeVisible();
        await expect(page.locator(".leaflet-container")).toHaveAttribute("data-probe", "same");

        // Whatever the row's own reveal flew to, closing must leave it there. Here the crag stands
        // beside the map rather than over anything, so the way out closes rather than goes back.
        // Measured once the flight is over: taken as the heading appears, this reads mid-air.
        await settled(page);
        const opened = await view(page);
        await detail(page)
            .getByRole("button", { name: /^(close|schliessen)$/i })
            .click();
        await expect(page.getByRole("heading", { level: 2, name })).toBeHidden();
        await page.waitForTimeout(700);

        await expect(page.locator(".leaflet-container")).toHaveAttribute("data-probe", "same");
        const back = await view(page);
        // Zoom and the vertical offset are untouched. The horizontal one is not compared: the
        // crag column closing gives the map 400px back, and Leaflet holds the centre, so the
        // pane slides by half of that. That is the column, not a re-fit.
        expect(back.zoom).toBe(opened.zoom);
        expect(back.y).toBe(opened.y);
    });

    /**
     * Two walls of Monte Cucco, 75 m apart and sharing the car park `monte_cucco`. Whichever of
     * them the map has fitted itself to, the other is on screen -- and at that zoom the clusters
     * are off -- so the second marker is reachable without panning or zooming first.
     */
    const ANFITEATRO = "monte-cucco-anfiteatro";
    const CENTRALE = "Settore Centrale";

    test("follows the map: a second marker moves the column", async ({ page }) => {
        // Straight to the crag rather than through a first marker tap: it is the same route the
        // store is driven from, and it leaves nothing to miss.
        await page.goto(`/#/crag/${ANFITEATRO}`);
        await waitForApp(page);
        await expect(page.locator(".leaflet-container .mk.sel")).toBeVisible();
        await expect(page.locator(".pop")).toBeVisible();
        // The card is deliberately late: the map fits the approach first, 900 ms at the outside.
        await page.waitForTimeout(1000);

        // Keep every crag the map picks out, in order. The end state alone is not enough: a fix
        // that lets the route and the store argue still arrives at the right crag, having gone
        // through the wrong one on the way, and that flicker is the whole bug.
        await page.evaluate(() => {
            const seen: string[] = [];
            (window as unknown as { __picked: string[] }).__picked = seen;
            const read = (): void => {
                const sel = document
                    .querySelector(".leaflet-marker-icon:has(.mk.sel)")
                    ?.getAttribute("title");
                if (sel && seen[seen.length - 1] !== sel) seen.push(sel);
            };
            read();
            new MutationObserver(read).observe(document.querySelector(".leaflet-marker-pane")!, {
                subtree: true,
                childList: true,
                attributes: true,
            });
        });

        // Markers are cleared and re-added whenever the selection changes, so a held locator goes
        // stale mid-click. Measure, then click the pixels.
        await expect(async () => {
            const box = await page
                .locator(`.leaflet-marker-icon[title="${CENTRALE}"]`)
                .boundingBox();
            expect(box, "the neighbouring marker should be on screen").not.toBeNull();
            await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
            await expect(page).toHaveURL(/#\/crag\/monte-cucco-settore-centrale$/, {
                timeout: 3000,
            });
        }).toPass({ timeout: 15_000 });

        await page.waitForTimeout(1500);
        // The crag it started on, then the one that was tapped, and nothing else: the map moved
        // once. A trailing `…, "Anfiteatro", "Settore Centrale"` is the bounce -- the route pulling
        // the selection back to the open page before the page itself caught up.
        expect(await page.evaluate(() => (window as unknown as { __picked: string[] }).__picked)) //
            .toEqual(["Anfiteatro", CENTRALE]);
        await expect(detail(page).getByRole("heading", { level: 2 })).toHaveText(CENTRALE);
        await expect(page.locator(".pop .t")).toContainText(CENTRALE);

        // Moving from crag to crag is navigation, so it is in the history like any other.
        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`#/crag/${ANFITEATRO}$`));
    });

    test("a tap on the map puts the card away without closing the crag", async ({ page }) => {
        await page.goto(`/#/crag/${ANFITEATRO}`);
        await waitForApp(page);
        await expect(page.locator(".pop")).toBeVisible();
        await page.waitForTimeout(1000);

        // Open country, well clear of the card, the legend and the control stack.
        const map = (await page.locator(".leaflet-container").boundingBox())!;
        await page.mouse.click(map.x + 60, map.y + map.height - 120);

        await expect(page.locator(".pop")).toBeHidden();
        // What the tap was for: seeing what the card covered. The crag itself is not given up.
        await expect(page.locator(".leaflet-container .mk.sel")).toBeVisible();
        await expect(page.locator(".leaflet-overlay-pane path").first()).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`#/crag/${ANFITEATRO}$`));
        await expect(detail(page).getByRole("heading", { level: 2 })).toBeVisible();
    });

    test("opens the filters from the button, with a way to reset them", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);

        await page.getByRole("button", { name: "Filters" }).click();
        const sheet = page.locator(".MuiDrawer-paper");
        await expect(sheet.getByRole("heading", { name: /^filters$/i })).toBeVisible();
        // Reset lives in that header, which the old permanent column hid.
        await expect(sheet.getByRole("button", { name: /reset/i })).toBeVisible();

        await sheet.getByRole("button", { name: "Close" }).click();
        await expect(sheet).toBeHidden();
    });
});

/**
 * A phone: the crag covers the map, and the app bar carries the way back. The crag column used to
 * add a «Back» of its own right under that arrow -- one control shown twice, and two that did not
 * even agree: the bar went back in history, the column went home.
 */
test.describe("the phone layout", () => {
    test.skip(({ isMobile }) => !isMobile, "the phone layout only");

    const ARROW = /^(back|zurück)$/i;
    const CRAG = "monte-cucco-anfiteatro";

    test("has one way back on a crag, and it goes back", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await page.goto(`/#/crag/${CRAG}`);
        await expect(page.getByRole("heading", { level: 2 })).toBeVisible();

        await expect(page.getByRole("button", { name: ARROW })).toHaveCount(1);
        await page.getByRole("button", { name: ARROW }).click();
        // `?f=…` when filters are on: the map is the map either way (see filterlink.spec.ts).
        await expect(page).toHaveURL(/#\/(\?|$)/);
    });

    test("goes to the map from a crag opened by a shared link", async ({ page }) => {
        // Nothing of the app before it: history back would leave the app, or do nothing at all
        // in the installed one.
        await page.goto(`/#/crag/${CRAG}`);
        await expect(page.getByRole("heading", { level: 2 })).toBeVisible();

        await page.getByRole("button", { name: ARROW }).click();
        // `?f=…` when filters are on: the map is the map either way (see filterlink.spec.ts).
        await expect(page).toHaveURL(/#\/(\?|$)/);
        await expect(page.locator(".leaflet-container")).toBeVisible();
    });
});
