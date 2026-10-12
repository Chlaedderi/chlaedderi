/**
 * The `.chlpack` container: a mappack that is published encrypted, with its key in the share link.
 *
 *   offset size  field
 *   0      4     magic «CHLP»
 *   4      1     version = 1
 *   5      1     flags; bit 0 = gzip
 *   6      12    nonce, fresh random bytes on every encryption
 *   18     …     AES-256-GCM ciphertext ‖ 16-byte tag
 *
 * The first six bytes are the additional authenticated data, so the magic, the version and the
 * flags are covered by the tag: a changed header fails as a forgery, not as garbage further down.
 *
 * Encryption is an *addition*. A pack served as plain JSON keeps working exactly as before -- the
 * magic is the only gate, and anything without it goes down the path it always went down. This
 * file is never reached for such a pack.
 *
 * What it does not do: a key is in every link it was ever sent in, so this is a way of publishing
 * a region without putting it in the open, not a way of taking it back. Only pruning the published
 * file does that.
 */

const MAGIC = [0x43, 0x48, 0x4c, 0x50] as const; // "CHLP"
const VERSION = 1;
const FLAG_GZIP = 1;
const HEADER = 18;
const NONCE = 12;

/**
 * The cap on what the gzip body may expand to. The fetch is already capped at MAX_PACK_BYTES, but
 * compressed bytes say nothing about how many come out: without this a few hundred KB could ask
 * the tab for gigabytes.
 */
const MAX_PLAIN_BYTES = 32 * 1024 * 1024;

/** Does this look like an encrypted pack? The only gate; everything else stays plain JSON. */
export const isChlpack = (bytes: Uint8Array): boolean =>
    bytes.length >= HEADER && MAGIC.every((b, i) => bytes[i] === b);

export class ChlpackError extends Error {
    /** `badkey` when the key is wrong or the bytes were changed, `badblob` when the container is. */
    readonly code: "badkey" | "badblob";
    constructor(code: "badkey" | "badblob", message: string) {
        super(message);
        this.code = code;
    }
}

const keyBytes = (keyB64: string): Uint8Array => {
    const text = keyB64.replace(/-/g, "+").replace(/_/g, "/");
    let binary: string;
    try {
        binary = atob(text.padEnd(Math.ceil(text.length / 4) * 4, "="));
    } catch {
        throw new ChlpackError("badkey", "the key is not base64url");
    }
    if (binary.length !== 32) {
        throw new ChlpackError("badkey", `the key must be 32 bytes, this one is ${binary.length}`);
    }
    return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
};

const gunzip = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => {
    // A stream of our own rather than `new Blob([data]).stream()`: jsdom's Blob has no `stream()`,
    // and the unit tests would then be testing something the browser does not do.
    const source = new ReadableStream<BufferSource>({
        start(controller) {
            controller.enqueue(data);
            controller.close();
        },
    });
    const stream = source.pipeThrough(new DecompressionStream("gzip"));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_PLAIN_BYTES) {
            await reader.cancel();
            throw new ChlpackError("badblob", "the pack expands to more than this app will hold");
        }
        chunks.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
    }
    return out;
};

/**
 * Open an encrypted pack and give back the mappack's JSON text -- the same string a plain pack
 * would have arrived as, so everything downstream (checkPack, storePack, the cache) is unchanged.
 */
export const openChlpack = async (bytes: Uint8Array, keyB64: string): Promise<string> => {
    if (!isChlpack(bytes)) throw new ChlpackError("badblob", "not an encrypted pack");
    const version = bytes[4];
    if (version !== VERSION) {
        throw new ChlpackError(
            "badblob",
            `this pack is written in version ${String(version)}; this app reads version ${String(VERSION)}`,
        );
    }
    const flags = bytes[5] ?? 0;
    if (flags & ~FLAG_GZIP) {
        throw new ChlpackError(
            "badblob",
            `the pack sets flags this app does not know (${String(flags)})`,
        );
    }

    const key = await crypto.subtle.importKey(
        "raw",
        keyBytes(keyB64) as BufferSource,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
    );

    let plain: Uint8Array;
    try {
        plain = new Uint8Array(
            await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: bytes.subarray(6, 6 + NONCE) as BufferSource,
                    additionalData: bytes.subarray(0, 6) as BufferSource,
                    tagLength: 128,
                },
                key,
                bytes.subarray(HEADER) as BufferSource,
            ),
        );
    } catch {
        // One message for a wrong key and for changed bytes alike: the browser cannot tell them
        // apart either, and guessing out loud would be worse than saying the true thing.
        throw new ChlpackError("badkey", "this key does not open this region");
    }

    const text = flags & FLAG_GZIP ? await gunzip(plain as Uint8Array<ArrayBuffer>) : plain;
    return new TextDecoder("utf-8", { fatal: true }).decode(text);
};
