/**
 * «You can also install this», said once, by the app, at a good moment.
 *
 * The rules are in `core/installHint.ts`; this is where they meet the browser. It shows at most one
 * small bar at the bottom, never a dialog of its own accord, and only:
 *
 * - in a browser tab: never in the installed app, never beside an installed copy the browser
 *   already knows about, never in a pull request preview, never in an automated browser;
 * - where something can actually be done: Chromium's own install dialog, the steps for the iOS
 *   share sheet, or -- in the browser built into another app -- the way out to a real one;
 * - when nothing else is on screen at the bottom: a toast, the update banner, the approach planner,
 *   a position being picked on the map;
 * - once per visit, twice in all, a month apart.
 *
 * What it says depends on why now. On iOS the reason for a saved favourite or logbook entry is a
 * real one, and the one people least expect: Safari clears a website's storage after a week without
 * a visit, and a home-screen app's not at all.
 */

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { useInstallPrompt } from "@app/installPrompt";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import {
    type InstallMoment,
    type InstallWay,
    dueFor,
    installWay,
    mayOffer,
} from "@core/installHint";
import { PREVIEW_SUFFIX } from "@core/preview";

import { isStandalone } from "../../version";
import { useInstalledApp } from "../packs/useInstalledApp";

/** How often the time in front of the viewer is counted. */
const TICK = 5000;
/** A moment's own message -- «saved», «loaded» -- goes first; the hint follows it, not over it. */
const AFTER_MOMENT = 2500;

/** Is the app being looked at in a browser tab by a person? Read once: none of it changes. */
const inATab =
    typeof navigator !== "undefined" &&
    !navigator.webdriver &&
    PREVIEW_SUFFIX === "" &&
    !isStandalone();

/** Time this visit has spent in front of the viewer, counted only while `counting`. */
const useActiveTime = (counting: boolean): number => {
    const [ms, setMs] = useState(0);
    useEffect(() => {
        if (!counting) return;
        const id = setInterval(() => {
            if (document.visibilityState === "visible") setMs((m) => m + TICK);
        }, TICK);
        return () => clearInterval(id);
    }, [counting]);
    return ms;
};

/** The app went on working without a network: offline first, then back. */
const useOfflineMoment = (): void => {
    const dispatch = useAppDispatch();
    useEffect(() => {
        let wentOffline = navigator.onLine === false;
        const offline = (): void => {
            wentOffline = true;
        };
        const online = (): void => {
            if (wentOffline) dispatch(uiActions.installMoment("offline"));
        };
        window.addEventListener("offline", offline);
        window.addEventListener("online", online);
        return () => {
            window.removeEventListener("offline", offline);
            window.removeEventListener("online", online);
        };
    }, [dispatch]);
};

export const InstallHint = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const state = useAppSelector((s) => s.prefs.install);
    const moment = useAppSelector((s) => s.ui.installMoment);
    const busy = useAppSelector(
        (s) => s.ui.toasts.length > 0 || s.ui.updateReady || s.ui.planning || s.ui.picking,
    );
    const { canInstall, installed, install } = useInstallPrompt();
    const elsewhere = useInstalledApp();

    // What is on screen, fixed when it opens: a moment arriving later must not rewrite the text
    // under somebody reading it, nor Chrome taking its event back turn the button into steps.
    const [shown, setShown] = useState<{ why: InstallMoment; way: InstallWay } | null>(null);
    const [over, setOver] = useState(false);
    const [steps, setSteps] = useState(false);

    // Counted once per page load. The reducer decides whether a reload is a new visit.
    useEffect(() => {
        dispatch(prefsActions.countVisit(Date.now()));
    }, [dispatch]);

    useOfflineMoment();

    const way = installWay({
        ua: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
        canPrompt: canInstall,
    });
    const possible =
        inATab && !installed && !elsewhere && way !== null && mayOffer(state, Date.now());
    const activeMs = useActiveTime(possible && !shown && !over);
    const due = possible && !over ? dueFor(state, moment, activeMs) : null;

    useEffect(() => {
        if (!due || !way || shown || busy) return;
        const id = setTimeout(() => setShown({ why: due, way }), due === "time" ? 0 : AFTER_MOMENT);
        return () => clearTimeout(id);
    }, [due, way, shown, busy]);

    useEffect(() => {
        if (installed) dispatch(prefsActions.installDone());
    }, [installed, dispatch]);

    /** Put it away for this visit; `later` is the viewer saying «not now», which is remembered. */
    const close = (later: boolean): void => {
        setOver(true);
        setSteps(false);
        if (later) dispatch(prefsActions.dismissInstallHint(Date.now()));
    };

    const ios = shown?.way === "ios";
    const data = shown?.why === "fav" || shown?.why === "log";
    const message =
        shown?.way === "inapp"
            ? t("inst.inapp")
            : data
              ? t(ios ? "inst.data.ios" : "inst.data")
              : shown?.why === "pack"
                ? t("inst.pack")
                : shown?.why === "offline"
                  ? t("inst.offline")
                  : t("inst.time");

    const act = (): void => {
        if (!shown) return;
        if (shown.way === "ios") {
            setSteps(true);
            return;
        }
        if (shown.way === "inapp") {
            void navigator.clipboard
                ?.writeText(location.href)
                .then(() => dispatch(uiActions.toast({ message: t("copied") })))
                .catch(() => undefined);
            close(true);
            return;
        }
        void install().then((outcome) => {
            if (outcome === "accepted") dispatch(prefsActions.installDone());
            close(outcome !== "accepted");
        });
    };

    return (
        <>
            <Snackbar
                open={shown !== null && !over && !steps}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                sx={{ mb: "calc(64px + var(--sab))" }}
                data-testid="install-hint"
            >
                <Alert severity="info" variant="filled">
                    {message}
                    {/* Under the text rather than beside it: beside it, on a phone, they squeeze
                        the sentence into a column a few words wide. */}
                    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
                        <Button color="inherit" size="small" onClick={() => close(true)}>
                            {t("inst.later")}
                        </Button>
                        <Button
                            color="inherit"
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700 }}
                            onClick={act}
                        >
                            {shown?.way === "inapp"
                                ? t("inst.inapp.copy")
                                : t(ios ? "inst.how" : "inst.go")}
                        </Button>
                    </Box>
                </Alert>
            </Snackbar>

            <Dialog open={steps} onClose={() => close(true)} maxWidth="xs">
                <DialogTitle>{t("inst.ios.t")}</DialogTitle>
                <DialogContent>
                    <Typography component="ol" variant="body2" sx={{ pl: 2.5, mt: 0 }}>
                        <li>{t("inst.ios.1")}</li>
                        <li>{t("inst.ios.2")}</li>
                        <li>{t("inst.ios.3")}</li>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        {t("inst.ios.note")}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => close(true)}>{t("inst.ios.done")}</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
