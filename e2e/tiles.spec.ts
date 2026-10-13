import { expect, serveTiles, test, waitForApp } from "./fixtures";

/**
 * The base map, and the warning that stands in for it when it does not draw.
 *
 * Both halves are here because they are one bug. `stubNetwork` registered its catch-all abort
 * last, which in Playwright means it was asked first, so it answered for the tile hosts too and
 * every stub above it was dead. Nothing failed -- the suite is not about what the tiles show --
 * except that the map then warned, in every single test, that its base map was not drawing, and
 * laid that warning across the top of itself where the markers are. That is how
 * https://github.com/Chlaedderi/chlaedderi/issues/30 looked from outside: a marker that would not
 * open, with nothing wrong with the marker.
 *
 * So: the tiles can be served and really arrive, and when they cannot -- offline, under a cliff,
 * which is this app's own case -- the warning does not take the map's taps with it.
 */

test("draws its base map when the tiles are there", async ({ page }) => {
    await serveTiles(page);
    await page.goto("/");
    await waitForApp(page);

    // A tile element is not a tile: a refused request leaves the `img` in place with its `src`
    // set and nothing decoded behind it. `naturalWidth` is the only honest question.
    await expect(async () => {
        const drawn = await page.evaluate(
            () =>
                [...document.querySelectorAll<HTMLImageElement>(".leaflet-tile")].filter(
                    (img) => img.naturalWidth > 0,
                ).length,
        );
        expect(drawn, "the stubbed tiles must actually decode").toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });

    await expect(page.getByTestId("tile-trouble")).toHaveCount(0);
});

test("keeps the map tappable under the warning when they are not", async ({ page }) => {
    // No `serveTiles` here: this is the offline case, every tile refused and nothing decoded.
    await page.goto("/");
    await waitForApp(page);

    const warning = page.getByTestId("tile-trouble");
    await expect(warning).toBeVisible({ timeout: 15_000 });

    // Over the warning's own text the map is still what a tap reaches. Leaflet needs that: a
    // marker it covers would otherwise be unreachable, and a gesture that straddles the edge of
    // the warning is a click on nothing at all.
    const through = await warning.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const under = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return under?.closest(".leaflet-container") !== null;
    });
    expect(through, "a tap on the warning must reach the map under it").toBe(true);

    // And it is still a warning somebody can put away.
    await warning.getByRole("button").click();
    await expect(warning).toBeHidden();
});
