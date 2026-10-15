import { describe, expect, it } from "vitest";

import { fold, httpHref, i18, isPlain, oneLine, parseInline, slug } from "./text";

describe("i18", () => {
    it("picks the language and falls back rather than showing nothing", () => {
        expect(i18({ en: "Rock", de: "Fels" }, "de")).toBe("Fels");
        expect(i18({ en: "Rock", de: "Fels" }, "en")).toBe("Rock");
        expect(i18({ en: "Rock", de: "" }, "de")).toBe("Rock");
        expect(i18({ en: "", de: "Fels" }, "en")).toBe("Fels");
        expect(i18(null, "de")).toBe("");
        expect(i18(undefined, "en")).toBe("");
    });
});

describe("fold and slug", () => {
    it("strips accents and case", () => {
        expect(fold("Gorge de l'Hérault")).toBe("gorge de l'herault");
        expect(fold("Zeneggen")).toBe("zeneggen");
        expect(fold(null)).toBe("");
    });

    it("builds route keys the old code would have built", () => {
        expect(slug("Cordon Bleu")).toBe("cordon-bleu");
        expect(slug("  È vietato!  ")).toBe("e-vietato");
        expect(slug("5.10a / 6a+")).toBe("5-10a-6a");
        expect(slug("???")).toBe("");
    });
});

