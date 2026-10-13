import { expect, test, waitForApp } from "./fixtures";

/**
 * The base map, and the warning that stands in for it when it does not draw.
 *
 * Both halves are here because they rotted together. `stubNetwork` promises that every tile is
 * answered from a file in this repository, and for a long time none of them was: the catch-all
 * that aborts anything external was registered last, which in Playwright means it was asked
 * first, so it answered for the tile hosts too. Nothing failed -- the suite is not about what the
 * tiles show -- except that the map then warned, in every test, that its base map was not
 * drawing, and the warning lay across the top of the map where markers are. That is how
 * https://github.com/Chlaedderi/chlaedderi/issues/30 looked from outside: a marker that would not
 * open, with nothing wrong with the marker.
 *
 * So: the tiles really arrive, and if they ever stop, the warning does not take the map's taps
 * with it.
 */

test("draws its base map from the stub, without warning about it", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);

    // A tile element is not a tile: an aborted request leaves the `img` in place with its `src`
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

test("keeps the map tappable under the warning when they do not", async ({ page }) => {
    // This test is the offline case on purpose: every tile host refused, nothing decoded.
    await page.route(/wmts\.geo\.admin\.ch|tile\.|arcgisonline/, (route) => route.abort());
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
