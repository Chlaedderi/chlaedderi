/**
 * «App»: install it, which version is running, and fetching the newest one.
 *
 * All three were missing from the first React pass, and the version line showed its own
 * placeholder (`Version {0}: dev`) because it never got the version at all.
 */

import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { useInstallPrompt } from "@app/installPrompt";
import { prefsActions } from "@app/slices/prefsSlice";
import { useLang } from "@app/useAppData";
import { isIOSDevice } from "@core/installHint";
import { formatDate } from "@i18n/index";

import { isStandalone, loadVersion, refreshApp, useAppVersion } from "../../version";

const timeOf = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ""
        : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const AppSection = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const lang = useLang();
    const version = useAppVersion();
    // The same flag the banner sets, which the service worker drives -- the original kept one
    // `updateWaiting` and re-rendered «More» from it.
    const updateReady = useAppSelector((s) => s.ui.updateReady);
    const { canInstall, installed: justInstalled, install } = useInstallPrompt();
    const [online, setOnline] = useState(navigator.onLine !== false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        void loadVersion();
        const sync = (): void => setOnline(navigator.onLine !== false);
        window.addEventListener("online", sync);
        window.addEventListener("offline", sync);
        return () => {
            window.removeEventListener("online", sync);
            window.removeEventListener("offline", sync);
        };
    }, []);

    const installed = isStandalone() || justInstalled;
    const swOn = "serviceWorker" in navigator && navigator.serviceWorker.controller !== null;

    return (
        <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="h4" gutterBottom>
                {t("m.app")}
            </Typography>

            {updateReady && (
                <Alert
                    severity="info"
                    sx={{ mb: 1.5 }}
                    action={
                        // The original's `#reloadNow` called `refreshApp` too: a bare reload can
                        // be served by the old worker and change nothing.
                        <Button
                            color="inherit"
                            size="small"
                            disabled={refreshing}
                            onClick={() => {
                                setRefreshing(true);
                                void refreshApp();
                            }}
                        >
                            {t("m.reload")}
                        </Button>
                    }
                >
                    {t("m.update")}
                </Alert>
            )}

            {installed ? (
                <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 1.5 }}>
                    {t("m.installed")}
                </Alert>
            ) : canInstall ? (
                <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={() =>
                        void install().then((outcome) => {
                            // Nothing left for the install hint to say, on this device or after.
                            if (outcome === "accepted") dispatch(prefsActions.installDone());
                        })
                    }
                    sx={{ mb: 1.5 }}
                >
                    {t("m.install")}
                </Button>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {t(
                        isIOSDevice(
                            navigator.userAgent,
                            navigator.platform,
                            navigator.maxTouchPoints,
                        )
                            ? "m.install.ios"
                            : "m.install.and",
                    )}
                </Typography>
            )}

            <Typography variant="body2" color="text.secondary" gutterBottom>
                {t(swOn ? "m.offline.on" : "m.offline.off")}
            </Typography>

            <Typography variant="body2" color="text.secondary" gutterBottom>
                {version.built
                    ? t("m.ver.line", {
                          0: version.version,
                          1: `${formatDate(version.built.slice(0, 10), lang)} ${timeOf(version.built)}`,
                      })
                    : t("m.ver.dev")}
            </Typography>

            <Button
                startIcon={<DownloadIcon />}
                disabled={!online || refreshing}
                onClick={() => {
                    setRefreshing(true);
                    void refreshApp();
                }}
            >
                {t(refreshing ? "m.refreshing" : "m.refresh")}
            </Button>
            <Typography variant="body2" color="text.secondary">
                {t(online ? "m.refresh.h" : "m.refresh.off")}
            </Typography>
        </Box>
    );
};
