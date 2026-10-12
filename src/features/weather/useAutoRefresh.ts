/**
 * Fetching something when a page opens, and keeping it current while the page stays open.
 *
 * The weather and the forecast used to sit there empty until the viewer pressed a button, which is
 * the wrong way round: you open a crag page *because* you want to know whether it is wet. So both
 * cards load themselves now, and the buttons are gone.
 *
 * The tick is five minutes, but it does not force anything -- `WX_TTL` and `FC_TTL` (half an hour
 * each) still decide whether a request actually goes out, because the weather models behind them do
 * not update faster than that. So this is a cheap re-check that turns into a real fetch twice an
 * hour, and into a retry straight away when something failed.
 */

import { useEffect, useRef } from "react";

/** Five minutes, as the update check polls: often enough to matter, rare enough to be free. */
export const REFRESH_MS = 5 * 60 * 1000;

export const useAutoRefresh = (
    load: () => void,
    {
        enabled = true,
        every = REFRESH_MS,
        key = "",
    }: {
        /** Off means nothing is fetched at all -- the viewer switched this data off. */
        readonly enabled?: boolean;
        readonly every?: number;
        /** Changing this starts the cycle again at once, for a different crag or point. */
        readonly key?: string;
    } = {},
): void => {
    // The callers' `load` is rebuilt on almost every render -- `WeatherProvider`'s lists `at`,
    // `loading` and `crags` among its dependencies. Keeping it in a ref is what lets the effect
    // below depend on nothing that changes, so the interval is built once and not torn down and
    // rebuilt after every fetch.
    const latest = useRef(load);
    latest.current = load;

    useEffect(() => {
        if (!enabled) return;

        /** When the last attempt was made; 0 means «never, go now». */
        let last = 0;

        const tick = (force = false): void => {
            // Nothing to gain in the background or with no network: the call would only fail and
            // set an error where the viewer cannot see it.
            if (document.hidden || navigator.onLine === false) return;
            if (!force && Date.now() - last < every) return;
            last = Date.now();
            latest.current();
        };

        // One function, so that removing the listener really removes the one that was added.
        const onWake = (): void => tick();

        tick(true);
        const timer = setInterval(onWake, every);
        // A phone coming out of a pocket, or back into reception, is exactly when this is wanted --
        // and if the page was hidden at mount, `last` is still 0, so this loads immediately.
        document.addEventListener("visibilitychange", onWake);
        window.addEventListener("online", onWake);

        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onWake);
            window.removeEventListener("online", onWake);
        };
    }, [enabled, every, key]);
};
