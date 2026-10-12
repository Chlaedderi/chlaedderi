/**
 * Keeping the radar running: fetching the frames, stepping through them, and refreshing.
 *
 * The rule that matters here: **a failed request never rewrites a preference.** This hook used to
 * dispatch `setRadar("off")` whenever `weather-maps.json` did not answer, and because the settings
 * are persisted, one bad moment of reception at a crag switched the radar off for good. What the
 * viewer chose and what the map can draw right now are two different things, so they are two
 * different pieces of state: `prefs.radar` is the choice, `ui.radarDown` / `ui.radarDpcDown` say
 * what is wrong this session, and the `kind` returned here is what the map actually shows.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";
import { type RadarFrames, fetchFrames } from "@services/rainviewer";

import type { RadarKind } from "./RadarLayer";

/** How long a frame shows. */
const STEP_MS = 650;
/** Ticks to rest on the newest frame before looping -- that is the one worth reading. */
const HOLD = 3;
/** The radar is two hours of history; after five minutes it is worth fetching again. */
const REFRESH_MS = 5 * 60 * 1000;
/** After a failure, try again sooner than that: reception comes back. */
const RETRY_MS = 30 * 1000;
/** How often the timer wakes up to ask whether anything is due. */
const TICK_MS = 10 * 1000;

export const useRadar = (
    chosen: RadarKind,
    reducedMotion: boolean,
): {
    /** What the map should draw -- the choice, unless it is failing and something else can stand in. */
    kind: RadarKind;
    frames: RadarFrames | null;
    index: number;
    playing: boolean;
    loading: boolean;
    failed: boolean;
    setPlaying: (playing: boolean) => void;
    onLayerError: (kind: RadarKind) => void;
} => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const dpcDown = useAppSelector((s) => s.ui.radarDpcDown);
    const failed = useAppSelector((s) => s.ui.radarDown);
    const [frames, setFrames] = useState<RadarFrames | null>(null);
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [loading, setLoading] = useState(false);
    const hold = useRef(0);

    // The Italian radar is only over Italy and is sometimes simply unreachable. Standing in for it
    // with RainViewer is a better answer than an empty map -- but only for this session, so the
    // choice is tried again next time rather than quietly rewritten.
    const kind: RadarKind = chosen === "dpc" && dpcDown ? "rv" : chosen;

    // Held in a ref so that changing language does not tear down the polling and start it again.
    const tRef = useRef(t);
    tRef.current = t;
    // Read inside the timer without making it a dependency.
    const framesRef = useRef<RadarFrames | null>(frames);
    framesRef.current = frames;

    useEffect(() => {
        if (kind !== "rv") {
            setFrames(null);
            return;
        }

        const controller = new AbortController();
        let alive = true;
        let inFlight = false;
        /** When the last attempt was made; 0 means «never, go now». */
        let last = 0;
        /** The viewer has been told about this failure streak already. */
        let told = false;

        const run = (): void => {
            if (inFlight) return;
            inFlight = true;
            last = Date.now();
            setLoading(true);
            void fetchFrames(controller.signal)
                .then((found) => {
                    if (!alive) return;
                    setFrames(found);
                    setIndex(found.urls.length - 1);
                    told = false;
                    dispatch(uiActions.setRadarDown(false));
                })
                .catch(() => {
                    if (!alive) return;
                    // Say it once per streak: the timer below retries every half minute, and a
                    // toast per retry would stack up a column of them.
                    if (!told) {
                        told = true;
                        dispatch(
                            uiActions.toast({
                                message: tRef.current("rd.fail"),
                                severity: "warning",
                            }),
                        );
                    }
                    dispatch(uiActions.setRadarDown(true));
                })
                .finally(() => {
                    inFlight = false;
                    if (alive) setLoading(false);
                });
        };

        /** Nothing to gain while the app is in the background or the device is offline. */
        const check = (): void => {
            if (!alive || inFlight) return;
            if (document.hidden || navigator.onLine === false) return;
            if (Date.now() - last < (framesRef.current ? REFRESH_MS : RETRY_MS)) return;
            run();
        };

        // The network coming back is news, not a tick: it is worth a try straight away rather than
        // after whatever is left of the retry delay.
        const onOnline = (): void => {
            last = 0;
            check();
        };

        check();
        const timer = setInterval(check, TICK_MS);
        // Coming back to the app is when a stale radar is worth refreshing; the throttle above
        // keeps a flurry of tab switches from fetching every time.
        document.addEventListener("visibilitychange", check);
        window.addEventListener("online", onOnline);

        return () => {
            alive = false;
            controller.abort();
            clearInterval(timer);
            document.removeEventListener("visibilitychange", check);
            window.removeEventListener("online", onOnline);
        };
    }, [kind, dispatch]);

    useEffect(() => {
        if (kind !== "rv" || !playing || reducedMotion) return;
        const count = frames?.urls.length ?? 0;
        if (count < 2) return;

        const timer = setInterval(() => {
            setIndex((i) => {
                if (i === count - 1 && hold.current++ < HOLD) return i;
                hold.current = 0;
                return (i + 1) % count;
            });
        }, STEP_MS);
        return () => clearInterval(timer);
    }, [kind, playing, reducedMotion, frames]);

    /** The Italian radar did not answer: stand in with the one that works everywhere. */
    const onLayerError = useCallback(
        (which: RadarKind) => {
            if (which !== "dpc" || dpcDown) return;
            dispatch(uiActions.toast({ message: t("rd.dpcFail"), severity: "warning" }));
            dispatch(uiActions.setRadarDpcDown(true));
        },
        [dispatch, t, dpcDown],
    );

    return { kind, frames, index, playing, loading, failed, setPlaying, onLayerError };
};
