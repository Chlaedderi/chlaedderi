# Chlädderi

A climbing-crag atlas as an offline-first PWA. German interface (Swiss spelling: **ss**, never **ß**),
English as the second language. Deployed to GitHub Pages at <https://chlädderi.ch/> — which
is `xn--chldderi-2za.ch` wherever a machine does the reading: DNS, the certificate, the
`CNAME` file, the schema's `$id`, and `location.hostname` in the browser. `chlaedderi.ch`
redirects there.

## The things that will bite you

- **The built app is not committed.** `build` writes `index.html`, `sw.js`, `workbox-*.js` and
  `assets/` into `dist/`, and `dist/` is ignored. They used to lie at the repository root and be
  committed, which made every pull request conflict with every other one: a changed source file
  means a new content hash in each of the ten generated lines of `index.html`, and `sw.js` is a
  single 100 KB line holding the precache manifest, so no three-way merge could resolve it. The
  deployed bytes stay reviewable without it — `gh-pages` is by construction a commit of exactly
  what is served, and every pull request carries a preview of itself. `.gitignore` names the four
  old paths, so a stray copy cannot come back: `serve.pl` would serve it in front of the real
  build.

- **`maps/` is deliberately not published.** A mappack is not part of the app; whoever offers one
  hosts it themselves and the viewer enters its address. Do not "fix" `make-site.sh` to copy it.
  The dev server *does* serve it, so that a pack can be loaded from a URL locally.

- **The real regions are not in this repository.** `maps/` holds two packs and only two:
  `pack.showcase.json`, which the build compiles into the app, and `pack.testing.json`, an invented
  region that the unit tests and the browser suite run on. `finale`, `oltre` and `ow` live in the
  private `Chlaedderi/maps`; `packs` (`tools/get-packs.sh`) symlinks them in for whoever has access
  and says one line and carries on for whoever does not. **Nothing in CI may depend on them** --
  a fork's checks and an outside pull request have to be able to go green. Two checks in
  `make-packs.sh` go quiet without them: that no crag id is in two regions, and that the showcase
  really is a slice of the region it came from. The second says `skip`, not `ok`, on purpose; the
  real comparison is made in the private repository, where the data is.

- **The storage names are load-bearing.** `chlaedderi` (namespace), `chlaedderi-user` and
  `chlaedderi-packs` (caches), `chlaedderi:prefs`, `chlaedderi-filters-v2` (items),
  `chlaedderi-tiles-v1`. Every one of them is built from `APP_SLUG` rather than written out, so
  the set cannot drift; `src/core/preview.test.ts` pins each spelling. People have favourites and
  logbooks on their devices under these names — renaming any of them hides that data, with no
  warning and no way back.

- **The app's name lives in `src/core/name.ts`.** `APP_NAME` («Chlädderi») and `APP_SLUG`
  («chlaedderi», for a package name or a download filename) — everything in code reads them from
  there. The files that cannot import, `src/index.html`, `manifest.webmanifest`, `favicon.svg` and
  the two language files, are held to the same string by `src/name.test.ts`, which reads their
  bytes. That test exists because the app once called itself three different things at once —
  one in the title and the manifest, another in the favicon, and nothing at all in `app.name`,
  which no module referenced. It now also fails on any tracked file that spells the name in ASCII
  as anything but `APP_SLUG`, and on any `github.io` host but this one.

- **Nothing from a mappack ever becomes HTML.** `src/core/text.ts` parses the mini-markdown a pack
  may use (`**bold**`, `[label](https://…)` — `http(s)` only) into tokens, and
  `src/features/packs/PackText.tsx` renders them as React children. The tests there are a security
  control, not a nicety.

- **`mappack.schema.json` is the single source of truth** for what a pack may look like. It is
  published, and other people's packs point at its `$id`, so do not reformat it — Prettier is
  scoped away from it for that reason. `src/types/mappack.ts` mirrors it by hand (a generator
  cannot express its `prefixItems` tuples) and `src/types/mappack.coverage.test.ts` fails if the
  two drift apart. `src/core/packs/validate.ts` compiles the same schema with Ajv at runtime.

- **A region may be published encrypted, and that is an addition, never a requirement.** A
  `.chlpack` is gzipped JSON sealed with AES-256-GCM: magic `CHLP`, a version, flags, a 96-bit
  nonce, then the ciphertext, with the first six bytes as the additional authenticated data so a
  changed header fails as a forgery. `src/core/packs/chlpack.ts` reads it; the writing half is in
  the private `Chlaedderi/maps` repository and is never here. The magic is the **only** gate --
  anything without it goes down the plain-JSON path it always went down, a key offered for a plain
  pack is ignored, and a link to one is byte for byte the link it always was. `maps/pack.testing.*`
  and the committed key beside them are fixtures and are meant to be public.

  **What it is not is access control.** The key is in every link it was ever sent in, the
  ciphertext is world-readable on `gh-pages`, and a new publication under a new key takes nothing
  back: the old file is still there under its old key, on purpose, so a link somebody was sent
  keeps working. Pruning that file is the only revocation there is. Do not reason about it as if
  it were anything else.

