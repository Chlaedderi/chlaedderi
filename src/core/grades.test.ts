import { describe, expect, it } from "vitest";

import {
    BAND_FROM,
    BANDS,
    GRADE_HI,
    GRADE_LO,
    GRADES,
    bandOf,
    classOf,
    gradeAt,
    gradeIdx,
} from "./grades";

describe("the grade ladder", () => {
    it("is the same 54-step ladder the packs index into", () => {
        expect(GRADES).toHaveLength(54);
        expect(GRADES[0]).toBe("1a");
        expect(GRADES.at(-1)).toBe("9c+");
        expect(new Set(GRADES).size).toBe(GRADES.length);
    });

    it("places the band bounds and the slider range where the old app did", () => {
        expect(BANDS).toHaveLength(5);
        expect(BAND_FROM).toEqual([24, 30, 36, 42]);
        expect(GRADE_LO).toBe(12);
        expect(GRADE_HI).toBe(48);
    });

    it("maps a grade to its index and back", () => {
        expect(gradeIdx("6a")).toBe(30);
        expect(gradeAt(30)).toBe("6a");
        expect(gradeIdx("5.11a")).toBeNull();
        expect(gradeIdx(null)).toBeNull();
        expect(gradeAt(null)).toBeNull();
        expect(gradeAt(999)).toBeNull();
    });

    it("buckets every grade into one of the five bands", () => {
        expect(bandOf(gradeIdx("4c")!)).toBe(0);
        expect(bandOf(gradeIdx("5a")!)).toBe(1);
        expect(bandOf(gradeIdx("5c+")!)).toBe(1);
        expect(bandOf(gradeIdx("6a")!)).toBe(2);
        expect(bandOf(gradeIdx("7c+")!)).toBe(3);
        expect(bandOf(gradeIdx("8a")!)).toBe(4);
        expect(bandOf(gradeIdx("9c+")!)).toBe(4);
    });
});

describe("classOf", () => {
    it("says where a crag mostly sits", () => {
        expect(classOf([10, 10, 1, 0, 0])).toBe("easy");
        expect(classOf([0, 0, 10, 1, 1])).toBe("mid");
        expect(classOf([0, 0, 1, 5, 5])).toBe("hard");
        expect(classOf(null)).toBe("unk");
    });

    it("gives a tie to the easier side, as the old app did", () => {
        expect(classOf([1, 0, 1, 0, 0])).toBe("easy");
        expect(classOf([0, 0, 1, 1, 0])).toBe("mid");
    });
});
