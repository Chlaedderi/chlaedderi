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
import { APP_NAME } from "@core/name";
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
export const linkTo = (token: string, packUrl?: string | null, packKey?: string | null): string => {
    const base = `${location.origin}${location.pathname}#${encodeURIComponent(token)}`;
    const address = packUrl ? packAddress(packUrl) : null;
    if (!address) return base;
    const link = `${base}?pack=${encodeURIComponent(address.url.split("#")[0] ?? address.url)}`;
    // Only a region that arrived locked has a key, so a link to a plain pack is byte for byte the
    // link it always was. The key rides in the fragment, which no server is ever sent.
    return packKey ? `${link}&k=${encodeURIComponent(packKey)}` : link;
};

/** `#/pack?url=…`: a link that says «here is my region» and nothing else. */
export const packLinkTo = (packUrl: string, packKey?: string | null): string | null => {
    const address = packAddress(packUrl);
    if (!address) return null;
    const link = `${location.origin}${location.pathname}#/pack?url=${encodeURIComponent(address.url)}`;
    return packKey ? `${link}&k=${encodeURIComponent(packKey)}` : link;
};

/**
 * The list as it is filtered right now: `#/pack?url=…&f=…`, or `#/?f=…` for a region with no
 * address to give.
 *
 * It goes through the region route rather than straight to the map, because filters without the
 * region they filter are an empty screen -- so the view link offers the region first and carries
 * the code across, which `PackLink` does on the way to `/`. The region link in the packs dialog is
 * a different thing and stays as it is: it says «here is my region», and nothing about a view.
 */
export const viewLinkTo = (
    code: string | null,
    packUrl?: string | null,
    packKey?: string | null,
): string => {
    const here = `${location.origin}${location.pathname}#/`;
    const address = packUrl ? packAddress(packUrl) : null;
    const params = new URLSearchParams();
    if (address) params.set("url", address.url.split("#")[0] ?? address.url);
    // Only a region that arrived locked has a key; the fragment is never sent to a server.
    if (address && packKey) params.set("k", packKey);
    if (code) params.set("f", code);
    const query = params.toString();
    if (!query) return here;
    return address ? `${here}pack?${query}` : `${here}?${query}`;
};

/**
 * The words that go above the link in the message.
 *
 * A shared link cannot carry a card of its own: the crag, the region's address and the key of a
 * sealed region all ride after the `#`, which no server is ever sent, so every crag link looks to
 * WhatsApp's crawler like a request for the front page and shows the app's own card. What can say
 * which crag it is, is the message -- and most share targets drop `title` and show `text`, so the
 * label goes there too. The label already names the route and the crag; this adds whose atlas it is.
 */
export const shareText = (label: string): string =>
    label === APP_NAME ? APP_NAME : `${label} – ${APP_NAME}`;

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
                    await navigator.share({ title: label, text: shareText(label), url });
                    return;
                }
                // The bare link, and no words: on a desktop a copied link is as likely to go into
                // an address bar as into a chat, and two lines are wrong there.
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
    packKey?: string | null,
) => Promise<void>) => {
    const { t } = useTranslation();
    const share = useShareLink();

    return useCallback(
        async (token: string, label?: string, packUrl?: string | null, packKey?: string | null) =>
            share(linkTo(token, packUrl, packKey), label ?? t("app.name")),
        [share, t],
    );
};
