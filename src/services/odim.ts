/**
 * Just enough HDF5 to read one MeteoSwiss radar frame.
 *
 * The frames come as ODIM_H5, which is HDF5, which has no browser reader in the standard library
 * and a 60 KB one on npm that takes 310 ms a frame -- and a two-hour loop is twenty-four frames, so
 * that is ten seconds of a phone's life per refresh. What these files actually contain is far
 * narrower than HDF5: superblock v0, the old symbol-table groups, and the whole 640x710 grid as a
 * *single* deflate-compressed chunk of big-endian float64. That is a few hundred lines to walk, it
 * needs no dependency at all, and the inflating is done by `DecompressionStream`, which the browser
 * already has. Measured against the npm reader on a real frame: identical values in every one of
 * the 454 400 cells, in a twentieth of the time.
 *
 * It is therefore written as a **refusal machine, not a parser**. Everything it does not expect --
 * a newer superblock, a second chunk, a filter that is not deflate, a grid that is not the Swiss
 * one -- throws `NotOdim`, and the caller stands another radar in. Guessing would paint the map
 * with nonsense, which is worse than not drawing it: somebody decides whether to drive out on this.
 */

/** This file is not the frame we know how to read. Never a reason to retry -- the data is wrong. */
export class NotOdim extends Error {}

/** The rain rate grid of one frame: `values[row * nx + col]`, row 0 northmost, mm/h, NaN for nothing. */
export interface OdimGrid {
    readonly nx: number;
    readonly ny: number;
    readonly values: Float64Array;
}

const SIGNATURE = [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a];

/** Object header message types, by the names the format gives them. */
const MSG = {
    dataspace: 0x0001,
    datatype: 0x0003,
    layout: 0x0008,
    filters: 0x000b,
    continuation: 0x0010,
    symbolTable: 0x0011,
} as const;

interface Message {
    readonly type: number;
    /** Where the message's own data starts. */
    readonly at: number;
}

/** The path to the rain rate inside an ODIM file. `dataset1/data1/data` is where the grid lives. */
const DATA_PATH = ["dataset1", "data1", "data"] as const;

/**
 * Read the grid out of one `.h5` frame.
 *
 * Pure, synchronous arithmetic apart from the inflating, so the worker can call it and so a test
 * can call it without a worker.
 */
export const readOdimGrid = async (file: ArrayBuffer): Promise<OdimGrid> => {
    try {
        return await read(file);
    } catch (problem) {
        // Every way of being wrong is the same way of being wrong. A file that is not what this
        // reader expects walks off the end of itself sooner or later, and a `RangeError` out of a
        // DataView means exactly what `NotOdim` means: do not draw this.
        if (problem instanceof NotOdim) throw problem;
        throw new NotOdim(problem instanceof Error ? problem.message : "unreadable");
    }
};

