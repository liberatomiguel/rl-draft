/**
 * rc9 duel-ui: moving between the duel's screens. /duel is one static page and
 * the duel lives in the hash, so inside the page a step is a hash change
 * (which fires `hashchange`, the event DuelView listens to). Light.
 */

import { DUEL_CODE_KEY } from "@/engine/duelLink";

/** Subscribe to the hash, for `useSyncExternalStore`. */
export function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  // A client navigation from /play commits the URL after the page mounts: read once more.
  const t = setTimeout(onChange, 0);
  return () => {
    clearTimeout(t);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/** Open a duel code on this page. */
export function openDuelCode(code: string): void {
  window.location.hash = `${DUEL_CODE_KEY}=${code}`;
  window.scrollTo({ top: 0, left: 0 });
}

/** Back to /duel's own start (no link). */
export function clearDuelHash(): void {
  window.location.hash = "";
  window.scrollTo({ top: 0, left: 0 });
}

/** The full link of a code path, on this site. */
export function duelUrlOf(path: string): string {
  return `${window.location.origin}${path}`;
}
