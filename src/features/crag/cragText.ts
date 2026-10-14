/**
 * Short texts a crag is described by. Their own module so that the components around them stay
 * component-only, which is what React fast refresh needs.
 */

import type { Crag } from "@domain/model";

/** `6a–7b`, `6a–` or `–7b` when only one end is known, or `–` when no grade is known. */
export const gradesText = (crag: Crag): string => {
    const { gmin, gmax } = crag;
    if (!gmin && !gmax) return "–";
    if (gmin === gmax) return gmin!;
    return `${gmin ?? ""}–${gmax ?? ""}`;
};

/** `35 m`, `20–35 m`, or `up to 35 m` when only a maximum is known. */
export const lengthText = (crag: Crag, t: (k: string, o?: object) => string): string | null => {
    if (!crag.len) return null;
    const [lo, hi] = crag.len;
    if (crag.lenIsMax && hi != null) return t("len.max", { 0: hi });
    if (lo == null || hi == null) return null;
    return lo === hi ? `${lo} m` : `${lo}–${hi} m`;
};
