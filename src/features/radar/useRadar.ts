/**
 * Keeping the radar running: fetching the frames, stepping through them, and refreshing.
 *
 * The rule that matters here: **a failed request never rewrites a preference.** This hook used to
 * dispatch `setRadar("off")` whenever `weather-maps.json` did not answer, and because the settings
 * are persisted, one bad moment of reception at a crag switched the radar off for good. What the
 * viewer chose and what the map can draw right now are two different things, so they are two
 * different pieces of state: `prefs.radar` is the choice, `ui.radarDown` / `ui.radarFellBack` say
 * what is wrong this session, and the `source` returned here is what the map actually shows.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";
import { type RadarFrames, type RadarSource, RadarUnavailable } from "@core/radar";
import { fetchChFrames, forgetChFrames } from "@services/meteoswissRadar";
import { fetchFrames } from "@services/rainviewer";

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
    /** The region's radar, or null while the viewer has it switched off. */
    chosen: RadarSource | null,
    reducedMotion: boolean,
): {
    /** What the map should draw -- the region's source, unless it is failing and RainViewer can stand in. */
    source: RadarSource | null;
    frames: RadarFrames | null;
    index: number;
    playing: boolean;
    loading: boolean;
    failed: boolean;
    setPlaying: (playing: boolean) => void;
    onLayerError: (source: RadarSource) => void;
} => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const fellBack = useAppSelector((s) => s.ui.radarFellBack);
    const failed = useAppSelector((s) => s.ui.radarDown);
    const [frames, setFrames] = useState<RadarFrames | null>(null);
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [loading, setLoading] = useState(false);
    const hold = useRef(0);

    // The Italian radar is only over Italy and is sometimes simply unreachable. Standing in for it
    // with RainViewer is a better answer than an empty map -- but only for this session, so the
    // region's own radar is tried again next time rather than quietly written off.
    const source: RadarSource | null = chosen && chosen !== "rv" && fellBack ? "rv" : chosen;

    const onLayerErrorRef = useRef<(which: RadarSource) => void>(() => {});
    // Held in a ref so that changing language does not tear down the polling and start it again.
    const tRef = useRef(t);
    tRef.current = t;
    // Read inside the timer without making it a dependency.
    const framesRef = useRef<RadarFrames | null>(frames);
    framesRef.current = frames;

    useEffect(() => {
        // The Italian radar is a live tile service with nothing to fetch; the other two are frames.
        if (source !== "rv" && source !== "ch") {
            setFrames(null);
            return;
        }
        const load = source === "ch" ? fetchChFrames : fetchFrames;

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
            void load(controller.signal, (partial) => {
                // The Swiss radar decodes twenty-four frames, newest first. Showing the newest the
                // moment it lands means the picture somebody is waiting for is not behind the
                // other twenty-three.
                if (!alive) return;
                setFrames(partial);
                setIndex(partial.times.length - 1);
            })
                .then((found) => {
                    if (!alive) return;
                    setFrames(found);
                    setIndex(found.times.length - 1);
                    told = false;
                    dispatch(uiActions.setRadarDown(false));
                })
                .catch((problem: unknown) => {
                    if (!alive) return;
                    // Not a dropped request but a wrong one: this source cannot answer here, so
                    // stand another in rather than retrying every half minute for ever.
                    if (problem instanceof RadarUnavailable) {
                        onLayerErrorRef.current(source);
                        return;
                    }
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
    }, [source, dispatch]);

    useEffect(() => {
        if (!playing || reducedMotion) return;
        const count = frames?.times.length ?? 0;
        if (count < 2) return;

        const timer = setInterval(() => {
            setIndex((i) => {
                if (i === count - 1 && hold.current++ < HOLD) return i;
                hold.current = 0;
                return (i + 1) % count;
            });
        }, STEP_MS);
        return () => clearInterval(timer);
    }, [source, playing, reducedMotion, frames]);

    /** The region's own radar did not answer: stand in with the one that works everywhere. */
    const onLayerError = useCallback(
        (which: RadarSource) => {
            if (which === "rv" || fellBack) return;
            if (which === "ch") forgetChFrames();

            dispatch(
                uiActions.toast({
                    message: t(which === "ch" ? "rd.chFail" : "rd.dpcFail"),
                    severity: "warning",
                }),
            );
            dispatch(uiActions.setRadarFellBack(true));
        },
        [dispatch, t, fellBack],
    );

    // Read inside the fetch loop without making the loop depend on it.
    onLayerErrorRef.current = onLayerError;

    return { source, frames, index, playing, loading, failed, setPlaying, onLayerError };
};
