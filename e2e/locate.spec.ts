import { expect, test, waitForApp } from "./fixtures";

/**
 * «My position»: the button says it centres the map and that a second tap switches it off. It
 * did neither -- the marker went down wherever the map happened not to be looking.
 */

/** A few hundred metres from the showcase's Musterwand. */
const NEAR = { latitude: 46.608, longitude: 7.6 };

test.use({ geolocation: NEAR, permissions: ["geolocation"] });

test("centres on the position, and a second tap switches it off", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    // Somewhere else first, so that centring is something to see: drag the region off-screen.
    const box = (await page.locator(".leaflet-container").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (let i = 0; i < 3; i++) {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx - box.width * 0.45, cy - box.height * 0.45, { steps: 8 });
        await page.mouse.up();
    }

    const button = page.getByRole("button", { name: "Show my position" });
    await button.click();
    const on = page.getByRole("button", { name: /centre on my position/i });
    await expect(on).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".leaflet-container .me")).toHaveCount(1);

    // The marker is on screen: the map came to it (polled -- the map pans there, not jumps).
    const inside = async (): Promise<boolean> => {
        const marker = await page.locator(".leaflet-container .me").boundingBox();
        const map = await page.locator(".leaflet-container").boundingBox();
        if (!marker || !map) return false;
        const x = marker.x + marker.width / 2;
        const y = marker.y + marker.height / 2;
        return x >= map.x && x <= map.x + map.width && y >= map.y && y <= map.y + map.height;
    };
    await expect.poll(inside, { timeout: 5000 }).toBe(true);

    await on.click();
    await expect(page.getByRole("button", { name: "Show my position" })).toHaveAttribute(
        "aria-pressed",
        "false",
    );
    await expect(page.locator(".leaflet-container .me")).toHaveCount(0);
});
