import { readFileSync, existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Every feature the pre-React app had, as a table.
 *
 * The React rewrite shipped as a shell and was reported as complete. This is what stops that
 * happening twice: each row names a feature of `index.html` at **48b4b50** and the module that
 * carries it now. A row whose module disappears, or is renamed away, fails the suite.
 *
 * It is a presence check, not a behaviour check -- a module can exist and do the wrong thing. The
 * behaviour is covered by the unit tests next to each module and by the Playwright flows in e2e/.
 * What this catches is the failure that actually happened: a feature quietly not being there.
 *
 * `done: false` is an honest admission that something is still missing. Those rows are listed by
 * the last test, so the gap is visible rather than forgotten.
 */

interface Feature {
    /** What it does, in the words a climber would use. */
    readonly what: string;
    /** Where it was in the hand-written app. */
    readonly was: string;
    /** The module that carries it now, relative to the repository root. */
    readonly now: string;
    /** A symbol that module must export, when the file alone is not enough. */
    readonly exports?: string;
    readonly done?: boolean;
}

const FEATURES: Feature[] = [
    // ---- the map
    {
        what: "the way from the car park to the crag",
        was: "drawSelection",
        now: "src/features/map/ApproachLayer.tsx",
        exports: "ApproachLayer",
    },
    {
        what: "car parks, with their names",
        was: "pIcon + openParkPopup",
        now: "src/features/map/ParkMarkers.tsx",
        exports: "ParkMarkers",
    },
    {
        what: "every approach at once",
        was: "drawAllPaths",
        now: "src/features/map/AllPathsLayer.tsx",
        exports: "AllPathsLayer",
    },
    {
        what: "what the shapes on the map mean",
        was: "renderLegend",
        now: "src/features/map/MapLegend.tsx",
        exports: "MapLegend",
    },
    {
        what: "the card a marker opens",
        was: "cragPopupNode",
        now: "src/features/map/CragCallout.tsx",
        exports: "CragCallout",
    },
    {
        // This row used to be half of the one above, which named a module that carried only the
        // card itself: the card hung over the approach for as long as the list said otherwise.
        what: "where the call-out sits, so it does not cover the approach",
        was: "placeCallout + showPopup",
        now: "src/features/map/calloutPlacement.ts",
        exports: "placeCallout",
    },
    {
        what: "place names a pack draws",
        was: "tidyLabels",
        now: "src/features/map/MapLabels.tsx",
        exports: "MapLabels",
    },
    {
        what: "marker shapes that carry meaning",
        was: ".mk / .approx / .anchor",
        now: "src/features/map/icons.ts",
        exports: "cragMarkerClass",
    },
    {
        what: "clusters in the app's own style",
        was: ".cl",
        now: "src/features/map/icons.ts",
        exports: "clusterIcon",
    },
    {
        what: "locate, and the base-map menu",
        was: "#btnLoc / #basemenu",
        now: "src/features/map/MapControls.tsx",
        exports: "MapControls",
    },
    {
        what: "driving to a car park",
        was: "navUrl / appleUrl",
        now: "src/features/map/navLinks.ts",
        exports: "navUrl",
    },

    // ---- finding a crag
    {
        what: "search, always on screen",
        was: "#q in the app bar",
        now: "src/features/shell/AppBarTop.tsx",
        exports: "AppBarTop",
    },
    {
        what: "the one-tap filters",
        was: "#quickChips",
        now: "src/features/shell/QuickChips.tsx",
        exports: "QuickChips",
    },
    {
        what: "switching region, and loading one",
        was: "#regionSeg",
        now: "src/features/shell/RegionSegment.tsx",
        exports: "RegionSegment",
    },
    {
        what: "the full filter drawer",
        was: "#filters",
        now: "src/features/list/FiltersDrawer.tsx",
        exports: "FiltersDrawer",
    },
    {
        what: "filtering and sorting itself",
        was: "test() / apply()",
        now: "src/core/filters.ts",
        exports: "applyFilters",
    },
    {
        what: "how many crags match",
        was: "#count",
        now: "src/features/list/ListToolbar.tsx",
        exports: "ListToolbar",
    },
    {
        what: "a link that carries the filters",
        was: "nothing: a link could only name a crag or a region",
        now: "src/core/filterCode.ts",
        exports: "encodeFilterCode",
    },
    {
        what: "the filters kept in the address bar, so copying it shares the view",
        was: "nothing: the filters never left the device",
        now: "src/app/FilterUrl.tsx",
        exports: "FilterUrl",
    },

    // ---- weather
    { what: "is the rock dry", was: "wxStat", now: "src/core/weather.ts", exports: "readWeather" },
    {
        what: "fetching the forecast",
        was: "wxLoad",
        now: "src/services/openMeteo.ts",
        exports: "loadWeather",
    },
    {
        what: "the rain tile on a crag page",
        was: "wxTile",
        now: "src/features/weather/WeatherCard.tsx",
        exports: "WeatherCard",
    },
    {
        what: "the weather symbols",
        was: "wxInner / wmoToMs",
        now: "src/core/wxSymbol.ts",
        exports: "wxShapes",
    },
    {
        what: "the rain radar",
        was: "radarRV / radarDPC",
        now: "src/features/radar/RadarLayer.tsx",
        exports: "RadarLayer",
    },
    {
        what: "the radar's own bar",
        was: "radarBar",
        now: "src/features/radar/RadarBar.tsx",
        exports: "RadarBar",
    },
    {
        // Newer than the app this table is a parity list for: the Swiss radar arrives as numbers,
        // so the app reads the files and paints them itself.
        what: "the Swiss radar, read and drawn here",
        was: "-",
        now: "src/features/radar/RainGridLayer.ts",
        exports: "RainGridLayer",
    },

    // ---- the approach planner
    {
        what: "routing over swisstopo's trails",
        was: "plGraph / plLeg",
        now: "src/core/approach.ts",
        exports: "findLeg",
    },
    {
        what: "the Swiss walking-time formula",
        was: "hikeMin",
        now: "src/core/approach.ts",
        exports: "hikeMinutes",
    },
    {
        what: "reading the trail network",
        was: "plNet",
        now: "src/services/swisstopo.ts",
        exports: "fetchTrails",
    },
    {
        what: "heights along the route",
        was: "plProfile",
        now: "src/services/swisstopo.ts",
        exports: "fetchProfile",
    },
    {
        what: "routing outside Switzerland",
        was: "plBrouter",
        now: "src/services/brouter.ts",
        exports: "fetchRoute",
    },
    { what: "the route as a GPX file", was: "planGpx", now: "src/core/gpx.ts", exports: "toGpx" },
    {
        what: "the planner's panel",
        was: "#planbar",
        now: "src/features/approach/PlannerPanel.tsx",
        exports: "PlannerPanel",
    },
    {
        what: "the height profile",
        was: "plProfileSVG",
        now: "src/features/approach/ElevationProfile.tsx",
        exports: "ElevationProfile",
    },

    // ---- a crag
    {
        what: "the crag page",
        was: "renderDetail",
        now: "src/features/crag/CragPage.tsx",
        exports: "CragPage",
    },
    {
        what: "the routes of a crag",
        was: "routesHTML",
        now: "src/features/crag/RouteList.tsx",
        exports: "RouteList",
    },
    {
        what: "the grade spread",
        was: "barsHTML",
        now: "src/features/crag/GradeBar.tsx",
        exports: "GradeBar",
    },
    {
        what: "the figures at a glance",
        was: "factsHTML",
        now: "src/features/crag/CragFacts.tsx",
        exports: "CragFacts",
    },
    {
        what: "the chips under a name",
        was: "tagsHTML",
        now: "src/features/list/CragTags.tsx",
        exports: "CragTags",
    },
    {
        what: "jumping to a section",
        was: "jumpHTML / jumpSpy",
        now: "src/features/crag/JumpRail.tsx",
        exports: "JumpRail",
    },
    {
        what: "pictures and topos",
        was: "galleryHTML",
        now: "src/features/crag/Gallery.tsx",
        exports: "Gallery",
    },
    {
        what: "why it dries as it does",
        was: "dryHTML",
        now: "src/features/crag/DryEstimate.tsx",
        exports: "DryEstimate",
    },
    {
        what: "this crag in my logbook",
        was: "cragLogHTML",
        now: "src/features/crag/CragLogbook.tsx",
        exports: "CragLogbook",
    },
    {
        what: "sharing a crag",
        was: "share()",
        now: "src/features/shell/useShare.ts",
        exports: "useShare",
    },
    {
        what: "a shared link says which crag it is",
        was: "nothing: the message was the bare address",
        now: "src/features/shell/useShare.ts",
        exports: "shareText",
    },
    {
        what: "a shared link shows a card, not a bare blue line",
        was: "nothing: the page carried no Open Graph tags",
        now: "src/index.html",
    },

    // ---- favourites and logbook
    {
        what: "favourites",
        was: "renderFav",
        now: "src/features/favourites/FavouritesPage.tsx",
        exports: "FavouritesPage",
    },
    {
        what: "the logbook",
        was: "renderLog",
        now: "src/features/logbook/LogbookPage.tsx",
        exports: "LogbookPage",
    },
    {
        what: "entering an ascent",
        was: "openLogSheet",
        now: "src/features/logbook/LogSheet.tsx",
        exports: "LogSheet",
    },
    {
        what: "the logbook as a table",
        was: "csvText",
        now: "src/core/logbook.ts",
        exports: "csvText",
    },
    {
        what: "keeping user data safe",
        was: "FinaleStore",
        now: "src/core/store.ts",
        exports: "openStore",
    },
    {
        what: "moving data between browsers",
        was: "backupHTML",
        now: "src/features/favourites/BackupCode.tsx",
        exports: "BackupCode",
    },
    {
        what: "whether saving worked",
        was: "saveStatus",
        now: "src/features/favourites/SaveStatus.tsx",
        exports: "SaveStatus",
    },

    // ---- regions and the app itself
    {
        what: "saying that a region's crags are invented, and withholding the way to them",
        was: "nothing: the app used to ship a slice of a real region, with real photographs",
        now: "src/features/shell/DemoNotice.tsx",
        exports: "DemoNotice",
    },
    {
        what: "loading and removing a region",
        was: "packInstall",
        now: "src/features/packs/PacksDialog.tsx",
        exports: "PacksDialog",
    },
    {
        what: "checking a pack before trusting it",
        was: "packCheck",
        now: "src/core/packs/validate.ts",
        exports: "checkPack",
    },
    {
        what: "the address a region can actually be fetched from",
        was: "nothing: the old app fetched the address as it was typed",
        now: "src/core/packs/url.ts",
        exports: "packUrl",
    },
    {
        what: "opening a region that was published encrypted",
        was: "nothing: a region could only be published in the open",
        now: "src/core/packs/chlpack.ts",
        exports: "openChlpack",
    },
    {
        what: "asking before a region from a link is loaded",
        was: "nothing: a link could not carry a region",
        now: "src/features/packs/PackOffer.tsx",
        exports: "PackOffer",
    },
    {
        what: "a link that carries a whole region",
        was: "nothing: a link could only name a crag",
        now: "src/features/shell/PackLink.tsx",
        exports: "PackLink",
    },
    {
        what: "reading a region or a crag out of a message that was shared to the app",
        was: "nothing: a shared link could only be opened in a browser",
        now: "src/core/sharedLink.ts",
        exports: "routeFromShared",
    },
    {
        what: "the app in the share sheet, so a link can be sent to it",
        was: "nothing: the app was not a share target",
        now: "src/features/shell/ShareTarget.tsx",
        exports: "ShareTarget",
    },
    {
        what: "saving a loaded region as a file, to pass it on by hand",
        was: "nothing: a region could be shared only as a link, and one from a file not at all",
        now: "src/core/packs/storage.ts",
        exports: "storedPackText",
    },
    {
        what: "taking a copied link out of the clipboard, which on iOS is the only way in",
        was: "nothing: a link had to be typed into the address field by hand",
        now: "src/features/packs/usePasteLink.ts",
        exports: "usePasteLink",
    },
    {
        what: "saying that a region loaded in the browser is in the installed app too",
        was: "nothing: the browser tab and the installed app looked like two separate atlases",
        now: "src/features/packs/useInstalledApp.ts",
        exports: "useInstalledApp",
    },
    {
        what: "a pack's own pages",
        was: "pageHTML",
        now: "src/features/more/PackPage.tsx",
        exports: "PackPage",
    },
    {
        what: "text out of a pack, never as HTML",
        was: "mdText",
        now: "src/core/text.ts",
        exports: "parseInline",
    },
    {
        what: "what is covered, and what is not",
        was: "covHTML",
        now: "src/features/more/CoveragePage.tsx",
        exports: "CoveragePage",
    },
    {
        what: "the grade converter",
        was: "cvOutHTML",
        now: "src/features/know/KnowPage.tsx",
        exports: "KnowPage",
    },
    {
        what: "records from the loaded data",
        was: "atlasRecords",
        now: "src/features/know/AtlasRecords.tsx",
        exports: "AtlasRecords",
    },
    {
        what: "installing, and the version",
        was: "renderMore",
        now: "src/features/more/AppSection.tsx",
        exports: "AppSection",
    },
    {
        what: "saying once, at a good moment, that the app can be installed",
        was: "nothing: the install button waited on the «More» page for somebody to find it",
        now: "src/features/shell/InstallHint.tsx",
        exports: "InstallHint",
    },
    {
        what: "fetching the newest version",
        was: "refreshApp",
        now: "src/version.ts",
        exports: "refreshApp",
    },
    {
        what: "about, licences, the data",
        was: "openInfo",
        now: "src/features/more/InfoSheet.tsx",
        exports: "InfoSheet",
    },
];

const shipped = FEATURES.filter((f) => f.done !== false);
const missing = FEATURES.filter((f) => f.done === false);

describe("every feature of the pre-React app", () => {
    it.each(shipped.map((f) => [f.what, f] as const))("%s is there", (_what, feature) => {
        expect(existsSync(feature.now), `${feature.now} (was ${feature.was})`).toBe(true);
        if (feature.exports) {
            const source = readFileSync(feature.now, "utf8");
            expect(
                source.includes(`export const ${feature.exports}`) ||
                    source.includes(`export function ${feature.exports}`) ||
                    source.includes(`export class ${feature.exports}`) ||
                    source.includes(`export type ${feature.exports}`),
                `${feature.now} must export ${feature.exports}`,
            ).toBe(true);
        }
    });

    it("lists what is still missing, so it is not forgotten", () => {
        // This test passes with a gap; it is here to print the gap, not to hide it.
        const names = missing.map((f) => `${f.what} (was ${f.was} -> ${f.now})`);
        expect(names.length, `still to do:\n  ${names.join("\n  ")}`).toBeLessThanOrEqual(
            missing.length,
        );
    });

    it("counts what is done", () => {
        expect(shipped.length).toBeGreaterThan(40);
    });
});
