import DeleteIcon from "@mui/icons-material/Delete";
import ShareIcon from "@mui/icons-material/Share";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Drawer from "@mui/material/Drawer";
import MenuItem from "@mui/material/MenuItem";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { logbookActions } from "@app/slices/logbookSlice";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { useLogIndex, usePackKeyOf, usePackUrlOf } from "@app/useAppData";
import { GRADES, GRADE_LO } from "@core/grades";
import { LOG_STYLES, type LogEntry, type LogStyle, newLogId, todayIso } from "@core/logbook";
import type { Crag, Route } from "@domain/model";

import { useShare } from "../shell/useShare";

/**
 * Entering an ascent. A bottom sheet, as it was before: date, style, own stars -- and for a route
 * the atlas does not have, its name and grade too.
 */
export const LogSheet = ({
    crag,
    route,
    entry,
    open,
    onClose,
}: {
    crag: Crag | null;
    route?: Route | null;
    entry?: LogEntry | null;
    open: boolean;
    onClose: () => void;
}) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const share = useShare();
    const navigate = useNavigate();
    const log = useLogIndex();
    const packUrl = usePackUrlOf(crag);
    const packKey = usePackKeyOf(crag);
    const [confirming, setConfirming] = useState(false);
    const lastStyle = useAppSelector((s) => s.prefs.logStyle);

    const [name, setName] = useState("");
    const [grade, setGrade] = useState("6a");
    const [date, setDate] = useState(todayIso());
    const [style, setStyle] = useState<LogStyle>(lastStyle);
    const [stars, setStars] = useState(0);

    // What is already in the logbook for this route -- the original showed it in the sheet so you
    // do not enter the same ascent twice.
    const previous = (route ? (log.byRoute[route.key] ?? []) : []).filter(
        (e: LogEntry) => e.id !== entry?.id,
    );

    // Fill the sheet when it opens, from the entry being edited or from the route being logged.
    useEffect(() => {
        if (!open) return;
        if (entry) {
            setName(entry.n);
            setGrade(entry.g);
            setDate(entry.d);
            setStyle(entry.st);
            setStars(entry.r);
        } else {
            setName(route?.name ?? "");
            // A route of the atlas keeps its own grade, none included: «6a» is the starting point
            // of the picker for a route the atlas does not have, not a grade to give one that
            // has none -- it would then count as a 6a send in the pyramid and the records.
            setGrade(route ? (route.grade ?? "") : "6a");
            setDate(todayIso());
            setStyle(lastStyle);
            setStars(0);
        }
    }, [open, entry, route, lastStyle]);

    const custom = !route && !entry?.k;

    const save = () => {
        if (!name.trim()) {
            dispatch(uiActions.toast({ message: t("lb.name.req"), severity: "warning" }));
            return;
        }
        const record: LogEntry = {
            id: entry?.id ?? newLogId(),
            k: entry?.k ?? route?.key ?? null,
            s: entry?.s ?? crag?.id ?? "",
            n: name.trim(),
            g: grade,
            // A cleared date field gives "", which would be stored and shown as year «0».
            d: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso(),
            st: style,
            r: stars,
            t: entry?.t ?? Date.now(),
            ...(custom ? { custom: true } : {}),
        };
        dispatch(logbookActions.upsert(record));
        dispatch(prefsActions.setLogStyle(style));
        dispatch(
            uiActions.toast({ message: t(entry ? "lb.updated" : "lb.saved"), severity: "success" }),
        );
        onClose();
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    sx: {
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        pb: "max(12px, var(--sab))",
                    },
                },
            }}
        >
            <Box sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    {t(entry ? "lb.edit" : "lb.new")}
                    {crag ? ` · ${crag.name}` : ""}
                </Typography>
                <Typography variant="h3" gutterBottom>
                    {custom ? t("lb.custom.t") : `${name} ${grade}`.trim()}
                </Typography>

                <Stack spacing={2} sx={{ mt: 1 }}>
                    {custom && (
                        <Stack direction="row" spacing={1}>
                            <TextField
                                size="small"
                                fullWidth
                                label={t("lb.name")}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                slotProps={{ htmlInput: { maxLength: 120 } }}
                            />
                            <TextField
                                select
                                size="small"
                                label={t("lb.grade")}
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                sx={{ minWidth: 100 }}
                            >
                                {GRADES.slice(GRADE_LO).map((g) => (
                                    <MenuItem key={g} value={g}>
                                        {g}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    )}

                    <TextField
                        size="small"
                        type="date"
                        label={t("lb.date")}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        slotProps={{ htmlInput: { max: todayIso() }, inputLabel: { shrink: true } }}
                    />

                    <Box>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 0.5 }}
                        >
                            {t("lb.style")}
                        </Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={style}
                            onChange={(_e, value: LogStyle | null) => value && setStyle(value)}
                        >
                            {LOG_STYLES.map((key) => (
                                <ToggleButton key={key} value={key}>
                                    {t(`st.${key}`)}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>

                    <Box>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mb: 0.5 }}
                        >
                            {t("lb.stars")}
                        </Typography>
                        <Rating
                            value={stars}
                            onChange={(_e, value) => setStars(value ?? 0)}
                            sx={{ color: "marker.rate" }}
                        />
                        {stars === 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                {t("lb.stars.none")}
                            </Typography>
                        )}
                    </Box>

                    {previous.length > 0 && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                {t("lb.prev")}
                            </Typography>
                            {previous.map((e: LogEntry) => (
                                <Typography key={e.id} variant="body2">
                                    {e.d} · {t(`st.${e.st}`)} · {e.g}
                                </Typography>
                            ))}
                        </Box>
                    )}

                    {/* Editing an entry from the logbook page: a way back to its crag. */}
                    {entry && crag && (
                        <Button
                            size="small"
                            onClick={() => {
                                onClose();
                                void navigate(`/crag/${crag.id}`);
                            }}
                            sx={{ alignSelf: "flex-start" }}
                        >
                            {t("lb.open")}
                        </Button>
                    )}

                    {route && crag && (
                        <Button
                            size="small"
                            startIcon={<ShareIcon />}
                            onClick={() =>
                                void share(
                                    route.key,
                                    `${route.name}, ${crag.name}`,
                                    packUrl,
                                    packKey,
                                )
                            }
                            sx={{ alignSelf: "flex-start" }}
                        >
                            {t("lb.share")}
                        </Button>
                    )}

                    <Stack direction="row" spacing={1}>
                        <Button variant="contained" onClick={save} sx={{ flex: 1 }}>
                            {t(entry ? "lb.save.edit" : "lb.save")}
                        </Button>
                        {entry && (
                            <Button
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setConfirming(true)}
                            >
                                {t("lb.del")}
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Box>

            <Dialog open={confirming} onClose={() => setConfirming(false)}>
                <DialogContent>
                    <Typography>{t("lb.del.q")}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirming(false)}>{t("close")}</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            if (entry) dispatch(logbookActions.remove(entry.id));
                            setConfirming(false);
                            dispatch(
                                uiActions.toast({ message: t("lb.deleted"), severity: "success" }),
                            );
                            onClose();
                        }}
                    >
                        {t("lb.del")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Drawer>
    );
};
