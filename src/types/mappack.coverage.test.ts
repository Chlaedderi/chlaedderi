import { describe, expect, it } from "vitest";

import schema from "../../mappack.schema.json";

import type {
    Approach,
    Area,
    Block,
    Coord,
    Fact,
    Glossary,
    GlossaryItem,
    Mappack,
    Page,
    PackText,
    Park,
    StoredSector,
} from "./mappack";

/**
 * src/types/mappack.ts mirrors mappack.schema.json by hand, because the schema is JSON Schema
 * 2020-12 and json-schema-to-typescript cannot express its `prefixItems` tuples.
 *
 * This is the guard against the two halves drifting apart. Each list below is checked twice: by
 * TypeScript, through `satisfies`, so a name that is not a real key of the interface fails to
 * compile; and at runtime, against the schema, so a field added to the schema without being added
 * here fails the test. A field removed from the schema fails too.
 */

const topLevel = [
    "format",
    "formatVersion",
    "id",
    "name",
    "version",
    "sectors",
    "fullName",
    "accessed",
    "updated",
    "partial",
    "ch",
    "text",
    "view",
    "bbox",
    "counts",
    "areas",
    "parks",
    "picSrc",
    "labels",
    "outline",
    "stats",
    "de",
    "notes",
] as const satisfies readonly (keyof Mappack)[];

const sector = [
    "id",
    "name",
    "area",
    "routes",
    "locality",
    "full",
    "nr",
    "nrInferred",
    "status",
    "reg",
    "region",
    "municipality",
    "province",
    "coord",
    "coordDropped",
    "alt",
    "gmin",
    "gmax",
    "gminI",
    "gmaxI",
    "nRoutes",
    "nSingle",
    "nMulti",
    "bands",
    "rk",
    "rl",
    "st",
    "ord",
    "secs",
    "rate",
    "style",
    "styleKey",
    "rock",
    "rockDe",
    "orient",
    "len",
    "lenIsMax",
    "lenIsTypical",
    "season",
    "seasonDe",
    "sun",
    "sunWhole",
    "rain",
    "dry",
    "dryHow",
    "dryWhy",
    "dryNote",
    "dryNoteDe",
    "bolt",
    "pk",
    "pkAssumed",
    "pkOff",
    "park",
    "parkDe",
    "walk",
    "walkDe",
    "walkMin",
    "walkEff",
    "walkHow",
    "ap",
    "desc",
    "descDe",
    "warn",
    "warnDe",
    "rnote",
    "rnoteDe",
    "family",
    "pt",
    "guide",
    "confidence",
    "tcOnly",
    "tc",
    "links",
    "pics",
] as const satisfies readonly (keyof StoredSector)[];

const park = [
    "name",
    "nameDe",
    "lat",
    "lon",
    "est",
    "note",
    "noteDe",
    "n",
] as const satisfies readonly (keyof Park)[];

const area = ["name", "n", "tcUrl", "reg"] as const satisfies readonly (keyof Area)[];

const approach = [
    "pk",
    "d",
    "up",
    "down",
    "t",
    "gap",
    "straight",
    "line",
    "q",
    "alt",
] as const satisfies readonly (keyof Approach)[];

const coord = ["lat", "lon", "precision", "added"] as const satisfies readonly (keyof Coord)[];

const packText = [
    "rock",
    "guide",
    "noPics",
    "guideRef",
    "licence",
    "links",
    "pages",
    "facts",
    "glossary",
] as const satisfies readonly (keyof PackText)[];

const page = ["id", "title", "blocks"] as const satisfies readonly (keyof Page)[];
const block = ["h", "p", "hint", "ul"] as const satisfies readonly (keyof Block)[];
const fact = ["group", "en", "de", "src", "url", "go"] as const satisfies readonly (keyof Fact)[];
const glossary = ["title", "hint", "lang", "items"] as const satisfies readonly (keyof Glossary)[];
const glossaryItem = ["term", "en", "de"] as const satisfies readonly (keyof GlossaryItem)[];

type SchemaNode = {
    properties?: Record<string, unknown>;
    required?: string[];
    prefixItems?: unknown[];
    minItems?: number;
    maxItems?: number;
};

const defs = schema.$defs as unknown as Record<string, SchemaNode>;
const keysOf = (node: SchemaNode | undefined): string[] => Object.keys(node?.properties ?? {});

describe("mappack.ts mirrors mappack.schema.json", () => {
    it.each([
        ["the pack itself", schema as unknown as SchemaNode, topLevel],
        ["$defs.sector", defs.sector, sector],
        ["$defs.park", defs.park, park],
        ["$defs.area", defs.area, area],
        ["$defs.approach", defs.approach, approach],
        ["$defs.coord", defs.coord, coord],
        ["$defs.text", defs.text, packText],
        ["$defs.page", defs.page, page],
        ["$defs.block", defs.block, block],
    ])("covers every property of %s", (_what, node, declared) => {
        expect(keysOf(node).sort()).toEqual([...declared].sort());
    });

    it("covers the nested facts and glossary shapes", () => {
        const factsNode = defs.text?.properties?.facts as SchemaNode | undefined;
        const items = factsNode?.properties?.items as { items?: SchemaNode } | undefined;
        expect(keysOf(items?.items).sort()).toEqual([...fact].sort());

        const glossaryNode = defs.text?.properties?.glossary as SchemaNode | undefined;
        expect(keysOf(glossaryNode).sort()).toEqual([...glossary].sort());
        const gItems = glossaryNode?.properties?.items as { items?: SchemaNode } | undefined;
        expect(keysOf(gItems?.items).sort()).toEqual([...glossaryItem].sort());
    });

    it("keeps the tuple arities the types hard-code", () => {
        // StoredRoute is [name, grade, pitches, gradeIdx, ...rest]
        expect(defs.route?.prefixItems).toHaveLength(4);
        expect(defs.route?.minItems).toBe(4);
        expect(defs.route?.maxItems).toBeUndefined();
        // Pic is exactly ten entries
        expect(defs.pic?.prefixItems).toHaveLength(10);
        expect(defs.pic?.minItems).toBe(10);
        expect(defs.pic?.maxItems).toBe(10);
    });

    it("keeps the fields the app insists on required", () => {
        expect(schema.required).toEqual([
            "format",
            "formatVersion",
            "id",
            "name",
            "version",
            "sectors",
        ]);
        expect(defs.sector?.required).toEqual(["id", "name", "area", "routes"]);
    });

    it("stays open to unknown fields, so an older app can ignore what it does not know", () => {
        expect(schema.additionalProperties).toBe(true);
        expect(defs.sector?.["additionalProperties" as keyof SchemaNode]).toBe(true);
    });
});
