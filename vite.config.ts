import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

const repoRoot = import.meta.dirname;

/**
 * The repository root is the *output* directory of this build (the deploy publishes the flat folder,
 * see .github/workflows/pages.yml), so the source lives in src/ and `root` points there. The icons,
 * the manifest and the mappacks in maps/ stay where they are, which means the dev server has to
 * serve them from the repository root by hand -- `publicDir` cannot, because that would copy them
 * into the build output and duplicate them.
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

export default defineConfig({
    root: "src",
    // Nothing to copy: the static files already sit at the repository root, where the build output
    // joins them.
    publicDir: false,
    base: "./",
    build: {
        outDir: "../dist",
        emptyOutDir: true,
        assetsDir: "assets",
        // One version per deploy comes from version.json, not from the bundle, so the build stays
        // deterministic and `build && git diff --exit-code` is a meaningful check.
        sourcemap: false,
    },
    plugins: [
        react(),
        svgr(),
        rootStaticFiles(),
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
                globPatterns: ["**/*.{js,css,html,svg}"],
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
                // «finale-atlas-packs» cache and reads version.json with no-store to notice a new
                // deploy. Letting the service worker precache either would break both.
                // Matched against the *path* of the request, and the app is served from a folder
                // (https://chlaedderi.github.io/), so these must not be anchored at the
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
                            cacheName: "finale-atlas-tiles-v1",
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
        environment: "jsdom",
        setupFiles: "./src/test/setup.ts",
        root: ".",
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
