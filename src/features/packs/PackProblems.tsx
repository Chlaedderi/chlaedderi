/**
 * What is wrong with a pack, as both the packs dialog and the offer show it.
 *
 * A problem the app raised itself carries a `code` and is said in the viewer's own language --
 * those are the ones a viewer can act on: a wrong address, no connection, a host that forbids
 * access. Ajv's findings have no code and stay English; they are addressed to whoever is making
 * the pack, and they name a JSON pointer that would be no clearer translated.
 */

import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import type { PackProblem } from "@core/packs/validate";

export const PackProblems = ({ problems }: { problems: readonly PackProblem[] }) => {
    const { t } = useTranslation();
    return (
        <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>{t("pk.bad")}</AlertTitle>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {problems.map((p, i) => (
                    <li key={i}>
                        {p.where && (
                            <Typography component="code" variant="body2" sx={{ mr: 0.5 }}>
                                {p.where}
                            </Typography>
                        )}
                        {p.code ? t(`pk.err.${p.code}`, { 0: p.detail ?? "" }) : p.message}
                    </li>
                ))}
            </Box>
        </Alert>
    );
};
