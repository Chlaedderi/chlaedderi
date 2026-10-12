/**
 * The name of the app, in one place.
 *
 * It used to be written out by hand in eight unrelated files -- the window title, the manifest,
 * the GPX creator, the share sheet, the CSV filename -- which is how the app managed to call itself
 * three different things at once, one of them in the favicon where nobody looks. Everything that
 * needs the name in code reads it from here; the files that cannot import (index.html,
 * manifest.webmanifest, favicon.svg, the two language files) are held to it by `src/name.test.ts`.
 *
 * `APP_SLUG` is the same name where only ASCII is safe: a package name, a download filename.
 */

export const APP_NAME = "Chlädderi";

export const APP_SLUG = "chlaedderi";
