import { describe, expect, it } from "vitest";

import type { Mappack } from "@domain/mappack";

import showcase from "../../../maps/pack.showcase.json";
import testing from "../../../maps/pack.testing.json";

import { mountPacks, toCrag } from "./mount";
import { checkPack } from "./validate";

/*
 * The two packs this repository has: the showcase the build compiles into the app, and the invented
 * region the tests and the e2e suite run on. The real regions are in the private Chlaedderi/maps
 * repository and are checked there, against this same schema -- including the one check that can
 * only be made where they all are, that no crag id turns up in two of them.
 */
const packs = { showcase, testing } as unknown as Record<string, Mappack>;

describe("checkPack against the real mappacks", () => {
    it.each(Object.keys(packs))("accepts maps/pack.%s.json", async (name) => {
        const result = await checkPack(packs[name]);
        if (!result.ok) console.error(name, result.problems);
        expect(result.ok).toBe(true);
    });

    it("says plainly when the JSON is not a mappack at all", async () => {
        expect(await checkPack(null)).toMatchObject({ ok: false });
        expect(await checkPack([1, 2, 3])).toMatchObject({ ok: false });
        expect(await checkPack("a string")).toMatchObject({ ok: false });

        const notAPack = await checkPack({ hello: "world" });
        expect(notAPack.ok).toBe(false);
        if (!notAPack.ok) {
            expect(notAPack.problems).toHaveLength(1);
            expect(notAPack.problems[0]?.where).toBe("/format");
        }
    });

    it("turns a pack from before the rename away, and names both strings", async () => {
        // Renaming the app renamed the format, and `loadStoredPack` re-checks every pack it reads
        // out of the cache -- so each pack installed before the rename lands here on the next
        // start. It has to say which string it got and which it wanted, or the owner of the pack
        // has nothing to go on.
        const result = await checkPack({ ...packs.testing, format: "kletteratlas-mappack" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.problems).toHaveLength(1);
            expect(result.problems[0]?.where).toBe("/format");
            expect(result.problems[0]?.message).toContain("kletteratlas-mappack");
            expect(result.problems[0]?.message).toContain("chlaedderi-mappack");
        }
    });

    it("rejects a pack of a future format version on its own terms", async () => {
        const result = await checkPack({ ...packs.testing, formatVersion: 2 });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.problems[0]?.where).toBe("/formatVersion");
    });

    it("reports the field that is wrong, with its path", async () => {
        const broken = structuredClone(packs.showcase) as Mappack;
        // @ts-expect-error -- deliberately breaking the data
        delete broken.sectors[0].name;
        const result = await checkPack(broken);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.problems.some((p) => p.where === "/sectors/0")).toBe(true);
            expect(result.problems.some((p) => p.message.includes("name"))).toBe(true);
        }
    });

    it("lets a pack carry fields it does not know, so an older app can ignore them", async () => {
        const result = await checkPack({
            ...packs.showcase,
            somethingNewerPacksCarry: { nested: [1, 2, 3] },
        });
        expect(result.ok).toBe(true);
    });
});

