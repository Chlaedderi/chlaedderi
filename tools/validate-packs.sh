#!/usr/bin/env bash
# Chlädderi – check every mappack in maps/ against mappack.schema.json.
#
#   tools/validate-packs.sh              check every maps/pack.*.json
#   tools/validate-packs.sh FILE...      check the given files
#
# This is the schema half of the mappack checks; tools/make-packs.sh --check is the other half
# (counts, car park and area group references, no crag in two packs). The schema is draft 2020-12
# and deliberately allows unknown fields, so that an older app can ignore what it does not know.
#
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

SCHEMA="mappack.schema.json"

if [[ $# -gt 0 ]]; then
  packs=("${@}")
else
  shopt -s nullglob
  packs=(maps/pack.*.json)
fi

if [[ ${#packs[@]} -eq 0 ]]; then
  echo "error: no mappack in maps/" >&2
  exit 1
fi

printf 'schema: %s\n' "${SCHEMA}"
printf 'packs:  %s\n' "${packs[*]}"

check-jsonschema --schemafile "${SCHEMA}" -- "${packs[@]}"
