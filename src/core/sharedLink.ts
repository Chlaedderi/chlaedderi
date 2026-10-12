/**
 * What a shared message means, as a route into this app.
 *
 * The inverse of `features/shell/useShare.ts`: that one turns a crag, a view or a region into a
 * link, and this one turns whatever came out of a share sheet back into the route that opens it.
 * Android hands over a line of text, not a URL -- WhatsApp puts the link on its own line under the
 * message, a browser sends the page title beside it, and a person may have typed a full stop after
 * it. So the text is swept for candidates and each is read by its *shape*.
 *
 * Shape, never host. A link to this app may come from xn--chldderi-2za.ch, from chlaedderi.ch,
 * from a `/pr-12/` preview or from a dev server on 127.0.0.1, and all four are the same link. What
 * makes one ours is that its fragment is `/pack?…` carrying a region's address, or `<crag>?…`
 * carrying the region it came from -- the two forms `packLinkTo` and `linkTo` write.
 *
 * The fragment is handed back **verbatim**. A sealed region's key rides in it as
 * `&k=aB%2Bc%2Fd%3D`, and decoding it only to encode it again is a round trip that has to go
 * slightly wrong once for the key to stop opening the region.
 *
 * A route rather than an offer, so there is one return type and one thing for the caller to do:
 * `features/shell/ShareTarget.tsx` navigates, and `PackLink` and `LegacyLink` then apply the
 * policy they already own -- «the region is already installed, so just open the crag», «the
 * showcase has this crag only partially, so offer anyway».
 */

import { packAddress } from "./packs/url";

/** Longer than this is a document somebody pasted, not a shared link. */
const TEXT_MAX = 8192;

/** A link, up to the first space or the `>` of an autolink. */
const CANDIDATES = /https?:\/\/[^\s<>"]+/g;

/** The spaces a messenger writes that a scan would not split on: nbsp, figure, narrow, breaks. */
const ODD_SPACE = /[\u00a0\u2007\u202f\u2028\u2029]/g;

/** A sentence ended after the link, or somebody quoted it. */
const TRAILING = /[.,;:!?'"»”’]+$/;

/** `#<token>?pack=…` -- one segment, the crag or the crag and a route. */
const CRAG = /^\/[^/]+$/;

/**
 * A raw address is only read as a region when it looks like one.
 *
 * Without this, sharing any news article would open «Load this region? from nzz.ch», which is both
 * alarming and useless. The cost is that a pack published without an extension cannot be shared
 * into the app -- it can still be typed into the packs dialog, which is where an address the
 * viewer chose themselves belongs anyway.
 */
const PACK_FILE = /\.(json|chlpack)$/i;
const PACK_HOSTS = ["raw.githubusercontent.com", "gist.githubusercontent.com"];

const count = (text: string, char: string): number => text.split(char).length - 1;

/** Drop the punctuation a sentence leaves behind, and a closing bracket nothing opened. */
const tidy = (link: string): string => {
    let text = link.replace(TRAILING, "");
    while (/[)\]]$/.test(text)) {
        const close = text.slice(-1);
        const open = close === ")" ? "(" : "[";
        if (count(text, open) >= count(text, close)) break;
        text = text.slice(0, -1).replace(TRAILING, "");
    }
    return text;
};

const parse = (candidate: string): URL | null => {
    try {
        return new URL(candidate);
    } catch {
        return null;
    }
};

/**
 * One of the two fragment shapes this app hands out.
 *
 * Three answers, because «this is ours and its address is one we will not follow» is not the same
 * as «this is not ours»: a stranger's `#/pack?url=data:…` is as easy to write as any other link,
 * and it must end as nothing rather than as a shrug that opens the app.
 */
type Shaped = { readonly route: string } | "refused" | null;

const fromFragment = (candidate: string): Shaped => {
    const hash = parse(candidate)?.hash.replace(/^#/, "") ?? "";
    if (!hash) return null;
    // A link written out by hand may have lost the slash; everything else about it still stands.
    const route = hash.startsWith("/") ? hash : `/${hash}`;

    const cut = route.indexOf("?");
    if (cut < 0) return null;
    const head = route.slice(0, cut);
    const ours = head === "/pack" ? "url" : CRAG.test(head) ? "pack" : null;
    if (ours === null) return null;

    const address = new URLSearchParams(route.slice(cut + 1)).get(ours);
    if (address === null) return null;
    // Checked here, handed back untouched: `packAddress` is where «may this be fetched at all» is
    // already answered, and re-encoding the string would disturb the key riding beside it.
    return packAddress(address) ? { route } : "refused";
};

/** A bare address that could be a pack: `https://example.org/pack.chlpack`. */
const fromAddress = (candidate: string): string | null => {
    const address = packAddress(candidate);
    const url = address ? parse(address.url) : null;
    if (!url) return null;
    if (!PACK_FILE.test(url.pathname) && !PACK_HOSTS.includes(url.hostname)) return null;
    // A fragment on a pack address means nothing to a fetch, and would take the rest of the link
    // with it when `PackLink` reads it back.
    url.hash = "";
    return `/pack?url=${encodeURIComponent(url.href)}`;
};

/**
 * The route a shared message opens, or null when there is nothing in it to open.
 *
 * `"/"` is the third answer: a link that is plainly to a page rather than to a thing -- the app's
 * own front page, `#/fav`, somebody's home page -- opens the app and says nothing more. Only text
 * with no link in it at all, or one pointing at a `data:` or `javascript:` address, is nothing.
 */
export const routeFromShared = (text: string): string | null => {
    const clean = text.slice(0, TEXT_MAX).replace(ODD_SPACE, " ").trim();
    if (!clean) return null;

    let candidates = [...clean.matchAll(CANDIDATES)].map((found) => tidy(found[0]));
    // No scheme anywhere, and nothing but the one word: `example.org/pack.json` is an address
    // somebody meant to be absolute, and `packUrl` already knows how to read it.
    if (candidates.length === 0 && !/\s/.test(clean)) candidates = [tidy(clean)];

    // Ours first, wherever it stands in the message: a share often carries the page title and its
    // link, or a line of chat above the link that matters.
    const shaped = candidates.map(fromFragment);
    for (const found of shaped) {
        if (found !== null && found !== "refused") return found.route;
    }
    for (const candidate of candidates) {
        const route = fromAddress(candidate);
        if (route !== null) return route;
    }
    // Our shape, an address we will not follow: nothing, and said so.
    if (shaped.includes("refused")) return null;

    for (const candidate of candidates) {
        const url = parse(candidate);
        if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) continue;
        if (url.hash || ((url.pathname === "/" || url.pathname === "") && !url.search)) return "/";
    }
    return null;
};
