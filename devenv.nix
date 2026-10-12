{
  pkgs,
  lib,
  config,
  ...
}:

let
  # fix locale
  use-locale = "C.UTF-8";
  custom-locales = pkgs.glibcLocalesUtf8.override {
    allLocales = false;
    locales = [ "${use-locale}/UTF-8" ];
  };

  # Generated or vendored rather than written: the mappacks in maps/ are minified single-line JSON,
  # and pnpm writes the lock file. The hooks that rewrite whitespace or count columns would either
  # mangle them or report noise, so they skip these paths.
  #
  # The app's own build output used to be in here too -- index.html, sw.js, workbox-*.js, assets/ at
  # the repository root. It is not committed any more (see tools/build.sh), so there is nothing left
  # to exclude: dist/ is not tracked and the hooks never see it.
  generated = [
    "^maps/"
    "^pnpm-lock\\.yaml$"
  ];

  # What is left in German is the product itself: the interface texts, the page description and the
  # data, with its Italian and Romansh place names. `typos` only has an English dictionary and
  # reports ordinary German words as misspellings, so it skips those files. Everything written
  # *about* the project is English and is checked -- README.md and CONTRIBUTING.md included.
  natural-language = [
    "^manifest\\.webmanifest$"
    "^maps/"
    # The German half of the interface texts, and the German for strings that arrive with the data.
    "^src/i18n/de\\.json$"
    "^src/i18n/dataTranslations\\.ts$"
    # Grade scales: "sax" (Saxon), "fin" (Finnish), "aus" (Australian).
    "^src/data/conv\\.json$"
    # The page description, in German, the same text as in manifest.webmanifest.
    "^src/index\\.html$"
  ];

  # Branches are worked on in git worktrees here, and .git/hooks is shared by every one of them:
  # a hook or script pinned to the checkout devenv happened to be activated in would build and
  # test the wrong tree -- and pass. So nothing says `${config.devenv.root}` any more. prek runs a
  # hook from the root of the repository being committed in, which makes a relative
  # ./node_modules/.bin/… already right; the scripts, which run from wherever the shell happens to
  # stand, ask git instead. The fallback keeps them working outside a work tree.
  cdRepo = ''cd "$(git rev-parse --show-toplevel 2>/dev/null || printf '%s' '${config.devenv.root}')"'';
