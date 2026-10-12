# Chlädderi

[![Try it now](https://img.shields.io/badge/Try%20it%20now-Chl%C3%A4dderi-28157a?style=for-the-badge&logo=googlemaps&logoColor=white)](https://chlädderi.ch/)
[![Deploy to GitHub Pages](https://github.com/Chlaedderi/chlaedderi/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/Chlaedderi/chlaedderi/actions/workflows/pages.yml)

A map and list of sport-climbing crags – an app for your homescreen, in German and English, with car parks, approach paths, navigation to the car park, route lengths, weather, rain and drying information, a logbook and favourites that really do stay saved. The crags themselves arrive as a **mappack**: one file per region, which you load into the app and unload again.

**To the app: <https://chlädderi.ch/>**

Freshly installed, the app brings a **showcase** with it: a handful of crags to try it out on. Everything else comes through *mappacks*. The bar at the top switches between the loaded regions; every filter applies within the region you have chosen. This repository holds the app and the format – the crag data itself is not part of it.

Grown out of a single-pitch atlas for one single region.

## On the homescreen

- **iPhone/iPad:** open the address in Safari → Share → *Add to Home Screen*.
- **Android:** open the address in Chrome → menu ⋮ → *Install app* (or, in the app: *More → Install as app*).

The app starts without a network connection afterwards. Map tiles you have looked at once stay available offline.

## What the app does

- **Map:** a double-click or double-tap zooms in at that spot (shift + double-click zooms out). Tapping a crag shows its approach and car park. *Open crag* leads to the crag page, *Directions* starts Google Maps with the route from your position to the car park. The crag page offers the same navigation with Google Maps and, on Apple devices, with Apple Maps.
- **Crag page:** a header with the grade distribution, tiles with the essentials at a glance, and a bar that jumps straight to approach, topos, routes, rain, logbook and details. The routes are numbered and the grade is coloured by grade band. Where the order at the wall is known, the number is the position at the wall from left to right; otherwise it is the position in the route list. The number stays with the route when you sort. The crag page shows no source references.
- **Bolting:** where it is explicitly described, the crag page shows whether the bolting is close/good or spaced and whether the bolts are new or old – with the wording. The *Bolting* filter finds closely bolted or re-bolted crags, or hides the spaced and old ones. Most crags carry no such information.
- **Filters:** grade, stars, approach, aspect, bolting, rain, route length and more. Grade and stars apply to the same route – so "at least 3 routes from 6a to 6c+ with ★★★★ or more" finds crags where such routes really exist. The *Matching routes* sort order puts the most rewarding crags on top.
- **Rain:** in the map menu (the layers button), under *Rain radar*, show the radar of the last 2 hours (animated) or the newest, sharper image from the Italian Protezione Civile. At the crags, drops show where it is raining right now, where the rock is probably still wet, and where rain is expected soon. The *Dry now* filter (also under *Filters → Rain*) hides everything else, and every crag page shows the rain of the last and next 24 hours.
- **Switzerland:** for a mappack that lies in Switzerland, the swisstopo national map (or the swisstopo aerial image) serves as the map background, with the official hiking trails on top. Under *swisstopo layers* the hiking trails and the wildlife quiet zones (FOEN) can be switched on and off. Each region remembers its own background.
- **Weather per crag:** in the *Weather* section, the crag page shows seven days with a symbol, highest and lowest temperature, rain with its probability, sunshine and wind; tapping a day shows the values every 3 hours and the zero-degree level. In Switzerland the values come from MeteoSwiss's ICON-CH1/CH2 model and apply to the height of the wall (swisstopo elevation model). The rain status and the *Dry now* filter use the MeteoSwiss model there as well.
- **Planning the approach (Switzerland):** *Plan on swisstopo trails*, in the approach section, finds the way from the car park (or from your own position, or from a point on the map) to the wall over the swisstopo hiking trails. It shows length, ascent and descent, walking time there and back, an elevation profile, and the share of hiking trail, mountain trail, alpine trail and trackless ground. Start, end and via points can be moved on the map; the route is available as a GPX file.
- **Dries fast:** an estimate from sun and aspect (sunny south faces dry fast, shaded north faces slowly). The app marks it as an estimate; where wet rock is explicitly reported, that information wins.
- **Logbook:** tap ⊕ on any route and enter the date, the style (onsight, flash, redpoint, toprope, attempt) and your own stars. The *Logbook* page shows figures, the hardest routes and every entry, and exports them as a CSV file. The *My logbook* filter finds crags with routes still open.
- **Good to know** (under *More*): a grade converter (French, UIAA, USA, Great Britain, Australia, Saxony, Scandinavia), records from the loaded data, and whatever facts and glossary the mappack brings with it.

## Mappacks: loading and unloading regions

The crag data does not sit inside the app but in **mappacks**: one JSON file per region with the crags, routes, car parks and areas – and with the texts belonging to that region (rock, guidebooks, source pages, facts, glossary). The app itself knows no region; it shows what has been loaded.

- **Loading:** tap the **+** next to the region bar (or *More → Regions*). There you can enter an address or choose a file from the device. The showcase steps aside as soon as the first pack of your own is loaded, and comes back when the last one is unloaded.
- **Offline:** a loaded pack lives in the browser's cache storage (`chlaedderi-packs`) and is there without a network too. *Refetch* loads the same address once more when there is newer data. Loaded packs apply to every window; other tabs follow.
- **Unloading:** frees the space again. **Favourites and the logbook stay** – they hang off crag and route keys and reappear as soon as the pack is back. The favourites page says how many entries currently belong to a region that is not loaded.
- **Addresses elsewhere** must allow CORS. The app checks every pack before it accepts it, and says in plain words what it is missing; nothing from a pack is ever inserted as HTML.

### Making your own mappack

The format is described in [`mappack.schema.json`](mappack.schema.json) (JSON Schema 2020-12):

- **Required:** `format`, `formatVersion`, `id` (which becomes the region key), `name` in German and English, `version`, and the crags in `sectors`.
- **Data:** `areas`, `parks` (car parks), `picSrc` (picture sources), `labels` (place names for the map), `outline` (GeoJSON beneath the tiles), `stats`, `counts`, `view` and `bbox`.
- **Switches:** `ch` (Switzerland: swisstopo maps and hiking trails, MeteoSwiss, the approach planner), `partial` (showcase).
- **Texts** in `text`: `rock` (the region's rock), `guide` (the guidebook line), `guideRef`, `noPics`, `links` (what a crag's links are called), `licence`, `pages` (your own pages under *More*), `facts` and `glossary`. Inside these texts `**bold**` and `[text](https://…)` apply, and nothing else.
- A pack may bring unknown fields with it – an older app passes over them.

`maps/` holds two packs. `maps/pack.showcase.json` is the showcase, which the build compiles into the app, and `maps/pack.testing.json` is an invented region the tests and the browser suite run on. The real regions are not here: they live in the private `Chlaedderi/maps` repository, and `packs` links them in for whoever has access to it. Everything in this repository builds, tests and lints without them.

`tools/make-packs.sh` checks every pack in `maps/`: the format, unique crag ids, resolvable car-park and area references, picture sources, counts, and that no crag sits in two packs. `--check` writes nothing. Two of its checks can only mean something where all the regions are, which is the private repository: that no crag id turns up in two regions, and that the showcase really is a slice of the region it was cut from. With only the two packs here the second one reports `skip`, not `ok`.

Cutting a new showcase is therefore done in `Chlaedderi/maps`, and the result arrives here as a pull request — it is the one thing that crosses between the two repositories. Schema validation of what *is* here runs on every push in [`ci.yml`](.github/workflows/ci.yml).

## Backing up favourites and the logbook

Favourites and the logbook are stored three times over on the device and read back after every save. The *Favourites* and *Logbook* pages say whether saving worked.

Important on the iPhone: the homescreen app and Safari have **separate** storage. What you saved in Safari does not appear in the homescreen app by itself. For that there is the *Back up and transfer* section under *Favourites* and under *Logbook*, with a code that holds both: in one app *Copy code*, in the other paste it and *Add from code*. This works between two devices as well.

Before you delete the icon from the homescreen, copy the code: on the iPhone, deleting the icon usually takes this app's storage with it. It is worth putting the code into a note now and then.

## Updating

The app is built from `src/`. The way is: change `src/`, commit, push to `main` – the deploy builds the app itself. `build` writes it into `dist/` for looking at it locally; `dist/` is not in the repository, and neither are `index.html`, `sw.js`, `workbox-*.js` and `assets/`, which used to lie in the main folder. A git hook builds before every commit, so a change that does not build never reaches a branch; more on that under *Development*.

The build output was committed until October 2026, so that the published bytes could be read in the repository. Every pull request then conflicted with every other one, because each build gives `index.html` ten new content hashes and writes `sw.js` as a single 100 KB line that no merge can resolve. The bytes are still readable: the `gh-pages` branch is a commit of exactly what is served, and every pull request carries a preview of itself.

Uploading through **Add file → Upload files** in the browser therefore no longer works: the app in the browser is built, and the source it is built from is `src/`.

The workflow sets the version number itself on every publication (date + commit) and writes it into `version.json`. There is no version number in the app itself: only that way does the same source build the same thing twice, so that a preview and the deployed app can be compared at all.

The app notices at startup, and whenever it comes back to the foreground (at most every 30 minutes), that a newer version has been published, and offers *Reload*. Under *More → App* you find the running version, and *Load newest version* fetches the app files afresh at any time – favourites, logbook, settings and filters are kept. The app fetches the new version at the next start with a network by itself – it is there by the second opening at the latest. Favourites, logbook and settings are kept.

The name under an icon already sitting on the homescreen does not change by itself on the iPhone. To see the new name «Chlädderi» there: copy the code (see above), delete the icon, add the page to the home screen from Safari again, paste the code back.

## Publishing (GitHub Pages)

Every push to `main` starts the [`.github/workflows/pages.yml`](.github/workflows/pages.yml) workflow. It builds the app and publishes it – `index.html`, `sw.js`, `assets/`, the manifest, the icons and `mappack.schema.json` – at <https://chlädderi.ch/>. The status badge above shows whether the last run worked; start one by hand through **Actions → Deploy to GitHub Pages → Run workflow**.

The published files are written to the `gh-pages` branch, which is what Pages serves. That branch carries the app at its root and the preview of every open pull request in a folder of its own, because Pages serves exactly one site per repository. Each publication force-pushes a single commit with no parent onto it – so nothing is ever committed to `gh-pages` by hand, and the screenshots of a pull request do not stay in the repository for ever.

- Needed once: **Settings → Pages → Build and deployment → Source = *Deploy from a branch*, branch `gh-pages`, folder `/ (root)`**.
- GitHub Pages is available for **private** repositories only on a paid GitHub plan (Pro, say). On the free plan GitHub switches Pages off as soon as the repository becomes private: the workflow still writes `gh-pages`, but nothing serves it. The published site itself is public in every case.
- The app files sit on one level, plus `assets/` with the built bundles. [`tools/make-site.sh`](tools/make-site.sh) builds the app, copies `dist/` and then names every other file individually, publishing nothing it does not know about – `package.json`, `tsconfig.json` and `renovate.json` live in the main folder too and do not belong on a public site. The deploy and the previews both go through it, so neither can publish something the other does not.
- The `maps/` folder is **not** published: mappacks are not part of the app. Anyone who wants to offer their own packs puts them where they want them (their own repository, web space, cloud) and enters their address in the app.
- Testing locally: `build` and then `serve`, then open <http://localhost:8000/>. `serve` puts `dist/` in front of the repository folder, which is how the published site is laid out: the built app, with the icons, the manifest and `maps/` beside it. A plain `python3 -m http.server` in the main folder no longer finds an app, because the build is not there. While developing, `dev` is more convenient. The service worker, the cache storage for the mappacks and loading a pack from an address only work over `http(s)://`, not by opening the file directly.

### Previews of pull requests

[`.github/workflows/preview.yml`](.github/workflows/preview.yml) publishes every pull request of this repository at `https://chlädderi.ch/pr-<number>/` and the screenshots of every screen beside it under `pr-<number>/screens/`, and says so in a comment on the pull request. The folder goes again when the pull request closes; [`prune-previews.yml`](.github/workflows/prune-previews.yml) sweeps up weekly whatever that misses.

- A preview keeps **its own** favourites, logbook, settings and mappacks. Browser storage belongs to the host, not to the folder, so without that an unfinished branch could damage the data of the app itself – every storage name carries a suffix under `/pr-<number>/` (`src/core/preview.ts`).
- A pull request **from a fork gets no preview**: it runs the branch's own code, which must not be able to write to this repository. Everything else about it is checked as usual.
- A preview does not work offline. It is there to be looked at, not to be taken along.

### Your own copy

1. Fork this repository (the workflows come along).
2. Push a commit to `main`, or start the workflow by hand: that writes the `gh-pages` branch, which does not exist before the first run.
3. **Settings → Pages → Source = *Deploy from a branch*, branch `gh-pages`, folder `/ (root)`**. The app then runs at `https://<GitHub name>.github.io/<name of the repository>/`.

## Files

| File | Purpose |
| --- | --- |
| `src/` | **the source of the app** (TypeScript, React, Material UI) |
| `dist/` | **built** by `build`, not in the repository – `index.html`, `sw.js`, `workbox-*.js` and `assets/`, i.e. the published app |
| `mappack.schema.json` | the format of a mappack (JSON Schema); the types and the check in the app come from it |
| `maps/pack.showcase.json` | the showcase; the build puts it into the app |
| `maps/pack.testing.json` | an invented region: what the tests and the browser suite run on |
| `tools/get-packs.sh` | links the real regions in from the private `Chlaedderi/maps` (`packs`) |
| `tools/make-packs.sh` | checks the mappacks and cuts a showcase out of a pack |
| `tools/validate-packs.sh` | checks the mappacks against `mappack.schema.json` |
| `tools/build.sh` | type-checks and builds the app into `dist/` |
| `tools/make-site.sh` | collects the files that get published – the same set for the app and for a preview |
| `tools/publish-pages.sh` | writes the `gh-pages` branch: the app, a preview, or neither any more |
| `tools/serve.pl` | a small local server for trying things out: `dist/` first, then the repository |
| `devenv.nix`, `devenv.yaml` | the development environment, git hooks included |
| `package.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.mjs` | the build and the checking tools |
| `manifest.webmanifest` | name, colours and icons for installing |
| `icon-*.png`, `apple-touch-icon.png`, `favicon*` | the app icon in every size needed |
| `.github/workflows/pages.yml` | publishes the app on every push to `main` |
| `.github/workflows/preview.yml` | publishes every pull request at `pr-<number>/`, screenshots included |
| `.github/workflows/prune-previews.yml` | drops the previews of pull requests that are no longer open |
| `.github/workflows/ci.yml` | runs every check |

## Development

The environment sits in [`devenv.nix`](devenv.nix). With [devenv](https://devenv.sh/) and [direnv](https://direnv.net/):

```sh
direnv allow     # or: devenv shell
devenv-help      # shows what there is
```

After that the following are available:

| Command | What it does |
| --- | --- |
| `dev` | development server with live reload (<http://localhost:5173/>). Serves `maps/` as well, so a pack can be loaded locally over an address. |
| `build` | type-checks and builds the app into `dist/` (which is not in the repository) |
| `test` | the unit tests (Vitest) |
| `e2e` | the browser tests (Playwright) – against the built app, with every outside service intercepted |
| `screens` | puts every screen into `.screens/` as an image, to look at |
| `lint` | every git hook over the whole repository |
| `serve` | serves the built app over http (the service worker needs `http(s)://`) |
| `packs` | links the real regions in from the private `Chlaedderi/maps`; says one line and carries on without access |
| `check-packs` | checks the mappacks against the schema and against each other |
| `make-packs` | the same, and cuts a showcase out of a pack on request |

Checking happens on three levels: unit tests for the logic, browser tests for everything you can
only see (the map, the service worker, a button sitting behind the navigation bar), and
`src/parity.test.ts` – a list of every feature of the version before the rewrite, naming the
module that carries it today. If one falls away, the test falls.

The hooks run before every commit: whitespace, `shellcheck`, `actionlint`, `yamllint`, `markdownlint`, spelling, secrets – and for the app `prettier`, `eslint`, `tsc` and the tests. Plus two that exist for this repository in particular:

- **The mappacks** are checked twice over: `tools/validate-packs.sh` takes every pack against `mappack.schema.json`, `tools/make-packs.sh --check` checks them against each other (counts, car-park and area references, no crag in two packs).
- **The build** runs along with them: the app has to come out, which `tsc` alone does not show – a bad import path or a plugin that throws only turns up when it is bundled. Nothing of the result lands in the repository; it stays in `dist/`, where the browser tests then find it.

Where things live:

```text
src/core/      logic with no interface: packs, filters, grades, logbook, storage – with tests
src/types/     mappack.ts mirrors the schema, model.ts is what the app works with
src/features/  the interface, by subject: map, list, crag, logbook, packs, more, know
src/app/       state (Redux) and the loaded packs (context)
src/i18n/      the interface texts in English and German, the same keys in both
```

What a mappack brings in words – the rock's name, the guidebook note, whole pages, fun facts, a glossary – is unknown to the app; it only shows what the pack says. Pack text never becomes HTML: `src/core/text.ts` returns tokens, which React inserts.

## Data and limits

What a mappack says is that pack's responsibility: it brings its own source and licence notes with it (*More → About* and the pages under *More → About the data*). For the app itself:

- **Approach paths** are computed (BRouter on OpenStreetMap data or, in Switzerland, the swissTLM3D hiking trails) and not checked on site. Car parks with a pale, outlined P are estimated.
- **Dries fast** is an estimate from sun and aspect and is marked as such in the app; where a source says otherwise, the source wins.
- **Rain and weather** are **model values** from [Open-Meteo](https://open-meteo.com/) (grid about 1 km, hourly, 2 days back and 2 days ahead) – not a measurement at the wall; a model often misses thunderstorms. "Dry now" means: no rain now, none expected in the next 6 hours, and less than 1 mm over the time the wall is estimated to need for drying (12 h fast, 24 h medium, 48 h slow). The values are fetched again every 30 minutes and never cached for offline use.
- **Switzerland:** the ICON-CH1/CH2 model from [MeteoSwiss](https://www.meteoswiss.admin.ch/) (1–2 km, around 5 days), queried through Open-Meteo. Days 6–7 and the rain probability come from Open-Meteo's standard models. The temperatures apply to the height of the wall, from swisstopo's elevation model.
- **Approach planner (Switzerland):** the path network from the swissTLM3D hiking trails (through api3.geo.admin.ch), heights from swisstopo's elevation model, walking time by the formula of the Swiss hiking trails association, without breaks. Climbers' paths to the wall are usually not in the network; those stretches are dotted (straight line) and are to be checked on site. If the hiking trails cannot be reached, the planner computes with BRouter on OpenStreetMap and says so.
- **Rain radar:** [RainViewer](https://www.rainviewer.com/) (free of charge, since 2026 only up to zoom level 7, hence enlarged and rather blurred) and [Radar-DPC](https://radar.protezionecivile.it/) from the Italian Protezione Civile (1 km, every 5 minutes). If Radar-DPC fails, the app switches over to RainViewer.
- **Grade conversion** is an approximation: the scales do not measure quite the same thing, and published tables differ from each other by about one step.
- The **Google Maps button** opens the Google Maps app on the iPhone. If it is not installed, the app offers the link in the browser after a moment.
- The app is no replacement for a guidebook. Always check closures and the state of the bolts on site.

Grade tables: Mountain Project (International Climbing Grade Comparison Chart) and Bergfreunde.de. Maps: OpenTopoMap, OpenStreetMap contributors, Esri; in Switzerland © swisstopo (national map, aerial image, hiking trails, elevation model) and wildlife quiet zones FOEN/cantons. Weather: Open-Meteo.com (CC BY 4.0); in Switzerland MeteoSwiss ICON-CH1/CH2 (CC BY 4.0). Radar: RainViewer; Radar-DPC, Dipartimento della Protezione Civile (CC BY-SA 4.0). Map library: Leaflet (BSD-2-Clause), Leaflet.markercluster (MIT).

The repository names no licence (yet). So before redistributing it publicly, do ask first. Improvements are welcome straight into this repository or as a pull request.
