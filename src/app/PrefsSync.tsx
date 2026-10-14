/**
 * Applies the settings that live outside React: the colour scheme and the page's language.
 *
 * MUI owns the `data-theme` attribute once the theme is built with `colorSchemeSelector`: its
 * provider writes the scheme it believes in on mount and on every change of the system's. Writing
 * the attribute by hand therefore lost a «dark» or «light» choice at the next start, and «auto»
 * picked later stuck on light. Handing the choice to MUI's own `setMode` is what makes it hold.
 *
 * Both follow the store, so a change made in another tab -- the installed app beside a browser
 * tab, which share their storage -- is applied here too, not only stored.
 */

import { useColorScheme } from "@mui/material/styles";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "./hooks";

export const PrefsSync = () => {
    const theme = useAppSelector((s) => s.prefs.theme);
    const lang = useAppSelector((s) => s.prefs.lang);
    const { setMode } = useColorScheme();
    const { i18n } = useTranslation();

    useEffect(() => {
        setMode(theme === "auto" ? "system" : theme);
    }, [theme, setMode]);

    useEffect(() => {
        if (!lang || i18n.language === lang) return;
        void i18n.changeLanguage(lang);
        document.documentElement.lang = lang;
    }, [lang, i18n]);

    return null;
};
