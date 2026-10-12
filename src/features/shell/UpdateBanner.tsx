/**
 * «A new version is ready.»
 *
 * Asks before reloading, as the old app did -- someone standing at the wall with a route list open
 * does not want the page to change under them.
 *
 * The signal is the **service worker's waiting registration**, not a comparison of version strings.
 * The hand-written app could compare, because its deploy baked `APP_VERSION` into the bundle; ours
 * does not, so there is no «running version» in the page to compare anything against. Asking the
 * browser is both the honest answer and a stricter one: a worker only reaches `waiting` when a
 * genuinely different `sw.js` has been fetched and installed, so this cannot fire on a stale cache
 * -- which is exactly how the first port came to show the banner on every load.
 */

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";

/** Re-checked at most this often, and only when the app is in front. The original's interval. */
const EVERY = 30 * 60 * 1000;

export const UpdateBanner = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const ready = useAppSelector((s) => s.ui.updateReady);

    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_url, registration) {
            if (!registration) return;
            let last = Date.now();
            const check = (): void => {
                // Offline, or backgrounded, or asked too recently: nothing to gain.
                if (document.hidden || navigator.onLine === false) return;
                if (Date.now() - last < EVERY) return;
                last = Date.now();
                void registration.update().catch(() => {
                    // A failed check is not worth telling anyone about; the next one will do.
                });
            };
            document.addEventListener("visibilitychange", check);
            setInterval(check, EVERY);
        },
    });

    // One flag for the whole app: the banner here and the status line on the «More» page both
    // read it, which is what the original did with its single `updateWaiting`.
    useEffect(() => {
        if (needRefresh) dispatch(uiActions.setUpdateReady(true));
    }, [needRefresh, dispatch]);

    return (
        <Snackbar
            open={ready}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            sx={{ mb: "calc(64px + var(--sab))" }}
        >
            <Alert
                severity="info"
                variant="filled"
                action={
                    <Button
                        color="inherit"
                        size="small"
                        // `true` tells the waiting worker to take over, then reloads. A bare
                        // `location.reload()` would leave the old worker in charge and show the
                        // same banner again on the next load.
                        onClick={() => void updateServiceWorker(true)}
                    >
                        {t("m.reload")}
                    </Button>
                }
            >
                {t("m.update")}
            </Alert>
        </Snackbar>
    );
};
