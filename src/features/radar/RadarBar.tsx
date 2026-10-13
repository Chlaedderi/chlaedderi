/**
 * The radar's own bar on the map: which frame is showing, play/pause, and the rain-rate ramp.
 *
 * The animation rests three ticks on the newest frame before looping, so the picture you care
 * about -- what it is doing *now* -- stays long enough to read. It does not animate at all when
 * the viewer asked for reduced motion.
 */

import CloseIcon from "@mui/icons-material/Close";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "react-i18next";

import { useAppDispatch } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import type { RadarFrames, RadarSource } from "@core/radar";

const clock = (ms: number): string => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const RadarBar = ({
    source,
    frames,
    index,
    playing,
    onPlay,
    loading,
    failed = false,
}: {
    readonly source: RadarSource;
    readonly frames: RadarFrames | null;
    readonly index: number;
    readonly playing: boolean;
    readonly onPlay: (playing: boolean) => void;
    readonly loading: boolean;
    /** The radar could not be fetched. It keeps trying; the bar says so meanwhile. */
    readonly failed?: boolean;
}) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const calm = useMediaQuery("(prefers-reduced-motion: reduce)");

    const at = frames?.times[index];
    // A failure with frames already on screen keeps showing their time: a radar picture a few
    // minutes old is still worth reading, and the toast already said the refresh did not work.
    const title =
        loading && !frames
            ? t("rd.load")
            : failed && !frames
              ? // Not `rd.fail`: that whole sentence is what the toast said once. The bar carries
                // the standing state, which is shorter and says that it has not given up.
                t("rd.down")
              : source === "dpc"
                ? t("rd.latest")
                : at
                  ? t("rd.at", { 0: clock(at) })
                  : t("rd.head");

    return (
        <div className="radarbar">
            <span className="ttl" aria-live="polite">
                {title}
            </span>
            <span className="scale" aria-hidden="true" />
            {frames && frames.times.length > 1 && !calm && (
                <IconButton
                    size="small"
                    aria-label={t(playing ? "rd.pause" : "rd.play")}
                    onClick={() => onPlay(!playing)}
                >
                    {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>
            )}
            <IconButton
                size="small"
                aria-label={t("rd.off")}
                onClick={() => dispatch(prefsActions.setRadar(false))}
            >
                <CloseIcon fontSize="small" />
            </IconButton>
        </div>
    );
};
