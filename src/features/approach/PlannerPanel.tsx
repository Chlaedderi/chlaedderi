/**
 * «Plan on swisstopo's trails»: the panel over the map.
 *
 * What it shows is what a climber needs before setting off -- length, climb, time there and back,
 * and **what kind of ground** it runs over. The last is the important one: an alpine trail
 * (white-blue-white) is not a path you take in approach shoes, and the panel says so in words as
 * well as in the bar.
 */

import CloseIcon from "@mui/icons-material/Close";
import WalkIcon from "@mui/icons-material/DirectionsWalk";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useLang } from "@app/useAppData";
import type { PathCategory } from "@core/approach";
import { formatDistance } from "@core/geo";
import { downloadGpx, toGpx } from "@core/gpx";
import type { Crag } from "@domain/model";
import { formatInt } from "@i18n/index";

import { ElevationProfile } from "./ElevationProfile";
import type { PlanResult } from "./usePlanner";
import { formatMinutes } from "./walkTime";

/** The colours the trail grades have on Swiss signposts. */
const CAT_COLOUR: Record<PathCategory, string> = {
    0: "var(--ink2)",
    1: "#e8a200",
    2: "#d7263d",
    3: "#1f5fd6",
    4: "#d81b78",
};

export interface PlannerPanelProps {
    readonly crag: Crag;
    readonly starts: { value: string; label: string }[];
    readonly start: string;
    readonly onStart: (value: string) => void;
    readonly busy: boolean;
    readonly error: string | null;
    readonly result: PlanResult | null;
    readonly onClose: () => void;
    /** Straight to the crag's page, which the original offered from the panel. */
    readonly onOpenCrag?: (() => void) | undefined;
    /** Set when the viewer has been asked to tap the map. */
    readonly picking: "start" | "via" | null;
    readonly onAddVia: () => void;
    readonly onClearVia: () => void;
    readonly hasVia: boolean;
}

