import { expect, openCallout, test, waitForApp } from "./fixtures";

/**
 * The open crag is drawn over its own car parks.
 *
 * It was not: the car parks had the larger offset, so wherever the two met, the «P» covered the
 * crag it was drawn for -- and a crag placed by its car park vanished under it and could not be
 * tapped. Leaflet sets each marker's `z-index` to its pixel row plus its offset, so the offset is
 * read back as `z-index` minus the row in the marker's own transform. Comparing the bare `z-index`
 * would test where the two happen to lie on the screen, not which one wins.
 */

const offsetOf = (el: Element): number => {
    const marker = el.closest(".leaflet-marker-icon") as HTMLElement;
    const row = /translate3d\(-?[\d.]+px, (-?[\d.]+)px/.exec(marker.style.transform)?.[1];
    return Number(marker.style.zIndex) - Math.round(Number(row));
};

test("draws the open crag over the car parks drawn for it", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await openCallout(page);

    const parks = page.locator(".leaflet-marker-icon .pk.hl");
    await expect(parks.first()).toBeAttached();

    const crag = await page.locator(".leaflet-marker-icon .mk.sel").evaluate(offsetOf);
    for (const park of await parks.all()) {
        expect(crag).toBeGreaterThan(await park.evaluate(offsetOf));
    }
    // And the car parks still cover every other crag that is drawn as a marker of its own.
    for (const other of await page.locator(".leaflet-marker-icon .mk:not(.sel)").all()) {
        expect(await parks.first().evaluate(offsetOf)).toBeGreaterThan(
            await other.evaluate(offsetOf),
        );
    }
});
