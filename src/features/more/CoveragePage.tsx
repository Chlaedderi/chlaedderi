/**
 * «What is covered»: how much of the region the loaded pack actually holds.
 *
 * A port of `covHTML`. It exists to be honest about the gaps -- which crags have no route list,
 * which are not on the map -- rather than letting a climber assume the atlas is complete.
 */

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useLang, useRegion, useRegionCrags } from "@app/useAppData";
import { i18 } from "@core/text";
import type { Crag } from "@domain/model";
import { formatInt } from "@i18n/index";

const Stat = ({ value, label }: { value: number; label: string }) => {
    const lang = useLang();
    return (
        <Card sx={{ flex: "1 1 96px", minWidth: 96 }}>
            <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                <Typography variant="h3" className="num">
                    {formatInt(value, lang)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {label}
                </Typography>
            </CardContent>
        </Card>
    );
};

export const CoveragePage = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const region = useRegion();
    const crags = useRegionCrags();

    const figures = useMemo(() => {
        const routes = crags.reduce((n, c) => n + c.routes.length, 0);
        const withList = crags.filter((c) => c.routes.length);
        const onMap = crags.filter((c) => c.coord);
        const noList = crags.filter((c) => !c.routes.length);
        const byArea = (list: readonly Crag[]): [string, Crag[]][] =>
            (region?.areas ?? [])
                .map((a) => [a.name, list.filter((c) => c.area === a.name)] as [string, Crag[]])
                .filter(([, group]) => group.length);
        return { routes, withList, onMap, noList, byArea };
    }, [crags, region]);

    if (!region) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">{t("pk.empty")}</Typography>
            </Box>
        );
    }

    const names = (list: readonly Crag[]): string =>
        list
            .map((c) => (c.nRoutes ? `${c.name} (${formatInt(c.nRoutes, lang)})` : c.name))
            .join(", ");

    return (
        <Box sx={{ height: "100%", overflowY: "auto", p: 2, pb: 4 }}>
            <Typography variant="h2" gutterBottom>
                {t("cov.title", { 0: i18(region.fullName ?? region.name, lang) })}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                {t("cov.intro")}
            </Typography>

            <Stack direction="row" spacing={1} useFlexGap sx={{ my: 2, flexWrap: "wrap" }}>
                <Stat value={crags.length} label={t("cov.crags")} />
                <Stat value={figures.routes} label={t("cov.routes")} />
                <Stat value={figures.withList.length} label={t("cov.lists")} />
                <Stat value={figures.onMap.length} label={t("cov.map")} />
            </Stack>

            <Typography variant="body2" gutterBottom>
                <b>{t("cov.areas")}:</b>{" "}
                {region.areas
                    .map((a) => `${a.name} (${crags.filter((c) => c.area === a.name).length})`)
                    .join(", ")}
                .
            </Typography>

            <Typography variant="h4" sx={{ mt: 2 }} gutterBottom>
                {t("cov.nolist", { 0: figures.noList.length })}
            </Typography>
            {figures.noList.length ? (
                <>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {t("cov.nolist.h")}
                    </Typography>
                    <Box component="ul" sx={{ pl: 3, m: 0 }}>
                        {figures.byArea(figures.noList).map(([area, list]) => (
                            <li key={area}>
                                <Typography variant="body2" component="span">
                                    <b>{area}:</b> {names(list)}
                                </Typography>
                            </li>
                        ))}
                    </Box>
                </>
            ) : (
                <Typography variant="body2" color="text.secondary">
                    {t("cov.nolist.none")}
                </Typography>
            )}

            <Typography variant="h4" sx={{ mt: 2 }} gutterBottom>
                {t("cov.good")}
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
                {[
                    t("cov.order"),
                    t("cov.nomap", { 0: crags.length - figures.onMap.length }),
                    t("cov.ap"),
                    t("cov.topo"),
                ].map((line) => (
                    <li key={line}>
                        <Typography variant="body2">{line}</Typography>
                    </li>
                ))}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                {t("disclaimer")}
            </Typography>
        </Box>
    );
};
