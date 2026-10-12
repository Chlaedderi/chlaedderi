/**
 * The height profile of a planned approach.
 *
 * Inline SVG rather than a chart library: it is a filled area and a few labels, it has to be
 * readable at 300 px on a phone, and the colours have to follow the theme. A chart library would
 * be a hundred kilobytes for this.
 */

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import type { ProfilePoint } from "@core/approach";

const W = 300;
const H = 76;

export const ElevationProfile = ({ profile }: { profile: readonly ProfilePoint[] }) => {
    const { t } = useTranslation();
    const theme = useTheme();

    if (profile.length < 2) return null;

    const total = profile[profile.length - 1]!.d || 1;
    const heights = profile.map((p) => p.h);
    const lo = Math.min(...heights);
    const hi = Math.max(...heights);
    // A flat walk should look flat, not like a mountain range: keep a minimum span.
    const span = Math.max(hi - lo, 20);
    const base = lo - (span - (hi - lo)) / 2;

    const x = (d: number): number => (d / total) * W;
    const y = (h: number): number => H - ((h - base) / span) * H;

    const line = profile.map((p) => `${x(p.d).toFixed(1)},${y(p.h).toFixed(1)}`).join(" ");
    const area = `0,${H} ${line} ${W},${H}`;

    return (
        <Box sx={{ mt: 1 }}>
            <Box
                component="svg"
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={t("pl.prof")}
                sx={{ width: "100%", height: "auto", display: "block" }}
            >
                <polygon points={area} fill={theme.palette.primary.main} opacity={0.18} />
                <polyline
                    points={line}
                    fill="none"
                    stroke={theme.palette.primary.main}
                    strokeWidth={1.75}
                    strokeLinejoin="round"
                />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary" className="num">
                    {Math.round(lo)} m
                </Typography>
                <Typography variant="caption" color="text.secondary" className="num">
                    {Math.round(hi)} m
                </Typography>
            </Box>
        </Box>
    );
};
