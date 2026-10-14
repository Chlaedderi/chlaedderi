/**
 * A host as a person reads it, for the one line where that decides something.
 *
 * The app is served from «chlädderi.ch», and every machine writes that `xn--chldderi-2za.ch`: DNS,
 * the certificate, the `CNAME` file, the schema's `$id`, and `URL.host`, which is punycode by
 * definition. A browser decodes an international domain for its own address bar with rules it does
 * not expose, and the platform offers nothing that reads one back. So the install confirmation --
 * the one place in the app where somebody decides whether to trust a link a stranger sent them --
 * named this very site with a string nobody has ever seen.
 *
 * Decoding whatever arrives would make that worse rather than better. `xn--80ak6aa92e.com` reads
 * as «аррӏе.com» in Cyrillic, and `xn--paypal-.com`, which `new URL()` hands over untouched, is
 * well-formed punycode for «paypal». A region may be hosted by anybody, so a decoder that always
 * decodes hands a hostile host a costume to wear in a trust prompt. This one decodes only what it
 * can say something definite about, and everything else keeps the spelling it arrived in.
 * Punycode in that line is not a failure, it is the honest answer, and it is what a browser falls
 * back to as well.
 *
 * What it will show, and nothing else: ASCII letters, digits and the hyphen, and the lower-case
 * Latin letters of European orthography. One script, no marks, no case. That covers the umlaut
 * this exists for and the accents of its neighbours, and it refuses every script that has ever
 * been used to dress one name up as another. It also refuses Romanian's ș and ț and the whole of
 * Vietnamese, which live outside that block and are perfectly honest: whoever hosts a pack there
 * is shown in punycode and loses nothing but the pleasure of being read.
 *
 * It does not make an unfamiliar host judgeable, and nothing here could. `chlaedderi.ch.evil.example`
 * is ASCII, untouched by any of this, and reads as this site to anybody who stops at the first dot.
 *
 * For reading and for nothing else: what is compared, remembered or fetched is the host itself.
 * This is a security control, like `src/core/text.ts`, and the tests beside it are the control.
 */

import { APP_NAME, APP_SLUG } from "./name";
import { fold } from "./text";

/** `:4173` on the end of a host. An IPv6 literal ends in `]`, so this cannot take a bite of one. */
const PORT = /:\d*$/u;

/** A label as DNS carries it -- which is what `URL.host` has already lower-cased for us. */
const LDH = /^[a-z0-9-]+$/u;

/**
 * The letters a decoded label may be shown in.
 *
 * `a-z0-9-` is what the label was allowed to be before it was ever encoded. `à-ö` and `ø-ÿ` are
 * the lower-case letters of the Latin-1 block: the gap drops ÷, which is not a letter, and the run
 * starts above ß, which browsers keep in punycode too -- it was «ss» under IDNA2003 and itself
 * under IDNA2008, so `faß.de` and `fass.de` are two registrations that would read as one. `Ā-ſ` is
 * the whole of Latin Extended-A; its upper-case half is in the range and is dropped by the case
 * test in `showable`, because a host is lower case and anything else is a spelling no resolver
 * ever handed back.
 */
const SHOWABLE = /^[a-z0-9à-öø-ÿĀ-ſ-]+$/u;

/**
 * The letters inside that block that are not shown anyway.
 *
 * ſ reads as an f, ĸ as a k, ı as an i -- `kaĸao.de` is a trust prompt's worth of difference from
 * `kakao.de`. ŀ and ŉ are there for completeness: IDNA2008 disallows ſ, ŀ and ŉ outright, so no
 * name anybody could register is lost by refusing them, and only a hostile label carries one.
 */
const NEVER = /[ĸŀŉſı]/u;

/** Where a hyphen may not be: either end, and the third and fourth place, where `xn--` lives. */
const HYPHENS = /^-|-$|^..--/u;

/**
 * What one letter is read as, where folding the accents off does not reach.
 *
 * Only for the check against this app's own name below, and only for what can still get that far:
 * ĸ ŀ ŉ ſ and ı never do, because `NEVER` has already refused them.
 */
const LOOKALIKE = new Map([
    ["æ", "ae"],
    ["œ", "oe"],
    ["ø", "o"],
    ["đ", "d"],
    ["ð", "d"],
    ["ł", "l"],
    ["ŋ", "n"],
    ["ħ", "h"],
    ["ŧ", "t"],
    ["ĳ", "ij"],
    ["1", "l"],
    ["0", "o"],
]);

/** RFC 3492's parameters, under its own names. */
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
/** The first code point the extension may insert; everything below it is in the literal part. */
const INITIAL_N = 128;
const INITIAL_BIAS = 72;
/** What the RFC's reference decoder can hold. Past it, a label is an attempt rather than a name. */
const MAX_DELTA = 0x7fffffff;
/** What DNS allows a label to be. It also keeps the insertion loop off a hostile 100 kB «host». */
const LABEL_MAX = 63;

/** A basic code point back to its digit value, or -1 for anything that is not one. */
const digitOf = (ch: string): number => {
    const code = ch.charCodeAt(0);
    if (code >= 0x61 && code <= 0x7a) return code - 0x61; // a-z are 0..25
    if (code >= 0x30 && code <= 0x39) return code - 0x30 + 26; // 0-9 are 26..35
    return -1;
};

