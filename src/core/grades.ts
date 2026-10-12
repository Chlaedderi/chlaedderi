/**
 * The grade ladder the app sorts, filters and colours by.
 *
 * French sport grades, the one scale every pack indexes into: a stored route carries its place in
 * this list as `gradeIdx`, so the app never has to parse a grade string to compare two routes.
 */

import type { GradeClass } from "@domain/model";

export const GRADES = [
    "1a",
    "1a+",
    "1b",
    "1b+",
    "1c",
    "1c+",
    "2a",
    "2a+",
    "2b",
    "2b+",
    "2c",
    "2c+",
    "3a",
    "3a+",
    "3b",
    "3b+",
    "3c",
    "3c+",
    "4a",
    "4a+",
    "4b",
    "4b+",
    "4c",
    "4c+",
    "5a",
    "5a+",
    "5b",
    "5b+",
    "5c",
    "5c+",
    "6a",
    "6a+",
    "6b",
    "6b+",
    "6c",
    "6c+",
    "7a",
    "7a+",
    "7b",
    "7b+",
    "7c",
    "7c+",
    "8a",
    "8a+",
    "8b",
    "8b+",
    "8c",
    "8c+",
    "9a",
    "9a+",
    "9b",
    "9b+",
    "9c",
    "9c+",
] as const;

export type Grade = (typeof GRADES)[number];

/** The five buckets of the bar chart on every crag page. */
export const BANDS = ["≤4c", "5a–5c+", "6a–6c+", "7a–7c+", "8a+"] as const;

/** Lower bounds of the bands above 4c+. */
export const BAND_FROM: readonly number[] = ["5a", "6a", "7a", "8a"].map((g) =>
    GRADES.indexOf(g as Grade),
);

/** The range the grade sliders cover: nothing below 3a and nothing above 9a is worth a stop. */
export const GRADE_LO = GRADES.indexOf("3a");
export const GRADE_HI = GRADES.indexOf("9a");

/** Which of the five bands a grade index falls into. */
export const bandOf = (gradeIdx: number): number => {
    let k = 0;
    while (k < 4 && gradeIdx >= (BAND_FROM[k] ?? Infinity)) k++;
    return k;
};

/** Place of a grade in the ladder, or null for one the app does not know. */
export const gradeIdx = (grade: string | null | undefined): number | null => {
    if (!grade) return null;
    const i = GRADES.indexOf(grade as Grade);
    return i < 0 ? null : i;
};

export const gradeAt = (index: number | null | undefined): string | null =>
    index == null ? null : (GRADES[index] ?? null);

/**
 * Where a crag mostly sits, from its five band counts: the two easy bands against the middle one
 * against the two hard ones. Ties go to the easier side, as they always have.
 */
export const classOf = (
    bands: readonly [number, number, number, number, number] | null | undefined,
): GradeClass => {
    if (!bands) return "unk";
    const easy = bands[0] + bands[1];
    const mid = bands[2];
    const hard = bands[3] + bands[4];
    if (easy >= mid && easy >= hard) return "easy";
    return mid >= hard ? "mid" : "hard";
};
