/**
 * Above the list: how many crags match, and how they are sorted.
 *
 * Search and the filter button are **not** here -- they belong to the app bar, where they are
 * reachable from the map too.
 */

import SwapVertIcon from "@mui/icons-material/SwapVert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { selectFilters } from "@app/selectors";
import { filtersActions } from "@app/slices/filtersSlice";
import { useRegionCrags, useShownCrags } from "@app/useAppData";
import { routeSummary } from "@core/filters";
import { SORTS } from "@core/filters";

export const ListToolbar = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const filters = useAppSelector(selectFilters);
    const sort = useAppSelector((s) => s.filters.sort);
    const dir = useAppSelector((s) => s.filters.dir);
    const shown = useShownCrags();
    const all = useRegionCrags();
    const mapped = shown.filter((m) => m.crag.coord).length;

    // What the route criteria mean together, in words. Empty unless one of them is on.
    const summary = routeSummary(filters, t);

    return (
        <Box>
            <Stack
                direction="row"
                spacing={1}
                sx={{
                    px: 1,
                    py: 0.75,
                    alignItems: "center",
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <Typography
                    variant="body2"
                    color="text.secondary"
                    className="kat-ellipsis"
                    sx={{ flex: 1 }}
                >
                    {t("count", { 0: shown.length, 1: all.length })}
                    {" · "}
                    {t("count.map", { 0: mapped, 1: shown.length - mapped })}
                </Typography>
                <TextField
                    select
                    size="small"
                    value={sort}
                    onChange={(e) =>
                        dispatch(filtersActions.setSort(e.target.value as typeof sort))
                    }
                    sx={{ minWidth: 130 }}
                    aria-label={t("sort")}
                    slotProps={{ select: { "aria-label": t("sort") } }}
                >
                    {SORTS.map((key) => (
                        <MenuItem key={key} value={key}>
                            {t(`sort.${key}`)}
                        </MenuItem>
                    ))}
                </TextField>
                <IconButton
                    onClick={() => dispatch(filtersActions.toggleDir())}
                    aria-label={t("sort.dir")}
                >
                    <SwapVertIcon sx={{ transform: dir < 0 ? "scaleY(-1)" : undefined }} />
                </IconButton>
            </Stack>
            {summary && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", px: 1, py: 0.5 }}
                >
                    {summary}
                </Typography>
            )}
        </Box>
    );
};
