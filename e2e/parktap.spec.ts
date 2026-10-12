import { expect, openCallout, test, waitForApp } from "./fixtures";

/**
 * Tapping one of the open crag's car parks opens its card and leaves the crag chosen.
 *
 * It did not: Leaflet keeps one card open, and the car park's card closed the crag's -- which is
 * the viewer letting the crag go. The crag was deselected, its approach came off the map, and the
 * «P» that had just been tapped vanished from under its own card.
 *
 * The tap is dispatched on the «P» itself rather than at its position. On a phone at this zoom the
 * open crag is drawn over its car park, so a click at the car park's coordinates reaches the crag;
 * what is being tested here is what a tap on the car park does, wherever it can be reached.
 */
test("keeps the crag and its car park when the car park is tapped", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await openCallout(page);

    const park = page.locator(".leaflet-marker-icon .pk.hl").first();
    await park.dispatchEvent("click");

    await expect(page.locator(".leaflet-popup", { hasText: /car park/i })).toBeVisible();
    // The crag's card has been put away, not left open beside it (Leaflet fades it out first).
    await expect(page.locator(".leaflet-popup")).toHaveCount(1);
    await expect(park).toBeAttached();
    await expect(page.locator(".leaflet-marker-icon .mk.sel")).toHaveCount(1);
});
