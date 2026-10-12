import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ShareIcon from "@mui/icons-material/Share";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { selectFilters } from "@app/selectors";
import { filtersActions } from "@app/slices/filtersSlice";
import { uiActions } from "@app/slices/uiSlice";
import {
    useLang,
    useRegion,
    useRegionCrags,
    useRegionSource,
    useShownCrags,
} from "@app/useAppData";
import { orientLabel } from "@core/dataText";
import { encodeFilterCode } from "@core/filterCode";
import {
    FILTER_VALUES,
    type FilterFlag,
    type FilterKey,
    GRADE_PRESETS,
    MIN_IN_CHOICES,
    ORIENTS,
} from "@core/filters";
import { GRADE_HI, GRADE_LO, GRADES, gradeIdx } from "@core/grades";

import { useShareLink, viewLinkTo } from "../shell/useShare";

import { optionCounts, optionLabel } from "./filterLabels";

/** One of the pick-one filters, as a select. */
const OneOf = ({ filterKey, label }: { filterKey: FilterKey; label: string }) => {
    const { t } = useTranslation();
    // Counted against the region, not against what the filter has already narrowed to -- the
    // figure is there to say what exists.
    const counts = optionCounts(useRegionCrags());
    const value = useAppSelector((s) => s.filters.one[filterKey]);
    const dispatch = useAppDispatch();
    return (
        <TextField
            select
            size="small"
            fullWidth
            label={label}
            value={value}
            onChange={(e) =>
                dispatch(filtersActions.setOne({ key: filterKey, value: e.target.value }))
            }
        >
            {FILTER_VALUES[filterKey].map((option) => (
                <MenuItem key={option} value={option}>
                    {optionLabel(t, filterKey, option, counts[filterKey]?.[option] ?? 0)}
                </MenuItem>
            ))}
        </TextField>
    );
};

const Flag = ({ flagKey, label }: { flagKey: FilterFlag; label: string }) => {
    const value = useAppSelector((s) => s.filters.flags[flagKey]);
    const dispatch = useAppDispatch();
    return (
        <FormControlLabel
            control={
                <Switch
                    size="small"
                    checked={value}
                    onChange={(e) =>
                        dispatch(filtersActions.setFlag({ key: flagKey, value: e.target.checked }))
                    }
                />
            }
            label={label}
        />
    );
};

/**
 * The filter controls themselves, in the sheet that holds them at every screen size.
 *
 * The original kept a second, permanent copy in a 292px left column with its header and its
 * «show N» button hidden. That column cost the map a quarter of the window for something most
 * people set once, and hiding the header took «reset» away from exactly the people with the room
 * for it, so there is one form now and the filter icon opens it.
 */
