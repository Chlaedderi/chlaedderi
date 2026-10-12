#!/usr/bin/env node
// Chlädderi – render tools/og-card.html into og.png, the picture a shared link shows.
//
//   node tools/make-og.mjs
//
// Open Graph wants one picture at a fixed size, and a chat window shows it before it shows
// anything else about the link. So the card is drawn once, committed, and served as a plain file;
// nothing generates it at request time, because there is no server to generate it on.
//
// Playwright is the only thing in the dev shell that can turn a drawing into pixels -- there is no
// imagemagick, no resvg, no sharp -- and the browser suite already screenshots the app with it.
//
// Run this whenever tools/og-card.html changes, and then look at the result: src/share-card.test.ts
// checks the size and the dimensions, and no test can tell you whether the card reads well.

import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const SOURCE = "tools/og-card.html";
const OUT = "og.png";
const WIDTH = 1200;
const HEIGHT = 630;

// WhatsApp drops the picture and shows the small card instead when the file is slow to fetch, so
// the card has a budget. src/share-card.test.ts holds the same number.
const BUDGET = 300 * 1024;

const browser = await chromium.launch({
    // The card loads its woff2 files out of node_modules, and a file:// page is an origin of its
    // own, so without this the fonts fail the cross-origin check and Chromium quietly sets the
    // card in Arial instead. The check below is what makes that failure loud.
    args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
});
await page.goto(pathToFileURL(SOURCE).href);

// `globalThis.document` rather than `document`: this file is linted as Node, and the function is
// the one thing in it that runs in a browser.
await page.evaluate(() => globalThis.document.fonts.ready);
const fonts = await page.evaluate(() => ({
    name: globalThis.document.fonts.check('700 148px "Barlow Condensed"'),
    line: globalThis.document.fonts.check('500 39px "Barlow"'),
}));
if (!fonts.name || !fonts.line) {
    await browser.close();
    throw new Error(
        `the card's fonts did not load (${JSON.stringify(fonts)}). ` +
            "They come from node_modules/@fontsource -- is the dev shell active?",
    );
}

await page.screenshot({ path: OUT, type: "png" });
await browser.close();

const bytes = statSync(OUT).size;
console.log(`${OUT}: ${WIDTH}x${HEIGHT}, ${bytes} bytes`);
if (bytes > BUDGET) {
    console.warn(`warning: over the ${BUDGET}-byte budget; a chat window may show no picture.`);
}
