/**
 * The MUI theme, built from the design tokens the hand-written app already had.
 *
 * Those tokens (`--bg`, `--accent`, `--easy`/`--mid`/`--hard`, the b0–b4 band ramp…) came in three
 * blocks: a light scheme on `:root`, a dark one under `prefers-color-scheme`, and a third copy
 * under `[data-theme="dark"]` so an explicit choice wins. MUI's `cssVariables.colorSchemeSelector`
 * does exactly that, so the `data-theme` attribute on `<html>` keeps its meaning and the themes
 * are one definition instead of three.
 *
 * The grade colours are Okabe-Ito, picked to stay apart for the common kinds of colour blindness.
 * They are not decoration -- a climber reads the grade distribution off them -- so they are kept
 * exactly as they were.
 */

import { createTheme, type Theme } from "@mui/material/styles";

/** Barlow Condensed for headings and numbers, Barlow for everything else. */
const DISPLAY = '"Barlow Condensed","Arial Narrow","Helvetica Neue",Arial,sans-serif';
const BODY = '"Barlow","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';

declare module "@mui/material/styles" {
    interface Palette {
        /** Where a crag sits on the grade scale. Okabe-Ito, colour-blind safe. */
        grade: { easy: string; mid: string; hard: string; unknown: string };
        /** The five bars of the grade chart, and the ink that reads on them. */
        band: { b0: string; b1: string; b2: string; b3: string; b4: string; contrastText: string };
        /** Things on the map that are not crags. */
        marker: { me: string; fav: string; park: string; route: string; rate: string };
        /** The quiet surfaces: a raised card, a hairline, the muted ink. */
        surface: { panel: string; raise: string; line: string; muted: string; accentSoft: string };
        /** The map plate under the tiles: sea, land, and the outline of a municipality. */
        map: { sea: string; land: string; borderGeo: string };
        /** Weather and radar accents. */
        accentColors: {
            violet: string;
            teal: string;
            rain: string;
            amber: string;
            sun: string;
            hot: string;
        };
        /** The forecast pictograms, after MeteoSwiss' symbols. See src/core/wxSymbol.ts. */
        wx: {
            sun: string;
            ray: string;
            moon: string;
            cloud: string;
            cloudEdge: string;
            dark: string;
            rain: string;
            snow: string;
            halo: string;
        };
    }
    interface PaletteOptions {
        grade?: Palette["grade"];
        band?: Palette["band"];
        marker?: Palette["marker"];
        surface?: Palette["surface"];
        map?: Palette["map"];
        accentColors?: Palette["accentColors"];
        wx?: Palette["wx"];
    }
}

