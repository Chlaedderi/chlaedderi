/**
 * Which version is published, and the reset that fetches the app's files again.
 *
 * Not a constant the build stamps in: the deploy writes `version.json` next to the app. That keeps
 * the build reproducible -- a bundle with a commit hash inside it could never satisfy
 * `build && git diff --exit-code`.
 *
 * It is a **store**, not a mutable module object. The first version of this file exported an object
 * and mutated it in place; React never re-renders for that, so the «More» page showed `dev` for
 * ever no matter what the deploy had written.
 *
 * **This file deliberately does not detect updates.** The hand-written app compared `version.json`
 * against `APP_VERSION`, a string the deploy baked into the bundle -- a real running-versus-
 * published comparison. We removed the baked-in version to keep the build reproducible, and the
 * first port papered over the gap by fetching the *same file* twice through two different HTTP
 * caches (`force-cache` for «running», `no-store` for «published»). Those disagree whenever the
 * browser holds a stale copy, and `location.reload()` does not evict it -- so the banner fired on
 * every single load, for ever. Whether a newer app is waiting is the service worker's business and
 * nothing else's; see `features/shell/UpdateBanner.tsx`.
 */

import { useSyncExternalStore } from "react";

import { APP_SLUG } from "@core/name";

export interface AppVersion {
    /** `2026.10.11-3574a92`, or `dev` when running from a build that was never deployed. */
    readonly version: string;
    /** ISO timestamp of the deploy, or empty. */
    readonly built: string;
}

const DEV: AppVersion = { version: "dev", built: "" };

let current: AppVersion = DEV;
const listeners = new Set<() => void>();

const announce = (): void => {
    for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const read = async (cache: RequestCache): Promise<AppVersion | null> => {
    try {
        const response = await fetch("version.json", { cache });
        if (!response.ok) return null;
        const value = (await response.json()) as Partial<AppVersion>;
        if (typeof value.version !== "string") return null;
        return { version: value.version, built: String(value.built ?? "") };
    } catch {
        // No network and nothing cached: `dev` is the honest answer.
        return null;
    }
};

/**
 * The version published at this address, for the «More» page's version line.
 *
 * `no-store`, because a cached answer here is worthless: `version.json` is written by the deploy
 * and is deliberately kept out of the precache, so the only useful read is a fresh one. When no
 * update is waiting -- which is what the service worker tells us -- this is also what is running.
 */
export const loadVersion = async (): Promise<AppVersion> => {
    const found = await read("no-store");
    if (found && found.version !== current.version) {
        current = found;
        announce();
    }
    return current;
};

export const useAppVersion = (): AppVersion =>
    useSyncExternalStore(
        subscribe,
        () => current,
        () => DEV,
    );

/** The folder this page lives in -- the scope of its service worker, and of its caches. */
const here = (): string => new URL("./", location.href).href;

/**
 * Is this cache the app shell of *this* deployment?
 *
 * Workbox names its precache after the scope it serves, so the app at / and the preview
 * of a pull request at /pr-12/ can be told apart by it -- which matters, because they
 * share a host. Dropping the other one's shell would take the app offline for somebody standing
 * under a cliff, which is the one place this app has to work.
 */
export const ownShell = (name: string, scope: string): boolean => {
    // The app's own caches -- packs, user data, map tiles -- are not a shell and never go.
    if (name.startsWith(APP_SLUG)) return false;
    const at = name.indexOf(scope);
    if (at < 0) return false;
    // A preview lies *under* the app's scope; the app's own refresh leaves it alone. The scope
    // ends in a slash, so what follows it starts the folder name.
    return !/(^|\/)pr-\d+\//.test(name.slice(at + scope.length));
};

/**
 * Fetch the app's files again and reload. The caches the app owns are left alone on purpose, which
 * the original stated as «never favourites, logbook, settings, filters, map tiles»: the mappacks,
 * the user's data and the downloaded tiles all survive this. Only the app shell is dropped -- and
 * only this deployment's own, see above.
 */
export const refreshApp = async (): Promise<void> => {
    try {
        const scope = here();
        const names = await caches.keys();
        await Promise.all(names.filter((n) => ownShell(n, scope)).map((n) => caches.delete(n)));
        const registrations = await navigator.serviceWorker?.getRegistrations();
        await Promise.all(
            (registrations ?? []).filter((r) => r.scope === scope).map((r) => r.unregister()),
        );
    } catch {
        // Even if none of that worked, the reload below still fetches what it can.
    }
    location.reload();
};

/** Running as an installed app rather than in a browser tab. */
export const isStandalone = (): boolean =>
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as { standalone?: boolean }).standalone === true;
