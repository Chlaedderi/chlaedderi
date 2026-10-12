/**
 * «What is the weather *here*» -- a long press anywhere on the map.
 *
 * The hand-written app had all of this (`ptOf`, `ptTitle`, `pointInfo`, `openPointWx`,
 * index.html:3506) but nothing ever called `pointInfo`: the map's click handler says in its own
 * comment «weather only for crags, not for any point of the map». So in the reference commit the
 * feature is unreachable. It is wired up here because it was asked for, and because everything it
 * needs -- the forecast, the swisstopo height -- is already in place.
 *
 * A tapped point behaves like a crag with no routes: `pt:<lat>,<lon>` is its id, which is what
 * keys the forecast cache, and in Switzerland swisstopo gives it a height so the temperatures are
 * for that altitude rather than for the model cell's average.
 */

import CloseIcon from "@mui/icons-material/Close";
import SunIcon from "@mui/icons-material/WbSunny";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useMapEvents } from "react-leaflet";

import { useLang } from "@app/useAppData";
import { toLV95 } from "@core/geo";
import { formatInt } from "@i18n/index";
import { fetchHeight } from "@services/swisstopo";

import { ForecastSection } from "../weather/ForecastSection";

import { useCallout } from "./useCallout";

export interface MapPoint {
    readonly id: string;
    readonly lat: number;
    readonly lon: number;
}

/** The original's `ptOf`: three decimals, so nearby taps share one cached forecast. */
const pointAt = (lat: number, lon: number): MapPoint => ({
    id: `pt:${lat.toFixed(3)},${lon.toFixed(3)}`,
    lat,
    lon,
});

export const PointCallout = ({ inSwitzerland }: { readonly inSwitzerland: boolean }) => {
    const { t } = useTranslation();
    const lang = useLang();
    const [point, setPoint] = useState<MapPoint | null>(null);
    const [height, setHeight] = useState<number | null>(null);
    const [sheet, setSheet] = useState(false);

    // Leaflet turns a long press on a touch screen into `contextmenu`, which is also the
    // right-click on a desktop -- so one handler covers both.
    useMapEvents({
        contextmenu(e) {
            setPoint(pointAt(e.latlng.lat, e.latlng.lng));
            setHeight(null);
        },
    });

    const host = useCallout({
        at: point ? [point.lat, point.lon] : null,
        onClose: () => setPoint(null),
        options: {
            autoPanPadding: [16, 16],
            offset: [0, -4],
            maxWidth: 280,
            minWidth: 190,
            className: "ptpop",
        },
    });

    // The height, where swisstopo has one. It only sharpens the title and the forecast.
    useEffect(() => {
        if (!point || !inSwitzerland) return;
        let alive = true;
        void fetchHeight(point.lat, point.lon).then(
            (h) => {
                if (alive) setHeight(h);
            },
            () => {
                /* no height is not a failure worth reporting */
            },
        );
        return () => {
            alive = false;
        };
    }, [point, inSwitzerland]);

    if (!point) return null;

    const title =
        height != null ? t("pt.h", { 0: formatInt(Math.round(height), lang) }) : t("pt.t");
    const lv95 = inSwitzerland
        ? toLV95(point.lat, point.lon)
              .map((v) => formatInt(Math.round(v), lang))
              .join(" / ")
        : null;

    return (
        <>
            {host &&
                createPortal(
                    <>
                        <div className="a">{t("pt.a")}</div>
                        <div className="t">
                            <span className="kat-ellipsis">{title}</span>
                            <IconButton
                                className="x"
                                size="small"
                                aria-label={t("close")}
                                onClick={() => setPoint(null)}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </div>
                        <div className="hint num">
                            {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                            {lv95 && ` · LV95 ${lv95}`}
                        </div>
                        <div className="poprow">
                            <Button
                                variant="contained"
                                startIcon={<SunIcon />}
                                sx={{ flex: 1 }}
                                onClick={() => setSheet(true)}
                            >
                                {t("pt.wx")}
                            </Button>
                        </div>
                    </>,
                    host,
                )}

            <Dialog open={sheet} onClose={() => setSheet(false)} fullWidth maxWidth="sm">
                <DialogContent>
                    <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" color="text.secondary">
                                {t("pt.a")} · {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
                            </Typography>
                            <Typography variant="h3">{title}</Typography>
                        </Stack>
                        <IconButton onClick={() => setSheet(false)} aria-label={t("close")}>
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <ForecastSection place={point} ch={inSwitzerland} id="ptfc" />
                </DialogContent>
            </Dialog>
        </>
    );
};
