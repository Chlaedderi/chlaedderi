import BarChartIcon from "@mui/icons-material/BarChart";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import ExploreIcon from "@mui/icons-material/Explore";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import HardwareIcon from "@mui/icons-material/Hardware";
import HeightIcon from "@mui/icons-material/Height";
import LandscapeIcon from "@mui/icons-material/Landscape";
import NearMeIcon from "@mui/icons-material/NearMe";
import OpacityIcon from "@mui/icons-material/Opacity";
import ShareIcon from "@mui/icons-material/Share";
import StarIcon from "@mui/icons-material/Star";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import WbCloudyIcon from "@mui/icons-material/WbCloudy";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { favouritesActions } from "@app/slices/favouritesSlice";
import { uiActions } from "@app/slices/uiSlice";
import {
    useFilterContext,
    useLang,
    usePackKeyOf,
    usePackUrlOf,
    useRegionOf,
} from "@app/useAppData";
import { useWeather } from "@app/weatherContext";
import { longText, orientLabel, shortText } from "@core/dataText";
import { formatDistance } from "@core/geo";
import { BANDS } from "@core/grades";
import type { LogEntry } from "@core/logbook";
import { i18 } from "@core/text";
import type { Route } from "@domain/model";

import { LogSheet } from "../logbook/LogSheet";
import { PackInline } from "../packs/PackText";
import { useShare } from "../shell/useShare";
import { CragForecast } from "../weather/ForecastSection";
import { WeatherCard } from "../weather/WeatherCard";

import { ApproachSection } from "./ApproachSection";
import { CragLinks } from "./CragLinks";
import { CragLogbook } from "./CragLogbook";
import { CragMore } from "./CragMore";
import { gradesText, lengthText } from "./cragText";
import { DryEstimate } from "./DryEstimate";
import { Gallery } from "./Gallery";
import { JumpRail } from "./JumpRail";
import { RouteList } from "./RouteList";
import { SectionTitle } from "./SectionTitle";

/** A labelled fact, the shape most of the crag page is made of. */
const Fact = ({ label, value }: { label: string; value: React.ReactNode }) =>
    value == null || value === "" ? null : (
        <Box sx={{ minWidth: 110 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {label}
            </Typography>
            <Typography variant="body2">{value}</Typography>
        </Box>
    );

/**
 * One of the original's `.glance` tiles: icon square, big value, small label, a coloured edge.
 * `color` is a CSS colour (a token), `Icon` an MUI icon.
 */
const Tile = ({
    label,
    value,
    Icon,
    color,
}: {
    label: string;
    value: React.ReactNode;
    Icon: typeof StarIcon;
    color: string;
}) =>
    value == null || value === "" ? null : (
        <Box
            sx={{
                position: "relative",
                minWidth: 0,
                minHeight: 56,
                display: "grid",
                alignContent: "center",
                gap: "1px",
                py: 1,
                pr: 1,
                pl: "45px",
                border: 1,
                borderColor: "divider",
                borderLeft: `4px solid ${color}`,
                borderRadius: "var(--r)",
                background: `linear-gradient(90deg, color-mix(in srgb, ${color} 9%, var(--raise)), var(--raise) 70%)`,
            }}
        >
            <Box
                aria-hidden
                sx={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 29,
                    height: 29,
                    borderRadius: "9px",
                    display: "grid",
                    placeItems: "center",
                    color,
                    bgcolor: `color-mix(in srgb, ${color} 17%, transparent)`,
                }}
            >
                <Icon sx={{ fontSize: 17 }} />
            </Box>
            <Box
                component="b"
                sx={{ font: "700 19px/1.1 var(--display)", overflowWrap: "anywhere" }}
            >
                {value}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25 }}>
                {label}
            </Typography>
        </Box>
    );

