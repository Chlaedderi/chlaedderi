/**
 * The Swiss rain radar, from MeteoSwiss' own open data.
 *
 * RainViewer is a worldwide mosaic that stops at zoom 7, and the Italian radar does not reach
 * north of the Alps at all -- so over Switzerland, which is where the region that ships is, the app
 * had a coarse picture or none. MeteoSwiss publishes the real thing: **PRECIP (RZC)**, the rain
 * rate at ground level composed from the five Swiss radars, on a one-kilometre grid, every five
 * minutes, for the last fourteen days. 41 KB a frame, CORS open, free to use with the source named.
 *
 * It arrives as numbers rather than as a picture, which is the whole of the work: `odim.ts` reads
 * the file, `core/rainRamp.ts` colours it and `features/radar/RainGridLayer.ts` paints it.
 *
 * **Finding the frames.** The file names carry a two-letter code for which radars were up (`vl`
 * usually, `tl` when one is down), so they cannot simply be computed -- and the code changes
 * precisely when the weather is bad, which is when somebody is looking. So the catalogue is the
 * truth: one STAC item per UTC day, listing every asset. It is read once and then kept, because
 * frames are immutable and a refresh only needs the one new slot; a name that 404s sends us back
 * to the catalogue rather than into a guessing game.
 */

import { type GridFrames, RadarUnavailable } from "@core/radar";
import { SWISS_RADAR_GRID } from "@core/radarGrid";
import { type DecodeReply, type DecodeRequest, toCells } from "@core/radarWorker";

import { readOdimGrid } from "./odim";

export const METEOSWISS_ATTRIBUTION =
    'Radar: <a href="https://www.meteoswiss.admin.ch/" target="_blank" rel="noopener">MeteoSchweiz</a>';

const COLLECTION = "ch.meteoschweiz.ogd-radar-precip";
const STAC = `https://data.geo.admin.ch/api/stac/v1/collections/${COLLECTION}/items`;
const FILES = `https://data.geo.admin.ch/${COLLECTION}`;

/** Two hours of five-minute frames, the window RainViewer gives and the bar is built around. */
const WINDOW_MS = 2 * 60 * 60 * 1000;
const STEP_MS = 5 * 60 * 1000;
export const MAX_FRAMES = WINDOW_MS / STEP_MS;

/** `rzc` + two-digit year + day of year + HHMM + the radar-availability code. */
const NAME = /^rzc(\d{2})(\d{3})(\d{2})(\d{2})[a-z]{2}\.001\.h5$/;

interface StacItem {
    assets?: Record<string, unknown>;
}

