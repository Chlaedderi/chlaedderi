#!/usr/bin/env bash
# Chlädderi – put a folder on the branch GitHub Pages serves.
#
#   tools/publish-pages.sh root    DIR     the site at /, every pr-N/ left alone
#   tools/publish-pages.sh pr      N DIR   the preview of pull request N at /pr-N/
#   tools/publish-pages.sh screens N DIR   the screenshots of N at /pr-N/screens/
#   tools/publish-pages.sh remove  N       drop /pr-N/ again
#   tools/publish-pages.sh prune   N...    drop every /pr-N/ that is not listed
#
# Pages serves one site per repository, so the production app and the pull request previews have to
# share it: the branch holds the app at the root and one folder per open pull request. That is also
# why the deploy no longer uploads an artefact -- an artefact replaces the whole site, previews and
# all.
#
# Every publish force-pushes a single commit with no parent. A publish branch has no history worth
# keeping, and the screenshots are 5 MB per pull request: kept as history they would stay in the
# repository for ever, and a clone would carry them all.
#
# **Two of these can run at the same time, and must not lose each other's work.** The first attempt
# at this used one `concurrency: gh-pages` group for all three workflows -- which does not queue
# them: GitHub keeps a single pending run per group and cancels the one that was waiting. A deploy
# of main was dropped that way within a minute of the first try, silently and green. So the
# workflows no longer share a group, and the race is settled here instead: the push carries the
# commit the branch had when this started, and the server refuses it if anybody else has written
# since. Then the whole thing is done again on top of what they wrote.
#
# Nothing is pushed when the tree would not change.
#
set -euo pipefail

BRANCH="${PAGES_BRANCH:-gh-pages}"
# The bot, when this runs in Actions; whoever is committing, when it runs by hand.
NAME="${GIT_AUTHOR_NAME:-github-actions[bot]}"
MAIL="${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
# Five is plenty: every attempt that loses the race means somebody else's publish succeeded.
TRIES="${PAGES_TRIES:-5}"

usage() {
  sed -ne '2,9s/^# \?//p' "${BASH_SOURCE[0]}" >&2
  exit 2
}

# A pull request number, and nothing else: it becomes a path on a public site.
number() {
  [[ ${1-} =~ ^[1-9][0-9]*$ ]] || usage
  printf '%s' "$1"
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

command="${1-}"
[[ -n ${command} ]] || usage
shift

work=""
cleanup() {
  [[ -n ${work} ]] || return 0
  git worktree remove --force "${work}" 2>/dev/null || true
  rm -rf "${work}"
}
trap cleanup EXIT

for try in $(seq 1 "${TRIES}"); do
  # The published tree, checked out next to the repository. A worktree rather than a clone: it
  # inherits the remote and its credentials from the checkout this runs in.
  work="$(mktemp -d)"
  rmdir "${work}"

  git fetch --no-tags --force --depth=1 origin \
    "refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}" 2>/dev/null ||
    echo "note: no ${BRANCH} yet, starting it"

  # What the branch is at right now. The push below says so, and is refused if that has changed.
  base="$(git rev-parse --verify --quiet "refs/remotes/origin/${BRANCH}")" || base=""

  if [[ -n ${base} ]]; then
    git worktree add --detach --quiet "${work}" "${base}"
  else
    git worktree add --detach --quiet "${work}" HEAD
    git -C "${work}" rm -rq --cached .
    find "${work}" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  fi

  # What the folder is called on the site, and what the commit will say.
  case "${command}" in
    root)
      dir="${1:?a directory to publish}"
      dir="$(cd -- "${dir}" && pwd)"
      # Everything at the top level is the app, except the previews, which stay.
      find "${work}" -mindepth 1 -maxdepth 1 \
        ! -name .git ! -name 'pr-*' -exec rm -rf {} +
      cp -R "${dir}/." "${work}/"
      message="The app"
      ;;
    pr)
      n="$(number "${1-}")"
      dir="${2:?a directory to publish}"
      dir="$(cd -- "${dir}" && pwd)"
      # The screenshots of this pull request outlive a new push of its branch.
      rm -rf "${work:?}/pr-${n}"
      mkdir -p "${work}/pr-${n}"
      cp -R "${dir}/." "${work}/pr-${n}/"
      message="Preview of #${n}"
      ;;
    screens)
      n="$(number "${1-}")"
      dir="${2:?a directory to publish}"
      dir="$(cd -- "${dir}" && pwd)"
      rm -rf "${work:?}/pr-${n}/screens"
      mkdir -p "${work}/pr-${n}/screens"
      cp -R "${dir}/." "${work}/pr-${n}/screens/"
      message="Screenshots of #${n}"
      ;;
    remove)
      n="$(number "${1-}")"
      rm -rf "${work:?}/pr-${n}"
      message="Preview of #${n} removed"
      ;;
    prune)
      keep=" $* "
      message="Previews pruned"
      shopt -s nullglob
      for preview in "${work}"/pr-*; do
        n="$(basename "${preview}")"
        n="${n#pr-}"
        [[ ${keep} == *" ${n} "* ]] || {
          echo "pruning pr-${n}"
          rm -rf "${preview}"
        }
      done
      ;;
    *) usage ;;
  esac

  # -f: the repository's .gitignore has no say over a published site. version.json is ignored in
  # the source tree, and it is precisely what the app fetches to see which version it is running.
  git -C "${work}" add -A -f
  changed="$(git -C "${work}" status --porcelain)"
  if [[ -z ${changed} ]]; then
    echo "${BRANCH}: nothing to publish"
    exit 0
  fi

  # One commit, no parent -- written from the index rather than by checking out an orphan branch,
  # so that nothing is left behind in the checkout this runs in.
  tree="$(git -C "${work}" write-tree)"
  commit="$(
    GIT_AUTHOR_NAME="${NAME}" GIT_AUTHOR_EMAIL="${MAIL}" \
      GIT_COMMITTER_NAME="${NAME}" GIT_COMMITTER_EMAIL="${MAIL}" \
      git -C "${work}" commit-tree "${tree}" -m "${message}"
  )"

  # The one command allowed to fail: somebody else published while we were working. Without a
  # branch yet, a plain push, which creates it and fails if it has appeared meanwhile.
  push=(git -C "${work}" push --quiet)
  if [[ -n ${base} ]]; then
    push+=(--force-with-lease="refs/heads/${BRANCH}:${base}")
  fi
  if "${push[@]}" origin "${commit}:refs/heads/${BRANCH}"; then
    echo "${BRANCH}: ${message}"
    exit 0
  fi

  echo "${BRANCH} moved while we worked (attempt ${try}), taking it from the top" >&2
  cleanup
  work=""
  sleep "$((try * 3))"
done

echo "error: could not publish to ${BRANCH} in ${TRIES} attempts" >&2
exit 1
