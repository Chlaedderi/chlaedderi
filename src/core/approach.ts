/**
 * Planning a way from a car park to a crag over Switzerland's hiking trails.
 *
 * Everything here is pure and works in the Swiss grid (LV95, metres), so it can be tested on a
 * hand-made network without the network. Fetching the trails is src/services/swisstopo.ts.
 *
 * The three pieces:
 *
 *   `buildGraph`  turns trail lines into a routable graph. Two things make this more than a
 *                 vertex list: trails that **end on** another without sharing a vertex
 *                 (T-junctions), and trails that **cross** without one. Both are stitched, or the
 *                 route walks around whole valleys to reach a path it is already standing on.
 *   `nearest`     the trail points closest to a position, distinct places first.
 *   `findLeg`     Dijkstra from A to B, with each kind of way weighted: a hiking path counts its
 *                 own length, an alpine route 1.6×, and going cross-country 4×, so the search
 *                 prefers a longer path over a shorter scramble.
 */

/** 1 hiking path · 2 mountain path · 3 alpine route · 4 an OSM path (the stand-in) · 0 off-trail. */
export type PathCategory = 0 | 1 | 2 | 3 | 4;

/** How much each kind of way costs per metre. Off-trail is deliberately expensive. */
export const PATH_WEIGHT: Record<PathCategory, number> = {
    0: 4,
    1: 1,
    2: 1.05,
    3: 1.6,
    4: 1.1,
};

/** The furthest a start or finish may lie from a trail, in metres. */
export const SNAP_M = 800;

export interface TrailLine {
    /** `[east, north]` in LV95. */
    readonly c: readonly (readonly [number, number])[];
    readonly cat: PathCategory;
}

interface Edge {
    to: number;
    d: number;
    cat: PathCategory;
    /** An explicit cost, when it is not `d * PATH_WEIGHT[cat]`. */
    w?: number;
}

export interface TrailGraph {
    readonly X: number[];
    readonly Y: number[];
    readonly adj: Edge[][];
    readonly segs: [a: number, b: number, cat: PathCategory][];
    readonly grid: Map<string, number[]>;
    readonly G: number;
    n: number;
}

export interface NearPoint {
    readonly a: number;
    readonly b: number;
    readonly cat: PathCategory;
    readonly x: number;
    readonly y: number;
    readonly d: number;
}

/**
 * The nearest points on trail segments, closest first, no two within 25 m of each other.
 * `skip` leaves out segments by their two ends, before anything is counted.
 */
export const nearest = (
    g: TrailGraph,
    x: number,
    y: number,
    maxD: number,
    maxN: number,
    skip?: (a: number, b: number) => boolean,
): NearPoint[] => {
    const r = Math.ceil(maxD / g.G);
    const cx = Math.floor(x / g.G);
    const cy = Math.floor(y / g.G);
    const seen = new Set<number>();
    const out: NearPoint[] = [];

    for (let a = -r; a <= r; a++) {
        for (let b = -r; b <= r; b++) {
            const list = g.grid.get(`${cx + a}:${cy + b}`);
            if (!list) continue;
            for (const i of list) {
                if (seen.has(i)) continue;
                seen.add(i);
                const [p, q, cat] = g.segs[i]!;
                if (skip?.(p, q)) continue;
                const dx = g.X[q]! - g.X[p]!;
                const dy = g.Y[q]! - g.Y[p]!;
                const l2 = dx * dx + dy * dy;
                const u = l2
                    ? Math.max(0, Math.min(1, ((x - g.X[p]!) * dx + (y - g.Y[p]!) * dy) / l2))
                    : 0;
                const px = g.X[p]! + u * dx;
                const py = g.Y[p]! + u * dy;
                const d = Math.hypot(px - x, py - y);
                if (d <= maxD) out.push({ a: p, b: q, cat, x: px, y: py, d });
            }
        }
    }

    out.sort((m, n) => m.d - n.d);
    const pick: NearPoint[] = [];
    for (const h of out) {
        if (pick.length >= maxN) break;
        // Much further than the closest is not an alternative, it is a different place.
        if (pick.length && h.d > pick[0]!.d * 1.5 + 60) break;
        if (pick.every((o) => Math.hypot(o.x - h.x, o.y - h.y) > 25)) pick.push(h);
    }
    return pick;
};

