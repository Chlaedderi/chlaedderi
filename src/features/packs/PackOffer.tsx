/**
 * «Load this region?» -- the one place a region arrives from outside.
 *
 * A link can now carry a region: a crag link names the pack it came from, and `#/pack?url=…`
 * names nothing else. That is the point of the feature and also its whole risk, because the
 * address in such a link was chosen by whoever sent it. So nothing is installed without this
 * dialog, and the dialog says the two things that decide the answer: which host it comes from,
 * and whether it would replace a region the viewer already has.
 *
 * It asks in two steps. A link from outside opens it showing the host alone, and fetches only
 * when the viewer asks it to -- so an address somebody else chose is not reached merely because
 * a link was opened, and 644 kB is not spent on a mobile connection before anyone has seen where
 * it comes from. An address the viewer typed into the packs dialog themselves skips that step:
 * typing it was the consent.
 *
 * Everything shown out of the pack goes through `oneLine`. Nothing from a pack ever becomes HTML
 * -- React escapes these as text, as everywhere else -- but a name is unbounded in the schema,
 * and this is the one dialog where a name that reshapes the buttons around it would matter.
 *
 * The host is named twice over, and on purpose: `shownHost` reads it back into a name where it can
 * vouch for one, and the address underneath stays exactly what the machine will go and fetch. One
 * line is for recognising and the other is for checking, so neither has to be both.
 */

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { useLang } from "@app/useAppData";
import { shownHost } from "@core/idn";
import { type PackLoad, fetchPack } from "@core/packs/storage";
import { packAddress } from "@core/packs/url";
import { i18, oneLine } from "@core/text";

import { PackProblems } from "./PackProblems";

/** A region's name is two or three words; its `notes` a sentence. Neither is bounded by schema. */
const NAME_MAX = 80;
const NOTES_MAX = 200;

type Fetched = PackLoad & { readonly text?: string; readonly url: string };

