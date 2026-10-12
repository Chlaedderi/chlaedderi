/**
 * «Install as an app».
 *
 * Chrome fires `beforeinstallprompt` and lets the page ask later; Safari never does, so on iOS the
 * app can only explain the Share → Add to Home Screen route in words. Both cases are covered,
 * because the home-screen app is how most people use this.
 */

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const isIOS = (): boolean =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const useInstallPrompt = (): { canInstall: boolean; install: () => void } => {
    const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const held = (e: Event): void => {
            // Keep it: the browser's own bar is suppressed, so the app offers the button itself.
            e.preventDefault();
            setEvent(e as BeforeInstallPromptEvent);
        };
        const installed = (): void => setEvent(null);
        window.addEventListener("beforeinstallprompt", held);
        window.addEventListener("appinstalled", installed);
        return () => {
            window.removeEventListener("beforeinstallprompt", held);
            window.removeEventListener("appinstalled", installed);
        };
    }, []);

    return {
        canInstall: event !== null,
        install: () => {
            if (!event) return;
            void event.prompt().then(() => setEvent(null));
        },
    };
};
