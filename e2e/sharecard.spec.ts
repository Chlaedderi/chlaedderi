import { expect, test } from "./fixtures";

/**
 * The card a shared link shows, as it is actually served.
 *
 * `src/share-card.test.ts` reads the template and the picture in the repository. This reads what a
 * crawler reads: the built `index.html` and the file it points at, from the root of the site, in
 * the layout the deploy publishes. The two are not the same check -- the template is a source file
 * the bundler rewrites, and the picture is a tracked file the bundler never sees at all, copied in
 * by `tools/make-site.sh`. A card can be perfect in the repository and absent from the site.
 *
 * Nothing here opens the app: a crawler does not run the script either.
 */

/** The one address, in punycode -- what the tags have to name, wherever the page is served from. */
const SITE = "https://xn--chldderi-2za.ch/";

test.describe("the share card", () => {
    test("the served page carries the tags a chat window reads", async ({ request }) => {
        const page = await request.get("/");
        expect(page.ok()).toBe(true);
        const html = await page.text();

        expect(html).toContain(`<meta property="og:image" content="${SITE}og.png"`);
        expect(html).toContain(`<meta property="og:url" content="${SITE}"`);
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
        // The name and the description are pinned elsewhere; that they survived the build is the
        // question here.
        expect(html).toContain('<meta property="og:title" content="Chlädderi"');
        expect(html).toMatch(/<meta\s+property="og:description"\s+content="Karte und Liste/);
    });

    test("the picture is there, at the address the page gives", async ({ request }) => {
        const picture = await request.get("/og.png");

        expect(picture.status()).toBe(200);
        expect(picture.headers()["content-type"]).toBe("image/png");
        // Big enough to be the card rather than an error page that happened to answer.
        expect((await picture.body()).byteLength).toBeGreaterThan(10_000);
    });
});
