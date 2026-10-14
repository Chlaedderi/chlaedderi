/**
 * The install confirmation is where a stranger's host is put in front of a viewer, so what this
 * module refuses matters more than what it shows. These vectors are the control: each one is a
 * real punycode label, and the comment beside it says what it would read as on that line.
 */

import { describe, expect, it } from "vitest";

import { fromPunycode, shownHost } from "./idn";
import { APP_NAME } from "./name";

describe("fromPunycode", () => {
    it.each([
        ["xn--chldderi-2za", APP_NAME.toLowerCase()],
        ["xn--bcher-kva", "bücher"],
        ["xn--mnchen-3ya", "münchen"],
        ["xn--lpler-fra", "älpler"],
        ["xn--tda", "ü"],
        ["xn--e1afmkfd", "пример"],
    ])("reads a label back to the characters it stands for: %s", (given, wanted) => {
        expect(fromPunycode(given)).toBe(wanted);
    });

    it("refuses a label that decodes to nothing but ASCII", () => {
        // Well-formed punycode for «paypal», and `new URL()` hands `xn--paypal-.com` over
        // untouched: without this, a host writes whatever ASCII it likes into the display.
        expect(fromPunycode("xn--paypal-")).toBeNull();
        expect(fromPunycode("xn--chlaedderi-")).toBeNull();
    });

    it("refuses a surrogate, which is the one character with two spellings", () => {
        // `xn--kv9bzx` is the two halves and `xn--9h45d` is the character itself. A string here is
        // UTF-16, so they are the same string -- and one host would have two punycode spellings.
        expect(fromPunycode("xn--kv9bzx")).toBeNull();
    });

    it.each([
        ["xn--", "no extension at all"],
        ["xn---", "a delimiter and nothing else"],
        ["xn--a-0", "a number that runs off the end of the label"],
        ["xn--99999999999", "an overflow, which must come back rather than loop"],
        ["xn--TDA", "upper case, which is not a spelling a resolver hands back"],
        ["xn--b!r", "a character that is not in the alphabet"],
        ["example", "not an international label at all"],
    ])("refuses %s -- %s", (given) => {
        expect(fromPunycode(given)).toBeNull();
    });

    it("refuses a label longer than DNS allows", () => {
        // Also what keeps the insertion loop off a hostile hundred-kilobyte «host».
        expect(fromPunycode(`xn--${"a".repeat(70)}`)).toBeNull();
    });
});

describe("shownHost", () => {
    it("reads this site's own domain back into the name it is served under", () => {
        expect(shownHost("xn--chldderi-2za.ch")).toBe(`${APP_NAME.toLowerCase()}.ch`);
        expect(shownHost("packs.xn--chldderi-2za.ch")).toBe(`packs.${APP_NAME.toLowerCase()}.ch`);
    });

    it("splits the port off before the labels, and puts it back", () => {
        expect(shownHost("xn--chldderi-2za.ch:4173")).toBe(`${APP_NAME.toLowerCase()}.ch:4173`);
    });

    it.each([
        ["xn--bcher-kva.de", "bücher.de"],
        ["xn--mnchen-3ya.de", "münchen.de"],
        ["xn--lpler-fra.ch", "älpler.ch"],
    ])("shows an ordinary European host by its name: %s", (given, wanted) => {
        expect(shownHost(given)).toBe(wanted);
    });

    it.each([
        "127.0.0.1:4173",
        "example.org",
        "raw.githubusercontent.com",
        "gist.githubusercontent.com",
        "[::1]:8080",
        "localhost",
        "",
    ])("leaves an address with nothing to read alone: %s", (given) => {
        // Byte for byte: the browser suite pins the dev server's own host on five screens.
        expect(shownHost(given)).toBe(given);
    });

    it.each([
        ["xn--80ak6aa92e.com", "аррӏе.com, in Cyrillic"],
        ["xn--e1afmkfd.org", "пример.org -- honest, and still not ours to read"],
        ["xn--pple-43d.com", "аpple.com, with a Cyrillic а in front"],
        ["xn--ggle-55da.com", "gооgle.com, with Greek omicrons inside"],
        ["xn--n3h.net", "a snowman"],
    ])("keeps a host written in another script as it arrived: %s -- %s", (given) => {
        expect(shownHost(given)).toBe(given);
    });

    it.each([
        ["xn--fa-hia.de", "faß.de, which is a different registration from fass.de"],
        ["xn--bucher-xyd.de", "bu and a combining diaeresis, which renders as bücher.de"],
        ["xn--trasse-9pb.de", "ſtrasse.de, where ſ reads as an f"],
        ["xn--kaao-m0a.de", "kaĸao.de, where ĸ reads as a k"],
        ["xn--wkipedia-tkb.de", "wıkipedia.de, where ı reads as an i"],
        ["xn---chldderi-2za.ch", "a label starting with a hyphen, which DNS does not carry"],
        ["xn--xn--bl-gua.de", "xn--blä.de, which reads as punycode itself"],
        ["xn--chldderi-96a.ch", "an upper-case letter, which no resolver hands back"],
    ])("keeps a Latin host it cannot vouch for as it arrived: %s -- %s", (given) => {
        expect(shownHost(given)).toBe(given);
    });

    it.each([
        ["xn--chldderi-l0a.ch", "chlædderi.ch, which reads as this app's ASCII spelling"],
        ["xn--ch1dderi-2za.ch", "ch1ädderi.ch, with a digit for a letter"],
        ["xn--chdderi-6wa95f.ch", "chłädderi.ch, with a stroked l"],
        ["xn--chlderi-7wa91b.ch", "chläđderi.ch, with a stroked d"],
        ["xn--cldderi-6wa51d.ch", "cħlädderi.ch, with a stroked h"],
    ])("refuses this app's own name spelled any way but its own: %s -- %s", (given) => {
        // The allowlist bounds what alphabet a hostile label may use, not what it may be mistaken
        // for, and this is the one name the app has taught its readers to trust.
        expect(shownHost(given)).toBe(given);
    });

    it("puts the whole host back when one label cannot be read", () => {
        // A host showing one label as a name and the next as punycode would ask the reader to
        // notice which half is which, in the line where they are least able to.
        expect(shownHost("xn--bcher-kva.xn--e1afmkfd.org")).toBe("xn--bcher-kva.xn--e1afmkfd.org");
    });

    it("reads a name in the leftmost label, which is the attacker's to choose", () => {
        // Knowingly allowed, and the limit of what this can do: the tail of a host is the part
        // that decides, and no decoder makes an unfamiliar host judgeable.
        expect(shownHost("xn--chldderi-2za.ch.evil.example")).toBe(
            `${APP_NAME.toLowerCase()}.ch.evil.example`,
        );
        expect(shownHost("chlaedderi.ch.evil.example")).toBe("chlaedderi.ch.evil.example");
    });
});
