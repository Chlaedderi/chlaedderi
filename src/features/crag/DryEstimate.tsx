/**
 * How fast this wall dries, and why.
 *
 * The «why» is the point. Where a source says it outright, the source's own words are shown. Where
 * the app worked it out from sun and orientation, it says so -- a climber driving two hours should
 * know whether «dries fast» is a report or a guess.
 */

import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useLang, useRegionOf } from "@app/useAppData";
import { longText, orientLabel, shortText } from "@core/dataText";
import type { Crag } from "@domain/model";

/** The reason codes there are texts for. Any other `sun.…`/`ori.…` is left out, not shown raw. */
const SUN = ["all", "am", "pm", "noon", "none"];
const ORI = ["S", "N", "EW", "mix"];
const CODE = /^(sun|ori)\.[A-Za-z]+$/;
const known = (why: string): boolean => {
    const [kind, value = ""] = why.split(".");
    return kind === "sun" ? SUN.includes(value) : ORI.includes(value);
};

export const DryEstimate = ({ crag }: { crag: Crag }) => {
    const { t } = useTranslation();
    const lang = useLang();
    const region = useRegionOf(crag);

    if (!crag.dry) {
        return (
            <Typography variant="body2" color="text.secondary">
                {t("dry.none")}
            </Typography>
        );
    }

    const verdict = t(`dry.long.${crag.dry}`);
    // A reason is a code -- `sun.all`, `ori.S` -- or, from some packs, the source's own words,
    // which go through the pack's German table like every other short text it brings.
    const coded = crag.dryWhy.filter((why) => CODE.test(why) && known(why));
    const worded = crag.dryWhy
        .filter((why) => !CODE.test(why))
        .map((why) => shortText(why, lang, region?.de) ?? why);
    const note = longText(crag, "dryNote", lang);

    // Stated by a source: quote it rather than explaining our own reasoning -- its note, or the
    // words it gave as the reason. Nothing to quote is no reason for a dangling dash.
    if (crag.dryHow === "src") {
        const said = note || worded.join(" ");
        return (
            <Typography variant="body2">
                <b>{verdict}</b>
                {said ? ` – ${said}` : null}
            </Typography>
        );
    }

    const orient =
        crag.orient.length === 0
            ? "–"
            : crag.orient.length >= 4
              ? t("all.aspects")
              : crag.orient.map((o) => orientLabel(o, lang)).join(" / ");

    const reasons = coded.map((why) => {
        const [kind, value] = why.split(".");
        return kind === "sun"
            ? t("dry.w.sun", { 0: t(`sun.${value}`) })
            : t(`dry.w.ori.${value}`, { 0: orient });
    });
    // What a source said beside the estimate -- «seeps for days after rain» -- is the one line a
    // climber most needs, and was never shown with an estimate.
    const besides = [...worded, ...(note ? [note] : [])];

    return (
        <Typography variant="body2">
            <b>{verdict}</b>{" "}
            {reasons.length > 0 && (
                <Typography component="span" variant="body2" color="text.secondary">
                    – {t("dry.est.from", { 0: reasons.join(" · ") })}
                </Typography>
            )}
            {besides.length > 0 && <> {besides.join(" ")}</>}
        </Typography>
    );
};
