/**
 * Painting a rain-rate grid onto the map.
 *
 * The other two radars arrive as pictures, so Leaflet stacks their tiles and the animation is a
 * change of opacity. This one arrives as numbers on the Swiss grid, which is not web Mercator, so
 * every tile has to be drawn here -- and that turns out to be the better shape anyway: **one layer
 * repainted**, not twenty-four stacked. The data is already in memory, so a step costs a loop over
 * the live tiles and nothing else; twenty-four canvases would cost a hundred megabytes and have
 * nothing to show for it.
 *
 * Stretching one image over the grid's corners was the obvious cheap alternative and it is simply
 * wrong: the grid is a rectangle in the Swiss projection, Mercator stretches with latitude, and the
 * two disagree by kilometres in the middle. So each pixel is mapped properly -- and because that
 * mapping depends only on the tile, never on the frame, it is worked out once per tile and kept.
 */

import L from "leaflet";

import { cellAt, type RadarGrid } from "@core/radarGrid";

/** How many tiles' worth of index maps to keep. Each is 256 KB. */
const KEEP = 40;

const SIZE = 256;

/** A tile's identity, the same for its canvas and for its index map. */
const keyOf = (coords: { x: number; y: number; z: number }): string =>
    `${coords.z}/${coords.x}/${coords.y}`;

interface Painted extends HTMLCanvasElement {
    /** Which cell of the grid each pixel of this tile reads. -1 for «off the grid». */
    cells?: Int32Array;
}

export class RainGridLayer extends L.GridLayer {
    private readonly grid: RadarGrid;
    private readonly palette: Uint32Array;
    private frame: Uint8Array | null = null;
    /** The live tiles, so a frame change can repaint exactly them. */
    private readonly painted = new Map<string, Painted>();
    /** Index maps by tile key, so panning back costs nothing. */
    private readonly maps = new Map<string, Int32Array>();

    constructor(grid: RadarGrid, palette: Uint32Array, options?: L.GridLayerOptions) {
        super(options);
        this.grid = grid;
        this.palette = palette;
        // A tile that has scrolled away must stop being repainted on every step of the animation.
        this.on("tileunload", (event: L.TileEvent) => {
            this.painted.delete(keyOf(event.coords));
        });
    }

    /** Show this frame. Cheap: the pixels are a lookup away. */
    setFrame(cells: Uint8Array | null): void {
        this.frame = cells;
        for (const canvas of this.painted.values()) this.paint(canvas);
    }

    override onRemove(map: L.Map): this {
        super.onRemove(map);
        // This layer holds megabytes; letting them go with the layer is not optional.
        this.painted.clear();
        this.maps.clear();
        return this;
    }

    protected override createTile(coords: L.Coords): HTMLElement {
        const canvas = L.DomUtil.create("canvas") as Painted;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const key = keyOf(coords);
        canvas.cells = this.indexMap(key, coords);
        this.painted.set(key, canvas);
        this.paint(canvas);
        return canvas;
    }

    /**
     * Which grid cell each of a tile's 65 536 pixels falls in.
     *
     * Longitude depends only on the column and latitude only on the row, so the two transcendental
     * functions run 256 times each rather than 65 536; what is left in the inner loop is the
     * projection itself.
     */
    private indexMap(key: string, coords: L.Coords): Int32Array {
        const held = this.maps.get(key);
        if (held) return held;

        const world = SIZE * 2 ** coords.z;
        const lons = new Float64Array(SIZE);
        const lats = new Float64Array(SIZE);
        for (let c = 0; c < SIZE; c++) {
            lons[c] = (360 * (coords.x * SIZE + c + 0.5)) / world - 180;
            const y = (2 * Math.PI * (coords.y * SIZE + c + 0.5)) / world - Math.PI;
            lats[c] = 90 - (360 / Math.PI) * Math.atan(Math.exp(y));
        }

        const map = new Int32Array(SIZE * SIZE);
        for (let r = 0; r < SIZE; r++) {
            const lat = lats[r]!;
            const row = r * SIZE;
            for (let c = 0; c < SIZE; c++) map[row + c] = cellAt(this.grid, lat, lons[c]!);
        }

        this.maps.set(key, map);
        while (this.maps.size > KEEP) {
            const oldest = this.maps.keys().next().value;
            if (oldest === undefined) break;
            this.maps.delete(oldest);
        }
        return map;
    }

    private paint(canvas: Painted): void {
        const context = canvas.getContext("2d");
        const cells = canvas.cells;
        if (!context || !cells) return;

        const image = context.createImageData(SIZE, SIZE);
        const frame = this.frame;
        if (frame) {
            // One 32-bit store a pixel rather than four 8-bit ones: this runs 65 536 times a tile
            // and once more for every tile on every step of the animation.
            const words = new Uint32Array(image.data.buffer);
            for (let i = 0; i < words.length; i++) {
                const cell = cells[i]!;
                if (cell < 0) continue;
                const index = frame[cell]!;
                if (index !== 0) words[i] = this.palette[index]!;
            }
        }
        context.putImageData(image, 0, 0);
    }
}
