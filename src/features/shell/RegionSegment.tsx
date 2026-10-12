/**
 * The region switch: one button per loaded mappack, and «+» to load another.
 *
 * Always shown, also with a single region -- the «+» is the main way into the pack dialog, and the
 * original kept it there for exactly that reason. (My first pass hid the whole thing whenever only
 * one pack was loaded, which is the state a fresh install is in, so the way to load a region was
 * invisible precisely when it was needed.)
 */

import { useTranslation } from "react-i18next";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { useLang } from "@app/useAppData";
import { i18 } from "@core/text";

export const RegionSegment = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const { regions } = useData();
    const current = useAppSelector((s) => s.prefs.region);

    return (
        <div className="seg" role="group" aria-label={t("region.label")}>
            {regions.map((region) => (
                <button
                    key={region.key}
                    type="button"
                    aria-pressed={region.key === current}
                    onClick={() => {
                        if (region.key === current) return;
                        dispatch(prefsActions.setRegion(region.key));
                        dispatch(uiActions.select(null));
                    }}
                >
                    {i18(region.name, lang)}
                </button>
            ))}
            <button
                type="button"
                className="add"
                title={t("pk.add")}
                aria-label={t("pk.add")}
                onClick={() => dispatch(uiActions.setPacksOpen(true))}
            >
                +
            </button>
        </div>
    );
};
