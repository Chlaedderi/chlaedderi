#!/usr/bin/env bash
# Chlädderi – fetch the real mappacks, for whoever is allowed to see them.
#
#   tools/get-packs.sh [--quiet]
#
# The regions themselves are not in this repository. They live in Chlaedderi/maps, which is
# private, and this script links them into maps/ so that `dev`, `serve` and a local build show the
# real thing. What stays here is maps/pack.showcase.json (the build compiles it into the app) and
# maps/pack.testing.json (what the tests and the e2e suite run on) -- so a checkout without access
# is a complete, working, checkable repository. Nothing in CI depends on what this fetches.
#
# It therefore never fails. No key, no network, no membership of the organisation: it says so in
# one line and exits 0, because `direnv allow` calls it and a shell that refuses to open over a
# missing private repository would be a bad trade.
#
# Symlinks rather than copies, so that editing maps/pack.finale.json edits the private working
# tree and `git -C .packs status` shows what you changed. They are listed by name in .gitignore;
# the showcase and the fixture are not, and must never be.
#
set -euo pipefail

REMOTE="${CHLAEDDERI_MAPS_REMOTE:-git@github.com:Chlaedderi/maps.git}"
PACKS=(finale oltre ow)

quiet=0
[[ ${1-} == "--quiet" ]] && quiet=1

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

CLONE=".packs"

say() { [[ ${quiet} -eq 1 ]] || echo "$@"; }
# A reason to have no packs is not an error, and saying it twice a day is noise. Under --quiet it
# is silent; run `packs` by hand to find out why.
give_up() {
  say "packs: $1"
  say "packs: carrying on with the showcase and the test region only."
  exit 0
}

command -v git >/dev/null 2>&1 || give_up "git is not here"

if [[ -d ${CLONE}/.git ]]; then
  if ! out="$(git -C "${CLONE}" pull --ff-only --quiet 2>&1)"; then
    # An old clone is still better than none: link what is there and say what went wrong.
    say "packs: could not update ${CLONE} (${out%%$'\n'*}); using what is already there."
  fi
else
  say "packs: fetching the regions from ${REMOTE}"
  if ! out="$(git clone --quiet --depth 1 "${REMOTE}" "${CLONE}" 2>&1)"; then
    rm -rf "${CLONE}"
    give_up "no access to ${REMOTE} (${out%%$'\n'*})"
  fi
fi

linked=0
missing=()
for name in "${PACKS[@]}"; do
  src="${CLONE}/pack.${name}.json"
  dst="maps/pack.${name}.json"
  if [[ ! -f ${src} ]]; then
    missing+=("${name}")
    continue
  fi
  # Relative, so the link keeps working wherever the checkout is moved to.
  ln -sfn "../${src}" "${dst}"
  linked=$((linked + 1))
done

[[ ${#missing[@]} -eq 0 ]] || say "packs: ${CLONE} carries no pack.${missing[*]}.json"
say "packs: ${linked} region(s) linked into maps/"