/** Build a routable graph out of trail lines. */
export const buildGraph = (lines: readonly TrailLine[]): TrailGraph => {
    const X: number[] = [];
    const Y: number[] = [];
    const adj: Edge[][] = [];
    const cell = new Map<string, number>();
    const segs: [number, number, PathCategory][] = [];
    const grid = new Map<string, number[]>();
    const G = 100;

    /** A vertex, merged with one already there within 2.5 m -- surveys do not repeat coordinates. */
    const node = (x: number, y: number): number => {
        const cx = Math.round(x / 2);
        const cy = Math.round(y / 2);
        for (let a = -1; a <= 1; a++) {
            for (let b = -1; b <= 1; b++) {
                const k = cell.get(`${cx + a}:${cy + b}`);
                if (k != null && Math.hypot(X[k]! - x, Y[k]! - y) <= 2.5) return k;
            }
        }
        const k = X.length;
        X.push(x);
        Y.push(y);
        adj.push([]);
        cell.set(`${cx}:${cy}`, k);
        return k;
    };

    const link = (a: number, b: number, cat: PathCategory): void => {
        if (a === b) return;
        const d = Math.hypot(X[a]! - X[b]!, Y[a]! - Y[b]!);
        adj[a]!.push({ to: b, d, cat });
        adj[b]!.push({ to: a, d, cat });
    };

    const index = (a: number, b: number, cat: PathCategory): void => {
        const i = segs.length;
        segs.push([a, b, cat]);
        const x0 = Math.floor(Math.min(X[a]!, X[b]!) / G);
        const x1 = Math.floor(Math.max(X[a]!, X[b]!) / G);
        const y0 = Math.floor(Math.min(Y[a]!, Y[b]!) / G);
        const y1 = Math.floor(Math.max(Y[a]!, Y[b]!) / G);
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                const k = `${x}:${y}`;
                const list = grid.get(k);
                if (list) list.push(i);
                else grid.set(k, [i]);
            }
        }
    };

    for (const line of lines) {
        const first = line.c[0];
        if (!first) continue;
        let p = node(first[0], first[1]);
        for (let i = 1; i < line.c.length; i++) {
            const point = line.c[i]!;
            const q = node(point[0], point[1]);
            if (q !== p) {
                link(p, q, line.cat);
                index(p, q, line.cat);
            }
            p = q;
        }
    }

    const g: TrailGraph = { X, Y, adj, segs, grid, G, n: X.length };

    // A trail that ends *on* another without a shared vertex: join it to the nearest point there.
    for (let k = 0; k < g.n; k++) {
        if (adj[k]!.length !== 1) continue;
        const onward = adj[k]![0]!.to;
        // Its own segments are left out before the search, not after: the closest segment to an
        // end is always its own, at no distance at all, and would be the only one returned.
        const [hit] = nearest(
            g,
            X[k]!,
            Y[k]!,
            6,
            1,
            (a, b) => a === k || b === k || a === onward || b === onward,
        );
        if (!hit) continue;
        const p = X.length;
        X.push(hit.x);
        Y.push(hit.y);
        adj.push([]);
        link(p, hit.a, hit.cat);
        link(p, hit.b, hit.cat);
        link(k, p, hit.cat);
    }

    // Two trails crossing without a shared vertex: put a node where they cross.
    const done = new Set<string>();
    // Where along each segment its crossings lie, so that two on one segment can be joined.
    const along = new Map<number, { t: number; p: number }[]>();
    const at = (seg: number, t: number, p: number): void => {
        const list = along.get(seg);
        if (list) list.push({ t, p });
        else along.set(seg, [{ t, p }]);
    };
    for (const list of grid.values()) {
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const u = segs[list[i]!]!;
                const v = segs[list[j]!]!;
                const key = `${list[i]}:${list[j]}`;
                if (
                    done.has(key) ||
                    u[0] === v[0] ||
                    u[0] === v[1] ||
                    u[1] === v[0] ||
                    u[1] === v[1]
                ) {
                    continue;
                }
                done.add(key);

                const x1 = X[u[0]]!;
                const y1 = Y[u[0]]!;
                const dx1 = X[u[1]]! - x1;
                const dy1 = Y[u[1]]! - y1;
                const x2 = X[v[0]]!;
                const y2 = Y[v[0]]!;
                const dx2 = X[v[1]]! - x2;
                const dy2 = Y[v[1]]! - y2;

                const den = dx1 * dy2 - dy1 * dx2;
                if (Math.abs(den) < 1e-9) continue;
                const a = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / den;
                const c = ((x2 - x1) * dy1 - (y2 - y1) * dx1) / den;
                if (a < 0 || a > 1 || c < 0 || c > 1) continue;

                const p = X.length;
                X.push(x1 + a * dx1);
                Y.push(y1 + a * dy1);
                adj.push([]);
                link(p, u[0], u[2]);
                link(p, u[1], u[2]);
                link(p, v[0], v[2]);
                link(p, v[1], v[2]);
                at(list[i]!, a, p);
                at(list[j]!, c, p);
            }
        }
    }

    // Each crossing is linked to its segment's two ends; crossings on the same segment also have
    // to be linked to each other, or going from one to the next means out to an end and back.
    for (const [seg, list] of along) {
        list.sort((m, n) => m.t - n.t);
        for (let i = 1; i < list.length; i++) link(list[i - 1]!.p, list[i]!.p, segs[seg]![2]);
    }

    g.n = X.length;
    return g;
};

