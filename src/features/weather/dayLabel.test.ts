import { describe, expect, it } from "vitest";

import { dateLabel, dayLabel, zurichDate } from "./dayLabel";

const t = (k: string): string => k;
const at = (iso: string): number => Date.parse(iso);

describe("dayLabel", () => {
    it("names the days by their date, not their place in the list", () => {
        const now = at("2026-10-14T10:00:00Z");
        expect(dayLabel("2026-10-13", "en", t, now)).toBe(dateLabel("2026-10-13", "en"));
        expect(dayLabel("2026-10-14", "en", t, now)).toBe("fc.today");
        expect(dayLabel("2026-10-15", "en", t, now)).toBe("fc.tomorrow");
    });

    it("counts the day in Zurich, not in UTC", () => {
        // 23:30 UTC is already the next day in Zurich.
        const now = at("2026-10-14T23:30:00Z");
        expect(dayLabel("2026-10-15", "en", t, now)).toBe("fc.today");
        expect(dayLabel("2026-10-16", "en", t, now)).toBe("fc.tomorrow");
    });

    it("finds tomorrow across a clock change", () => {
        // The eve of spring forward: the night has 23 hours, so now + 24 h lands on the 29th.
        const spring = at("2027-03-27T22:30:00Z"); // 23:30 CET
        expect(dayLabel("2027-03-28", "en", t, spring)).toBe("fc.tomorrow");
        expect(dayLabel("2027-03-29", "en", t, spring)).not.toBe("fc.tomorrow");
        // Just after midnight on the day the clocks go back, which has 25 hours.
        const autumn = at("2026-10-24T22:30:00Z"); // 00:30 CEST on the 25th
        expect(dayLabel("2026-10-25", "en", t, autumn)).toBe("fc.today");
        expect(dayLabel("2026-10-26", "en", t, autumn)).toBe("fc.tomorrow");
    });

    it("reads a timestamp as a Zurich date", () => {
        expect(zurichDate(at("2026-10-14T22:30:00Z") / 1000)).toBe("2026-10-15");
    });

    it("writes the weekday in either language", () => {
        expect(dateLabel("2026-10-14", "en")).toMatch(/Wed/);
        expect(dateLabel("2026-10-14", "de")).toMatch(/Mi/);
    });
});
