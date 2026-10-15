/**
 * The seven-day forecast on a crag page.
 *
 * A port of the original's `fcHTML` (index.html:3577): one row per day with its symbol, high and
 * low, rain with its probability, sunshine and wind -- and, when a day is tapped open, the
 * three-hourly detail beneath it. The whole section was missing from the React port, so 17 of the
 * original's texts had no reader at all.
 */

import AirIcon from "@mui/icons-material/Air";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useData } from "@app/dataContext";
import { useLang, useRegionOf } from "@app/useAppData";
import {
    forecastDays,
    forecastHours,
    freezingText,
    tempText,
    windDir,
    wmoText,
    type ForecastData,
    type ForecastDay,
} from "@core/forecast";
import { positionOf } from "@core/weather";
import { formatMm } from "@core/weather";
import type { Crag } from "@domain/model";
import { SectionTitle } from "@features/crag/SectionTitle";

import { dateLabel, dayLabel, zurichDate } from "./dayLabel";
import { useAutoRefresh } from "./useAutoRefresh";
import { useForecast, type Place } from "./useForecast";
import { WxIcon } from "./WxIcon";

const timeOf = (ms: number): string => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** The three-hourly rows of an opened day. */
const Hours = ({ data, day }: { data: ForecastData; day: ForecastDay }) => {
    const { t } = useTranslation();
    const lang = useLang();
    // The symbol sits in the second column, as in the original. The words that stood in for it
    // while the symbols were missing are gone from here: at this density they never fitted --
    // squeezed into 1fr on a phone, «partly cloudy» came out as «c…» -- and the symbol carries
    // them as its label for anyone reading by touch or hovering.
    const columns = {
        xs: "3.4rem 1.9rem 2.8rem 4.2rem minmax(0, 1fr)",
        sm: "4rem 2.2rem 3rem 4.5rem 6rem",
    };

    return (
        <Box sx={{ px: 1, pb: 1 }}>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: columns,
                    gap: 1,
                    fontSize: 12,
                    color: "text.secondary",
                    py: 0.5,
                }}
            >
                <span>{t("fc.time")}</span>
                {/* The symbol's column needs no heading. */}
                <span />
                <span>{t("fc.temp")}</span>
                <span>{t("fc.rain3")}</span>
                <span>{t("fc.wind")}</span>
            </Box>
            {forecastHours(data, day).map((row) => (
                <Box
                    key={row.i}
                    sx={{
                        display: "grid",
                        gridTemplateColumns: columns,
                        gap: 1,
                        alignItems: "center",
                        py: 0.25,
                        fontSize: 13,
                        opacity: row.past ? 0.45 : 1,
                    }}
                >
                    <span className="num">{String(row.hour).padStart(2, "0")}:00</span>
                    <WxIcon
                        code={row.code}
                        day={data.day[row.i] !== 0}
                        size={26}
                        label={wmoText(row.code, lang)}
                    />
                    <b className="num">{tempText(data.temp[row.i])}</b>
                    <span className="num">{row.rr3 >= 0.1 ? formatMm(row.rr3) : "–"}</span>
                    <span className="num">
                        {windDir(data.wd[row.i]) ?? ""} {Math.round(Number(data.ws[row.i]) || 0)}
                        <small> / {Math.round(Number(data.wg[row.i]) || 0)}</small>
                    </span>
                </Box>
            ))}
        </Box>
    );
};

