/**
 * The address a mappack is actually fetchable from.
 *
 * Whoever hosts a pack hands out whatever address their browser was showing, and for the host most
 * people reach for that is the wrong one: `github.com/<u>/<r>/blob/<ref>/pack.json` answers with a
 * web page, not the file, and `github.com` sends no `Access-Control-Allow-Origin`, so even the
 * right path there is unreadable from another origin. `raw.githubusercontent.com` and
 * `gist.githubusercontent.com` send `*`, which is why the rewrite has to move the *host* and not
 * only the path -- a redirect from `gist.github.com/…/raw` is itself checked against CORS and fails
 * the same way.
 *
 * This runs before a pack is fetched and again when a link to a region is built, so that a pack
 * installed from the un-fetchable form still hands out an address that works for whoever gets it.
 * Anything this module does not recognise is returned untouched: it is a convenience, not a filter.
 * Whether an address may be fetched at all is a separate question, asked elsewhere.
 */

/** `example.org/pack.json` -- a host and a path, with the scheme left off. */
const BARE_HOST = /^[\w-]+(?:\.[\w-]+)+(?::\d+)?\//;

/** `/<user>/<repo>/blob|raw/<the rest>` on github.com. */
const BLOB = /^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/;

/** `/<user>/<id>` on gist.github.com, with or without the `/raw` it needs. */
const GIST = /^\/([^/]+)\/([^/]+)(\/raw(?:\/.*)?)?$/;

/**
 * Rewrite an address to the one that can be fetched, or hand it back unchanged.
 *
 * A relative address (`/maps/pack.ow.json`, `./pack.json`) is left exactly as it is: it has no host
 * to correct, and prefixing a scheme would turn a path into somebody else's domain.
 */
export const packUrl = (raw: string): string => {
    const text = raw.trim();
    if (!text) return text;

    // A bare `example.org/pack.json` is an address someone meant to be absolute.
    const withScheme = BARE_HOST.test(text) ? `https://${text}` : text;

    let url: URL;
    try {
        url = new URL(withScheme);
    } catch {
        return text;
    }

    const host = url.hostname.replace(/^www\./, "");

    if (host === "github.com") {
        const found = BLOB.exec(url.pathname);
        // `?raw=1` and any fragment mean nothing on the raw host, so they are dropped with it.
        if (found) {
            return `https://raw.githubusercontent.com/${found[1]}/${found[2]}/${found[3]}`;
        }
    }

    if (host === "gist.github.com") {
        const found = GIST.exec(url.pathname);
        if (found) {
            return `https://gist.githubusercontent.com/${found[1]}/${found[2]}${found[3] ?? "/raw"}`;
        }
    }

    return withScheme;
};

/**
 * May this address be fetched at all, and what host would it actually reach?
 *
 * A link from a stranger can now ask the app to install a region, so the address in it is checked
 * before anything is fetched and before the viewer is shown where it comes from.
 *
 *   - Only `http:` and `https:`. `fetch("data:application/json,…")` works in a browser, and a
 *     `data:` link would install a pack a stranger wrote with no network and no host to name.
 *     Mixed content is deliberately *not* refused here -- the browser blocks it and the fetch
 *     then says so in words, which is more use than a flat no.
 *   - Absolute, unless a `base` is given. A relative address in a link is meaningless: it would
 *     resolve against whoever opened the link rather than whoever sent it. Typed into the packs
 *     dialog it is perfectly ordinary -- it means this very site -- so that caller passes its own
 *     address as the base and nothing else does.
 *   - No credentials in the address: `https://raw.githubusercontent.com@evil.example/p.json`
 *     reads as GitHub to a person and as `evil.example` to the browser.
 *
 * The host comes back parsed -- punycode for an international domain, port and all -- so that no
 * caller is tempted to find it in the string itself. This is the host to compare, to remember and
 * to fetch with, and the only one there is. Reading it back into a name a person recognises is a
 * separate question, asked by `src/core/idn.ts` at the moment of showing it and nowhere else.
 */
export const packAddress = (
    raw: string,
    base?: string,
): { readonly url: string; readonly host: string } | null => {
    const corrected = packUrl(raw);
    let url: URL;
    try {
        url = base ? new URL(corrected, base) : new URL(corrected);
    } catch {
        return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname) return null;
    // `url.href` rather than the string, so that what a relative address resolved to is what gets
    // fetched, remembered and shown.
    return { url: url.href, host: url.host };
};
