import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";

export default defineConfig([
    // Build output and vendored data. `dist/` is everything the bundler emits, including the
    // `sw.js` and `workbox-*.js` of vite-plugin-pwa; none of it is committed.
    //
    // `.claude/` holds git worktrees -- whole second copies of this repository. Linting one costs
    // half an hour, because every file in it falls outside `tsconfig.json` and the type-aware
    // rules then build a program per file. The commit hook runs `eslint .`, so without this the
    // commit simply never finishes.
    // .packs/ is the clone of the private Chlaedderi/maps that `packs` makes: somebody else's
    // repository, checked where it lives.
    //
    // `playwright-report/` and `.playwright/` are what the browser suite leaves behind. The report
    // is a bare `index.html` while everything passes -- but the moment one test has to be retried,
    // Playwright copies its trace viewer in beside it: seven minified bundles, a megabyte of them,
    // which `eslint .` then reads as source. That cost an hour a run in CI and nothing at all on a
    // laptop, because the HTML reporter only runs where `CI` is set.
    //
    // Everything in this list is also in .gitignore. ESLint does not read .gitignore, so the two
    // have to be kept in step by hand, and twice now something has slipped through: whatever lands
    // in the working tree and is not named here is linted, however little sense that makes.
    globalIgnores([
        "dist/",
        "maps/",
        ".packs/",
        ".devenv/",
        ".claude/",
        "playwright-report/",
        ".playwright/",
    ]),

    js.configs.recommended,
    ...tseslint.configs.recommended,
    reactPlugin.configs.flat.recommended,

    {
        files: ["src/**/*.{ts,tsx}"],
        plugins: { "react-hooks": reactHooks },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
    },

    {
        // The browser tests are Playwright, not React: `use` there is the fixture callback rather
        // than a hook, and `page.evaluate` bodies run in the browser.
        files: ["e2e/**/*.ts", "playwright.config.ts"],
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
            parser: tsParser,
        },
        rules: {
            "func-style": "off",
        },
    },

    {
        // The little scripts in tools/ are Node, not the app: they read files and print to a
        // terminal. tools/seal-fixture.mjs is the one that is JavaScript rather than shell.
        files: ["tools/**/*.mjs"],
        languageOptions: { globals: { ...globals.node } },
    },

    {
        // The one exception: tools/share-target.js is not a script anybody runs, it is the
        // hand-written half of the service worker (vite.config.ts imports it into the generated
        // one). So it lives in a worker, where `self`, `Response` and the fetch event are globals
        // and Node is nowhere.
        files: ["tools/share-target.js"],
        languageOptions: { globals: { ...globals.serviceworker } },
    },

    prettierRecommended,

    {
        files: ["src/**/*.{ts,tsx}"],
        plugins: {
            "react-refresh": reactRefresh,
            "unused-imports": unusedImports,
            import: importPlugin,
        },
        linterOptions: { reportUnusedDisableDirectives: true },
        languageOptions: {
            globals: { ...globals.browser },
            parser: tsParser,
            parserOptions: { projectService: true, ecmaFeatures: { jsx: true } },
        },
        settings: {
            react: { version: "detect" },
            // vite-plugin-pwa supplies this at build time; there is no file on disk to resolve.
            "import/core-modules": ["virtual:pwa-register/react"],
            "import/resolver": {
                typescript: { alwaysTryTypes: true, project: "./tsconfig.json" },
                node: { extensions: [".js", ".jsx", ".ts", ".tsx", ".css"] },
            },
        },
        rules: {
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            "react/function-component-definition": [
                "error",
                { namedComponents: "arrow-function", unnamedComponents: "arrow-function" },
            ],
            "react/react-in-jsx-scope": "off",
            // The mappack format is deliberately open (additionalProperties: true), so the
            // parsing layer has to accept values it cannot type yet.
            "@typescript-eslint/no-explicit-any": "off",
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                },
            ],
            "import/extensions": [
                "error",
                "ignorePackages",
                { js: "never", jsx: "never", ts: "never", tsx: "never" },
            ],
            quotes: ["error", "double", { avoidEscape: true }],
            "prefer-const": "error",
            "prettier/prettier": ["error"],
            "func-style": ["error", "expression"],
            "import/no-unresolved": "error",
            "import/order": [
                "error",
                {
                    groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
                    "newlines-between": "always",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],
            "@typescript-eslint/naming-convention": [
                "error",
                { selector: "typeLike", format: ["PascalCase"] },
                {
                    selector: "variable",
                    format: ["camelCase", "UPPER_CASE", "PascalCase"],
                    leadingUnderscore: "allow",
                },
                { selector: "function", format: ["camelCase", "PascalCase"] },
                {
                    selector: "parameter",
                    format: ["camelCase", "PascalCase"],
                    leadingUnderscore: "allow",
                    trailingUnderscore: "allow",
                },
                { selector: "parameter", filter: { regex: "^_+$", match: true }, format: null },
                // Mappack fields are short and come from the data, not from us.
                { selector: "objectLiteralProperty", format: null },
                { selector: "typeProperty", format: null },
            ],
        },
    },

    {
        files: ["*.config.{js,mjs,ts}", "vite.config.ts", "tools/**/*.ts"],
        languageOptions: { globals: { ...globals.node }, parser: tsParser },
        settings: { react: { version: "detect" } },
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "import/no-unresolved": "off",
        },
    },
]);
