/**
 * The worker itself: inflate one frame, quantise it, hand back the bytes.
 *
 * Deliberately thin -- everything it knows is in `odim.ts` and `radarWorker.ts`, where a test can
 * reach it without a worker at all. See radarWorker.ts for why this file is in `core/`.
 */

import { readOdimGrid } from "@services/odim";

import { type DecodeReply, type DecodeRequest, toCells } from "./radarWorker";

self.addEventListener("message", (event: MessageEvent<DecodeRequest>) => {
    const { id, file } = event.data;
    void readOdimGrid(file)
        .then(({ nx, ny, values }) => {
            const cells = toCells(values);
            const reply: DecodeReply = { id, nx, ny, cells };
            // Transferred, not copied: 454 KB a frame, and the worker has no further use for it.
            self.postMessage(reply, { transfer: [cells.buffer] });
        })
        .catch((problem: unknown) => {
            const reply: DecodeReply = {
                id,
                error: problem instanceof Error ? problem.message : "unreadable",
            };
            self.postMessage(reply);
        });
});