const FiltersBody = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const { gmin, gmax, minIn, orient, area, muni } = useAppSelector((s) => s.filters);
    const shown = useShownCrags();
    const crags = useRegionCrags();
    const region = useRegion();

    const areas = region?.areas.map((a) => a.name) ?? [];
    const munis = [
        ...new Set(crags.map((c) => c.municipality).filter((m): m is string => !!m)),
    ].sort();
    const close = () => dispatch(uiActions.setFiltersOpen(false));

    // The link to this view. Null when nothing is set: there is nothing to say about a list
    // nobody has narrowed, and the button says so by being unavailable.
    const filters = useAppSelector(selectFilters);
    const sort = useAppSelector((s) => s.filters.sort);
    const dir = useAppSelector((s) => s.filters.dir);
    const source = useRegionSource();
    const shareLink = useShareLink();
    const code = encodeFilterCode(filters, sort, dir);

    return (
        <>
            <Toolbar sx={{ gap: 1 }}>
                <Typography variant="h3" sx={{ flex: 1 }}>
                    {t("filters")}
                </Typography>
                <IconButton
                    disabled={!code}
                    aria-label={t("f.share")}
                    onClick={() =>
                        void shareLink(
                            viewLinkTo(code, source?.url, source?.key),
                            t("f.share.label"),
                        )
                    }
                >
                    <ShareIcon />
                </IconButton>
                <Button
                    size="small"
                    startIcon={<RestartAltIcon />}
                    onClick={() => dispatch(filtersActions.reset())}
                >
                    {t("f.reset")}
                </Button>
                <IconButton onClick={close} aria-label={t("close")}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <Divider />

            <Box sx={{ p: 2, overflowY: "auto", flex: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                    {t("f.grade")}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ mb: 1, flexWrap: "wrap" }}>
                    {GRADE_PRESETS.map(([from, to, label]) => {
                        const a = gradeIdx(from)!;
                        const b = gradeIdx(to)!;
                        return (
                            <Chip
                                key={label}
                                label={label}
                                size="small"
                                color={gmin === a && gmax === b ? "primary" : "default"}
                                onClick={() =>
                                    dispatch(filtersActions.setGrades({ gmin: a, gmax: b }))
                                }
                            />
                        );
                    })}
                    <Chip
                        label={t("any")}
                        size="small"
                        color={gmin === GRADE_LO && gmax === GRADE_HI ? "primary" : "default"}
                        onClick={() =>
                            dispatch(filtersActions.setGrades({ gmin: GRADE_LO, gmax: GRADE_HI }))
                        }
                    />
                </Stack>
                <Box sx={{ px: 1 }}>
                    <Slider
                        value={[gmin, gmax]}
                        min={GRADE_LO}
                        max={GRADE_HI}
                        step={1}
                        marks
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v: number) => GRADES[v] ?? ""}
                        onChange={(_e, value) => {
                            const [a, b] = value as number[];
                            dispatch(filtersActions.setGrades({ gmin: a!, gmax: b! }));
                        }}
                        aria-label={t("f.grade")}
                    />
                </Box>

                <TextField
                    select
                    size="small"
                    fullWidth
                    label={t("f.minIn1")}
                    value={minIn}
                    onChange={(e) => dispatch(filtersActions.setMinIn(Number(e.target.value)))}
                    sx={{ mt: 1, mb: 2 }}
                >
                    {MIN_IN_CHOICES.map((n) => (
                        <MenuItem key={n} value={n}>
                            {n}
                        </MenuItem>
                    ))}
                </TextField>

                <Typography variant="subtitle2" gutterBottom>
                    {t("f.orient")}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ mb: 2, flexWrap: "wrap" }}>
                    {[...ORIENTS, "mixed", "unknown"].map((o) => (
                        <Chip
                            key={o}
                            size="small"
                            {...(o === "mixed" ? { title: t("ori.mixed.t") } : {})}
                            label={
                                o === "mixed"
                                    ? t("ori.mixed")
                                    : o === "unknown"
                                      ? t("unknown")
                                      : orientLabel(o, lang)
                            }
                            color={orient.includes(o) ? "primary" : "default"}
                            onClick={() => dispatch(filtersActions.toggleOrient(o))}
                        />
                    ))}
                </Stack>

                <Stack spacing={1.5}>
                    <OneOf filterKey="star" label={t("f.star")} />
                    <OneOf filterKey="fav" label={t("f.fav")} />
                    <OneOf filterKey="log" label={t("f.log")} />
                    <OneOf filterKey="walk" label={t("f.walk")} />
                    <OneOf filterKey="count" label={t("f.count")} />
                    <OneOf filterKey="len" label={t("f.len")} />
                    <OneOf filterKey="style" label={t("f.style")} />
                    <OneOf filterKey="pic" label={t("f.pic")} />
                    <OneOf filterKey="rain" label={t("f.rain")} />
                    <OneOf filterKey="dry" label={t("f.dry")} />
                    <OneOf filterKey="bolt" label={t("f.bolt")} />
                    <OneOf filterKey="boltC" label={t("f.bolt.c")} />

                    {areas.length > 1 && (
                        <TextField
                            select
                            size="small"
                            fullWidth
                            label={t("f.area")}
                            value={area}
                            onChange={(e) => dispatch(filtersActions.setArea(e.target.value))}
                        >
                            <MenuItem value="">{t("area.all")}</MenuItem>
                            {areas.map((name) => (
                                <MenuItem key={name} value={name}>
                                    {name}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}

                    {munis.length > 1 && (
                        <TextField
                            select
                            size="small"
                            fullWidth
                            label={t("f.muni")}
                            value={muni}
                            onChange={(e) => dispatch(filtersActions.setMuni(e.target.value))}
                        >
                            <MenuItem value="">{t("muni.all")}</MenuItem>
                            <MenuItem value="?">{t("muni.none")}</MenuItem>
                            {munis.map((name) => (
                                <MenuItem key={name} value={name}>
                                    {name}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}
                </Stack>

                <Divider sx={{ my: 2 }} />
                <Stack>
                    <Flag flagKey="hideClosure" label={t("f.hideClosure")} />
                    <Flag flagKey="hideCaution" label={t("f.hideCaution")} />
                    <Flag flagKey="hideNoFamily" label={t("f.hideNoFamily")} />
                    <Flag flagKey="onlyMapped" label={t("f.onlyMapped")} />
                </Stack>
            </Box>

            <Divider />
            <Box sx={{ px: 2, pt: 1.5, pb: "max(12px, var(--sab))" }}>
                <Button fullWidth variant="contained" onClick={close}>
                    {t("f.show", { 0: `${shown.length}` })}
                </Button>
            </Box>
        </>
    );
};

/** A sheet over everything, opened from the filter button, at every screen size. */
export const FiltersDrawer = () => {
    const dispatch = useAppDispatch();
    const open = useAppSelector((s) => s.ui.filtersOpen);
    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={() => dispatch(uiActions.setFiltersOpen(false))}
            // The sheet covers the whole screen, status bar included: its header starts below that.
            slotProps={{
                paper: { sx: { width: { xs: "100%", sm: 400, md: 440 }, pt: "var(--sat)" } },
            }}
        >
            <FiltersBody />
        </Drawer>
    );
};
