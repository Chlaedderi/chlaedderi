/**
 * base64url, the alphabet a URL can carry.
 *
 * Plain base64 spends `+`, `/` and `=` on characters that mean something else in a query string or
 * a fragment, so everything the app puts into a link uses the URL-safe alphabet with the padding
 * stripped. This was written out twice before -- once for the transfer code in store.ts, once for
 * the pack key in packs/chlpack.ts -- and the two spellings had already drifted apart on what they
 * accept back.
 *
 * `fromB64url` answers null rather than throwing: everything that decodes here arrived from
 * somewhere else, and none of it is worth taking the app down for.
 */

export const toB64url = (bytes: Uint8Array): string => {
    let binary = "";
    // Not `String.fromCharCode(...bytes)`: a long pack code would blow the argument limit.
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const fromB64url = (text: string): Uint8Array | null => {
    // Whitespace survives being pasted through a chat window and means nothing here.
    const clean = text.replace(/\s+/g, "");
    if (!clean || !/^[A-Za-z0-9_-]+$/.test(clean)) return null;
    try {
        const padded = clean
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(clean.length / 4) * 4, "=");
        return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
    } catch {
        return null;
    }
};

/** The same pair, for the JSON both callers actually carry. */
export const jsonToB64url = (value: unknown): string =>
    toB64url(new TextEncoder().encode(JSON.stringify(value)));

/** The object, or null for anything that is not one. */
export const jsonFromB64url = (text: string): unknown => {
    const bytes = fromB64url(text);
    if (!bytes) return null;
    try {
        // `fatal`, so that bytes which are not UTF-8 are rejected rather than turned into U+FFFD.
        const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        return value && typeof value === "object" ? value : null;
    } catch {
        return null;
    }
};