export const theme: Theme = createTheme({
    cssVariables: { colorSchemeSelector: "data-theme" },
    colorSchemes: {
        light: {
            palette: {
                mode: "light",
                background: { default: "#f4f1ec", paper: "#fbf9f6" },
                primary: { main: "#4b1fa0", contrastText: "#ffffff" },
                secondary: { main: "#8a22a8", contrastText: "#ffffff" },
                text: { primary: "#1d1538", secondary: "#5e5876" },
                divider: "#e2dcd2",
                success: { main: "#0f7b55" },
                warning: { main: "#8a5300" },
                error: { main: "#b3261e" },
                info: { main: "#0072b2" },
                grade: { easy: "#009e73", mid: "#0072b2", hard: "#d55e00", unknown: "#8a8698" },
                band: {
                    b0: "#2f9a74",
                    b1: "#00805c",
                    b2: "#0067a3",
                    b3: "#c25400",
                    b4: "#b0124f",
                    contrastText: "#ffffff",
                },
                marker: {
                    me: "#0a84ff",
                    fav: "#e0245e",
                    park: "#1565c0",
                    route: "#d81b78",
                    rate: "#b7791f",
                },
                surface: {
                    panel: "#fbf9f6",
                    raise: "#ffffff",
                    line: "#e2dcd2",
                    muted: "#5e5876",
                    accentSoft: "#ece5fb",
                },
                map: { sea: "#cfe6ee", land: "#f1f0e8", borderGeo: "#a59fb3" },
                accentColors: {
                    violet: "#6d3fd8",
                    teal: "#00897b",
                    rain: "#1e6fd9",
                    amber: "#b86e00",
                    sun: "#ff9b3f",
                    hot: "#d81b78",
                },
                wx: {
                    sun: "#f8d808",
                    ray: "#f8c000",
                    moon: "#c9d2da",
                    cloud: "#dcdcdc",
                    cloudEdge: "#a3a3a3",
                    dark: "#a6adb3",
                    rain: "#1f78e0",
                    snow: "#6fa6dc",
                    halo: "#ffffff",
                },
            },
        },
        dark: {
            palette: {
                mode: "dark",
                background: { default: "#120e1f", paper: "#191430" },
                primary: { main: "#b9a0ff", contrastText: "#1a1038" },
                secondary: { main: "#5c1b78", contrastText: "#eeeaf8" },
                text: { primary: "#eeeaf8", secondary: "#a9a1c6" },
                divider: "#342c55",
                success: { main: "#62d8ad" },
                warning: { main: "#f2b552" },
                error: { main: "#ff8a80" },
                info: { main: "#5cb3f5" },
                grade: { easy: "#2fcf9a", mid: "#5cb3f5", hard: "#ff9a4d", unknown: "#958fae" },
                band: {
                    b0: "#7fe0bd",
                    b1: "#2fcf9a",
                    b2: "#5cb3f5",
                    b3: "#ff9a4d",
                    b4: "#ff7aa8",
                    contrastText: "#14102a",
                },
                marker: {
                    me: "#5aa9ff",
                    fav: "#ff7d9a",
                    park: "#4d9bf0",
                    route: "#ff5fa8",
                    rate: "#f2c14e",
                },
                surface: {
                    panel: "#191430",
                    raise: "#231c40",
                    line: "#342c55",
                    muted: "#a9a1c6",
                    accentSoft: "#2d2454",
                },
                map: { sea: "#0c2530", land: "#1b1a2b", borderGeo: "#6a6485" },
                accentColors: {
                    violet: "#b39dff",
                    teal: "#4fd1c5",
                    rain: "#6aa8ff",
                    amber: "#f2b552",
                    sun: "#ff9b3f",
                    hot: "#ff6fb0",
                },
                // The sun keeps its colour in the dark; everything grey is lifted so the cloud
                // still reads against a dark card, exactly as the original's second block did.
                wx: {
                    sun: "#f8d808",
                    ray: "#f8c000",
                    moon: "#c3cedb",
                    cloud: "#c9cfd4",
                    cloudEdge: "#8a949c",
                    dark: "#8d979f",
                    rain: "#5aa2ec",
                    snow: "#a7cdf2",
                    halo: "#141e27",
                },
            },
        },
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: BODY,
        fontSize: 14.5,
        h1: { fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "-0.01em" },
        h2: { fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.6rem" },
        h3: { fontFamily: DISPLAY, fontWeight: 600, fontSize: "1.3rem" },
        h4: { fontFamily: DISPLAY, fontWeight: 600, fontSize: "1.15rem" },
        h5: { fontFamily: DISPLAY, fontWeight: 600, fontSize: "1.05rem" },
        h6: { fontFamily: DISPLAY, fontWeight: 600, fontSize: "1rem" },
        button: { fontFamily: DISPLAY, fontWeight: 600, textTransform: "none", letterSpacing: 0 },
        subtitle2: { fontWeight: 600 },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                // The app fills the viewport and never scrolls as a whole; the panes scroll.
                "html, body, #root": { height: "100%" },
                body: { overflow: "hidden", WebkitTextSizeAdjust: "100%" },
                // Numbers line up in the route lists and the grade columns.
                ".num": { fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" },
            },
        },
        MuiButton: { defaultProps: { disableElevation: true } },
        MuiCard: {
            defaultProps: { variant: "outlined" },
            styleOverrides: { root: { backgroundImage: "none" } },
        },
        MuiChip: { styleOverrides: { label: { fontWeight: 600 } } },
        MuiTooltip: { defaultProps: { enterTouchDelay: 300 } },
        MuiLink: { defaultProps: { underline: "hover" } },
    },
});

/** The grade colour for a crag's class, straight off the palette. */
export const gradeColor = (t: Theme, cls: "easy" | "mid" | "hard" | "unk"): string =>
    cls === "unk" ? t.palette.grade.unknown : t.palette.grade[cls];
