/**
 * How fast this wall dries, and why.
 *
 * The «why» is the point. Where a source says it outright, the source's own words are shown. Where
 * the app worked it out from sun and orientation, it says so -- a climber driving two hours should
 * know whether «dries fast» is a report or a guess.
 */

import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useLang } from "@app/useAppData";
import { longText, orientLabel } from "@core/dataText";
import type { Crag } from "@domain/model";

export const DryEstimate = ({ crag }: { crag: Crag }) => {
    const { t } = useTranslation();
    const lang = useLang();

    if (!crag.dry) {
        return (
            <Typography variant="body2" color="text.secondary">
                {t("dry.none")}
            </Typography>
        );
    }

    const verdict = t(`dry.long.${crag.dry}`);

    // Stated by a source: quote it rather than explaining our own reasoning.
    if (crag.dryHow === "src") {
        return (
            <Typography variant="body2">
                <b>{verdict}</b> – {longText(crag, "dryNote", lang)}
            </Typography>
        );
    }

    const orient =
        crag.orient.length === 0
            ? "–"
            : crag.orient.length >= 4
              ? t("all.aspects")
              : crag.orient.map((o) => orientLabel(o, lang)).join(" / ");

    const reasons = crag.dryWhy.map((why) => {
        const [kind, value] = why.split(".");
        return kind === "sun"
            ? t("dry.w.sun", { 0: t(`sun.${value}`) })
            : t(`dry.w.ori.${value}`, { 0: orient });
    });

    return (
        <Typography variant="body2">
            <b>{verdict}</b>{" "}
            {reasons.length > 0 && (
                <Typography component="span" variant="body2" color="text.secondary">
                    – {t("dry.est.from", { 0: reasons.join(" · ") })}
                </Typography>
            )}
        </Typography>
    );
};
