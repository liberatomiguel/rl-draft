/**
 * v2.0.14 — what an error screen can do about the error it caught (pure; no React).
 *
 * Two families cannot be fixed by re-rendering, only by loading the page again:
 *  - a chunk that failed to load (a tab opened before a deploy asks for a file the
 *    new deploy no longer serves, or the network dropped it);
 *  - a DOM `NotFoundError` (something outside React moved its nodes: page translation,
 *    an extension). `src/lib/domGuard.ts` prevents most of these; what still arrives
 *    here leaves a tree React cannot repair.
 */

export type ErrorRecovery = "retry" | "reload";

interface ErrorLike {
  name?: unknown;
  message?: unknown;
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

export function isChunkLoadError(error: ErrorLike | null | undefined): boolean {
  const name = text(error?.name);
  const message = text(error?.message);
  return name === "ChunkLoadError" || /Loading chunk|Failed to load chunk|Loading CSS chunk/i.test(message);
}

export function isDomMismatchError(error: ErrorLike | null | undefined): boolean {
  const message = text(error?.message);
  return text(error?.name) === "NotFoundError" || /not a child of this node|object can not be found here/i.test(message);
}

export function recoveryFor(error: ErrorLike | null | undefined): ErrorRecovery {
  return isChunkLoadError(error) || isDomMismatchError(error) ? "reload" : "retry";
}

/**
 * v2.0.32 (DESIGN-DECISIONS #171): the build file a failed chunk names
 * ("Failed to load chunk /_next/static/chunks/x.js from module 12"), as a path
 * under `/_next/static/`, or null. The error screen fetches it again before its
 * reload, so a 404 the browser cached for a year does not come straight back.
 */
export function chunkUrlOf(error: ErrorLike | null | undefined): string | null {
  if (!isChunkLoadError(error)) return null;
  const found = /\/_next\/static\/[\w\-./~%]+?\.(?:js|css)\b/.exec(text(error?.message));
  return found ? found[0] : null;
}

/** sessionStorage key of the last automatic reload (a timestamp; not a save). */
export const AUTO_RELOAD_KEY = "rocket-draft:error-auto-reload";
/** One automatic reload per this window: a chunk that still fails after it shows the screen. */
export const AUTO_RELOAD_WINDOW_MS = 60_000;

export interface ReloadStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * True when a failed chunk should reload the page by itself, and notes that it did.
 * False for anything else, when it already reloaded within the window, or without storage
 * (no way to stop a loop, so the player decides).
 */
export function shouldAutoReload(error: ErrorLike | null | undefined, store: ReloadStore | null, now: number): boolean {
  if (!isChunkLoadError(error) || !store) return false;
  try {
    const last = Number(store.getItem(AUTO_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < AUTO_RELOAD_WINDOW_MS) return false;
    store.setItem(AUTO_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
