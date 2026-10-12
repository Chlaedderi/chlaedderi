import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { favouritesActions } from "@app/slices/favouritesSlice";
import { uiActions } from "@app/slices/uiSlice";
import type { CragMatch } from "@core/filters";

import { CragFacts } from "../crag/CragFacts";
import { GradeBar } from "../crag/GradeBar";

import { CragTags } from "./CragTags";

/** One crag in the list: name, where it is, its figures, its grade spread and its tags. */
export const CragCard = ({ match }: { match: CragMatch }) => {
    const { crag, inCount, routeHit } = match;
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const isFav = useAppSelector((s) => s.favourites.crags.includes(crag.id));

    return (
        <Card sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "stretch" }}>
                <CardActionArea
                    onClick={() => {
                        // `reveal`, not `select`: picking a crag out of the list is the one way
                        // of choosing one where the viewer cannot already see where it is, so
                        // this is where the map travels. A tap on its marker does not.
                        dispatch(uiActions.reveal(crag.id));
                        void navigate(`/crag/${crag.id}`);
                    }}
                    sx={{ p: 1.25, minWidth: 0, flex: 1 }}
                >
                    <Typography variant="h5" className="kat-ellipsis">
                        {crag.name}
                    </Typography>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        className="kat-ellipsis"
                        component="div"
                    >
                        {[crag.area, crag.locality, crag.municipality].filter(Boolean).join(" · ")}
                    </Typography>

                    <Box sx={{ mt: 0.75 }}>
                        <CragFacts crag={crag} inCount={inCount} />
                    </Box>

                    {crag.bands && <GradeBar bands={crag.bands} sx={{ mt: 1 }} />}
                    <CragTags crag={crag} routeHit={routeHit} />
                </CardActionArea>
                <IconButton
                    aria-label={t(isFav ? "fav.t.rm" : "fav.t.add")}
                    onClick={() => dispatch(favouritesActions.toggleCrag(crag.id))}
                    sx={{ alignSelf: "flex-start", m: 0.5 }}
                >
                    {isFav ? (
                        <FavoriteIcon fontSize="small" sx={{ color: "marker.fav" }} />
                    ) : (
                        <FavoriteBorderIcon fontSize="small" />
                    )}
                </IconButton>
            </Box>
        </Card>
    );
};
