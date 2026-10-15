/**
 * Text that comes out of a mappack, and the small string helpers the whole app uses.
 *
 * The rule the old code stated and this module keeps: **nothing from a pack is ever used as HTML.**
 * The old `mdText()` escaped the string and then spliced `<a>` and `<b>` into it. Here the parser
 * returns tokens instead and the renderer (src/features/packs/PackText.tsx) turns them into React
 * elements, so the markup can never come from the data. That also fixes a wrinkle of the old
 * version: it escaped the string *before* reading the URL out of it, so a link whose target held an
 * `&` ended up with `&amp;` inside its href.
 */

import type { I18nText } from "@domain/mappack";

import type { Lang } from "./lang";

/** Pick the language, falling back to the other one rather than showing nothing. */
export const i18 = (o: I18nText | null | undefined, lang: Lang): string =>
    !o ? "" : lang === "de" ? o.de || o.en || "" : o.en || o.de || "";

/** Lower-case, accent-free, for searching and for building keys. */
export const fold = (s: string | null | undefined): string =>
    String(s ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

export const slug = (s: string | null | undefined): string =>
    fold(s)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

/**
 * Characters that reorder what is around them, and are invisible while doing it.
 *
 * The bidirectional overrides and isolates, plus the left/right marks. In running pack text they
 * are harmless; in a line that a viewer is reading to decide whether to trust a stranger's region
 * they are not, because they can make a name appear to end somewhere it does not.
 */
const BIDI = /[‎‏‪-‮⁦-⁩]/g;

/**
 * A pack's own words, reduced to one plain line of at most `max` characters.
 *
 * For the places where text out of a mappack sits beside the app's own: the install confirmation
 * names the region and shows its `notes`, and both come from whoever wrote the pack. The schema
 * puts no length on either (`$defs/i18nText`), so without this a name full of newlines reshapes
 * the dialog around its buttons, and a long one pushes the host that matters off the screen.
 *
 * This is not an escape -- nothing from a pack ever becomes HTML; React escapes these as text,
 * the way it does everywhere else. It is a bound on shape, not on meaning.
 */
export const oneLine = (s: string | null | undefined, max: number): string => {
    const flat = (s ?? "").replace(BIDI, "").replace(/\s+/gu, " ").trim();
    return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

/** One run of inline text from a pack. */
export type InlineToken =
    | { readonly kind: "text"; readonly text: string }
    | { readonly kind: "bold"; readonly text: string }
    | { readonly kind: "link"; readonly label: string; readonly url: string };

// The same shapes the old mdText() recognised, with the same length caps: a label up to 160
// characters, a target up to 400, and bold runs up to 300. Only http(s) targets become links --
// javascript:, data: and anything else stay literal text.
const LINK = /\[([^\]]{1,160})\]\((https?:\/\/[^\s)]{1,400})\)/g;

/**
 * A link target out of a pack, kept only if it is http(s) -- the same rule as for links in pack
 * text. React refuses `javascript:` by itself, but `intent:`, `tel:` or an app's own scheme would
 * otherwise go through from whatever pack anybody publishes. Anything else gives no target.
 */
export const httpHref = (url: string | null | undefined): string | undefined =>
    url && /^https?:\/\//i.test(url.trim()) ? url : undefined;
const BOLD = /\*\*([^*]{1,300})\*\*/g;

/**
 * Parse the mini-markdown a pack may use: `**bold**` and `[label](https://…)`, and nothing else.
 * Everything the patterns do not match stays literal text.
 */
export const parseInline = (input: string | null | undefined): InlineToken[] => {
    const s = String(input ?? "");
    if (!s) return [];

    const out: InlineToken[] = [];
    const pushPlain = (text: string): void => {
        if (!text) return;
        // Bold inside the plain runs between the links, matching the old order: links first.
        let at = 0;
        for (const m of text.matchAll(BOLD)) {
            const start = m.index;
            if (start > at) out.push({ kind: "text", text: text.slice(at, start) });
            out.push({ kind: "bold", text: m[1] ?? "" });
            at = start + m[0].length;
        }
        if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
    };

    let at = 0;
    for (const m of s.matchAll(LINK)) {
        const start = m.index;
        if (start > at) pushPlain(s.slice(at, start));
        out.push({ kind: "link", label: m[1] ?? "", url: m[2] ?? "" });
        at = start + m[0].length;
    }
    pushPlain(s.slice(at));
    return out;
};

/** True when the string holds nothing but literal text, so a caller can skip the token walk. */
export const isPlain = (s: string | null | undefined): boolean => {
    const v = String(s ?? "");
    // A fresh, non-global regex: `.test()` on LINK itself would carry `lastIndex` between calls.
    return !v.includes("**") && !new RegExp(LINK.source).test(v);
};
