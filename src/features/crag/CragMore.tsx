/**
 * «More details and location» -- the collapsed block at the foot of a crag page.
 *
 * A port of the original's `<details class="more" id="moresec">` (index.html:4643): two
 * definition lists, one about the climbing and one about where the crag is. It is the part of the
 * page that answers the questions the glance tiles only hint at -- how the ratings are made up,
 * what a source actually said about the bolting, how exact the coordinates are, and which
 * municipality the crag is in.
 *
 * None of it existed in the first React pass; 25 of the original's `d.*` texts had no reader.
 */

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useLang, useRegionOf } from "@app/useAppData";
import { longText, orientLabel, shortText } from "@core/dataText";
import type { Crag } from "@domain/model";

import { gradesText } from "./cragText";
import { DryEstimate } from "./DryEstimate";
import { SectionTitle } from "./SectionTitle";

/** One `<dt>/<dd>` pair of the original's `.kv` list. */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Box
        sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "minmax(9rem, auto) 1fr" },
            columnGap: 2,
            rowGap: 0.25,
            py: 0.5,
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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Box component="section" sx={{ mb: 2 }}>
        <Typography variant="h3" gutterBottom>
            {title}
        </Typography>
        <Box component="dl" sx={{ m: 0 }}>
            {children}
        </Box>
    </Box>
);

/** The coordinates, with the original's copy button that turns into «Copied». */
const Coordinates = ({ lat, lon }: { lat: number; lon: number }) => {
    const { t } = useTranslation();
    const text = `${lat}, ${lon}`;
    const [label, setLabel] = useState<string | null>(null);

    return (
        <>
            <span className="num">
                {lat.toFixed(6)}, {lon.toFixed(6)}
            </span>{" "}
            <Button
                size="small"
                onClick={() => {
                    void navigator.clipboard?.writeText(text).then(
                        () => setLabel(t("copied")),
                        // No clipboard: show the figures themselves, as the original did.
                        () => setLabel(text),
                    );
                }}
            >
                {label ?? t("copy")}
            </Button>
        </>
    );
};

export const CragMore = ({ crag }: { crag: Crag }) => {
    const { t } = useTranslation();
    const lang = useLang();
    const region = useRegionOf(crag);
    const de = region?.de;

    const coord = crag.coord;
    const rate = crag.rate;
    const said = crag.bolt?.q?.map((q) => (lang === "de" ? q[2] : q[1])).filter(Boolean) ?? [];
    const boltHead = [
        crag.boltSp ? t(`bolt.${crag.boltSp}`) : null,
        crag.boltC ? t(`bolt.c.${crag.boltC}`) : null,
    ].filter(Boolean);

    const gm = coord
        ? `https://www.google.com/maps/search/?api=1&query=${coord.lat},${coord.lon}`
        : null;
    const osm = coord
        ? `https://www.openstreetmap.org/?mlat=${coord.lat}&mlon=${coord.lon}#map=16/${coord.lat}/${coord.lon}`
        : null;

    return (
        <Accordion disableGutters sx={{ mt: 2 }} id="moresec">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ mb: -1 }}>
                    <SectionTitle section="moresec">{t("d.more")}</SectionTitle>
                </Box>
            </AccordionSummary>
            <AccordionDetails>
                <Section title={t("d.climb")}>
                    <Row label={t("g.grades")}>{gradesText(crag)}</Row>
                    <Row label={t("g.routes")}>{crag.nRoutes ?? crag.routes.length}</Row>
                    <Row label={t("d.rate")}>
                        {rate?.avg != null ? (
                            <>
                                {t("d.rate.v", {
                                    0: rate.avg.toFixed(1),
                                    1: rate.n,
                                    2: crag.routes.length,
                                    3: rate.top,
                                })}{" "}
                                <Typography variant="caption" color="text.secondary">
                                    ({t("d.rate.src", { 0: rate.asc })})
                                </Typography>
                            </>
                        ) : (
                            t("d.rate.none")
                        )}
                    </Row>
                    {crag.style && (
                        <Row label={t("g.style")}>
                            {t("d.style.v", { 0: shortText(crag.style, lang, de) })}
                        </Row>
                    )}
                    <Row label={t("d.bolt")}>
                        {crag.bolt ? (
                            <>
                                <b>{boltHead.length ? boltHead.join(" · ") : t("bolt.note")}</b>
                                {said.length > 0 && (
                                    <>
                                        :{" "}
                                        {said.map((line, i) => (
                                            <Box key={i} component="span" sx={{ display: "block" }}>
                                                {line}
                                            </Box>
                                        ))}
                                    </>
                                )}
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block" }}
                                >
                                    {t("d.bolt.hint")}
                                </Typography>
                            </>
                        ) : (
                            t("d.bolt.none")
                        )}
                    </Row>
                    <Row label={t("d.rock")}>
                        {shortText(longText(crag, "rock", lang), lang, de) ?? t("d.rock.none")}
                    </Row>
                    {crag.dry && (
                        <Row label={t("d.dry")}>
                            <DryEstimate crag={crag} />
                        </Row>
                    )}
                    <Row label={t("d.rain")}>{crag.rain ? t(crag.rain) : t("d.rain.none")}</Row>
                    {crag.sun && (
                        <Row label={t("d.sun")}>
                            {t(`sun.${crag.sun}`)}
                            {crag.sunWhole && (
                                <Typography variant="caption" color="text.secondary">
                                    {" "}
                                    ({t("d.sun.whole")})
                                </Typography>
                            )}
                        </Row>
                    )}
                    {crag.season && (
                        <Row label={t("d.season")}>
                            {shortText(longText(crag, "season", lang), lang, de)}
                        </Row>
                    )}
                    <Row label={t("g.orient")}>
                        {crag.orient.length === 0
                            ? "–"
                            : crag.orient.length >= 4
                              ? t("all.aspects")
                              : crag.orient.map((o) => orientLabel(o, lang)).join(" / ")}
                    </Row>
                    {crag.status && (
                        <Row label="Status">
                            {t("d.status", { 0: shortText(crag.status, lang, de) })}
                        </Row>
                    )}
                </Section>

                <Section title={t("d.loc")}>
                    <Row label={t("d.coord")}>
                        {coord ? (
                            <Coordinates lat={coord.lat} lon={coord.lon} />
                        ) : (
                            t(crag.coordDropped ? "d.coord.dropped" : "d.coord.none")
                        )}
                    </Row>
                    {coord && (
                        <>
                            <Row label={t("d.prec")}>
                                {coord.precision === "pin" ? (
                                    t("d.prec.pin")
                                ) : (
                                    <b>{t(crag.anchor ? "d.prec.anchor" : "d.prec.approx")}</b>
                                )}
                            </Row>
                            <Row label={t("d.openIn")}>
                                <Link href={gm!} target="_blank" rel="noopener">
                                    Google Maps
                                </Link>
                                {" · "}
                                <Link href={osm!} target="_blank" rel="noopener">
                                    OpenStreetMap
                                </Link>
                            </Row>
                        </>
                    )}
                    <Row label={t("d.locality")}>{shortText(crag.locality, lang, de) ?? "–"}</Row>
                    <Row label={t("d.muni")}>{crag.municipality ?? t("d.muni.none")}</Row>
                    {(crag.province || crag.region) && (
                        <Row label={t("d.prov")}>
                            {[crag.province, crag.region].filter(Boolean).join(" · ")}
                        </Row>
                    )}
                </Section>
            </AccordionDetails>
        </Accordion>
    );
};
