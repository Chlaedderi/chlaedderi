/**
 * «Paste a link» -- the only way a region reaches the app on iOS.
 *
 * A home-screen web app there keeps its storage apart from Safari's, so a region loaded in the
 * tab is simply not in the app, and no web API can carry it across. iOS has no share targets
 * either, and captures no link into an installed app: copy the link, open the app, paste it is
 * the whole of the path. Today that means a long press into a text field, which is a gesture
 * nobody finds. This makes it a button.
 *
 * It decides nothing of its own. `core/sharedLink.ts` reads the clipboard text exactly as it
 * reads a message out of the Android share sheet -- by shape, so a `/pr-12/` preview's link and a
 * dev server's are as good as the deployed one -- and `PackLink` or `LegacyLink` then apply the
 * policy they already own. A second parser here would be the same rules in two places, and the
 * two would part company.
 *
 * Null where the clipboard cannot be read at all: Firefox has never handed `readText` to a page,
 * and a button that can only fail is worse than no button.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppDispatch } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";
import { routeFromShared } from "@core/sharedLink";

/** What the button does, or null where this browser has no clipboard to read. */
export const usePasteLink = (): (() => void) | null => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const nothing = useCallback(() => {
        dispatch(uiActions.toast({ message: t("pk.paste.none"), severity: "warning" }));
    }, [dispatch, t]);

    const paste = useCallback(() => {
        void navigator.clipboard.readText().then((text) => {
            const route = routeFromShared(text);
            // `routeFromShared` answers `/` for a link that is plainly to a page rather than to a
            // thing -- somebody's home page, the app's own front. A share opens the app on that
            // and says nothing more; here the question asked was «which region», so the honest
            // answer is that the clipboard held none.
            if (route === null || route === "/") {
                nothing();
                return;
            }
            // Straight to the route, and nothing else: the packs dialog stays open and is taken
            // off screen by the offer itself, which waits out its fade first (PackOffer's
            // `settled`). Closing it here, in the same tick, leaves its backdrop above the offer
            // and the buttons there stop taking taps -- which is why the «load» button beside
            // this one hands off the same way.
            void navigate(route);
        }, nothing);
        // Reading the clipboard is the viewer's to refuse, and a refusal -- or a browser that
        // never offers the prompt -- is not an error: it is nothing usable, said once.
    }, [navigate, nothing]);

    // `typeof`, because the DOM types declare `readText` as always there: on Firefox and on an
    // insecure origin the whole `clipboard` object is missing, and on Safari before 13.1 the
    // object is there with only the writing half on it.
    return typeof navigator.clipboard?.readText === "function" ? paste : null;
};
