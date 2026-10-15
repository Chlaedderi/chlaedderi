import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useLang, useRegion } from "@app/useAppData";
import { httpHref, i18 } from "@core/text";
import conv from "@data/conv.json";

import { PackInline } from "../packs/PackText";

import { AtlasRecords } from "./AtlasRecords";

interface ConvData {
    rows: ConvRow[];
    /** Bouldering, as `[Fontainebleau, V scale]` pairs. */
    boulder: string[][];
}

interface ConvRow {
    fr: string;
    uiaa: string[];
    yds: string[];
    uk: string[];
    aus: string[];
    sax: string[];
    fin: string[];
}

const SCALES = ["fr", "uiaa", "yds", "uk", "aus", "sax", "fin"] as const;
type Scale = (typeof SCALES)[number];

const cell = (row: ConvRow, scale: Scale): string =>
    scale === "fr" ? row.fr : (row[scale] ?? []).join(" / ") || "–";

/**
 * «Worth knowing»: the grade converter, which belongs to the app, and the facts and glossary,
 * which belong to whichever pack is loaded -- the app knows none of them.
 */
export const KnowPage = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const region = useRegion();
    const { rows, boulder } = conv as ConvData;
    const [whole, setWhole] = useState(false);
    const [from, setFrom] = useState<Scale>("fr");
    const [to, setTo] = useState<Scale>("uiaa");

    const facts = region?.text.facts;
    const glossary = region?.text.glossary;

    return (
        <Box sx={{ height: "100%", overflowY: "auto", p: 2, pb: 4 }}>
            <Typography variant="h2" gutterBottom>
                {t("kn.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                {t("kn.intro")}
            </Typography>

            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h4">{t("kn.conv")}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <TextField
                            select
                            size="small"
                            label={t("kn.conv.from")}
                            value={from}
                            onChange={(e) => setFrom(e.target.value as Scale)}
                            sx={{ minWidth: 110 }}
                        >
                            {SCALES.map((s) => (
                                <MenuItem key={s} value={s}>
                                    {t(`cv.${s}`)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            size="small"
                            label={t("kn.conv.to")}
                            value={to}
                            onChange={(e) => setTo(e.target.value as Scale)}
                            sx={{ minWidth: 110 }}
                        >
                            {SCALES.map((s) => (
                                <MenuItem key={s} value={s}>
                                    {t(`cv.${s}`)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={whole}
                                    onChange={(e) => setWhole(e.target.checked)}
                                />
                            }
                            label={t("kn.conv.table")}
                        />
                    </Stack>
                    <TableContainer sx={{ maxHeight: 420 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    {/* Keyed by position: «from» and «to» may be the same scale. */}
                                    {(whole ? SCALES : [from, to]).map((s, i) => (
                                        <TableCell key={`${i}-${s}`}>{t(`cv.${s}`)}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.fr} hover>
                                        {(whole ? SCALES : [from, to]).map((s, i) => (
                                            <TableCell key={`${i}-${s}`} className="num">
                                                {cell(row, s)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 1 }}
                    >
                        {t("kn.conv.hint")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {t("kn.conv.plus")}
                    </Typography>

                    <Typography variant="h4" sx={{ mt: 2 }} gutterBottom>
                        {t("kn.conv.boulder")}
                    </Typography>
                    <TableContainer sx={{ maxHeight: 320 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t("kn.conv.grade")}</TableCell>
                                    <TableCell>{t("kn.vscale")}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {boulder.map((pair) => (
                                    <TableRow key={pair[0]} hover>
                                        <TableCell className="num">{pair[0]}</TableCell>
                                        <TableCell className="num">{pair[1]}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </AccordionDetails>
            </Accordion>

            <Accordion slotProps={{ transition: { unmountOnExit: true } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h4">{t("kn.rec")}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <AtlasRecords />
                </AccordionDetails>
            </Accordion>

            {facts?.items?.length ? (
                <Accordion slotProps={{ transition: { unmountOnExit: true } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h4">{t("kn.facts")}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {facts.items.map((fact, i) => (
                            <Box key={i} sx={{ mb: 1.5 }}>
                                <Typography variant="body2">
                                    {lang === "de" ? fact.de : fact.en}
                                </Typography>
                                {fact.src && (
                                    <Typography variant="caption" color="text.secondary">
                                        {fact.url ? (
                                            <Link
                                                href={httpHref(fact.url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {fact.src}
                                            </Link>
                                        ) : (
                                            fact.src
                                        )}
                                    </Typography>
                                )}
                            </Box>
                        ))}
                    </AccordionDetails>
                </Accordion>
            ) : null}

            {glossary?.items?.length ? (
                <Accordion slotProps={{ transition: { unmountOnExit: true } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h4">
                            {glossary.title ? i18(glossary.title, lang) : t("kn.gloss")}
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {glossary.hint && (
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                <PackInline text={glossary.hint} />
                            </Typography>
                        )}
                        {glossary.items.map((item) => (
                            <Box
                                key={item.term}
                                sx={{
                                    display: "flex",
                                    gap: 1,
                                    py: 0.5,
                                    borderBottom: 1,
                                    borderColor: "divider",
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600, minWidth: 120 }}
                                    lang={glossary.lang}
                                >
                                    {item.term}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {lang === "de" ? item.de : item.en}
                                </Typography>
                            </Box>
                        ))}
                    </AccordionDetails>
                </Accordion>
            ) : null}
        </Box>
    );
};
