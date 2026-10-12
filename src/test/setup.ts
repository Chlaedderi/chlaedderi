import { webcrypto } from "node:crypto";

import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { configure } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Most screens arrive through React.lazy, so a findBy* has a chunk to load before the element
// exists. The default second is enough on an idle machine and not always enough when the whole
// suite runs at once, which showed up as a test that failed only in the full run.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
    cleanup();
});

// jsdom has no IntersectionObserver, which the crag page's jump rail uses to follow the reader.
// A stub that observes nothing is enough: what the rail does with it is checked in the browser.
if (!window.IntersectionObserver) {
    class StubObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): [] {
            return [];
        }
        readonly root = null;
        readonly rootMargin = "";
        readonly thresholds: readonly number[] = [];
    }
    window.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver;
    globalThis.IntersectionObserver = window.IntersectionObserver;
}

// The weather and the forecast fetch themselves as soon as their cards are on screen, so a test
// that renders the crag page would reach Open-Meteo for real. Nothing in the unit suite is allowed
// near the network: a test that wants an answer stubs `fetch` itself.
beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in tests"));
});

afterEach(() => {
    vi.restoreAllMocks();
});

// jsdom has a `crypto` with getRandomValues and no `subtle` at all, so every WebCrypto call in
// src/core/packs/chlpack.ts would be a TypeError here. Node's own implementation is the same one
// the browser runs, so lending it to the tests tests the real thing rather than a mock of it.
if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

// jsdom has no matchMedia, which MUI's useMediaQuery and the app's own phone check both use.
if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
}
