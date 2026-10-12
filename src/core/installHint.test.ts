import { describe, expect, it } from "vitest";

import {
    ACTIVE_BEFORE_HINT,
    MAX_DISMISSALS,
    SNOOZE,
    VISIT_GAP,
    cleanInstallHint,
    countVisit,
    defaultInstallHint,
    dismissInstallHint,
    dueFor,
    installWay,
    isInAppBrowser,
    mayOffer,
    mergeInstallHint,
} from "./installHint";

const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW =
    "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36";
const INSTAGRAM_IOS = `${IPHONE} Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; de_CH)`;
const FACEBOOK_IOS = `${IPHONE} [FBAN/FBIOS;FBAV/480.0.0.0;FBBV/1]`;
const FIREFOX_DESKTOP = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

const DAY = 24 * 60 * 60 * 1000;

describe("cleanInstallHint", () => {
    it("starts from nothing when nothing was stored", () => {
        expect(cleanInstallHint(undefined)).toEqual(defaultInstallHint());
        expect(cleanInstallHint("nope")).toEqual(defaultInstallHint());
    });

    it("keeps what is sound and drops what is not", () => {
        expect(
            cleanInstallHint({
                visits: 3,
                lastVisit: 1000,
                dismissed: -1,
                snoozeUntil: Number.NaN,
                done: "yes",
            }),
        ).toEqual({ visits: 3, lastVisit: 1000, dismissed: 0, snoozeUntil: 0, done: false });
    });
});

describe("countVisit", () => {
    it("counts the first visit", () => {
        expect(countVisit(defaultInstallHint(), 5000)).toMatchObject({
            visits: 1,
            lastVisit: 5000,
        });
    });

    it("does not count a reload as a visit", () => {
        const first = countVisit(defaultInstallHint(), 0);
        expect(countVisit(first, VISIT_GAP - 1)).toBe(first);
    });

    it("counts coming back after a while", () => {
        const first = countVisit(defaultInstallHint(), 0);
        expect(countVisit(first, VISIT_GAP).visits).toBe(2);
    });
});

describe("mergeInstallHint", () => {
    it("keeps a stored «Not now» over a visit counted before storage answered", () => {
        const stored = {
            ...defaultInstallHint(),
            visits: 4,
            dismissed: MAX_DISMISSALS,
            snoozeUntil: 99,
        };
        const counted = countVisit(defaultInstallHint(), 50);
        expect(mergeInstallHint(stored, counted)).toEqual({
            visits: 4,
            lastVisit: 50,
            dismissed: MAX_DISMISSALS,
            snoozeUntil: 99,
            done: false,
        });
    });

    it("keeps «installed» from either side", () => {
        const done = { ...defaultInstallHint(), done: true };
        expect(mergeInstallHint(done, defaultInstallHint()).done).toBe(true);
        expect(mergeInstallHint(defaultInstallHint(), done).done).toBe(true);
    });
});

describe("mayOffer", () => {
    it("offers to somebody who was never asked", () => {
        expect(mayOffer(defaultInstallHint(), 0)).toBe(true);
    });

    it("stays quiet for a month after «Not now», then asks once more, then never", () => {
        const once = dismissInstallHint(defaultInstallHint(), 0);
        expect(mayOffer(once, SNOOZE - 1)).toBe(false);
        expect(mayOffer(once, SNOOZE)).toBe(true);

        let state = defaultInstallHint();
        for (let i = 0; i < MAX_DISMISSALS; i++) state = dismissInstallHint(state, 0);
        expect(mayOffer(state, 10 * 365 * DAY)).toBe(false);
    });

    it("never offers again once the app is installed", () => {
        expect(mayOffer({ ...defaultInstallHint(), done: true }, 0)).toBe(false);
    });
});

describe("dueFor", () => {
    const second = { ...defaultInstallHint(), visits: 2 };

    it("takes a moment at once, on any visit", () => {
        expect(dueFor(defaultInstallHint(), "pack", 0)).toBe("pack");
        expect(dueFor(defaultInstallHint(), "log", 0)).toBe("log");
    });

    it("waits for a few minutes of use on a later visit otherwise", () => {
        expect(dueFor(second, null, ACTIVE_BEFORE_HINT - 1)).toBeNull();
        expect(dueFor(second, null, ACTIVE_BEFORE_HINT)).toBe("time");
    });

    it("never uses the clock on a first visit", () => {
        expect(dueFor({ ...defaultInstallHint(), visits: 1 }, null, 60 * 60 * 1000)).toBeNull();
    });
});

describe("installWay", () => {
    const env = (ua: string, canPrompt = false, platform = "", maxTouchPoints = 0) => ({
        ua,
        canPrompt,
        platform,
        maxTouchPoints,
    });

    it("uses the browser's own dialog where it offers one", () => {
        expect(installWay(env(ANDROID_CHROME, true))).toBe("prompt");
    });

    it("shows the way by hand on an iPhone, and on an iPad that calls itself a Mac", () => {
        expect(installWay(env(IPHONE))).toBe("ios");
        expect(installWay(env(IPAD_AS_MAC, false, "MacIntel", 5))).toBe("ios");
    });

    it("sends an in-app browser out to a real one first", () => {
        expect(isInAppBrowser(INSTAGRAM_IOS)).toBe(true);
        expect(isInAppBrowser(FACEBOOK_IOS)).toBe(true);
        expect(isInAppBrowser(ANDROID_WEBVIEW)).toBe(true);
        expect(isInAppBrowser(ANDROID_CHROME)).toBe(false);
        expect(isInAppBrowser(IPHONE)).toBe(false);
        expect(installWay(env(INSTAGRAM_IOS))).toBe("inapp");
    });

    it("says nothing where nothing can be done", () => {
        expect(installWay(env(FIREFOX_DESKTOP))).toBeNull();
        // Chromium that has not handed over its event: installed already, or not yet installable.
        expect(installWay(env(ANDROID_CHROME))).toBeNull();
        // A real Mac has no touch points, and Safari there has no hint the page could give.
        expect(installWay(env(IPAD_AS_MAC, false, "MacIntel", 0))).toBeNull();
    });
});
