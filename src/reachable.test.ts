/**
 * Every feature module must actually be reachable from the app.
 *
 * `parity.test.ts` asserts that a module exists and exports a named symbol. That is not the same
 * claim as «the feature works», and the difference was not academic: `features/shell/useShare.ts`
 * was written, exported `useShare`, passed the parity test -- and was imported by nothing at all,
 * so sharing a crag or a route was simply missing from the app for as long as that test was green.
 *
 * This walks the real import graph from the entry point. A module nothing imports fails here, which
 * is the cheapest possible guard against writing a feature and forgetting to wire it up.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = resolve("src");
const ENTRY = resolve(SRC, "main.tsx");

/** The same aliases vite.config.ts and tsconfig.json declare. */
const ALIASES: Record<string, string> = {
    "@core": resolve(SRC, "core"),
    "@services": resolve(SRC, "services"),
    "@features": resolve(SRC, "features"),
    "@app": resolve(SRC, "app"),
    "@domain": resolve(SRC, "types"),
    "@i18n": resolve(SRC, "i18n"),
};

/** Every `.ts`/`.tsx` under `src/`, as paths relative to it. */
const listSources = (dir = SRC, prefix = ""): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return listSources(resolve(dir, entry.name), name);
        return /\.tsx?$/.test(entry.name) ? [name] : [];
    });

/** Resolve one import specifier to a file in `src/`, or null when it leaves the project. */
const resolveSpecifier = (spec: string, fromFile: string): string | null => {
    let base: string | null = null;
    if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
    else {
        for (const [alias, target] of Object.entries(ALIASES)) {
            if (spec === alias || spec.startsWith(`${alias}/`)) {
                base = resolve(target, spec.slice(alias.length + 1));
                break;
            }
        }
    }
    if (base === null) return null;

    for (const candidate of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        resolve(base, "index.ts"),
        resolve(base, "index.tsx"),
    ]) {
        try {
            if (readFileSync(candidate).length >= 0) return candidate;
        } catch {
            // Not this one; try the next extension.
        }
    }
    return null;
};

const IMPORT =
    /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const reachableFrom = (entry: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length) {
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        let text: string;
        try {
            text = readFileSync(file, "utf8");
        } catch {
            continue;
        }
        for (const match of text.matchAll(IMPORT)) {
            const spec = match[1] ?? match[2];
            if (!spec) continue;
            const next = resolveSpecifier(spec, file);
            if (next && !seen.has(next)) queue.push(next);
        }
    }
    return seen;
};

describe("every feature module is reachable from the entry point", () => {
    const reachable = reachableFrom(ENTRY);

    // Only the feature and service layers: `core/` is pure logic that tests may legitimately be
    // the sole consumer of, and `testing/` exists for the tests themselves.
    const shipped = listSources().filter(
        (file) =>
            (file.startsWith("features/") || file.startsWith("services/")) &&
            !file.includes(".test.") &&
            !file.endsWith(".d.ts"),
    );

    it("finds the entry point's graph at all", () => {
        expect(reachable.size).toBeGreaterThan(50);
    });

    it.each(shipped)("%s is imported by something the app renders", (file: string) => {
        expect(reachable.has(resolve(SRC, file))).toBe(true);
    });
});
