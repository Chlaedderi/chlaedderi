/**
 * The pictures and topos a pack points at.
 *
 * The images are **not** copied into the pack: each is loaded from the page it belongs to, and the
 * caption names that source and its licence. So a picture can fail to load, and the frame says
 * where to go instead rather than showing a broken image.
 *
 * `referrerPolicy="no-referrer"` keeps the viewer's path out of the source's logs; `loading="lazy"`
 * means opening a crag does not fetch a dozen photographs over a mobile connection.
 */

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LaunchIcon from "@mui/icons-material/Launch";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useData } from "@app/dataContext";
import { useLang, useRegionOf } from "@app/useAppData";
import { httpHref, i18 } from "@core/text";
import type { Pic } from "@domain/mappack";
import type { Crag } from "@domain/model";

/** `0` means «none» in the slots that allow it. */
const text = (v: string | 0 | undefined): string | null => (typeof v === "string" && v ? v : null);

const Figure = ({
    pic,
    cragName,
    source,
}: {
    pic: Pic;
    cragName: string;
    source: string | null;
}) => {
    const { t } = useTranslation();
    const [failed, setFailed] = useState(false);
    const caption = text(pic[6]);
    const author = text(pic[7]);
    const licence = text(pic[8]);
    const kind = t(`k.${pic[4]}`);

    return (
        <Box component="figure" sx={{ m: 0, minWidth: 260, maxWidth: 320, flex: "0 0 auto" }}>
            <Box
                sx={{
                    position: "relative",
                    aspectRatio: "4 / 3",
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "surface.panel",
                    border: 1,
                    borderColor: "divider",
                    display: "grid",
                    placeItems: "center",
                }}
            >
                <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ position: "absolute", top: 4, left: 4, zIndex: 1 }}
                >
                    <Chip size="small" label={kind} />
                    {pic[5] ? <Chip size="small" label={t("pic.whole")} /> : null}
                    {pic[9] === "people" ? (
                        <Chip size="small" label={t("pic.people")} />
                    ) : pic[9] === "plain" ? (
                        <Chip size="small" label={t("pic.plain")} />
                    ) : null}
                </Stack>

                {failed ? (
                    <Stack sx={{ p: 2, textAlign: "center", gap: 0.5 }}>
                        <Typography variant="body2">
                            <b>{t("pic.fail")}</b>
                        </Typography>
                        <Typography variant="body2">{t("pic.stays")}</Typography>
                        <Link href={httpHref(pic[0])} target="_blank" rel="noopener noreferrer">
                            {t("pic.open")}
                        </Link>
                    </Stack>
                ) : (
                    <Box
                        component="img"
                        src={pic[0]}
                        alt={caption ?? `${kind}: ${cragName}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() => setFailed(true)}
                        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                )}
            </Box>

            <Typography
                component="figcaption"
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5 }}
            >
                {caption && <q>{caption}</q>} {pic[5] ? t("pic.wholeTxt") : ""}
                {!author && !licence ? ` · ${t("pic.author")}` : ""}
                {source && (
                    <Link
                        href={httpHref(pic[2])}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: "inline-flex", alignItems: "center", gap: 0.3 }}
                    >
                        <LaunchIcon sx={{ fontSize: 11 }} />
                        {source}
                    </Link>
                )}
                {author && ` · ${author}`}
                {licence && ` · ${licence}`}
            </Typography>
        </Box>
    );
};

export const Gallery = ({ crag }: { crag: Crag }) => {
    const { t } = useTranslation();
    const lang = useLang();
    const { picSrc } = useData();
    const region = useRegionOf(crag);
    const strip = useRef<HTMLDivElement>(null);

    if (!crag.pics.length) {
        // A pack that carries no pictures at all says so in its own words.
        const own = region?.text.noPics;
        return (
            <Typography variant="body2" color="text.secondary">
                {own ? i18(own, lang) : t("pics.none")}
            </Typography>
        );
    }

    const scroll = (by: number): void => strip.current?.scrollBy({ left: by, behavior: "smooth" });

    return (
        <Box>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    {t("pics", { 0: crag.pics.length })}
                </Typography>
                <Typography variant="caption" color="text.secondary" className="num">
                    {t("pic.alt", { 0: 1, 1: crag.pics.length })}
                </Typography>
                <IconButton size="small" aria-label={t("pic.prev")} onClick={() => scroll(-300)}>
                    <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label={t("pic.next")} onClick={() => scroll(300)}>
                    <ChevronRightIcon fontSize="small" />
                </IconButton>
            </Stack>

            <Box
                ref={strip}
                role="group"
                aria-label={t("pic.aria", { 0: crag.name, 1: crag.pics.length })}
                sx={{ display: "flex", gap: 1.5, overflowX: "auto", pb: 1 }}
            >
                {crag.pics.map((pic, i) => (
                    <Figure
                        key={`${pic[0]}-${i}`}
                        pic={pic}
                        cragName={crag.name}
                        source={picSrc[pic[3]] ?? null}
                    />
                ))}
            </Box>
        </Box>
    );
};
