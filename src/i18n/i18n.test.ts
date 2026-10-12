import { describe, expect, it } from "vitest";

import { shortText, longText, orientLabel } from "@core/dataText";

import de from "./de.json";
import en from "./en.json";

import { MISSING, createI18n, formatDate, formatInt, pickPlural } from "./index";

describe("the interface texts", () => {
    it("has the same keys in both languages", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
        expect(Object.keys(en).length).toBeGreaterThan(700);
    });

    // "m.know.h" is a subtitle the old app deliberately left blank in both languages.
    const KNOWN_EMPTY = new Set(["m.know.h"]);

    it("has no empty text in either language, bar the one that is blank on purpose", () => {
        for (const [key, value] of Object.entries(en)) {
            if (KNOWN_EMPTY.has(key)) continue;
            expect(String(value).length, "en/").toBeGreaterThan(0);
        }
        for (const [key, value] of Object.entries(de)) {
            if (KNOWN_EMPTY.has(key)) continue;
            expect(String(value).length, "de/").toBeGreaterThan(0);
        }
    });

    it("keeps the German to Swiss spelling: ss, never ß", () => {
        const withEszett = Object.entries(de).filter(([, v]) => String(v).includes("ß"));
        expect(withEszett).toEqual([]);
    });

    it("uses the same placeholders in both languages", () => {
        const holes = (s: string): string[] => (s.match(/\{\d\}/g) ?? []).sort();
        for (const key of Object.keys(en)) {
            const a = holes(String(en[key as keyof typeof en]));
            const b = holes(String(de[key as keyof typeof de]));
            expect(b, `placeholders differ for ${key}`).toEqual(a);
        }
    });

    it("keeps a plural a pair in both languages", () => {
        for (const key of Object.keys(en)) {
            const a = String(en[key as keyof typeof en]).split("|").length;
            const b = String(de[key as keyof typeof de]).split("|").length;
            expect(b, `plural forms differ for ${key}`).toBe(a);
        }
    });
});

describe("the i18next instance", () => {
    it("reads a key with dots in it as one key", () => {
        const i18n = createI18n("de");
        expect(i18n.t("pk.format")).toBe(de["pk.format"]);
        expect(i18n.t("pk.format")).not.toBe("pk.format");
    });

    it("fills {0}-style placeholders", () => {
        const i18n = createI18n("en");
        const key = Object.keys(en).find((k) => /\{0\}/.test(String(en[k as keyof typeof en])))!;
        const filled = i18n.t(key, { 0: "XYZZY" });
        expect(filled).toContain("XYZZY");
        expect(filled).not.toContain("{0}");
    });

    it("switches language", async () => {
        const i18n = createI18n("en");
        expect(i18n.t("pk.format")).toBe(en["pk.format"]);
        await i18n.changeLanguage("de");
        expect(i18n.t("pk.format")).toBe(de["pk.format"]);
    });

    it("records a key no language has", () => {
        const i18n = createI18n("en");
        i18n.t("no.such.key.at.all");
        expect(MISSING.has("no.such.key.at.all")).toBe(true);
    });
});

describe("plural, numbers and dates", () => {
    it("picks the form the count needs", () => {
        expect(pickPlural("route|routes", 1)).toBe("route");
        expect(pickPlural("route|routes", 0)).toBe("routes");
        expect(pickPlural("route|routes", 7)).toBe("routes");
        expect(pickPlural("no bar here", 2)).toBe("no bar here");
    });

    it("formats numbers the way each locale writes them", () => {
        // de-CH groups with an apostrophe; which of the two ICU picks depends on its version.
        expect(formatInt(8100, "de")).toMatch(/^8['\u2019]100$/);
        expect(formatInt(8100, "en")).toBe("8,100");
        expect(formatInt(null, "de")).toBe("");
    });

    it("formats dates the way the old app did", () => {
        expect(formatDate("2026-10-07", "de")).toBe("7.10.2026");
        expect(formatDate("2026-10-07", "en")).toBe("7 Oct 2026");
        expect(formatDate(null, "en")).toBe("");
    });
});

describe("text that comes with the data", () => {
    it("leaves English alone", () => {
        expect(shortText("Web page", "en")).toBe("Web page");
    });

    it("translates what the app's table knows", () => {
        expect(shortText("Web page", "de")).toBe("Webseite");
    });

    it("lets a pack's own de map win over the app's table", () => {
        expect(shortText("Web page", "de", { "Web page": "Netzseite" })).toBe("Netzseite");
    });

    it("rewrites the orientation sentence the data builds", () => {
        expect(shortText("theCrag gives NE, SAC gives SE", "de")).toBe(
            "theCrag nennt NO, SAC nennt SO",
        );
    });

    it("prefers a field's German twin and falls back to the English one", () => {
        const crag = { warn: "Rockfall", warnDe: "Steinschlag" };
        expect(longText(crag, "warn", "de")).toBe("Steinschlag");
        expect(longText(crag, "warn", "en")).toBe("Rockfall");
        expect(longText({ warn: "Rockfall" }, "warn", "de")).toBe("Rockfall");
        expect(longText(null, "warn", "de")).toBeNull();
    });

    it("abbreviates the compass the way German does", () => {
        expect(orientLabel("NE", "de")).toBe("NO");
        expect(orientLabel("NE", "en")).toBe("NE");
        expect(orientLabel("S", "de")).toBe("S");
    });
});
