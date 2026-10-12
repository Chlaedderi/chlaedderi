/**
 * `#/pack?url=…` -- a link that says «here is my region».
 *
 * The one address that can be sent to somebody who has nothing installed yet. It carries no crag:
 * it offers the region and leaves the viewer on the map. What it does *not* do is install
 * anything; that is `PackOffer`'s to ask.
 *
 * A sector id may legally be the literal string `pack` (`^[a-z0-9][a-z0-9-]*$`), and `#pack` would
 * then be routed here instead of being read as a crag. So a visit without a usable `url` falls
 * through to `LegacyLink`, which is what would have answered it anyway.
 */

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppDispatch } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";

import { LegacyLink } from "./LegacyLink";

export const PackLink = () => {
    const [params] = useSearchParams();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const url = params.get("url");
    // Inside the hash, so it never reaches a server -- see src/core/packs/chlpack.ts.
    const key = params.get("k") ?? undefined;

    useEffect(() => {
        if (!url) return;
        dispatch(uiActions.offerPack({ url, key }));
        // Away from the link at once, so that a reload does not ask a second time.
        void navigate("/", { replace: true });
    }, [url, key, dispatch, navigate]);

    return url ? null : <LegacyLink />;
};
