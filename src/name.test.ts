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
 * It was not: the window title and the manifest said one thing, the favicon's accessible title
 * still said another, and `app.name` sat in both language files referenced by nothing at all. None
 * of that was visible to any test, because the name lives in files no test read -- an HTML
 * template, a manifest, an SVG -- and because a name that is merely *present* looks fine until you
 * read it.
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
            ogTitle: grab(INDEX, /property="og:title"\s+content="([^"]*)"/),
            ogSite: grab(INDEX, /property="og:site_name"\s+content="([^"]*)"/),
            manifestName: MANIFEST.name,
            manifestShort: MANIFEST.short_name,
            favicon: grab(FAVICON, /<title id="title">([^<]*)<\/title>/),
            de: de["app.name"],
            en: en["app.name"],
        }).toStrictEqual({
            title: APP_NAME,
            apple: APP_NAME,
            ogTitle: APP_NAME,
            ogSite: APP_NAME,
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

describe("nothing in here is named after anything else", () => {
    /*
     * The app is «Chlädderi». Where an umlaut cannot go, the spelling is `APP_SLUG` and no other:
     * not a dash standing in for the ä, not a name it was called before. And one site serves it.
     *
     * This reads the tracked files rather than trusting a sweep, because a leftover name is
     * exactly the kind of thing that survives one. It is written so that it never has to spell out
     * what it forbids -- which is the point, and also why it can read itself along with the rest.
     */
    const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
        .split("\0")
        .filter(Boolean)
        // The minified packs are data; the schema is matched on its own terms above.
        .filter((f) => !f.startsWith("maps/"));

    const text = (f: string): string => readFileSync(f, "utf8");

    it("spells the name in ASCII the one way, everywhere", () => {
        // `Chlädderi` itself does not match: the ä is not an ASCII letter. Anything that fills the
        // gap with something else does -- except the one spelling that is not ours to choose. The
        // site is «chlädderi.ch», and DNS, certificates and URIs all write that as punycode, where
        // the umlaut becomes a suffix rather than two letters in the middle.
        const PUNYCODE = "chldderi";
        const spelling = /chl[a-z-]*dderi/gi;
        const wrong = tracked.flatMap((f) =>
            [...text(f).matchAll(spelling)]
                .map((m) => m[0].toLowerCase())
                .filter((found) => found !== APP_SLUG && found !== PUNYCODE)
                .map((found) => `${f}: ${found}`),
        );
        expect([...new Set(wrong)]).toStrictEqual([]);
    });

    it("names one site and no other", () => {
        const hosts = /([A-Za-z0-9-]+)\.github\.io/g;
        const wrong = tracked.flatMap((f) =>
            [...text(f).matchAll(hosts)]
                .map((m) => m[1] ?? "")
                .filter((host) => host.toLowerCase() !== APP_SLUG)
                .map((host) => `${f}: ${host}.github.io`),
        );
        expect([...new Set(wrong)]).toStrictEqual([]);
    });
});

describe("every link to the site is one a machine can follow", () => {
    /*
     * A person reads «chlädderi.ch»; DNS and certificates read its punycode. So a link shows the
     * umlaut in its label and points at the punycode in its target. The ASCII spelling of the name
     * is a domain too, but it redirects to the bare host and drops the path on the way: the testing
     * region's link to the schema landed on the start page instead, and nothing noticed.
     *
     * This looks only at link targets -- a markdown `](…)`, an autolink `<…>`, an `href` -- because
     * prose and inline code are for people and may spell the address the way people do. The packs
     * are read too: their texts are mini-markdown, and their links are rendered.
     */
    const PUNYCODE_HOST = "xn--chldderi-2za.ch";
    const target = /(?:\]\(|<|href=["'])https?:\/\/([^/)>"'\s]+)/g;

    it("points at the punycode host", () => {
        // Not `git grep -I`: git calls a minified pack binary for the length of its one line.
        const files = execFileSync("git", ["grep", "-lz", "dderi"], { encoding: "utf8" })
            .split("\0")
            .filter(Boolean)
            .map((f) => [f, readFileSync(f, "utf8")] as const)
            .filter(([, text]) => !text.includes("\0"));
        const wrong = files.flatMap(([f, text]) =>
            [...text.matchAll(target)]
                .map((m) => m[1] ?? "")
                .filter((host) => /dderi/i.test(host) && host.toLowerCase() !== PUNYCODE_HOST)
                .map((host) => `${f}: ${host}`),
        );
        expect([...new Set(wrong)]).toStrictEqual([]);
    });
});
