/**
 * The map.
 *
 * It composes the layers the hand-written app drew, in its order: the base map, the Swiss
 * overlays, the faint all-approaches layer, the pack's place names, every car park (on request),
 * the crag markers in their two cluster groups, the approach of the crag that is open, and the
 * viewer's own position. The legend and the controls sit over it.
 */

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import L from "leaflet";
import {
    Component,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { useMatch, useNavigate } from "react-router-dom";

import { useData } from "@app/dataContext";
import { useAppDispatch, useAppSelector } from "@app/hooks";
import { useMapCovered } from "@app/layout";
import { uiActions } from "@app/slices/uiSlice";
import { useFilterContext, useLang, useRegion, useShownCrags } from "@app/useAppData";
import { useWeather } from "@app/weatherContext";
import { longText } from "@core/dataText";
import { bboxOf, formatDistance, haversine } from "@core/geo";
import type { Crag } from "@domain/model";

import { PlannedRoute } from "../approach/PlannedRoute";
import { PlannerPanel } from "../approach/PlannerPanel";
import { usePlanner } from "../approach/usePlanner";
import { RadarBar } from "../radar/RadarBar";
import { RadarLayer } from "../radar/RadarLayer";
import { useRadar } from "../radar/useRadar";

import { AllPathsLayer } from "./AllPathsLayer";
import { approachSpan } from "./approachGeometry";
import { ApproachLayer } from "./ApproachLayer";
import { BASES, BASES_CH } from "./baseMaps";
import { CALLOUT_FALLBACK, placeCallout, type Span } from "./calloutPlacement";
import { cameraPlan } from "./cameraPlan";
import { CragCallout, type CragCalloutProps } from "./CragCallout";
import { CragMarkers } from "./CragMarkers";
import { meIcon } from "./icons";
import { BASE_LAYERS, CH_LAYERS, CH_OVERLAYS } from "./layers";
import { MapControls, type LocateState } from "./MapControls";
import { MapLabels } from "./MapLabels";
import { MapLegend } from "./MapLegend";
import { ParkCallout } from "./ParkCallout";
import { ParkMarkers } from "./ParkMarkers";
import { PointCallout } from "./PointCallout";

/**
 * Fit the map to the whole region once, when what is shown changes.
 *
 * Keyed on the numbers rather than on the box object: a finished forecast gives every crag a new
 * weather state, which gives the filtered list a new identity, which used to re-fit a map the
 * viewer had just panned somewhere on purpose. The crag's own fit is not done here but in
 * `CragCallout`'s `defer`, so that the fit and the card cannot animate against each other.
 */
const FitBounds = ({ span }: { span: Span | null }) => {
    const map = useMap();
    const fitted = useRef<string | null>(null);
    useEffect(() => {
        if (!span) return;
        const key = [span.south, span.west, span.north, span.east]
            .map((v) => v.toFixed(5))
            .join(",");
        if (fitted.current === key) return;
        fitted.current = key;
        map.fitBounds(toBounds(span), { padding: [40, 40], maxZoom: 16 });
    }, [map, span]);
    return null;
};

/** `Span` is how the app talks about a box; Leaflet wants its own type at the edge. */
const toBounds = (span: Span): L.LatLngBoundsExpression => [
    [span.south, span.west],
    [span.north, span.east],
];

/** What Leaflet is showing, in the app's terms. */
const viewSpan = (map: L.Map): Span => {
    const b = map.getBounds();
    return { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() };
};

/**
 * Keep Leaflet's idea of its own size current.
 *
 * The map column changes width when the crag panel opens beside it, and Leaflet does not notice
 * on its own -- the tiles tear and every marker is placed against a stale size.
 */
const MapResize = () => {
    const map = useMap();
    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
        ro.observe(map.getContainer());
        return () => {
            ro.disconnect();
        };
    }, [map]);
    return null;
};

