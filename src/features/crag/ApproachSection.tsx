/**
 * «Approach and parking» -- the section that tells you where to leave the car and how to walk in.
 *
 * A port of the original's `approachHTML` and `pkBoxHTML` (index.html:4527). The first React pass
 * showed the car park's name and a single «Navigate» button; everything that made the section
 * worth reading was missing -- which of several car parks is the alternative, how long the walk is
 * and whether that figure was stated or computed, and the whole family of caveats the data carries:
 * the wall is not located, the usual path is not on the map, the mapped path stops short, this car
 * park is only assumed.
 */

import DirectionsIcon from "@mui/icons-material/Directions";
import WalkIcon from "@mui/icons-material/DirectionsWalk";
import MapIcon from "@mui/icons-material/Map";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";
import { useLang, useRegionOf } from "@app/useAppData";
import { longText } from "@core/dataText";
import { formatDistance } from "@core/geo";
import type { Approach, Park } from "@domain/mappack";
import type { Crag } from "@domain/model";

import { appleUrl, isApple, navUrl, webUrl } from "../map/navLinks";

import { SectionTitle } from "./SectionTitle";

/** «30 min on foot · 1.3 km · ↑ 236 m», the original's `apSummary`. */
const Summary = ({ crag, ap }: { crag: Crag; ap: Approach }) => {
    const { t } = useTranslation();

    if (ap.q === "detour") {
        return (
            <Typography variant="body2">
                {crag.walkMin != null &&
                    `${t("pop.walk", { 0: t("min", { 0: crag.walkMin }) })} · `}
                {t("pop.nopath")}
            </Typography>
        );
    }

    // An alternative car park, or a crag whose time we worked out ourselves, is «about n min»;
    // a time a source stated is given as it stands.
    const useCalc = ap.alt || crag.walkHow === "calc" || crag.walkMin == null;
    const time = useCalc
        ? t("min.ca", { 0: Math.max(1, Math.round(ap.t ?? 0)) })
        : t("min", { 0: crag.walkMin });

    return (
        <Typography variant="body2">
            <b>{t("pop.walk", { 0: time })}</b> · {formatDistance(ap.d ?? 0)}
            {(ap.up ?? 0) >= 10 && ` · ↑ ${ap.up} m`}
            {(ap.down ?? 0) >= 20 && ` · ↓ ${ap.down} m`}
            {!ap.alt && crag.walkHow === "calc" && crag.walkMin != null && (
                <Typography variant="caption" color="text.secondary">
                    {" "}
                    ({t("pop.src", { 0: crag.walkMin })})
                </Typography>
            )}
        </Typography>
    );
};

/** One car park: its name, the walk from it, its note, and the way to navigate there. */
const ParkBox = ({ crag, park, ap }: { crag: Crag; park: Park; ap?: Approach }) => {
    const { t } = useTranslation();
    const lang = useLang();
    // An invented crag is not navigated to: the coordinate is open hillside, not rock.
    const invented = useRegionOf(crag)?.fictional === true;

    return (
        <Box
            sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
                mb: 1,
            }}
        >
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5 }}>
                <span className={park.est ? "pk est" : "pk"}>P</span>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {ap?.alt ? `${t("ap.alt")}: ` : ""}
                    {longText(park, "name", lang)}
                </Typography>
            </Stack>

            {ap && <Summary crag={crag} ap={ap} />}

            {longText(park, "note", lang) && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {longText(park, "note", lang)}
                </Typography>
            )}

            {invented ? (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                >
                    {t("demo.nav")}
                </Typography>
            ) : (
                <>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                        <Button
                            size="small"
                            startIcon={<DirectionsIcon />}
                            href={navUrl(park)}
                            target="_blank"
                            rel="noopener"
                            title={t("nav.t")}
                            sx={{ flex: 1 }}
                        >
                            {t("nav.gmaps")}
                        </Button>
                        {isApple() && (
                            <Button
                                size="small"
                                href={appleUrl(park)}
                                target="_blank"
                                rel="noopener"
                                title={t("nav.t")}
                            >
                                {t("nav.apple")}
                            </Button>
                        )}
                        <Button size="small" href={webUrl(park)} target="_blank" rel="noopener">
                            {t("nav.web")}
                        </Button>
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {t("nav.fail")}
                    </Typography>
                </>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {t("nav.t")}
                {park.est ? ` · ${t("ap.pos", { 0: t("ap.est") })}` : ""}
            </Typography>
        </Box>
    );
};

