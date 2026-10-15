/**
 * The pages behind «About»: what the atlas is, where the data comes from, and its limits.
 *
 * The licence notes matter legally -- some of the coordinates are CC BY-NC-SA, which is why the
 * app is meant for private use -- and the disclaimer matters practically: this is not a guidebook,
 * and closures and bolt condition have to be checked at the wall.
 *
 * A pack brings its own licence note, which is shown under the app's own rather than merged into
 * it: the pack speaks for its data, the app does not.
 */

import CloseIcon from "@mui/icons-material/Close";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useData } from "@app/dataContext";
import { useLang } from "@app/useAppData";
import { i18 } from "@core/text";
import { formatInt } from "@i18n/index";

export type InfoTopic = "about" | "licence" | "contribute";

export const InfoSheet = ({
    topic,
    onClose,
}: {
    readonly topic: InfoTopic | null;
    readonly onClose: () => void;
}) => {
    const { t } = useTranslation();
    const lang = useLang();
    const { crags, regions, parks } = useData();

    const routes = crags.reduce((n, c) => n + c.routes.length, 0);
    const title =
        topic === "licence"
            ? t("m.licences")
            : topic === "contribute"
              ? t("m.contrib")
              : t("m.about");

    return (
        <Dialog open={topic !== null} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
            <Toolbar sx={{ gap: 1 }}>
                <Typography variant="h3" sx={{ flex: 1 }}>
                    {title}
                </Typography>
                <IconButton onClick={onClose} aria-label={t("close")}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>

            <DialogContent dividers>
                {topic === "about" && (
                    <>
                        <Typography variant="body2" gutterBottom>
                            {t("m.about.t", {
                                0: formatInt(crags.length, lang),
                                1: formatInt(routes, lang),
                                2: Object.keys(parks).length,
                            })}
                        </Typography>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block" }}
                        >
                            {t("disclaimer")}
                        </Typography>
                    </>
                )}

                {topic === "licence" && (
                    <>
                        <Typography variant="body2" gutterBottom>
                            {t("m.lic")}
                        </Typography>
                        {regions
                            .filter((r) => r.text.licence)
                            .map((r) => (
                                <Typography
                                    key={r.key}
                                    variant="body2"
                                    color="text.secondary"
                                    gutterBottom
                                >
                                    <b>{i18(r.name, lang)}:</b> {i18(r.text.licence, lang)}
                                </Typography>
                            ))}
                    </>
                )}

                {topic === "contribute" && (
                    <Typography variant="body2">
                        {t("m.contrib")}{" "}
                        <Link href="https://github.com/Chlaedderi" target="_blank" rel="noopener">
                            github.com/Chlaedderi
                        </Link>
                    </Typography>
                )}
            </DialogContent>
        </Dialog>
    );
};
