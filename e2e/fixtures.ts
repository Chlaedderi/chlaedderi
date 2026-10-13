/**
 * The ground every browser test stands on.
 *
 * Two things matter here. **Nothing reaches the network**: tiles, weather, radar and swisstopo are
 * answered locally, so a test cannot fail because an upstream service is slow or a licence page
 * moved. And **the app starts empty**, with only the showcase, unless a test loads a pack.
 */

import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every tile request is answered with a PNG from the repository itself. Any small image does --
 * the tests are about the app, not about what the tiles show -- and taking one off disk keeps a
 * long base64 blob out of the source, where it only reads like a leaked credential.
 */
const TILE_FILE = "favicon-32.png";

const TILE_HOSTS = [
    "**/*.tile.openstreetmap.org/**",
    "**/tile.openstreetmap.org/**",
    "**/*.tile.opentopomap.org/**",
    "**/tile.opentopomap.org/**",
    "**/wmts.geo.admin.ch/**",
    "**/wms.geo.admin.ch/**",
    "**/server.arcgisonline.com/**",
    "**/radar-geowebcache.protezionecivile.it/**",
    // The showcase gallery points at Wikimedia Commons. Answering it from disk keeps the browser
    // suite off the network and still draws a picture where a picture belongs.
    "**/upload.wikimedia.org/**",
];

/** Stub every host the app talks to. Individual tests override what they need. */
export const stubNetwork = async (page: Page): Promise<void> => {
    for (const pattern of TILE_HOSTS) {
        await page.route(pattern, (route) =>
            route.fulfill({ contentType: "image/png", path: TILE_FILE }),
        );
    }
    await page.route("**/api.open-meteo.com/**", (route) => route.fulfill({ json: [] }));
    await page.route("**/api.rainviewer.com/**", (route) =>
        route.fulfill({ json: { radar: { past: [], nowcast: [] }, host: "" } }),
    );
    await page.route("**/api3.geo.admin.ch/**", (route) => route.fulfill({ json: {} }));
    await page.route("**/brouter.de/**", (route) => route.fulfill({ json: {} }));
    // Anything else external is a mistake the test should notice, not silently allow.
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
};

/**
 * The showcase is an invented region, so the app puts its «these crags are invented» dialog in
 * front of everything on a first visit. That is the point of it, and it would stand in front of
 * every test too -- so a test starts as a reader who has already read it. `e2e/demo.spec.ts` drops
 * this again, and is where the dialog itself is checked.
 */
export const seenTheDemoDialog = async (page: Page): Promise<void> => {
    await page.addInitScript(() => {
        try {
            // The shape `readPrefsSync` expects: the settings under `v`.
            const item = "chlaedderi:prefs";
            // Only when nothing is stored yet. An init script runs on every navigation, and a
            // test that wants the dialog back writes its own settings and reloads.
            if (!window.localStorage.getItem(item)) {
                window.localStorage.setItem(item, JSON.stringify({ v: { demoSeen: true } }));
            }
        } catch {
            // A browser that will not hand over localStorage shows the dialog; that is no worse.
        }
    });
};

export const test = base.extend({
    page: async ({ page }, use) => {
        await stubNetwork(page);
        await seenTheDemoDialog(page);
        await use(page);
    },
});

export { expect };

/** The app is ready when the map has drawn and the list has its count. */
export const waitForApp = async (page: Page): Promise<void> => {
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.getByRole("searchbox", { name: /search crags|gebiete/i })).toBeVisible();
};

/**
 * Load one of the repository's own packs, which tools/serve.pl serves from maps/.
 *
 * There are two: the showcase the app already carries, and maps/pack.testing.json, an invented
 * region. The real ones are private, so nothing here may depend on them.
 *
 * Two steps now: typing an address raises the same confirmation a link does, because that is the
 * only place that says the region is about to replace one already loaded.
 */
export const loadPack = async (page: Page, name: string): Promise<void> => {
    await page.getByRole("button", { name: /load a region|region laden/i }).click();
    await page.getByLabel(/address of a mappack|adresse/i).fill(`/maps/pack.${name}.json`);
    await page.getByRole("button", { name: /^(load|laden)$/i }).click();
    await confirmPack(page);
};

