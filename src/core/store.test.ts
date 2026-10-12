import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    asRecord,
    decodeTransfer,
    encodeTransfer,
    newest,
    openStore,
    order,
    type StoreRecord,
} from "./store";

const rec = (v: unknown, t: number, revision: number): StoreRecord => ({ v, t, rev: revision });

describe("asRecord", () => {
    it("accepts a record and refuses anything else", () => {
        expect(asRecord('{"v":1,"t":5,"rev":2}')).toEqual({ v: 1, t: 5, rev: 2 });
        expect(asRecord({ v: null, t: 0, rev: 0 })).toEqual({ v: null, t: 0, rev: 0 });
        expect(asRecord("not json")).toBeNull();
        expect(asRecord(null)).toBeNull();
        expect(asRecord('{"v":1}')).toBeNull();
        expect(asRecord('{"v":1,"t":"x","rev":0}')).toBeNull();
        expect(asRecord('{"v":1,"t":null,"rev":1}')).toBeNull();
    });
});

describe("order", () => {
    it("prefers the newer timestamp, then the higher revision", () => {
        expect(order(rec("a", 2, 0), rec("a", 1, 9))).toBeGreaterThan(0);
        expect(order(rec("a", 1, 2), rec("a", 1, 1))).toBeGreaterThan(0);
        expect(order(rec("a", 1, 1), rec("a", 1, 2))).toBeLessThan(0);
    });

    it("calls identical records identical", () => {
        expect(order(rec({ x: 1 }, 7, 3), rec({ x: 1 }, 7, 3))).toBe(0);
    });

    it("breaks a tie by content, so every tab and layer settles on the same record", () => {
        // Same stamp, different value: the order must be total and stable, never 0.
        const a = rec("aaa", 5, 1);
        const b = rec("bbb", 5, 1);
        expect(order(a, b)).toBeLessThan(0);
        expect(order(b, a)).toBeGreaterThan(0);
        expect(order(a, b) + order(b, a)).toBe(0);
    });
});

describe("newest", () => {
    it("picks the newest and ignores the gaps", () => {
        expect(newest([null, rec("a", 1, 1), undefined, rec("b", 3, 1), rec("c", 2, 9)])).toEqual(
            rec("b", 3, 1),
        );
        expect(newest([])).toBeNull();
        expect(newest([null, undefined])).toBeNull();
    });
});

describe("the transfer code", () => {
    it("round-trips favourites and a logbook", () => {
        const data = {
            fav: { c: ["rocca-di-perti"], r: ["monte-cucco~cordon-bleu"] },
            log: [{ id: "a1", route: "x~y", date: "2026-10-01", style: "rp", stars: 3 }],
        };
        const code = encodeTransfer(data);
        expect(code.startsWith("FA1.")).toBe(true);
        expect(decodeTransfer(code)).toEqual(data);
    });

    it("survives non-ASCII, which Swiss and Italian crag names are full of", () => {
        const data = { names: ["Gorge de l'Hérault", "È vietato", "Zeneggen – Törbel", "ß"] };
        expect(decodeTransfer(encodeTransfer(data))).toEqual(data);
    });

    it("tolerates whitespace, because the code is pasted by hand", () => {
        const code = encodeTransfer({ a: 1 });
        const spaced = `${code.slice(0, 8)}\n  ${code.slice(8)} `;
        expect(decodeTransfer(spaced)).toEqual({ a: 1 });
    });

    it("refuses anything that is not a code", () => {
        expect(decodeTransfer("")).toBeNull();
        expect(decodeTransfer("FA1.")).toBeNull();
        expect(decodeTransfer("FA2.abc")).toBeNull();
        expect(decodeTransfer("FA1.!!!not-base64!!!")).toBeNull();
        expect(decodeTransfer("FA1.YQ")).toBeNull(); // valid base64, but "a" is not an object
        expect(encodeTransfer("a string")).toBe("");
        expect(encodeTransfer(null)).toBe("");
    });
});

describe("a store over the real browser layers", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("writes through localStorage synchronously and reads back", async () => {
        const store = openStore("test-sync");
        const result = await store.set("fav", { c: ["a"], r: [] });
        expect(result.ok).toBe(true);
        expect(result.layers.ls).toBe(true);
        expect(await store.get("fav")).toEqual({ c: ["a"], r: [] });
    });

    it("keeps the item name <ns>:<key>, which existing installs depend on", async () => {
        const store = openStore("finale-atlas-probe");
        await store.set("prefs", { lang: "de" });
        const raw = localStorage.getItem("finale-atlas-probe:prefs");
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw!)).toMatchObject({ v: { lang: "de" } });
    });

    it("hands back a copy, so a caller cannot mutate what the store holds", async () => {
        const store = openStore("test-copy");
        await store.set("x", { list: [1, 2] });
        const first = (await store.get<{ list: number[] }>("x"))!;
        first.list.push(3);
        expect((await store.get<{ list: number[] }>("x"))!.list).toEqual([1, 2]);
    });

    it("lets a later write win and a deletion stay deleted", async () => {
        const store = openStore("test-order");
        await store.set("fav", { c: ["a", "b"], r: [] });
        await store.set("fav", { c: [], r: [] });
        expect(await store.get("fav")).toEqual({ c: [], r: [] });
    });

    it("never throws when a value cannot be serialised", async () => {
        const store = openStore("test-cycle");
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        const result = await store.set("bad", cyclic);
        expect(result.ok).toBe(false);
    });

    it("survives a localStorage that refuses to write", async () => {
        const store = openStore("test-blocked");
        const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("QuotaExceededError");
        });
        try {
            const result = await store.set("fav", { c: ["a"], r: [] });
            expect(result.layers.ls).toBe(false);
            // It must not throw; whether another layer took it depends on the environment.
            expect(typeof result.ok).toBe("boolean");
        } finally {
            spy.mockRestore();
        }
    });

    it("tells the caller which layers it has", async () => {
        const store = openStore("test-status");
        const status = await store.ready;
        expect(status.layers).toHaveProperty("ls");
        expect(status.layers).toHaveProperty("idb");
        expect(status.layers).toHaveProperty("cache");
        expect(typeof status.durable).toBe("boolean");
    });

    it("hands the same store back for the same namespace", () => {
        expect(openStore("test-same")).toBe(openStore("test-same"));
        expect(openStore("test-a")).not.toBe(openStore("test-b"));
    });
});
