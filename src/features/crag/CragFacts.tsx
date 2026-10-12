/**
 * The figures a crag is judged by at a glance: grades, routes, length, orientation, walking time,
 * rating, distance. Used in the call-out on the map and on the crag card.
 *
 * A port of `factsHTML`. The walking time is marked approximate when it was computed from the car
 * park rather than stated by a source -- the original drew that distinction and it matters.
 */

import WalkIcon from "@mui/icons-material/DirectionsWalk";
import CompassIcon from "@mui/icons-material/Explore";
import LocationIcon from "@mui/icons-material/MyLocation";
import RoutesIcon from "@mui/icons-material/Route";
import StarIcon from "@mui/icons-material/Star";
import HeightIcon from "@mui/icons-material/Straighten";
import GradeIcon from "@mui/icons-material/Terrain";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useLang } from "@app/useAppData";
import { orientLabel } from "@core/dataText";
import { formatDistance } from "@core/geo";
import type { Crag } from "@domain/model";
import { countOf } from "@i18n/index";

import { gradesText, lengthText } from "./cragText";

const ICON_SX = { fontSize: 15, mr: 0.4, verticalAlign: "-2px", opacity: 0.75 } as const;

export const CragFacts = ({
    crag,
    inCount,
    distance,
}: {
    readonly crag: Crag;
    readonly inCount?: number | null;
    readonly distance?: number | null;
}) => {
    const { t } = useTranslation();
    const lang = useLang();
    const length = lengthText(crag, t as never);

    const orient =
        crag.orient.length === 0
            ? null
            : crag.orient.length >= 4
              ? t("all.aspects")
              : crag.orient.map((o) => orientLabel(o, lang)).join(" / ");

    return (
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: "2px 12px",
                fontSize: "13.5px",
                alignItems: "baseline",
            }}
        >
            <span className="num">
                <GradeIcon sx={ICON_SX} />
                {gradesText(crag)}
            </span>
            {crag.nRoutes != null && (
                <span className="num">
                    <RoutesIcon sx={ICON_SX} />
                    {countOf(t, "n.route", crag.nRoutes, lang)}
                    {inCount != null && (
                        <>
                            {" · "}
                            <b>{t("inrange", { 0: inCount })}</b>
                        </>
                    )}
                </span>
            )}
            {length && (
                <span className="num">
                    <HeightIcon sx={ICON_SX} />
                    {length}
                </span>
            )}
            {orient && (
                <span>
                    <CompassIcon sx={ICON_SX} />
                    {orient}
                </span>
            )}
            {crag.walkEff != null && (
                <Typography
                    component="span"
                    className="num"
                    sx={{ fontSize: "inherit" }}
                    // Computed from the car park rather than stated: say so.
                    color={crag.walkHow === "calc" ? "text.secondary" : "text.primary"}
                >
                    <WalkIcon sx={ICON_SX} />
                    {t(crag.walkHow === "calc" ? "min.ca" : "min", { 0: crag.walkEff })}
                </Typography>
            )}
            {crag.rate?.avg != null && (
                <span className="num">
                    <StarIcon sx={{ ...ICON_SX, color: "marker.rate" }} />
                    {crag.rate.avg.toFixed(1)}
                </span>
            )}
            {distance != null && (
                <span className="num">
                    <LocationIcon sx={ICON_SX} />
                    {t("me.dist", { 0: formatDistance(distance) })}
                </span>
            )}
        </Box>
    );
};
