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
# The tracked files are named one by one rather than globbed, the icons aside (by extension). The repository root used to hold
# nothing but the app and its data, so `cp ./*.json` was safe; now package.json, tsconfig.json and
# renovate.json live there too, and none of them belongs on a public site.
#
# maps/ is deliberately not published either: a mappack is not part of the app. Whoever wants to
# offer one puts it where they like and enters its address in the app.
#
# VERSION, if given, is written to version.json: one version per deploy. It is not stamped into the
# bundle, because that would make the build non-reproducible -- two deploys of the same commit have
# to produce the same bundle. The app reads this file instead, with a `no-store` fetch, for the
# version line on «More». It is kept out of the precache on purpose; a newer version is noticed by
# the service worker, not by this file.
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

# Everything in OUTDIR is deleted below. Refuse a folder that holds this checkout (`.`, a parent,
# a typo that resolved to $HOME) and dist/, which the build empties before it is copied from.
root_real="$(cd -- "${ROOT}" && pwd)"
if [[ "${root_real}/" == "${out%/}/"* ]]; then
  echo "error: OUTDIR ${out} holds this checkout; refusing to empty it" >&2
  exit 2
fi
if [[ "${out}" == "${root_real}/dist" ]]; then
  echo "error: OUTDIR cannot be dist/, which the build writes" >&2
  exit 2
fi

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
# The custom domain, in punycode: chlädderi.ch is xn--chldderi-2za.ch, and DNS, certificates and
# this file all speak the ASCII form. GitHub writes a CNAME here itself when the domain is set in
# Settings -- which would last exactly until the next deploy, because tools/publish-pages.sh force
# pushes a fresh tree and keeps nothing at the top level but pr-*/ and packs/. GitHub's own
# troubleshooting page warns about precisely that. So the site brings its own.
printf '%s\n' "${CNAME:-xn--chldderi-2za.ch}" >"${out}/CNAME"

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
