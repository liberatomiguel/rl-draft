"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safety gate for persisted stores: localStorage state only exists in the
 * browser, so components that read persisted stores render a skeleton until
 * after the first client mount (avoids hydration mismatches).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
