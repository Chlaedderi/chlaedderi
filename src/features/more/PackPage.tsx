import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useLang, useRegion } from "@app/useAppData";
import { i18 } from "@core/text";

import { PackBlocks } from "../packs/PackText";

/**
 * A page of running text that came with a mappack: the region's research notes, its topo overview,
 * whatever else it brought. The app knows none of these -- it only renders what the pack carries.
 */
export const PackPage = () => {
    const { pageId } = useParams<{ pageId: string }>();
    const { t } = useTranslation();
    const lang = useLang();
    const region = useRegion();
    const { regions } = useData();

    const page = region?.text.pages?.find((p) => p.id === pageId);
    if (!page) return <Navigate to="/more" replace />;

    // Another loaded region has a page of the same name: this one is about *this* region, and
    // the way to read the other is to switch region.
    const other = regions.find(
        (r) => r.key !== region?.key && r.text.pages?.some((p) => p.id === pageId),
    );

    return (
        <Box sx={{ height: "100%", overflowY: "auto", p: 2, pb: 4 }}>
            <Typography variant="h2" gutterBottom>
                {i18(page.title, lang)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                {region ? t("pg.from", { 0: i18(region.name, lang) }) : ""}
            </Typography>
            <PackBlocks blocks={page.blocks} />
            {other && region && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    {t("info.region", {
                        0: i18(region.name, lang),
                        1: i18(other.name, lang),
                    })}
                </Alert>
            )}
        </Box>
    );
};
