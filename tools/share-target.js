/**
 * The share sheet's half of the service worker: hand-written, and pulled into the generated worker
 * by `workbox.importScripts` (vite.config.ts), which puts it above everything Workbox emits.
 *
 * Android hands a share target a real HTTP request, and the manifest asks for a **POST**. A GET
 * target would have the system percent-encode the whole shared link -- fragment and all, and a
 * sealed region's key lives in that fragment -- into a query string, and whenever no worker is
 * controlling yet that request line goes to whoever hosts the site. A body never becomes a URL,
 * and the redirect written below puts the text back behind a `#`, which no server is ever sent.
 *
 * This decides nothing. It joins the three fields a sender may fill, caps them, and hands the text
 * to `#/share`, where src/core/sharedLink.ts reads it in TypeScript the tests can reach. Anything
 * that throws ends on the app's own start page rather than on an error.
 */

/** A share is a link and a sentence, not a document. Past this, nothing in it is still a link. */
const SHARED_TEXT_MAX = 4096;

/** What the manifest's `share_target.params` are called, likeliest first. */
const SHARED_FIELDS = ["url", "text", "title"];

self.addEventListener("fetch", (event) => {
    const request = event.request;
    // Every route Workbox registers is a GET, so a POST finds an empty route map and nothing else
    // answers it -- including the navigation fallback.
    if (request.method !== "POST") return;
    const action = new URL("share", self.registration.scope).href;
    if (request.url.split("?")[0] !== action) return;

    event.respondWith(
        (async () => {
            const home = self.registration.scope;
            try {
                const form = await request.formData();
                const text = SHARED_FIELDS.map((name) => form.get(name))
                    .filter((value) => typeof value === "string" && value !== "")
                    .join(" ")
                    .slice(0, SHARED_TEXT_MAX);
                const to = new URL("./#/share?text=" + encodeURIComponent(text), home);
                // 303, so the browser follows it with a GET: the navigation fallback answers that
                // one out of the precache, which is why a share works with no network at all.
                return Response.redirect(to.href, 303);
            } catch {
                return Response.redirect(home, 303);
            }
        })(),
    );
});
