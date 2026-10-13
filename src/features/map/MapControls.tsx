/**
 * The buttons stacked at the top right of the map: locate, and the base-map menu.
 *
 * A port of the `.mapctl` stack. The locate button has three states, as it did: off, waiting for a
 * fix (pulsing), and on. The base-map menu lives here rather than only in the settings, because
 * switching to the satellite image or the swisstopo map is something you do while looking at the
 * map, not something you go to a settings page for.
 */

import LayersIcon from "@mui/icons-material/Layers";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import Checkbox from "@mui/material/Checkbox";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import FormControlLabel from "@mui/material/FormControlLabel";
import Popper from "@mui/material/Popper";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { prefsActions } from "@app/slices/prefsSlice";
import type { Prefs } from "@core/prefs";

import { BASES, BASES_CH } from "./baseMaps";

export type LocateState = "off" | "waiting" | "on";

export const MapControls = ({
    inSwitzerland,
    locate,
    locateState,
    picking = false,
}: {
    readonly inSwitzerland: boolean;
    readonly locate: () => void;
    readonly locateState: LocateState;
    /** Waiting for a tap on the map to set the position by hand. */
    readonly picking?: boolean;
}) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const prefs = useAppSelector((s) => s.prefs);
    const [open, setOpen] = useState(false);
    const anchor = useRef<HTMLButtonElement | null>(null);

    const label = picking ? t("loc.pick") : locateState === "on" ? t("loc.centre") : t("loc.show");

    return (
        <div className="mapctl">
            <button
                type="button"
                className={`mbtn${locateState === "waiting" ? " wait" : ""}`}
                aria-pressed={locateState === "on"}
                // The original's three states: asking for a tap, already following you, or not
                // started yet (index.html:4109).
                aria-label={label}
                title={label}
                onClick={locate}
            >
                <MyLocationIcon fontSize="small" />
            </button>

            <button
                type="button"
                ref={anchor}
                className="mbtn"
                aria-pressed={open}
                aria-expanded={open}
                aria-haspopup="true"
                aria-label={t("map.base")}
                title={t("map.base")}
                onClick={() => setOpen((v) => !v)}
            >
                <LayersIcon fontSize="small" />
            </button>

            <Popper
                open={open}
                anchorEl={anchor.current}
                placement="bottom-end"
                style={{ zIndex: 600 }}
            >
                <ClickAwayListener
                    onClickAway={(event) => {
                        // Both of this listener's handlers sit on `document`, and on a touch screen
                        // `touchend` gets there before the browser synthesises the `click`. Without
                        // this guard the listener closed the menu and the button's own toggle
                        // immediately reopened it, so the icon only ever opened. The button is the
                        // single source of truth; everything outside it still closes the menu.
                        if (anchor.current?.contains(event.target as Node)) return;
                        setOpen(false);
                    }}
                >
                    <div className="basemenu">
                        {(inSwitzerland ? BASES_CH : BASES).map((base) => {
                            const current = inSwitzerland ? prefs.baseCH : prefs.base;
                            return (
                                <button
                                    key={base.key}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={current === base.key}
                                    onClick={() => {
                                        if (inSwitzerland) {
                                            dispatch(
                                                prefsActions.setBaseCh(base.key as Prefs["baseCH"]),
                                            );
                                        } else {
                                            dispatch(
                                                prefsActions.setBase(base.key as Prefs["base"]),
                                            );
                                        }
                                    }}
                                >
                                    {base.label}
                                </button>
                            );
                        })}

                        {inSwitzerland && (
                            <>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block", mt: 0.5 }}
                                >
                                    {t("ch.head")}
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={prefs.chTrails}
                                            onChange={(e) =>
                                                dispatch(
                                                    prefsActions.setFlag({
                                                        key: "chTrails",
                                                        value: e.target.checked,
                                                    }),
                                                )
                                            }
                                        />
                                    }
                                    label={t("ch.trails")}
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={prefs.chWrz}
                                            onChange={(e) =>
                                                dispatch(
                                                    prefsActions.setFlag({
                                                        key: "chWrz",
                                                        value: e.target.checked,
                                                    }),
                                                )
                                            }
                                        />
                                    }
                                    label={t("ch.wrz")}
                                />
                            </>
                        )}

                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={prefs.wx}
                                    onChange={(e) =>
                                        dispatch(
                                            prefsActions.setFlag({
                                                key: "wx",
                                                value: e.target.checked,
                                            }),
                                        )
                                    }
                                />
                            }
                            label={t("rd.marks")}
                        />

                        {/*
                         * One switch, not a choice of services: which radar covers this region is
                         * a fact about where it is, and the map works it out (core/radar.ts).
                         */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={prefs.radar}
                                    onChange={(e) =>
                                        dispatch(prefsActions.setRadar(e.target.checked))
                                    }
                                />
                            }
                            label={t("wx.radar")}
                        />

                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={prefs.allPaths}
                                    onChange={(e) =>
                                        dispatch(
                                            prefsActions.setFlag({
                                                key: "allPaths",
                                                value: e.target.checked,
                                            }),
                                        )
                                    }
                                />
                            }
                            label={t("map.allpaths")}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={prefs.allParks}
                                    onChange={(e) =>
                                        dispatch(
                                            prefsActions.setFlag({
                                                key: "allParks",
                                                value: e.target.checked,
                                            }),
                                        )
                                    }
                                />
                            }
                            label={t("map.allparks")}
                        />
                    </div>
                </ClickAwayListener>
            </Popper>
        </div>
    );
};
