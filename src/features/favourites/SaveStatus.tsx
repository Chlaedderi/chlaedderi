/**
 * Whether what you saved actually got saved.
 *
 * The app keeps favourites and the logbook in three independent stores and reads them back after
 * every write; this line says what that came to. It is not decoration: a browser in private mode
 * silently keeps nothing, and a climber with two seasons of logbook deserves to be told that
 * before they lose it.
 */

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/ErrorOutlined";
import WarningIcon from "@mui/icons-material/WarningAmber";
import Alert from "@mui/material/Alert";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLang } from "@app/useAppData";
import { type StoreStatus, openStore } from "@core/store";
import { formatDate } from "@i18n/index";

const store = openStore();

export const SaveStatus = ({
    saved,
}: {
    /** What the last write reported, or null when nothing has been written yet. */
    readonly saved: { ok: boolean; verified: boolean; at: number } | null;
}) => {
    const { t } = useTranslation();
    const lang = useLang();
    const [status, setStatus] = useState<StoreStatus | null>(null);

    useEffect(() => {
        void store.ready.then(setStatus);
    }, []);

    if (!status) return null;

    const durable = status.durable;
    const persisted = status.persisted ? ` ${t("fv.persist")}` : "";

    // Nothing written yet: say whether this browser *can* keep it.
    if (!saved) {
        if (durable) {
            return (
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
                    {t("fv.ok.none")}
                    {persisted}
                </Alert>
            );
        }
        return status.layers.ls ? (
            <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 2 }}>
                {t("fv.basic")}
            </Alert>
        ) : (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
                {t("fv.bad")}
            </Alert>
        );
    }

    if (saved.ok && saved.verified && durable) {
        const when = formatDate(new Date(saved.at).toISOString().slice(0, 10), lang);
        return (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
                {t("fv.ok", { 0: when })}
                {persisted}
            </Alert>
        );
    }

    return saved.ok ? (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 2 }}>
            {t("fv.basic")}
        </Alert>
    ) : (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
            {t("fv.bad")}
        </Alert>
    );
};
