/**
 * Planning an approach: fetching the trails, routing over them, and measuring the result.
 *
 * swisstopo first, because its hiking-trail network is surveyed and carries the trail grade.
 * BRouter on OpenStreetMap stands in when that cannot be read, and the panel says which of the two
 * produced the line -- their quality in the mountains differs enough that a climber should know.
 */

import { useCallback, useRef, useState } from "react";

import {
    type LegPoint,
    type PathCategory,
    type ProfilePoint,
    buildGraph,
    climbOf,
    findLeg,
    hikeMinutes,
    lengthByCategory,
    reverseProfile,
} from "@core/approach";
import { fromLV95, toLV95 } from "@core/geo";
import { fetchRoute } from "@services/brouter";
import { fetchProfile, fetchTrails } from "@services/swisstopo";

/** Beyond this the two points are not an approach, and the trail box would be enormous. */
const MAX_SPAN_M = 15_000;

export interface PlanResult {
    /** The way, in WGS84, for the map and the GPX file. */
    readonly line: [number, number][];
    /** Length in m. */
    readonly d: number;
    readonly up: number | null;
    readonly down: number | null;
    /** Walking time there, and back, in minutes. */
    readonly tm: number | null;
    readonly back: number | null;
    /** How much runs on each kind of way, in m. */
    readonly by: Record<PathCategory, number>;
    readonly profile: readonly ProfilePoint[] | null;
    /** Which service produced the line. */
    readonly src: "ch" | "osm";
    /** Why swisstopo was not used, when it was not. */
    readonly netErr?: string;
    /** Why there is no height profile, when there is none. */
    readonly profErr?: string;
}

export interface PlannerState {
    readonly busy: boolean;
    readonly error: string | null;
    readonly result: PlanResult | null;
}

/** A box around the points, padded so the trails that lead there are included. */
const boxAround = (
    points: readonly { x: number; y: number }[],
): [number, number, number, number] => {
    const pad = 1200;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return [
        Math.min(...xs) - pad,
        Math.min(...ys) - pad,
        Math.max(...xs) + pad,
        Math.max(...ys) + pad,
    ];
};

export const usePlanner = (
    lang: "de" | "en",
): PlannerState & { plan: (points: readonly [number, number][]) => void; clear: () => void } => {
    const [state, setState] = useState<PlannerState>({
        busy: false,
        error: null,
        result: null,
    });
    const running = useRef<AbortController | null>(null);

    const clear = useCallback(() => {
        running.current?.abort();
        setState({ busy: false, error: null, result: null });
    }, []);

    const plan = useCallback(
        (points: readonly [number, number][]) => {
            if (points.length < 2) return;
            running.current?.abort();
            const controller = new AbortController();
            running.current = controller;
            setState({ busy: true, error: null, result: null });

            void (async () => {
                try {
                    const grid = points.map(([lat, lon]) => {
                        const [x, y] = toLV95(lat, lon);
                        return { x, y };
                    });

                    const span = Math.hypot(
                        grid[0]!.x - grid[grid.length - 1]!.x,
                        grid[0]!.y - grid[grid.length - 1]!.y,
                    );
                    if (span > MAX_SPAN_M) throw new Error("pl.far");

                    let leg: LegPoint[] = [];
                    let src: "ch" | "osm" = "ch";
                    let netErr: string | undefined;

                    try {
                        const trails = await fetchTrails(boxAround(grid), lang, controller.signal);
                        if (!trails.length) throw new Error("pl.nonet");
                        const graph = buildGraph(trails);
                        // Each leg separately, so a via point is really passed through.
                        for (let i = 1; i < grid.length; i++) {
                            const part = findLeg(
                                graph,
                                [grid[i - 1]!.x, grid[i - 1]!.y],
                                [grid[i]!.x, grid[i]!.y],
                            );
                            leg = leg.length ? [...leg, ...part.slice(1)] : part;
                        }
                    } catch (e) {
                        if (controller.signal.aborted) return;
                        // swisstopo is out of reach: OpenStreetMap, and say so.
                        netErr = e instanceof Error ? e.message : String(e);
                        src = "osm";
                        leg = [];
                        for (let i = 1; i < points.length; i++) {
                            const part = await fetchRoute(
                                points[i - 1]!,
                                points[i]!,
                                controller.signal,
                            );
                            leg = leg.length ? [...leg, ...part.slice(1)] : [...part];
                        }
                    }

                    if (controller.signal.aborted) return;
                    if (leg.length < 2) throw new Error("pl.nonet");

                    let d = 0;
                    for (let i = 1; i < leg.length; i++) {
                        d += Math.hypot(leg[i]!.x - leg[i - 1]!.x, leg[i]!.y - leg[i - 1]!.y);
                    }

                    // The profile is a bonus: without it the time is the flat estimate, which the
                    // panel labels as such rather than pretending it accounts for the climb.
                    let profile: ProfilePoint[] | null = null;
                    let profErr: string | undefined;
                    try {
                        profile = await fetchProfile(leg, controller.signal);
                    } catch (e) {
                        profErr = e instanceof Error ? e.message : String(e);
                    }
                    if (controller.signal.aborted) return;

                    const climb = profile ? climbOf(profile) : null;
                    const there = profile ? hikeMinutes(profile) : null;
                    const back = profile ? hikeMinutes(reverseProfile(profile)) : null;

                    setState({
                        busy: false,
                        error: null,
                        result: {
                            line: leg.map((p) => fromLV95(p.x, p.y)),
                            d,
                            up: climb?.up ?? null,
                            down: climb?.down ?? null,
                            tm: there,
                            back,
                            by: lengthByCategory(leg),
                            profile,
                            src,
                            ...(netErr ? { netErr } : {}),
                            ...(profErr ? { profErr } : {}),
                        },
                    });
                } catch (e) {
                    if (controller.signal.aborted) return;
                    setState({
                        busy: false,
                        error: e instanceof Error ? e.message : String(e),
                        result: null,
                    });
                }
            })();
        },
        [lang],
    );

    return { ...state, plan, clear };
};
