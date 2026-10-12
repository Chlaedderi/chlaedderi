/**
 * The card that opens when a marker is tapped.
 *
 * A port of `cragPopupNode` and `placeCallout`. It is deliberately a stop on the way rather than a
 * jump straight to the crag page: from the map a climber usually wants the figures, the car park
 * and the drive-there link, and only sometimes the full page.
 *
 * It renders into a Leaflet popup through a portal, so the content is React -- pack strings reach
 * it as text children, never as markup. `useCallout` owns the popup itself, including the decision
 * to hang the card under the marker when the way to the car park runs north.
 */

import CloseIcon from "@mui/icons-material/Close";
import DirectionsIcon from "@mui/icons-material/Directions";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { favouritesActions } from "@app/slices/favouritesSlice";
import { useLang, useRegionOf } from "@app/useAppData";
import { longText } from "@core/dataText";
import type { Park } from "@domain/mappack";
import type { Crag } from "@domain/model";

import { CragFacts } from "../crag/CragFacts";
import { CragTags } from "../list/CragTags";

import { navUrl } from "./navLinks";
import { useCallout, type CalloutSpec } from "./useCallout";

export interface CragCalloutProps {
    readonly crag: Crag | null;
    readonly parks: Readonly<Record<string, Park>>;
    readonly inCount?: number | null;
    readonly distance?: number | null;
    readonly onOpen: (id: string) => void;
    /** Leaflet closed the card: the map was tapped. The crag is no longer chosen. */
    readonly onClose: () => void;
    /** The viewer pressed the card's own «close»: put the card away, keep the crag chosen. */
    readonly onHide: () => void;
    /** Move the map if it was asked to, then open the card. See `MapPane`. */
    readonly defer?: CalloutSpec["defer"];
    /** Bumped when the map is asked to show this crag again. See `useCallout`. */
    readonly revision?: number;
}

export const CragCallout = ({
    crag,
    parks,
    inCount,
    distance,
    onOpen,
    onClose,
    onHide,
    defer,
    revision,
}: CragCalloutProps) => {
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    // An invented crag gets no «Directions»: the coordinate is a hillside, not a wall.
    const invented = useRegionOf(crag)?.fictional === true;
    const isFav = useAppSelector((s) => s.favourites.crags.includes(crag?.id ?? ""));

    const host = useCallout({
        at: crag?.coord ? [crag.coord.lat, crag.coord.lon] : null,
        onClose,
        defer,
        revision,
        options: {
            autoPanPaddingTopLeft: [10, 10],
            autoPanPaddingBottomRight: [10, 10],
        },
    });

    if (!crag) return null;

    const parkKey = crag.ap?.find((a) => !a.alt)?.pk ?? crag.pk;
    const park = parkKey ? parks[parkKey] : null;

    return createPortal(
        <>
            <div className="a">
                {crag.area}
                {crag.nr ? ` · ${t("wall", { 0: crag.nr })}` : ""}
            </div>
            <div className="t">
                <span className={`mk ${crag.cls}`} style={{ flex: "none", marginRight: 6 }} />
                <span className="kat-ellipsis">{crag.name}</span>
                <IconButton
                    className="star"
                    size="small"
                    aria-label={t(isFav ? "fav.t.rm" : "fav.t.add")}
                    onClick={() => dispatch(favouritesActions.toggleCrag(crag.id))}
                >
                    {isFav ? (
                        <FavoriteIcon fontSize="small" sx={{ color: "marker.fav" }} />
                    ) : (
                        <FavoriteBorderIcon fontSize="small" />
                    )}
                </IconButton>
                {/* Puts the card away without giving up the crag: the approach stays drawn. */}
                <IconButton className="x" size="small" aria-label={t("close")} onClick={onHide}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </div>

            <CragFacts crag={crag} inCount={inCount} distance={distance} />
            <CragTags crag={crag} />

            {park && parkKey ? (
                <div className="pkline">
                    <span className={`pk${park.est ? " est" : ""}`}>P</span>
                    <div>
                        <b>{longText(park, "name", lang)}</b>
                        {crag.pkAssumed && (
                            <Typography component="span" variant="caption" color="text.secondary">
                                {" "}
                                ({t("pop.assumed")})
                            </Typography>
                        )}
                        {park.est && (
                            <Typography component="span" variant="caption" color="text.secondary">
                                {" "}
                                ({t("pop.est")})
                            </Typography>
                        )}
                        {crag.walkEff != null && (
                            <>
                                <br />
                                {t("pop.walk", { 0: t("min", { 0: crag.walkEff }) })}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="pkline">
                    <Typography variant="caption" color="text.secondary">
                        {crag.walkEff != null
                            ? `${t("pop.walk", { 0: t("min", { 0: crag.walkEff }) })} · ${t("pop.nopark")}`
                            : t("pop.nopark")}
                    </Typography>
                </div>
            )}

            {(crag.ap ?? [])
                .filter((a) => a.alt && parks[a.pk])
                .map((a) => (
                    <div className="pkline alt" key={a.pk}>
                        <span className={`pk${parks[a.pk]!.est ? " est" : ""}`}>P</span>
                        <div>
                            <Typography component="span" variant="caption" color="text.secondary">
                                {t("pop.alt")}{" "}
                            </Typography>
                            <b>{longText(parks[a.pk], "name", lang)}</b>
                        </div>
                    </div>
                ))}

            {/* No approach line could be drawn for this crag. */}
            {crag.coord && !(crag.ap ?? []).length && park && (
                <Typography variant="caption" color="text.secondary">
                    {t("pop.noline")}
                </Typography>
            )}

            {crag.anchor && (
                <Typography variant="caption" color="text.secondary">
                    {t("pop.anchor")}
                </Typography>
            )}

            <div className="poprow">
                <Button variant="contained" sx={{ flex: 1 }} onClick={() => onOpen(crag.id)}>
                    {t("pop.open")}
                </Button>
                {park && !invented && (
                    <Button
                        variant="outlined"
                        href={navUrl(park)}
                        target="_blank"
                        rel="noopener"
                        aria-label={t("nav.t")}
                        startIcon={<DirectionsIcon fontSize="small" />}
                    >
                        {t("nav.short")}
                    </Button>
                )}
            </div>
        </>,
        host,
    );
};
