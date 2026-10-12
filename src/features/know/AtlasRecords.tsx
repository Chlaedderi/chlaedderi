/**
 * Records worked out from whatever is loaded right now.
 *
 * Explicitly «from this atlas»: the numbers describe the packs on this device, not climbing at
 * large, and the line under them says so. With a different pack loaded they change.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useLang } from "@app/useAppData";
import { GRADES } from "@core/grades";
import { fold, i18 } from "@core/text";
import type { Crag } from "@domain/model";
import { formatInt } from "@i18n/index";

interface Record {
    /** The crag this record is about, so the reader can open it. */
    cragId?: string;
    readonly label: string;
    readonly value: string;
    readonly where: string;
}

export const AtlasRecords = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const { crags, regions } = useData();
    const navigate = useNavigate();

    const records = useMemo<Record[]>(() => {
        if (!crags.length) return [];
        const out: Record[] = [];

        const best = <T,>(list: readonly T[], by: (x: T) => number | null): T | null =>
            list.reduce<T | null>((top, x) => {
                const v = by(x);
                if (v == null) return top;
                return top == null || v > (by(top) ?? -Infinity) ? x : top;
            }, null);

        const most = best(crags, (c: Crag) => c.nRoutes ?? c.routes.length);
        if (most) {
            out.push({
                label: t("rec.most"),
                value: formatInt(most.nRoutes ?? most.routes.length, lang),
                where: most.name,
                cragId: most.id,
            });
        }

        const routes = crags.flatMap((c) => c.routes.map((r) => ({ r, c })));
        const hardest = best(routes, (x) => x.r.gradeIdx);
        if (hardest?.r.grade) {
            out.push({
                label: t("rec.hard"),
                value: hardest.r.grade,
                where: `${hardest.r.name}, ${hardest.c.name}`,
                cragId: hardest.c.id,
            });
        }

        const furthest = best(crags, (c) => c.walkEff);
        if (furthest?.walkEff != null) {
            out.push({
                label: t("rec.walk"),
                value: t("min", { 0: furthest.walkEff }),
                where: furthest.name,
                cragId: furthest.id,
            });
        }

        // «Best-rated crag» asks for ten rated routes, as the text says: fewer is noise.
        const rated = best(
            crags.filter((c) => (c.rate?.n ?? 0) >= 10),
            (c) => c.rate?.avg ?? null,
        );
        if (rated?.rate?.avg != null) {
            out.push({
                label: t("rec.best"),
                value: rated.rate.avg.toFixed(1),
                where: rated.name,
                cragId: rated.id,
            });
        }

        // The grade the atlas has most of.
        const byGrade = new Map<string, number>();
        for (const { r } of routes) {
            if (r.grade) byGrade.set(r.grade, (byGrade.get(r.grade) ?? 0) + 1);
        }
        const top = [...byGrade].sort((a, b) => b[1] - a[1])[0];
        if (top) {
            out.push({
                label: t("rec.grade"),
                value: top[0],
                where: t("rec.n", { 0: formatInt(top[1], lang) }),
            });
        }

        // The hardest route of a single region, where that region falls short of the overall
        // hardest -- otherwise the line would repeat what «hardest» already said.
        const overall = hardest?.r.gradeIdx ?? null;
        for (const region of regions) {
            const here = best(
                routes.filter((x) => x.c.packId === region.key),
                (x) => x.r.gradeIdx,
            );
            if (
                here?.r.grade &&
                here.r.gradeIdx != null &&
                overall != null &&
                here.r.gradeIdx < overall
            ) {
                out.push({
                    label: t("rec.hard.in", { 0: i18(region.name, lang) }),
                    value: here.r.grade,
                    where: `${here.r.name}, ${here.c.name}`,
                    cragId: here.c.id,
                });
            }
        }

        // The route most people have logged, and -- if it is a different one -- the most-logged
        // route that everybody gave five stars.
        const logged = routes
            .filter((x) => (x.r.stars?.[1] ?? 0) > 0)
            .sort((a, b) => (b.r.stars?.[1] ?? 0) - (a.r.stars?.[1] ?? 0));
        if (logged[0]) {
            out.push({
                label: t("rec.asc"),
                value: logged[0].r.name,
                where: `${logged[0].c.name} · ${t("rec.asc.v", { 0: formatInt(logged[0].r.stars![1], lang) })}`,
                cragId: logged[0].c.id,
            });
        }
        const fiveStar = logged.find((x) => x.r.stars?.[0] === 5);
        if (fiveStar && fiveStar !== logged[0]) {
            out.push({
                label: t("rec.star"),
                value: fiveStar.r.name,
                where: `${fiveStar.c.name} · ${t("rec.asc.v", { 0: formatInt(fiveStar.r.stars![1], lang) })}`,
                cragId: fiveStar.c.id,
            });
        }

        // How much of the atlas is within reach of a moderate leader.
        const graded = routes.filter((x) => x.r.gradeIdx != null);
        const easyTo = GRADES.indexOf("6a+");
        if (graded.length) {
            const easy = graded.filter((x) => (x.r.gradeIdx ?? 0) <= easyTo).length;
            out.push({
                label: t("rec.easy"),
                value: t("rec.pct", {
                    0: Math.round((easy / graded.length) * 100),
                    1: formatInt(easy, lang),
                    2: formatInt(graded.length, lang),
                }),
                where: "",
            });
        }

        const longest = best(routes, (x) => x.r.name.length);
        if (longest) {
            out.push({
                label: t("rec.name"),
                value: longest.r.name,
                where: longest.c.name,
                cragId: longest.c.id,
            });
        }

        // The name most often reused. Placeholders are skipped: a hundred «no name» routes is not
        // a record, which is why the original filtered them out by name.
        // The placeholders the packs use, in Italian.
        const PLACEHOLDER = /^(senza nome|sn|s\.n\.|n\.n\.|\?+|progetto|project|variante)\b/; // spellchecker:disable-line
        const byName = new Map<string, { r: (typeof routes)[number]["r"]; n: number }>();
        for (const x of routes) {
            const key = fold(x.r.name).trim();
            if (key.length <= 2 || PLACEHOLDER.test(key)) continue;
            const seen = byName.get(key);
            if (seen) seen.n += 1;
            else byName.set(key, { r: x.r, n: 1 });
        }
        const dup = [...byName.values()].sort((a, b) => b.n - a.n)[0];
        if (dup && dup.n > 2) {
            out.push({
                label: t("rec.dup"),
                value: `«${dup.r.name}»`,
                where: t("rec.times", { 0: dup.n }),
            });
        }

        // How long the atlas would last at one route a day.
        out.push({
            label: t("rec.year"),
            value: t("rec.year.v", {
                0: (routes.length / 365).toFixed(1).replace(".", lang === "de" ? "," : "."),
            }),
            where: "",
        });

        return out;
    }, [crags, regions, t, lang]);

    if (!records.length) return null;

    const routes = crags.reduce((n, c) => n + c.routes.length, 0);

    return (
        <Box>
            {records.map((record) => (
                <Box
                    key={record.label}
                    sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "baseline",
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: "divider",
                    }}
                >
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                        {record.label}
                        <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block" }}
                        >
                            {record.where}
                        </Typography>
                    </Typography>
                    <Typography variant="body2" className="num" sx={{ fontWeight: 600 }}>
                        {record.value}
                    </Typography>
                    {record.cragId && (
                        <Button
                            size="small"
                            aria-label={t("kn.go")}
                            onClick={() => void navigate(`/crag/${record.cragId}`)}
                        >
                            {t("kn.go")}
                        </Button>
                    )}
                </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {t("kn.rec.hint", { 0: formatInt(crags.length, lang), 1: formatInt(routes, lang) })}
            </Typography>
        </Box>
    );
};