export interface LegPoint {
    readonly x: number;
    readonly y: number;
    /** The kind of way that leads *to* this point. */
    readonly cat: PathCategory;
}

/**
 * The cheapest way from A to B over the network, both in LV95.
 *
 * A straight line between the two is always available at the off-trail weight, so there is always
 * an answer -- a crag with no path near it gets a line that says «this is the direction», which is
 * the honest result rather than no result.
 */
export const findLeg = (
    g: TrailGraph,
    a: readonly [number, number],
    b: readonly [number, number],
): LegPoint[] => {
    const base = g.X.length;
    const { X, Y } = g;
    const extra = new Map<number, Edge[]>();

    const add = (u: number, v: number, d: number, cat: PathCategory, w?: number): void => {
        for (const [from, to] of [
            [u, v],
            [v, u],
        ] as const) {
            const list = extra.get(from);
            const edge: Edge = { to, d, cat, ...(w != null ? { w } : {}) };
            if (list) list.push(edge);
            else extra.set(from, [edge]);
        }
    };

    const vnode = (x: number, y: number): number => {
        X.push(x);
        Y.push(y);
        return X.length - 1;
    };

    const start = vnode(a[0], a[1]);
    const end = vnode(b[0], b[1]);

    // The way out when no trail helps: straight, at the off-trail price.
    const straight = Math.hypot(a[0] - b[0], a[1] - b[1]);
    add(start, end, straight, 0, straight * PATH_WEIGHT[0]);

    for (const [v, p] of [
        [start, a],
        [end, b],
    ] as const) {
        for (const h of nearest(g, p[0], p[1], SNAP_M, 4)) {
            const k = vnode(h.x, h.y);
            add(k, h.a, Math.hypot(h.x - X[h.a]!, h.y - Y[h.a]!), h.cat);
            add(k, h.b, Math.hypot(h.x - X[h.b]!, h.y - Y[h.b]!), h.cat);
            add(v, k, h.d, 0, h.d * PATH_WEIGHT[0]);
        }
    }

    const n = X.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const pcat = new Int8Array(n);
    const heap: [number, number][] = [[0, start]];
    dist[start] = 0;

    const push = (item: [number, number]): void => {
        heap.push(item);
        let i = heap.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p]![0] <= heap[i]![0]) break;
            [heap[p], heap[i]] = [heap[i]!, heap[p]!];
            i = p;
        }
    };

    const pop = (): [number, number] => {
        const top = heap[0]!;
        const last = heap.pop()!;
        if (heap.length) {
            heap[0] = last;
            for (let i = 0; ;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
                if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
                if (m === i) break;
                [heap[m], heap[i]] = [heap[i]!, heap[m]!];
                i = m;
            }
        }
        return top;
    };

    while (heap.length) {
        const [dd, u] = pop();
        if (dd > dist[u]!) continue;
        if (u === end) break;
        const edges = u < g.n ? [...g.adj[u]!, ...(extra.get(u) ?? [])] : (extra.get(u) ?? []);
        for (const e of edges) {
            const cost = dd + (e.w ?? e.d * PATH_WEIGHT[e.cat]);
            if (cost < dist[e.to]!) {
                dist[e.to] = cost;
                prev[e.to] = u;
                pcat[e.to] = e.cat;
                push([cost, e.to]);
            }
        }
    }

    const out: LegPoint[] = [];
    for (let v = end; v >= 0; v = prev[v]!) {
        out.push({ x: X[v]!, y: Y[v]!, cat: pcat[v] as PathCategory });
        if (v === start) break;
    }

    // The temporary vertices go again: the graph is reused for the next leg.
    X.length = base;
    Y.length = base;
    return out.reverse();
};