export const CragPage = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const share = useShare();
    const ctx = useFilterContext();
    const { stateOf } = useWeather();
    const { byId, booted } = useData();
    const crag = id ? byId[id] : undefined;
    const region = useRegionOf(crag);
    const packUrl = usePackUrlOf(crag);
    const packKey = usePackKeyOf(crag);
    const isFav = useAppSelector((s) => s.favourites.crags.includes(crag?.id ?? ""));
    const [logRoute, setLogRoute] = useState<Route | null>(null);
    const [logEntry, setLogEntry] = useState<LogEntry | null>(null);
    const [logCustom, setLogCustom] = useState(false);

    // Put this crag on the map beside the page. A link straight to `/crag/:id` -- shared, or kept
    // as a bookmark -- used to leave the map showing the whole region and nothing in particular.
    //
    // The route is the one answer to which crag is open, and this copies it to the map: one way,
    // which is why it watches only the route. It used to watch `ui.selectedId` too, and so ran
    // again on a selection it had not made -- ready to put the route's crag back over a crag the
    // viewer had just chosen on the map. What stops that today is that the map writes to the route
    // (`MapPane`'s `choose`) rather than to the store alone, but a one-way sync that reads both
    // ends is a race waiting for the next caller, so it reads one.
    useEffect(() => {
        if (id) dispatch(uiActions.select(id));
    }, [id, dispatch]);

    // An installed region is read back out of the cache after the first render; a link to one of
    // its crags must wait for that instead of giving up on the showcase alone.
    if (!crag) return booted ? <Navigate to="/" replace /> : null;

    // The rail only offers sections this crag actually has.
    const sections = new Set<string>(["routesec", "cragLog", "wxsec", "fcsec", "moresec"]);
    if (crag.ap?.length || crag.pk || crag.walk) sections.add("apsec");
    if (crag.pics.length) sections.add("toposec");

    const rockText = region?.text.rock
        ? i18(region.text.rock, lang)
        : (shortText(longText(crag, "rock", lang), lang, region?.de) ?? t("d.rock.none"));
    const total = crag.bands?.reduce((a, b) => a + b, 0) ?? 0;
    const distance = ctx.distance?.(crag) ?? null;
    const weather = stateOf(crag);

    return (
        <Box sx={{ height: "100%", overflowY: "auto", pb: 4 }}>
            <Box sx={{ p: 2 }}>
                {/* The original's hero: the purple band with the area, the name and the grade strip. */}
                <Box
                    className="kat-band"
                    sx={{
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: "16px",
                        p: "13px 15px 14px",
                        display: "grid",
                        gap: "5px",
                        boxShadow: "0 6px 18px rgb(40 21 122 / 22%)",
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            right: -60,
                            top: -70,
                            width: 200,
                            height: 200,
                            borderRadius: "50%",
                            pointerEvents: "none",
                            background:
                                "radial-gradient(circle, rgb(255 155 63 / 60%), rgb(240 36 107 / 25%) 45%, rgb(240 36 107 / 0%) 70%)",
                        },
                        "& > *": { position: "relative" },
                    }}
                >
                    <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontSize: 12.5, opacity: 0.88 }}>
                                {[
                                    // The original's hero line: the area, then «Wall n» when the
                                    // pack numbers the walls (index.html:4498).
                                    crag.nr
                                        ? `${crag.area} · ${t("d.wall", { 0: crag.nr })}${
                                              crag.nrInferred ? t("d.wall.inf") : ""
                                          }`
                                        : crag.area,
                                    crag.locality,
                                    crag.municipality,
                                    crag.province,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </Typography>
                            <Typography variant="h2" sx={{ color: "inherit", my: "1px" }}>
                                {crag.name}
                            </Typography>
                            {crag.aka && (
                                <Typography variant="caption" sx={{ opacity: 0.88 }}>
                                    {t("d.aka", { 0: crag.aka })}
                                </Typography>
                            )}
                        </Box>
                        <IconButton
                            color="inherit"
                            onClick={() => void share(crag.id, crag.name, packUrl, packKey)}
                            aria-label={t("d.share")}
                        >
                            <ShareIcon />
                        </IconButton>
                        <IconButton
                            color="inherit"
                            onClick={() => dispatch(favouritesActions.toggleCrag(crag.id))}
                            aria-label={t(isFav ? "fav.t.rm" : "fav.t.add")}
                        >
                            {isFav ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                        </IconButton>
                    </Stack>
                    {crag.bands && total > 0 && (
                        <>
                            <Box
                                role="img"
                                aria-label={`${t("d.grades")}: ${crag.bands.map((n, i) => `${BANDS[i]} ${n}`).join(", ")}`}
                                sx={{
                                    display: "flex",
                                    gap: "2px",
                                    height: 24,
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    bgcolor: "rgb(255 255 255 / 16%)",
                                    mt: "5px",
                                }}
                            >
                                {crag.bands.map((n, i) =>
                                    n ? (
                                        <Box
                                            key={i}
                                            component="i"
                                            title={`${BANDS[i]}: ${n}`}
                                            sx={{
                                                flex: n,
                                                minWidth: 3,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: `band.b${i}`,
                                                color: "band.contrastText",
                                                font: "700 12px/1 var(--body)",
                                                fontStyle: "normal",
                                            }}
                                        >
                                            {n / total >= 0.08 ? n : ""}
                                        </Box>
                                    ) : null,
                                )}
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "2px 12px",
                                    fontSize: 11.5,
                                    opacity: 0.92,
                                }}
                            >
                                {crag.bands.map((n, i) =>
                                    n ? (
                                        <Box
                                            key={i}
                                            component="span"
                                            sx={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "5px",
                                            }}
                                        >
                                            <Box
                                                component="i"
                                                sx={{
                                                    width: 9,
                                                    height: 9,
                                                    borderRadius: "3px",
                                                    bgcolor: `band.b${i}`,
                                                    boxShadow: "0 0 0 1px rgb(255 255 255 / 60%)",
                                                }}
                                            />
                                            {BANDS[i]}
                                        </Box>
                                    ) : null,
                                )}
                            </Box>
                        </>
                    )}
                </Box>

                {crag.closure && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                        {longText(crag, "warn", lang)}
                    </Alert>
                )}
                {!crag.closure && crag.caution && (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                        {longText(crag, "warn", lang)}
                    </Alert>
                )}

                {/* The original's `.glance` tiles, in its order (index.html:4621). */}
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
                        gap: 1,
                        mt: 1.5,
                    }}
                >
                    <Tile
                        label={t("g.grades")}
                        value={gradesText(crag)}
                        Icon={LandscapeIcon}
                        color={`var(--${crag.cls === "unk" ? "unk" : crag.cls})`}
                    />
                    <Tile
                        label={
                            crag.nMulti && crag.nSingle != null
                                ? t("g.single", { 0: crag.nSingle, 1: crag.nMulti })
                                : t("g.routes")
                        }
                        value={crag.nRoutes ?? crag.routes.length}
                        Icon={BarChartIcon}
                        color="var(--hot)"
                    />
                    <Tile
                        label={t("g.len") + (crag.lenIsTypical ? ` · ${t("len.typ")}` : "")}
                        // The call-out's own text: «up to 35 m» where only a maximum is known, and
                        // never a «null» for a missing end.
                        value={lengthText(crag, t as never) ?? "–"}
                        Icon={HeightIcon}
                        color="var(--violet)"
                    />
                    <Tile
                        label={t("g.orient")}
                        value={
                            crag.orient.length === 0
                                ? "–"
                                : crag.orient.length >= 4
                                  ? t("all.aspects")
                                  : crag.orient.map((o) => orientLabel(o, lang)).join(" / ")
                        }
                        Icon={ExploreIcon}
                        color="var(--teal)"
                    />
                    <Tile
                        // «stated: n min» when a source gave the time rather than the
                        // computed walk, which is what `pop.src` says.
                        label={
                            t("g.walk") +
                            (crag.walkHow === "calc" && crag.walkMin != null
                                ? ` · ${t("pop.src", { 0: crag.walkMin })}`
                                : "")
                        }
                        value={
                            crag.walkEff != null
                                ? t(crag.walkHow === "calc" ? "min.ca" : "min", { 0: crag.walkEff })
                                : "–"
                        }
                        Icon={DirectionsWalkIcon}
                        color="var(--park)"
                    />
                    <Tile
                        label={t("g.rain")}
                        value={crag.rain === "yes" ? t("yes") : crag.rain === "no" ? t("no") : "–"}
                        Icon={WaterDropIcon}
                        color="var(--rainc)"
                    />
                    {crag.sun && (
                        <Tile
                            label={t("g.sun")}
                            value={t(`sun.${crag.sun}`)}
                            Icon={WbSunnyIcon}
                            color="var(--sun)"
                        />
                    )}
                    {crag.dry && (
                        <Tile
                            label={t("g.dry") + (crag.dryHow === "est" ? ` · ${t("dry.est")}` : "")}
                            value={t(`dry.${crag.dry}`)}
                            Icon={OpacityIcon}
                            color="var(--amber)"
                        />
                    )}
                    {(crag.boltSp || crag.boltC) && (
                        <Tile
                            label={t(crag.boltC ? "g.boltC" : "g.bolt")}
                            value={
                                crag.boltC ? t(`bolt.c.${crag.boltC}`) : t(`bolt.${crag.boltSp}`)
                            }
                            Icon={HardwareIcon}
                            color={
                                crag.boltC === "old"
                                    ? "var(--closed)"
                                    : crag.boltSp === "spaced" || crag.boltSp === "part"
                                      ? "var(--hard)"
                                      : "var(--ok)"
                            }
                        />
                    )}
                    {crag.rate?.avg != null && (
                        <Tile
                            label={t("g.rate")}
                            value={crag.rate.avg.toFixed(1)}
                            Icon={StarIcon}
                            color="var(--rate)"
                        />
                    )}
                    {weather && (
                        <Tile
                            label={t("g.wx")}
                            value={t(`wx.s.${weather}`)}
                            Icon={WbCloudyIcon}
                            color="var(--rainc)"
                        />
                    )}
                    {distance != null && (
                        <Tile
                            label={t("d.fromMe")}
                            value={formatDistance(distance)}
                            Icon={NearMeIcon}
                            color="var(--me)"
                        />
                    )}
                </Box>

                <Card sx={{ mt: 2 }}>
                    <CardContent>
                        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
                            <Fact
                                label={t("g.alt")}
                                value={crag.alt != null ? `${crag.alt} m` : null}
                            />
                            <Fact label={t("g.rock")} value={rockText} />
                            <Fact
                                label={t("g.style")}
                                value={shortText(crag.style, lang, region?.de)}
                            />
                            <Fact
                                label={t("d.season")}
                                value={shortText(longText(crag, "season", lang), lang, region?.de)}
                            />
                        </Stack>
                        <Box sx={{ mt: 1.5 }}>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block" }}
                            >
                                {t("f.dry")}
                            </Typography>
                            <DryEstimate crag={crag} />
                        </Box>
                    </CardContent>
                </Card>

                {(crag.boltSp || crag.boltC) && (
                    <Card sx={{ mt: 2 }}>
                        <CardContent>
                            <Typography variant="subtitle2" gutterBottom>
                                {t("f.bolt")}
                            </Typography>
                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                                {crag.boltSp && (
                                    <Chip size="small" label={t(`tag.bolt.${crag.boltSp}`)} />
                                )}
                                {crag.boltC && (
                                    <Chip size="small" label={t(`bolt.c.${crag.boltC}`)} />
                                )}
                            </Stack>
                            {crag.bolt?.q?.map((q, i) => (
                                <Typography
                                    key={i}
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 1 }}
                                >
                                    {lang === "de" ? q[2] : q[1]}
                                </Typography>
                            ))}
                        </CardContent>
                    </Card>
                )}

                <JumpRail present={sections} />

                <ApproachSection crag={crag} />

                {crag.pics.length > 0 && (
                    <Card id="toposec" sx={{ mt: 2 }}>
                        <CardContent>
                            <SectionTitle section="toposec">{t("d.topo")}</SectionTitle>
                            <Gallery crag={crag} />
                        </CardContent>
                    </Card>
                )}

                <Box id="wxsec">
                    <WeatherCard crag={crag} />
                </Box>

                <CragForecast crag={crag} />

                {longText(crag, "desc", lang) && (
                    <Card sx={{ mt: 2 }}>
                        <CardContent>
                            <Typography variant="body2">{longText(crag, "desc", lang)}</Typography>
                        </CardContent>
                    </Card>
                )}

                {region?.text.guide && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        <PackInline text={region.text.guide} />
                    </Typography>
                )}

                <CragLinks crag={crag} />

                <Divider sx={{ my: 2 }} />
                <Box id="routesec" component="section" aria-label={t("d.routes")}>
                    <SectionTitle section="routesec">
                        {t("d.routes")}{" "}
                        <Box component="span" sx={{ color: "text.secondary" }}>
                            ({crag.routes.length})
                        </Box>
                    </SectionTitle>
                    <RouteList crag={crag} onLog={setLogRoute} />
                </Box>

                <Divider sx={{ my: 2 }} />
                <Box id="cragLog">
                    <CragLogbook
                        crag={crag}
                        onEdit={setLogEntry}
                        onAddCustom={() => setLogCustom(true)}
                    />
                </Box>

                {/* The original closed the page with these two, in this order. */}
                <CragMore crag={crag} />
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 2 }}
                >
                    {t("disclaimer")}
                </Typography>
            </Box>

            <LogSheet
                crag={crag}
                route={logRoute}
                entry={logEntry}
                open={logRoute != null || logEntry != null || logCustom}
                onClose={() => {
                    setLogRoute(null);
                    setLogEntry(null);
                    setLogCustom(false);
                }}
            />
        </Box>
    );
};
