/** The two languages the app speaks. German follows Swiss spelling (ss, never ß). */
export type Lang = "en" | "de";

export const LANGS: readonly Lang[] = ["en", "de"];

export const isLang = (v: unknown): v is Lang => v === "en" || v === "de";

/** German for a German browser, English otherwise -- what the app has always done. */
export const detectLang = (navigatorLanguage: string | undefined = navigator.language): Lang =>
    String(navigatorLanguage ?? "en")
        .toLowerCase()
        .startsWith("de")
        ? "de"
        : "en";