export const PlannerPanel = ({
    crag,
    starts,
    start,
    onStart,
    busy,
    error,
    result,
    onClose,
    onOpenCrag,
    picking,
    onAddVia,
    onClearVia,
    hasVia,
}: PlannerPanelProps) => {
    const { t } = useTranslation();
    const lang = useLang();
    const [open, setOpen] = useState(true);

    // Only the kinds of ground that make up a real part of the way.
    const cats = result ? ([1, 2, 3, 4, 0] as PathCategory[]).filter((k) => result.by[k] >= 5) : [];

    return (
        <div className="planbar">
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                <WalkIcon fontSize="small" />
                <Typography
                    variant="subtitle2"
                    sx={{ flex: 1, minWidth: 0 }}
                    className="kat-ellipsis"
                >
                    {t("pl.h", { 0: crag.name })}
                </Typography>
                <IconButton
                    size="small"
                    aria-label={t(open ? "pl.min" : "pl.max")}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? (
                        <ExpandMoreIcon fontSize="small" />
                    ) : (
                        <ExpandLessIcon fontSize="small" />
                    )}
                </IconButton>
                <IconButton size="small" aria-label={t("close")} onClick={onClose}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Stack>

            {open && (
                <Box sx={{ mt: 1 }}>
                    <TextField
                        select
                        size="small"
                        fullWidth
                        label={t("pl.start")}
                        value={start}
                        onChange={(e) => onStart(e.target.value)}
                        sx={{ mb: 1 }}
                    >
                        {starts.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>

                    {onOpenCrag && (
                        <Button size="small" onClick={onOpenCrag} sx={{ mb: 1 }}>
                            {t("pl.crag")}
                        </Button>
                    )}

                    {picking && (
                        <Alert severity="info" sx={{ mb: 1 }}>
                            {t(picking === "via" ? "pl.tap.via" : "pl.tap.start")}
                        </Alert>
                    )}

                    {busy && (
                        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="body2" color="text.secondary">
                                {t("pl.busy")}
                            </Typography>
                        </Stack>
                    )}

                    {error && (
                        <Alert severity="warning" sx={{ mb: 1 }}>
                            {t("pl.fail", { 0: t(error, { defaultValue: error }) })}
                        </Alert>
                    )}

                    {result && (
                        <>
                            <Stack
                                direction="row"
                                spacing={1.5}
                                useFlexGap
                                sx={{ flexWrap: "wrap", alignItems: "baseline", mb: 1 }}
                            >
                                <Typography
                                    variant="body2"
                                    className="num"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {formatDistance(result.d)}
                                </Typography>
                                {result.up != null && (
                                    <Typography variant="body2" className="num">
                                        ↑ {formatInt(Math.round(result.up), lang)} m
                                    </Typography>
                                )}
                                {result.down != null && (
                                    <Typography variant="body2" className="num">
                                        ↓ {formatInt(Math.round(result.down), lang)} m
                                    </Typography>
                                )}
                                {result.tm != null && (
                                    <Typography
                                        variant="body2"
                                        className="num"
                                        sx={{ fontWeight: 700 }}
                                    >
                                        ≈ {formatMinutes(result.tm)}
                                    </Typography>
                                )}
                                {result.back != null && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        className="num"
                                    >
                                        {t("pl.back", { 0: formatMinutes(result.back) })}
                                    </Typography>
                                )}
                            </Stack>

                            {/* How much of the way is which kind of ground. */}
                            <Box
                                sx={{
                                    display: "flex",
                                    height: 8,
                                    borderRadius: 1,
                                    overflow: "hidden",
                                    mb: 0.75,
                                }}
                                aria-hidden="true"
                            >
                                {cats.map((k) => (
                                    <Box
                                        key={k}
                                        sx={{ flex: result.by[k], background: CAT_COLOUR[k] }}
                                    />
                                ))}
                            </Box>
                            <Stack
                                direction="row"
                                spacing={1.5}
                                useFlexGap
                                sx={{ flexWrap: "wrap", mb: 1 }}
                            >
                                {cats.map((k) => (
                                    <Typography
                                        key={k}
                                        variant="caption"
                                        sx={{ display: "flex", gap: 0.5, alignItems: "center" }}
                                    >
                                        <Box
                                            component="i"
                                            sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: "2px",
                                                background: CAT_COLOUR[k],
                                            }}
                                        />
                                        {t(`pl.cat.${k}`)}{" "}
                                        <b className="num">{formatDistance(result.by[k])}</b>
                                    </Typography>
                                ))}
                            </Stack>

                            {result.profile && <ElevationProfile profile={result.profile} />}

                            {result.src !== "ch" && (
                                <Alert severity="warning" sx={{ my: 1 }}>
                                    {t("pl.osm", {
                                        // A reason of the planner's own is a text key; a network
                                        // error is said as it came.
                                        0: result.netErr?.startsWith("pl.")
                                            ? t(result.netErr)
                                            : (result.netErr ?? ""),
                                    })}
                                </Alert>
                            )}
                            {result.by[0] >= 30 && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block" }}
                                >
                                    {t("pl.off.hint")}
                                </Typography>
                            )}
                            {result.by[3] >= 5 && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block" }}
                                >
                                    {t("pl.alpine")}
                                </Typography>
                            )}
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mt: 0.5 }}
                            >
                                {t(result.profile ? "pl.time" : "pl.time.flat")}
                            </Typography>
                        </>
                    )}

                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                        <Button size="small" onClick={onAddVia}>
                            {t("pl.via")}
                        </Button>
                        {hasVia && (
                            <Button size="small" onClick={onClearVia}>
                                {t("pl.clear")}
                            </Button>
                        )}
                        {result && (
                            <Button
                                size="small"
                                startIcon={<DownloadIcon />}
                                onClick={() =>
                                    downloadGpx(
                                        `zustieg-${crag.id}.gpx`,
                                        toGpx({
                                            name: t("pl.gpx.name", { 0: crag.name }),
                                            points: result.line,
                                        }),
                                    )
                                }
                            >
                                GPX
                            </Button>
                        )}
                    </Stack>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 1 }}
                    >
                        {t("pl.src")}
                    </Typography>
                </Box>
            )}
        </div>
    );
};
