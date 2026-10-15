import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDebouncedWrite } from "./useDebouncedWrite";

afterEach(() => {
    vi.useRealTimers();
});

describe("useDebouncedWrite", () => {
    it("writes a change once, after the wait", () => {
        vi.useFakeTimers();
        const write = vi.fn();
        const { rerender } = renderHook(({ v }) => useDebouncedWrite(v, write), {
            initialProps: { v: 1 },
        });
        rerender({ v: 2 });
        expect(write).not.toHaveBeenCalled();
        vi.advanceTimersByTime(400);
        expect(write).toHaveBeenCalledExactlyOnceWith(2);
    });

    it("writes what is still waiting when the page is left", () => {
        // An ascent saved just before the app is swiped away must not be lost to the wait.
        vi.useFakeTimers();
        const write = vi.fn();
        const { rerender } = renderHook(({ v }) => useDebouncedWrite(v, write), {
            initialProps: { v: "a" },
        });
        rerender({ v: "b" });
        window.dispatchEvent(new Event("pagehide"));
        expect(write).toHaveBeenCalledExactlyOnceWith("b");
        // And not a second time when the timer would have fired.
        vi.advanceTimersByTime(400);
        expect(write).toHaveBeenCalledTimes(1);
    });
});