const dayId = (at: number): string => {
    const d = new Date(at);
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${d.getUTCFullYear()}${month}${String(d.getUTCDate()).padStart(2, "0")}`;
};

/** The time a frame's own name says it covers, in ms, or null if the name is not one of ours. */
export const frameTime = (name: string): number | null => {
    const parts = NAME.exec(name);
    if (!parts) return null;
    const [, yy, doy, hh, mm] = parts;
    const year = 2000 + Number(yy);
    const day = Number(doy);
    if (day < 1 || day > 366) return null;
    return (
        Date.UTC(year, 0, 1) + (day - 1) * 86_400_000 + Number(hh) * 3_600_000 + Number(mm) * 60_000
    );
};

/** One day's frame names, newest last. Cached: a day's catalogue only grows at the end. */
const catalogue = new Map<string, { at: number; names: string[] }>();
/** Decoded frames by file name. Bounded -- a two-hour window plus a little slack. */
const decoded = new Map<string, Uint8Array>();

/** Throw away everything held: the radar is off, or the region is no longer Swiss. */
export const forgetChFrames = (): void => {
    catalogue.clear();
    decoded.clear();
};

/**
 * How long today's catalogue is trusted before it is read again.
 *
 * Long, on purpose: the names of the frames that follow are worked out from the last one rather
 * than looked up, so the catalogue is only read when that stops working. Reading it every refresh
 * would cost up to 290 KB every five minutes on somebody's phone at a crag, for one new file name.
 */
const DAY_TTL_MS = 30 * 60 * 1000;

const listDay = async (day: string, signal?: AbortSignal, force = false): Promise<string[]> => {
    const held = catalogue.get(day);
    // A past day never changes; today's grows a frame every five minutes.
    if (held && !force && (day !== dayId(Date.now()) || Date.now() - held.at < DAY_TTL_MS)) {
        return held.names;
    }

    const response = await fetch(`${STAC}/${day}-ch`, {
        cache: "no-store",
        ...(signal ? { signal } : {}),
    });
    // A day with nothing published is not a failure: just after midnight UTC there is no item yet.
    if (response.status === 404) {
        catalogue.set(day, { at: Date.now(), names: [] });
        return [];
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const item = (await response.json()) as StacItem;
    const names = Object.keys(item.assets ?? {})
        .filter((name) => frameTime(name) !== null)
        .sort();
    catalogue.set(day, { at: Date.now(), names });
    return names;
};

const decode = async (name: string, signal?: AbortSignal): Promise<Uint8Array> => {
    const held = decoded.get(name);
    if (held) return held;

    const day = name.slice(3, 8);
    const response = await fetch(`${FILES}/${dayOf(day)}-ch/${name}`, signal ? { signal } : {});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const cells = await decodeFrame(await response.arrayBuffer());

    decoded.set(name, cells);
    // Keep a little more than the window; the oldest insertion goes first.
    while (decoded.size > MAX_FRAMES + 6) {
        const oldest = decoded.keys().next().value;
        if (oldest === undefined) break;
        decoded.delete(oldest);
    }
    return cells;
};

/** `262 86` -- the year and day-of-year out of a file name -- back into a calendar day. */
const dayOf = (yyddd: string): string =>
    dayId(
        Date.UTC(2000 + Number(yyddd.slice(0, 2)), 0, 1) +
            (Number(yyddd.slice(2)) - 1) * 86_400_000,
    );

/**
 * The last two hours of Swiss radar, oldest first.
 *
 * Frames are fetched newest-first so that the picture somebody is actually waiting for -- what it
 * is doing *now* -- is there first, and the tail of the loop fills in behind it.
 */
/** The two letters in a frame's name that say which radars were up when it was made. */
const codeOf = (name: string): string => name.slice(12, 14);

/** The name a frame covering `at` would have, if the same radars are still up. */
const nameAt = (at: number, code: string): string => {
    const d = new Date(at);
    const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
    const doy = Math.floor((at - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `rzc${yy}${String(doy).padStart(3, "0")}${hh}${mm}${code}.001.h5`;
};

/**
 * The frames to ask for: what the catalogue lists, and beyond its newest entry, the names the
 * next frames *would* have.
 *
 * Guessing is only ever forward from something real, and a guess that turns out wrong sends us
 * back to the catalogue -- so the file names are never invented out of nothing, and a radar going
 * out of service (which changes the code, and happens exactly when the weather is bad) costs one
 * extra request rather than a frozen radar.
 */
const slots = (
    names: readonly string[],
    now: number,
): { name: string; at: number; sure: boolean }[] => {
    const known = names
        .map((name) => ({ name, at: frameTime(name)!, sure: true }))
        .filter(({ at }) => at > now - WINDOW_MS && at <= now + STEP_MS)
        .sort((a, b) => a.at - b.at);

    const newest = known.at(-1);
    if (!newest) return [];

    const code = codeOf(newest.name);
    const latest = Math.floor(now / STEP_MS) * STEP_MS;
    const guessed: { name: string; at: number; sure: boolean }[] = [];
    for (let at = newest.at + STEP_MS; at <= latest; at += STEP_MS) {
        guessed.push({ name: nameAt(at, code), at, sure: false });
    }
    return [...known, ...guessed].slice(-MAX_FRAMES);
};

export const fetchChFrames = async (
    signal?: AbortSignal,
    onPartial?: (frames: GridFrames) => void,
): Promise<GridFrames> => {
    const now = Date.now();
    const days = [dayId(now - WINDOW_MS), dayId(now)].filter((d, i, all) => all.indexOf(d) === i);

    const list = async (force: boolean): Promise<string[]> => {
        const names: string[] = [];
        for (const day of days) names.push(...(await listDay(day, signal, force)));
        return names;
    };

    let wanted = slots(await list(false), now);
    if (!wanted.length) {
        // Nothing in the window: either the catalogue is stale or there is genuinely nothing.
        wanted = slots(await list(true), now);
        if (!wanted.length) throw new RadarUnavailable("no frames published");
    }

    const cells: Uint8Array[] = [];
    const times: number[] = [];
    /** A guess that was wrong for a frame old enough to exist: the names have moved on. */
    let stale = false;

    for (const { name, at, sure } of [...wanted].reverse()) {
        if (signal?.aborted) break;
        try {
            const frame = await decode(name, signal);
            cells.unshift(frame);
            times.unshift(at);
        } catch (problem) {
            // A file that is not a frame at all is fatal: nothing here will ever draw it. A
            // missing one is a gap in the loop -- and if it was a guess, the names have changed.
            if (problem instanceof RadarUnavailable) throw problem;
            // The newest slot or two may simply not be published yet; that is not staleness.
            if (!sure && at < now - 2 * STEP_MS) stale = true;
            continue;
        }
        onPartial?.({
            kind: "grids",
            grid: SWISS_RADAR_GRID,
            cells: [...cells],
            times: [...times],
        });
    }

    if (stale && !signal?.aborted) {
        // Read the catalogue again rather than guessing on, and take whatever it really lists.
        for (const { name, at } of slots(await list(true), now)) {
            if (times.includes(at)) continue;
            try {
                const frame = await decode(name, signal);
                const where = times.findIndex((t) => t > at);
                const slot = where < 0 ? times.length : where;
                cells.splice(slot, 0, frame);
                times.splice(slot, 0, at);
            } catch {
                continue;
            }
        }
    }

    if (!cells.length) throw new RadarUnavailable("no frame could be read");
    return { kind: "grids", grid: SWISS_RADAR_GRID, cells, times };
};

/**
 * One frame's bytes to one frame's ramp indices, in a worker where there is one.
 *
 * The worker is built on first use and kept: twenty-four frames would otherwise build twenty-four
 * of them. Anything that goes wrong with the worker itself -- blocked, failed to construct, failed
 * to start -- falls back to decoding here, slowly but correctly.
 */
const decodeFrame = async (file: ArrayBuffer): Promise<Uint8Array> => {
    const worker = pool();
    if (!worker) {
        const { values, nx, ny } = await readOdimGrid(file);
        check(nx, ny);
        return toCells(values);
    }

    const id = ++ticket;
    return new Promise<Uint8Array>((resolve, reject) => {
        const done = (event: MessageEvent<DecodeReply>): void => {
            if (event.data.id !== id) return;
            worker.removeEventListener("message", done);
            const { cells, nx, ny, error } = event.data;
            if (!cells || nx === undefined || ny === undefined) {
                reject(new RadarUnavailable(error ?? "unreadable"));
                return;
            }
            try {
                check(nx, ny);
            } catch (problem) {
                reject(problem instanceof Error ? problem : new RadarUnavailable("grid"));
                return;
            }
            resolve(cells);
        };
        worker.addEventListener("message", done);
        const request: DecodeRequest = { id, file };
        worker.postMessage(request, [file]);
    });
};

/**
 * The grid has to be the one the map is drawn against.
 *
 * If MeteoSwiss ever publishes a different composite under the same name, a reader that shrugged
 * would paint rain in the wrong country rather than fall back -- so this is the one place where
 * being wrong is not allowed to be quiet.
 */
const check = (nx: number, ny: number): void => {
    if (nx !== SWISS_RADAR_GRID.nx || ny !== SWISS_RADAR_GRID.ny) {
        throw new RadarUnavailable(`the grid is ${nx}x${ny}, not the Swiss composite`);
    }
};

let ticket = 0;
let worker: Worker | null = null;
let workerTried = false;

const pool = (): Worker | null => {
    if (workerTried) return worker;
    workerTried = true;
    if (typeof Worker === "undefined") return null;
    try {
        // A relative path on purpose: this is the literal Vite resolves at build time, and an
        // alias is not one it can see. `base: "./"` keeps the emitted URL right under /pr-N/ too.
        worker = new Worker(new URL("../core/radarDecode.worker.ts", import.meta.url), {
            type: "module",
        });
    } catch {
        worker = null;
    }
    return worker;
};