export const ApproachSection = ({ crag }: { crag: Crag }) => {
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const region = useRegionOf(crag);
    const { parks } = useData();

    const aps = crag.ap ?? [];
    const main = aps.find((a) => !a.alt) ?? null;
    const park = crag.pk ? parks[crag.pk] : null;
    const parkName = (key: string): string => longText(parks[key], "name", lang) ?? key;
    // Never for an invented region: there is no path to a crag that is not there.
    const canPlan = region?.ch === true && region.fictional !== true && crag.coord != null;

    return (
        <Card id="apsec" sx={{ mt: 2 }}>
            <CardContent>
                <SectionTitle section="apsec">{t("d.approach")}</SectionTitle>

                {park ? (
                    <>
                        {/* Why the marker may not be where the wall is. */}
                        {crag.anchor ? (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block" }}
                            >
                                {t("ap.anchor")}
                            </Typography>
                        ) : !crag.coord ? (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block" }}
                            >
                                {t("ap.textOnly")}
                            </Typography>
                        ) : null}

                        <ParkBox crag={crag} park={park} {...(main ? { ap: main } : {})} />
                        {aps
                            .filter((a) => a.alt)
                            .map((a) =>
                                parks[a.pk] ? (
                                    <ParkBox key={a.pk} crag={crag} park={parks[a.pk]!} ap={a} />
                                ) : null,
                            )}

                        {main?.q === "detour" && (
                            <Alert severity="warning" sx={{ mb: 1 }}>
                                {t("ap.detour")}
                            </Alert>
                        )}
                        {crag.pkOff && (
                            <Alert severity="info" sx={{ mb: 1 }}>
                                {t("ap.off", {
                                    0: parkName(crag.pkOff),
                                    1: crag.pk ? parkName(crag.pk) : "",
                                })}
                            </Alert>
                        )}
                        {main && (main.gap ?? 0) > 35 && main.q !== "detour" && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block" }}
                            >
                                {t("ap.gap", { 0: Math.round((main.gap ?? 0) / 10) * 10 })}
                            </Typography>
                        )}
                        {crag.pkAssumed && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block" }}
                            >
                                {t("ap.assumed")}
                            </Typography>
                        )}
                    </>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        {t("ap.none.park")}
                    </Typography>
                )}

                <Box component="dl" sx={{ m: 0, mt: 1.5 }}>
                    <Row label={t("ap.srcTime")}>
                        {crag.walkMin != null
                            ? t("ap.srcTime.v", { 0: crag.walkMin })
                            : t("ap.srcTime.none")}
                    </Row>
                    <Row label={t("ap.parkText")}>
                        {longText(crag, "park", lang) || t("ap.none")}
                    </Row>
                    <Row label={t("ap.walkText")}>
                        {longText(crag, "walk", lang) || t("ap.none")}
                    </Row>
                </Box>

                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                    {(crag.coord || crag.pk) && (
                        <Button
                            size="small"
                            startIcon={<MapIcon />}
                            onClick={() => {
                                // Both halves in one handler: React commits them together, so the
                                // crag column is already gone by the time the map works out where
                                // to go and how much room it has. It looks wrong and is right.
                                dispatch(uiActions.reveal(crag.id));
                                void navigate("/");
                            }}
                        >
                            {t("ap.showMap")}
                        </Button>
                    )}
                    {canPlan && (
                        <Button
                            size="small"
                            startIcon={<WalkIcon />}
                            onClick={() => {
                                // The planner works on the map, so that is where it opens.
                                dispatch(uiActions.reveal(crag.id));
                                dispatch(uiActions.setPlanning(true));
                                void navigate("/");
                            }}
                        >
                            {t("ap.plan")}
                        </Button>
                    )}
                </Stack>

                {canPlan && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5 }}
                    >
                        {t("ap.plan.hint")}
                    </Typography>
                )}
                {region?.fictional === true && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5 }}
                    >
                        {t("demo.plan")}
                    </Typography>
                )}
                {aps.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {t("ap.calc.hint")}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
};

/** The same `<dt>/<dd>` pair the «More» block uses. */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Box
        sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "minmax(8rem, auto) 1fr" },
            columnGap: 2,
            py: 0.25,
        }}
    >
        <Typography variant="body2" color="text.secondary" component="dt">
            {label}
        </Typography>
        <Typography variant="body2" component="dd" sx={{ m: 0 }}>
            {children}
        </Typography>
    </Box>
);
