/**
 * Write a value somewhere, but not on every change of it.
 *
 * Shared by the two mirrors of the filter state: the one into localStorage (Persistence.tsx) and
 * the one into the address bar (FilterUrl.tsx). Both have the same reason to wait -- dragging the
 * grade slider changes the state once per pixel, and neither a storage write nor a history entry
 * per pixel is wanted.
 *
 * The first value is never written: it is what the state already was, not a change to record.
 */

import { useEffect, useRef } from "react";

export const useDebouncedWrite = <T>(value: T, write: (value: T) => void, ms = 350): void => {
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const timer = setTimeout(() => write(value), ms);
        return () => clearTimeout(timer);
        // `write` is stable by construction at every call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, ms]);
};
