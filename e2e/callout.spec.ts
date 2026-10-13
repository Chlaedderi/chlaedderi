import { expect, openCallout, test, waitForApp } from "./fixtures";

/**
 * The card a marker opens, and the one thing it has to do: point at its marker.
 *
 * It did not. Leaflet measures a popup once, when it opens, and places it so that the measured
 * box's centre -- where the tip is -- sits on the marker. Our content arrives through a React
 * portal, so what it measured was an empty box, and the card ended up about half its own width to
 * the right of the dot. The same stale measurement went into Leaflet's auto-pan, so tapping a
 * marker also panned the map somewhere nobody asked for, and nothing bounded the card's width, so
 * on a phone it ran off the side of the screen.
 *
 * None of that showed up in a unit test: jsdom reports every element as 0x0, so a measurement bug
 * is invisible there. It was plain in a screenshot, and it is these numbers here.
 */

type Page = import("@playwright/test").Page;

const TIP = ".leaflet-popup-tip-container";
const DOT = ".leaflet-container .mk.sel";

/**
 * One named crag, rather than «whichever marker comes first». The region has crags in four areas
 * kilometres apart, so panning and zooming changes which markers are on screen and which one is
 * first in the DOM -- and these tests measure a card against *its own* marker, so they have to
 * keep hold of the same one throughout. This crag is the only one in its area, with nothing
 * beside it to be confused with.
 */
const MARKER = '.leaflet-container .leaflet-marker-icon[title="Gesperrte Attrappe"] .mk';
const CARD = ".leaflet-popup-content-wrapper";

