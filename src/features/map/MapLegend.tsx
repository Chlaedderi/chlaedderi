/**
 * What the shapes on the map mean. A port of `renderLegend`.
 *
 * It uses the very same marker classes as the map itself, so a sample can never drift from the
 * thing it explains.
 *
 * It starts folded away, on every screen. Unfolded it covers the bottom-left corner of the map,
 * which is as often as not where the way to the car park runs -- and it is reference, read once
 * and then not again. Whether it is open is remembered, so anyone who wants it open keeps it.
 */

import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";

const Row = ({ sample, label }: { sample: React.ReactNode; label: string }) => (
    <span className="li">
        {sample}
        {label}
    </span>
);

export const MapLegend = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const showWeather = useAppSelector((s) => s.prefs.wx);
    const open = useAppSelector((s) => s.prefs.legend);

    return (
        <details
            className="legend"
            open={open}
            onToggle={(e) =>
                dispatch(prefsActions.setFlag({ key: "legend", value: e.currentTarget.open }))
            }
        >
            <summary>
                <b>{t("lg.title")}</b>
            </summary>
            <b>{t("lg.by")}</b>
            <Row sample={<span className="mk easy" />} label={t("lg.easy")} />
            <Row sample={<span className="mk mid" />} label={t("lg.mid")} />
            <Row sample={<span className="mk hard" />} label={t("lg.hard")} />
            <Row sample={<span className="mk" />} label={t("lg.unk")} />
            <Row sample={<span className="mk approx" />} label={t("lg.approx")} />
            <Row sample={<span className="mk anchor" />} label={t("lg.anchor")} />
            <Row sample={<span className="mk closure" />} label={t("lg.closure")} />
            <Row sample={<span className="mk fav" />} label={t("lg.fav")} />
            <Row sample={<span className="pk">P</span>} label={t("lg.park")} />
            <Row sample={<span className="pk est">P</span>} label={t("lg.parkEst")} />
            <Row sample={<span className="ln" />} label={t("lg.path")} />
            <Row sample={<span className="ln alt" />} label={t("lg.alt")} />
            <Row sample={<span className="ln air" />} label={t("lg.air")} />
            {showWeather &&
                (["rain", "wet", "soon"] as const).map((key) => (
                    <Row
                        key={key}
                        sample={
                            <span className="wxi">
                                <i className={`wx ${key}`} />
                            </span>
                        }
                        label={t(`lg.wx.${key}`)}
                    />
                ))}
        </details>
    );
};
