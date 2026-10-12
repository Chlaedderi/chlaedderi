import { expect, test, waitForApp } from "./fixtures";

/**
 * Weather for any point of the map.
 *
 * The hand-written app carried the whole implementation (`pointInfo`, `openPointWx`) but never
 * called it, so in the reference commit the feature is unreachable. Wired up here on request.
 */

const HOUR = 3600;

const forecast = () => {
    const midnight = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const time: number[] = [];
    const h: Record<string, number[]> = {
        temperature_2m: [],
        precipitation: [],
        weather_code: [],
        is_day: [],
        wind_speed_10m: [],
        wind_gusts_10m: [],
        wind_direction_10m: [],
        sunshine_duration: [],
        precipitation_probability: [],
        freezing_level_height: [],
    };
    for (let i = 0; i < 7 * 24; i++) {
        time.push(midnight + i * HOUR);
        const hour = i % 24;
        h.temperature_2m!.push(9 + hour / 3);
        h.precipitation!.push(0);
        h.weather_code!.push(0);
        h.is_day!.push(hour >= 7 && hour <= 19 ? 1 : 0);
        h.wind_speed_10m!.push(11);
        h.wind_gusts_10m!.push(24);
        h.wind_direction_10m!.push(180);
        h.sunshine_duration!.push(hour >= 8 && hour <= 18 ? 3600 : 0);
        h.precipitation_probability!.push(5);
        h.freezing_level_height!.push(3000);
    }
    return { hourly: { time, ...h }, elevation: 300 };
};

test("a long press on the map offers the weather there", async ({ page }) => {
    await page.route("**/api.open-meteo.com/v1/forecast**", (route) => {
        const lat = new URL(route.request().url()).searchParams.get("latitude") ?? "";
        return lat.includes(",")
            ? route.fulfill({ json: [] })
            : route.fulfill({ json: forecast() });
    });
    await page.goto("/");
    await waitForApp(page);

    // Leaflet turns both a right-click and a long press into `contextmenu`. Aim with real
    // coordinates clear of the legend, which is open by default on a wide screen and covers a
    // good part of the map -- a fixed position lands on it and the click never reaches Leaflet.
    const map = page.locator(".leaflet-container");
    const box = (await map.boundingBox())!;
    const legend = await page.locator(".legend").boundingBox();
    const clear = legend
        ? Math.max(box.x + box.width / 2, legend.x + legend.width + 40)
        : box.x + box.width / 2;
    await page.mouse.click(Math.min(clear, box.x + box.width - 20), box.y + box.height * 0.3, {
        button: "right",
    });

    const pop = page.locator(".ptpop");
    await expect(pop).toBeVisible();
    // The point's own heading, and its coordinates to five places.
    await expect(pop.getByText(/Selected point|Point at/)).toBeVisible();
    await expect(pop.getByText(/\d+\.\d{5}, \d+\.\d{5}/)).toBeVisible();

    await pop.getByRole("button", { name: /weather here/i }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // Asking for the weather here is the whole request: the sheet fetches it as it opens.
    await expect(sheet.getByText(/^Today$/)).toBeVisible({ timeout: 10_000 });
});
