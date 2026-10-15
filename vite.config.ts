import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

const repoRoot = import.meta.dirname;

/**
 * The source lives in src/ and `root` points there; the build goes to dist/. The icons, the
 * manifest and the mappacks in maps/ stay at the repository root, which means the dev server has to
 * serve them from there by hand -- `publicDir` cannot, because that would copy them into the build
 * output. tools/make-site.sh puts the icons and the manifest beside the build for publishing.
 *
 * maps/ matters here even though it is never deployed: tools/serve.pl serves the repository folder,
 * which is how a pack is loaded locally (http://localhost:…/maps/pack.ow.json). The dev server
 * keeps that working.
 */
const rootStaticFiles = (): Plugin => {
    // .chlpack beside .json: a region may be published encrypted, and the e2e suite installs
    // one from maps/ exactly as a viewer would from an address.
    const served =
        /^\/(maps\/[\w.-]+\.(json|chlpack)|[\w.-]+\.(png|svg|ico|webmanifest)|version\.json)$/;
    const types: Record<string, string> = {
        ".json": "application/json",
        ".chlpack": "application/octet-stream",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
    };
    return {
        name: "chlaedderi-root-static-files",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = (req.url ?? "").split("?")[0] ?? "";
                if (!served.test(url)) return next();
                const file = path.join(repoRoot, url);
                try {
                    if (!statSync(file).isFile()) return next();
                } catch {
                    return next();
                }
                res.setHeader(
                    "Content-Type",
                    types[path.extname(file)] ?? "application/octet-stream",
                );
                res.setHeader("Cache-Control", "no-store");
                res.end(readFileSync(file));
            });
        },
    };
};

/**
 * tools/share-target.js, into the build output.
 *
 * It is emitted rather than committed at the repository root: tools/make-site.sh copies dist/ as a
 * whole, so an emitted file is published for free, while a root-level one would need that script,
 * the dev server's allow-list above and its MIME map all changed to agree. Being globbed into the
 * precache along the way is wanted -- `updateViaCache: "imports"` otherwise lets the HTTP cache
 * answer for an `importScripts`ed file, and a precache revision is what forces a genuinely new
 * worker. The bytes come off disk unchanged, so two builds of the same commit still match.
 */
const shareTarget = (): Plugin => ({
    name: "chlaedderi-share-target",
    // Before vite-plugin-pwa's `closeBundle` globs dist/, so the worker precaches it.
    generateBundle() {
        this.emitFile({
            type: "asset",
            fileName: "share-target.js",
            source: readFileSync(path.join(repoRoot, "tools/share-target.js"), "utf8"),
        });
    },
});

export default defineConfig({
    root: "src",
    // Nothing to copy: the static files stay at the repository root, and tools/make-site.sh puts
    // them beside the build output when it publishes.
    publicDir: false,
    base: "./",
    build: {
        outDir: "../dist",
        emptyOutDir: true,
        assetsDir: "assets",
        // One version per deploy comes from version.json, not from the bundle, so the build stays
        // deterministic: two builds of the same commit give the same bytes.
        sourcemap: false,
    },
    // The radar decoder runs in a module worker. Vite's default worker output is an IIFE, which
    // contradicts `{ type: "module" }` and fails to construct in a *build* while working perfectly
    // in dev -- so it is set here, once, where it cannot be forgotten.
    worker: { format: "es" },
    plugins: [
        react(),
        svgr(),
        rootStaticFiles(),
        shareTarget(),
        VitePWA({
            // The app asks before reloading, as it does today.
            registerType: "prompt",
            filename: "sw.js",
            // UpdateBanner registers the worker itself, through virtual:pwa-register/react, so
            // that it can see the waiting registration. An injected registration would be a
            // second, competing one.
            injectRegister: null,
            manifest: false,
            workbox: {
                // The fonts too, or an installed app falls back to the system font the moment it
                // is offline. Latin and Latin Extended only, as woff2: the Vietnamese subsets
                // and the woff fallbacks are never asked for by a browser this app supports.
                globPatterns: ["**/*.{js,css,html,svg}", "**/*-latin-*.woff2"],
                // The share target, above everything Workbox emits. Resolved relative to sw.js,
                // so it is the right file at / and at /pr-N/ alike. It cannot reach the `workbox`
                // global -- `inlineWorkboxRuntime` is false, so the runtime is a module-local
                // binding -- and does not need to: it only listens for a POST.
                importScripts: ["share-target.js"],
                // The icons and the manifest live at the repository root, not in the build output.
                additionalManifestEntries: [
                    "manifest.webmanifest",
                    "favicon.svg",
                    "favicon-32.png",
                    "apple-touch-icon.png",
                    "icon-192.png",
                    "icon-512.png",
                    "icon-maskable-192.png",
                    "icon-maskable-512.png",
                ].map((url) => ({ url, revision: null })),
                // version.json and the mappacks are the app's own business: it keeps packs in the
                // «chlaedderi-packs» cache and reads version.json with no-store to notice a new
                // deploy. Letting the service worker precache either would break both.
                // Matched against the *path* of the request, and the app is served from a folder
                // (https://xn--chldderi-2za.ch/), so these must not be anchored at the
                // origin: `^/maps/` never matched anything on the deployed site.
                //
                // /pr-N/ is a pull request preview (see .github/workflows/preview.yml). The app's
                // own worker has scope over those folders too, and without this it would answer
                // the first navigation to a preview with the app's own index.html -- the reviewer
                // would be looking at the deployed app and believe it was the branch. The price is
                // that a preview itself has no navigation fallback, so it does not work offline.
                // A preview does not have to.
                navigateFallbackDenylist: [/\/maps\//, /\/version\.json$/, /\/pr-\d+\//],
                runtimeCaching: [
                    {
                        // Map tiles, capped the way the hand-written sw.js capped them.
                        urlPattern:
                            /^https:\/\/([abc]\.)?(tile\.openstreetmap\.org|[abc]\.tile\.opentopomap\.org|tile\.opentopomap\.org|wmts\.geo\.admin\.ch|wms\.geo\.admin\.ch|server\.arcgisonline\.com)\//,
                        handler: "CacheFirst",
                        options: {
                            // APP_SLUG, written out: this file is the build's own config and imports nothing
                            // from src/. src/core/preview.test.ts pins the spelling.
                            cacheName: "chlaedderi-tiles-v1",
                            expiration: { maxEntries: 900, maxAgeSeconds: 60 * 60 * 24 * 90 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@core": path.resolve(repoRoot, "./src/core"),
            "@services": path.resolve(repoRoot, "./src/services"),
            "@features": path.resolve(repoRoot, "./src/features"),
            "@app": path.resolve(repoRoot, "./src/app"),
            "@domain": path.resolve(repoRoot, "./src/types"),
            "@i18n": path.resolve(repoRoot, "./src/i18n"),
            "@maps": path.resolve(repoRoot, "./maps"),
            "@data": path.resolve(repoRoot, "./src/data"),
        },
    },
    server: { host: "127.0.0.1", port: 5173 },
    test: {
        globals: true,
        // A screen that arrives through React.lazy, rendered in jsdom, on a machine that is also
        // running the browser suite and a build -- which is what `git commit` does -- can take
        // longer than vitest's default five seconds to get as far as its first assertion. That
        // showed up as two of the app tests failing in the hook and passing on their own. This is
        // only ever how long a *failing* test takes.
        testTimeout: 20_000,
        environment: "jsdom",
        setupFiles: "./src/test/setup.ts",
        root: ".",
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
