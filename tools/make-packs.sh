#!/usr/bin/env bash
# Chlädderi – check the mappacks in maps/ and cut the showcase out of a pack.
#
#   tools/make-packs.sh                      check every maps/pack.*.json
#   tools/make-packs.sh --check              check only, write nothing
#   tools/make-packs.sh --showcase-from FILE --ids id1,id2,…
#                                            cut a showcase out of a full pack: those crags with their
#                                            car parks and area groups, marked «partial», without the
#                                            region's research pages, facts and glossary. Writes
#                                            maps/pack.showcase.json; the build puts it into the app.
#
# What is checked: the format and the fields the app insists on, that every area group and car park a crag
# refers to exists, that the counts match the data, that no crag id appears in two packs, and – when a
# showcase is there – that it is really a part of the pack it was cut from.
#
# Needs only jq (and awk). A mappack is described in mappack.schema.json; the schema itself is checked in CI.
#
set -euo pipefail
# The checks pipe into `lines`, and `say` records a failure in `fail`: without this the last part of
# each pipe runs in a subshell, the flag is lost, and no check could ever fail the script.
shopt -s lastpipe

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
MAPS="maps"
SHOW="${MAPS}/pack.showcase.json"

CHECK=0
FROM=""
IDS=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) CHECK=1 ;;
    --showcase-from) FROM="$2"; shift ;;
    --ids) IDS="$2"; shift ;;
    -h|--help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done
