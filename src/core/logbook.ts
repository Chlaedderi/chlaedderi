/**
 * The logbook: one entry per ascent or attempt, kept on the device by the triple store.
 *
 * Entries are addressed by **route key** (`<cragId>~<slug>`), not by position, so an entry survives
 * a pack being unloaded and reloaded, and a route list being reordered. An entry whose crag is not
 * loaded right now is simply not shown; it is never dropped.
 */

import { GRADES, type Grade } from "./grades";

/** Onsight, flash, redpoint, top rope, attempt -- in that order, hardest style first. */
export const LOG_STYLES = ["os", "fl", "rp", "tr", "att"] as const;
export type LogStyle = (typeof LOG_STYLES)[number];

export const isLogStyle = (v: unknown): v is LogStyle =>
    typeof v === "string" && (LOG_STYLES as readonly string[]).includes(v);

export interface LogEntry {
    readonly id: string;
    /** Route key, or null for a route that is not in the atlas. */
    readonly k: string | null;
    /** Crag id. */
    readonly s: string;
    /** Route name. */
    readonly n: string;
    /** Grade, as written -- not necessarily one the ladder knows. */
    readonly g: string;
    /** `YYYY-MM-DD`. */
    readonly d: string;
    readonly st: LogStyle;
    /** The viewer's own stars, 1-5, or 0 for none. */
    readonly r: number;
    /** When the entry was written, for ordering two entries of the same day. */
    readonly t: number;
    /** A route the atlas does not have: its name and grade were typed. */
    readonly custom?: boolean;
}

/** An attempt is not a send. */
export const isSend = (e: LogEntry): boolean => e.st !== "att";

/** Onsight first, attempt last. */
export const rankStyle = (st: LogStyle): number => LOG_STYLES.indexOf(st);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read a stored logbook back, dropping whatever is not an entry and clamping every field.
 * Anything that reaches here came off a device and may be any age, so nothing is trusted.
 */
export const cleanLog = (v: unknown): LogEntry[] =>
    (Array.isArray(v) ? v : [])
        .filter(
            (e: unknown): e is Record<string, unknown> =>
                Boolean(e) &&
                typeof e === "object" &&
                typeof (e as LogEntry).id === "string" &&
                typeof (e as LogEntry).s === "string" &&
                ISO_DATE.test(String((e as LogEntry).d ?? "")) &&
                isLogStyle((e as LogEntry).st),
        )
        .map((e) => ({
            id: String(e.id).slice(0, 24),
            k: typeof e.k === "string" ? e.k : null,
            s: String(e.s),
            n: String(e.n ?? "").slice(0, 120),
            g: String(e.g ?? "").slice(0, 14),
            d: String(e.d),
            st: e.st as LogStyle,
            r: typeof e.r === "number" && e.r >= 1 && e.r <= 5 ? Math.round(e.r) : 0,
            // The old code used `+e.t || 0`, so a numeric string counts too.
            t: Number(e.t) || 0,
            ...(e.custom ? { custom: true } : {}),
        }));

export interface LogIndex {
    /** Entries per route key. */
    readonly byRoute: Readonly<Record<string, readonly LogEntry[]>>;
    /** Entries per crag id. */
    readonly byCrag: Readonly<Record<string, readonly LogEntry[]>>;
    /** Route keys with at least one send. This is what the «still open» filter reads. */
    readonly sent: ReadonlySet<string>;
}

export const indexLog = (entries: readonly LogEntry[]): LogIndex => {
    const byRoute: Record<string, LogEntry[]> = Object.create(null) as Record<string, LogEntry[]>;
    const byCrag: Record<string, LogEntry[]> = Object.create(null) as Record<string, LogEntry[]>;
    const sent = new Set<string>();
    for (const e of entries) {
        if (e.k) {
            (byRoute[e.k] ??= []).push(e);
            if (isSend(e)) sent.add(e.k);
        }
        (byCrag[e.s] ??= []).push(e);
    }
    return { byRoute, byCrag, sent };
};

/**
 * The entry that counts as a route's best: the hardest style, and among equal styles the latest.
 */
export const bestEntry = (entries: readonly LogEntry[]): LogEntry | null =>
    entries.reduce<LogEntry | null>((best, e) => {
        if (!best) return e;
        const a = rankStyle(e.st);
        const b = rankStyle(best.st);
        if (a < b) return e;
        if (a === b && e.d > best.d) return e;
        return best;
    }, null);

