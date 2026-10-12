import { describe, expect, it } from "vitest";

import {
    cleanFavourites,
    emptyFavourites,
    favouriteCount,
    toStoredFavourites,
    toggleCrag,
    toggleRoute,
} from "./favourites";

describe("favourites", () => {
    it("start empty", () => {
        const f = emptyFavourites();
        expect(f.c.size).toBe(0);
        expect(f.r.size).toBe(0);
        expect(favouriteCount(f)).toBe(0);
    });

    it("toggle on and off without touching the other set", () => {
        let f = toggleCrag(emptyFavourites(), "rocca");
        expect([...f.c]).toEqual(["rocca"]);
        expect(f.r.size).toBe(0);
        f = toggleRoute(f, "rocca~cordon-bleu");
        expect(favouriteCount(f)).toBe(2);
        f = toggleCrag(f, "rocca");
        expect(f.c.size).toBe(0);
        expect([...f.r]).toEqual(["rocca~cordon-bleu"]);
    });

    it("never mutate what they were given", () => {
        const before = emptyFavourites();
        toggleCrag(before, "x");
        expect(before.c.size).toBe(0);
    });

    it("read a stored value back and ignore the rubbish in it", () => {
        expect(cleanFavourites({ c: ["a", 1, null, "b"], r: "nope" })).toEqual({
            c: new Set(["a", "b"]),
            r: new Set(),
        });
        expect(cleanFavourites(null)).toEqual(emptyFavourites());
        expect(cleanFavourites({})).toEqual(emptyFavourites());
    });

    it("store a stable, sorted value", () => {
        const f = { c: new Set(["b", "a"]), r: new Set(["z", "y"]) };
        expect(toStoredFavourites(f)).toEqual({ c: ["a", "b"], r: ["y", "z"] });
    });

    it("round-trip", () => {
        const f = toggleRoute(toggleCrag(emptyFavourites(), "rocca"), "rocca~x");
        expect(cleanFavourites(toStoredFavourites(f))).toEqual(f);
    });
});