export const PackOffer = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const offer = useAppSelector((s) => s.ui.packOffer);
    const packsOpen = useAppSelector((s) => s.ui.packsOpen);
    const installed = useAppSelector((s) => s.prefs.packs);
    const { installLoaded, busy, booted, byId, regions, onlyShowcase } = useData();

    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<Fetched | null>(null);
    /** The crag link that asked for this region, once there is a region to open it in. */
    const [pending, setPending] = useState<string | null>(null);
    const abort = useRef<AbortController | null>(null);
    /**
     * The packs dialog is gone *and* has finished leaving.
     *
     * Two modals whose lives overlap do not work here: closing that one as this one opens leaves
     * its backdrop on top, and leaving it open stacks them -- either way the buttons below stop
     * taking taps, which is a dialog that silently cannot be answered. Flipping the state is not
     * enough, because MUI still has the old one in the document while it fades; this waits that
     * out. Nothing to wait for when the offer came from a link, which is the common case.
     */
    const [settled, setSettled] = useState(!packsOpen);
    useEffect(() => {
        if (packsOpen) {
            setSettled(false);
            return;
        }
        const id = setTimeout(() => setSettled(true), 300);
        return () => clearTimeout(id);
    }, [packsOpen]);

    // An address the viewer typed may be relative -- it means this site, and that is how the
    // packs dialog has always worked. One out of a link may not: it would resolve against
    // whoever opened the link instead of whoever sent it.
    const address = offer
        ? packAddress(offer.url, offer.fetchNow ? location.href : undefined)
        : null;

    const close = useCallback(() => {
        abort.current?.abort();
        abort.current = null;
        setChecking(false);
        setResult(null);
        dispatch(uiActions.clearOffer());
    }, [dispatch]);

    const check = useCallback(async () => {
        if (!address) return;
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        setChecking(true);
        const load = await fetchPack(address.url, controller.signal, offer?.key);
        if (controller.signal.aborted) return;
        abort.current = null;
        setChecking(false);
        setResult(load);
    }, [address, offer?.key]);

    // A new offer: refuse what cannot be fetched, skip what is already here, and otherwise either
    // ask or go straight to fetching.
    useEffect(() => {
        if (!offer) return;
        if (!address) {
            dispatch(uiActions.toast({ message: t("po.badurl"), severity: "warning" }));
            dispatch(uiActions.clearOffer());
            return;
        }
        // Take over from the packs dialog, and let it finish leaving first -- see `settled`.
        if (packsOpen) {
            dispatch(uiActions.setPacksOpen(false));
            return;
        }
        if (!settled) return;

        if (!booted) return;

        // Here means mounted, not merely listed: a region whose stored copy the browser evicted, or
        // that would not read back, stays in the list -- and switching to it would bounce straight
        // back off, saying nothing. That one is fetched again like any other. Nor is the built-in
        // showcase standing in for it, which may carry the same id.
        const here = installed.find(
            (p) =>
                p.src?.url === address.url && !onlyShowcase && regions.some((r) => r.key === p.id),
        );
        if (here) {
            // Nothing to download and nothing to decide: it is this region, and it is already here.
            dispatch(prefsActions.setRegion(here.id));
            dispatch(uiActions.clearOffer());
            if (offer.then) setPending(offer.then);
            return;
        }
        if (offer.fetchNow && !result && !checking) void check();
        // `result` and `checking` are read to avoid re-fetching, not to react to them.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        offer,
        address?.url,
        booted,
        packsOpen,
        settled,
        installed,
        regions,
        onlyShowcase,
        dispatch,
        t,
    ]);

    // Follow the link that asked for the region, once that region is actually mounted. Waiting
    // for `byId` matters: navigating straight off the install lands a commit early, and CragPage
    // sends a crag it cannot find home with `replace`, destroying the entry the viewer came in on.
    //
    // Straight to the crag rather than back through the legacy token: the token route would have
    // to resolve a second time against a `byId` that has only just changed, and one hop that can
    // be relied on beats two that nearly can.
    useEffect(() => {
        if (!pending) return;
        const cragId = pending.split("~")[0] ?? "";
        const crag = byId[cragId];
        if (!crag) return;
        setPending(null);
        const route = pending.includes("~")
            ? crag.routes.find((r) => r.key === pending)
            : undefined;
        if (pending.includes("~") && !route) {
            dispatch(uiActions.toast({ message: t("link.noroute"), severity: "warning" }));
        }
        void navigate(`/crag/${cragId}`, {
            replace: true,
            state: route ? { route: route.key } : undefined,
        });
    }, [pending, byId, navigate, dispatch, t]);

    useEffect(() => () => abort.current?.abort(), []);

    if (!offer || !address || packsOpen || !settled) return null;

    const pack = result?.ok ? result.pack : null;
    const name = pack ? oneLine(i18(pack.name, lang), NAME_MAX) : "";
    const notes = pack?.notes ? oneLine(i18(pack.notes, lang), NOTES_MAX) : "";
    const replaced = pack ? installed.find((p) => p.id === pack.id) : undefined;
    const replacedAt = replaced?.src?.url ? packAddress(replaced.src.url) : null;
    // «Is this the same place the bytes came from last time?» is a machine's question, so it is
    // asked of the host itself. Two names that read alike are not one host.
    const elsewhere = replaced?.src?.url ? replacedAt?.host !== address.host : false;

    const confirm = async () => {
        if (!result?.ok || !result.text) return;
        const done = await installLoaded(
            { ...result, text: result.text },
            {
                type: "url",
                url: result.url,
                key: offer.key,
            },
        );
        if (!done.ok) {
            setResult(done as Fetched);
            return;
        }
        dispatch(uiActions.toast({ message: t("pk.loaded"), severity: "success" }));
        // Only follow the link if this region really holds that crag -- otherwise say so here
        // rather than navigating hopefully and waiting for something that will never arrive.
        if (offer.then) {
            const cragId = offer.then.split("~")[0] ?? "";
            if (result.pack.sectors.some((s) => s.id === cragId)) setPending(offer.then);
            else dispatch(uiActions.toast({ message: t("link.nocrag"), severity: "warning" }));
        }
        close();
    };

    return (
        <Dialog open onClose={close} fullWidth maxWidth="xs">
            {(checking || busy) && <LinearProgress />}
            <DialogContent>
                <Typography variant="h3" gutterBottom>
                    {t("po.title")}
                </Typography>

                {/*
                 * The address, in a box of its own. A host is as long as whoever registered it
                 * cared to make it, and this dialog is `xs` wide: left to run, it would push the
                 * part of the host that decides off the edge, or grow the dialog around its own
                 * buttons. So it wraps, it is bounded, and it scrolls inside its border rather
                 * than reshaping anything around it. `unicode-bidi: isolate` keeps whatever is in
                 * here from reordering what is not -- `new URL()` already drops a byte-order mark
                 * out of a host and refuses a bidi override, and nothing `shownHost` hands back
                 * carries one either, but this line is worth two locks.
                 */}
                <Box
                    sx={{
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        bgcolor: "action.hover",
                        px: 1,
                        py: 0.75,
                        mb: 1,
                        maxHeight: 120,
                        overflowY: "auto",
                        direction: "ltr",
                        unicodeBidi: "isolate",
                    }}
                >
                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                        {t("po.from", { 0: shownHost(address.host) })}
                    </Typography>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            overflowWrap: "anywhere",
                            fontFamily: "monospace",
                        }}
                    >
                        {address.url}
                    </Typography>
                </Box>

                {checking && <Typography variant="body2">{t("po.checking")}</Typography>}

                {pack && (
                    <>
                        <Typography variant="subtitle1" sx={{ overflowWrap: "anywhere" }}>
                            {name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {t("pk.sum", {
                                0: pack.sectors.length,
                                1: pack.sectors.reduce((n, s) => n + (s.routes?.length ?? 0), 0),
                                2: pack.version,
                            })}
                            {result?.ok &&
                                ` · ${t("pk.size", { 0: Math.round(result.bytes / 1024) })}`}
                        </Typography>
                        {notes && (
                            <Typography
                                variant="body2"
                                sx={{ mt: 1, overflowWrap: "anywhere" }}
                                color="text.secondary"
                            >
                                {notes}
                            </Typography>
                        )}
                        {pack.partial === true && (
                            <Alert severity="info" sx={{ mt: 1 }}>
                                {t("pk.showcase.h")}
                            </Alert>
                        )}
                        {replaced && (
                            <Alert severity={elsewhere ? "error" : "warning"} sx={{ mt: 1 }}>
                                {t("po.replaces", {
                                    0: oneLine(
                                        replaced.name ? i18(replaced.name, lang) : replaced.id,
                                        NAME_MAX,
                                    ),
                                    1: replaced.version ?? "",
                                    2: replaced.crags ?? 0,
                                    // Read the same way as the host above it: the dialog is asking
                                    // for a comparison, and two spellings of one host would read
                                    // as an alarm that is not there.
                                    // A region that came as a file has no host: its file's name
                                    // then, rather than «from )».
                                    3: replacedAt
                                        ? shownHost(replacedAt.host)
                                        : oneLine(replaced.src?.name ?? "–", NAME_MAX),
                                })}
                            </Alert>
                        )}
                    </>
                )}

                {result && !result.ok && <PackProblems problems={result.problems} />}
            </DialogContent>

            <DialogActions>
                <Button onClick={close}>{t("po.notnow")}</Button>
                {!result && (
                    <Button
                        variant="contained"
                        disabled={checking || !booted}
                        onClick={() => void check()}
                    >
                        {t("po.check")}
                    </Button>
                )}
                {pack && (
                    <Button
                        variant="contained"
                        color={replaced ? "error" : "primary"}
                        disabled={busy || !booted}
                        onClick={() => void confirm()}
                    >
                        {replaced ? t("po.replace") : t("po.load")}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};