/** The horizontal centre of the first match, in page pixels. */
const centreX = async (page: Page, selector: string): Promise<number> => {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${selector} should be on screen`).not.toBeNull();
    return box!.x + box!.width / 2;
};

/** How far the tip is from the marker it belongs to. */
const offBy = async (page: Page): Promise<number> =>
    Math.abs((await centreX(page, TIP)) - (await centreX(page, DOT)));

/**
 * Put a marker in the middle of the map and zoom in on it.
 *
 * The test has to arrange this for itself now that a tap no longer moves the map. At the zoom a
 * region opens on -- on a phone especially -- a crag and its car park are the same two or three
 * pixels, so a card «clear of the approach» cannot be told from one lying on top of it, and the
 * car park covers the marker underneath so that it cannot be clicked at all. In the middle,
 * because the cluster layer drops every marker that leaves the screen, and the test below drags
 * the map about.
 *
 * Panned with the arrow keys rather than by dragging: a drag has to start somewhere, and anywhere
 * it starts might be a marker, which swallows it.
 */
const KEY_PAN = 80;

/** Pan so that the first marker sits this far from the middle of the map. */
const putMarkerAt = async (page: Page, offX: number, offY: number): Promise<void> => {
    const map = (await page.locator(".leaflet-container").boundingBox())!;
    const want = { x: map.x + map.width / 2 + offX, y: map.y + map.height / 2 + offY };
    const box = (await page.locator(MARKER).first().boundingBox())!;
    const dx = Math.round((box.x + box.width / 2 - want.x) / KEY_PAN);
    const dy = Math.round((box.y + box.height / 2 - want.y) / KEY_PAN);

    await page.locator(".leaflet-container").focus();
    for (let i = 0; i < Math.abs(dx); i++) {
        await page.keyboard.press(dx > 0 ? "ArrowRight" : "ArrowLeft");
    }
    for (let i = 0; i < Math.abs(dy); i++) {
        await page.keyboard.press(dy > 0 ? "ArrowDown" : "ArrowUp");
    }
    await page.waitForTimeout(500);
};

const frameAMarker = async (page: Page): Promise<void> => {
    // Zoomed with the wheel over the marker itself, which is what keeps it under the cursor:
    // zooming into the middle of a region lands on open country with no markers on the screen
    // at all. Re-read each time, because every step moves it a little.
    for (let i = 0; i < 4; i++) {
        const box = await page.locator(MARKER).first().boundingBox();
        if (!box) break;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(350);
    }
    await putMarkerAt(page, 0, 0);
};

test.describe("the crag call-out", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await frameAMarker(page);
        await openCallout(page, MARKER);
    });

    test("points at its marker, and keeps pointing at it", async ({ page }) => {
        // Four pixels of slack: Leaflet rounds the half-width it offsets the box by.
        expect(await offBy(page)).toBeLessThan(4);

        // Set back by exactly what the drag below is about to undo, so the marker lands in the
        // middle for the zoom that follows. A zoom doubles how far a thing is from the centre,
        // and the cluster layer drops any marker that leaves the screen -- so a marker left near
        // an edge is a marker the last assertion cannot find.
        await putMarkerAt(page, -110, 70);

        // Dragged from a strip of bare map above the card. Pressing on the card drags nothing --
        // Leaflet keeps its own clicks off the map -- and letting go somewhere else is then read
        // as a tap on open country, which lets the crag go and takes the card with it.
        const map = (await page.locator(".leaflet-container").boundingBox())!;
        const card = (await page.locator(CARD).boundingBox())!;
        const from = { x: map.x + 40, y: Math.max(map.y + 90, card.y - 40) };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + 110, from.y - 70, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        await expect(page.locator(".pop")).toBeVisible();
        expect(await offBy(page)).toBeLessThan(4);

        await page.keyboard.press("Equal");
        await page.waitForTimeout(800);
        await expect(page.locator(".pop")).toBeVisible();
        expect(await offBy(page)).toBeLessThan(4);
    });

    test("stays inside the screen, whole", async ({ page }) => {
        const card = (await page.locator(CARD).boundingBox())!;
        const view = page.viewportSize()!;
        expect(card.x).toBeGreaterThanOrEqual(-1);
        expect(card.x + card.width).toBeLessThanOrEqual(view.width + 1);
        // Not merely on screen: the button at its foot has to be reachable, which is what was
        // lost when the card ran off a phone's right edge.
        await expect(
            page.locator(".pop").getByRole("button", { name: /open crag/i }),
        ).toBeInViewport({ ratio: 1 });
    });

    test("hangs clear of the way to the car park", async ({ page }) => {
        // Every crag in the showcase pack has its car park north of the wall, so every card has
        // to hang under its marker -- above it is exactly where the approach runs.
        await expect(page.locator(".leaflet-popup.below")).toBeVisible();

        const card = (await page.locator(CARD).boundingBox())!;
        const park = (await page.locator(".leaflet-container .pk").first().boundingBox())!;
        const overlaps =
            card.x < park.x + park.width &&
            park.x < card.x + card.width &&
            card.y < park.y + park.height &&
            park.y < card.y + card.height;
        expect(overlaps, "the card must not cover the car park").toBe(false);
    });

    /**
     * The last assertion here was red for a while, and not for the reason it looked like: nothing
     * was wrong with the selection. The suite draws no base map, so the map warns about it, and
     * that warning lies across the top of the map -- where this region's geometry happens to
     * leave this marker. The tap went down on the marker and up on the warning, which is a click
     * on neither, and Leaflet never heard it. The warning lets the map have its taps now; see
     * `e2e/tiles.spec.ts` and https://github.com/Chlaedderi/chlaedderi/issues/30.
     */
    test("closes from its own button, without letting the crag go", async ({ page }) => {
        await page
            .locator(".pop")
            .getByRole("button", { name: /close|schliessen/i })
            .click();
        await expect(page.locator(".pop")).toBeHidden();

        // The point of closing it is to see what was underneath: the approach and the car park
        // stay drawn, and the marker stays picked out.
        await expect(page.locator(DOT)).toBeVisible();
        await expect(page.locator(".leaflet-overlay-pane path").first()).toBeVisible();
        await expect(page.locator(".leaflet-container .pk").first()).toBeVisible();

        // And tapping the marker again brings it back, rather than appearing to do nothing.
        await page.locator(DOT).click();
        await expect(page.locator(".pop")).toBeVisible();
    });
});

/**
 * A long name stays on the card, and so do the buttons beside it.
 *
 * `.pop` is a grid, so each row was floored at its own min-content width -- and the title row is a
 * nowrap name beside two icon buttons, which made that floor the whole name. The card stayed 280
 * wide while its title row stood 384: the name ran out over the map and carried the heart and the
 * cross off the edge with it, where no thumb could reach them. Nothing shortened, either, because a
 * row that is never squeezed gives `text-overflow: ellipsis` nothing to do.
 *
 * It stands outside the group above because it needs its own viewport *before* the card is opened:
 * at 320 the card is sized by `calc(100vw - 44px)` rather than by the 280 cap, which is the squeeze
 * that makes the showcase's own longest name -- «Attrappengrat Westgrat Süd» -- too wide for the
 * room it has. No pack is loaded, so this is the app as it arrives. The crag is opened by name
 * rather than by tapping whichever marker comes first, because it is that one name this is about.
 */
const LONGEST = "Attrappengrat Westgrat Süd";

test("keeps a long name, and its buttons, on the card", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    // Not `waitForApp`: at 320 the crag page takes the app bar, search box and all, so the thing
    // to wait for is the map and the card itself.
    await page.goto("/#/crag/testing-attrappengrat-westgrat");
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".pop")).toBeVisible();

    // No slack anywhere: a single pixel of spill is the bug on its way back.
    const pop = page.locator(".pop");
    const spill = await pop.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(spill, "the card's rows must fit the card").toBe(0);

    const card = (await page.locator(CARD).boundingBox())!;
    for (const name of [/favourites|favoriten/i, /close|schliessen/i]) {
        const button = (await pop.getByRole("button", { name }).boundingBox())!;
        expect(
            button.x + button.width,
            `${String(name)} must stay on the card`,
        ).toBeLessThanOrEqual(card.x + card.width);
    }

    // And the name is still readable, not cut to a stump: two lines of it, inside the card.
    const title = page.locator(".pop .t .kat-ellipsis");
    await expect(title).toHaveText(LONGEST);
    const clipped = await title.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(clipped, "the name must not be clipped by its own clamp").toBeLessThanOrEqual(1);
});

test("a tapped point says where it is, and closes again", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    // A long press on a touch screen and a right-click on a desktop are the same event.
    await page
        .locator(".leaflet-container")
        .click({ button: "right", position: { x: 160, y: 300 } });

    const pop = page.locator(".ptpop");
    await expect(pop).toBeVisible();
    await pop.getByRole("button", { name: /close|schliessen/i }).click();
    await expect(pop).toBeHidden();
});
