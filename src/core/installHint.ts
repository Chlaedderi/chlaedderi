/**
 * «You can also install this» -- when to say it, and how.
 *
 * The «More» page has always offered the install, but nobody goes there to look for it, and the
 * home-screen app is how this is meant to be used: it opens offline, one tap away, under a cliff
 * with no signal. So the app says so once, by itself -- at a moment where installing plainly helps,
 * or after a few minutes of real use on a later visit -- and then leaves people alone.
 *
 * Everything here is pure: the component in `features/shell/InstallHint.tsx` supplies the clock,
 * the user agent and what the browser offers, and these functions say what follows from them.
 */

/** What made this a good moment to mention it. `time` is the fallback, a few minutes of use. */
export type InstallMoment = "pack" | "fav" | "log" | "offline" | "time";

/**
 * How this browser can install.
 *
 * - `prompt`: Chromium handed over its install event, so a button can open the real dialog.
 * - `ios`: Safari and every other iOS browser can add to the home screen, but only by hand, from
 *   the share sheet. No API exists, so the most the app can do is show how.
 * - `inapp`: the browser built into another app (Instagram, Facebook …), which cannot install at
 *   all. The way there is to open the page in a real browser first.
 */
export type InstallWay = "prompt" | "ios" | "inapp";

/** What is remembered, inside the settings, so that nothing new needs a storage name. */
export interface InstallHintState {
    /** Visits so far: page loads at least `VISIT_GAP` apart. */
    readonly visits: number;
    /** When the last visit began, in ms. */
    readonly lastVisit: number;
    /** How often «Not now» was said. After `MAX_DISMISSALS`, never again. */
    readonly dismissed: number;
    /** Quiet until then, in ms. */
    readonly snoozeUntil: number;
    /** Installed from the hint or the «More» page: there is nothing left to say. */
    readonly done: boolean;
}

/** A reload is not a visit; coming back after half an hour is. */
export const VISIT_GAP = 30 * 60 * 1000;
/** Time in front of the viewer, on a later visit, before the fallback hint. */
export const ACTIVE_BEFORE_HINT = 3 * 60 * 1000;
/** How long «Not now» holds. */
export const SNOOZE = 30 * 24 * 60 * 60 * 1000;
/** Asked this often, and then never again. */
export const MAX_DISMISSALS = 2;

export const defaultInstallHint = (): InstallHintState => ({
    visits: 0,
    lastVisit: 0,
    dismissed: 0,
    snoozeUntil: 0,
    done: false,
});

const count = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;

/** Read back what was stored, checking every value: an older version may have written nothing. */
export const cleanInstallHint = (v: unknown): InstallHintState => {
    if (!v || typeof v !== "object") return defaultInstallHint();
    const x = v as Record<string, unknown>;
    return {
        visits: Math.floor(count(x.visits)),
        lastVisit: count(x.lastVisit),
        dismissed: Math.floor(count(x.dismissed)),
        snoozeUntil: count(x.snoozeUntil),
        done: x.done === true,
    };
};

/** The page was opened: one more visit, unless the last one began a moment ago. */
export const countVisit = (state: InstallHintState, now: number): InstallHintState =>
    state.visits > 0 && now - state.lastVisit < VISIT_GAP
        ? state
        : { ...state, visits: state.visits + 1, lastVisit: now };

/**
 * Two records of the same history -- what storage held and what this page has counted since --
 * taken together. Each value only ever grows, so the larger one is the later one. Without this the
 * visit counted at start would replace a stored «Not now» whenever the fast copy in localStorage
 * was gone and only the slower layers still had it, and somebody who had said no twice would be
 * asked again.
 */
export const mergeInstallHint = (a: InstallHintState, b: InstallHintState): InstallHintState => ({
    visits: Math.max(a.visits, b.visits),
    lastVisit: Math.max(a.lastVisit, b.lastVisit),
    dismissed: Math.max(a.dismissed, b.dismissed),
    snoozeUntil: Math.max(a.snoozeUntil, b.snoozeUntil),
    done: a.done || b.done,
});

/** «Not now»: quiet for a month, and one step closer to quiet for good. */
export const dismissInstallHint = (state: InstallHintState, now: number): InstallHintState => ({
    ...state,
    dismissed: state.dismissed + 1,
    snoozeUntil: now + SNOOZE,
});

/** Whether the hint may be shown at all, whatever the moment. */
export const mayOffer = (state: InstallHintState, now: number): boolean =>
    !state.done && state.dismissed < MAX_DISMISSALS && now >= state.snoozeUntil;

/**
 * What the hint would be about, or null when it is not time yet.
 *
 * A moment wins over the clock: it is the reason the hint can give. The clock alone needs a second
 * visit -- somebody looking at the app for the first time has not decided they want it yet.
 */
export const dueFor = (
    state: InstallHintState,
    moment: Exclude<InstallMoment, "time"> | null,
    activeMs: number,
): InstallMoment | null => {
    if (moment) return moment;
    return state.visits >= 2 && activeMs >= ACTIVE_BEFORE_HINT ? "time" : null;
};

/** iPhone, iPad, or an iPad that says it is a Mac -- which it does by default since iPadOS 13. */
export const isIOSDevice = (ua: string, platform: string, maxTouchPoints: number): boolean =>
    /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);

/**
 * The browsers built into other apps. They say who they are in the user agent, because their own
 * makers want to know; an Android WebView says `; wv)`. A link shared in one of those apps opens
 * here, and nothing in here can install.
 */
const IN_APP =
    /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|musical_ly|BytedanceWebview|LinkedInApp|; wv\)/;

export const isInAppBrowser = (ua: string): boolean => IN_APP.test(ua);

/** How this browser can install, or null when it cannot be helped to (Firefox on a desktop, say). */
export const installWay = (env: {
    readonly ua: string;
    readonly platform: string;
    readonly maxTouchPoints: number;
    /** Chromium's install event is being held. */
    readonly canPrompt: boolean;
}): InstallWay | null => {
    if (isInAppBrowser(env.ua)) return "inapp";
    if (env.canPrompt) return "prompt";
    if (isIOSDevice(env.ua, env.platform, env.maxTouchPoints)) return "ios";
    return null;
};
