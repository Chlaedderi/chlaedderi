/**
 * The routes of a crag.
 *
 * Numbered: where the order on the wall is known the number is the place on the wall from left to
 * right, otherwise the place in the list -- and either way the number stays with the route when
 * the list is sorted, because it comes from `ord`. Which of those it is depends on the pack's
 * `ord`, and the page says so underneath, as the original did.
 *
 * A port of `routesHTML` (index.html:4580). The first React pass rendered the rows and nothing
 * else: no sort control, no «matching / all» toggle when a filter is on, no sector headings, and
 * none of the lines that explain what the numbers and the stars mean.
 */

import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ShareIcon from "@mui/icons-material/Share";
import StarIcon from "@mui/icons-material/Star";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { useAppSelector } from "@app/hooks";
import { useAppDispatch } from "@app/hooks";
import { selectFilters } from "@app/selectors";
import { favouritesActions } from "@app/slices/favouritesSlice";
import {
    useFilterContext,
    useLang,
    useLogIndex,
    usePackKeyOf,
    usePackUrlOf,
} from "@app/useAppData";
import { longText } from "@core/dataText";
import { routeFilterOn, routeOk } from "@core/filters";
import { bestEntry, isSend } from "@core/logbook";
import type { Crag, Route } from "@domain/model";

import { useShare } from "../shell/useShare";

type SortKey = "list" | "grade" | "star" | "len";

const RouteRow = ({
    crag,
    route,
    onLog,
    dim,
    number,
    packUrl,
    packKey,
}: {
    crag: Crag;
    route: Route;
    onLog: (route: Route) => void;
    dim: boolean;
    number: number | null;
    /** Looked up once by the list, not once per row: a big crag has a hundred of these. */
    packUrl: string | null;
    packKey: string | null;
}) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const share = useShare();
    const log = useLogIndex();
    const isFav = useAppSelector((s) => s.favourites.routes.includes(route.key));
    const entries = log.byRoute[route.key] ?? [];
    const best = bestEntry(entries);
    const done = entries.some(isSend);

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.6,
                borderBottom: 1,
                borderColor: "divider",
                opacity: dim ? 0.45 : 1,
            }}
        >
            <Typography
                variant="body2"
                color="text.secondary"
                className="num"
                sx={{ width: 26, textAlign: "right" }}
                {...(number != null ? { title: t("r.nr.t", { 0: number }) } : {})}
            >
                {number ?? ""}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" className="kat-ellipsis">
                    {route.name}
                </Typography>
                {route.stars && (
                    <Stack direction="row" sx={{ alignItems: "center", gap: 0.25 }}>
                        <StarIcon sx={{ fontSize: 12, color: "marker.rate" }} />
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            className="num"
                            title={t("r.star.t", {
                                0: route.stars[0].toFixed(1),
                                1: route.stars[1],
                            })}
                        >
                            {route.stars[0].toFixed(1)} ({route.stars[1]})
                        </Typography>
                    </Stack>
                )}
            </Box>
            {route.length != null && (
                <Typography variant="caption" color="text.secondary" className="num">
                    {route.length} m
                </Typography>
            )}
            {route.pitches != null && route.pitches > 1 && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    className="num"
                    title={t("r.mp")}
                >
                    {t("r.pitches", { 0: route.pitches })}
                </Typography>
            )}
            <Typography
                variant="body2"
                className="num"
                sx={{ width: 42, textAlign: "right", fontWeight: 600 }}
            >
                {route.grade ?? "–"}
            </Typography>
            <IconButton
                size="small"
                aria-label={t("r.share.t")}
                onClick={() =>
                    void share(route.key, `${route.name}, ${crag.name}`, packUrl, packKey)
                }
            >
                <ShareIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton
                size="small"
                aria-label={t(isFav ? "fav.t.rm" : "fav.t.add")}
                onClick={() => dispatch(favouritesActions.toggleRoute(route.key))}
            >
                {isFav ? (
                    <FavoriteIcon sx={{ fontSize: 16, color: "marker.fav" }} />
                ) : (
                    <FavoriteBorderIcon sx={{ fontSize: 16 }} />
                )}
            </IconButton>
            <IconButton size="small" aria-label={t("lb.new")} onClick={() => onLog(route)}>
                {done ? (
                    <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                ) : best ? (
                    <AddCircleOutlineIcon sx={{ fontSize: 18, color: "warning.main" }} />
                ) : (
                    <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
                )}
            </IconButton>
        </Box>
    );
};

