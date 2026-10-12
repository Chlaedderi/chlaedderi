/**
 * What you have climbed at this crag.
 *
 * On the crag page rather than only on the logbook page, because that is where the question comes
 * up -- standing in front of the wall, wondering what is left. The «route not in the list» button
 * is here too: many crags have no route list at all, and an ascent there should still be
 * recordable.
 */

import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useLang, useLogIndex } from "@app/useAppData";
import { type LogEntry, byDate, isSend } from "@core/logbook";
import type { Crag } from "@domain/model";
import { formatDate } from "@i18n/index";

import { SectionTitle } from "./SectionTitle";

export const CragLogbook = ({
    crag,
    onEdit,
    onAddCustom,
}: {
    readonly crag: Crag;
    readonly onEdit: (entry: LogEntry) => void;
    readonly onAddCustom: () => void;
}) => {
    const { t } = useTranslation();
    const lang = useLang();
    const log = useLogIndex();
    const entries = [...(log.byCrag[crag.id] ?? [])].sort(byDate).reverse();

    return (
        <Box>
            <SectionTitle section="cragLog">{t("lb.here", { 0: entries.length })}</SectionTitle>

            {entries.length === 0 ? (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {t(crag.routes.length ? "lb.here.none" : "lb.here.nolist")}
                </Typography>
            ) : (
                entries.map((entry) => (
                    <Box
                        key={entry.id}
                        component="button"
                        type="button"
                        onClick={() => onEdit(entry)}
                        sx={{
                            display: "flex",
                            width: "100%",
                            gap: 1,
                            alignItems: "baseline",
                            py: 0.75,
                            px: 0,
                            border: 0,
                            borderBottom: 1,
                            borderColor: "divider",
                            background: "none",
                            color: "inherit",
                            font: "inherit",
                            textAlign: "left",
                            cursor: "pointer",
                        }}
                    >
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            className="num"
                            sx={{ width: 84 }}
                        >
                            {formatDate(entry.d, lang)}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ flex: 1, minWidth: 0 }}
                            className="kat-ellipsis"
                        >
                            {entry.n}
                        </Typography>
                        <Chip
                            size="small"
                            label={t(`st.${entry.st}`)}
                            color={isSend(entry) ? "success" : "warning"}
                            sx={{ height: 20, fontSize: "0.72rem" }}
                        />
                        <Typography
                            variant="body2"
                            className="num"
                            sx={{ fontWeight: 600, width: 42, textAlign: "right" }}
                        >
                            {entry.g}
                        </Typography>
                    </Box>
                ))
            )}

            <Stack direction="row" sx={{ mt: 1 }}>
                <Button size="small" startIcon={<AddIcon />} onClick={onAddCustom}>
                    {t("lb.custom")}
                </Button>
            </Stack>
        </Box>
    );
};
