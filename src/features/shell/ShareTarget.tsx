/**
 * `#/share?text=…` -- what the Android share sheet leaves behind.
 *
 * The installed app is a share target (manifest.webmanifest), and the share arrives as a POST that
 * tools/share-target.js answers inside the service worker: it reads the form, joins the fields and
 * redirects here with the text in the fragment, where no server will ever see it. A sealed
 * region's key is in that text, which is the whole reason the target is a POST.
 *
 * This translates and gets out of the way. `routeFromShared` says which route the message means,
 * and `PackLink` or `LegacyLink` then decide what to do about it -- whether the region is already
 * installed, whether the showcase holds that crag only partially. Deciding any of that a second
 * time here would be the same policy in two places, and the two would part company.
 *
 * A sector id may legally be the literal string `share` (`^[a-z0-9][a-z0-9-]*$`), so a visit
 * without any `text` falls through to `LegacyLink`, exactly as `PackLink` does for `pack`.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppDispatch } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";
import { routeFromShared } from "@core/sharedLink";

import { LegacyLink } from "./LegacyLink";

export const ShareTarget = () => {
    const [params] = useSearchParams();
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const text = params.get("text");
    const route = text === null ? null : routeFromShared(text);

    useEffect(() => {
        if (text === null) return;
        // Nothing in the message was a link: the app opens, and says so rather than appearing to
        // have swallowed the share.
        if (route === null) {
            dispatch(uiActions.toast({ message: t("share.nolink"), severity: "warning" }));
        }
        // Away from the link at once, so that a reload does not act on it a second time.
        void navigate(route ?? "/", { replace: true });
    }, [text, route, dispatch, navigate, t]);

    return text === null ? <LegacyLink /> : null;
};