describe("parseInline", () => {
    it("leaves plain text alone", () => {
        expect(parseInline("Verrucano, solid and sharp")).toEqual([
            { kind: "text", text: "Verrucano, solid and sharp" },
        ]);
        expect(parseInline("")).toEqual([]);
        expect(parseInline(null)).toEqual([]);
    });

    it("reads bold and links", () => {
        expect(parseInline("see **Rocca** now")).toEqual([
            { kind: "text", text: "see " },
            { kind: "bold", text: "Rocca" },
            { kind: "text", text: " now" },
        ]);
        expect(parseInline("by [theCrag](https://www.thecrag.com/x) only")).toEqual([
            { kind: "text", text: "by " },
            { kind: "link", label: "theCrag", url: "https://www.thecrag.com/x" },
            { kind: "text", text: " only" },
        ]);
    });

    it("keeps a link's target intact, ampersands included", () => {
        const [token] = parseInline("[map](https://example.org/a?x=1&y=2)");
        expect(token).toEqual({
            kind: "link",
            label: "map",
            url: "https://example.org/a?x=1&y=2",
        });
    });

    // The parser is the only place pack text turns into markup, so these are the security tests.
    it("never yields markup for HTML in the data", () => {
        const tokens = parseInline("<script>alert(1)</script> and <img src=x onerror=y>");
        expect(tokens).toEqual([
            { kind: "text", text: "<script>alert(1)</script> and <img src=x onerror=y>" },
        ]);
        expect(tokens.every((t) => t.kind === "text")).toBe(true);
    });

    it.each([
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "data:text/html;base64,PHN2Zz4=",
        "vbscript:msgbox",
        "file:///etc/passwd",
        "//evil.example.org",
        "/relative/path",
    ])("refuses %s as a link target and keeps it literal", (url) => {
        const tokens = parseInline(`[click](${url})`);
        expect(tokens.some((t) => t.kind === "link")).toBe(false);
        expect(tokens.map((t) => ("text" in t ? t.text : "")).join("")).toContain(url);
    });

    it("does not let a label smuggle markup", () => {
        const tokens = parseInline("[<b>x</b>](https://example.org)");
        expect(tokens).toEqual([{ kind: "link", label: "<b>x</b>", url: "https://example.org" }]);
        // The label is data; the renderer puts it in as a text child, never as markup.
    });

    it("ignores an unterminated or over-long construct", () => {
        expect(parseInline("**not closed")).toEqual([{ kind: "text", text: "**not closed" }]);
        expect(parseInline("[no target]")).toEqual([{ kind: "text", text: "[no target]" }]);
        const longLabel = "x".repeat(200);
        expect(parseInline(`[${longLabel}](https://example.org)`)).toEqual([
            { kind: "text", text: `[${longLabel}](https://example.org)` },
        ]);
        const longUrl = `https://example.org/${"a".repeat(500)}`;
        expect(parseInline(`[y](${longUrl})`)).toEqual([{ kind: "text", text: `[y](${longUrl})` }]);
    });

    it("handles several constructs in one string", () => {
        expect(parseInline("**a** then [b](https://e.org) then **c**")).toEqual([
            { kind: "bold", text: "a" },
            { kind: "text", text: " then " },
            { kind: "link", label: "b", url: "https://e.org" },
            { kind: "text", text: " then " },
            { kind: "bold", text: "c" },
        ]);
    });

    it("round-trips the text of the showcase pack without producing markup", async () => {
        const pack = (await import("../../maps/pack.showcase.json")) as unknown as {
            default: { text?: { pages?: { blocks: Record<string, unknown>[] }[] } };
        };
        const pages = pack.default.text?.pages ?? [];
        for (const page of pages) {
            for (const block of page.blocks) {
                for (const value of Object.values(block)) {
                    const strings = Array.isArray(value)
                        ? value.flatMap((v) => Object.values(v as object))
                        : typeof value === "object" && value
                          ? Object.values(value)
                          : [value];
                    for (const s of strings) {
                        if (typeof s !== "string") continue;
                        for (const token of parseInline(s)) {
                            if (token.kind === "link") {
                                expect(token.url).toMatch(/^https?:\/\//);
                            }
                        }
                    }
                }
            }
        }
    });
});

describe("isPlain", () => {
    it("tells a caller when it can skip the token walk", () => {
        expect(isPlain("just words")).toBe(true);
        expect(isPlain("**bold**")).toBe(false);
        expect(isPlain("[a](https://e.org)")).toBe(false);
        expect(isPlain(null)).toBe(true);
    });
});

describe("isPlain is stateless", () => {
    it("gives the same answer for the same string twice", () => {
        // A `/g` regex carries lastIndex between `.test()` calls; this would flip to true.
        const s = "[a](https://e.org)";
        expect(isPlain(s)).toBe(false);
        expect(isPlain(s)).toBe(false);
        expect(isPlain(s)).toBe(false);
    });
});

/**
 * The install confirmation shows a stranger's pack name and notes beside the host it came from,
 * and the viewer reads that line to decide whether to trust it. The schema bounds neither.
 */
describe("oneLine", () => {
    it("leaves a short, ordinary name as it is", () => {
        expect(oneLine("Finale Ligure", 80)).toBe("Finale Ligure");
    });

    it("folds the newlines a name has no business carrying", () => {
        expect(oneLine("Finale\n\n\nLigure\t\tOvest", 80)).toBe("Finale Ligure Ovest");
    });

    it("cuts a name that would push the host off the screen", () => {
        const cut = oneLine("A".repeat(200), 80);
        expect(cut).toHaveLength(80);
        expect(cut.endsWith("…")).toBe(true);
    });

    it("strips the characters that reorder a line invisibly", () => {
        // U+202E turns what follows around, so a name can appear to end at another host.
        expect(oneLine("gro‮gnl.elpmaxe", 80)).toBe("grognl.elpmaxe");
        expect(oneLine("⁦a⁩b‎", 80)).toBe("ab");
    });

    it("has nothing to say about an absent string", () => {
        expect(oneLine(null, 80)).toBe("");
        expect(oneLine(undefined, 80)).toBe("");
    });
});

describe("httpHref", () => {
    it("keeps an http(s) target", () => {
        expect(httpHref("https://commons.wikimedia.org/x")).toBe("https://commons.wikimedia.org/x");
        expect(httpHref("HTTP://example.ch")).toBe("HTTP://example.ch");
    });

    it("gives no target for any other scheme a pack might carry", () => {
        for (const url of [
            "javascript:alert(1)",
            "intent://x#Intent;package=evil;end",
            "tel:+41000",
            "data:text/html,x",
            "//evil.example",
            "",
            null,
            undefined,
        ]) {
            expect(httpHref(url), String(url)).toBeUndefined();
        }
    });
});
