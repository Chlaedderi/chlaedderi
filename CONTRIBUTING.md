# Contributing

Improvements are welcome straight into this repository or as a pull request. The repository names
no licence (yet) – so before redistributing it publicly, do ask first.

## Setting up

With [devenv](https://devenv.sh/) and [direnv](https://direnv.net/):

```sh
direnv allow     # or: devenv shell
devenv-help      # shows every command
```

That brings Node, the tools and the git hooks. Nothing else to install.

## The way through

1. A branch of your own, and `main` left alone. One checkout per branch keeps them apart:
    `git worktree add .claude/worktrees/mine -b my-topic origin/main`, then `direnv allow` in it –
    that folder is ignored, and devenv installs Node and the hooks there as well.
2. Change things in `src/`.
3. `dev` – development server at <http://localhost:5173/>.
4. `test` for the unit tests, `lint` for everything else.
5. Commit. The hooks run by themselves; one of them builds the app, to prove that it still builds.
6. Push, and open a pull request.

**The built app is not in the repository.** `build` writes it to `dist/`, which is ignored, and the
deploy builds it again from your branch. Nothing in `dist/` is ever edited by hand.

## Your pull request, live

Every pull request from this repository is published as it is: within a few minutes a comment
appears with its address, `https://chlaedderi.github.io/pr-<number>/`, and the screenshots of
every screen beside it shortly after. Open it, and link the screenshots that show what you changed
from your description.

A preview keeps its own favourites, logbook and settings – it never touches the data of the app at
<https://chlaedderi.github.io/>, even though both live on the same host. It disappears when
the pull request closes.

A pull request from a fork gets no preview. It runs the branch's own code, so it is not allowed to
write to this repository; everything else about it is checked as usual.

## What to watch out for

- **English in the repository, German in the app.** Everything written for whoever works on this
  – README, this file, comments, commit messages, test names – is English. The interface texts
  and the data are German; they live in `src/i18n/de.json` and in the mappacks.
- **German in Swiss spelling**: ss, never ß. Both languages need the same keys, the same
  placeholders and the same number of plural forms – a test holds that in place.
- **Interface texts** live in `src/i18n/{en,de}.json`. Do not invent keys: `keys.test.ts` checks
  every key the source uses against both languages.
- **Do not rename the storage names** (`chlaedderi*`). Underneath them are the favourites and
  logbooks on people's devices.
- **`mappack.schema.json` is the source of truth** for the pack format. Whoever changes it adapts
  `src/types/mappack.ts` – the coverage test says what is missing.
- **Pack text never becomes HTML.** Whoever works on text from a pack reads `src/core/text.ts`
  and its tests first.
- **Changing a mappack?** Then `check-packs`. The check has two halves: the schema, and the
  references and counts that a schema cannot check.

## Mappacks

A pack is one region in one JSON file, described in
[`mappack.schema.json`](mappack.schema.json). A pack is **not** part of the app: whoever wants to
offer one puts it wherever they want it and enters the address in the app.

Two packs are in `maps/` here. `pack.showcase.json` is the handful of crags the build compiles in,
so that a fresh install has something to look at; `pack.testing.json` is an invented region, and it
is what the tests and the browser suite run on. Neither is anybody's real data, which is why a
contributor needs nothing private to work on this repository.

The real regions live in the private `Chlaedderi/maps` repository. With access, `packs` links them
into `maps/` so that `dev` and `serve` show the real thing; without it, that command says so in one
line and everything else carries on. Nothing in CI depends on them. A new showcase is cut there and
arrives here as a pull request.

## Commits

Commit messages in this repository are in English and describe what changes for whoever uses the
app – not which files were touched.
