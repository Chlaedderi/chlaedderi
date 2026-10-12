/**
 * «Install as an app».
 *
 * Chrome fires `beforeinstallprompt` and lets the page ask later; Safari never does, so on iOS the
 * app can only explain the Share → Add to Home Screen route in words. Both cases are covered,
 * because the home-screen app is how most people use this.
 *
 * The event is caught here, once, as the app starts -- not by whichever page wants the button.
 * Chrome fires it a moment after the page loads and never again, so a listener that waited for
 * the «More» page to open had usually missed it: the page then explained the browser menu instead
 * of offering the button, and Chrome put up its own install bar in the meantime, because nobody
 * had called `preventDefault()`. Held from the start, the button is there whenever it is wanted,
 * and the app's own hint (features/shell/InstallHint.tsx) is the only one anybody sees.
 */

import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let held: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = (): void => listeners.forEach((listener) => listener());

/** Start listening. Called once from main.tsx, before anything renders. */
export const watchInstallPrompt = (): void => {
    window.addEventListener("beforeinstallprompt", (e) => {
        // Keep it: the browser's own bar is suppressed, so the app offers the button itself.
        e.preventDefault();
        held = e as BeforeInstallPromptEvent;
        changed();
    });
    window.addEventListener("appinstalled", () => {
        held = null;
        installed = true;
        changed();
    });
};

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/**
 * Open the browser's install dialog. Resolves with what the viewer chose, or `unavailable` when
 * there is no event to use -- one event opens one dialog, and Chrome sends a new one if they say no.
 */
const install = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const event = held;
    if (!event) return "unavailable";
    held = null;
    changed();
    await event.prompt();
    return (await event.userChoice).outcome;
};

export const useInstallPrompt = (): {
    canInstall: boolean;
    /** Installed from this page just now, by any button. */
    installed: boolean;
    install: typeof install;
} => {
    const canInstall = useSyncExternalStore(subscribe, () => held !== null);
    const done = useSyncExternalStore(subscribe, () => installed);
    return { canInstall, installed: done, install };
};
