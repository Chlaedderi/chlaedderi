/**
 * The iPhone home-screen app with its translucent status bar.
 *
 * WebKit lays such a page out one status bar short (WebKit bug 301108): the page starts at the very
 * top, but its height ends above the bottom of the screen, and nothing can be drawn into the strip
 * that remains -- only the page background shows there. That strip is as tall as the status bar,
 * i.e. taller than the home-indicator inset, so the app uses it *as* that inset: `html.deadzone`
 * makes the bars drop their own bottom padding (`--sab`, see tokens.css) and gives the page
 * background the colour of the bars. The hand-written app did exactly this (`fitViewport`).
 */

const isIOS = (): boolean =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const standalone = (): boolean =>
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    matchMedia("(display-mode: standalone)").matches;

export const fitViewport = (): number => {
    const root = document.documentElement;
    let dead = 0;
    try {
        if (isIOS() && standalone()) {
            const portrait = matchMedia("(orientation: portrait)").matches;
            const full = portrait
                ? Math.max(screen.width, screen.height)
                : Math.min(screen.width, screen.height);
            const d = full - window.innerHeight;
            // One status bar; anything else is a window that is simply smaller than the screen.
            if (d >= 16 && d <= 70) dead = d;
        }
    } catch {
        dead = 0;
    }
    root.classList.toggle("deadzone", dead > 0);
    root.style.setProperty("--dead", `${dead}px`);
    return dead;
};

/** Measure now and whenever the screen turns or the page comes back. */
export const watchViewport = (): void => {
    fitViewport();
    window.addEventListener("orientationchange", () => setTimeout(fitViewport, 400));
    window.addEventListener("pageshow", fitViewport);
    window.addEventListener("resize", fitViewport);
};
