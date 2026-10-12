/**
 * Small user data -- favourites, logbook, settings -- kept in three independent browser stores:
 *
 *   1. localStorage, item `<ns>:<key>`
 *   2. IndexedDB `<ns>`, object store `kv`
 *   3. Cache Storage `<ns>-user`
 *
 * Every layer holds a record `{ v, t, rev }`. The newest wins (highest `t`, then highest `rev`) and
 * repairs older or missing copies. Values are never merged, so a deletion stays deleted. Nothing in
 * here throws or waits for ever: a layer that fails or does not answer in time is simply left out.
 *
 * A faithful port of the `FinaleStore` of the hand-written app. **The names are load-bearing**: the
 * namespace stays `finale-atlas` and the cache stays `finale-atlas-user`, because renaming either
 * would hide the favourites and the logbook that are already on people's devices. The app is called
 * Chlädderi; the storage keeps its former working name on purpose.
 *
 * Note for the service worker: a cleanup that drops old caches must leave `<ns>-user` alone.
 */

import { PREVIEW_SUFFIX } from "./preview";

/** How long an IndexedDB or Cache operation may take before its layer counts as silent. */
const TIMEOUT = 1500;

export interface StoreRecord<T = unknown> {
    readonly v: T;
    /** Milliseconds since the epoch. */
    readonly t: number;
    /** Counter, to order two writes inside the same millisecond. */
    readonly rev: number;
}

export type LayerName = "ls" | "idb" | "cache";

export interface SetResult {
    /** At least one layer took the write. */
    ok: boolean;
    /** A layer was read back and really holds it. */
    verified: boolean;
    layers: Record<LayerName, boolean>;
    t: number;
}

export interface StoreStatus {
    layers: Record<LayerName, boolean>;
    /** `navigator.storage.persisted()`, or null when unknown. */
    persisted: boolean | null;
    last: Record<string, SetResult>;
    /** One of the two layers that survive a cleared localStorage is working. */
    durable: boolean;
}

export interface Store {
    readonly ready: Promise<StoreStatus>;
    get<T = unknown>(key: string): Promise<T | null>;
    set<T = unknown>(key: string, value: T): Promise<SetResult>;
    status(): StoreStatus;
    subscribe(fn: (key: string, value: unknown) => void): void;
    persist(): Promise<boolean | null>;
}

/** A clean copy of a stored record, or null for anything that is not one. */
export const asRecord = <T = unknown>(x: unknown): StoreRecord<T> | null => {
    try {
        const parsed: unknown = JSON.parse(typeof x === "string" ? x : JSON.stringify(x));
        if (!parsed || typeof parsed !== "object") return null;
        const rec = parsed as StoreRecord<T>;
        return Number.isFinite(rec.t) && Number.isFinite(rec.rev) ? rec : null;
    } catch {
        return null;
    }
};

/**
 * Greater than 0 when `a` is newer than `b`: highest `t`, then highest `rev`. Records with equal
 * stamps but different content are ordered by their text, so that every tab and every layer settles
 * on the same one. 0 means the records are identical.
 */
export const order = (a: StoreRecord, b: StoreRecord): number => {
    if (a.t !== b.t || a.rev !== b.rev) return a.t - b.t || a.rev - b.rev;
    const x = JSON.stringify(a.v) ?? "";
    const y = JSON.stringify(b.v) ?? "";
    return x === y ? 0 : x > y ? 1 : -1;
};

export const newest = (list: readonly (StoreRecord | null | undefined)[]): StoreRecord | null =>
    list.reduce<StoreRecord | null>(
        (best, rec) => (rec && (!best || order(rec, best) > 0) ? rec : best),
        null,
    );

const copy = <T>(v: T): T | null => (v === undefined ? null : (JSON.parse(JSON.stringify(v)) as T));

const stores: Record<string, Store> = Object.create(null) as Record<string, Store>;

