import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { favouritesActions } from "@app/slices/favouritesSlice";
import { logbookActions } from "@app/slices/logbookSlice";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { mergeTransfer, readTransfer } from "@core/transfer";

/**
 * `#/transfer?c=FA2.…` — arriving with your favourites, logbook and settings in the address.
 *
 * The app moved house, and browser storage belongs to the host: at the new address everybody
 * starts empty. The page left behind at the old one reads what is there, encodes it, and sends
 * the viewer here with it. The code sits in the fragment, so it is never sent to a server --
 * not to GitHub's, not to anybody's.
 *
 * Nothing is replaced: `mergeTransfer` adds what the code brought to what this browser already
 * has. Someone who opens an old code twice, or on a device that has been used since, loses
 * nothing by it.
 */
export const TransferLink = () => {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const favourites = useAppSelector((s) => s.favourites);
    const log = useAppSelector((s) => s.logbook.entries);
    const prefs = useAppSelector((s) => s.prefs);

    const code = params.get("c");
    // The state is read for the merge, not watched: re-running on our own dispatch would import
    // the same code again, and again.
    const now = useRef({ favourites, log, prefs });
    now.current = { favourites, log, prefs };
    const done = useRef(false);

    useEffect(() => {
        if (done.current) return;
        done.current = true;

        const home = (): void => void navigate("/", { replace: true });
        if (!code) {
            home();
            return;
        }

        const incoming = readTransfer(code);
        if (!incoming) {
            dispatch(uiActions.toast({ message: t("fv.import.bad"), severity: "error" }));
            home();
            return;
        }

        const state = now.current;
        const merged = mergeTransfer(incoming, {
            crags: state.favourites.crags,
            routes: state.favourites.routes,
            log: state.log,
            prefs: state.prefs,
        });

        dispatch(favouritesActions.restore({ crags: merged.crags, routes: merged.routes }));
        if (merged.gained.entries) dispatch(logbookActions.restore([...merged.log]));
        if (merged.prefs) dispatch(prefsActions.restore(merged.prefs));

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
        home();
    }, [code, dispatch, navigate, t]);

    return null;
};
