import { describe, expect, it } from "vitest";

import { WX_KEY } from "@services/openMeteo";

import { ownShell } from "../version";

import { FILTER_KEY, FILTER_KEY_V1 } from "./filters";
import { PACK_CACHE } from "./packs/storage";
import { PREFS_ITEM } from "./prefs";
import { PREVIEW_SUFFIX, previewSuffix } from "./preview";
import { DEFAULT_NAMESPACE } from "./store";

/**
 * The storage names are load-bearing: people have favourites and logbooks on their devices under
 * them, and renaming one hides their data. The preview suffix is allowed to exist only because it
 * is empty everywhere but under /pr-N/ -- which is what this file checks, name by name, the way
 * name.test.ts checks the app's name.
 */
describe("the storage names", () => {
    it("are the ones people's data is already under", () => {
        expect(PREVIEW_SUFFIX).toBe("");
        expect(DEFAULT_NAMESPACE).toBe("finale-atlas");
        expect(`${DEFAULT_NAMESPACE}-user`).toBe("finale-atlas-user");
        expect(PACK_CACHE).toBe("finale-atlas-packs");
        expect(PREFS_ITEM).toBe("finale-atlas:prefs");
        expect(FILTER_KEY).toBe("finale-atlas-filters-v2");
        expect(FILTER_KEY_V1).toBe("finale-atlas-filters-v1");
        expect(WX_KEY).toBe("finale-atlas:wx");
    });
});

describe("previewSuffix", () => {
    it("names the pull request a preview belongs to", () => {
        expect(previewSuffix("/pr-12/")).toBe("-pr12");
        expect(previewSuffix("/pr-12/index.html")).toBe("-pr12");
        expect(previewSuffix("/pr-7/")).toBe("-pr7");
        // Unanchored on purpose: the app was served from a folder until it moved to its own site,
        // and a link from back then must still be read the same way.
        expect(previewSuffix("/Chl-dderi/pr-12/")).toBe("-pr12");
    });

    it("is empty for the app itself", () => {
        expect(previewSuffix("/")).toBe("");
        expect(previewSuffix("/Chl-dderi/")).toBe("");
        expect(previewSuffix("/index.html")).toBe("");
        // Not a preview folder: a number is what the workflow puts there.
        expect(previewSuffix("/pr-twelve/")).toBe("");
        expect(previewSuffix("/pr-12")).toBe("");
    });
});

describe("ownShell", () => {
    const app = "https://chlaedderi.github.io/";
    const preview = "https://chlaedderi.github.io/pr-12/";

    it("is this deployment's own app shell", () => {
        expect(ownShell(`workbox-precache-v2-${app}`, app)).toBe(true);
        expect(ownShell(`workbox-precache-v2-${preview}`, preview)).toBe(true);
    });

    it("leaves the shell of the other deployment alone", () => {
        // The reason this exists: a preview must not take the installed app offline.
        expect(ownShell(`workbox-precache-v2-${app}`, preview)).toBe(false);
        expect(ownShell(`workbox-precache-v2-${preview}`, app)).toBe(false);
    });

    it("never drops what the app itself keeps", () => {
        for (const name of [
            "finale-atlas-user",
            "finale-atlas-packs",
            "finale-atlas-tiles-v1",
            "finale-atlas-pr12-user",
            "finale-atlas-packs-pr12",
        ]) {
            expect(ownShell(name, app)).toBe(false);
            expect(ownShell(name, preview)).toBe(false);
        }
    });
});
