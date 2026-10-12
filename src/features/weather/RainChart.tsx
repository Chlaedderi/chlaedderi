/**
 * Rain by the hour: 24 behind, 24 ahead.
 *
 * A port of the original's `.wxchart` (index.html:3366) -- the one part of the rain section the
 * React pass never drew, which left the crag page with the verdict and the totals but nothing to
 * actually look at. Past hours are drawn solid and forecast hours pale, with a dashed line at the
 * present moment and the scale called out in the corner.
 *
 * Plain elements with the original's class names rather than `sx`, because the stylesheet these
 * rules come from is shared with the markers, which Leaflet injects as HTML strings.
 */

import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";

import type { RainChart as Chart } from "@core/weather";

export const RainChart = ({ chart }: { readonly chart: Chart }) => {
    const { t } = useTranslation();
    const top = chart.top < 10 ? chart.top.toFixed(1) : String(Math.round(chart.top));

    return (
        <Box>
            <div className="wxchart" role="img" aria-label={t("wx.chart")}>
                {chart.bars.map((bar, i) => (
                    <i
                        // The bars are a fixed 48-slot window, so the index is their identity.
                        key={i}
                        className={bar.future ? "f" : ""}
                        style={{ height: `${((bar.mm / chart.top) * 100).toFixed(1)}%` }}
                    />
                ))}
                <span className="now" style={{ left: `${chart.nowAt.toFixed(1)}%` }} />
                <span className="max">{t("wx.max", { 0: top })}</span>
            </div>
            <div className="wxax">
                <span>{t("wx.ax.past")}</span>
                <span>{t("wx.ax.now")}</span>
                <span>{t("wx.ax.next")}</span>
            </div>
        </Box>
    );
};