/** Tapping the map itself closes the call-out. */
const BackgroundClick = ({ onClick }: { onClick: (latlng: L.LatLng) => void }) => {
    const map = useMap();
    const ref = useRef(onClick);
    ref.current = onClick;
    useEffect(() => {
        const handler = (e: L.LeafletMouseEvent): void => {
            // A button inside the call-out that takes the call-out away -- its own «close» --
            // is gone from the document by the time the click reaches the map. Leaflet decides
            // whether a click came from inside a popup by walking up from the target, and an
            // orphaned node has nothing to walk, so the map reads it as a tap on open country
            // and lets the crag go. A click that removed its own button is not a tap on the map.
            const target = e.originalEvent?.target;
            if (target instanceof Node && !document.contains(target)) return;
            ref.current(e.latlng);
        };
        map.on("click", handler);
        return () => {
            map.off("click", handler);
        };
    }, [map]);
    return null;
};

/**
 * Leaflet can fail to start -- an old browser, a blocked worker, a canvas that will not allocate.
 * The rest of the app does not depend on it, so say so rather than showing nothing at all.
 */
class MapBoundary extends Component<{ children: ReactNode; message: string }, { dead: boolean }> {
    state = { dead: false };

    static getDerivedStateFromError(): { dead: boolean } {
        return { dead: true };
    }

    override render(): ReactNode {
        if (this.state.dead) {
            return (
                <Alert severity="warning" sx={{ m: 2 }}>
                    {this.props.message}
                </Alert>
            );
        }
        return this.props.children;
    }
}