/**
 * Say yes in the offer dialog, through whichever of its two steps it is showing.
 *
 * An address the viewer typed fetches straight away, and «check» is then on screen but disabled
 * while it does -- so the question is whether that button is *enabled*, not whether it is there.
 */
export const confirmPack = async (page: Page): Promise<void> => {
    const dialog = page.getByRole("dialog").filter({ hasText: /load this region|gebiet laden/i });
    const check = dialog.getByRole("button", { name: /check this region|gebiet prüfen/i });
    if (await check.isEnabled().catch(() => false)) await check.click();
    await dialog
        .getByRole("button", { name: /load region|replace region|gebiet (laden|ersetzen)/i })
        .click({ timeout: 15_000 });
    await expect(page.getByText(/region loaded|region geladen/i)).toBeVisible({ timeout: 15_000 });
};

/**
 * Go to one of the app's pages, whichever layout is on screen.
 *
 * The phone keeps Favourites, Logbook and More in the bottom tab bar; the wide layout puts them in
 * the header, exactly as the original's `.smonly` / `.lgonly` pair did. A test should not care.
 */
export const gotoTab = async (page: Page, name: RegExp): Promise<void> => {
    const bar = page.locator(".MuiBottomNavigation-root");
    const nav = (await bar.isVisible()) ? bar : page.locator("header");
    await nav.getByRole("button", { name }).click();
};

/**
 * Tap a crag marker and wait for its call-out.
 *
 * Retried as a unit: the map fits itself to the crags when it loads, and a click that lands while
 * that animation is still running misses the marker and reaches the map behind it, which clears
 * the selection instead of making one.
 *
 * The inner wait has room in it because the card can be late: the map moves to wherever it was
 * asked to go first, and the card opens when that movement is over. For this tap it is not asked
 * to go anywhere, so the card is immediate -- but the same helper is used after a reveal.
 * `.leaflet-popup` rather than `.pop`, because the popup shell is what carries the `below` class
 * that says which side of the marker the card ended up on.
 */
export const openCallout = async (page: Page, marker = ".leaflet-container .mk"): Promise<void> => {
    await expect(async () => {
        await page.locator(marker).first().click();
        await expect(page.locator(".leaflet-popup")).toBeVisible({ timeout: 3000 });
        await expect(page.locator(".pop")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
};

/**
 * Where Leaflet is looking, read off its own DOM rather than from the app.
 *
 * `layers` is there because the other three go still during a flight. `flyTo` does not move the
 * map pane frame by frame: it only updates its own centre and zoom and fires events, and the
 * layers follow by transforming themselves. So the pane and the tile's `z` say where a movement
 * started and ended, and `layers` is the only one of them that passes through the middle.
 */
export const view = async (
    page: Page,
): Promise<{ x: number; y: number; zoom: number; layers: string }> =>
    page.evaluate(() => {
        const pane = document.querySelector(".leaflet-map-pane") as HTMLElement;
        const tile = document.querySelector(".leaflet-tile") as HTMLElement | null;
        const tiles = document.querySelector(".leaflet-tile-container") as HTMLElement | null;
        const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(pane.style.transform ?? "");
        return {
            x: Math.round(Number(m?.[1] ?? 0)),
            y: Math.round(Number(m?.[2] ?? 0)),
            // The tile's own z, which only changes when the zoom does. Taken from the `z/x/y`
            // at the end of the address rather than the first number in it: swisstopo's tiles
            // carry `/3857/` -- the projection -- in front of the zoom, and that never moves.
            zoom: Number(
                /\/(\d+)\/\d+\/\d+\.\w+(?:$|\?)/.exec(tile?.getAttribute("src") ?? "")?.[1] ?? -1,
            ),
            layers: tiles?.style.transform ?? "",
        };
    });

/**
 * Wait until the map has stopped moving.
 *
 * Needed since the map flies rather than jumps: a measurement taken the moment a crag appears is
 * a measurement taken in mid-air, which is a flake in any test that compares two of them.
 */
export const settled = async (page: Page): Promise<void> => {
    await expect(async () => {
        const before = await view(page);
        await page.waitForTimeout(150);
        expect(await view(page)).toEqual(before);
    }).toPass({ timeout: 10_000 });
};
