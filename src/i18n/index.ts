/**
 * Interface texts. 732 keys, each in English and German (Swiss spelling: ss, never ß).
 *
 * i18next is configured to the format the texts already use, rather than the texts being rewritten
 * to i18next's defaults:
 *
 * - placeholders are `{0}`, `{1}`… so the interpolation markers are `{` and `}`, not `{{` and `}}`;
 * - keys contain dots (`pk.format`, `j.label`), so key and namespace separators are off;
 * - a plural is one key holding `singular|plural`, which `pickPlural()` below picks from. i18next's
 *   own plural suffixes are not used -- the two languages involved both need only the two forms.
 *
 * The resources are bundled rather than fetched, so i18next initialises synchronously and the first
 * render already has its texts.
 */

import i18next, { type i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";

import { detectLang, type Lang } from "@core/lang";

import de from "./de.json";
import en from "./en.json";

/** Keys the app asked for and no language had. `src/i18n/keys.test.ts` fails on any that turn up. */
export const MISSING = new Set<string>();

export const resources = {
    en: { translation: en },
    de: { translation: de },
} as const;

export const createI18n = (lang: Lang = detectLang()): I18n => {
    const instance = i18next.createInstance();
    void instance.use(initReactI18next).init({
        lng: lang,
        fallbackLng: "en",
        resources,
        // The texts are keys with dots in them, not nested objects.
        keySeparator: false,
        nsSeparator: false,
        interpolation: {
            // The app's own placeholder style, and React escapes for us.
            prefix: "{",
            suffix: "}",
            escapeValue: false,
        },
        // A text that is deliberately empty stays empty. With `false` i18next falls back to the
        // key, which puts «m.know.h» on the screen where a blank subtitle was meant.
        returnEmptyString: true,
        saveMissing: true,
        missingKeyHandler: (_lng, _ns, key) => {
            MISSING.add(key);
        },
    });
    return instance;
};

/**
 * One key holding `singular|plural`. Mirrors the old `plural()`: anything other than exactly one
 * takes the second form, and a key without a `|` is returned as it is.
 */
export const pickPlural = (text: string, n: number): string => {
    const parts = text.split("|");
    if (parts.length < 2) return text;
    return n === 1 ? (parts[0] ?? text) : (parts[1] ?? text);
};

/**
 * A count with its noun: `61 routes`, `1 route`.
 *
 * The texts hold both forms in one key, separated by a bar -- `"route|routes"` -- which is the
 * format the hand-written app used and which i18next knows nothing about. Interpolating such a key
 * straight into the page prints the bar, so every count goes through here.
 */
export const countOf = (t: (key: string) => string, key: string, n: number, lang: Lang): string =>
    `${formatInt(n, lang)} ${pickPlural(t(key), n)}`;

/** Numbers as the two locales write them: 8'100 in German (Swiss), 8,100 in English. */
export const formatInt = (n: number | null | undefined, lang: Lang): string =>
    n == null ? "" : Number(n).toLocaleString(lang === "de" ? "de-CH" : "en-GB");

const MONTHS_EN = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/** `2026-10-07` as `7.10.2026` or `7 Oct 2026`, as the old `fmtDate()` did. */
export const formatDate = (iso: string | null | undefined, lang: Lang): string => {
    const parts = String(iso ?? "").split("-");
    if (parts.length < 3) return String(iso ?? "");
    const [y, m, d] = parts;
    if (lang === "de") return `${Number(d)}.${Number(m)}.${y}`;
    return `${Number(d)} ${MONTHS_EN[Number(m) - 1] ?? m} ${y}`;
};
