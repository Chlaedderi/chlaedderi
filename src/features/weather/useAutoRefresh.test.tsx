/**
 * The loop that replaced the «Wetter laden» button.
 *
 * The one that would be easy to get wrong is «survives a callback that changes identity»:
 * `WeatherProvider`'s `load` is rebuilt whenever `at`, `loading` or `crags` change, so an effect
 * that depended on it would tear the interval down and build it again after every single fetch,
 * and the five-minute tick would never arrive.
 */

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFRESH_MS, useAutoRefresh } from "./useAutoRefresh";

const Probe = ({
    load,
    enabled = true,
    placeKey = "",
}: {
    readonly load: () => void;
    readonly enabled?: boolean;
    readonly placeKey?: string;
}) => {
    useAutoRefresh(load, { enabled, key: placeKey });
    return null;
};

/** jsdom reports the page as visible and online; a test that wants otherwise says so. */
const setHidden = (hidden: boolean): void => {
    Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
};
const setOnline = (online: boolean): void => {
    Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
};

beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
    setOnline(true);
});

afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
    setOnline(true);
});

describe("loading without being asked", () => {
    it("loads once as soon as the card is on screen", () => {
        const load = vi.fn();
        render(<Probe load={load} />);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("loads again on the tick, and not before", () => {
        const load = vi.fn();
        render(<Probe load={load} />);
        load.mockClear();

        vi.advanceTimersByTime(REFRESH_MS - 1000);
        expect(load).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2000);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("keeps ticking when the callback is a new function on every render", () => {
        // The regression test for `WeatherProvider.load`, whose identity changes after each fetch.
        const calls = vi.fn();
        const { rerender } = render(<Probe load={() => calls()} />);
        calls.mockClear();

        for (let n = 0; n < 5; n++) rerender(<Probe load={() => calls()} />);
        expect(calls).not.toHaveBeenCalled();

        vi.advanceTimersByTime(REFRESH_MS);
        // Once, not once per re-render: the interval was never rebuilt.
        expect(calls).toHaveBeenCalledTimes(1);
    });
});

describe("not loading when it would be wasted", () => {
    it("stays quiet while the app is in the background", () => {
        const load = vi.fn();
        render(<Probe load={load} />);
        load.mockClear();
        setHidden(true);

        vi.advanceTimersByTime(REFRESH_MS * 2);
        expect(load).not.toHaveBeenCalled();

        // Coming back to the app is when it is wanted.
        setHidden(false);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("stays quiet while the device is offline, and loads when it comes back", () => {
        setOnline(false);
        const load = vi.fn();
        render(<Probe load={load} />);
        expect(load).not.toHaveBeenCalled();

        setOnline(true);
        window.dispatchEvent(new Event("online"));
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("fetches nothing at all when switched off", () => {
        const load = vi.fn();
        const { rerender } = render(<Probe load={load} enabled={false} />);
        vi.advanceTimersByTime(REFRESH_MS * 2);
        expect(load).not.toHaveBeenCalled();

        // Switching the rain marks back on fetches at once.
        rerender(<Probe load={load} enabled />);
        expect(load).toHaveBeenCalledTimes(1);
    });
});

describe("a different place", () => {
    it("loads at once rather than waiting for the next tick", () => {
        const load = vi.fn();
        const { rerender } = render(<Probe load={load} placeKey="finale" />);
        load.mockClear();

        rerender(<Probe load={load} placeKey="arco" />);
        expect(load).toHaveBeenCalledTimes(1);
    });
});

describe("leaving the page", () => {
    it("takes the timer and both listeners with it", () => {
        const load = vi.fn();
        const { unmount } = render(<Probe load={load} />);
        load.mockClear();

        unmount();

        vi.advanceTimersByTime(REFRESH_MS * 3);
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("online"));
        expect(load).not.toHaveBeenCalled();
    });
});
