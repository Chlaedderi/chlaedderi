/**
 * Sharing a link to a crag or a route.
 *
 * The link is the app's own deep link (`#<crag-id>`), which the hand-written app used and which is
 * therefore in people's messages already. The share sheet is used where the browser has one; on a
 * desktop the link goes to the clipboard instead, which is what the original fell back to.
 *
 * Such a link only ever worked for somebody who already had that region: anybody else landed on
 * an unknown crag and was told so. So a link now carries the address the region came from, and
 * the app offers to load it. A region installed from a file has no address and those links are
 * exactly as they were.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";
import { packAddress } from "@core/packs/url";

/**
 * The address of a crag, or of one route inside it, with the region's own address along for the
 * ride.
 *
 * A relative address is dropped rather than carried: it would resolve against whoever opens the
 * link, not against whoever sent it. A fragment is dropped too -- a location is split at the
 * first `#` before the first `?`, so one inside the address would take the rest of the link with
 * it.
 */
export const linkTo = (token: string, packUrl?: string | null): string => {
    const base = `${location.origin}${location.pathname}#${encodeURIComponent(token)}`;
    const address = packUrl ? packAddress(packUrl) : null;
    if (!address) return base;
    return `${base}?pack=${encodeURIComponent(address.url.split("#")[0] ?? address.url)}`;
};

/** `#/pack?url=…`: a link that says «here is my region» and nothing else. */
export const packLinkTo = (packUrl: string): string | null => {
    const address = packAddress(packUrl);
    if (!address) return null;
    return `${location.origin}${location.pathname}#/pack?url=${encodeURIComponent(address.url)}`;
};

/**
 * Hand a link to the share sheet, the clipboard, or -- failing both -- to the viewer's own eyes.
 * Shared by the crag and route links and by the link to a whole region.
 */
export const useShareLink = (): ((url: string, label: string) => Promise<void>) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();

    return useCallback(
        async (url: string, label: string) => {
            try {
                if (navigator.share) {
                    await navigator.share({ title: label, url });
                    return;
                }
                await navigator.clipboard.writeText(url);
                dispatch(
                    uiActions.toast({
                        message: t("share.copied", { 0: label }),
                        severity: "success",
                    }),
                );
            } catch (e) {
                // A share the viewer cancelled is not a failure worth a message.
                if (e instanceof DOMException && e.name === "AbortError") return;
                // Neither a share sheet nor a clipboard -- an insecure context, say. Show the link
                // itself so it can be copied by hand, as the original did.
                dispatch(uiActions.toast({ message: `${t("share.copy", { 0: label })} ${url}` }));
            }
        },
        [dispatch, t],
    );
};

export const useShare = (): ((
    token: string,
    label?: string,
    packUrl?: string | null,
) => Promise<void>) => {
    const { t } = useTranslation();
    const share = useShareLink();

    return useCallback(
        async (token: string, label?: string, packUrl?: string | null) =>
            share(linkTo(token, packUrl), label ?? t("app.name")),
        [share, t],
    );
};
