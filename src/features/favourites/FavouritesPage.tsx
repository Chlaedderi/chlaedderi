import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { favouritesActions } from "@app/slices/favouritesSlice";
import { useLang } from "@app/useAppData";
import { i18 } from "@core/text";

import { CragCard } from "../list/CragCard";

import { BackupCode } from "./BackupCode";
import { SaveStatus } from "./SaveStatus";

/**
 * Favourites, crags and single routes. A favourite whose pack is not loaded right now is not shown
 * -- it is never dropped, it simply waits for the pack to come back.
 */
export const FavouritesPage = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [clearing, setClearing] = useState(false);
    const { byId, regions } = useData();
    const favCrags = useAppSelector((s) => s.favourites.crags);
    const favRoutes = useAppSelector((s) => s.favourites.routes);
    const saved = useAppSelector((s) => s.favourites.saved);

    const crags = favCrags.map((id) => byId[id]).filter((c): c is NonNullable<typeof c> => !!c);
    const routes = favRoutes
        .map((key) => {
            const crag = byId[key.split("~")[0] ?? ""];
            const route = crag?.routes.find((r) => r.key === key);
            return crag && route ? { crag, route } : null;
        })
        .filter((x): x is NonNullable<typeof x> => !!x);

    const waiting = favCrags.length - crags.length + (favRoutes.length - routes.length);

    // Which packs those waiting favourites belong to. A favourite's id starts with its pack's,
    // so the names can be given even while the pack is unloaded.
    const loaded = new Set(regions.map((r) => r.key));
    const awayRegions = [
        ...new Set(
            [...favCrags, ...favRoutes.map((k) => k.split("~")[0] ?? "")]
                .filter((id) => !byId[id])
                .map((id) => id.split("/")[0] ?? "")
                .filter((key) => key && !loaded.has(key)),
        ),
    ].map((key) => {
        const region = regions.find((r) => r.key === key);
        return region ? i18(region.name, lang) : key;
    });

    return (
        <Box sx={{ height: "100%", overflowY: "auto", p: 2, pb: 4 }}>
            <Typography variant="h2" gutterBottom>
                {t("tab.fav")}
            </Typography>

            {crags.length === 0 && routes.length === 0 ? (
                <Typography color="text.secondary">{t("fv.empty")}</Typography>
            ) : null}

            {crags.length > 0 && (
                <>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 1, mt: 1, mb: 1 }}>
                        <Typography variant="h4" sx={{ flex: 1 }}>
                            {t("fv.crags", { 0: crags.length })}
                        </Typography>
                        <Button size="small" onClick={() => void navigate("/")}>
                            {t("fv.showMap")}
                        </Button>
                    </Stack>
                    {crags.map((crag) => (
                        <CragCard
                            key={crag.id}
                            match={{ crag, routeHit: false, inCount: null, top: null }}
                        />
                    ))}
                </>
            )}

            {routes.length > 0 && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h4" gutterBottom>
                        {t("fv.routes", { 0: routes.length })}
                    </Typography>
                    {routes.map(({ crag, route }) => (
                        <Box
                            key={route.key}
                            sx={{
                                display: "flex",
                                gap: 1,
                                py: 0.75,
                                borderBottom: 1,
                                borderColor: "divider",
                                alignItems: "baseline",
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ flex: 1, minWidth: 0 }}
                                className="kat-ellipsis"
                            >
                                <Link component={RouterLink} to={`/crag/${crag.id}`}>
                                    {route.name}
                                </Link>
                                <Typography
                                    component="span"
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ ml: 1 }}
                                >
                                    {crag.name}
                                </Typography>
                            </Typography>
                            <Typography variant="body2" className="num" sx={{ fontWeight: 600 }}>
                                {route.grade ?? "–"}
                            </Typography>
                        </Box>
                    ))}
                </>
            )}

            {(crags.length > 0 || routes.length > 0) && (
                <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
                    <Button color="error" onClick={() => setClearing(true)}>
                        {t("fv.clear")}
                    </Button>
                </Box>
            )}

            <Dialog open={clearing} onClose={() => setClearing(false)}>
                <DialogContent>
                    <Typography>{t("fv.clear.q")}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClearing(false)}>{t("close")}</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            dispatch(favouritesActions.clear());
                            setClearing(false);
                        }}
                    >
                        {t("fv.clear")}
                    </Button>
                </DialogActions>
            </Dialog>

            <SaveStatus saved={saved} />
            <BackupCode />

            {waiting > 0 && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 2 }}
                >
                    {awayRegions.length
                        ? t("fv.away", { 0: awayRegions.join(", ") })
                        : t("fav.waiting", { 0: waiting })}
                </Typography>
            )}
        </Box>
    );
};
