#!/usr/bin/env bash
# Chlädderi – build the app into dist/.
#
#   tools/build.sh
#
# Type-check the app and the build configuration, then bundle. Everything that wants the built app
# comes through here: the `build` script, the browser tests, the screenshots, and tools/make-site.sh
# when it assembles the site to publish.
#
# **The output is not committed.** It used to be: index.html, sw.js, workbox-*.js and assets/ lay at
# the repository root and a hook kept them in step with the sources. That made every pull request
# conflict with every other one -- a changed source file means a new content hash in each of the ten
# generated lines of index.html, and sw.js is a single 100 KB line holding the precache manifest, so
# no three-way merge could ever resolve it. The deployed bytes stay reviewable without it: the
# gh-pages branch is by construction a commit of exactly what is served, and every pull request
# carries a preview of itself.
#
# The repository is the one this runs *in*, not the one this script lies in: branches are worked on
# in git worktrees, which share .git/hooks with the main checkout, so a script that built its own
# directory would check the wrong tree -- and pass.
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

./node_modules/.bin/tsc
./node_modules/.bin/tsc --project tsconfig.node.json
./node_modules/.bin/vite build

# Fail here rather than three steps later, where the cause is harder to see.
test -s dist/index.html
test -s dist/sw.js
test -d dist/assets
