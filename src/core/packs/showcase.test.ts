/**
 * What the app is allowed to ship.
 *
 * `maps/pack.showcase.json` is compiled into the bundle, so it is the one pack every visitor sees
 * without asking for it -- and it is **generated**, by `tools/make-packs.sh --showcase-from`. Point
 * that at a real region and it will quietly cut a new showcase out of somebody else's route lists,
 * ratings and photographs, which is exactly what used to be here: nineteen hot-linked pictures,
 * none of them carrying a licence, and route lists in theCrag's order under CC BY-NC-SA.
 *
 * So this is a licence check, not a data check. It fails loudly the moment the shipped showcase
 * stops being the invented region.
 */

import { describe, expect, it } from "vitest";

import showcase from "../../../maps/pack.showcase.json";

/** The crags `tools/make-packs.sh --showcase-from maps/pack.testing.json --ids …` is given. */
const IDS = [
    "testing-attrappengrat-westgrat",
    "testing-beispielplatte",
    "testing-beispielwand",
    "testing-gesperrte-attrappe",
    "testing-musterwand",
    "testing-musterwand-nord",
];

describe("the showcase that ships in the app", () => {
    it("is an invented region, and says so itself", () => {
        // The blunt instrument: a showcase re-cut from a real region fails right here.
        expect(showcase.fictional).toBe(true);
        expect(showcase.id).toBe("testing");
    });

    it("holds the crags it was cut from, and no others", () => {
        expect(showcase.sectors.map((s) => s.id).sort()).toEqual(IDS);
    });

    it("names an author and a licence for every picture", () => {
        const pics = showcase.sectors.flatMap((s) => ("pics" in s ? (s.pics ?? []) : []));
        expect(pics.length).toBeGreaterThan(0);
        for (const pic of pics) {
            const [url, , page, , , , , author, licence] = pic as unknown as (string | number)[];
            // A picture is loaded from somebody's server and shown inside our page. Without an
            // author and a licence recorded here, nobody can say whether we may.
            expect(
                typeof author === "string" && author.length > 0,
                `author for ${String(url)}`,
            ).toBe(true);
            expect(
                typeof licence === "string" && licence.length > 0,
                `licence for ${String(url)}`,
            ).toBe(true);
            expect(String(page)).toMatch(/^https:\/\//);
        }
    });

    it("takes its pictures only from where they may be taken from", () => {
        const pics = showcase.sectors.flatMap((s) => ("pics" in s ? (s.pics ?? []) : []));
        for (const pic of pics) {
            const url = String((pic as unknown as unknown[])[0]);
            // Wikimedia Commons, where the licence beside each file is the licence of the file.
            expect(url, url).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
        }
    });
});
