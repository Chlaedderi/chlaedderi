import type { Page } from "@playwright/test";

import { expect, openCallout, test, waitForApp } from "./fixtures";

/**
 * Weather and radar: the two features that were wholly absent from the first React pass.
 *
 * Open-Meteo and RainViewer are answered locally, so the suite is offline and the readings are
 * known -- which lets the dry rule be checked through the app rather than only in a unit test.
 */

const HOUR = 3600;

/** An Open-Meteo answer: hourly rain around `now`, as the app asks for it. */
const forecast = (mmByHour: Record<number, number>, probability = 0) => {
    // Open-Meteo returns whole hours, and the chart matches stamps exactly (the original's
    // `t.indexOf(ts)`). A fixture on a ragged second would line up with nothing at all.
    const now = Math.floor(Date.now() / 1000 / HOUR) * HOUR;
    const time: number[] = [];
    const precipitation: number[] = [];
    const precipitation_probability: number[] = [];
    for (let h = -48; h <= 48; h++) {
        time.push(now + h * HOUR);
        precipitation.push(mmByHour[h] ?? 0);
        precipitation_probability.push(h > 0 && h <= 6 ? probability : 0);
    }
    return { hourly: { time, precipitation, precipitation_probability } };
};

const answerWeather = async (
    page: import("@playwright/test").Page,
    body: Record<number, number>,
    probability = 0,
) => {
    await page.route("**/api.open-meteo.com/**", (route) => {
        // The app asks for a batch of cells and gets a list back.
        const cells = new URL(route.request().url()).searchParams.get("latitude")?.split(",") ?? [];
        route.fulfill({ json: cells.map(() => forecast(body, probability)) });
    });
};

test.describe("the rain forecast", () => {
    test("loads the rain by itself when a crag is opened, and offers no button", async ({
        page,
    }) => {
        await answerWeather(page, {});
        await page.goto("/");
        await waitForApp(page);
        await openCallout(page);
        await page
            .locator(".pop")
            .getByRole("button", { name: /open crag/i })
            .click();

        // Nothing is tapped here: opening the crag is the question.
        await expect(page.getByText(/probably dry/i)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole("button", { name: /load weather/i })).toHaveCount(0);
    });

    test("calls a dry crag dry", async ({ page }) => {
        await answerWeather(page, {});
        await page.goto("/");
        await waitForApp(page);
        await openCallout(page);
        await page
            .locator(".pop")
            .getByRole("button", { name: /open crag/i })
            .click();

        await expect(page.getByText(/probably dry/i)).toBeVisible({ timeout: 10_000 });
    });

    test("calls it wet when enough rain fell inside the drying window", async ({ page }) => {
        // 5 mm ten hours ago: inside every drying window.
        await answerWeather(page, { [-10]: 5 });
        await page.goto("/");
        await waitForApp(page);
        await openCallout(page);
        await page
            .locator(".pop")
            .getByRole("button", { name: /open crag/i })
            .click();

        // Scoped to the crag's rain section: on a wide screen the map legend is on screen at the
        // same time and explains the very same wording.
        const wx = page.locator("#wxsec");
        await expect(wx.getByText(/still wet|rained recently/i)).toBeVisible({ timeout: 10_000 });
        // And it says what fell, not only the verdict.
        await expect(wx.getByText(/5\.0 mm/).first()).toBeVisible();
    });

    test("draws the hour-by-hour chart, not only the totals", async ({ page }) => {
        await answerWeather(page, { [-10]: 5, [3]: 2 });
        await page.goto("/");
        await waitForApp(page);
        await openCallout(page);
        await page
            .locator(".pop")
            .getByRole("button", { name: /open crag/i })
            .click();

        const chart = page.locator("#wxsec .wxchart");
        await expect(chart).toBeVisible({ timeout: 10_000 });
        // 24 hours behind and 24 ahead, as the original drew them.
        await expect(chart.locator("i")).toHaveCount(48);
        await expect(chart.locator("i.f")).toHaveCount(24);
        // The scale and the three axis labels.
        await expect(chart.locator(".max")).toBeVisible();
        await expect(page.locator("#wxsec .wxax span")).toHaveCount(3);

        // And the bars must carry the rain. Counting them is not enough: the first version of
        // this chart drew 48 bars of zero height and the count alone called that a pass.
        const heights = await chart
            .locator("i")
            .evaluateAll((els) =>
                els.map((el) => (el as HTMLElement).getBoundingClientRect().height),
            );
        expect(Math.max(...heights)).toBeGreaterThan(4);
        // 5 mm ten hours back is the tallest; the 2 mm ahead must be drawn shorter.
        expect(heights.filter((h) => h > 1)).toHaveLength(2);
    });

    test("marks wet crags on the map once a forecast is loaded", async ({ page }) => {
        await answerWeather(page, { [-2]: 4 });
        await page.goto("/");
        await waitForApp(page);
        await openCallout(page);
        await page
            .locator(".pop")
            .getByRole("button", { name: /open crag/i })
            .click();
        await expect(page.locator("#wxsec").getByText(/raining now|still wet/i)).toBeVisible({
            timeout: 10_000,
        });

        await page.goBack();
        await waitForApp(page);
        // The badge the original drew on a marker.
        await expect(page.locator(".leaflet-container .mk .wx").first()).toBeVisible();
    });
});

