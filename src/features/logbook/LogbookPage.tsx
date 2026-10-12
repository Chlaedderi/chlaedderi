import DownloadIcon from "@mui/icons-material/Download";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { logbookActions } from "@app/slices/logbookSlice";
import { uiActions } from "@app/slices/uiSlice";
import { useLang } from "@app/useAppData";
import { GRADES } from "@core/grades";
import {
    type LogEntry,
    byDate,
    csvText,
    entryGradeIdx,
    gradePyramid,
    isSend,
    logStats,
} from "@core/logbook";
import { APP_SLUG } from "@core/name";
import { i18 } from "@core/text";
import { formatDate } from "@i18n/index";

import { SaveStatus } from "../favourites/SaveStatus";

/** A number with its label: the tiles at the top of the logbook. */
const Stat = ({ value, label }: { value: number | string; label: string }) => (
    <Card sx={{ flex: "1 1 92px", minWidth: 92 }}>
        <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
            <Typography variant="h3" className="num">
                {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
        </CardContent>
    </Card>
);

export const LogbookPage = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const { byId, regions } = useData();
    const entries = useAppSelector((s) => s.logbook.entries);
    const saved = useAppSelector((s) => s.logbook.saved);
    const [year, setYear] = useState<number | null>(null);
    const [clearing, setClearing] = useState(false);
    const dispatch = useAppDispatch();

    const years = useMemo(
        () => [...new Set(entries.map((e) => Number(e.d.slice(0, 4))))].sort((a, b) => b - a),
        [entries],
    );
    const shown = useMemo(
        () =>
            (year == null ? entries : entries.filter((e) => e.d.startsWith(String(year))))
                .slice()
                .sort(byDate)
                .reverse(),
        [entries, year],
    );
    const stats = useMemo(
        () =>
            logStats(shown, (e) => {
                const crag = byId[e.s];
                const route = crag?.routes.find((r) => r.key === e.k);
                return entryGradeIdx(e, route?.gradeIdx ?? null);
            }),
        [shown, byId],
    );

    const pyramid = useMemo(() => {
        const bars = gradePyramid(shown, (e: LogEntry) => {
            const route = byId[e.s]?.routes.find((r) => r.key === e.k);
            return entryGradeIdx(e, route?.gradeIdx ?? null);
        });
        return [...bars.entries()].sort((a, b) => a[0] - b[0]);
    }, [shown, byId]);
    const pyramidMax = Math.max(1, ...pyramid.map(([, n]) => n));

    const download = () => {
        const text = csvText(
            shown,
            {
                date: t("lb.date"),
                route: t("csv.route"),
                grade: t("lb.grade"),
                style: t("lb.style"),
                stars: t("csv.stars"),
                crag: t("csv.crag"),
                area: t("f.area"),
                region: t("region.label"),
            },
            {
                crag: (id) => {
                    const crag = byId[id];
                    if (!crag) return null;
                    const region = regions.find((r) => r.key === crag.packId);
                    return {
                        name: crag.name,
                        area: crag.area,
                        region: region ? i18(region.name, lang) : "",
                    };
                },
                styleLabel: (st) => t(`st.${st}`),
            },
        );
        try {
            const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `${APP_SLUG}-logbuch.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            // Some browsers refuse a script-made download outright. Say so rather than
            // appearing to have done nothing.
            dispatch(uiActions.toast({ message: t("csv.fail"), severity: "warning" }));
        }
    };

    return (
        <Box sx={{ height: "100%", overflowY: "auto", p: 2, pb: 4 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="h2" sx={{ flex: 1 }}>
                    {t("tab.log")}
                </Typography>
                {entries.length > 0 && (
                    <Button size="small" startIcon={<DownloadIcon />} onClick={download}>
                        CSV
                    </Button>
                )}
            </Stack>

            {entries.length === 0 ? (
                <Typography color="text.secondary">{t("lb.empty")}</Typography>
            ) : (
                <>
                    {years.length > 1 && (
                        <Stack
                            direction="row"
                            spacing={0.5}
                            useFlexGap
                            sx={{ mb: 2, flexWrap: "wrap" }}
                        >
                            <Chip
                                size="small"
                                label={t("lb.all")}
                                color={year == null ? "primary" : "default"}
                                onClick={() => setYear(null)}
                            />
                            {years.map((y) => (
                                <Chip
                                    key={y}
                                    size="small"
                                    label={y}
                                    color={year === y ? "primary" : "default"}
                                    onClick={() => setYear(y)}
                                />
                            ))}
                        </Stack>
                    )}

                    <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: "wrap" }}>
                        <Stat value={stats.sends} label={t("lb.n.asc")} />
                        <Stat value={stats.routes} label={t("lb.n.routes")} />
                        <Stat value={stats.crags} label={t("lb.n.crags")} />
                        <Stat value={stats.days} label={t("lb.n.days")} />
                        <Stat value={shown.length - stats.sends} label={t("lb.n.att")} />
                    </Stack>

                    {stats.hardest.length > 0 && (
                        <>
                            <Typography variant="h4" gutterBottom>
                                {t("lb.hardest")}
                            </Typography>
                            <Stack
                                direction="row"
                                spacing={0.5}
                                useFlexGap
                                sx={{ mb: 2, flexWrap: "wrap" }}
                            >
                                {stats.hardest.map((e) => (
                                    <Chip key={e.id} size="small" label={`${e.n} · ${e.g}`} />
                                ))}
                            </Stack>
                        </>
                    )}

                    {pyramid.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h4" gutterBottom>
                                {t("lb.pyr")}
                            </Typography>
                            {pyramid.map(([at, n]) => (
                                <Stack
                                    key={at}
                                    direction="row"
                                    spacing={1}
                                    sx={{ alignItems: "center", mb: 0.25 }}
                                >
                                    <Typography
                                        variant="caption"
                                        className="num"
                                        sx={{ width: 32, textAlign: "right" }}
                                    >
                                        {GRADES[at]}
                                    </Typography>
                                    <Box
                                        sx={{
                                            height: 10,
                                            borderRadius: 1,
                                            bgcolor: "primary.main",
                                            width: `${Math.max(4, Math.round((n / pyramidMax) * 100))}%`,
                                        }}
                                    />
                                    <Typography variant="caption" className="num">
                                        {n}
                                    </Typography>
                                </Stack>
                            ))}
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mt: 0.5 }}
                            >
                                {t("lb.pyr.hint")}
                            </Typography>
                        </Box>
                    )}

                    <Typography variant="h4" gutterBottom>
                        {t("lb.entries")}
                    </Typography>
                    {/* The original explained what the export contains before offering it. */}
                    {shown.map((entry: LogEntry) => (
                        <Box
                            key={entry.id}
                            sx={{
                                display: "flex",
                                gap: 1,
                                py: 0.75,
                                borderBottom: 1,
                                borderColor: "divider",
                                alignItems: "baseline",
                            }}
                        >
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                className="num"
                                sx={{ width: 84 }}
                            >
                                {formatDate(entry.d, lang)}
                            </Typography>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" className="kat-ellipsis">
                                    {entry.n}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {byId[entry.s]?.name ?? t("lb.gone")}
                                </Typography>
                            </Box>
                            <Chip
                                size="small"
                                label={t(`st.${entry.st}`)}
                                color={isSend(entry) ? "success" : "warning"}
                                sx={{ height: 20, fontSize: "0.72rem" }}
                            />
                            <Typography
                                variant="body2"
                                className="num"
                                sx={{ fontWeight: 600, width: 42, textAlign: "right" }}
                            >
                                {entry.g}
                            </Typography>
                        </Box>
                    ))}

                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h4" gutterBottom>
                            {t("lb.csv")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            {t("lb.csv.t")}
                        </Typography>
                        <Button startIcon={<DownloadIcon />} onClick={download}>
                            {t("lb.csv")}
                        </Button>
                    </Box>

                    <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
                        <Button color="error" onClick={() => setClearing(true)}>
                            {t("lb.clear")}
                        </Button>
                    </Box>
                </>
            )}

            <Dialog open={clearing} onClose={() => setClearing(false)}>
                <DialogContent>
                    <Typography>{t("lb.clear.q", { 0: entries.length })}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClearing(false)}>{t("close")}</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            dispatch(logbookActions.clear());
                            setClearing(false);
                        }}
                    >
                        {t("lb.clear")}
                    </Button>
                </DialogActions>
            </Dialog>

            <SaveStatus saved={saved} />
        </Box>
    );
};