export const RouteList = ({ crag, onLog }: { crag: Crag; onLog: (route: Route) => void }) => {
    const { t } = useTranslation();
    const lang = useLang();
    const packUrl = usePackUrlOf(crag);
    const packKey = usePackKeyOf(crag);
    const filters = useAppSelector(selectFilters);
    const ctx = useFilterContext();
    const [sort, setSort] = useState<SortKey>("list");
    const [onlyMatching, setOnlyMatching] = useState(true);
    // A link to one route (`#<crag>~<route>`) arrives with that route in the navigation state.
    const { state } = useLocation();
    const linked = (state as { route?: unknown } | null)?.route;
    const linkedKey = typeof linked === "string" ? linked : null;

    const filtered = routeFilterOn(filters);
    const matching = useMemo(
        () => (filtered ? crag.routes.filter((r) => routeOk(r, filters, ctx)) : crag.routes),
        [crag.routes, filters, ctx, filtered],
    );

    // Show the linked route, and once: the link is for it, so the list must not hide it behind
    // the viewer's filters, and the page goes to it rather than staying at the top.
    const shownLink = useRef<string | null>(null);
    useEffect(() => {
        if (!linkedKey || shownLink.current === linkedKey) return;
        if (filtered && !matching.some((r) => r.key === linkedKey)) setOnlyMatching(false);
        shownLink.current = linkedKey;
        const frame = requestAnimationFrame(() => {
            document
                .querySelector(`[data-route="${CSS.escape(linkedKey)}"]`)
                ?.scrollIntoView({ block: "center" });
        });
        return () => cancelAnimationFrame(frame);
    }, [linkedKey, filtered, matching]);
    // «Matching» is only offered -- and only chosen -- when it would actually show something.
    const useMatch = filtered && onlyMatching && matching.length > 0;

    // Length can only be sorted on when the pack gives a length per route.
    const hasLength = crag.routes.some((r) => r.length != null);
    const sortKeys: SortKey[] = ["list", "grade", "star", ...(hasLength ? (["len"] as const) : [])];
    const active: SortKey = sortKeys.includes(sort) ? sort : "list";

    const list = useMemo(() => {
        const base = (useMatch ? matching : crag.routes).slice();
        if (active === "grade")
            base.sort((a, b) => (a.gradeIdx ?? 99) - (b.gradeIdx ?? 99) || a.ord - b.ord);
        else if (active === "star")
            base.sort(
                (a, b) =>
                    (b.stars?.[0] ?? 0) - (a.stars?.[0] ?? 0) ||
                    (b.stars?.[1] ?? 0) - (a.stars?.[1] ?? 0) ||
                    a.ord - b.ord,
            );
        else if (active === "len")
            base.sort((a, b) => (b.length ?? 0) - (a.length ?? 0) || a.ord - b.ord);
        return base;
    }, [useMatch, matching, crag.routes, active]);

    if (!crag.routes.length) {
        return (
            <Box>
                {crag.rnote && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                        {longText(crag, "rnote", lang)}
                    </Alert>
                )}
                <Typography variant="body2" color="text.secondary">
                    {t(crag.nRoutes ? "r.none.count" : "r.none")}
                </Typography>
            </Box>
        );
    }

    /** The sector a route falls in, and whether that sector's place is unknown. */
    const sectorOf = (ord: number): { n: string; i: number } | null => {
        let found: { n: string; i: number } | null = null;
        for (const s of crag.secs ?? []) if (s.i <= ord) found = s;
        return found;
    };

    // The numbering only restarts per sector where the list is in its own order.
    const numbered = active === "list" && !useMatch;

    return (
        <Box>
            <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap", mb: 1 }}
            >
                {filtered && (
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={useMatch ? "match" : "all"}
                        onChange={(_e, v: string | null) => v && setOnlyMatching(v === "match")}
                    >
                        <ToggleButton value="match">
                            {t("r.match", { 0: matching.length })}
                        </ToggleButton>
                        <ToggleButton value="all">
                            {t("r.all", { 0: crag.routes.length })}
                        </ToggleButton>
                    </ToggleButtonGroup>
                )}
                <Box sx={{ flex: 1 }} />
                <TextField
                    select
                    size="small"
                    label={t("r.sort")}
                    value={active}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    sx={{ minWidth: 140 }}
                >
                    {sortKeys.map((key) => (
                        <MenuItem key={key} value={key}>
                            {t(`r.sort.${key}`)}
                        </MenuItem>
                    ))}
                </TextField>
            </Stack>

            {filtered && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {t("r.filter.hint")}
                </Typography>
            )}
            {crag.rnote && (
                <Alert severity="warning" sx={{ my: 1 }}>
                    {longText(crag, "rnote", lang)}
                </Alert>
            )}
            {crag.ord === "vl" && (
                <Alert severity="info" sx={{ my: 1 }}>
                    {t("r.nr.vl")}
                </Alert>
            )}

            <Box sx={{ mt: 1 }}>
                {list.map((route) => {
                    const sector = sectorOf(route.ord);
                    const unknownPlace = sector?.n === "?";
                    const head =
                        numbered && sector && sector.i === route.ord ? (
                            <Typography
                                key={`h${route.key}`}
                                variant="subtitle2"
                                sx={{ mt: 1.5, color: "text.secondary" }}
                            >
                                {unknownPlace ? t("r.sec.unk") : sector.n}
                            </Typography>
                        ) : null;

                    const number =
                        crag.ord === "vl" || unknownPlace
                            ? null
                            : sector
                              ? route.ord - sector.i + 1
                              : route.ord + 1;

                    return (
                        <Box
                            key={route.key}
                            data-route={route.key}
                            sx={
                                route.key === linkedKey
                                    ? { bgcolor: "action.selected", borderRadius: 1 }
                                    : undefined
                            }
                        >
                            {head}
                            <RouteRow
                                crag={crag}
                                route={route}
                                onLog={onLog}
                                number={number}
                                dim={filtered && !useMatch && !matching.includes(route)}
                                packUrl={packUrl}
                                packKey={packKey}
                            />
                        </Box>
                    );
                })}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {t(
                    crag.ord === "vl"
                        ? "r.nr.vl"
                        : crag.ord === "tc"
                          ? "r.nr.tc"
                          : crag.ord === "tcp"
                            ? "r.nr.tcp"
                            : "r.nr.hint",
                )}
                {crag.secs ? ` ${t("r.nr.sec")}` : ""}
            </Typography>
            {!hasLength && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {t("r.len.none")}
                </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {crag.rate ? t("r.stars.hint") : t("r.nostars")} {t("r.log.hint")}
            </Typography>
        </Box>
    );
};
