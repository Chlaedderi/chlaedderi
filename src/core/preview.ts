/**
 * Is this page a preview of a pull request, and if so, which one?
 *
 * A preview is published next to the app itself -- <https://xn--chldderi-2za.ch/pr-12/>
 * beside <https://xn--chldderi-2za.ch/> -- and browser storage belongs to the *host*, not to
 * the path. Without the suffix below, opening a preview would read and write the real favourites,
 * logbook, settings and installed packs of whoever opened it, and a half-finished branch could
 * damage them.
 *
 * So every storage name carries this suffix: the empty string for the app, `-pr12` under /pr-12/.
 * The names themselves are load-bearing (see store.ts) -- `src/core/preview.test.ts` holds each of
 * them to its historical spelling for the case that matters, which is every page but a preview.
 */

/** `-pr<N>` for the preview of pull request N, the empty string for anything else. */
export const previewSuffix = (path: string): string => {
    const found = /\/pr-(\d+)\//.exec(path);
    return found ? `-pr${found[1]}` : "";
};

/** The suffix for this page, read once: the address of a document does not change under it. */
export const PREVIEW_SUFFIX = previewSuffix(
    typeof location === "undefined" ? "/" : location.pathname,
);
