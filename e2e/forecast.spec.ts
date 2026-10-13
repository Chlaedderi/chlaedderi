import { expect, openCallout, test, waitForApp } from "./fixtures";

/**
 * The seven-day forecast on a crag page.
 *
 * It was missing outright: the port had the rain verdict and the hourly chart, but nothing that
 * said what the week would do, and 17 of the original's `fc.*` texts had no reader.
 */

const HOUR = 3600;

/** Seven days of whole hours from the previous local midnight, as Open-Meteo returns them. */
const forecast = () => {
    const midnight = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const time: number[] = [];
    const h = {
        temperature_2m: [] as number[],
        precipitation: [] as number[],
        weather_code: [] as number[],
        is_day: [] as number[],
        wind_speed_10m: [] as number[],
        wind_gusts_10m: [] as number[],
        wind_direction_10m: [] as number[],
        sunshine_duration: [] as number[],
        precipitation_probability: [] as number[],
        freezing_level_height: [] as number[],
    };
    for (let i = 0; i < 7 * 24; i++) {
        time.push(midnight + i * HOUR);
        const hour = i % 24;
        const day = Math.floor(i / 24);
        h.temperature_2m.push(10 + hour / 3 + day);
        // One wet day in the middle, so a day row has rain and a probability to show.
        h.precipitation.push(day === 3 && hour >= 10 && hour <= 14 ? 2 : 0);
        h.weather_code.push(day === 3 ? 61 : 0);
        h.is_day.push(hour >= 7 && hour <= 19 ? 1 : 0);
        h.wind_speed_10m.push(12);
        h.wind_gusts_10m.push(30);
        h.wind_direction_10m.push(225);
        h.sunshine_duration.push(hour >= 8 && hour <= 18 ? 3600 : 0);
        h.precipitation_probability.push(day === 3 ? 70 : 5);
        h.freezing_level_height.push(3100);
    }
    return { hourly: { time, ...h }, elevation: 420 };
};

const openCrag = async (page: import("@playwright/test").Page): Promise<void> => {
    await page.route("**/api.open-meteo.com/v1/forecast**", (route) => {
        // The rain card asks for a batch of cells and gets a list back; the forecast asks for a
        // single place. Only the `latitude` parameter tells them apart -- the URL always has
        // commas in its `hourly` list.
        const latitude = new URL(route.request().url()).searchParams.get("latitude") ?? "";
        return latitude.includes(",")
            ? route.fulfill({ json: [] })
            : route.fulfill({ json: forecast() });
    });
    await page.goto("/");
    await waitForApp(page);
    await openCallout(page);
    await page
        .locator(".pop")
        .getByRole("button", { name: /open crag/i })
        .click();
};

