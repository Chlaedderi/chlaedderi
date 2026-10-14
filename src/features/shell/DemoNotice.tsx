/**
 * Says, on every screen, that the region on show is invented.
 *
 * The demo region sits on real Swiss ground — real contours, real swisstopo tiles, real weather —
 * because that is what demonstrates the Swiss half of the app. The cost is that an unmarked demo
 * would read as an atlas of somewhere, and the approach planner would happily walk a reader up a
 * hillside to a cliff that is not there. So the marking is a safety control, not decoration, and it
 * comes in two parts: a strip that never goes away, and a dialog the first time.
 *
 * Both are driven by the pack's own `fictional` flag, so a region says this about itself rather
 * than the app guessing. Load a real region and `DataProvider` drops the showcase, the flag goes
 * with it, and both disappear.
 *
 * What is remembered lives inside the settings, so that nothing new needs a storage name -- the
 * same reasoning as `installHint.ts`. Unlike the install hint, this one does show in a pull-request
 * preview: a preview full of invented data is exactly where the warning belongs.
 */

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useMatch } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import { useRegion } from "@app/useAppData";

export const DemoNotice = () => {
    const { t } = useTranslation();
    const region = useRegion();
    const seen = useAppSelector((s) => s.prefs.demoSeen);
    const dispatch = useAppDispatch();
    // The crag on screen counts as well as the region selected: one opened from the favourites,
    // the logbook or a record keeps the region it was opened from. Either one invented is reason
    // enough -- a strip over a real crag costs nothing, a missing one over an invented crag is what
    // this control exists to prevent. (The map's selection is not asked: it outlives the page.)
    const { byId, regions } = useData();
    const onPage = useMatch("/crag/:id")?.params.id;
    const shown = onPage ? byId[onPage] : undefined;
    const shownRegion = shown ? regions.find((r) => r.key === shown.packId) : undefined;

    if (region?.fictional !== true && shownRegion?.fictional !== true) return null;

    const close = (): void => {
        dispatch(prefsActions.setFlag({ key: "demoSeen", value: true }));
    };

    return (
        <>
            <Alert
                severity="warning"
                variant="filled"
                data-testid="demo-strip"
                sx={{
                    borderRadius: 0,
                    py: 0,
                    "& .MuiAlert-message": { py: 0.5, fontSize: "0.8125rem" },
                    "& .MuiAlert-icon": { py: 0.5 },
                }}
            >
                {t("demo.strip")}
            </Alert>

            <Dialog open={!seen} onClose={close} fullWidth maxWidth="xs">
                <DialogTitle>{t("demo.h")}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">{t("demo.t")}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={close} variant="contained" data-testid="demo-ok">
                        {t("demo.ok")}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