/**
 * Where an entry sits on the grade ladder: the route's own index when the atlas knows the route,
 * otherwise the hardest grade that can be read out of what was typed (`6a/6b`, `6a, 6b`).
 */
export const entryGradeIdx = (e: LogEntry, routeGradeIdx?: number | null): number | null => {
    if (routeGradeIdx != null) return routeGradeIdx;
    let best: number | null = null;
    for (const part of String(e.g ?? "").split(/[/\s,]+/)) {
        const i = GRADES.indexOf(part.trim() as Grade);
        if (i >= 0 && (best == null || i > best)) best = i;
    }
    return best;
};

export const newLogId = (): string =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const todayIso = (now: Date = new Date()): string =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/** Date, then write order: the reading order of the logbook page and of the CSV. */
export const byDate = (a: LogEntry, b: LogEntry): number =>
    a.d < b.d ? -1 : a.d > b.d ? 1 : a.t - b.t;

export interface CsvColumns {
    readonly date: string;
    readonly route: string;
    readonly grade: string;
    readonly style: string;
    readonly stars: string;
    readonly crag: string;
    readonly area: string;
    readonly region: string;
}

export interface CsvLookup {
    /** The crag's name and area, and the region it came with. */
    readonly crag: (id: string) => { name: string; area: string; region: string } | null;
    readonly styleLabel: (st: LogStyle) => string;
}

/**
 * The logbook as a CSV. Semicolons and CRLF, and a byte-order mark in front, which is what
 * Excel needs to read the accents in Italian and Swiss crag names correctly.
 */
export const csvText = (
    entries: readonly LogEntry[],
    columns: CsvColumns,
    lookup: CsvLookup,
): string => {
    const cell = (v: unknown): string => {
        // Names come out of mappacks, which anybody can publish. A leading `=`, `+`, `-` or `@`
        // would make a spreadsheet run the cell as a formula; a quote in front keeps it text.
        const raw = String(v ?? "");
        const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
        return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: string[][] = [
        [
            columns.date,
            columns.route,
            columns.grade,
            columns.style,
            columns.stars,
            columns.crag,
            columns.area,
            columns.region,
        ],
    ];
    for (const e of [...entries].sort(byDate)) {
        const crag = lookup.crag(e.s);
        rows.push([
            e.d,
            e.n,
            e.g,
            lookup.styleLabel(e.st),
            e.r ? String(e.r) : "",
            crag?.name ?? "",
            crag?.area ?? "",
            crag?.region ?? "",
        ]);
    }
    return `\uFEFF${rows.map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
};

export interface LogStats {
    readonly entries: number;
    readonly sends: number;
    readonly routes: number;
    readonly crags: number;
    readonly days: number;
    /** The hardest sends, hardest first. */
    readonly hardest: readonly LogEntry[];
}

export const logStats = (
    entries: readonly LogEntry[],
    gradeIdxOf: (e: LogEntry) => number | null,
    limit = 5,
): LogStats => {
    const sends = entries.filter(isSend);
    return {
        entries: entries.length,
        sends: sends.length,
        routes: new Set(sends.map((e) => e.k ?? `${e.s}~${e.n}`)).size,
        crags: new Set(entries.map((e) => e.s)).size,
        days: new Set(entries.map((e) => e.d)).size,
        hardest: sends
            .filter((e) => gradeIdxOf(e) != null)
            .sort((a, b) => (gradeIdxOf(b) ?? 0) - (gradeIdxOf(a) ?? 0) || (a.d < b.d ? 1 : -1))
            .slice(0, limit),
    };
};

/**
 * How many ascents stand at each grade -- the «pyramid» on the logbook page.
 *
 * Attempts do not count, and for a multi-pitch route the hardest pitch is the one that counts,
 * which is what `lb.pyr.hint` tells the reader. The result is indexed by the grade ladder, so the
 * caller can label each bar with `GRADES[i]`.
 */
export const gradePyramid = (
    entries: readonly LogEntry[],
    gradeIdxOf: (e: LogEntry) => number | null,
): Map<number, number> => {
    const out = new Map<number, number>();
    for (const entry of entries) {
        if (!isSend(entry)) continue;
        const at = gradeIdxOf(entry);
        if (at == null) continue;
        out.set(at, (out.get(at) ?? 0) + 1);
    }
    return out;
};