- **The schema is open on purpose** (`additionalProperties: true`): an older app has to be able to
  ignore fields it does not know. Ajv therefore does not run in strict mode.

- **The pack format is `chlaedderi-mappack`, and changing that string breaks every pack there
  is.** `src/core/packs/validate.ts` checks it before Ajv ever runs, and `loadStoredPack` re-checks
  a pack every time it is read out of the cache — so a changed format string means every region
  anyone has installed stops loading and has to be installed again, on every device, with no
  warning. It has been done once. Do not do it again, and do not move the `$id` or the storage
  names either.

- **The `$id` is the domain in punycode, and that is the last address it gets.** The site is
  «chlädderi.ch»; DNS, certificates, the `CNAME` file and a URI all speak the ASCII form,
  `xn--chldderi-2za.ch`. A `$id` has to resolve for a machine, so it is written the way a machine reads
  it. The domain is also the one part of this that does not belong to GitHub, which is why other
  people's packs are pointed at it rather than at a `github.io` address. Moving it again breaks
  every pack anybody else published; the pack format string and the storage names are in the same
  boat.

- **The custom domain lives in `tools/make-site.sh`, not in Settings.** Setting it in Settings makes
  GitHub commit a `CNAME` file to the publishing branch, and the next deploy throws it away:
  `publish-pages.sh` force-pushes a fresh tree and keeps nothing at the top level but `pr-*/` and
  `packs/`. GitHub's own troubleshooting page warns about exactly this. So the site brings its own,
  and the domain survives every publish.

- **Version numbers are not in the bundle.** The deploy writes `version.json`; the app reads it.
  That keeps the build reproducible: two deploys of the same commit produce the same bundle, which
  is what lets a preview and the deploy be compared at all.

- **The site is a branch, not an artefact.** `gh-pages` carries the app at the root and one folder
  per open pull request (`pr-12/`), because Pages serves exactly one site per repository and the
  previews have to live in it. Every publish force-pushes a single commit with no parent, so never
  commit to that branch by hand, and never point Pages back at an uploaded artefact: an artefact
  replaces the whole site, previews and all. `tools/publish-pages.sh` is the only thing that writes
  it, and `tools/make-site.sh` decides what the published file set is — for the deploy and for a
  preview alike, so the two cannot drift. That includes the build: the app is not committed, so
  `make-site.sh` runs `tools/build.sh` over its own tree, and neither a deploy nor a preview can
  publish bytes nobody built. Both workflows therefore install devenv, like every other job here.
  Two publishes can meet: the push says which commit the
  branch had when it started and is refused if anybody wrote since, and then the work is redone on
  top of theirs. Do not replace that with a shared `concurrency:` group — GitHub keeps one pending
  run per group and **cancels** the one that was waiting, which dropped a deploy of `main` the
  first time this was tried, silently, with every run green.

- **A preview shares the host with the app.** `chlaedderi.github.io` is one origin, so a page at
  `/pr-12/` reaches the same localStorage and the same caches as `/`. Every
  storage name therefore carries `PREVIEW_SUFFIX` (`src/core/preview.ts`), which is empty on every
  page but a preview. `src/core/preview.test.ts` holds each of those names to its historical
  spelling: it is a guard against losing people's data, not a nicety. For the same reason
  `refreshApp` drops only this deployment's own app shell — a preview that unregistered the app's
  service worker would take it offline for somebody standing under a cliff.

- **English in the repository, German in the app.** Everything written about the project — the
  README, `CONTRIBUTING.md`, this file, every comment, test name and commit message — is English.
  What stays German is the product: `src/i18n/de.json`, `dataTranslations.ts`, the page
  description in `src/index.html` and `manifest.webmanifest`, and the data in `maps/`.

- **German is not spell-checked.** `typos` has no German dictionary and flags ordinary words, so
  `devenv.nix` excludes exactly the German files listed above — and nothing else, now that the
  prose is English. Keep new German text out of a file that is checked, or add the file to that
  list.

## Working on it

```sh
direnv allow    # or: devenv shell
devenv-help     # dev, build, test, e2e, screens, lint, serve, packs, check-packs, make-packs
```

