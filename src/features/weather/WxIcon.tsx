/**
 * One weather pictogram, drawn as React children.
 *
 * `src/core/wxSymbol.ts` says what a symbol is made of; this turns that into SVG elements and
 * resolves the tones against the theme. Nothing here builds markup from a string -- the shapes are
 * data, and the only string that reaches the DOM is the label, as a `<title>`.
 */

import { useTheme } from "@mui/material/styles";
import { useId } from "react";

import { wmoToMs, wxShapes, type WxTone } from "@core/wxSymbol";

export const WxIcon = ({
    code,
    day = true,
    size = 34,
    label,
}: {
    /** The WMO weather code the forecast carries. */
    readonly code: number;
    readonly day?: boolean;
    readonly size?: number;
    /** The same code in words -- the symbol's name for a reader who cannot see it. */
    readonly label?: string;
}) => {
    const theme = useTheme();
    // A crescent is cut out with a mask, and a mask needs an id that is unique on the page: the
    // forecast draws dozens of these.
    const maskId = useId();
    const tone = (name: WxTone): string => theme.palette.wx[name];

    return (
        <svg
            viewBox="0 0 48 48"
            width={size}
            height={size}
            role="img"
            aria-label={label}
            aria-hidden={label == null ? true : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "block", flex: "none" }}
        >
            {label != null && <title>{label}</title>}
            {wxShapes(wmoToMs(code, day)).map((s, i) => {
                if (s.k === "moon")
                    return (
                        <g key={i}>
                            <mask id={`${maskId}-${i}`}>
                                <rect width="48" height="48" fill="#fff" />
                                <circle
                                    cx={s.cx + s.r * 0.55}
                                    cy={s.cy - s.r * 0.45}
                                    r={s.r * 0.9}
                                    fill="#000"
                                />
                            </mask>
                            <circle
                                cx={s.cx}
                                cy={s.cy}
                                r={s.r}
                                fill={tone("moon")}
                                mask={`url(#${maskId}-${i})`}
                            />
                        </g>
                    );

                if (s.k === "circle")
                    return (
                        <circle
                            key={i}
                            cx={s.cx}
                            cy={s.cy}
                            r={s.r}
                            fill={tone(s.fill)}
                            stroke={s.stroke ? tone(s.stroke) : undefined}
                            strokeWidth={s.w}
                        />
                    );

                return (
                    <path
                        key={i}
                        d={s.d}
                        transform={s.transform}
                        fill={s.fill ? tone(s.fill) : "none"}
                        stroke={s.stroke ? tone(s.stroke) : undefined}
                        strokeWidth={s.w}
                        opacity={s.opacity}
                    />
                );
            })}
        </svg>
    );
};
