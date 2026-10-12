import { defineConfig, devices } from "@playwright/test";

/**
 * The browser tests run against the **built** app, served the way the deploy serves it, so what is
 * tested is what ships. The browsers come from the nix store (see devenv.nix); nothing is
 * downloaded.
 *
 * Every external host is stubbed in the fixtures, so the suite is offline and deterministic: tiles,
 * weather, radar and swisstopo never reach the network.
 */
export default defineConfig({
    testDir: "./e2e",
    outputDir: ".playwright",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
        { name: "phone", use: { ...devices["Pixel 7"] } },
    ],
    webServer: {
        // tools/serve.pl serves dist/ in front of the repository folder: the built app, with the
        // icons, the manifest and maps/ beside it, which is the file set tools/make-site.sh
        // publishes. The build is not committed, so `build` has to have run -- the e2e script and
        // the e2e hook both see to that.
        command: "./tools/serve.pl 4173",
        url: "http://127.0.0.1:4173/",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