/** RFC 3492's bias adaptation, transcribed. */
const adapt = (delta: number, count: number, first: boolean): number => {
    let d = first ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
    d += Math.floor(d / count);
    let k = 0;
    while (d > ((BASE - TMIN) * TMAX) / 2) {
        d = Math.floor(d / (BASE - TMIN));
        k += BASE;
    }
    return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
};

/**
 * One `xn--` label back to the characters it stands for, or null for anything that is not one.
 *
 * Strict rather than forgiving, because the question being asked is «is this the only way to write
 * that name?» and not «can I make sense of this». The encoding half of RFC 3492 is not here and is
 * not needed: its variable-length integers are a bijective numeration, so a delta has exactly one
 * spelling, and what is left over is structural and is refused by name below. The one place that
 * stops being true is a surrogate -- `xn--kv9bzx` and `xn--9h45d` decode to the same JavaScript
 * string, one as a pair of halves and one as the character itself, because a string here is
 * UTF-16. So a surrogate is not a character this hands back.
 */
export const fromPunycode = (label: string): string | null => {
    if (!label.startsWith("xn--") || !LDH.test(label) || label.length > LABEL_MAX) return null;
    const encoded = label.slice(4);

    // The delimiter is the *last* hyphen, and an encoder writes one only when something precedes
    // it: a leading one is a spelling nothing produces.
    const split = encoded.lastIndexOf("-");
    if (split === 0) return null;
    const out = split > 0 ? [...encoded.slice(0, split)].map((ch) => ch.charCodeAt(0)) : [];
    let at = split > 0 ? split + 1 : 0;
    // Nothing to insert is not an international domain: `xn--paypal-` decodes to «paypal», and
    // `xn--paypal-.com` is a host `new URL()` hands over untouched.
    if (at >= encoded.length) return null;

    let n = INITIAL_N;
    let i = 0;
    let bias = INITIAL_BIAS;
    while (at < encoded.length) {
        const start = i;
        let w = 1;
        let k = BASE;
        for (;;) {
            // `charAt` past the end is the empty string, which is not a digit -- so a number that
            // runs off the end of the label is an error rather than a short number.
            const digit = digitOf(encoded.charAt(at++));
            if (digit < 0) return null;
            // A JavaScript number is exact far beyond this, so an overflow can be caught after the
            // addition rather than predicted before it.
            i += digit * w;
            if (i > MAX_DELTA) return null;
            const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
            if (digit < t) break;
            w *= BASE - t;
            if (w > MAX_DELTA) return null;
            k += BASE;
        }
        const count = out.length + 1;
        bias = adapt(i - start, count, start === 0);
        n += Math.floor(i / count);
        if (n > 0x10ffff) return null;
        if (n >= 0xd800 && n <= 0xdfff) return null;
        i %= count;
        out.splice(i, 0, n);
        i++;
    }
    return String.fromCodePoint(...out);
};

/** A label reduced to what it would be mistaken for: no accents, no case, no digraphs. */
const skeleton = (label: string): string =>
    [...fold(label)].map((ch) => LOOKALIKE.get(ch) ?? ch).join("");

/**
 * The skeletons of this app's own name, which is the one name its readers are trained to trust.
 *
 * The allowlist above bounds what alphabet a hostile label may use, not what it may be mistaken
 * for, and this name is attackable from inside it: `chlædderi.ch` reads as the ASCII spelling the
 * project has taught everybody to accept, and `ch1ädderi.ch` reads as the name itself.
 */
const OWN = new Set([APP_SLUG, skeleton(APP_NAME)]);

/** Is this decoded label worth showing in place of the punycode it arrived as? */
const showable = (label: string): boolean =>
    // Something was actually decoded, and it is one script, lower case, with nothing out of place.
    !LDH.test(label) &&
    SHOWABLE.test(label) &&
    !NEVER.test(label) &&
    !HYPHENS.test(label) &&
    label === label.toLowerCase() &&
    // Implied by the allowlist -- every letter in it is a precomposed starter, and no two of them
    // compose -- but it is the rule UTS46 states, and it is what keeps that implication true if
    // the allowlist is ever widened. Without it, `bu` and a combining diaeresis read as «bücher».
    label === label.normalize("NFC") &&
    // Our own name, spelled any way but its own.
    (!OWN.has(skeleton(label)) || label === APP_NAME.toLowerCase());

/**
 * A host written the way a person reads it, or exactly the way it arrived.
 *
 * All of it or none of it. A host showing one label as a name and the next as punycode would ask
 * the reader to do the hardest part of the job -- notice which half is which -- in the line where
 * they are least able to. So a single label this cannot vouch for puts the whole host back into
 * the spelling the machine uses, and the two answers stay far enough apart to be told apart.
 *
 * Two names that look alike are not the same host, so whatever is being compared, remembered or
 * fetched is the host that came in, and never this.
 */
export const shownHost = (host: string): string => {
    // Every ordinary address leaves here, this site's own dev server among them.
    if (!host.includes("xn--")) return host;

    const port = PORT.exec(host)?.[0] ?? "";
    const shown: string[] = [];
    for (const label of (port ? host.slice(0, -port.length) : host).split(".")) {
        if (!label.startsWith("xn--")) {
            shown.push(label);
            continue;
        }
        const read = fromPunycode(label);
        // Nothing decoded holds a dot or a colon, so a host cannot gain a label or a port here.
        if (read === null || !showable(read)) return host;
        shown.push(read);
    }
    return `${shown.join(".")}${port}`;
};
