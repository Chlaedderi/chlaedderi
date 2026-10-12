import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShareIcon from "@mui/icons-material/Share";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { useLang } from "@app/useAppData";
import type { PackProblem } from "@core/packs/validate";
import { i18 } from "@core/text";

import { packLinkTo, useShareLink } from "../shell/useShare";

import { PackProblems } from "./PackProblems";

export const PacksDialog = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const open = useAppSelector((s) => s.ui.packsOpen);
    const installed = useAppSelector((s) => s.prefs.packs);
    const { installFromUrl, installFromFile, uninstall, busy, onlyShowcase } = useData();
    const shareLink = useShareLink();
    const region = useAppSelector((st) => st.prefs.region);
    // Safari in private mode, and a device under storage pressure, will evict the pack cache.
    // The original warned about it rather than letting the packs vanish unexplained.
    const [persistent, setPersistent] = useState<boolean | null>(null);
    useEffect(() => {
        navigator.storage?.persisted?.().then(setPersistent, () => setPersistent(null));
    }, []);
    const [url, setUrl] = useState("");
    const [problems, setProblems] = useState<readonly PackProblem[] | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    const close = () => {
        setProblems(null);
        dispatch(uiActions.setPacksOpen(false));
    };

    const run = async (
        work: () => Promise<{ ok: boolean; problems?: readonly PackProblem[] }>,
        what?: string,
    ) => {
        setProblems(null);
        if (what) dispatch(uiActions.toast({ message: t("pk.loading", { 0: what }) }));
        const result = await work();
        if (result.ok) {
            dispatch(uiActions.toast({ message: t("pk.loaded"), severity: "success" }));
            close();
        } else {
            setProblems(result.problems ?? []);
        }
    };

    return (
        <Dialog open={open} onClose={close} fullWidth maxWidth="sm" scroll="paper">
            <Toolbar sx={{ gap: 1 }}>
                <Typography variant="h3" sx={{ flex: 1 }}>
                    {t("pk.title")}
                </Typography>
                <IconButton onClick={close} aria-label={t("close")}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            {busy && <LinearProgress />}

            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {t("pk.intro")}
                </Typography>
                {onlyShowcase && (
                    <Alert severity="info" sx={{ mb: 1 }}>
                        {t("pk.hint")}
                    </Alert>
                )}
                {persistent === false && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                        {t("pk.notkept")}
                    </Alert>
                )}

                <Typography variant="h4" sx={{ mt: 2, mb: 1 }}>
                    {t("pk.installed")}
                </Typography>
                {installed.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        {t("pk.none")}
                    </Typography>
                ) : (
                    <Stack spacing={1}>
                        {installed.map((pack) => (
                            <Card key={pack.id}>
                                <CardContent
                                    sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.25 }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="subtitle2" className="kat-ellipsis">
                                            {pack.name ? i18(pack.name, lang) : pack.id}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t("pk.sum", {
                                                0: pack.crags,
                                                1: pack.routes,
                                                2: pack.version,
                                            })}
                                            {pack.bytes != null &&
                                                ` · ${t("pk.size", {
                                                    0: Math.round(pack.bytes / 1024),
                                                })}`}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ display: "block" }}
                                        >
                                            {pack.src?.type === "file"
                                                ? t("pk.fromFileName", {
                                                      0: pack.src.name ?? "",
                                                  })
                                                : (pack.src?.url ?? t("pk.builtin"))}
                                        </Typography>
                                        {pack.partial && (
                                            <Typography variant="caption" color="warning.main">
                                                {t("pk.showcase.h")}
                                            </Typography>
                                        )}
                                    </Box>
                                    {region !== pack.id && (
                                        <Button
                                            size="small"
                                            disabled={busy}
                                            onClick={() => {
                                                dispatch(prefsActions.setRegion(pack.id));
                                                close();
                                            }}
                                        >
                                            {t("pk.show")}
                                        </Button>
                                    )}
                                    {region === pack.id && (
                                        <Typography variant="caption" color="primary.main">
                                            {t("pk.active")}
                                        </Typography>
                                    )}
                                    {pack.src?.type === "url" && pack.src.url && (
                                        <IconButton
                                            aria-label={t("pk.share")}
                                            disabled={busy}
                                            onClick={() => {
                                                const link = packLinkTo(
                                                    pack.src!.url!,
                                                    pack.src!.key,
                                                );
                                                const name = pack.name
                                                    ? i18(pack.name, lang)
                                                    : pack.id;
                                                if (link) void shareLink(link, name);
                                            }}
                                        >
                                            <ShareIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                    {pack.src?.type === "url" && pack.src.url && (
                                        <IconButton
                                            aria-label={t("pk.update")}
                                            disabled={busy}
                                            onClick={() =>
                                                void run(
                                                    () =>
                                                        installFromUrl(
                                                            pack.src!.url!,
                                                            pack.src!.key,
                                                        ),
                                                    pack.name ? i18(pack.name, lang) : pack.id,
                                                )
                                            }
                                        >
                                            <RefreshIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                    <IconButton
                                        aria-label={t("pk.unload")}
                                        disabled={busy}
                                        onClick={() => {
                                            const name = pack.name ? i18(pack.name, lang) : pack.id;
                                            void uninstall(pack.id).then(() =>
                                                dispatch(
                                                    uiActions.toast({
                                                        message: t("pk.removed", { 0: name }),
                                                    }),
                                                ),
                                            );
                                        }}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                )}

                <Typography variant="h4" sx={{ mt: 3, mb: 1 }}>
                    {t("pk.own")}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <TextField
                        size="small"
                        fullWidth
                        type="url"
                        placeholder="https://…"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        label={t("pk.fromUrl")}
                    />
                    <Button
                        variant="contained"
                        disabled={busy || !url.trim()}
                        onClick={() => {
                            // Through the same confirmation a link goes through. Not for
                            // symmetry: that dialog is the only place that says a region of this
                            // id is already loaded and about to be replaced, which is the one
                            // thing whoever typed the address cannot know in advance. It fetches
                            // straight away, though -- typing the address was the consent.
                            setProblems(null);
                            // The offer closes this dialog itself, once it is up. Closing it
                            // here instead -- in the same tick as the offer opens -- leaves this
                            // one's backdrop above the offer, and the buttons there stop taking
                            // taps.
                            dispatch(uiActions.offerPack({ url: url.trim(), fetchNow: true }));
                        }}
                    >
                        {t("pk.load")}
                    </Button>
                </Stack>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    gutterBottom
                    sx={{ display: "block" }}
                >
                    {t("pk.fromUrl.h")}
                </Typography>

                <Button
                    startIcon={<UploadFileIcon />}
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                    sx={{ mt: 1 }}
                >
                    {t("pk.fromFile")}
                </Button>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void run(() => installFromFile(file), file.name);
                        e.target.value = "";
                    }}
                />

                {problems && <PackProblems problems={problems} />}

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 2 }}
                >
                    {t("pk.keepsFav")}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {t("pk.format")}{" "}
                    <Link href="mappack.schema.json" target="_blank" rel="noopener">
                        mappack.schema.json
                    </Link>
                </Typography>
            </DialogContent>
        </Dialog>
    );
};
