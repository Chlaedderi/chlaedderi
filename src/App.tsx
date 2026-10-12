/**
 * The shell: a bar with the region tabs on top, a bottom navigation on a phone, and the routes in
 * between.
 *
 * Routing is a hash router on purpose. The old app addressed a crag with `#<crag-id>` and its pages
 * with `#/fav`, `#/more`, `#/log`, and those links are in people's bookmarks and shared messages --
 * so `features/shell/LegacyLink.tsx` answers the bare `#<crag-id>` form too.
 */

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import FavoriteIcon from "@mui/icons-material/Favorite";
import MapIcon from "@mui/icons-material/Map";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes, useLocation, useMatch, useNavigate } from "react-router-dom";

import { FilterUrl } from "@app/FilterUrl";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { useLayout } from "@app/layout";
import { Persistence } from "@app/Persistence";
import { uiActions } from "@app/slices/uiSlice";

import { CragList } from "./features/list/CragList";
import { FiltersDrawer } from "./features/list/FiltersDrawer";
import { MapPane } from "./features/map/MapPane";
import { RevealRoute } from "./features/map/RevealRoute";
import { AppBarTop } from "./features/shell/AppBarTop";
import { InstallHint } from "./features/shell/InstallHint";
import { LegacyLink } from "./features/shell/LegacyLink";
import { PackLink } from "./features/shell/PackLink";
import { ShareTarget } from "./features/shell/ShareTarget";
import { Toasts } from "./features/shell/Toasts";
import { UpdateBanner } from "./features/shell/UpdateBanner";

/**
 * The map, the list and a crag are what the app opens with, so they are in the first bundle.
 * Everything else is a page the viewer has to go to, and arrives when they do -- which keeps the
 * first load small on the mobile connection this app is actually used on.
 */
const CragPage = lazy(async () => ({
    default: (await import("./features/crag/CragPage")).CragPage,
}));
const FavouritesPage = lazy(async () => ({
    default: (await import("./features/favourites/FavouritesPage")).FavouritesPage,
}));
const KnowPage = lazy(async () => ({
    default: (await import("./features/know/KnowPage")).KnowPage,
}));
const LogbookPage = lazy(async () => ({
    default: (await import("./features/logbook/LogbookPage")).LogbookPage,
}));
const MorePage = lazy(async () => ({
    default: (await import("./features/more/MorePage")).MorePage,
}));
const PackPage = lazy(async () => ({
    default: (await import("./features/more/PackPage")).PackPage,
}));
const CoveragePage = lazy(async () => ({
    default: (await import("./features/more/CoveragePage")).CoveragePage,
}));
const PacksDialog = lazy(async () => ({
    default: (await import("./features/packs/PacksDialog")).PacksDialog,
}));
const PackOffer = lazy(async () => ({
    default: (await import("./features/packs/PackOffer")).PackOffer,
}));

/**
 * The way out of the detail column, the original's `#back` button.
 *
 * It says «back» where the crag covers what you came from -- a phone, or the list on a middling
 * screen -- because there it really is a page you went into. In the wide layout the crag is a
 * column beside the map and nothing is being gone back from, so there it closes.
 */
const DetailBack = ({ beside }: { beside: boolean }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    return (
        <Button
            size="small"
            startIcon={beside ? <CloseIcon /> : <ArrowBackIcon />}
            onClick={() => void navigate("/")}
        >
            {t(beside ? "close" : "back")}
        </Button>
    );
};

/**
 * The crag, filling whatever it is put in: a column of its own on a big screen, over the list on a
 * middling one, over the map on a phone. The original's `#detail{position:absolute;inset:0}`.
 *
 * `beside` says it stands next to the map rather than over something, which is what the way out is
 * worded from. `bar` is whether it carries that way out at all: on a phone the app bar already has
 * a back arrow, and a second «back» right under it was one control shown twice -- two controls,
 * in fact, since the bar went back in history and this one went home.
 *
 * The page is keyed on the crag: with the map now able to swap the crag under an open column, a
 * kept-alive page would carry the one before it -- where it was scrolled to, which section the
 * rail thinks you are in, and the route a half-filled log sheet was opened for, which would then
 * be saved against the crag that replaced it.
 */
