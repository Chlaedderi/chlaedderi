import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LOG_STYLES } from "@core/logbook";
import { PACK_PROBLEM_CODES } from "@core/packs/validate";
import { ALL_OPTIONS, optionLabel } from "@features/list/filterLabels";

import de from "./de.json";
import en from "./en.json";

import { createI18n } from "./index";

/**
 * Every key the interface asks for has to exist, or the viewer sees `f.title` instead of
 * «Filters». Nothing in the type system catches that, so this test does: it reads the keys out of
 * the source and checks them against both languages.
 */

const SRC = "src";

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(file);
        return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [file] : [];
    });

/**
 * Every string literal that appears inside a `t(...)` call -- including the arms of a ternary, as
 * in `t(isFav ? "fav.t.rm" : "fav.t.add")`, which a pattern anchored to the opening paren misses.
 * Keys built by joining a value are checked separately below.
 */
const literalKeys = (): Map<string, string[]> => {
    const found = new Map<string, string[]>();
    // `t(` and then everything up to the matching paren, allowing one level of nesting.
    const calls = /\bt\(((?:[^()"]|"[^"]*")*(?:\(((?:[^()"]|"[^"]*")*)\)(?:[^()"]|"[^"]*")*)*)\)/g;
    // A key looks like `one.two` or a bare lower-case word, never a sentence or a URL.
    const keyish = /^[a-z][\w+-]*(?:\.[\w+-]+)*$/;

    for (const file of sourceFiles(SRC)) {
        const text = readFileSync(file, "utf8");
        for (const call of text.matchAll(calls)) {
            // Only the first argument can be the key -- what follows is the options object.
            // Inside it, a literal that is being compared against (`x === "calc" ? … : …`) is not
            // a key either, so those operands go first. Both arms of a ternary do survive.
            const firstArg = (call[1] ?? "").split(/,(?![^{]*\})/)[0] ?? "";
            const keyOnly = firstArg.replace(/[!=]==?\s*"[^"]*"/g, "");
            for (const literal of keyOnly.matchAll(/"([^"\n]+)"/g)) {
                const key = literal[1]!;
                if (!keyish.test(key)) continue;
                found.set(key, [...(found.get(key) ?? []), file]);
            }
        }
    }
    return found;
};

describe("every key the interface asks for exists", () => {
    it("in English", () => {
        const missing = [...literalKeys()]
            .filter(([key]) => !(key in en))
            .map(([key, files]) => `${key} (${files.join(", ")})`);
        expect(missing).toEqual([]);
    });

    it("in German", () => {
        const missing = [...literalKeys()].filter(([key]) => !(key in de)).map(([key]) => key);
        expect(missing).toEqual([]);
    });
});

describe("the keys built from a value also exist", () => {
    const i18n = createI18n("en");

    it("for every filter option", () => {
        for (const [key, option] of ALL_OPTIONS) {
            const label = optionLabel(i18n.t, key, option);
            expect(label, `${key}/${option}`).not.toBe("");
            // A key that is missing comes back as the key itself.
            expect(label, `${key}/${option}`).not.toMatch(/^[a-z]+(\.[a-zA-Z+]+)+$/);
        }
    });

    it("for every logbook style", () => {
        for (const style of LOG_STYLES) {
            expect(`st.${style}` in en, `st.${style}`).toBe(true);
        }
    });

    it("for the bolting words a crag can carry", () => {
        for (const spacing of ["close", "good", "part", "spaced"]) {
            expect(`tag.bolt.${spacing}` in en).toBe(true);
        }
        for (const condition of ["new", "old", "part"]) {
            expect(`bolt.c.${condition}` in en).toBe(true);
        }
    });

    it("for every sort order", () => {
        for (const sort of [
            "area",
            "name",
            "match",
            "gmin",
            "gmax",
            "n",
            "walk",
            "len",
            "orient",
            "rate",
            "me",
            "nr",
        ]) {
            expect(`sort.${sort}` in en, `sort.${sort}`).toBe(true);
        }
    });

    it("for every reason a pack could not be read", () => {
        // These are the problems the app raises itself, and the only ones a viewer can act on --
        // so unlike Ajv's findings they are said in the viewer's own language, in both.
        for (const code of PACK_PROBLEM_CODES) {
            expect(`pk.err.${code}` in en, `pk.err.${code} (en)`).toBe(true);
            expect(`pk.err.${code}` in de, `pk.err.${code} (de)`).toBe(true);
        }
    });

    it("for the grade scales of the converter", () => {
        for (const scale of ["fr", "uiaa", "yds", "uk", "aus", "sax", "fin"]) {
            expect(`cv.${scale}` in en, `cv.${scale}`).toBe(true);
        }
    });
});

describe("plural keys are never rendered raw", () => {
    /**
     * The texts keep both forms in one key, `"route|routes"`. i18next does not know that format,
     * so interpolating such a key directly prints the bar -- which is exactly what reached the
     * screen in the first React pass ("61 route|routes"). Every count has to go through
     * `countOf`, so no source file may pass a plural key to `t()` on its own.
     */
    const PLURAL_KEYS = Object.entries(en)
        .filter(([, v]) => String(v).includes("|"))
        .map(([k]) => k);

    it("has plural keys at all, so this test is testing something", () => {
        expect(PLURAL_KEYS.length).toBeGreaterThan(0);
        expect(PLURAL_KEYS).toContain("n.route");
    });

    it("is matched by the German texts", () => {
        for (const key of PLURAL_KEYS) {
            expect(String(de[key as keyof typeof de]), key).toContain("|");
        }
    });

    it("never calls t() with one directly", () => {
        const offenders: string[] = [];
        for (const file of sourceFiles(SRC)) {
            const text = readFileSync(file, "utf8");
            for (const key of PLURAL_KEYS) {
                if (text.includes(`t("${key}"`)) offenders.push(`${key} in ${file}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe("a toast shows text, never a key", () => {
    /**
     * `uiActions.toast({ message: … })` puts its message straight on the screen. Passing a
     * translation key there shows the key -- which I did for the radar failures before catching
     * it. Every message has to be translated at the call site.
     */
    it("never dispatches a toast with a bare key", () => {
        const offenders: string[] = [];
        for (const file of sourceFiles(SRC)) {
            const text = readFileSync(file, "utf8");
            for (const call of text.matchAll(/toast\(\s*\{[^}]*message:\s*("([^"]+)"|`[^`]*`)/g)) {
                const literal = call[2];
                // A key looks like `one.two`; real text has spaces or punctuation.
                if (literal && /^[a-z][a-z0-9]*(\.[a-z0-9.+-]+)+$/.test(literal)) {
                    offenders.push(`${literal} in ${file}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
