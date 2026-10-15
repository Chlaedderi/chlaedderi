/**
 * The entry point. Fonts are bundled rather than fetched from Google Fonts: the app is meant to
 * work offline, and a CDN stylesheet is the one thing the old version could not do without a
 * network.
 */

import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./styles/app.css";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { HashRouter } from "react-router-dom";

import { App } from "./App";
import { DataProvider } from "./app/DataProvider";
import { watchInstallPrompt } from "./app/installPrompt";
import { PrefsSync } from "./app/PrefsSync";
import { store } from "./app/store";
import { watchViewport } from "./app/viewport";
import { WeatherProvider } from "./app/WeatherProvider";
import { detectLang } from "./core/lang";
import { PREVIEW_SUFFIX } from "./core/preview";
import { createI18n } from "./i18n";
import { theme } from "./theme";

const prefs = store.getState().prefs;

// The theme attribute is set before the first paint, so there is no flash of the wrong scheme.
if (prefs.theme === "auto") document.documentElement.removeAttribute("data-theme");
else document.documentElement.setAttribute("data-theme", prefs.theme);

const i18n = createI18n(prefs.lang ?? detectLang());
document.documentElement.lang = i18n.language;

watchViewport();
watchInstallPrompt();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Provider store={store}>
            <I18nextProvider i18n={i18n}>
                {/* MUI keeps the mode in storage of its own; under /pr-N/ it carries the
                    preview suffix like every other name, or a preview would switch the app's
                    scheme in another tab. Without a suffix these are MUI's own defaults. */}
                <ThemeProvider
                    theme={theme}
                    defaultMode="system"
                    modeStorageKey={`mui-mode${PREVIEW_SUFFIX}`}
                    colorSchemeStorageKey={`mui-color-scheme${PREVIEW_SUFFIX}`}
                >
                    <CssBaseline enableColorScheme />
                    <PrefsSync />
                    <DataProvider>
                        <WeatherProvider>
                            <HashRouter>
                                <App />
                            </HashRouter>
                        </WeatherProvider>
                    </DataProvider>
                </ThemeProvider>
            </I18nextProvider>
        </Provider>
    </StrictMode>,
);
