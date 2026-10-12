import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";

import { useLang } from "@app/useAppData";
import { BANDS } from "@core/grades";
import { countOf } from "@i18n/index";

/**
 * The five-band grade chart. The colours are the b0–b4 ramp of the theme, which is the same ramp
 * the old app used -- a climber reads the distribution off it, so it is information, not decoration.
 */
export const GradeBar = ({
    bands,
    height = 8,
    sx,
}: {
    bands: readonly [number, number, number, number, number];
    height?: number;
    sx?: SxProps<Theme>;
}) => {
    const { t } = useTranslation();
    const lang = useLang();
    const total = bands.reduce((a, b) => a + b, 0);
    if (!total) return null;

    return (
        <Box
            sx={[
                {
                    display: "flex",
                    height,
                    borderRadius: 999,
                    overflow: "hidden",
                    bgcolor: "surface.line",
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            role="img"
            aria-label={bands
                .map((n, i) => (n ? `${BANDS[i]}: ${n}` : null))
                .filter(Boolean)
                .join(", ")}
        >
            {bands.map((n, i) =>
                n ? (
                    <Tooltip
                        key={i}
                        title={`${BANDS[i]} · ${countOf(t, "n.route", n, lang)}`}
                        arrow
                    >
                        <Box
                            sx={{
                                width: `${(n / total) * 100}%`,
                                bgcolor: `band.b${i}`,
                            }}
                        />
                    </Tooltip>
                ) : null,
            )}
        </Box>
    );
};
