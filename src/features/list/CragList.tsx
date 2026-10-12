import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@app/hooks";
import { useShownCrags } from "@app/useAppData";

import { CragCard } from "./CragCard";
import { ListToolbar } from "./ListToolbar";

export const CragList = () => {
    const { t } = useTranslation();
    const shown = useShownCrags();
    const fav = useAppSelector((s) => s.filters.one.fav);
    const favCrags = useAppSelector((s) => s.favourites.crags);
    const favRoutes = useAppSelector((s) => s.favourites.routes);

    // Filtering by favourites and finding none: the original said *why* there is nothing here
    // and how to add one, rather than the generic «no crag matches these filters».
    const emptyKey =
        fav === "crags" && !favCrags.length
            ? "empty.fc"
            : fav === "routes" && !favRoutes.length
              ? "empty.fr"
              : "empty";

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <ListToolbar />
            <Box sx={{ overflowY: "auto", flex: 1, px: 1, pb: 2 }}>
                {shown.length === 0 ? (
                    <Typography color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                        {t(emptyKey)}
                    </Typography>
                ) : (
                    shown.map((match) => <CragCard key={match.crag.id} match={match} />)
                )}
            </Box>
        </Box>
    );
};