describe("mounting the mappacks", () => {
    const mounted = mountPacks([packs.showcase!, packs.testing!]);

    it("mounts every crag of every pack exactly once", () => {
        const expected = packs.showcase!.sectors.length + packs.testing!.sectors.length;
        expect(mounted.crags).toHaveLength(expected);
        expect(Object.keys(mounted.byId)).toHaveLength(expected);
        // The showcase is a part of Finale and carries that region's id.
        expect(mounted.regions.map((r) => r.key)).toEqual(["finale", "testing"]);
    });

    it("agrees with the counts the packs state", () => {
        for (const pack of [packs.showcase!, packs.testing!]) {
            const region = mounted.regions.find((r) => r.key === pack.id);
            expect(region?.n).toBe(pack.counts?.crags);
        }
        const routes = mounted.crags.reduce((n, c) => n + c.routes.length, 0);
        const stated = (packs.showcase!.counts?.routes ?? 0) + (packs.testing!.counts?.routes ?? 0);
        expect(routes).toBe(stated);
    });

    it("gives every route a unique, stable key", () => {
        for (const crag of mounted.crags) {
            const keys = crag.routes.map((r) => r.key);
            expect(new Set(keys).size, `duplicate route key in ${crag.id}`).toBe(keys.length);
            for (const key of keys) expect(key.startsWith(`${crag.id}~`)).toBe(true);
        }
    });

    it("resolves every car park and area group a crag refers to", () => {
        for (const crag of mounted.crags) {
            const region = mounted.regions.find((r) => r.key === crag.packId)!;
            for (const key of [crag.pk, crag.pkOff, ...crag.ap.map((a) => a.pk)]) {
                if (key == null) continue;
                expect(mounted.parks[key], `${crag.id} -> park ${key}`).toBeDefined();
            }
            expect(
                region.areas.some((a) => a.name === crag.area),
                `${crag.id} -> area ${crag.area}`,
            ).toBe(true);
        }
    });

    it("keeps the keys a pack pinned in rk, so logbook entries stay attached", () => {
        const withRk = packs.testing!.sectors.find((s) => s.rk?.some(Boolean));
        expect(withRk, "no pack carries rk").toBeDefined();
        const crag = toCrag(withRk!, "testing");
        withRk!.rk!.forEach((kept, i) => {
            if (kept) expect(crag.routes[i]?.key).toBe(`${withRk!.id}~${kept}`);
        });
    });

    it("derives the fields prepCrag used to assign in place", () => {
        const crag = mounted.byId["rocca-di-perti-placca-piotti"] ?? mounted.crags[0]!;
        expect(crag.hay).toBe(crag.hay.toLowerCase());
        expect(crag.cls).toMatch(/^(easy|mid|hard|unk)$/);
        expect(crag.rhay?.length ?? 0).toBe(crag.routes.length);
        if (crag.orient.length === 0) expect(crag.oriKey).toBe("unknown");
        if (crag.orient.length >= 4) expect(crag.oriKey).toBe("mixed");
    });

    it("does not mutate the stored packs", () => {
        const before = JSON.stringify(packs.showcase!.sectors[0]!.routes[0]);
        mountPacks([packs.showcase!]);
        expect(JSON.stringify(packs.showcase!.sectors[0]!.routes[0])).toBe(before);
    });
});

describe("mounting several packs together", () => {
    it("namespaces car park keys, so two packs may both have a «cornei»", () => {
        // Two packs that each call a car park "shared".
        const a = {
            ...packs.showcase,
            id: "aaa",
            parks: { shared: { name: "Park A", lat: 44.1, lon: 8.3 } },
            sectors: [{ ...packs.showcase!.sectors[0]!, id: "a1", pk: "shared", ap: [] }],
        } as unknown as Mappack;
        const b = {
            ...packs.showcase,
            id: "bbb",
            parks: { shared: { name: "Park B", lat: 46.3, lon: 8.0 } },
            sectors: [{ ...packs.showcase!.sectors[0]!, id: "b1", pk: "shared", ap: [] }],
        } as unknown as Mappack;

        const mountedBoth = mountPacks([a, b]);
        expect(mountedBoth.parks["aaa/shared"]?.name).toBe("Park A");
        expect(mountedBoth.parks["bbb/shared"]?.name).toBe("Park B");
        // And each crag points at its own.
        expect(mountedBoth.byId.a1?.pk).toBe("aaa/shared");
        expect(mountedBoth.byId.b1?.pk).toBe("bbb/shared");
        expect(mountedBoth.parks[mountedBoth.byId.a1!.pk!]?.name).toBe("Park A");
        expect(mountedBoth.parks[mountedBoth.byId.b1!.pk!]?.name).toBe("Park B");
    });

    it("offsets picture indices, because the picSrc lists are joined", () => {
        const withPics = {
            ...packs.testing,
            id: "first",
        } as unknown as Mappack;
        const second = {
            ...packs.testing,
            id: "second",
        } as unknown as Mappack;
        const both = mountPacks([withPics, second]);
        const own = packs.testing!.picSrc!.length;
        expect(both.picSrc).toHaveLength(own * 2);
        expect(both.regions[0]?.picOffset).toBe(0);
        expect(both.regions[1]?.picOffset).toBe(own);

        // Every picture of every crag must land inside the joined list.
        for (const crag of both.crags) {
            for (const pic of crag.pics) {
                expect(pic[3]).toBeGreaterThanOrEqual(0);
                expect(pic[3]).toBeLessThan(both.picSrc.length);
            }
        }
    });

    it("leaves the park keys of a single pack resolvable too", () => {
        const one = mountPacks([packs.testing!]);
        for (const crag of one.crags) {
            for (const key of [crag.pk, crag.pkOff, ...crag.ap.map((a) => a.pk)]) {
                if (key == null) continue;
                expect(one.parks[key], `${crag.id} -> ${key}`).toBeDefined();
                expect(key.startsWith("testing/")).toBe(true);
            }
        }
    });
});
