"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to: the value only differs between server and client. */
function subscribe(): () => void {
  return () => {};
}

/**
 * SSR-safety gate for persisted stores: localStorage state only exists in the
 * browser, so components that read persisted stores render a skeleton until
 * hydration is done (avoids hydration mismatches). False on the server and
 * during the hydration render, true afterwards — and true right away on a
 * client-side navigation, where there is nothing to hydrate.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
