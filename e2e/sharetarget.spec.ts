import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test, waitForApp } from "./fixtures";

/**
 * The app in the share sheet.
 *
 * Playwright cannot open Android's share sheet, but it does not have to: what Chrome does with a
 * share target is post a multipart form to the action in the manifest, and that is exactly what
 * the form below does. So the thing under test is the real one -- tools/share-target.js, running
 * inside the generated service worker, turning a POST into `#/share?text=…`.
 *
 * It only works against a **build**: `vite dev` registers no worker at all, and with no worker a
 * POST reaches the server, which is the whole point of the design (GitHub Pages answers 405). The
 * e2e hook builds before it runs, so that is what happens here.
 *
 * maps/pack.testing.chlpack and the key beside it are the same public fixtures chlpack.spec.ts
 * uses; 127.0.0.1:4173 stands in for somebody else's host, as it does there.
 */

const HOST = "http://127.0.0.1:4173";
const SEALED = `${HOST}/maps/pack.testing.chlpack`;
const PLAIN = `${HOST}/maps/pack.testing.json`;
const KEY = readFileSync("maps/pack.testing.key", "utf8").trim();

/**
 * Wait until a worker of this origin is activated, then reload so the page is controlled by it.
 *
 * The app registers with `registerType: "prompt"` and neither skips waiting nor claims clients, so
 * the load that installs the worker is not the load that it answers for.
 */
const workerReady = async (page: Page): Promise<void> => {
    await page.waitForFunction(
        async () => (await navigator.serviceWorker.ready).active?.state === "activated",
        null,
        { timeout: 30_000 },
    );
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
        timeout: 30_000,
    });
};

/** What the share sheet does: a multipart POST to the action the manifest names. */
const share = async (page: Page, text: string): Promise<void> => {
    await page
        .evaluate((shared) => {
            const form = document.createElement("form");
            form.method = "POST";
            form.enctype = "multipart/form-data";
            // Relative, exactly as in the manifest: at /pr-12/ this would be /pr-12/share.
            form.action = "share";
            const field = document.createElement("input");
            field.type = "hidden";
            field.name = "text";
            field.value = shared;
            form.append(field);
            document.body.append(form);
            form.submit();
        }, text)
        // The submit navigates, which tears the execution context down under the call.
        .catch(() => undefined);
};

/** The offer, once it is on screen. An open dialog hides the rest of the app from the tree. */
const offer = async (page: Page) => {
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/from 127\.0\.0\.1:4173/i)).toBeVisible({ timeout: 30_000 });
    return dialog;
};

test.describe("a link shared to the installed app", () => {
    test("opens the region offer, and the key never leaves the fragment", async ({ page }) => {
        const asked: string[] = [];
        page.on("request", (request) => asked.push(request.url()));
        // Where the browser went, including the address the worker redirected it to -- which is
        // gone again by the end of the test, because PackLink replaces it with `/`.
        const went: string[] = [];
        page.on("framenavigated", (frame) => {
            if (frame === page.mainFrame()) went.push(frame.url());
        });

        await page.goto("/");
        await waitForApp(page);
        await workerReady(page);

        const link = `${HOST}/#/pack?url=${encodeURIComponent(SEALED)}&k=${encodeURIComponent(KEY)}`;
        await share(page, `Demofels\n${link}`);

        const dialog = await offer(page);
        await dialog.getByRole("button", { name: /check this region/i }).click();
        // The figures are proof the key arrived whole: nothing else opens these bytes.
        await expect(dialog.getByText(/15 crags · 310 routes/i)).toBeVisible({ timeout: 30_000 });

        // Nothing the browser fetched carried the key: the shared text went up in a POST body,
        // and came back in a fragment. This is the whole reason the target is not a GET.
        expect(asked.filter((url) => url.includes(encodeURIComponent(KEY)))).toEqual([]);
        expect(asked.filter((url) => url.includes(KEY))).toEqual([]);
        expect(new URL(page.url()).search).toBe("");

        // The worker really did answer the POST: only its redirect produces this address.
        const handed = went.find((url) => url.includes("#/share?text="));
        expect(handed).toBeDefined();
        const at = new URL(handed ?? "");
        expect(at.search).toBe("");
        expect(decodeURIComponent(at.hash)).toContain(KEY);
    });

    test("offers a bare pack address somebody pasted", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await workerReady(page);

        await share(page, `have a look at this one: ${PLAIN}`);

        const dialog = await offer(page);
        await dialog.getByRole("button", { name: /check this region/i }).click();
        await expect(dialog.getByText(/15 crags · 310 routes/i)).toBeVisible({ timeout: 30_000 });
    });

    test("opens the app and says so when the message held no link", async ({ page }) => {
        await page.goto("/");
        await waitForApp(page);
        await workerReady(page);

        await share(page, "bring the rope, I have the quickdraws");

        await expect(page.getByText(/no link in what was shared/i)).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await waitForApp(page);
    });
});

test.describe("the built worker", () => {
    test("carries the share target", async ({ page }) => {
        const script = await page.request.get("/share-target.js");
        expect(script.status()).toBe(200);
        expect(await script.text()).toContain("registration.scope");

        const worker = await page.request.get("/sw.js");
        expect(await worker.text()).toContain('importScripts("share-target.js")');
    });
});
