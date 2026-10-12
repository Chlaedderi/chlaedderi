/**
 * Rendering a piece of the app in a test, with the providers it expects.
 *
 * The map is left out on purpose: Leaflet measures its container, and jsdom reports every element
 * as 0×0, so a MapContainer in a test says nothing useful. The map is verified in a real browser.
 */

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { configureStore } from "@reduxjs/toolkit";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";

import type { DataContextValue } from "@app/dataContext";
import { DataTestProvider } from "@app/DataProvider";
import favourites from "@app/slices/favouritesSlice";
import filters from "@app/slices/filtersSlice";
import logbook from "@app/slices/logbookSlice";
import prefs, { prefsActions } from "@app/slices/prefsSlice";
import ui from "@app/slices/uiSlice";
import type { WeatherContextValue } from "@app/weatherContext";
import { WeatherTestProvider } from "@app/WeatherProvider";
import { mountPacks } from "@core/packs/mount";
import type { Mappack } from "@domain/mappack";
import { createI18n } from "@i18n/index";
import showcaseJson from "@maps/pack.showcase.json";

import { theme } from "../theme";

export const showcase = showcaseJson as unknown as Mappack;

/**
 * The showcase is an invented region, so the app offers its «these crags are invented» dialog on
 * a first visit -- and a modal dialog takes the whole screen away from every other test. Tests
 * therefore start as a reader who has already read it; `DemoNotice.test.tsx` is where the dialog
 * itself is checked.
 */
export const makeStore = (preloaded?: Record<string, unknown>) => {
    const store = configureStore({
        reducer: { filters, favourites, logbook, prefs, ui },
        ...(preloaded ? { preloadedState: preloaded as never } : {}),
    });
    if (!store.getState().prefs.demoSeen) {
        store.dispatch(prefsActions.setFlag({ key: "demoSeen", value: true }));
    }
    return store;
};

export const mountedShowcase = (): DataContextValue => ({
    ...mountPacks([showcase]),
    booted: true,
    onlyShowcase: true,
    busy: false,
    installFromUrl: async () => ({ ok: false, problems: [] }),
    installFromFile: async () => ({ ok: false, problems: [] }),
    installLoaded: async () => ({ ok: false, problems: [] }),
    uninstall: async () => {},
});

/** No forecast unless a test supplies one: that is the state the app starts in. */
export const noWeather = (): WeatherContextValue => ({
    at: null,
    loading: false,
    error: null,
    stateOf: () => null,
    seriesOf: () => null,
    load: () => {},
});

export interface HarnessOptions {
    route?: string;
    store?: ReturnType<typeof makeStore>;
    data?: DataContextValue;
    weather?: WeatherContextValue;
    lang?: "en" | "de";
}

export const renderApp = (
    ui_: ReactElement,
    {
        route = "/",
        store = makeStore(),
        data = mountedShowcase(),
        weather = noWeather(),
        lang = "en",
    }: HarnessOptions = {},
) => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <Provider store={store}>
            <I18nextProvider i18n={createI18n(lang)}>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <DataTestProvider value={data}>
                        <WeatherTestProvider value={weather}>
                            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
                        </WeatherTestProvider>
                    </DataTestProvider>
                </ThemeProvider>
            </I18nextProvider>
        </Provider>
    );
    return { ...render(ui_, { wrapper: Wrapper }), store };
};