const create = (ns: string): Store => {
    /** key -> newest record this page knows. */
    const mem: Record<string, StoreRecord> = Object.create(null) as Record<string, StoreRecord>;
    /** key -> result of the last set(). */
    const last: Record<string, SetResult> = Object.create(null) as Record<string, SetResult>;
    const avail: Record<LayerName, boolean> = { ls: false, idb: false, cache: false };
    const subs: ((key: string, value: unknown) => void)[] = [];
    const cacheName = `${ns}-user`;
    const url = (key: string): string => `./__store/${encodeURIComponent(key)}.json`;

    let persisted: boolean | null = null;
    let dbp: Promise<IDBDatabase> | null = null;
    let channel: BroadcastChannel | null = null;

    /**
     * Run one layer operation: never rejects, and answers `fallback` after TIMEOUT. A layer that
     * does not answer in time counts as unavailable -- until it does answer after all.
     */
    const limit = <T>(
        name: LayerName | null,
        work: () => T | Promise<T>,
        fallback: T,
    ): Promise<T> =>
        new Promise<T>((resolve) => {
            const timer = setTimeout(() => {
                if (name) avail[name] = false;
                resolve(fallback);
            }, TIMEOUT);
            void (async () => work())().then(
                (x) => {
                    clearTimeout(timer);
                    if (name) avail[name] = true;
                    resolve(x);
                },
                () => {
                    clearTimeout(timer);
                    resolve(fallback);
                },
            );
        });

    // ---- Layer 1, localStorage: synchronous, so it is written before anything can interrupt.
    const ls = {
        get: (key: string): StoreRecord | null => {
            try {
                return asRecord(localStorage.getItem(`${ns}:${key}`));
            } catch {
                return null;
            }
        },
        /** Never replaces a newer record, which another tab may have written. */
        put: (key: string, rec: StoreRecord): boolean => {
            try {
                const cur = ls.get(key);
                if (cur && order(cur, rec) > 0) return false;
                localStorage.setItem(`${ns}:${key}`, JSON.stringify(rec));
                return true;
            } catch {
                return false;
            }
        },
    };

    // ---- Layer 2, IndexedDB: one shared connection, reopened when it was closed or has died.
    const openDb = (): Promise<IDBDatabase> => {
        if (dbp) return dbp;
        const mine = (dbp = new Promise<IDBDatabase>((resolve, reject) => {
            // No version: a new database starts at 1 and gets its object store.
            const rq = indexedDB.open(ns);
            rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
            rq.onerror = (e) => {
                e.preventDefault();
                reject(rq.error);
            };
            rq.onsuccess = () => {
                const db = rq.result;
                // Step aside when the database is deleted or closed under us.
                db.onversionchange = db.onclose = () => {
                    db.close();
                    if (dbp === mine) dbp = null;
                };
                resolve(db);
            };
        }));
        mine.catch(() => {
            if (dbp === mine) dbp = null;
        });
        return mine;
    };

    /** Forget a connection (by default the current one) and close it. */
    const dropDb = (conn?: Promise<IDBDatabase> | null): void => {
        const target = conn ?? dbp;
        if (dbp === target) dbp = null;
        target?.then(
            (db) => db.close(),
            () => {},
        );
    };

    /** One transaction on `kv`; resolves when it has completed. */
    const tx = <T>(
        mode: IDBTransactionMode,
        work: (
            store: IDBObjectStore,
            t: IDBTransaction,
            fail: (e: unknown) => void,
        ) => IDBRequest<T> | void,
        retried = false,
    ): Promise<T | undefined> => {
        const conn = openDb();
        return conn
            .then(
                (db) =>
                    new Promise<T | undefined>((resolve, reject) => {
                        const t = db.transaction("kv", mode, { durability: "strict" });
                        const rq = work(t.objectStore("kv"), t, reject);
                        t.oncomplete = () => resolve(rq ? rq.result : undefined);
                        t.onabort = () => reject(t.error);
                        // Handled, so that it does not reach window.onerror (Firefox).
                        t.onerror = (e) => {
                            e.preventDefault();
                            reject((e.target as IDBRequest | null)?.error);
                        };
                    }),
            )
            .catch((err: unknown) => {
                // iOS can drop the connection while the app sleeps: reopen once.
                if (retried) throw err;
                dropDb(conn);
                return tx(mode, work, true);
            });
    };

    const idb = {
        get: (key: string): Promise<StoreRecord | null> =>
            tx<unknown>("readonly", (os) => os.get(key) as IDBRequest<unknown>).then(asRecord),
        put: (key: string, rec: StoreRecord, guarded?: boolean): Promise<boolean> =>
            tx<void>("readwrite", (os, t, fail) => {
                // Commit at once: the write must not depend on another round trip to a page that
                // may already be gone.
                const write = (): void => {
                    os.put(rec, key);
                    t.commit?.();
                };
                if (!guarded) return write();
                const read = os.get(key) as IDBRequest<unknown>;
                read.onsuccess = (e) => {
                    // A repair must not replace a newer record.
                    const cur = asRecord((e.target as IDBRequest<unknown>).result);
                    try {
                        if (!cur || order(rec, cur) > 0) write();
                    } catch (err) {
                        fail(err);
                    }
                };
            }).then(() => true),
    };

    // ---- Layer 3, Cache Storage: survives even when the other two were emptied.
    const cache = {
        get: (key: string): Promise<StoreRecord | null> =>
            caches
                .open(cacheName)
                .then((c) => c.match(url(key)))
                .then((hit) => (hit ? hit.text() : null))
                .then(asRecord),
        put: (key: string, rec: StoreRecord, guarded?: boolean): Promise<boolean> =>
            (guarded ? cache.get(key) : Promise.resolve(null)).then((cur) => {
                if (cur && order(cur, rec) >= 0) return true;
                const body = new Response(JSON.stringify(rec), {
                    headers: { "Content-Type": "application/json" },
                });
                return caches
                    .open(cacheName)
                    .then((c) => c.put(url(key), body))
                    .then(() => true);
            }),
    };

    const openCache = (): Promise<CacheStorage | Cache> =>
        window.isSecureContext && window.caches
            ? caches.open(cacheName)
            : Promise.reject(new Error("no Cache Storage"));

    const layer = { idb, cache };
    const probed: Record<"idb" | "cache", Promise<unknown>> = {
        idb: Promise.resolve(),
        cache: Promise.resolve(),
    };

    /** get/put on an asynchronous layer; an unavailable layer answers null/false at once. */
    const ask = <T>(
        name: "idb" | "cache",
        op: "get" | "put",
        key: string,
        rec?: StoreRecord,
        guarded?: boolean,
    ): Promise<T> => {
        const fallback = (op === "get" ? null : false) as T;
        return probed[name].then(() =>
            avail[name]
                ? limit(
                      name,
                      () =>
                          (op === "get"
                              ? layer[name].get(key)
                              : layer[name].put(key, rec!, guarded)) as unknown as T,
                      fallback,
                  )
                : fallback,
        );
    };

    /** The record each layer holds right now. */
    const readAll = (key: string): Promise<Record<LayerName, StoreRecord | null>> =>
        Promise.all([
            ask<StoreRecord | null>("idb", "get", key),
            ask<StoreRecord | null>("cache", "get", key),
        ]).then(([fromIdb, fromCache]) => ({
            ls: ls.get(key),
            idb: fromIdb,
            cache: fromCache,
        }));

    const get = <T>(key: string): Promise<T | null> =>
        readAll(key).then((found) => {
            const best = newest([mem[key], found.ls, found.idb, found.cache]);
            if (!best) return null;
            mem[key] = best;
            // Heal empty and older copies in the background.
            for (const name of ["ls", "idb", "cache"] as const) {
                const held = found[name];
                if (held && order(best, held) === 0) continue;
                if (name === "ls") ls.put(key, best);
                else void ask(name, "put", key, best, true);
            }
            return copy(best.v) as T | null;
        });

    const set = <T>(key: string, value: T): Promise<SetResult> => {
        const res: SetResult = (last[key] = {
            ok: false,
            verified: false,
            layers: { ls: false, idb: false, cache: false },
            t: 0,
        });
        const prev = newest([mem[key], ls.get(key)]) ?? { t: 0, rev: 0, v: null };
        const rec = asRecord({ v: value, t: Math.max(Date.now(), prev.t + 1), rev: prev.rev + 1 });
        // The value is not JSON-serialisable.
        if (!rec) return Promise.resolve(res);

        mem[key] = rec;
        res.t = rec.t;
        // The synchronous part, done before set() returns.
        res.ok = res.layers.ls = ls.put(key, rec);
        try {
            channel?.postMessage({ key, rec });
        } catch {
            /* other tabs still get the "storage" event */
        }

        return Promise.all([
            ask<boolean>("idb", "put", key, rec),
            ask<boolean>("cache", "put", key, rec),
        ])
            .then(([tookIdb, tookCache]) => {
                res.layers.idb = tookIdb;
                res.layers.cache = tookCache;
                res.ok = res.layers.ls || tookIdb || tookCache;
                // Read back what the layers really hold.
                return readAll(key);
            })
            .then((found) => {
                res.verified = (["ls", "idb", "cache"] as const).some((n) => {
                    const held = found[n];
                    return res.layers[n] && !!held && order(held, rec) === 0;
                });
                return res;
            });
    };

    /**
     * Leaving (app switched away, tab closed): push every record out once more. Repairs are
     * guarded, so a tab with an old copy in memory cannot undo what another tab wrote. A write of
     * this page that IndexedDB has not confirmed, and that localStorage still shows as the newest,
     * goes out unguarded, as it did in set().
     */
    const flush = (): void => {
        for (const key of Object.keys(mem)) {
            const rec = mem[key];
            if (!rec) continue;
            const res = last[key];
            const mine = ls.put(key, rec) && res?.t === rec.t && !res.layers.idb;
            void ask("idb", "put", key, rec, !mine);
        }
    };

    /**
     * Back in the foreground: a layer that went silent (iOS can cut off a sleeping app) is probed
     * again, IndexedDB on a fresh connection. Nothing waits for this.
     */
    const revive = (): void => {
        if (!avail.idb) {
            dropDb();
            void limit("idb", openDb, undefined as unknown as IDBDatabase);
        }
        if (!avail.cache) void limit("cache", openCache, undefined as unknown as Cache);
    };

    /** A record another tab or window wrote. */
    const incoming = (key: string, rec: StoreRecord | null): void => {
        const held = mem[key];
        if (!rec || (held && order(rec, held) <= 0)) return;
        mem[key] = rec;
        for (const fn of subs) {
            try {
                fn(key, copy(rec.v));
            } catch {
                /* a subscriber must not break us */
            }
        }
    };

    const subscribe = (fn: (key: string, value: unknown) => void): void => {
        subs.push(fn);
    };

    /** true | false | null (not supported, or no answer in time). */
    const persist = (): Promise<boolean | null> =>
        limit(null, () => navigator.storage.persist().then((p) => (persisted = Boolean(p))), null);

    const status = (): StoreStatus => ({
        layers: { ...avail },
        persisted,
        last: { ...last },
        durable: avail.idb || avail.cache,
    });

    // ---- Probe the layers once; `ready` settles whatever happens.
    try {
        localStorage.setItem(`${ns}:__probe`, "1");
        localStorage.removeItem(`${ns}:__probe`);
        avail.ls = true;
    } catch {
        /* blocked or full: the other layers carry on */
    }
    probed.idb = limit("idb", openDb, undefined as unknown as IDBDatabase);
    probed.cache = limit("cache", openCache, undefined as unknown as Cache);
    const ready = Promise.all([
        probed.idb,
        probed.cache,
        limit(
            null,
            () =>
                navigator.storage.persisted().then((p) => {
                    persisted = Boolean(p);
                }),
            undefined,
        ),
    ]).then(status);

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
        else void ready.then(revive);
    });
    window.addEventListener("storage", (e) => {
        const prefix = `${ns}:`;
        if (e.key?.startsWith(prefix)) {
            incoming(e.key.slice(prefix.length), asRecord(e.newValue));
        }
    });
    try {
        // Also reaches other tabs when localStorage is blocked.
        channel = new BroadcastChannel(ns);
        channel.onmessage = (e: MessageEvent<{ key: string; rec: unknown } | null>) => {
            if (e.data) incoming(e.data.key, asRecord(e.data.rec));
        };
    } catch {
        /* Safari before 15.4: the "storage" event alone */
    }

    return { ready, get, set, status, subscribe, persist };
};