**Look at the result.** `screens` writes every screen to `.screens/`; open them. Three bugs that
every unit test passed through were obvious in a screenshot: a plural key printed whole
(`61 route|routes`), an unfilled placeholder (`Version {0}: dev`), and a save button hidden behind
the bottom navigation. `e2e/notraw.spec.ts` now catches the first two on every screen, and
`e2e/` covers the rest -- but the habit matters more than the tests.

**`src/parity.test.ts` is the feature list.** One row per feature of the pre-React app, naming the
module that carries it. Add a row when you add a feature; a row whose module disappears fails the
suite. It exists because this rewrite was once reported complete while whole feature areas --
weather, radar, the approach planner -- had never been written at all.

**Just commit. Do not run the tests first.** Every check is a git hook — prettier, eslint, tsc,
vitest, the build, the Playwright suite, the pack checks — and `git commit` runs all of them, on
what you are actually committing. They are not a formality standing in for real tests: they *are*
the tests, the whole suite and the browser suite included. So running `lint`, `test` or `e2e`
beforehand tells you nothing the commit will not tell you a minute later, and repeats the slowest
hooks to do it. Where a hook rewrites a file (prettier, `eslint --fix`) the commit stops with
"files were modified by this hook"; `git add -A` and commit again. The `build` hook writes nothing
into the tree — it fails when the bundle does not come out, and leaves `dist/` fresh for the `e2e`
hook, which runs after it because prek goes in alphabetical order.

**And CI runs them again.** `.github/workflows/ci.yml` runs `devenv shell -- lint`, which is the
same set over every file, plus the browser suite in a real Chromium — so nothing can pass on a
laptop and fail in Actions, and a pull request says so on its own. `lint` exists for running the
set without committing (`devenv shell -- lint`, not `devenv test`: `devenv test` swallows the
failing hook's output). It is not a step before a commit.

Translation keys: use the ones that exist. `src/i18n/keys.test.ts` reads the keys out of the source
and fails on any that no language has, including both arms of a ternary.

## Branches, worktrees, pull requests

**Nothing is committed on `main`, and GitHub now refuses it.** A ruleset on the default branch
requires a pull request, allows **squash** as the only merge method, and blocks force-pushes and
deletion — for everybody, with no bypass. So every task starts in its own worktree — the
`EnterWorktree` tool, or `git worktree add .claude/worktrees/<name> -b claude/<topic> origin/main`
— and ends as a pull request. The branch is `claude/<topic>`; `.claude/worktrees/` is ignored by git, by eslint and
by the hooks.

**First thing in a new worktree: `direnv allow`.** devenv installs `node_modules` there with pnpm
and writes the hook config, and without it every hook fails for want of `./node_modules/.bin/…`.
`.git/hooks` is shared by every worktree, and activating devenv re-points it at the checkout you are
standing in — which is why no hook and no script names a checkout any more. They ask
`git rev-parse --show-toplevel` and act on the tree being committed. A hook that built the main
checkout while you committed in a worktree would pass, and mean nothing.

The one thing that shared hook still points at by name is the generated `.pre-commit-config.yaml`
of whichever checkout activated devenv last. Delete that worktree and the next commit — anywhere —
dies with a missing config; `direnv allow` in the checkout you are in writes it again.

Then **just commit** (above), `git push -u origin claude/<topic>`, and `gh pr create`.

**Look at the preview.** A few minutes after the push the pull request carries a comment with
`https://chlädderi.ch/pr-<N>/` — this branch, live, with storage of its own — and a
few minutes later the screenshots of every screen beside it under `pr-<N>/screens/`. Open it. Then
put the two or three screenshots that show what changed into the pull request description, linked
from there: that is what a description is for, and it is the same habit as «look at the result»,
moved to where a reviewer can act on it.

Leave the worktree where it is until the pull request is merged; the preview is dropped when it
closes. Commit messages and pull request titles are English, like everything else written about the
project, and say what changes for whoever uses the app.

## Layout

```text
src/core/      logic with no UI: packs, filters, grades, logbook, the triple store — all tested
src/types/     mappack.ts mirrors the schema; model.ts is the shape the app works with
src/features/  the UI by subject: map, list, crag, logbook, favourites, packs, more, know
src/app/       Redux for the viewer's state; a context for the mounted packs (large, immutable)
src/i18n/      the interface keys, the same set in English and German
tools/         make-packs.sh and validate-packs.sh (what a pack must look like), build.sh into
  dist/, make-site.sh (what gets published), publish-pages.sh (the gh-pages branch),
  get-packs.sh (the private regions), serve.pl
```

A pack stores a route as a four-item tuple and leaves the rest to the app. `src/core/packs/mount.ts`
turns that into named, immutable objects in one pass — including the route key
(`<cragId>~<slug>`), which is what favourites and logbook entries hang off, so they survive a pack
being unloaded and a route list being reordered.
