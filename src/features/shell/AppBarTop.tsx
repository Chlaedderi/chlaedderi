/**
 * The app bar: search, the filter button, and the region switch with its «+».
 *
 * Search lives **here**, not inside the list, because it is how you find a crag whether you are
 * looking at the map or at the list. (My first pass put the search field inside the list pane,
 * which meant that on the map -- the screen the app opens on -- there was no search at all.)
 */

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Close";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FilterListIcon from "@mui/icons-material/FilterList";
import MapIcon from "@mui/icons-material/Map";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import SearchIcon from "@mui/icons-material/Search";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { selectFilters } from "@app/selectors";
import { filtersActions } from "@app/slices/filtersSlice";
import { uiActions } from "@app/slices/uiSlice";
import { useLang, useRegion } from "@app/useAppData";
import { activeCount } from "@core/filters";
import { formatDate, formatInt } from "@i18n/index";

import { QuickChips } from "./QuickChips";
import { RegionSegment } from "./RegionSegment";

export const AppBarTop = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { pathname, key } = useLocation();
    /**
     * Whether the app was opened straight onto this page, rather than walked to.
     *
     * `key === "default"` says so only of the *first* location, and several things replace it
     * before the back arrow is ever pressed: `LegacyLink` turns `#<cragId>` into `/crag/<id>`, and
     * `FilterUrl` writes the filters into the query. Both mint a fresh key, and the arrow would
     * then offer to go back to a page that is not the app. The bar is mounted once, outside
     * `Routes`, and never unmounts, so the key it saw first is the one to ask.
     */
    const firstKey = useRef(key);
    const q = useAppSelector((s) => s.filters.q);
    const filters = useAppSelector(selectFilters);
    const active = activeCount(filters);
    const { crags, regions } = useData();
    const region = useRegion();
    const lang = useLang();

    // «n crags in m areas · k routes · data as of …», or that nothing is loaded.
    const here = crags.filter((c) => c.packId === region?.key);
    const subline = regions.length
        ? t("app.sub", {
              0: formatInt(here.length, lang),
              1: region?.areas.length ?? 0,
              2: formatInt(
                  here.reduce((n, c) => n + c.routes.length, 0),
                  lang,
              ),
              3:
                  (region?.updated ?? region?.accessed)
                      ? formatDate((region.updated ?? region.accessed)!, lang)
                      : "–",
          })
        : t("app.sub.none");

    // On a page one level down, the bar carries a way back instead of the search -- but only on a
    // phone. The original's header sat outside `main` and never changed; the way back was the
    // detail pane's own `.dhead`, not the app bar. On a phone this arrow is now the only one: the
    // crag column leaves its `.dhead` out there (see `CragColumn` in App.tsx).
    const wide = useMediaQuery(useTheme().breakpoints.up("md"));
    const deep = pathname !== "/" && !wide;

    if (deep) {
        return (
            <AppBar position="static" color="default" elevation={0}>
                <Toolbar
                    variant="dense"
                    className="kat-band"
                    sx={{ gap: 1, minHeight: 48, pt: "calc(8px + var(--sat))", pb: 1 }}
                >
                    <IconButton
                        color="inherit"
                        edge="start"
                        // History back only when there is a page of the app to go back to. Opened
                        // from a shared link, the entry before is somebody else's page -- or none,
                        // in the installed app -- so there the way back is the map.
                        onClick={() =>
                            void (firstKey.current === "default" ? navigate("/") : navigate(-1))
                        }
                        aria-label={t("back")}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Box sx={{ flex: 1 }} />
                    <RegionSegment />
                </Toolbar>
            </AppBar>
        );
    }

    return (
        <AppBar position="static" color="default" elevation={0}>
            <Toolbar
                variant="dense"
                className="kat-band"
                sx={{ gap: 1, minHeight: 48, pt: "calc(8px + var(--sat))", pb: 1 }}
            >
                {/* The original's logo: the favicon the browser has loaded anyway, so no extra bytes. */}
                <Box
                    component="img"
                    src="favicon.svg"
                    alt=""
                    sx={{
                        width: 34,
                        height: 34,
                        borderRadius: "9px",
                        flex: "none",
                        boxShadow: "0 0 0 1px rgb(255 255 255 / 25%)",
                    }}
                />
                <TextField
                    size="small"
                    fullWidth
                    type="search"
                    value={q}
                    onChange={(e) => dispatch(filtersActions.setQuery(e.target.value))}
                    placeholder={t("search.ph")}
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            bgcolor: "background.paper",
                            borderRadius: 999,
                            color: "text.primary",
                        },
                        "& .MuiOutlinedInput-notchedOutline": { border: 0 },
                    }}
                    slotProps={{
                        htmlInput: { "aria-label": t("search.label") },
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: q ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        aria-label={t("close")}
                                        onClick={() => dispatch(filtersActions.setQuery(""))}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        },
                    }}
                />
                {/*
                 * On every screen size now. The original kept a permanent filter column on a wide
                 * screen, which cost the map a quarter of its width for something most people set
                 * once -- and that column had no «reset», because reset lives in the drawer's
                 * header. The badge says how many filters are on, which the column never did.
                 */}
                <IconButton
                    color="inherit"
                    onClick={() => dispatch(uiActions.setFiltersOpen(true))}
                    aria-label={t("filters")}
                >
                    {/* Hidden at zero, as the original's #fcount was. */}
                    <Badge badgeContent={active} color="secondary" invisible={active === 0}>
                        <FilterListIcon />
                    </Badge>
                </IconButton>

                {/*
                 * `.lgonly`: on a wide screen these replace the phone's bottom tab bar, so they
                 * carry «Map» too. The original had only the three and relied on them toggling
                 * back -- which left no visible way home on a screen with no tab bar.
                 */}
                <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5 }}>
                    {(
                        [
                            ["/", "tab.map", <MapIcon key="p" />],
                            ["/fav", "tab.fav", <FavoriteIcon key="f" />],
                            ["/log", "tab.log", <MenuBookIcon key="l" />],
                            ["/more", "tab.more", <MoreHorizIcon key="m" />],
                        ] as const
                    ).map(([to, label, icon]) => (
                        <Button
                            key={to}
                            size="small"
                            color="inherit"
                            startIcon={icon}
                            aria-pressed={to === "/" ? pathname === "/" : pathname.startsWith(to)}
                            // A toggle, as the original's were:
                            // `setView(view==="fav" ? "map" : "fav")`. Without this the wide
                            // layout has no way back to the map at all -- it has no tab bar.
                            onClick={() => void navigate(pathname.startsWith(to) ? "/" : to)}
                            sx={{
                                color: (to === "/" ? pathname === "/" : pathname.startsWith(to))
                                    ? "var(--bar-ink)"
                                    : "rgb(255 255 255 / 78%)",
                                fontWeight: (
                                    to === "/" ? pathname === "/" : pathname.startsWith(to)
                                )
                                    ? 700
                                    : 500,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {t(label)}
                        </Button>
                    ))}
                </Box>
            </Toolbar>

            <Box
                sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    px: 1,
                    pb: 0.5,
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <RegionSegment />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <QuickChips />
                </Box>
            </Box>

            {/* The original's `#subline`: what the loaded region holds, and how old the data is. */}
            <Typography
                variant="caption"
                color="text.secondary"
                className="kat-ellipsis"
                sx={{ display: { xs: "none", sm: "block" }, px: 1, pb: 0.5 }}
            >
                {subline}
            </Typography>
        </AppBar>
    );
};