export const ForecastSection = ({
    place,
    ch,
    id = "fcsec",
}: {
    readonly place: Place;
    readonly ch: boolean;
    readonly id?: string;
}) => {
    const { t } = useTranslation();
    const lang = useLang();
    const { data, loading, error, load } = useForecast(place, ch);
    const [open, setOpen] = useState<string | null>(null);

    // Fetch as soon as the card is on screen -- the crag page, or the sheet for a tapped point --
    // and keep it current while it stays there. `place.id` restarts the cycle for a new place
    // instead of making it wait for the next tick. FC_TTL still decides what reaches the network.
    useAutoRefresh(load, { key: place.id });

    const heading = <SectionTitle section="fcsec">{t(ch ? "fc.h.ch" : "fc.h")}</SectionTitle>;

    if (!data) {
        return (
            <Card id={id} sx={{ mt: 2 }}>
                <CardContent>
                    {heading}
                    {/* No button: the card fetches itself and keeps retrying, so this line is the
                        whole story -- loading, or why there is nothing yet. */}
                    <Typography variant="body2" color="text.secondary">
                        {loading ? t("fc.load") : error ? t("fc.fail", { 0: error }) : t("fc.none")}
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    const days = forecastDays(data);
    const elevation =
        data.elev != null
            ? t(
                  data.elevSrc !== "swisstopo"
                      ? "fc.elev.om"
                      : // A point somebody tapped has a height, not a wall.
                        place.id.startsWith("pt:")
                        ? "fc.elev.pt"
                        : "fc.elev.ch",
                  {
                      0: Math.round(data.elev),
                  },
              )
            : "";
    const source =
        data.model === "ch"
            ? t("fc.src.ch", {
                  0: data.chUntil
                      ? // Mid-sentence, so never «Tomorrow»: always the weekday.
                        dateLabel(zurichDate(data.chUntil), lang)
                      : "",
              })
            : t(ch ? "fc.src.chfail" : "fc.src.om");

    return (
        <Card id={id} sx={{ mt: 2 }}>
            <CardContent>
                {heading}
                {elevation && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {elevation}
                    </Typography>
                )}

                <Box sx={{ mt: 1 }}>
                    {days.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                            {t("fc.none")}
                        </Typography>
                    )}
                    {days.map((day) => {
                        const isOpen = open === day.d;
                        const fz = freezingText(day.fz);
                        return (
                            <Box
                                key={day.d}
                                sx={{
                                    borderTop: 1,
                                    borderColor: "divider",
                                    "&:first-of-type": { borderTop: 0 },
                                }}
                            >
                                <Box
                                    component="button"
                                    type="button"
                                    aria-expanded={isOpen}
                                    onClick={() => setOpen(isOpen ? null : day.d)}
                                    sx={{
                                        width: "100%",
                                        display: "grid",
                                        // The original's five columns, one template at every
                                        // width: the crag page is a column of about 360 px
                                        // whatever the screen does. No column for the words --
                                        // the symbol says it, and asking for one pushed the
                                        // sunshine and the wind off the right-hand edge.
                                        gridTemplateColumns:
                                            "4.9rem 2.2rem 3.4rem minmax(0, 0.9fr) minmax(0, 1.1fr)",
                                        gap: 0.75,
                                        alignItems: "center",
                                        textAlign: "left",
                                        background: "none",
                                        border: 0,
                                        p: 1,
                                        cursor: "pointer",
                                        font: "inherit",
                                        color: "inherit",
                                    }}
                                >
                                    <Box
                                        component="b"
                                        sx={{
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {dayLabel(day.d, lang, t)}
                                    </Box>
                                    {/* The symbol the original had: it is what makes a week
                                        readable in one look. The day's symbol is the daytime one
                                        -- `daySymbol` only ever counts the daylight hours -- and
                                        it carries the words as its label, for a reader who does
                                        not see it and for the day that is opened below. */}
                                    <WxIcon
                                        code={day.code}
                                        size={32}
                                        label={wmoText(day.code, lang)}
                                    />
                                    <span className="num">
                                        <b>{tempText(day.tmax)}</b>{" "}
                                        <Typography variant="caption" color="text.secondary">
                                            {tempText(day.tmin)}
                                        </Typography>
                                    </span>
                                    {/* Rain over its probability, sunshine over the wind: two
                                        lines each, as the original stacked them, which is what
                                        lets all five columns fit beside the symbol. */}
                                    <Box className="num" sx={{ display: "grid", lineHeight: 1.25 }}>
                                        <span>{day.rr >= 0.1 ? formatMm(day.rr) : "0 mm"}</span>
                                        {day.pp > 0 && (
                                            <small>{t("fc.pp", { 0: Math.round(day.pp) })}</small>
                                        )}
                                    </Box>
                                    <Box
                                        className="num"
                                        sx={{
                                            display: "grid",
                                            lineHeight: 1.25,
                                            color: "text.secondary",
                                            "& > span": {
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 0.3,
                                                whiteSpace: "nowrap",
                                            },
                                        }}
                                    >
                                        <span>
                                            <WbSunnyIcon sx={{ fontSize: 14 }} />
                                            {(day.sun / 3600).toFixed(day.sun < 36000 ? 1 : 0)} h
                                        </span>
                                        <span>
                                            <AirIcon sx={{ fontSize: 14 }} /> {Math.round(day.ws)}
                                            <small> / {Math.round(day.wg)}</small>
                                        </span>
                                    </Box>
                                    <ExpandMoreIcon
                                        sx={{
                                            display: "none",
                                            transform: isOpen ? "rotate(180deg)" : "none",
                                        }}
                                    />
                                </Box>
                                {isOpen && (
                                    <>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ display: "block", px: 1 }}
                                        >
                                            {wmoText(day.code, lang)}
                                            {fz && ` · ${t("fc.fz", { 0: fz })}`}
                                        </Typography>
                                        <Hours data={data} day={day} />
                                    </>
                                )}
                            </Box>
                        );
                    })}
                </Box>

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                >
                    {t("fc.legend")}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {source} {t("fc.asof", { 0: timeOf(data.at) })}
                    {loading && ` · ${t("fc.load")}`}
                    {error && ` · ${t("fc.fail", { 0: error })}`}{" "}
                    {data.model === "ch" && (
                        <>
                            <Link
                                href="https://www.meteoswiss.admin.ch/"
                                target="_blank"
                                rel="noopener"
                            >
                                {t("fc.ms")}
                            </Link>
                            {", "}
                        </>
                    )}
                    <Link href="https://open-meteo.com/" target="_blank" rel="noopener">
                        Open-Meteo
                    </Link>{" "}
                    (CC BY 4.0)
                </Typography>
            </CardContent>
        </Card>
    );
};

/**
 * The forecast for a crag: its own coordinates, or its car park where the pack gives none.
 */
export const CragForecast = ({ crag }: { crag: Crag }) => {
    const region = useRegionOf(crag);
    const { parks } = useData();
    const at = positionOf(crag, parks);
    if (!at) return null;
    return <ForecastSection place={{ id: crag.id, ...at }} ch={region?.ch === true} />;
};
