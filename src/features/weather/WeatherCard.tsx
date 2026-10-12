/**
 * The rain tile on a crag page: is it climbable now, and what has fallen lately.
 *
 * These are **model values** for a grid cell of one to two kilometres, not a measurement at the
 * wall, and a model misses thunderstorms. The card says so rather than leaving the reader to
 * assume otherwise -- that sentence was in the hand-written app for a reason.
 */

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@app/hooks";
import { useLang, useRegionOf } from "@app/useAppData";
import { useWeather } from "@app/weatherContext";
import { formatMm, rainChart, readWeather } from "@core/weather";
import type { Crag } from "@domain/model";
import { SectionTitle } from "@features/crag/SectionTitle";
import { formatDate } from "@i18n/index";

import { RainChart } from "./RainChart";
import { useAutoRefresh } from "./useAutoRefresh";

const TONE = {
    dry: "success",
    soon: "warning",
    wet: "info",
    rain: "info",
} as const;

export const WeatherCard = ({ crag }: { crag: Crag }) => {
    const { t } = useTranslation();
    const lang = useLang();
    const enabled = useAppSelector((s) => s.prefs.wx);
    const ch = useRegionOf(crag)?.ch === true;
    const { at, loading, error, seriesOf, load } = useWeather();

    // Opening a crag page is the question «is it wet?», so answer it without being asked again.
    // `load()` without `force` leaves WX_TTL in charge, so this costs one request per half hour.
    // Switching the rain marks off switches the fetching off with them.
    useAutoRefresh(() => load(), { enabled });

    if (!enabled) return null;

    const series = at ? seriesOf(crag) : null;
    const reading = series ? readWeather(series, crag.dry) : null;
    const chart = series ? rainChart(series) : null;

    return (
        <Card sx={{ mt: 2 }}>
            <CardContent>
                {/* The section heading in the restored look; the «refresh» button that used to
                    sit beside it is gone, because opening the crag already asks the question. */}
                <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
                    <SectionTitle section="wxsec" flex>
                        {t("wx.h")}
                    </SectionTitle>
                    {loading && (
                        <Typography variant="caption" color="text.secondary">
                            {t("wx.hint.load")}
                        </Typography>
                    )}
                </Stack>

                {!at && !loading && (
                    <Typography variant="body2" color="text.secondary">
                        {error ? t("wx.hint.off", { 0: error }) : t("wx.none")}
                    </Typography>
                )}

                {/* With no button to press, this sentence is the only thing that tells the reader
                    the figures below are older than they look. */}
                {at && error && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {t("wx.hint.off", { 0: error })}
                    </Typography>
                )}

                {reading && (
                    <>
                        <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            sx={{ flexWrap: "wrap", mb: 1 }}
                        >
                            <Chip
                                size="small"
                                color={TONE[reading.st]}
                                label={t(`wx.st.${reading.st}`)}
                            />
                            {reading.since != null && (
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={t("wx.since", {
                                        0:
                                            reading.since < 24
                                                ? t("wx.ago.h", { 0: Math.round(reading.since) })
                                                : t("wx.ago.d", {
                                                      0: Math.round(reading.since / 24),
                                                  }),
                                    })}
                                />
                            )}
                        </Stack>

                        {chart && <RainChart chart={chart} />}

                        <Box
                            className="wxnums"
                            sx={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}
                        >
                            <span>
                                {t("wx.p24")}: <b className="num">{formatMm(reading.p24)}</b>
                            </span>
                            <span>
                                {t("wx.p48")}: <b className="num">{formatMm(reading.p48)}</b>
                            </span>
                            <span>
                                {t("wx.n6")}: <b className="num">{formatMm(reading.n6)}</b>
                            </span>
                            <span>
                                {t("wx.n24")}: <b className="num">{formatMm(reading.n24)}</b>
                            </span>
                            {reading.pr6 > 0 && (
                                <span>{t("wx.prob", { 0: Math.round(reading.pr6) })}</span>
                            )}
                        </Box>
                    </>
                )}

                {at && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 1 }}
                    >
                        {t("wx.note", {
                            0: formatDate(new Date(at).toISOString().slice(0, 10), lang),
                        })}
                        {/* In Switzerland the rain comes from a far finer model, which is
                            worth saying where it applies. */}
                        {ch && ` ${t("wx.note.ch")}`}
                    </Typography>
                )}

                {at && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {t("wx.hint", {
                            0: formatDate(new Date(at).toISOString().slice(0, 10), lang),
                        })}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
};
