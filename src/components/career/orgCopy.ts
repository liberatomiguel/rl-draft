"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-C): the career copy as an established org reads it.
 *
 * A founded club grows its reputation to open the ladder; an established org
 * has nothing locked behind it and shows the number as its Standing. The
 * copy files hold the replacement strings under `orgmode.words`, at the same
 * paths as the strings they replace; `orgCopyFor` merges them over the copy.
 * A founded club gets the copy object itself, untouched.
 */

import { useMemo } from "react";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import { establishedOf } from "@/engine/career/established";
import type { CareerSave } from "@/engine/career/types";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === "object" && v !== null && !Array.isArray(v);

/** A copy of `base` with every leaf of `over` put at its path (only paths that exist in `base`). */
export function mergeWords<T>(base: T, over: unknown): T {
  if (!isTree(base) || !isTree(over)) return base;
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (!(k in base)) continue;
    const cur = (base as Tree)[k];
    out[k] = isTree(cur) && isTree(v) ? mergeWords(cur, v) : v;
  }
  return out as T;
}

const cache = new WeakMap<CareerCopy, CareerCopy>();

/** The copy for this save: an established org's words merged in, a founded club's copy as it is. */
export function orgCopyFor(C: CareerCopy, established: boolean): CareerCopy {
  if (!established) return C;
  let merged = cache.get(C);
  if (!merged) {
    merged = mergeWords(C, C.orgmode.words);
    cache.set(C, merged);
  }
  return merged;
}

/** `useCareerCopy()`, read through the active save's mode (for pieces that have no save in hand). */
export function useActiveCareerCopy(): CareerCopy {
  const C = useCareerCopy();
  const established = useCareerStore((s) => {
    const save = selectActiveSave(s);
    return Boolean(save && establishedOf(save));
  });
  return useMemo(() => orgCopyFor(C, established), [C, established]);
}

/** `useCareerCopy()`, read through the save's mode. */
export function useOrgCareerCopy(save: Pick<CareerSave, "identity"> & { proHost?: boolean } | null | undefined): CareerCopy {
  const C = useCareerCopy();
  const established = Boolean(save && establishedOf(save));
  return useMemo(() => orgCopyFor(C, established), [C, established]);
}
