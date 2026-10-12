/**
 * Moving favourites and the logbook between browsers.
 *
 * This matters more than it looks. On iOS, Safari and the home-screen app have **separate**
 * storage: what you saved in one does not appear in the other, and deleting the home-screen icon
 * usually takes its storage with it. The code is the only way across, and the only backup there is.
 */

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { favouritesActions } from "@app/slices/favouritesSlice";
import { logbookActions } from "@app/slices/logbookSlice";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { encodeTransfer } from "@core/store";
import { mergeTransfer, readTransfer } from "@core/transfer";

export const BackupCode = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const favourites = useAppSelector((s) => s.favourites);
    const entries = useAppSelector((s) => s.logbook.entries);
    const prefs = useAppSelector((s) => s.prefs);
    const [code, setCode] = useState("");
    const [shown, setShown] = useState<string | null>(null);

    const make = (): void => {
        // FA2: the settings travel too, so the list of installed regions and the addresses they
        // came from arrive with the rest. See src/core/transfer.ts.
        const text = encodeTransfer(
            {
                v: 2,
                fav: { c: favourites.crags, r: favourites.routes },
                log: entries,
                prefs,
            },
            2,
        );
        setShown(text);
        navigator.clipboard?.writeText(text).then(
            () => dispatch(uiActions.toast({ message: t("fv.code.copied"), severity: "success" })),
            () => {
                /* no clipboard: the code is on screen to copy by hand */
            },
        );
    };

    const take = (): void => {
        const incoming = readTransfer(code);
        if (!incoming) {
            dispatch(uiActions.toast({ message: t("fv.import.bad"), severity: "error" }));
            return;
        }

        // Merged, never replaced: taking a code from another device must not lose what is here.
        // The same folding the `#/transfer` link does, from the one place that knows how.
        const merged = mergeTransfer(incoming, {
            crags: favourites.crags,
            routes: favourites.routes,
            log: entries,
            prefs,
        });

        dispatch(favouritesActions.restore({ crags: merged.crags, routes: merged.routes }));
        if (merged.gained.entries) dispatch(logbookActions.restore([...merged.log]));
        if (merged.prefs) dispatch(prefsActions.restore(merged.prefs));
        setCode("");
        dispatch(
            uiActions.toast({
                message: merged.nothingNew
                    ? t("fv.import.none")
                    : t("fv.import.ok", {
                          0: merged.gained.crags,
                          1: merged.gained.routes,
                          2: merged.gained.entries,
                      }),
                severity: "success",
            }),
        );
    };

    return (
        <Box sx={{ mt: 3 }}>
            <Typography variant="h4" gutterBottom>
                {t("fv.backup")}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                {t("fv.backup.t")}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
                <Button startIcon={<ContentCopyIcon />} onClick={make}>
                    {t("fv.copy")}
                </Button>
            </Stack>

            {shown && (
                <TextField
                    multiline
                    fullWidth
                    size="small"
                    value={shown}
                    slotProps={{
                        htmlInput: { readOnly: true, "aria-label": t("fv.code.show") },
                    }}
                    sx={{ mb: 2, "& textarea": { fontFamily: "monospace", fontSize: 12 } }}
                />
            )}

            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <TextField
                    size="small"
                    fullWidth
                    multiline
                    maxRows={3}
                    label={t("fv.code.ph")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                />
                <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    disabled={!code.trim()}
                    onClick={take}
                >
                    {t("fv.import")}
                </Button>
            </Stack>
        </Box>
    );
};
