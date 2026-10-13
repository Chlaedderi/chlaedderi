import L from "leaflet";
import { describe, expect, it } from "vitest";

import { textTip } from "./icons";

describe("textTip", () => {
    it("puts a car park's name into a tooltip as text, never as markup", () => {
        // A car park's name comes from a mappack, and Leaflet assigns a *string* to innerHTML.
        const name = '<img src=x onerror="window.pwned=1">';
        const host = document.createElement("div");
        document.body.append(host);
        const map = L.map(host).setView([46, 8], 10);
        const marker = L.marker([46, 8]).addTo(map).bindTooltip(textTip(name), { permanent: true });
        const el = marker.getTooltip()!.getElement()!;
        expect(el.querySelector("img")).toBeNull();
        expect(el.textContent).toBe(name);
        map.remove();
        host.remove();
    });
});
