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

import { CragCard } from "../list/CragCard";

import { BackupCode } from "./BackupCode";
import { SaveStatus } from "./SaveStatus";

/**
 * Favourites, crags and single routes. A favourite whose pack is not loaded right now is not shown
 * -- it is never dropped, it simply waits for the pack to come back.
 */
export const FavouritesPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [clearing, setClearing] = useState(false);
    const { byId } = useData();
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
                    {/* Not which region: a crag id does not name its pack, and an unloaded pack
                        is not here to ask. */}
                    {t("fav.waiting", { 0: waiting })}
                </Typography>
            )}
        </Box>
    );
};