in
{
  env = {
    # set do not track (https://consoledonottrack.com/)
    DO_NOT_TRACK = 1;

    # Prevent corepack from downloading the "latest" pnpm; the version comes from the
    # "packageManager" field in package.json once that exists.
    COREPACK_DEFAULT_TO_LATEST = 0;

    # Playwright finds its browsers in the nix store and never fetches any.
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 1;

    # fix locale
    LOCALE_ARCHIVE = "${custom-locales}/lib/locale/locale-archive";
    LC_ALL = use-locale;
    LC_CTYPE = use-locale;
    LC_COLLATE = use-locale;
    LC_MESSAGES = use-locale;
    LC_NUMERIC = use-locale;
    LC_TIME = use-locale;
  };

  packages = with pkgs; [
    git

    # Ai
    claude-code

    # tools/make-packs.sh needs only these two
    jq
    perl

    # Playwright: the browsers come from the nix store, so nothing is downloaded on install.
    # @playwright/test in package.json must stay pinned to playwright-driver.version (1.61.1).
    playwright-driver.browsers

    # hook runner and the tools the hooks that are not wired through git-hooks.nix call directly
    prek
    check-jsonschema
    renovate # for renovate-config-validator

    # everyday shell, and `gh` for the pull requests and workflow runs of this repository
    gh
    curl
    yq-go
    dos2unix
  ];

  # https://devenv.sh/languages/
  languages.nix.enable = true;

  # Node is here for the TypeScript app. pnpm.install.enable is deliberately off until a
  # package.json and a pnpm-lock.yaml exist -- devenv would fail on shell entry without them.
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs;
    corepack.enable = true;
    # Install on shell entry, so that the tools the git hooks call (prettier, eslint, tsc, vitest)
    # are in node_modules/.bin. pnpm.enable puts the nixpkgs pnpm on PATH too; every invocation
    # happens in this directory, where the "packageManager" field decides the version.
    pnpm.enable = true;
    pnpm.install.enable = true;
  };
  languages.typescript.enable = true;

  git-hooks.package = pkgs.prek;

  tasks."devenv:git-hooks:run" = {
    # Print the output of the git hooks that "devenv test" runs, otherwise a failing hook only
    # reports that it failed.
    showOutput = true;
  };

  # https://devenv.sh/git-hooks/
  git-hooks.hooks = {
    # ---- whitespace and file shape
    dos2unix = {
      enable = true;
      entry = "dos2unix";
      args = [ "--info=c" ];
      excludes = generated;
    };

    trim-trailing-whitespace = {
      enable = true;
      excludes = generated;
    };

    end-of-file-fixer = {
      enable = true;
      excludes = generated;
    };

    check-executables-have-shebangs.enable = true;
    check-shebang-scripts-are-executable.enable = true;
    check-symlinks.enable = true;

    # Nothing is committed on main (see CLAUDE.md). GitHub refuses a direct push to it already --
    # a ruleset on the default branch requires a pull request -- but that only speaks up once the
    # push is rejected, with the commit already made and a branch to disentangle. This says so at
    # the moment it happens. `git commit --no-verify` is the way out when main really does have to
    # be written, which is rarer here than in the maps repository, where this hook is the only
    # thing standing in the way at all.
    no-commit-to-branch.enable = true;

    # The largest mappack is ~650 KB. The limit is here to catch a stray second copy of one, or a
    # build artefact landing in git by accident.
    check-added-large-files = {
      enable = true;
      args = [ "--maxkb=1024" ];
    };

    editorconfig-checker = {
      enable = true;
      excludes = generated;
    };

    # ---- per language
    nixfmt.enable = true;

    shellcheck = {
      enable = true;
      args = [
        "-x"
        "-o"
        "all"
      ];
    };

    markdownlint = {
      enable = true;
      settings.configuration = {
        # The prose in README.md is written one paragraph per line, some of them 500 characters
        # long. Reflowing it would make the diffs useless.
        MD013 = false;
      };
    };

    yamllint = {
      enable = true;
      excludes = [
        "^pnpm-lock\\.yaml$"
      ];
      settings = {
        strict = true;
        # `on:` in a GitHub Actions workflow is a YAML 1.1 truthy value, so it has to be allowed.
        configData = "{ extends: default, rules: { document-start: disable, line-length: {max: 165}, truthy: {allowed-values: ['true', 'false', 'on']} } }";
      };
    };

    check-json.enable = true;
    check-toml.enable = true;
    actionlint.enable = true;

    renovate-config-validator = {
      enable = true;
      entry = "renovate-config-validator";
      files = "^renovate\\.json$";
    };

    # ---- secrets and spelling
    ripsecrets.enable = true;

    typos = {
      enable = true;
      # Both lists: the mappacks are German data as well as generated.
      excludes = natural-language ++ generated;
      exclude_types = [ "svg" ];
    };

    # ---- the TypeScript app
    # These call the tools from node_modules/.bin, which languages.javascript.pnpm.install puts
    # there on shell entry. All of them look at the whole project rather than at the files prek
    # hands over: tsc and vitest have to, and prettier and eslint are configured project-wide.
    # Prettier owns the application source and its own two config files, and nothing else. Pointing
    # it at the whole project reformats mappack.schema.json -- which is published, and whose $id
    # other people's packs refer to -- along with manifest.webmanifest and devenv.yaml. Those are
    # hand-maintained and have their own checkers.
    prettier = {
      enable = true;
      entry = "./node_modules/.bin/prettier --write src e2e eslint.config.mjs vite.config.ts playwright.config.ts";
      files = "(^src/|^e2e/|^eslint\\.config\\.mjs$|^vite\\.config\\.ts$|^playwright\\.config\\.ts$|^\\.prettier)";
      pass_filenames = false;
    };

    eslint = {
      enable = true;
      entry = "./node_modules/.bin/eslint --max-warnings 0 --fix .";
      files = "\\.(tsx?|mjs)$";
      pass_filenames = false;
    };

    tsc = {
      enable = true;
      entry = "./node_modules/.bin/tsc";
      files = "(^src/|^package\\.json$|^tsconfig.*\\.json$|^mappack\\.schema\\.json$)";
      pass_filenames = false;
    };

    tsc-node = {
      enable = true;
      entry = "./node_modules/.bin/tsc --project tsconfig.node.json";
      files = "(^vite\\.config\\.ts$|^tsconfig.*\\.json$|^package\\.json$)";
      pass_filenames = false;
    };

    vitest = {
      enable = true;
      entry = "./node_modules/.bin/vitest run";
      files = "(^src/|^maps/|^mappack\\.schema\\.json$|^package\\.json$|^vite\\.config\\.ts$)";
      pass_filenames = false;
    };

    # The app has to build. Nothing of the result is committed any more, so this hook no longer
    # rewrites files in the tree; it fails when the bundle does not come out, which tsc alone does
    # not catch -- a bad import path or a plugin that throws only shows up here. It also leaves
    # dist/ fresh, which is what the e2e hook below then serves.
    build = {
      enable = true;
      entry = "./tools/build.sh";
      files = "(^src/|^package\\.json$|^pnpm-lock\\.yaml$|^vite\\.config\\.ts$|^tsconfig.*\\.json$|^maps/pack\\.showcase\\.json$)";
      pass_filenames = false;
    };

    # The browser tests. The suite serves dist/, i.e. the *built* app, so whatever is in there has
    # to be this tree: a Playwright run against a stale build is worse than no run at all, because
    # it passes. Anything that changes the bundle has already rebuilt it by the time this runs --
    # prek runs the hooks in alphabetical order and "build" sorts before "e2e" -- so the line below
    # is only for the case that hook does not cover: a commit that touches e2e/ alone, in a
    # checkout where nothing has been built yet. dist/ is not committed, so it can genuinely be
    # missing.
    e2e = {
      enable = true;
      # prek runs hooks outside the devenv shell, so `env.*` does not reach them: without the
      # browsers path Playwright looks in ~/.cache/ms-playwright, finds nothing, and every single
      # test fails to launch. The same store path the shell exports is pinned in here.
      entry = toString (
        pkgs.writeShellScript "e2e-hook" ''
          export PLAYWRIGHT_BROWSERS_PATH='${pkgs.playwright-driver.browsers}'
          export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
          ${cdRepo}
          [ -f dist/index.html ] || ./tools/build.sh
          exec ./node_modules/.bin/playwright test
        ''
      );
      files = "(^src/|^e2e/|^playwright\\.config\\.ts$|^maps/pack\\.showcase\\.json$)";
      pass_filenames = false;
    };

    # ---- the mappacks
    # Two independent checks, the same two that CI used to run: the schema says what a mappack may
    # look like, make-packs.sh says whether the packs agree with each other and with their counts.
    validate-mappacks = {
      enable = true;
      entry = "./tools/validate-packs.sh";
      files = "^(maps/.*\\.json|mappack\\.schema\\.json|tools/validate-packs\\.sh)$";
      pass_filenames = false;
    };

    check-mappacks = {
      enable = true;
      entry = "./tools/make-packs.sh";
      args = [ "--check" ];
      files = "^(maps/.*\\.json|mappack\\.schema\\.json|tools/make-packs\\.sh)$";
      pass_filenames = false;
    };
  };

  enterShell = ''
    # The real regions are in the private Chlaedderi/maps repository. This links them in for
    # whoever is allowed to see them, and says one line and gives up for whoever is not -- the
    # repository is complete and checkable without them, so a shell must never fail over this.
    packs --quiet || true

    # is interactive shell?
    if tty -s; then
      devenv-help
    fi
  '';

  scripts.devenv-help = {
    description = "Print this help";
    exec = ''
      set -euo pipefail
      ${cdRepo}

      echo
      echo "Helper scripts provided by the devenv:"
      echo
      sed -e 's| |XXXXXX|g' -e 's|=| |' <<EOF | column -t | sed -e 's|^|- |' -e 's|XXXXXX| |g'
      ${lib.generators.toKeyValue { } (lib.mapAttrs (_name: value: value.description) config.scripts)}
      EOF
      echo
    '';
  };

  scripts.lint = {
    description = "Run all git hooks over the whole repository";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        # Every hook but the one that refuses a commit on main. That hook is about the *act* of
        # committing, and `lint` is not one: it reads the files that are there and says whether
        # they are right. `prek run` would run it anyway -- it is always_run -- and it asks which
        # branch is checked out, so it fails wherever the answer is main. Which is CI: the checks
        # run on a push to main as well as on a pull request, and actions/checkout leaves the
        # checkout on the branch that was pushed. Without this, `Checks` is red on main after every
        # merge.
        prek run --skip no-commit-to-branch "''${@:---all-files}"
      )
    '';
  };

  scripts.dev = {
    description = "Start the development server with live reloading";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        ./node_modules/.bin/vite "''${@}"
      )
    '';
  };

  scripts.build = {
    description = "Build the app into dist/";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        ./tools/build.sh
      )
    '';
  };

  scripts.test = {
    description = "Run the unit tests";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        ./node_modules/.bin/vitest "''${@:-run}"
      )
    '';
  };

  scripts.e2e = {
    description = "Run the browser tests (Playwright)";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        # The suite serves dist/, which is the *built* app -- so a stale build
        # would be tested instead of the working tree, and the run would pass while the change
        # under test was not in it. Build first, always.
        ./tools/build.sh

        ./node_modules/.bin/playwright test "''${@}"
      )
    '';
  };

  scripts.screens = {
    description = "Capture every screen to .screens/, to look at";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        ./tools/build.sh

        ./node_modules/.bin/playwright test e2e/screens.spec.ts "''${@}"
      )
    '';
  };

  scripts.serve = {
    description = "Serve the built app over http so that the service worker works";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        ./tools/serve.pl "''${@}"
      )
    '';
  };

  scripts.make-packs = {
    description = "Check the mappacks, or cut a showcase out of one";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        ./tools/make-packs.sh "''${@}"
      )
    '';
  };

  scripts.packs = {
    description = "Fetch the real regions from the private Chlaedderi/maps (needs access)";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        ./tools/get-packs.sh "''${@}"
      )
    '';
  };

  scripts.check-packs = {
    description = "Check the mappacks against the schema and against each other";
    exec = ''
      (
        set -euo pipefail
        ${cdRepo}

        ./tools/validate-packs.sh
        ./tools/make-packs.sh --check
      )
    '';
  };
}
