/**
 * The port the browser suite serves on.
 *
 * It depends on the checkout, and that is the whole point. `reuseExistingServer` is on outside CI,
 * every worktree runs the same hooks, and the suite runs on a commit in whichever worktree you are
 * standing in -- so with one fixed port, two checkouts testing at the same time both attach to
 * whichever server started first. Each then reports on a build that is not its own, in green, which
 * is the same lie as a hook that builds the main checkout while you commit in a worktree.
 *
 * So the default is derived from the checkout's path. `E2E_PORT` overrides it where a particular
 * number is wanted.
 */

const base = 4173;

/** A small, stable offset per checkout: different worktrees, different ports; same tree, same port. */
const offset = (path: string): number => {
    let hash = 0;
    for (let i = 0; i < path.length; i++) hash = (hash * 31 + path.charCodeAt(i)) % 500;
    return hash;
};

export const E2E_PORT = Number(process.env.E2E_PORT ?? base + offset(process.cwd()));
export const E2E_HOST = `127.0.0.1:${E2E_PORT}`;
export const E2E_ORIGIN = `http://${E2E_HOST}`;
