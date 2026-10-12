/*
 * The service worker that retires this address.
 *
 * Chlädderi used to be served from here, and everyone who installed it carries a Workbox worker
 * registered at this exact path with scope over this folder. That worker answers every navigation
 * with the app shell it cached, so without this file the hand-over page would never be shown: the
 * browser would keep painting the old app from the old cache, for ever, offline.
 *
 * So this replaces it and then removes itself. It takes the app's shell with it and leaves
 * everything else alone -- in particular every cache whose name starts with «finale-atlas», which
 * is where the favourites, the logbook, the settings and the installed regions are. The page that
 * loads next is about to read exactly those: deleting them here would destroy the thing the
 * hand-over exists to rescue. This mirrors ownShell() in the app's src/version.ts.
 */

self.addEventListener("install", (event) => {
    // Do not wait politely behind the worker we are replacing: it is the problem.
    event.waitUntil(self.skipWaiting());
});

/*
 * The reload below has to happen exactly once, ever.
 *
 * Unregistering does not drop control of a page that is already open, so a client reloaded from
 * here can come back still controlled, register this worker again, and be reloaded again: a loop
 * that never settles. This flag is the end of it -- a cache entry outlives the registration that
 * wrote it, so the second activation finds it and leaves the clients alone.
 */
const ONCE = "chlaedderi-handover";

const reloadedBefore = async () => {
    try {
        const cache = await caches.open(ONCE);
        if (await cache.match("done")) return true;
        await cache.put("done", new Response("1"));
        return false;
    } catch {
        // A browser that will not keep the flag must not be reloaded on a guess.
        return true;
    }
};

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const again = await reloadedBefore();

            for (const name of await caches.keys()) {
                // The user's data, and our own one-shot flag. Never ours to delete.
                if (/^finale-atlas/.test(name) || name === ONCE) continue;
                await caches.delete(name);
            }

            await self.clients.claim();
            await self.registration.unregister();

            if (again) return;
            // Reload whatever is open, so the next paint comes from the network rather than from
            // the shell this worker has just thrown away.
            for (const client of await self.clients.matchAll({ type: "window" })) {
                try {
                    await client.navigate(client.url);
                } catch {
                    /* a client that will not be steered will be right on its next visit */
                }
            }
        })(),
    );
});

// Nothing is intercepted while this lives: every request goes to the network, which is the point.
self.addEventListener("fetch", () => {});
