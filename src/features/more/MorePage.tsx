/**
 * «More»: the settings, the app itself, and the way to everything that is not a crag.
 *
 * The sections follow the hand-written app: language and appearance, the app (install, version,
 * fetch the newest), «Worth knowing», what the loaded pack says about its data, the mappacks, and
 * about/licences. Each of those was either missing or broken in the first React pass.
 */

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DownloadIcon from "@mui/icons-material/Download";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LightbulbIcon from "@mui/icons-material/LightbulbOutlined";
import MapIcon from "@mui/icons-material/Map";
import RouteIcon from "@mui/icons-material/Route";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import { uiActions } from "@app/slices/uiSlice";
import { useLang, useRegion, useRegionCrags } from "@app/useAppData";
import { i18 } from "@core/text";
import { formatDate, formatInt } from "@i18n/index";

import { AppSection } from "./AppSection";
import { InfoSheet, type InfoTopic } from "./InfoSheet";

/** A row that leads somewhere. */
const Row = ({
    icon,
    primary,
    secondary,
    onClick,
}: {
    icon: React.ReactNode;
    primary: string;
    secondary?: string;
    onClick: () => void;
}) => (
    <ListItemButton onClick={onClick}>
        <ListItemIcon>{icon}</ListItemIcon>
        <ListItemText primary={primary} secondary={secondary} />
        <ChevronRightIcon color="action" />
    </ListItemButton>
);

export const MorePage = () => {
    const { t, i18n } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const prefs = useAppSelector((s) => s.prefs);
    const region = useRegion();
    const crags = useRegionCrags();
    const { regions, crags: allCrags, parks, onlyShowcase } = useData();
    const [info, setInfo] = useState<InfoTopic | null>(null);

    const pages = region?.text.pages ?? [];
    const routes = allCrags.reduce((n, c) => n + c.routes.length, 0);
    const dataDate = region?.updated ?? region?.accessed ?? null;

    return (
        <Box sx={{ height: "100%", overflowY: "auto", pb: 4 }}>
            <Box sx={{ p: 2, pb: 0 }}>
                <Typography variant="h2">{t("tab.more")}</Typography>
            </Box>

            {/* ---- settings */}
            <Box sx={{ px: 2, py: 1.5 }}>
                <Stack spacing={2}>
                    <TextField
                        select
                        size="small"
                        fullWidth
                        label={t("m.lang")}
                        value={lang}
                        onChange={(e) => {
                            const next = e.target.value as "en" | "de";
                            dispatch(prefsActions.setLang(next));
                            void i18n.changeLanguage(next);
                            document.documentElement.lang = next;
                        }}
                    >
                        <MenuItem value="de">Deutsch</MenuItem>
                        <MenuItem value="en">English</MenuItem>
                    </TextField>

                    <TextField
                        select
                        size="small"
                        fullWidth
                        label={t("m.theme")}
                        value={prefs.theme}
                        onChange={(e) => {
                            const next = e.target.value as typeof prefs.theme;
                            // Applied by PrefsSync, which hands it to MUI.
                            dispatch(prefsActions.setTheme(next));
                        }}
                    >
                        <MenuItem value="auto">{t("theme.auto")}</MenuItem>
                        <MenuItem value="light">{t("theme.light")}</MenuItem>
                        <MenuItem value="dark">{t("theme.dark")}</MenuItem>
                    </TextField>
                </Stack>
            </Box>

            <Divider />
            <AppSection />

            <Divider />
            <List subheader={<ListSubheader>{t("m.know")}</ListSubheader>}>
                <Row
                    icon={<LightbulbIcon />}
                    primary={t("m.know.b")}
                    secondary={t("m.know.h") || undefined}
                    onClick={() => void navigate("/know")}
                />
            </List>

            {/* ---- what the loaded pack says about its own data */}
            <Divider />
            <List subheader={<ListSubheader>{t("m.data")}</ListSubheader>}>
                {pages.map((page) => (
                    <Row
                        key={page.id}
                        icon={<InfoOutlinedIcon />}
                        primary={i18(page.title, lang)}
                        secondary={region ? i18(region.name, lang) : undefined}
                        onClick={() => void navigate(`/page/${page.id}`)}
                    />
                ))}
                <Row
                    icon={<RouteIcon />}
                    primary={t("m.coverage")}
                    onClick={() => void navigate("/coverage")}
                />
            </List>

            <Divider />
            <List subheader={<ListSubheader>{t("m.packs")}</ListSubheader>}>
                <Row
                    icon={<DownloadIcon />}
                    primary={t("pk.manage")}
                    secondary={
                        onlyShowcase
                            ? t("pk.taste")
                            : t("pk.manage.h", {
                                  0: formatInt(regions.length, lang),
                                  1: formatInt(allCrags.length, lang),
                              })
                    }
                    onClick={() => dispatch(uiActions.setPacksOpen(true))}
                />
            </List>

            {/* ---- about */}
            <Divider />
            <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="h4" gutterBottom>
                    {t("m.about")}
                </Typography>
                <Typography variant="body2" gutterBottom>
                    {t("m.about.t", {
                        0: formatInt(allCrags.length, lang),
                        1: formatInt(routes, lang),
                        2: Object.keys(parks).length,
                    })}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {t("m.lic")}
                </Typography>

                {/* A pack brings its own licence note; the app does not speak for it. */}
                {regions
                    .filter((r) => r.text.licence)
                    .map((r) => (
                        <Typography key={r.key} variant="body2" color="text.secondary" gutterBottom>
                            {i18(r.name, lang)}: {i18(r.text.licence, lang)}
                        </Typography>
                    ))}

                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", my: 1 }}>
                    <Button size="small" onClick={() => setInfo("about")}>
                        {t("m.about")}
                    </Button>
                    <Button size="small" onClick={() => setInfo("licence")}>
                        {t("m.licences")}
                    </Button>
                    <Button size="small" onClick={() => setInfo("contribute")}>
                        {t("m.contribute")}
                    </Button>
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {/* With a data date the original gave both; without one, just the version. */}
                    {dataDate
                        ? t("m.version", {
                              0: formatDate(dataDate, lang),
                              1: region?.version ?? "",
                          })
                        : region?.version
                          ? t("m.version.app", { 0: region.version })
                          : ""}
                </Typography>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                >
                    {t("disclaimer")}
                </Typography>
            </Box>

            <InfoSheet topic={info} onClose={() => setInfo(null)} />

            <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    <MapIcon sx={{ fontSize: 13, verticalAlign: "-2px", mr: 0.4 }} />
                    {crags.length > 0 && region ? i18(region.name, lang) : ""}
                </Typography>
            </Box>
        </Box>
    );
};
