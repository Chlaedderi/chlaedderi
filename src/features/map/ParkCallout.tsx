/**
 * The card that opens when a car park is tapped.
 *
 * A port of `openParkPopup` (index.html:3783). Its point is the list: a car park often serves
 * several crags, and the walk from it differs for each, so standing in the car park you want to
 * know what is in reach and how far. The React port drew the `P` markers but tapping one did
 * nothing at all.
 *
 * Which crags count as served is the original's rule: those that name this car park in an
 * approach, plus those whose `pk` it is -- but not where that was only assumed, since an assumed
 * car park says nothing about a walk from it.
 */

import CloseIcon from "@mui/icons-material/Close";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useData } from "@app/dataContext";
import { useLang } from "@app/useAppData";
import { longText } from "@core/dataText";
import { fold } from "@core/text";
import type { Park } from "@domain/mappack";
import type { Crag } from "@domain/model";

import { appleUrl, isApple, navUrl } from "./navLinks";
import { useCallout } from "./useCallout";

export const ParkCallout = ({
    parkKey,
    parks,
    crags,
    onSelect,
    onClose,
}: {
    readonly parkKey: string | null;
    readonly parks: Readonly<Record<string, Park>>;
    readonly crags: readonly Crag[];
    readonly onSelect: (crag: Crag) => void;
    readonly onClose: () => void;
}) => {
    const { t } = useTranslation();
    const lang = useLang();
    const { regions } = useData();

    const park = parkKey ? parks[parkKey] : null;
    // A car park key is `<packId>/<key>`, so the region it belongs to is in the key itself.
    const invented = regions.find((r) => r.key === parkKey?.split("/")[0])?.fictional === true;

    const host = useCallout({
        at: park ? [park.lat, park.lon] : null,
        onClose,
    });

    if (!park || !parkKey) return null;

    const users = crags
        .filter(
            (c) => (c.ap ?? []).some((a) => a.pk === parkKey) || (c.pk === parkKey && !c.pkAssumed),
        )
        .sort((a, b) => (fold(a.name) < fold(b.name) ? -1 : 1));

    /** How long the walk from *this* car park to that crag is. */
    const walk = (crag: Crag): string => {
        const ap = (crag.ap ?? []).find((a) => a.pk === parkKey);
        if (!ap) return crag.walkMin != null ? t("min", { 0: crag.walkMin }) : "";
        if (ap.q === "detour") {
            return crag.walkMin != null ? t("min", { 0: crag.walkMin }) : "";
        }
        return crag.walkHow === "calc" || ap.alt || crag.walkMin == null
            ? t("min.ca", { 0: Math.max(1, Math.round(ap.t ?? 0)) })
            : t("min", { 0: crag.walkMin });
    };

    return createPortal(
        <>
            <div className="a">
                {t("park")}
                {park.est ? ` · ${t("pop.est")}` : ""}
            </div>
            <div className="t">
                <span className="kat-ellipsis">{longText(park, "name", lang)}</span>
                <IconButton className="x" size="small" aria-label={t("close")} onClick={onClose}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </div>
            {longText(park, "note", lang) && <div>{longText(park, "note", lang)}</div>}

            {users.length > 0 && (
                <>
                    <div className="a">
                        {t("park.crags")} ({users.length})
                    </div>
                    <ul className="pkcrags">
                        {users.map((crag) => {
                            const ap = (crag.ap ?? []).find((a) => a.pk === parkKey);
                            return (
                                <li key={crag.id}>
                                    <button type="button" onClick={() => onSelect(crag)}>
                                        <span className={`dot ${crag.cls}`} />
                                        {crag.name}
                                        <span>
                                            {ap?.alt ? `${t("park.alt")} · ` : ""}
                                            {walk(crag)}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {invented ? t("demo.nav") : t("nav.t")}
            </Typography>
            {!invented && (
                <div className="poprow">
                    <Button
                        variant="contained"
                        sx={{ flex: 1 }}
                        href={navUrl(park)}
                        target="_blank"
                        rel="noopener"
                    >
                        {t("nav.gmaps")}
                    </Button>
                    {isApple() && (
                        <Button href={appleUrl(park)} target="_blank" rel="noopener">
                            {t("nav.apple")}
                        </Button>
                    )}
                </div>
            )}
        </>,
        host,
    );
};