export const MapPane = () => {
    const { t } = useTranslation();
    const lang = useLang();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    // The crag whose page is open beside the map, if one is. Taken apart into a plain string rather
    // than kept as the match: `useMatch` builds a fresh object on every render, which would churn
    // every dependency list below that mentions it.
    const routeCragId = useMatch("/crag/:id")?.params.id ?? null;
    const shown = useShownCrags();
    const region = useRegion();
    const { parks, byId } = useData();
    const ctx = useFilterContext();
    const selectedId = useAppSelector((s) => s.ui.selectedId);
    const revealNonce = useAppSelector((s) => s.ui.revealNonce);
    const covered = useMapCovered();
    /** The last reveal this map acted on. Starts where the slice does, so no first-tap surprise. */
    const applied = useRef(0);
    const favCrags = useAppSelector((s) => s.favourites.crags);
    const prefs = useAppSelector((s) => s.prefs);
    const me = useAppSelector((s) => s.ui.me);
    const picking = useAppSelector((s) => s.ui.picking);
    const calloutOpen = useAppSelector((s) => s.ui.calloutOpen);
    const [locateState, setLocateState] = useState<LocateState>("off");
    // Tiles that will not load: an offline device, a blocked host, a base map that is down.
    const [tileTrouble, setTileTrouble] = useState(false);
    const tileErrors = useRef(0);
    const tileOk = useRef(false);
    const [openPark, setOpenPark] = useState<string | null>(null);

    const inSwitzerland = region?.ch === true;
    const base = inSwitzerland
        ? (CH_LAYERS[prefs.baseCH] ?? CH_LAYERS.ch!)
        : (BASE_LAYERS[prefs.base] ?? BASE_LAYERS.topo!);

    const baseName =
        (inSwitzerland
            ? BASES_CH.find((b) => b.key === prefs.baseCH)
            : BASES.find((b) => b.key === prefs.base)
        )?.label ?? "";

    const favourites = useMemo(() => new Set(favCrags), [favCrags]);
    const selected = useMemo(
        () => shown.find((m) => m.crag.id === selectedId) ?? null,
        [shown, selectedId],
    );

    const { stateOf } = useWeather();
    const calm = useMediaQuery("(prefers-reduced-motion: reduce)");
    const radar = useRadar(prefs.radar, calm);
    const planning = useAppSelector((s) => s.ui.planning);
    const via = useAppSelector((s) => s.ui.planVia);
    const planner = usePlanner(lang === "de" ? "de" : "en");
    const [planStart, setPlanStart] = useState("");
    /** Where «point on the map» was tapped, once it has been. */
    const [planFrom, setPlanFrom] = useState<[number, number] | null>(null);

    const parkName = useCallback(
        (key: string) => longText(parks[key], "name", lang) ?? key,
        [parks, lang],
    );

    /**
     * The chosen crag, whether or not the filters let it through.
     *
     * `selected` comes out of the filtered list, which is right for the card's figures but wrong
     * for everything about where the crag *is*: a crag revealed from a bookmark, from the
     * favourites, or with a grade filter on is not in `shown` at all, and the map would simply
     * never go there.
     */
    const target = useMemo<Crag | null>(
        () => selected?.crag ?? (selectedId ? (byId[selectedId] ?? null) : null),
        [selected, selectedId, byId],
    );

    /**
     * The box the open crag needs: the wall and the ways to it.
     *
     * Computed here, in the same render the crag is chosen, rather than reported back by the layer
     * that draws the lines. Reported, it arrived a render late, so the map fitted the whole region
     * first and lurched to the crag afterwards -- the zoom-out people saw on every tap.
     */
    const cragSpan = useMemo<Span | null>(
        () => (target ? approachSpan(target, parks) : null),
        [target, parks],
    );

    /** The whole region, for when no crag is open. The crag's own fit lives in the call-out. */
    const regionSpan = useMemo<Span | null>(() => {
        if (target) return null;
        const box = bboxOf(
            shown
                .filter((m) => m.crag.lat != null && m.crag.lon != null)
                .map((m) => [m.crag.lat!, m.crag.lon!] as const),
            0.01,
        );
        return box ? { south: box[0], west: box[1], north: box[2], east: box[3] } : null;
    }, [shown, target]);

    /**
     * Choose a crag on the map -- and, when its page is open beside the map, move the page too.
     *
     * From a bare map this only selects, because the call-out is meant to be a stop on the way
     * rather than a jump to the page. But once the page is open it is the page that says which crag
     * is current, so a tap on another marker has to move it, exactly as a tap on a row in the list
     * does (`CragCard`). Only when it is another crag: tapping the open crag's own marker brings
     * its put-away card back, and must not push a second history entry for the page already there.
     */
    const choose = useCallback(
        (id: string) => {
            dispatch(uiActions.select(id));
            if (routeCragId && routeCragId !== id) void navigate(`/crag/${id}`);
        },
        [dispatch, navigate, routeCragId],
    );

    const onSelect = useCallback((crag: Crag) => choose(crag.id), [choose]);

    /**
     * A car park was tapped: put the crag's card away, then open the car park's.
     *
     * Leaflet keeps one popup open, so opening the car park's card used to close the crag's -- and
     * closing the crag's card is the viewer letting the crag go. The crag was deselected, its
     * approach was taken off the map, and the car park that had just been tapped went with it,
     * leaving its card pointing at nothing. Hiding the crag's card first keeps the crag chosen, the
     * way a tap on open country does with a crag's page open: the marker stays picked out, the
     * approach and the car park stay drawn, and a tap on the crag brings its card back.
     */
    const openParkCard = useCallback(
        (key: string) => {
            dispatch(uiActions.hideCallout());
            setOpenPark(key);
        },
        [dispatch],
    );

    /**
     * The viewer is done with the card: a tap on open country, or Escape.
     *
     * With the crag's page open beside the map this only puts the card away. Letting the crag go
     * would leave the page showing one crag and the map showing none, and `CragPage` would select
     * it again on its next pass anyway. The marker stays picked out and the approach stays drawn --
     * which is the whole point of a tap on the map there: to see what the card was covering.
     */
    const letGo = useCallback(() => {
        dispatch(routeCragId ? uiActions.hideCallout() : uiActions.select(null));
    }, [dispatch, routeCragId]);

    /**
     * Move the map if it was asked to, then show the card -- the original's `selectOnMap`.
     *
     * Every camera move the chosen crag causes happens here and nowhere else, because the card's
     * own auto-pan and a move running at the same time fight each other. So the move goes first,
     * with room kept free for the card on the side the card will be, and the card opens once the
     * map has stopped.
     *
     * Whether it moves at all is `cameraPlan`'s decision, and it turns on one thing: was this a
     * *reveal* -- a row in the list, «auf der Karte zeigen», a link straight to a crag -- or just
     * a tap on a marker that was on the screen all along. Only the first may move the ground under
     * the viewer. That used to be decided by `inView` alone, which asks whether the whole approach
     * is already framed, and at the region's own zoom the answer is always no: every tap panned and
     * zoomed somewhere unasked-for.
     */
    const deferCallout = useCallback<NonNullable<CragCalloutProps["defer"]>>(
        (map, card, open) => {
            // Whatever happens below, this reveal is spent. A nonce left unconsumed would move the
            // map on the next unrelated render.
            const asked = revealNonce !== applied.current;
            applied.current = revealNonce;

            const coord = target?.coord;
            if (!cragSpan || !coord) {
                open(CALLOUT_FALLBACK.below);
                return;
            }

            // Before anything is measured or planned. The crag column mounts in the same commit as
            // a tap on a row in the list, so Leaflet is still holding the old width -- and
            // `invalidateSize` fires `moveend` itself, synchronously, which is the other reason it
            // cannot come later.
            map.invalidateSize({ animate: false });

            const size = map.getSize();
            const place = placeCallout(coord, cragSpan, size, card);
            const plan = cameraPlan({
                reveal: asked,
                calm,
                covered,
                view: viewSpan(map),
                target: cragSpan,
                zoom: map.getZoom(),
            });

            const room = {
                paddingTopLeft: [place.tl[0], place.tl[1]] as [number, number],
                paddingBottomRight: [place.br[0], place.br[1]] as [number, number],
                maxZoom: 17,
            };

            if (plan.kind === "none") {
                // A flight may still be running towards the crag the viewer has just given up on.
                map.stop();
                open(place.below);
                return;
            }

            if (plan.kind === "cut") {
                map.fitBounds(toBounds(cragSpan), { ...room, animate: false });
                open(place.below);
                return;
            }

            map.flyToBounds(toBounds(cragSpan), { ...room, duration: plan.seconds });
            // The flight's own length, not a guess. `moveend` is no use here: `invalidateSize` and
            // the card's auto-pan both fire it too, and either would open the card in mid-air.
            const timer = setTimeout(() => open(place.below), plan.seconds * 1000 + 150);
            return () => {
                clearTimeout(timer);
            };
        },
        [cragSpan, target, calm, covered, revealNonce],
    );

    /** Where an approach may start: this crag's car parks first, then the viewer's own position. */
    const plannerStarts = useMemo(() => {
        const crag = selected?.crag;
        if (!crag) return [];
        const keys = [...new Set([crag.pk, ...(crag.ap ?? []).map((a) => a.pk)])].filter(
            (k): k is string => Boolean(k),
        );
        const out = keys.map((key) => ({
            value: key,
            label: t("pl.from.pk", { 0: parkName(key) }),
        }));
        if (me) out.push({ value: "me", label: t("pl.from.me") });
        // The last resort: start from wherever you tap. The original always offered it.
        out.push({
            value: "map",
            label: planFrom ? t("pl.point") : t("pl.from.map"),
        });
        return out;
    }, [selected, me, parkName, planFrom, t]);

    // Plan as soon as the panel is open and there is both a start and a crag to reach.
    useEffect(() => {
        if (!planning || !selected?.crag.coord) return;
        const from = planStart || plannerStarts[0]?.value;
        if (!from) return;
        if (from !== planStart) setPlanStart(from);

        const park = parks[from];
        const origin: [number, number] | null =
            from === "map"
                ? planFrom
                : from === "me"
                  ? me
                      ? [me.lat, me.lon]
                      : null
                  : park
                    ? [park.lat, park.lon]
                    : null;
        if (!origin) {
            // Asked to start from «my position» and there is none: say so and switch to a tap.
            if (from === "me" && !me) {
                dispatch(uiActions.toast({ message: t("pl.nome") }));
                setPlanStart("map");
            }
            return;
        }

        const wall: [number, number] = [selected.crag.coord.lat, selected.crag.coord.lon];
        planner.plan([origin, ...via, wall]);
        // `planner` changes identity whenever its own state does, so depending on it would loop.
        // What should start a new plan is listed instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planning, selected, planStart, plannerStarts, me, parks, via]);

    /** Ask for a tap on the map, saying why. The original's `pickStart`. */
    const askByHand = (why: string): void => {
        dispatch(uiActions.setPicking(true));
        dispatch(uiActions.toast({ message: `${why} ${t("loc.byhand")}` }));
    };

    const locate = (): void => {
        if (picking) {
            dispatch(uiActions.setPicking(false));
            return;
        }
        if (!navigator.geolocation) {
            askByHand(t("loc.none"));
            return;
        }
        setLocateState("waiting");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocateState("on");
                dispatch(
                    uiActions.setMe({
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        acc: pos.coords.accuracy,
                    }),
                );
                // Far from everything: say so once, instead of flying the map somewhere empty.
                const box = shown
                    .filter((m) => m.crag.lat != null && m.crag.lon != null)
                    .map((m) =>
                        haversine(
                            pos.coords.latitude,
                            pos.coords.longitude,
                            m.crag.lat!,
                            m.crag.lon!,
                        ),
                    );
                const far = box.length ? Math.min(...box) : 0;
                if (far > 40000) {
                    dispatch(
                        uiActions.toast({ message: t("loc.far", { 0: formatDistance(far) }) }),
                    );
                }
            },
            (err) => {
                setLocateState("off");
                askByHand(err.code === err.PERMISSION_DENIED ? t("loc.denied") : t("loc.nofix"));
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const centre = region?.view?.center ?? [44.17, 8.34];
    const zoom = region?.view?.zoom ?? 12;

    return (
        <Box
            sx={{ position: "relative", height: "100%", width: "100%" }}
            // A region that draws its own outline keeps the sea colour under the tiles.
            data-mapbg={region?.outline ? "outline" : "plain"}
        >
            <MapBoundary message={t("map.noLib")}>
                <MapContainer
                    center={[centre[0], centre[1]]}
                    zoom={zoom}
                    className="kat-map"
                    style={{ height: "100%", width: "100%" }}
                    zoomControl={false}
                    attributionControl
                >
                    <TileLayer
                        key={prefs.base + prefs.baseCH}
                        url={base.url}
                        attribution={base.attribution}
                        maxZoom={base.maxZoom}
                        {...(base.subdomains ? { subdomains: base.subdomains } : {})}
                        eventHandlers={{
                            // One tile failing is normal at the edge of a zoom level. The original
                            // only complained when the base map was genuinely not drawing, so this
                            // waits for several failures and gives up the moment one tile arrives.
                            tileerror: () => {
                                tileErrors.current += 1;
                                if (tileErrors.current >= 4 && !tileOk.current)
                                    setTileTrouble(true);
                            },
                            tileload: () => {
                                tileOk.current = true;
                                setTileTrouble(false);
                            },
                        }}
                    />
                    {inSwitzerland && prefs.chTrails && (
                        <TileLayer
                            url={CH_OVERLAYS.trails.url}
                            attribution={CH_OVERLAYS.trails.attribution}
                            maxZoom={CH_OVERLAYS.trails.maxZoom}
                            opacity={0.9}
                        />
                    )}
                    {inSwitzerland && prefs.chWrz && (
                        <TileLayer
                            url={CH_OVERLAYS.wrz.url}
                            attribution={CH_OVERLAYS.wrz.attribution}
                            maxZoom={CH_OVERLAYS.wrz.maxZoom}
                            opacity={0.6}
                        />
                    )}

                    <RadarLayer
                        kind={radar.kind}
                        frames={radar.frames}
                        index={radar.index}
                        onError={radar.onLayerError}
                    />

                    <AllPathsLayer shown={shown} selectedId={selectedId} enabled={prefs.allPaths} />
                    {region && <MapLabels labels={region.labels} />}
                    <ParkMarkers
                        parks={parks}
                        parkName={parkName}
                        enabled={prefs.allParks}
                        onParkClick={openParkCard}
                    />

                    <CragMarkers
                        shown={shown}
                        selectedId={selectedId}
                        favourites={favourites}
                        weatherOf={stateOf}
                        onSelect={onSelect}
                    />

                    <MapResize />

                    <ApproachLayer
                        crag={target}
                        parks={parks}
                        parkName={parkName}
                        onParkClick={openParkCard}
                    />

                    {me && (
                        <Marker
                            position={[me.lat, me.lon]}
                            title={me.manual ? t("loc.you.manual") : t("loc.you")}
                            icon={meIcon(me.manual === true)}
                        />
                    )}

                    <CragCallout
                        crag={calloutOpen ? target : null}
                        parks={parks}
                        inCount={selected?.inCount ?? null}
                        distance={target ? (ctx.distance?.(target) ?? null) : null}
                        defer={deferCallout}
                        revision={revealNonce}
                        onOpen={(id) => void navigate(`/crag/${id}`)}
                        onClose={letGo}
                        onHide={() => dispatch(uiActions.hideCallout())}
                    />

                    <PointCallout inSwitzerland={inSwitzerland} />

                    <ParkCallout
                        parkKey={openPark}
                        parks={parks}
                        crags={shown.map((m) => m.crag)}
                        onSelect={(crag) => {
                            setOpenPark(null);
                            choose(crag.id);
                        }}
                        onClose={() => setOpenPark(null)}
                    />

                    <PlannedRoute
                        result={planner.result}
                        via={via}
                        onViaRemove={() => dispatch(uiActions.clearVia())}
                        viaTitle={t("pl.via.t")}
                    />

                    <BackgroundClick
                        onClick={(latlng) => {
                            if (planning && planStart === "map" && !planFrom) {
                                setPlanFrom([latlng.lat, latlng.lng]);
                                return;
                            }
                            if (picking) {
                                dispatch(
                                    uiActions.setMe({
                                        lat: latlng.lat,
                                        lon: latlng.lng,
                                        acc: 0,
                                        manual: true,
                                    }),
                                );
                                dispatch(uiActions.setPicking(false));
                                setLocateState("on");
                                return;
                            }
                            // The same gesture as the card closing itself: Leaflet shuts the popup
                            // on a map click too, so both ends have to agree, or one would undo
                            // what the other just did.
                            letGo();
                        }}
                    />
                    <FitBounds span={regionSpan} />
                </MapContainer>
            </MapBoundary>

            {tileTrouble && (
                <Alert
                    severity="warning"
                    data-testid="tile-trouble"
                    onClose={() => setTileTrouble(false)}
                    sx={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        right: 56,
                        zIndex: 500,
                        // A warning is not a lid. This one appears exactly when the tiles do not
                        // -- offline, under a cliff, which is the app's own case -- and it lies
                        // across the top of the map, over whatever markers are up there. They
                        // then cannot be tapped at all, and a tap that goes down on a marker and
                        // comes up on the warning reaches neither: Leaflet never hears the click,
                        // and the crag simply does not open. So the map keeps its taps and the
                        // warning keeps only the button that puts it away.
                        pointerEvents: "none",
                        "& .MuiAlert-action": { pointerEvents: "auto" },
                    }}
                >
                    {region?.outline ? t("map.blocked") : t("map.baseFail", { 0: baseName })}
                </Alert>
            )}

            <RadarBar
                kind={radar.kind}
                frames={radar.frames}
                index={radar.index}
                playing={radar.playing}
                onPlay={radar.setPlaying}
                loading={radar.loading}
                failed={radar.failed}
            />
            <MapControls
                inSwitzerland={inSwitzerland}
                locate={locate}
                locateState={locateState}
                picking={picking}
            />
            {planning && selected && (
                <PlannerPanel
                    crag={selected.crag}
                    starts={plannerStarts}
                    start={planStart}
                    onStart={setPlanStart}
                    busy={planner.busy}
                    error={planner.error}
                    result={planner.result}
                    picking={planStart === "map" && !planFrom ? "start" : null}
                    hasVia={via.length > 0}
                    onAddVia={() => dispatch(uiActions.toast({ message: t("pl.tap.via") }))}
                    onClearVia={() => dispatch(uiActions.clearVia())}
                    onClose={() => {
                        dispatch(uiActions.setPlanning(false));
                        setPlanFrom(null);
                        planner.clear();
                    }}
                    onOpenCrag={() => void navigate(`/crag/${selected.crag.id}`)}
                />
            )}
            <MapLegend />
        </Box>
    );
};
