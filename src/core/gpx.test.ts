import { describe, expect, it } from "vitest";

import { toGpx } from "./gpx";

describe("toGpx", () => {
    const points = [
        [46.3167, 7.9881],
        [46.32, 7.99],
    ] as const;

    it("writes a track a hiking app can read", () => {
        const gpx = toGpx({ name: "Approach to Dossen", points });
        expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(gpx).toContain('<gpx version="1.1"');
        expect(gpx).toContain("<name>Approach to Dossen</name>");
        expect(gpx).toContain('<trkpt lat="46.316700" lon="7.988100"/>');
        expect(gpx.trimEnd().endsWith("</gpx>")).toBe(true);
    });

    it("is well-formed XML", () => {
        const doc = new DOMParser().parseFromString(
            toGpx({ name: "x", points }),
            "application/xml",
        );
        expect(doc.querySelector("parsererror")).toBeNull();
        expect(doc.querySelectorAll("trkpt")).toHaveLength(2);
    });

    it("escapes a crag name, which comes from a mappack", () => {
        const gpx = toGpx({
            name: 'Rocca & "Perti" <script>alert(1)</script>',
            points,
        });
        expect(gpx).not.toContain("<script>");
        expect(gpx).toContain("&amp;");
        expect(gpx).toContain("&lt;script&gt;");

        // And it is still well-formed with that name in it.
        const doc = new DOMParser().parseFromString(gpx, "application/xml");
        expect(doc.querySelector("parsererror")).toBeNull();
        expect(doc.querySelector("name")?.textContent).toBe(
            'Rocca & "Perti" <script>alert(1)</script>',
        );
    });

    it("keeps six decimals, which is about ten centimetres", () => {
        const gpx = toGpx({ name: "x", points: [[46.1, 7.2]] });
        expect(gpx).toContain('lat="46.100000" lon="7.200000"');
    });
});