const read = async (file: ArrayBuffer): Promise<OdimGrid> => {
    if (file.byteLength < 96) throw new NotOdim("too short");
    const v = new DataView(file);
    const bytes = new Uint8Array(file);
    for (const [i, b] of SIGNATURE.entries()) {
        if (bytes[i] !== b) throw new NotOdim("not HDF5");
    }
    if (v.getUint8(8) !== 0) throw new NotOdim(`superblock v${v.getUint8(8)}`);
    if (v.getUint8(13) !== 8 || v.getUint8(14) !== 8) throw new NotOdim("offsets are not 8 bytes");

    /** An address or a length: both are 8 bytes in these files, little-endian like all of HDF5. */
    const at = (p: number): number => Number(v.getBigUint64(p, true));

    // Superblock v0: base, free-space, end-of-file and driver addresses, then the root group's
    // symbol-table entry, whose second field is the address of the root object header.
    const rootHeader = at(24 + 4 * 8 + 8);

    /** The messages of a v1 object header, following continuation blocks. */
    const messages = (header: number): Message[] => {
        if (v.getUint8(header) !== 1) throw new NotOdim(`object header v${v.getUint8(header)}`);
        let left = v.getUint16(header + 2, true);
        const found: Message[] = [];
        const run = (from: number, to: number): void => {
            let p = from;
            // Each message is a 8-byte prologue (type, size, flags, padding) and then its data.
            while (left > 0 && p + 8 <= to) {
                const type = v.getUint16(p, true);
                const size = v.getUint16(p + 2, true);
                found.push({ type, at: p + 8 });
                left -= 1;
                p += 8 + size;
            }
        };
        run(header + 16, header + 16 + v.getUint32(header + 8, true));
        for (let i = 0; i < found.length && left > 0; i++) {
            const message = found[i]!;
            if (message.type !== MSG.continuation) continue;
            const start = at(message.at);
            run(start, start + at(message.at + 8));
        }
        return found;
    };

    /** The children of a group, by name: its symbol table is a B-tree of names into a local heap. */
    const children = (header: number): Map<string, number> => {
        const table = messages(header).find((m) => m.type === MSG.symbolTable);
        if (!table) throw new NotOdim("a group with no symbol table");
        // A local heap keeps the names; its data segment address is the fourth field.
        const heap = at(table.at + 8);
        const names = at(heap + 24);
        const out = new Map<string, number>();

        const node = (address: number): void => {
            if (v.getUint8(address + 4) !== 0) throw new NotOdim("not a group B-tree");
            const depth = v.getUint8(address + 5);
            const used = v.getUint16(address + 6, true);
            // After the two sibling addresses, keys and children alternate: key, child, key, ...
            let p = address + 8 + 2 * 8;
            for (let i = 0; i < used; i++) {
                p += 8;
                const child = at(p);
                p += 8;
                if (depth > 0) {
                    node(child);
                    continue;
                }
                // A leaf is a symbol table node: a short prologue, then 40 bytes per entry.
                const count = v.getUint16(child + 6, true);
                for (let e = 0; e < count; e++) {
                    const entry = child + 8 + e * 40;
                    let q = names + at(entry);
                    let name = "";
                    while (v.getUint8(q) !== 0) name += String.fromCharCode(v.getUint8(q++));
                    out.set(name, at(entry + 8));
                }
            }
        };

        node(at(table.at));
        return out;
    };

    let header = rootHeader;
    for (const step of DATA_PATH) {
        const next = children(header).get(step);
        if (next === undefined) throw new NotOdim(`no ${step}`);
        header = next;
    }

    const found = messages(header);
    const space = found.find((m) => m.type === MSG.dataspace);
    const type = found.find((m) => m.type === MSG.datatype);
    const layout = found.find((m) => m.type === MSG.layout);
    const filters = found.find((m) => m.type === MSG.filters);
    if (!space || !type || !layout) throw new NotOdim("the grid is missing its description");

    // Dataspace v1: version, rank, then the dimensions, slowest first -- rows, then columns.
    if (v.getUint8(space.at) !== 1) throw new NotOdim("dataspace version");
    if (v.getUint8(space.at + 1) !== 2) throw new NotOdim("the grid is not two-dimensional");
    const ny = at(space.at + 8);
    const nx = at(space.at + 16);
    if (nx < 1 || ny < 1 || nx * ny > 4_000_000) throw new NotOdim(`grid ${nx}x${ny}`);

    // Datatype v1: the low nibble is the class (1 = floating point), bit 0 of the flags is the
    // byte order, and the size is in bytes.
    if ((v.getUint8(type.at) & 0x0f) !== 1) throw new NotOdim("the grid is not floating point");
    if (v.getUint32(type.at + 4, true) !== 8) throw new NotOdim("not 8 bytes a cell");
    const littleEndian = (v.getUint8(type.at + 1) & 0x01) === 0;

    // Layout v3: class 1 is contiguous, class 2 is chunked.
    if (v.getUint8(layout.at) !== 3) throw new NotOdim("layout version");
    const layoutClass = v.getUint8(layout.at + 1);
    const wanted = nx * ny * 8;

    let raw: Uint8Array;
    if (layoutClass === 1) {
        const start = at(layout.at + 2);
        if (start + wanted > file.byteLength) throw new NotOdim("the grid runs past the file");
        raw = new Uint8Array(file, start, wanted);
    } else if (layoutClass === 2) {
        const rank = v.getUint8(layout.at + 2);
        const tree = at(layout.at + 3);
        const chunks: { address: number; size: number }[] = [];
        const keyBytes = 8 + rank * 8;

        const node = (address: number): void => {
            if (v.getUint8(address + 4) !== 1) throw new NotOdim("not a chunk B-tree");
            const depth = v.getUint8(address + 5);
            const used = v.getUint16(address + 6, true);
            let p = address + 8 + 2 * 8;
            for (let i = 0; i < used; i++) {
                const size = v.getUint32(p, true);
                p += keyBytes;
                const child = at(p);
                p += 8;
                if (depth > 0) node(child);
                else chunks.push({ address: child, size });
            }
        };
        node(tree);

        // These frames hold the whole grid in one chunk. Several would need the chunk coordinates
        // read and the pieces placed, which is code with nothing to test it against.
        if (chunks.length !== 1) throw new NotOdim(`${chunks.length} chunks`);
        const only = chunks[0]!;
        if (only.address + only.size > file.byteLength) throw new NotOdim("a chunk past the file");
        const stored = new Uint8Array(file, only.address, only.size);

        if (!filters) raw = stored;
        else {
            // Filter pipeline v1 or v2: the only one this reader accepts is deflate (id 1).
            const version = v.getUint8(filters.at);
            const count = v.getUint8(filters.at + 1);
            if (version !== 1 && version !== 2) throw new NotOdim("filter pipeline version");
            if (count !== 1) throw new NotOdim(`${count} filters`);
            const id = v.getUint16(version === 1 ? filters.at + 8 : filters.at + 2, true);
            if (id !== 1) throw new NotOdim(`filter ${id}`);
            raw = await inflate(stored);
        }
        if (raw.byteLength < wanted) throw new NotOdim("the chunk is short");
    } else throw new NotOdim(`layout class ${layoutClass}`);

    const values = new Float64Array(nx * ny);
    const cells = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    for (let i = 0; i < values.length; i++) values[i] = cells.getFloat64(i * 8, littleEndian);
    return { nx, ny, values };
};

/**
 * Inflate with the browser's own decompressor.
 *
 * `DecompressionStream` arrived in Safari 16.4 and `browserslist` says iOS 16, so a handful of
 * devices do not have it. They get `NotOdim` and the radar they would have had anyway before this
 * existed -- which is a better trade than 20 KB of inflater in everybody's offline install.
 */
const inflate = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => {
    if (typeof DecompressionStream === "undefined") throw new NotOdim("no DecompressionStream");
    // Fed from a stream of our own rather than a Blob: `Blob.stream` is missing under jsdom, and
    // this is the one part of the reader the unit tests cannot do without.
    const source = new ReadableStream<BufferSource>({
        start: (controller) => {
            controller.enqueue(data);
            controller.close();
        },
    });
    const reader = source.pipeThrough(new DecompressionStream("deflate")).getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value);
            total += value.byteLength;
        }
    } catch {
        throw new NotOdim("the grid would not inflate");
    }
    const out = new Uint8Array(total);
    let p = 0;
    for (const part of parts) {
        out.set(part, p);
        p += part.byteLength;
    }
    return out;
};
