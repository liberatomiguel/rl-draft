/**
 * Friend duel (v2.1, `engine/duel.ts`): the session-only bits around the link —
 * the notice a refused link leaves for /play, and the `friend_duel` events that
 * do not come from the run store (opened, invalid, shared). Not persisted: a
 * notice belongs to the navigation that raised it.
 *
 * Light on purpose: no dataset and no run store, so /duel stays small.
 */

import { create } from "zustand";
import { BALANCE_VERSION } from "@/config/balance";
import type { DuelLink, DuelParseError } from "@/engine/duel";
import type { RunState } from "@/engine/types";
import { trackEvent } from "@/lib/analytics";

/** Why a link fell back to a normal draft (`region` = the link's region cannot be drafted). */
export type DuelNotice = DuelParseError | "region";

interface DuelNoticeState {
  notice: DuelNotice | null;
  setNotice: (notice: DuelNotice | null) => void;
}

export const useDuelNotice = create<DuelNoticeState>((set) => ({
  notice: null,
  setNotice: (notice) => set({ notice }),
}));

/** The link was made on another tuning generation: the offers may differ. */
export function isStaleDuel(link: DuelLink): boolean {
  return link.setup.balanceVersion !== BALANCE_VERSION;
}

/** `region` the way the draft events report it. */
function regionOf(link: DuelLink): string {
  return link.setup.region ?? "worldwide";
}

export function trackDuelOpened(link: DuelLink): void {
  trackEvent("friend_duel", {
    action: "opened",
    entries: link.entries.length,
    mode: link.setup.mode,
    difficulty: link.setup.difficulty,
    region: regionOf(link),
    staleVersion: isStaleDuel(link),
  });
}

export function trackDuelInvalid(reason: DuelNotice): void {
  trackEvent("friend_duel", { action: "invalid", entries: 0, reason });
}

/** `entries` = the runs the shared link carries, this one included. */
export function trackDuelShared(run: RunState, entries: number, method: "native" | "copy"): void {
  if (!run.duel) return;
  trackEvent("friend_duel", {
    action: "shared",
    entries,
    mode: run.duel.setup.mode,
    difficulty: run.duel.setup.difficulty,
    region: regionOf(run.duel),
    placement: run.results?.placement ?? null,
    method,
  });
}
