import { describe, expect, it } from "vitest";

import type { Crag } from "@domain/model";

import { gradesText } from "./cragText";

const crag = (gmin: string | null, gmax: string | null) => ({ gmin, gmax }) as Crag;

describe("gradesText", () => {
    it("writes the range, one grade, or a dash", () => {
        expect(gradesText(crag("6a", "7b"))).toBe("6a–7b");
        expect(gradesText(crag("6a", "6a"))).toBe("6a");
        expect(gradesText(crag(null, null))).toBe("–");
    });

    it("leaves an unknown end open instead of writing «null»", () => {
        expect(gradesText(crag("6a", null))).toBe("6a–");
        expect(gradesText(crag(null, "7b"))).toBe("–7b");
    });
});