const CragColumn = ({
    cragId,
    beside,
    bar = true,
}: {
    cragId: string | null;
    beside: boolean;
    bar?: boolean;
}) => (
    <Box
        sx={{
            position: "absolute",
            inset: 0,
            // Above Leaflet's own panes, which reach 700 for popups: on a phone this lies over
            // the map, which is still mounted underneath so that it keeps the viewer's view.
            zIndex: (theme) => theme.zIndex.appBar - 1,
            bgcolor: "background.paper",
            overflowY: "auto",
        }}
    >
        {/* The original's `.dhead`: sticky, with the way back. */}
        {bar && (
            <Box
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    bgcolor: "background.paper",
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <DetailBack beside={beside} />
            </Box>
        )}
        <Suspense fallback={<RouteFallback />}>
            <CragPage key={cragId} />
        </Suspense>
    </Box>
);

/** Map and list side by side on a wide screen; the list slides over the map on a phone. */
const Home = () => {
    const cragId = useMatch("/crag/:id")?.params.id ?? null;
    // The breakpoints live in `useLayout` because the map needs the same answer: whether the crag
    // page covers it decides whether a camera move is worth animating. Between `md` and `lg` a
    // third column would leave about 210px of map, which is not a map -- there the crag covers the
    // list, as it used to. The choice is made here rather than in CSS so that the crag page is
    // mounted once, not twice with one of them hidden: it is the heaviest page in the app, and two
    // of it put two of everything -- two headings, two route lists -- into the document.
    const { wide, threeCol } = useLayout();
    const dispatch = useAppDispatch();
    const listOpen = useAppSelector((s) => s.ui.listOpen);

    if (wide) {
        // The crag overview on the left, the map in the middle, the crag itself on the right.
        // The original put the filters in a permanent left column; they are now behind the
        // filter icon, like everywhere else, which gives that width to the map and gives the
        // wide layout back the «reset» button the permanent column never had.
        return (
            <Box
                sx={{
                    display: "grid",
                    // 344px is what the list column has always been: narrower and the count line
                    // and the sort control in its toolbar start eliding each other.
                    gridTemplateColumns:
                        threeCol && cragId ? "344px minmax(0,1fr) 400px" : "344px minmax(0,1fr)",
                    // `minmax(0, 1fr)` and the `minHeight: 0` on each column are what make the
                    // panes scroll instead of the page. A grid item defaults to
                    // `min-height: auto`, so a tall column stretches the row past the container
                    // and its own `overflow: auto` never fires -- on a short window the list
                    // simply ran off the bottom.
                    gridTemplateRows: "minmax(0, 1fr)",
                    height: "100%",
                    minHeight: 0,
                    "& > *": { minHeight: 0 },
                }}
            >
                <Box
                    sx={{
                        position: "relative",
                        minWidth: 0,
                        minHeight: 0,
                        borderRight: 1,
                        borderColor: "divider",
                    }}
                >
                    <CragList />
                    {cragId && !threeCol && <CragColumn cragId={cragId} beside={false} />}
                </Box>
                <Box sx={{ minWidth: 0, minHeight: 0 }}>
                    <MapPane />
                </Box>
                {cragId && threeCol && (
                    <Box
                        sx={{
                            position: "relative",
                            minWidth: 0,
                            minHeight: 0,
                            borderLeft: 1,
                            borderColor: "divider",
                        }}
                    >
                        <CragColumn cragId={cragId} beside />
                    </Box>
                )}
            </Box>
        );
    }

    return (
        // `overflow: hidden` matters: the list pane below is parked with `translateY(100%)`, and a
        // transform still counts towards the scrollable area -- without this the document grew to
        // twice the viewport and the tab bar could be scrolled off the screen.
        <Box sx={{ position: "relative", height: "100%", overflow: "hidden" }}>
            <MapPane />
            {/*
             * The list is parked off the bottom rather than unmounted, so sliding it up is a
             * transform and not a rebuild -- but not while a crag covers the screen, where it
             * would only be a few hundred cards nobody can see or reach.
             */}
            {!cragId && (
                <Paper
                    elevation={8}
                    sx={{
                        position: "absolute",
                        inset: 0,
                        zIndex: (theme) => theme.zIndex.appBar - 1,
                        transform: listOpen ? "none" : "translateY(100%)",
                        transition: "transform .25s ease",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <CragList />
                </Paper>
            )}
            {/*
             * The crag covers the map rather than replacing it. The map is slow to build and holds
             * where the viewer was looking; a trip into a crag and back used to throw both away.
             */}
            {cragId && <CragColumn cragId={cragId} beside={false} bar={false} />}
            {!cragId && (
                <Box
                    sx={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: (theme) => theme.zIndex.appBar,
                        display: "flex",
                        justifyContent: "center",
                        pb: 1,
                        pointerEvents: "none",
                    }}
                >
                    <Box
                        component="button"
                        onClick={() => dispatch(uiActions.setListOpen(!listOpen))}
                        sx={{
                            pointerEvents: "auto",
                            border: 1,
                            borderColor: "divider",
                            bgcolor: "background.paper",
                            color: "text.primary",
                            px: 2,
                            py: 0.75,
                            borderRadius: 999,
                            font: "inherit",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        <ListToggleLabel open={listOpen} />
                    </Box>
                </Box>
            )}
        </Box>
    );
};

const ListToggleLabel = ({ open }: { open: boolean }) => {
    const { t } = useTranslation();
    return <>{open ? t("tab.map") : t("tab.list")}</>;
};

const BottomNav = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const current = pathname.startsWith("/fav")
        ? "/fav"
        : pathname.startsWith("/log")
          ? "/log"
          : pathname.startsWith("/more")
            ? "/more"
            : "/";

    return (
        <Paper
            square
            elevation={3}
            sx={(theme) => ({
                borderTop: 1,
                borderColor: "divider",
                pb: "var(--sab)",
                zIndex: theme.zIndex.appBar,
            })}
        >
            <BottomNavigation
                showLabels
                value={current}
                // As tall as the original's tab bar: below it the home indicator, or on the
                // home-screen app WebKit's strip (see viewport.ts), adds room of its own.
                sx={{ height: 50, "& .MuiBottomNavigationAction-root": { pt: 0.5, pb: 0.25 } }}
                onChange={(_e, value: string) => void navigate(value)}
            >
                <BottomNavigationAction label={t("tab.map")} value="/" icon={<MapIcon />} />
                <BottomNavigationAction label={t("tab.fav")} value="/fav" icon={<FavoriteIcon />} />
                <BottomNavigationAction label={t("tab.log")} value="/log" icon={<MenuBookIcon />} />
                <BottomNavigationAction
                    label={t("tab.more")}
                    value="/more"
                    icon={<MoreHorizIcon />}
                />
            </BottomNavigation>
        </Paper>
    );
};

/** While a page is on its way. Deliberately quiet: the pages arrive in a few milliseconds. */
const RouteFallback = () => (
    <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
        <CircularProgress size={28} />
    </Box>
);

export const App = () => (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <Persistence />
        <FilterUrl />
        <RevealRoute />
        <AppBarTop />
        <Box component="main" sx={{ flex: 1, minHeight: 0, position: "relative" }}>
            <Routes>
                {/*
                 * The map and a crag share one mounted shell, as a parent route, so that opening
                 * a crag does not take the map down with it. As siblings they rendered different
                 * components in the same place, React threw the whole subtree away, and Leaflet
                 * came back at the region's default view -- whatever the viewer had panned and
                 * zoomed to was lost on the way in and lost again on the way back.
                 */}
                <Route element={<Home />}>
                    <Route path="/" element={null} />
                    <Route path="/crag/:id" element={null} />
                </Route>
                <Route
                    path="/fav"
                    element={
                        <Suspense fallback={<RouteFallback />}>
                            <FavouritesPage />
                        </Suspense>
                    }
                />
                <Route
                    path="/log"
                    element={
                        <Suspense fallback={<RouteFallback />}>
                            <LogbookPage />
                        </Suspense>
                    }
                />
                <Route
                    path="/more"
                    element={
                        <Suspense fallback={<RouteFallback />}>
                            <MorePage />
                        </Suspense>
                    }
                />
                <Route
                    path="/know"
                    element={
                        <Suspense fallback={<RouteFallback />}>
                            <KnowPage />
                        </Suspense>
                    }
                />
                <Route
                    path="/page/:pageId"
                    element={
                        <Suspense fallback={<RouteFallback />}>
                            <PackPage />
                        </Suspense>
                    }
                />
                <Route
                    path="/coverage"
                    element={
                        <Suspense fallback={<RouteFallback />}>
                            <CoveragePage />
                        </Suspense>
                    }
                />
                {/* A link that carries a whole region rather than a crag. */}
                <Route path="/pack" element={<PackLink />} />
                {/* What the share sheet left: the service worker turns its POST into this. */}
                <Route path="/share" element={<ShareTarget />} />
                {/* `#<cragId>` and `#<cragId>~<routeKey>` from the hand-written app. */}
                <Route path="*" element={<LegacyLink />} />
            </Routes>
        </Box>
        {/* `nav.tabs` only existed inside the phone media query. */}
        <Box sx={{ display: { xs: "block", md: "none" } }}>
            <BottomNav />
        </Box>
        <FiltersDrawer />
        <Suspense fallback={null}>
            <PacksDialog />
        </Suspense>
        <Suspense fallback={null}>
            <PackOffer />
        </Suspense>
        <Toasts />
        <UpdateBanner />
        <InstallHint />
    </Box>
);