[[ -n "${FROM}" ]] && [[ -z "${IDS}" ]] && { echo "error: --showcase-from also needs --ids" >&2; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
say() { printf '  %-6s %s\n' "$1" "$2"; [[ "$1" = "FAIL" ]] && fail=1 || true; }
lines() { while IFS=$'\t' read -r a b; do say "${a}" "${b}"; done; }      # «ok|text» from jq, one line each
size() {                       # size FILE -> the file size as «  12.3 KB»
  local bytes
  bytes="$(wc -c < "$1")"
  awk -v n="${bytes}" 'BEGIN{ printf "%6.1f KB", n/1024 }'
}
show() {                       # show FILE -> one summary line for the pack
  local crags routes parks areas bytes
  crags="$(jq '.counts.crags // (.sectors|length)' "$1")"
  routes="$(jq '.counts.routes // ([.sectors[].routes|length]|add)' "$1")"
  parks="$(jq '.parks|length' "$1")"
  areas="$(jq '.areas|length' "$1")"
  bytes="$(size "$1")"
  printf '%-26s %4d crags  %5d routes  %3d parks  %3d areas  %s\n' \
    "$1" "${crags}" "${routes}" "${parks}" "${areas}" "${bytes}"
}

# the number of crags per area group, once the crags of the pack are known.
# shellcheck disable=SC2016 # $p and $a are jq variables, they must not expand in the shell
AREA_N='. as $p | .areas = [ $p.areas[] as $a | $a | .n = ([ $p.sectors[] | select(.area == $a.name) ] | length) ]'

# ---------------------------------------------------------------- cut a showcase out of a pack
if [[ -n "${FROM}" ]]; then
  [[ -f "${FROM}" ]] || { echo "error: ${FROM} does not exist" >&2; exit 1; }
  ids="$(jq -c -n --arg s "${IDS}" '$s | split(",") | map(sub("^\\s+";"") | sub("\\s+$";""))')"
  out="${SHOW}"; [[ "${CHECK}" = 1 ]] && out="${TMP}/pack.showcase.json"
  jq -c --argjson ids "${ids}" '
    . as $p
    | ($p.sectors | map(select(.id as $i | $ids | index($i)))) as $sec
    | ($sec | map([.pk, .pkOff, ((.ap // [])[] | .pk)] | map(select(. != null))) | flatten | unique) as $pkeys
    | ($sec | map(.area) | unique) as $anames
    | (($sec | map(.coord) | map(select(. != null))) + ($pkeys | map($p.parks[.] | {lat, lon}))) as $pts
    | $p
    | .partial = true
    | .version = ($p.accessed // $p.version) + "-showcase"
    | .sectors = $sec
    | .parks = ($pkeys | map({key: ., value: $p.parks[.]}) | from_entries)
    | .areas = ($p.areas | map(select(.name as $n | $anames | index($n))))
    | .counts = {crags: ($sec | length), routes: ($sec | map(.routes | length) | add // 0),
                 areas: ($anames | length), parks: ($pkeys | length)}
    | .view = {center: [ (($pts | map(.lat) | min) + ($pts | map(.lat) | max)) / 2 | . * 1e6 | round / 1e6,
                         (($pts | map(.lon) | min) + ($pts | map(.lon) | max)) / 2 | . * 1e6 | round / 1e6 ],
               zoom: ($p.view.zoom // 13)}
    | .bbox = [ ($pts | map(.lon) | min), ($pts | map(.lat) | min), ($pts | map(.lon) | max), ($pts | map(.lat) | max) ]
    # a showcase shows crags, not the research of a region: pages, facts and glossary stay behind
    | (if .text then .text |= del(.pages, .facts, .glossary) else . end)
    | del(.outline, .stats)' "${FROM}" | jq -c "${AREA_N}" > "${out}"
  SHOWSRC="${FROM}"
  echo "showcase cut from ${FROM}"
fi

# ---------------------------------------------------------------- what is there
shopt -s nullglob
PACKS=()
for p in "${MAPS}"/pack.*.json; do [[ "${p}" = "${SHOW}" ]] && continue; PACKS+=("${p}"); show "${p}"; done
[[ -f "${SHOW}" ]] && show "${SHOW}"
[[ ${#PACKS[@]} -gt 0 ]] || [[ -f "${SHOW}" ]] || { echo "error: no mappack in ${MAPS}/" >&2; exit 1; }

echo "checks"
ALL=("${PACKS[@]}")
[[ -f "${SHOW}" ]] && ALL+=("${SHOW}")

# every pack on its own: the format, and the references that a JSON Schema cannot follow
for p in "${ALL[@]}"; do
  jq -r --arg f "$(basename "${p}")" '
    (.picSrc // [] | length) as $npic
    | [ .areas[].name ] as $areas
    | [ .parks | keys[] ] as $parks
    | [ (if .format == "chlaedderi-mappack" and .formatVersion == 1 then empty else "not a mappack of version 1" end),
        (if (.id // "") | test("^[a-z0-9][a-z0-9-]{0,31}$") then empty else "the id is not a plain name" end),
        (if (.name.en // "") != "" and (.name.de // "") != "" then empty else "the name is missing en or de" end),
        (if (.version // "") != "" then empty else "the version is missing" end),
        (if (.sectors | length) > 0 then empty else "no crags" end),
        ([.sectors[].id] | if (unique | length) == length then empty else "crag ids appear twice" end),
        (.sectors[] | select(.area as $a | ($areas | index($a)) == null) | "the area «\(.area)» of \(.id) is not in areas"),
        (.sectors[] | [.pk, .pkOff, ((.ap // [])[] | .pk)] | map(select(. != null))[] as $k
          | select(($parks | index($k)) == null) | "the car park «\($k)» is missing"),
        (.sectors[] | select((.pics // []) | any(.[3] >= $npic)) | "a picture of \(.id) points past picSrc"),
        ((.text.pages // [])[] | select((.id // "") | test("^[a-z][a-z0-9-]{0,31}$") | not) | "a page has no usable id"),
        (if (.counts.crags // (.sectors | length)) == (.sectors | length) then empty
         else "counts.crags says \(.counts.crags), there are \(.sectors | length)" end),
        (if (.counts.routes // (.sectors | map(.routes | length) | add // 0)) == (.sectors | map(.routes | length) | add // 0)
         then empty else "counts.routes says \(.counts.routes), there are \(.sectors | map(.routes | length) | add // 0)" end),
        (if (.counts.parks // (.parks | length)) == (.parks | length) then empty else "counts.parks does not match" end)
      ] | unique
    | if length == 0 then "ok|\($f): format and references in order" else "FAIL|\($f): \(join("; "))" end' "${p}" \
  | tr '|' '\t' | lines
done

# the packs among themselves: a crag belongs to one region, a region id appears once
if [[ ${#PACKS[@]} -gt 0 ]]; then
  jq -s -r '
    [ ([.[].id] | if (unique | length) == length then empty else "two packs share an id" end),
      ([.[].sectors[].id] | if (unique | length) == length then empty
       else "crags in more than one pack: \((group_by(.) | map(select(length > 1) | .[0]))[0:3] | join(", "))" end)
    ] | if length == 0 then "ok|the packs fit together: every crag in exactly one region"
        else "FAIL|\(join("; "))" end' "${PACKS[@]}" | tr '|' '\t' | lines
fi

# the showcase must be a part of the pack it was cut from, so that loading that pack simply replaces it
if [[ -f "${SHOW}" ]]; then
  src="${SHOWSRC:-}"
  if [[ -z "${src}" ]]; then
    want="$(jq -r '.id' "${SHOW}")"
    for p in "${PACKS[@]}"; do
      pack_id="$(jq -r '.id' "${p}")"
      if [[ "${pack_id}" == "${want}" ]]; then src="${p}"; fi
    done
  fi
  if [[ -n "${src}" ]]; then
    jq -s -r '.[0] as $show | .[1] as $full
      | ($show.sectors | map(.id)) as $ids
      | if $show.id == $full.id and $show.partial == true
           and (($full.sectors | map(select(.id as $i | $ids | index($i))) | sort_by(.id)) == ($show.sectors | sort_by(.id)))
        then "ok|showcase: \($ids | length) crags, same id and same data as in \($full.id)"
        else "FAIL|the showcase does not match the pack with the id «\($full.id)»" end' \
      "${SHOW}" "${src}" | tr '|' '\t' | lines
  else
    # Not "ok". The strongest check this script has is that the showcase really is a slice of the
    # region it was cut from, and without that region it checks nothing at all. The showcase here is
    # cut from pack.testing.json, which is beside it; a showcase cut from a real region would land
    # here without its source, and that has to read as a gap rather than as a pass.
    say skip "showcase: pack.${want}.json is not here, so nothing was compared (run \`packs\`)"
  fi
fi

[[ "${fail}" = 0 ]] || { echo "checks failed" >&2; exit 1; }

# ---------------------------------------------------------------- the showcase goes into the app
# Nothing to splice any more: src/app/DataProvider.tsx imports maps/pack.showcase.json, so the
# build puts the showcase into the app by itself. Writing the file is all this script has to do.
if [[ "${CHECK}" = 0 ]] && [[ -n "${FROM}" ]] && [[ -f "${SHOW}" ]]; then
  echo "showcase written to ${SHOW} – run the build to put it into the app"
fi
echo "done"
