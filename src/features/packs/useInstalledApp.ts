/**
 * «You have this as an app too» -- is the installed app there, and is this page not it?
 *
 * A link to a region, tapped in a browser tab, cannot be made to open the installed app: Chromium
 * deliberately does not capture an in-browser navigation into an installed web app, and no web API
 * can launch one. What is true, and what nobody can see, is that it does not matter on Android
 * Chrome or on a desktop: the tab and the installed app are the same origin in the same profile,
 * so they share the one `chlaedderi-packs` cache and the one `chlaedderi:prefs`. Loading a region
 * here has *already* loaded it over there. It simply does not look that way, so people load it a
 * second time from the app, or give up on the link. One sentence turns that dead end into a fact.
 *
 * On iOS it would be a lie -- a home-screen web app keeps its storage apart from Safari's -- but
 * `getInstalledRelatedApps` does not exist there, nor in Firefox, so the sentence never appears.
 * The method also only answers at all when the manifest lists this app under
 * `related_applications`, which is what that member is there for.
 */

import { useEffect, useState } from "react";

import { isStandalone } from "../../version";

interface RelatedApps {
    getInstalledRelatedApps?: () => Promise<unknown[]>;
}

/**
 * True only in a browser tab that has the installed app beside it. False while the answer is still
 * being waited for, false in the installed app itself, and false wherever the browser cannot say.
 */
export const useInstalledApp = (): boolean => {
    const [found, setFound] = useState(false);

    useEffect(() => {
        // The installed window needs no pointer to itself, and asking there would answer «yes».
        if (isStandalone()) return;
        let alive = true;
        const ask = (navigator as Navigator & RelatedApps).getInstalledRelatedApps;
        if (!ask) return;
        // It rejects in a cross-origin frame, and on a browser that has the method behind a flag.
        ask.call(navigator).then(
            (apps) => {
                if (alive) setFound(apps.length > 0);
            },
            () => {
                // No answer is the same as «not installed»: the line stays away.
            },
        );
        return () => {
            alive = false;
        };
    }, []);

    return found;
};
