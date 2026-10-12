/**
 * The chip row under the app bar: the filters people actually reach for, one tap each.
 *
 * A port of the `quick` table. These are the same filter state the drawer edits, so a chip and the
 * drawer can never disagree -- toggling «★★★★+» here is exactly setting `star` to "4" there.
 *
 * The row scrolls sideways rather than wrapping: it must not push the map down.
 */

import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { filtersActions } from "@app/slices/filtersSlice";
import { GRADE_PRESETS } from "@core/filters";
import { gradeIdx } from "@core/grades";

interface Quick {
    readonly key: string;
    readonly label: string;
    readonly title?: string;
    readonly on: boolean;
    readonly toggle: () => void;
}

export const QuickChips = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const { one, gmin, gmax } = useAppSelector((s) => s.filters);

    const chips: Quick[] = [
        // The grade presets, as the original had them: 3–4, 5a–5c, 6a–6c, 7a–7c, 8a+
        ...GRADE_PRESETS.map(([from, to, label]) => {
            const a = gradeIdx(from)!;
            const b = gradeIdx(to)!;
            const on = gmin === a && gmax === b;
            return {
                key: `g:${label}`,
                label,
                on,
                toggle: () =>
                    dispatch(
                        on
                            ? filtersActions.resetGrades()
                            : filtersActions.setGrades({ gmin: a, gmax: b }),
                    ),
            };
        }),
        {
            key: "star",
            label: "★★★★ +",
            title: t("q.star.t"),
            on: one.star === "4",
            toggle: () =>
                dispatch(
                    filtersActions.setOne({ key: "star", value: one.star === "4" ? "any" : "4" }),
                ),
        },
        {
            key: "fav",
            label: t("q.fav"),
            on: one.fav === "crags",
            toggle: () =>
                dispatch(
                    filtersActions.setOne({
                        key: "fav",
                        value: one.fav === "crags" ? "any" : "crags",
                    }),
                ),
        },
        {
            key: "wx",
            label: t("q.wx"),
            title: t("q.wx.t"),
            on: one.wx === "dry",
            toggle: () =>
                dispatch(
                    filtersActions.setOne({ key: "wx", value: one.wx === "dry" ? "any" : "dry" }),
                ),
        },
        {
            key: "rain",
            label: t("q.rain"),
            on: one.rain === "yes",
            toggle: () =>
                dispatch(
                    filtersActions.setOne({
                        key: "rain",
                        value: one.rain === "yes" ? "any" : "yes",
                    }),
                ),
        },
        {
            key: "dry",
            label: t("q.dry"),
            title: t("q.dry.t"),
            on: one.dry === "fast",
            toggle: () =>
                dispatch(
                    filtersActions.setOne({
                        key: "dry",
                        value: one.dry === "fast" ? "any" : "fast",
                    }),
                ),
        },
        {
            key: "walk",
            label: t("q.walk10"),
            on: one.walk === "10",
            toggle: () =>
                dispatch(
                    filtersActions.setOne({ key: "walk", value: one.walk === "10" ? "any" : "10" }),
                ),
        },
        {
            key: "topo",
            label: t("q.topo"),
            on: one.pic === "topo" || one.pic === "link",
            toggle: () =>
                dispatch(
                    filtersActions.setOne({
                        key: "pic",
                        value: one.pic === "topo" || one.pic === "link" ? "any" : "link",
                    }),
                ),
        },
    ];

    return (
        <div className="chips quickchips" role="group" aria-label={t("filters")}>
            {chips.map((chip) => (
                <button
                    key={chip.key}
                    type="button"
                    className="chip"
                    aria-pressed={chip.on}
                    {...(chip.title ? { title: chip.title } : {})}
                    onClick={chip.toggle}
                >
                    {chip.label}
                </button>
            ))}
        </div>
    );
};
