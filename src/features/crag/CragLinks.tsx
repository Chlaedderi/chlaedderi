/**
 * Where to find a topo or a description for this crag.
 *
 * A port of `linksHTML` (index.html:4603). The port rendered only `links.w`, the free-text list,
 * and silently dropped every keyed link a pack carries -- which is most of them.
 *
 * **What a link is called is the pack's business, not the app's.** A region names its own sources
 * in `text.links`, keyed the same way as `sector.links`; the app falls back to a neutral «Topo or
 * description» where a pack says nothing. That is why there is no table of source names here.
 */

import LaunchIcon from "@mui/icons-material/Launch";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useLang, useRegionOf } from "@app/useAppData";
import { i18 } from "@core/text";
import type { Crag } from "@domain/model";

/** The keyed links, in the order the original listed them. */
const ORDER = ["o", "f", "t", "l", "p", "r", "g", "c"] as const;

const Row = ({ url, label, note }: { url: string; label: string; note?: string | undefined }) => (
    <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: "flex", alignItems: "baseline", gap: 1 }}
    >
        <LaunchIcon sx={{ fontSize: 13 }} />
        <b>{label}</b>
        {note && (
            <Typography component="span" variant="caption" color="text.secondary">
                {note}
            </Typography>
        )}
    </Link>
);

export const CragLinks = ({ crag }: { crag: Crag }) => {
    const { t } = useTranslation();
    const lang = useLang();
    const region = useRegionOf(crag);

    const vocabulary = region?.text.links ?? {};
    const links = crag.links ?? {};
    const area = region?.areas.find((a) => a.name === crag.area);

    const named = (key: string): { label: string; note?: string } => {
        const v = vocabulary[key];
        return {
            label: v?.label ? i18(v.label, lang) : t("tl.link"),
            ...(v?.note ? { note: i18(v.note, lang) } : {}),
        };
    };

    const rows: { url: string; label: string; note?: string }[] = [];
    for (const key of ORDER) {
        const url = links[key];
        if (typeof url === "string" && url) rows.push({ url, ...named(key) });
    }
    if (area?.tcUrl) rows.push({ url: area.tcUrl, ...named("tc") });
    for (const w of links.w ?? []) {
        // A free-text link keeps its own name, trimmed as the original trimmed it.
        rows.push({
            url: w.url,
            label: t("tl.w"),
            note: w.name.length > 60 ? `${w.name.slice(0, 58)}…` : w.name,
        });
    }

    if (!rows.length) return null;

    // The guide reference the pack words itself, with the crag's own page or number filled in.
    const guideRef = region?.text.guideRef;
    const reference =
        crag.guide && guideRef
            ? i18(guideRef, lang).replace(
                  "{0}",
                  lang === "de" ? crag.guide : crag.guide.replace("Nr.", "No.").replace("S.", "p."),
              )
            : null;

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
                {t("tl.more")}
            </Typography>
            <Stack spacing={0.5}>
                {rows.map((row) => (
                    <Row key={row.url} url={row.url} label={row.label} note={row.note} />
                ))}
            </Stack>
            {reference && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                >
                    <b>{reference}</b>
                </Typography>
            )}
        </Box>
    );
};
