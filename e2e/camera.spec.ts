import { expect, settled, test, view, waitForApp } from "./fixtures";

/**
 * When the map moves, and whether the eye can follow it.
 *
 * Tapping a marker used to pan and zoom the map to fit the crag's whole approach, which is
 * disorienting in the one case where it is least wanted: the viewer pointed at something that was
 * already on the screen, and the ground moved under them. Picking a crag out of the list is the
 * opposite -- the map has to travel -- and it did that as a jump, with nothing to follow.
 *
 * So the camera follows a *reveal* and never a plain selection, and these watch both halves on a
 * real map. None of it can be checked in jsdom, which reports every element as 0x0 and so has no
 * view for the map to hold or lose.
 */

type Page = import("@playwright/test").Page;

test.use({ viewport: { width: 1400, height: 900 } });

/**
 * Open the first crag in the list, and say where the map was just afterwards and where it ended.
 *
 * The difference between the two is the whole test: a map that is already at `after` the moment
 * the row is clicked jumped, and one that is not travelled. Deliberately *not* a count of the
 * places it was drawn in -- Leaflet flies from its own `requestAnimationFrame`, so on a machine
 * running four browsers at once that counts how busy the machine is rather than what the app did.
 */
const openFirstRow = async (page: Page): Promise<{ early: Camera; after: Camera }> => {
    await page.locator(".MuiCard-root").first().click();
    const early = await view(page);
    await settled(page);
    return { early, after: await view(page) };
};

type Camera = Awaited<ReturnType<typeof view>>;

/**
 * The part of a reading that only a camera move changes.
 *
 * `x` is left out because opening a crag beside the map takes 400px off the map's width, and
 * Leaflet holds the centre, so the pane slides by half of that. That is the column, not a move.
 * `layers` is kept and is the one that matters: it is measured inside the pane, so the column
 * cannot touch it, and it is the only one that passes through the middle of a flight.
 */
const steady = ({ layers, y, zoom }: Camera) => ({ layers, y, zoom });

/**
 * Tap the marker nearest the middle of the map.
 *
 * Not simply the first one: a card opening against an edge is auto-panned into view by Leaflet,
 * which moves the map for a reason that has nothing to do with what is being measured here.
 */
const tapMiddleMarker = async (page: Page): Promise<void> => {
    const map = (await page.locator(".leaflet-container").boundingBox())!;
    const mid = { x: map.x + map.width / 2, y: map.y + map.height / 2 };
    const marks = page.locator(".leaflet-container .mk");

    let best: { x: number; y: number } | null = null;
    let nearest = Infinity;
    for (let i = 0; i < (await marks.count()); i++) {
        const box = await marks.nth(i).boundingBox();
        if (!box) continue;
        const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const away = Math.hypot(at.x - mid.x, at.y - mid.y);
        if (away < nearest) [nearest, best] = [away, at];
    }
    expect(best, "a marker to tap").not.toBeNull();

    await page.mouse.click(best!.x, best!.y);
    await expect(page.locator(".pop")).toBeVisible();
};

test("a tap on a marker leaves the view exactly where it was", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await settled(page);

    const before = await view(page);
    await tapMiddleMarker(page);
    // Long enough for any fit or flight to have started and finished.
    await page.waitForTimeout(1200);

    // Not «roughly»: nothing may move the map at all. The card's own auto-pan is the one thing
    // that still can, which is why the marker tapped is one with room around it.
    expect(await view(page)).toEqual(before);
    await expect(page.locator(".pop")).toBeVisible();
});

test("a row in the list flies there, rather than jumping", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await settled(page);

    const before = await view(page);
    const { early, after } = await openFirstRow(page);

    // It arrived -- and it was still on its way when the row had just been clicked, which is what
    // separates travelling from being there at once.
    expect(after.zoom).toBeGreaterThan(before.zoom);
    expect(steady(early)).not.toEqual(steady(after));
});

test("it cuts instead of flying when the viewer asked for less motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await waitForApp(page);
    await settled(page);

    const before = await view(page);
    const { early, after } = await openFirstRow(page);

    // There already, and nowhere in between: `fitBounds` without an animation lands inside the
    // click itself.
    expect(after.zoom).toBeGreaterThan(before.zoom);
    expect(steady(early)).toEqual(steady(after));
});
