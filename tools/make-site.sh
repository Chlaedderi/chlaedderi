#!/usr/bin/env bash
# Chlädderi – assemble the site that gets published, out of the repository.
#
#   tools/make-site.sh OUTDIR [VERSION]
#
# The deploy and the pull request previews publish the same file set, so both ask this script for
# it rather than keeping two copies of a list that must not drift. That includes the build: the app
# is not committed, so this script builds it. A deploy and a preview therefore run the same
# tools/build.sh over their own tree, and neither can publish bytes that nobody built.
#
# The tracked files are named one by one rather than globbed. The repository root used to hold
# nothing but the app and its data, so `cp ./*.json` was safe; now package.json, tsconfig.json and
# renovate.json live there too, and none of them belongs on a public site.
#
# maps/ is deliberately not published either: a mappack is not part of the app. Whoever wants to
# offer one puts it where they like and enters its address in the app.
#
# VERSION, if given, is written to version.json: one version per deploy. It is not stamped into the
# bundle, because that would make the build non-reproducible -- two deploys of the same commit have
# to produce the same bundle. The app reads this file instead: the service worker caches it with the
# rest of the shell, and a `no-store` fetch of the same address is how the app notices that a newer
# version is out.
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

out="${1:?usage: tools/make-site.sh OUTDIR [VERSION]}"
version="${2-}"

# Before the cd, so that a relative OUTDIR means what the caller meant.
mkdir -p "${out}"
out="$(cd -- "${out}" && pwd)"
cd "${ROOT}"

rm -rf "${out:?}"/*
shopt -s nullglob

# The app, built from this tree. dist/ holds index.html, sw.js, the workbox runtime beside it and
# assets/ -- everything the bundler emits and nothing else.
./tools/build.sh
cp -R dist/. "${out}/"
# What the app asks for by name at runtime. These are tracked files, not build output: the bundler
# never sees them (vite.config.ts sets `publicDir: false`), so they have to be copied from here.
cp manifest.webmanifest mappack.schema.json "${out}/"
cp ./*.png ./*.svg ./*.ico "${out}/"
# Pages serves the folder as it is, without a Jekyll pass over it.
touch "${out}/.nojekyll"

if [[ -n ${version} ]]; then
  built="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"version":"%s","built":"%s"}\n' "${version}" "${built}" >"${out}/version.json"
fi

# Fail loudly rather than publishing half an app.
test -s "${out}/index.html"
test -s "${out}/sw.js"
test -d "${out}/assets"

files="$(find "${out}" -type f | wc -l)"
printf 'site: %s (%s files)\n' "${out}" "${files// /}"
