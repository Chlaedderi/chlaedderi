/**
 * The chips under a crag's name: what is worth knowing before tapping it.
 *
 * A port of `tagsHTML`. The order is the original's, which is an order of importance: what you
 * have climbed, then what the weather lets you do, then how it is bolted, then the warnings, then
 * whether it is even on the map.
 */

import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";

import { useLogIndex } from "@app/useAppData";
import { isSend } from "@core/logbook";
import type { Crag } from "@domain/model";

type Tone = "success" | "warning" | "error" | "info" | undefined;

export const CragTags = ({
    crag,
    full = false,
    routeHit = false,
}: {
    readonly crag: Crag;
    /** The crag page shows a couple of tags the card leaves out. */
    readonly full?: boolean;
    /** The search text matched a route name rather than the crag's own names. */
    readonly routeHit?: boolean;
}) => {
    const { t } = useTranslation();
    const log = useLogIndex();
    const sent = (log.byCrag[crag.id] ?? []).filter(isSend).length;

    const tags: { key: string; label: string; tone?: Tone }[] = [];

    if (sent)
        tags.push({ key: "logged", label: `✓ ${t("tag.logged", { 0: sent })}`, tone: "success" });
    if (crag.rain === "yes") tags.push({ key: "rain", label: t("tag.rain"), tone: "success" });
    if (crag.dry === "fast") tags.push({ key: "dry", label: t("tag.dry"), tone: "warning" });
    if (crag.boltSp) tags.push({ key: "bolt", label: t(`tag.bolt.${crag.boltSp}`) });
    if (crag.closure) tags.push({ key: "closure", label: t("tag.closure"), tone: "error" });
    if (crag.caution) tags.push({ key: "caution", label: t("tag.caution"), tone: "warning" });
    if (full && crag.noFamily) tags.push({ key: "nofamily", label: t("tag.nofamily") });
    if (!crag.coord) tags.push({ key: "nomap", label: t("tag.nomap") });
    else if (crag.anchor) tags.push({ key: "anchor", label: t("tag.anchor") });
    else if (crag.coord.precision === "approx")
        tags.push({ key: "approx", label: t("tag.approx") });
    if (crag.topoPic || crag.topoLink)
        tags.push({ key: "topo", label: t("tag.topo"), tone: "info" });
    if (crag.rhay && crag.routes.some((r) => r.length != null)) {
        tags.push({ key: "lens", label: t("tag.lens") });
    }
    if (routeHit) tags.push({ key: "rhit", label: t("tag.rhit"), tone: "info" });

    if (!tags.length) return null;

    return (
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ mt: 0.75, flexWrap: "wrap" }}>
            {tags.map((tag) => (
                <Chip
                    key={tag.key}
                    label={tag.label}
                    size="small"
                    color={tag.tone}
                    variant={tag.tone ? "filled" : "outlined"}
                    sx={{ height: 20, fontSize: "0.72rem" }}
                />
            ))}
        </Stack>
    );
};
