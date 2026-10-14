/**
 * Opening a shared link.
 *
 * The hand-written app addressed a crag as `#<cragId>` and one route as `#<cragId>~<routeKey>`
 * (`openToken`, index.html:2736), and those links are in people's messages and bookmarks. This app
 * routes with a `HashRouter`, so such a hash arrives here as an unmatched path -- without this it
 * would fall through to the home screen and the link would silently do nothing.
 *
 * The behaviour is the original's, including which complaint is made when:
 *   - no such crag          -> `link.nocrag`, stay on the list
 *   - crag found, route not -> `link.noroute`, open the crag anyway
 *   - crag in another pack  -> switch region first, as `setRegion(s.reg)` did
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";

export const LegacyLink = () => {
    const { pathname, search } = useLocation();
    const { byId, booted, regions } = useData();
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const region = useAppSelector((s) => s.prefs.region);
    const installed = useAppSelector((s) => s.prefs.packs);

    useEffect(() => {
        // The packs are read from the Cache Storage after the first render. Resolving before that
        // would find an empty `byId` and declare every link dead.
        if (!booted) return;

        let token = pathname.replace(/^\//, "");
        try {
            token = decodeURIComponent(token);
        } catch {
            // A malformed escape is not worth a message; the raw text still may name a crag.
        }
        if (!token) {
            void navigate("/", { replace: true });
            return;
        }

        const cragId = token.split("~")[0] ?? "";
        const crag = byId[cragId];

        // The link may name the region it came from. Offer it when the crag is missing -- and
        // also when the crag is here but only because the built-in showcase happens to hold it:
        // the showcase shares both its id and six of its crags with the real Finale pack, so the
        // likeliest first contact of all is somebody being shown a partial page of a region
        // nobody offered them. The schema says as much of `partial`: keep asking for a full pack.
        const params = new URLSearchParams(search);
        const offered = params.get("pack");
        // A locked region travels with its key in the fragment, never in a request.
        const offeredKey = params.get("k") ?? undefined;
        const theirs = crag ? regions.find((r) => r.key === crag.packId) : null;
        // Mounted, not merely listed: an evicted region is still in the list and has no crags.
        const haveIt = offered
            ? installed.some((p) => p.src?.url === offered && regions.some((r) => r.key === p.id))
            : true;
        if (offered && !haveIt && (!crag || theirs?.partial === true)) {
            dispatch(uiActions.offerPack({ url: offered, key: offeredKey, then: token }));
            if (!crag) {
                void navigate("/", { replace: true });
                return;
            }
        }

        if (!crag) {
            dispatch(uiActions.toast({ message: t("link.nocrag"), severity: "warning" }));
            void navigate("/", { replace: true });
            return;
        }

        if (crag.packId !== region) dispatch(prefsActions.setRegion(crag.packId));

        // A route token that no longer matches -- the pack was renumbered, say. The original said
        // so and still opened the crag.
        const wantsRoute = token.includes("~");
        const route = wantsRoute ? crag.routes.find((r) => r.key === token) : null;
        if (wantsRoute && !route) {
            dispatch(uiActions.toast({ message: t("link.noroute"), severity: "warning" }));
        }

        void navigate(`/crag/${cragId}`, {
            replace: true,
            state: route ? { route: route.key } : undefined,
        });
    }, [booted, pathname, search, byId, regions, installed, region, dispatch, navigate, t]);

    return null;
};