/**
 * The namespace the app has always used. Renaming it would hide everyone's saved data -- which is
 * exactly why a pull request preview, which shares the host with the app, adds a suffix of its own
 * instead of writing into this one. See preview.ts; on every other page the suffix is empty.
 */
export const DEFAULT_NAMESPACE = `finale-atlas${PREVIEW_SUFFIX}`;

export const openStore = (ns: string = DEFAULT_NAMESPACE): Store =>
    stores[ns] ?? (stores[ns] = create(ns));

// ---- Transfer code: "FA<n>." + base64url(UTF-8 JSON). Used to carry favourites and the logbook
// between Safari and the home-screen app on iOS, which do not share storage -- and, once, between
// one address of the app and another, which is a thing browsers consider two different computers.
//
// FA1 carries `{ fav, log }`. FA2 adds `prefs`, which is where the list of installed regions and
// the addresses they came from lives: without it "install your regions again" means copying
// addresses out of a chat by hand. FA1 keeps being read, for ever -- codes are kept in notes apps
// and pasted a year later.

/** The payload versions this app can write and read. */
export type TransferVersion = 1 | 2;

export const encodeTransfer = (obj: unknown, version: TransferVersion = 1): string => {
    try {
        if (!obj || typeof obj !== "object") return "";
        const bytes = new TextEncoder().encode(JSON.stringify(obj));
        let bin = "";
        for (const byte of bytes) bin += String.fromCharCode(byte);
        const body = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        return `FA${String(version)}.${body}`;
    } catch {
        return "";
    }
};

/** The object, or null for anything invalid, incomplete, or of a version this app cannot read. */
export const decodeTransfer = (code: string): unknown => {
    try {
        const m = /^FA([12])\.([A-Za-z0-9_-]+)$/.exec(String(code).replace(/\s+/g, ""));
        if (!m?.[2]) return null;
        const bin = atob(m[2].replace(/-/g, "+").replace(/_/g, "/"));
        const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
        const obj: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        return obj && typeof obj === "object" ? obj : null;
    } catch {
        return null;
    }
};