test.describe("the seven-day forecast", () => {
    test("loads itself when the crag is opened, and offers no button", async ({ page }) => {
        await openCrag(page);
        const section = page.locator("#fcsec");
        await expect(section).toBeVisible();
        // Nothing is tapped: opening the crag is the question.
        await expect(section.getByText(/^Today$/)).toBeVisible({ timeout: 10_000 });
        await expect(section.getByRole("button", { name: /load forecast/i })).toHaveCount(0);
    });

    test("loads a row per day, with temperatures and the rain", async ({ page }) => {
        await openCrag(page);
        const section = page.locator("#fcsec");

        // «Today» and «Tomorrow» are named rather than dated, as the original named them.
        await expect(section.getByText(/^Today$/)).toBeVisible({ timeout: 10_000 });
        await expect(section.getByText(/^Tomorrow$/)).toBeVisible();

        // A day row carries a real temperature, not a dash.
        await expect(section.getByText(/\d+°/).first()).toBeVisible();
        // The wet day shows its rain and its probability. 5 hours of 2 mm is 10 mm, which
        // `formatMm` gives as a whole number -- it only keeps a decimal below 10.
        await expect(section.getByText(/\b10 mm\b/)).toBeVisible();
        // The fixture's wet window is in UTC and the days are grouped in the crag's own zone, so
        // the probability can fall either side of a local midnight. One row showing it is enough.
        await expect(section.getByText(/70 %/).first()).toBeVisible();
    });

    /**
     * The symbols were the second thing this section lost. The React pass put the words
     * «partly cloudy» in the column instead, which is unreadable at a glance and was ellipsed to
     * «c…» on a phone; `src/core/wxSymbol.ts` draws them again.
     */
    test("draws a weather symbol per day, and names it", async ({ page }) => {
        await openCrag(page);
        const section = page.locator("#fcsec");
        await expect(section.getByText(/^Today$/)).toBeVisible({ timeout: 10_000 });

        // The fixture is a clear week with one wet day in it, and the symbols say so.
        const clear = section.getByRole("img", { name: "clear" });
        await expect(clear.first()).toBeVisible();
        await expect(section.getByRole("img", { name: "light rain" })).toHaveCount(1);

        // Drawn, not an empty frame: a sun is a disc and eight rays.
        expect(await clear.first().locator("path, circle").count()).toBeGreaterThan(1);
    });

    test("gives every three-hourly row its own symbol", async ({ page }) => {
        await openCrag(page);
        const section = page.locator("#fcsec");
        await expect(section.getByText(/^Today$/)).toBeVisible({ timeout: 10_000 });
        await section.getByRole("button", { expanded: false }).first().click();

        // Seven rows, 03:00 to 21:00, each with a symbol -- and the day's own above them.
        await expect(section.getByText("03:00")).toBeVisible();
        expect(await section.getByRole("img").count()).toBeGreaterThanOrEqual(7 + 7);
    });

    test("opens a day to the three-hourly detail", async ({ page }) => {
        await openCrag(page);
        const section = page.locator("#fcsec");
        await expect(section.getByText(/^Today$/)).toBeVisible({ timeout: 10_000 });

        const today = section.getByRole("button", { expanded: false }).first();
        await today.click();

        // The column headings the original used, and rows every three hours from 03:00.
        await expect(section.getByText(/^Time$/)).toBeVisible();
        await expect(section.getByText(/^Rain 3 h$/)).toBeVisible();
        await expect(section.getByText("03:00")).toBeVisible();
        await expect(section.getByText("21:00")).toBeVisible();
        // 00:00 is not a row: the original started at 03:00.
        await expect(section.getByText("00:00")).toHaveCount(0);
    });

    test("names its source and when it was fetched", async ({ page }) => {
        await openCrag(page);
        const section = page.locator("#fcsec");
        await expect(section.getByText(/^Today$/)).toBeVisible({ timeout: 10_000 });

        await expect(section.getByText(/as of \d\d:\d\d/i)).toBeVisible();
        // The demo region is in Switzerland, so the forecast comes from the MeteoSwiss model and
        // names MeteoSwiss. Outside Switzerland the same line names Open-Meteo.
        await expect(section.getByRole("link", { name: /MeteoSwiss|MeteoSchweiz/ })).toBeVisible();
    });

    /**
     * The forecast asks for `timeformat=unixtime`. When something answers with ISO strings
     * instead -- a changed contract, a proxy, a captive portal with opinions -- those used to
     * reach `Intl.DateTimeFormat.formatToParts(new Date(NaN))`, which throws out of a *render*
     * and takes the entire page down to a white screen. That only mattered while the forecast
     * waited for a button; now that opening a crag fetches it, a white crag page would be the
     * first thing a viewer saw. The service refuses the response instead.
     */
    test("survives a forecast whose times are not what was asked for", async ({ page }) => {
        await page.route("**/api.open-meteo.com/v1/forecast**", (route) => {
            const latitude = new URL(route.request().url()).searchParams.get("latitude") ?? "";
            if (latitude.includes(",")) return route.fulfill({ json: [] });
            const good = forecast();
            return route.fulfill({
                json: {
                    ...good,
                    hourly: {
                        ...good.hourly,
                        time: good.hourly.time.map((t) => new Date(t * 1000).toISOString()),
                    },
                },
            });
        });
        await page.goto("/");
        await waitForApp(page);
        await openCallout(page);
        await page
            .locator(".pop")
            .getByRole("button", { name: /open crag/i })
            .click();

        // The page is still a crag page, and the card says it has nothing rather than vanishing.
        await expect(page.locator("h2")).toBeVisible();
        await page.waitForTimeout(2000);
        await expect(page.locator("h2")).toBeVisible();
        await expect(page.locator("#fcsec")).toContainText(/no forecast|could not/i);
    });
});