test.describe("the rain radar", () => {
    /**
     * The region that ships is Swiss, so this is the MeteoSwiss radar: a catalogue of frame names,
     * and behind each name a real ODIM file, decoded in the browser and painted onto a canvas.
     * Nothing about that path is mocked except the network.
     */
    const swissRadar = async (page: Page, minutesAgo: readonly number[]): Promise<void> => {
        const assets: Record<string, unknown> = {};
        const now = Date.now();
        for (const minutes of minutesAgo) {
            const at = new Date(now - minutes * 60_000);
            const yy = String(at.getUTCFullYear() % 100).padStart(2, "0");
            const start = Date.UTC(at.getUTCFullYear(), 0, 1);
            const doy = Math.floor((at.getTime() - start) / 86_400_000) + 1;
            const hh = String(at.getUTCHours()).padStart(2, "0");
            // Frames land on five-minute marks, as the service publishes them.
            const mm = String(Math.floor(at.getUTCMinutes() / 5) * 5).padStart(2, "0");
            assets[`rzc${yy}${String(doy).padStart(3, "0")}${hh}${mm}vl.001.h5`] = {};
        }
        await page.route("**/data.geo.admin.ch/api/stac/**", (route) =>
            route.fulfill({ json: { assets } }),
        );
    };

    test("switches on from the map and shows its bar", async ({ page }) => {
        await swissRadar(page, [10, 5, 0]);

        await page.goto("/");
        await waitForApp(page);
        await page.getByRole("button", { name: /base map/i }).click();
        // One switch: the region is Swiss, so the map asks MeteoSwiss without being told to.
        await page.getByRole("checkbox", { name: /rain radar on the map/i }).check();

        const bar = page.locator(".radarbar");
        await expect(bar).toBeVisible();
        // The frame's own time, so you know how old the picture is.
        await expect(bar.getByText(/radar \d{2}:\d{2}/i)).toBeVisible({ timeout: 15_000 });
        await expect(bar.getByRole("button", { name: /pause|play/i })).toBeVisible();

        // And it is actually painted. «A canvas exists» is not the claim -- a blank canvas in the
        // right place is exactly what a misread file, a wrong grid or a north/south flip produce.
        // The fixture is a wet morning, so there must be lit pixels over this region.
        await expect
            .poll(
                () =>
                    page.evaluate(() => {
                        let lit = 0;
                        for (const canvas of document.querySelectorAll(
                            ".leaflet-radar-pane canvas",
                        )) {
                            const box = canvas as HTMLCanvasElement;
                            const pixels = box
                                .getContext("2d")
                                ?.getImageData(0, 0, box.width, box.height).data;
                            if (!pixels) continue;
                            for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 0) lit++;
                        }
                        return lit;
                    }),
                { timeout: 20_000, message: "the radar paints rain where the fixture has rain" },
            )
            .toBeGreaterThan(10_000);
    });

    test("stands RainViewer in when MeteoSwiss has nothing to give", async ({ page }) => {
        const now = Math.floor(Date.now() / 1000);
        await page.route("**/api.rainviewer.com/**", (route) =>
            route.fulfill({
                json: {
                    host: "https://tilecache.rainviewer.com",
                    radar: {
                        past: [
                            { time: now - 600, path: "/v2/radar/a" },
                            { time: now, path: "/v2/radar/b" },
                        ],
                    },
                },
            }),
        );
        await page.route("**/tilecache.rainviewer.com/**", (route) =>
            route.fulfill({ contentType: "image/png", path: "favicon-32.png" }),
        );
        // The default stub publishes no frames at all, which is what a region outside the Swiss
        // radar's fourteen-day window looks like.

        await page.goto("/");
        await waitForApp(page);
        await page.getByRole("button", { name: /base map/i }).click();
        await page.getByRole("checkbox", { name: /rain radar on the map/i }).check();

        await expect(page.getByText(/meteoswiss radar could not be loaded/i)).toBeVisible({
            timeout: 15_000,
        });
        // And what the viewer gets instead is a working radar, with its own frame times.
        await expect(page.locator(".radarbar").getByText(/radar \d{2}:\d{2}/i)).toBeVisible({
            timeout: 15_000,
        });
    });

    /**
     * This used to be called «says so and gives up», and giving up meant dispatching
     * `setRadar("off")` -- into a *persisted* setting. One dropped request at a crag therefore
     * switched the radar off for good, which is what «the radar is always off» turned out to be.
     * Saying so is right; forgetting what the viewer chose is not.
     */
    test("says so but keeps the viewer's choice when no radar can be loaded", async ({ page }) => {
        await page.route("**/api.rainviewer.com/**", (route) => route.abort());
        await page.goto("/");
        await waitForApp(page);
        await page.getByRole("button", { name: /base map/i }).click();
        const radar = page.getByRole("checkbox", { name: /rain radar on the map/i });
        await radar.check();

        await expect(page.getByText(/radar could not be loaded/i).first()).toBeVisible({
            timeout: 15_000,
        });

        // The bar stays, saying it is still trying, and the choice is still the viewer's.
        // The menu is still open -- switching the radar on does not dismiss it.
        await expect(page.locator(".radarbar")).toContainText(/still trying/i);
        await expect(radar).toBeChecked();
    });
});
