import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { APP_NAME, APP_SLUG } from "@core/name";
import { PACK_FORMAT } from "@domain/mappack";

import de from "./i18n/de.json";
import en from "./i18n/en.json";

/**
 * The app has to be called the same thing everywhere.
 *
 * It was not: the window title and the manifest said «Kletteratlas», the favicon's accessible
 * title still said «Finale Atlas» two renames later, and `app.name` sat in both language files
 * referenced by nothing at all. None of that was visible to any test, because the name lives in
 * files no test read -- an HTML template, a manifest, an SVG -- and because a name that is merely
 * *present* looks fine until you read it.
 *
 * So this test reads the actual bytes and compares the actual strings. `src/core/name.ts` is the
 * one place the name is written for code; everything here is held to it.
 */

const read = (path: string): string => readFileSync(path, "utf8");

const INDEX = read("src/index.html");
const MANIFEST = JSON.parse(read("manifest.webmanifest")) as Record<string, unknown>;
const FAVICON = read("favicon.svg");
const SCHEMA = JSON.parse(read("mappack.schema.json")) as {
    title: string;
    properties: { format: { const: string } };
};

/** The first capture of `re` in `text`, or the empty string -- so a miss fails on the value. */
const grab = (text: string, re: RegExp): string => re.exec(text)?.[1]?.trim() ?? "";

describe("the app is called the same thing everywhere", () => {
    it("writes the name the same way in every file that carries it", () => {
        expect({
            title: grab(INDEX, /<title>([^<]*)<\/title>/),
            apple: grab(INDEX, /name="apple-mobile-web-app-title"\s+content="([^"]*)"/),
            manifestName: MANIFEST.name,
            manifestShort: MANIFEST.short_name,
            favicon: grab(FAVICON, /<title id="title">([^<]*)<\/title>/),
            de: de["app.name"],
            en: en["app.name"],
        }).toStrictEqual({
            title: APP_NAME,
            apple: APP_NAME,
            manifestName: APP_NAME,
            manifestShort: APP_NAME,
            favicon: APP_NAME,
            de: APP_NAME,
            en: APP_NAME,
        });
    });

    it("does not translate the name", () => {
        expect(de["app.name"]).toBe(en["app.name"]);
    });

    it("spells the slug as the name without its umlaut", () => {
        // German writes a dropped umlaut out: ä becomes ae. The name has only the one.
        const folded = APP_NAME.toLowerCase().replace(/ä/g, "ae");
        expect(APP_SLUG).toBe(folded);
        // The slug stands in where only ASCII is safe -- a package name, a download filename.
        expect(APP_SLUG).toMatch(/^[a-z0-9-]+$/);
    });
});

describe("the mappack format carries the name", () => {
    it("names the format after the slug", () => {
        expect(PACK_FORMAT).toBe(`${APP_SLUG}-mappack`);
    });

    it("keeps the published schema and the app's constant on the same string", () => {
        expect(SCHEMA.properties.format.const).toBe(PACK_FORMAT);
        expect(SCHEMA.title).toBe(`${APP_NAME} mappack`);
    });
});

describe("no superseded address survives", () => {
    /*
     * The repository was `Enteee/Chl-dderi` and the app was served from `enteee.github.io`. Both
     * are gone: the project belongs to the Chlaedderi organisation and the app is its own site.
     *
     * `Chl-dderi` was the repository name with the umlaut knocked out by a dash; everywhere ASCII
     * is needed the spelling is `chlaedderi`, which is what APP_SLUG has always said. This reads
     * the tracked files rather than trusting a sweep, because a leftover address is exactly the
     * kind of thing that survives one.
     */
    const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
        .split("\0")
        .filter(Boolean)
        // The minified packs are data, and the schema is matched on its own terms below.
        .filter((f) => !f.startsWith("maps/"))
        // stub/ is the page left behind at the old address. Naming it is its whole job: it is
        // served from `enteee.github.io/Chl-dderi/` and has to say so. See stub/README.md.
        .filter((f) => !f.startsWith("stub/"));

    // This file has to spell out what it forbids, so it is never one of the files it reads.
    const HERE = "src/name.test.ts";

    const saying = (re: RegExp, except: readonly string[] = []): string[] =>
        tracked.filter(
            (f) => f !== HERE && !except.includes(f) && re.test(readFileSync(f, "utf8")),
        );

    it("names neither the old owner nor the old site", () => {
        expect(saying(/enteee\.github\.io|Enteee\/Chl-dderi/i)).toStrictEqual([]);
    });

    it("spells the name without the dash that stood in for the umlaut", () => {
        // One other exception, and it earns it: preview.test.ts keeps a path from the old site to
        // show that previewSuffix never cared what came before the `/pr-N/`.
        expect(saying(/Chl-dderi/, ["src/core/preview.test.ts"])).toStrictEqual([]);
    });
});

describe("no superseded name survives", () => {
    const GONE = /Kletteratlas|Finale Atlas|kletteratlas/;

    it("is gone from the files a viewer's device reads", () => {
        expect(INDEX).not.toMatch(GONE);
        expect(FAVICON).not.toMatch(GONE);
        expect(JSON.stringify(MANIFEST)).not.toMatch(GONE);
        expect(JSON.stringify(SCHEMA)).not.toMatch(GONE);
    });

    it("is gone from the interface texts, bar the one line that says so on purpose", () => {
        // «Die App hiess früher Kletteratlas» belongs in the About sheet: someone who installed
        // the app under the old name has to be able to tell it is the same app.
        const left = (texts: Record<string, string>): string[] =>
            Object.entries(texts)
                .filter(([key, value]) => key !== "m.about.t" && GONE.test(value))
                .map(([key]) => key);

        expect(left(de)).toStrictEqual([]);
        expect(left(en)).toStrictEqual([]);
        expect(de["m.about.t"]).toContain("Kletteratlas");
        expect(en["m.about.t"]).toContain("Kletteratlas");
    });
});