/**
 * Walking time in minutes, by the formula the Swiss hiking trails use.
 *
 * It is a polynomial in the gradient, so it gets steep descents right too -- they cost time rather
 * than saving it. Outside ±40 % it falls back to a linear estimate.
 */
const HIKE_C = [
    14.271, 3.6991, 2.5922, -1.4384, 0.32105, 0.81542, -0.090261, -0.20757, 0.010192, 0.028588,
    -0.00057466, -0.0021842, 1.5176e-5, 8.6894e-5, -1.3584e-7, -1.4026e-6,
];

export interface ProfilePoint {
    /** Metres from the start. */
    readonly d: number;
    /** Height above sea level, in metres. */
    readonly h: number;
}

export const hikeMinutes = (profile: readonly ProfilePoint[]): number => {
    let minutes = 0;
    for (let i = 1; i < profile.length; i++) {
        const d = profile[i]!.d - profile[i - 1]!.d;
        if (!(d > 0)) continue;
        const s = ((profile[i]!.h - profile[i - 1]!.h) * 10) / d;
        let minPerKm = 0;
        if (s > -4 && s < 4) {
            for (let j = 0; j < HIKE_C.length; j++) minPerKm += HIKE_C[j]! * s ** j;
        } else {
            minPerKm = s > 0 ? 17 * s : -9 * s;
        }
        minutes += (d * minPerKm) / 1000;
    }
    return minutes;
};

/**
 * The same profile walked the other way: the distances start again from the far end.
 *
 * The way back is not the same length of time as the way there -- what was a climb is now a
 * descent -- so the panel gives both.
 */
export const reverseProfile = (profile: readonly ProfilePoint[]): ProfilePoint[] => {
    const total = profile[profile.length - 1]?.d ?? 0;
    return [...profile].reverse().map((p) => ({ d: total - p.d, h: p.h }));
};

/** Ascent and descent along a profile, in metres. */
export const climbOf = (profile: readonly ProfilePoint[]): { up: number; down: number } => {
    let up = 0;
    let down = 0;
    for (let i = 1; i < profile.length; i++) {
        const dh = profile[i]!.h - profile[i - 1]!.h;
        if (dh > 0) up += dh;
        else down -= dh;
    }
    return { up, down };
};

/** How much of a leg runs on each kind of way, in metres. */
export const lengthByCategory = (leg: readonly LegPoint[]): Record<PathCategory, number> => {
    const out: Record<PathCategory, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 1; i < leg.length; i++) {
        const d = Math.hypot(leg[i]!.x - leg[i - 1]!.x, leg[i]!.y - leg[i - 1]!.y);
        out[leg[i]!.cat] += d;
    }
    return out;
};
