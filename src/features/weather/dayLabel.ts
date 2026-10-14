import { localParts } from "@core/forecast";

/** The zone the forecast's days are grouped in, so that the label and the grouping agree. */
const ZONE = "Europe/Zurich";

/** The weekday and the date, «Mi., 14.» or «Wed 14». */
export const dateLabel = (iso: string, lang: string): string => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!, 12)).toLocaleDateString(
        lang === "de" ? "de-CH" : "en-GB",
        { weekday: "short", day: "numeric", timeZone: "UTC" },
    );
};

/**
 * «Today», «Tomorrow», then the weekday and the date. By the day's date, not its place in the
 * list: a forecast kept offline overnight starts with yesterday, which is not «today».
 */
export const dayLabel = (
    iso: string,
    lang: string,
    t: (k: string) => string,
    now: number = Date.now(),
): string => {
    const today = localParts(now / 1000, ZONE).d;
    if (iso === today) return t("fc.today");
    // A calendar day on, not 24 hours on: a day around a clock change has 23 or 25.
    const [y, m, d] = today.split("-").map(Number);
    const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
    if (iso === tomorrow) return t("fc.tomorrow");
    return dateLabel(iso, lang);
};

/** The Zurich date of a timestamp in seconds, for the «up to» of the source line. */
export const zurichDate = (ts: number): string => localParts(ts, ZONE).d;
