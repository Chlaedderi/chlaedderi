import CloseIcon from "@mui/icons-material/Close";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import DownloadIcon from "@mui/icons-material/Download";
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
import { useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { useLang } from "@app/useAppData";
import { downloadFile } from "@core/download";
import { packFileName, storedPackText } from "@core/packs/storage";
import type { PackProblem } from "@core/packs/validate";
import { routeFromShared } from "@core/sharedLink";
import { i18 } from "@core/text";

import { packLinkTo, useShareLink } from "../shell/useShare";

import { PackProblems } from "./PackProblems";
import { useInstalledApp } from "./useInstalledApp";
import { usePasteLink } from "./usePasteLink";

export const PacksDialog = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const open = useAppSelector((s) => s.ui.packsOpen);
    const installed = useAppSelector((s) => s.prefs.packs);
    const { installFromUrl, installFromFile, uninstall, busy, onlyShowcase } = useData();
    const navigate = useNavigate();
    const shareLink = useShareLink();
    const region = useAppSelector((st) => st.prefs.region);
    // Safari in private mode, and a device under storage pressure, will evict the pack cache.
    // The original warned about it rather than letting the packs vanish unexplained.
    const [persistent, setPersistent] = useState<boolean | null>(null);
    // Asked again after every install, because installing is what asks the browser to keep the
    // packs (DataProvider). Read only once, the warning would stay up until the next reload --
    // over a device that had just granted persistence.
    useEffect(() => {
        navigator.storage?.persisted?.().then(setPersistent, () => setPersistent(null));
        // `installed` is the trigger, not an input: the answer is about the origin, not the list.
    }, [installed]);
    // A tab on a device that also has the app: the two share this store, which is worth saying.
    const alsoInApp = useInstalledApp();
    // On iOS this is the only way a region gets in at all -- see usePasteLink. Null where the
    // browser hands no clipboard to a page, and then the button is not there to be tapped.
    const paste = usePasteLink();
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

    // The file as it was stored, for passing on by hand. Only for a pack with no key: a sealed one
    // is stored opened, and saving that would undo the seal its publisher put on it.
    const download = async (id: string) => {
        const text = await storedPackText(id);
        try {
            if (text == null) throw new Error("not in the cache");
            downloadFile(packFileName(id), text, "application/json");
        } catch {
            dispatch(uiActions.toast({ message: t("pk.download.fail"), severity: "warning" }));
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
                {alsoInApp && (
                    <Alert severity="info" sx={{ mb: 1 }}>
                        {t("pk.inApp")}
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
                                    {pack.src && !pack.src.key && (
                                        <IconButton
                                            aria-label={t("pk.download")}
                                            title={t("pk.download")}
                                            disabled={busy}
                                            onClick={() => void download(pack.id)}
                                        >
                                            <DownloadIcon fontSize="small" />
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
                                                            pack.id,
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
                            // A link to the app itself -- what «share» hands out, with the key
                            // in its fragment -- goes where a pasted one goes. Fetched as it
                            // stands it is the app's own page, «not a mappack», key ignored.
                            const typed = url.trim();
                            // Only a fragment in the app's own shape: a pack address may carry one of its own.
                            const hash = typed.slice(typed.indexOf("#") + 1);
                            const ours = typed.includes("#") && /^\/|[?&]pack=/.test(hash);
                            const route = ours ? routeFromShared(typed) : null;
                            if (route !== null && route !== "/") {
                                void navigate(route);
                                return;
                            }
                            dispatch(uiActions.offerPack({ url: typed, fetchNow: true }));
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

                <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {paste && (
                        <Button startIcon={<ContentPasteIcon />} disabled={busy} onClick={paste}>
                            {t("pk.paste")}
                        </Button>
                    )}
                    <Button
                        startIcon={<UploadFileIcon />}
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                    >
                        {t("pk.fromFile")}
                    </Button>
                </Box>
                <input
                    ref={fileInput}
                    type="file"
                    // `readPackFile` reads a `.chlpack` as well as a `.json`, and has since there
                    // were any. Leaving the extension out of this list greyed the file out in the
                    // picker on every platform that honours the attribute -- a file the app can
                    // read, refused before it was offered, with nothing said. Now it is choosable,
                    // and a sealed one answers «this region is locked», which at least names what
                    // is missing. `application/octet-stream` is beside it because that is the type
                    // a download of an unknown extension arrives with.
                    accept=".json,application/json,.chlpack,application/octet-stream"
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
