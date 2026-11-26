"use client";

/**
 * v2.2 Pro, the player career — the store (PRO-SPEC §11, R150).
 *
 * A thin Zustand shell over `engine/career/pro`. Its own key,
 * `rocket-draft:pro:v1` (DESIGN-DECISIONS #185), three slots beside the
 * manager's three: a device can hold player and manager careers at once.
 * Persists `{ slots, activeSlot }` only. The migrate is additive from day
 * one: it keeps every slot it can read and pads the list, never a reset.
 *
 * Not yet (after the Etapa 2 gate): the account copy and the per-account
 * device ownership that the manager slots have (#165, #170).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CAREER_PRO } from "@/config/balance";
import { SITE } from "@/config/site";
import { createProSave } from "@/engine/career/pro/create";
import type { WeekResult } from "@/engine/career/pro/week";
import type { CreateProInput, ProSave, ProWeekPlan } from "@/engine/career/pro/types";
import { anonymousId } from "@/lib/analytics";
import { randomSeed } from "@/lib/rng";
import { skipUnchangedWrites } from "./careerPersist";
import { reportingJSONStorage, reportingMigrate } from "./persistStorage";
import { ensureProHost, playProWeekFlow } from "./proFlow";

export const PRO_PERSIST_VERSION = 1;

export interface ProStoreState {
  slots: (ProSave | null)[];
  activeSlot: number | null;
  /** Create a career in an empty slot and make it the active one. */
  createPro: (slot: number, input: CreateProInput, customSeed?: number) => void;
  selectSlot: (slot: number) => void;
  deleteSlot: (slot: number) => void;
  /** Play a week plan on the active save: the real calendar to next Monday, or to a matchday first (PROSPINE). */
  playWeek: (plan: ProWeekPlan) => void;
  /** What the last played week did, for the planner to show. Not persisted. */
  lastWeek: WeekResult | null;
  /** PROSPINE: run any proFlow step on the active save (the hub, offers, the match report). A refused step writes nothing. */
  apply: (fn: (save: ProSave) => ProSave) => void;
}

function emptySlots(): (ProSave | null)[] {
  return Array.from({ length: CAREER_PRO.slots }, () => null);
}

function isProSave(x: unknown): x is ProSave {
  return Boolean(x) && typeof x === "object" && (x as { kind?: unknown }).kind === "pro";
}

/**
 * ADDITIVE, forever: whatever was stored, keep each slot that is a Pro save,
 * null the rest, pad or trim to CAREER_PRO.slots, and keep the active slot
 * only if it still points at a save. A later shape change adds its step here.
 */
export function migrateProState(persisted: unknown): Pick<ProStoreState, "slots" | "activeSlot"> {
  const state = (persisted ?? {}) as { slots?: unknown; activeSlot?: unknown };
  const raw = Array.isArray(state.slots) ? state.slots : [];
  const slots = emptySlots().map((_, i) => (isProSave(raw[i]) ? (raw[i] as ProSave) : null));
  const active = typeof state.activeSlot === "number" && slots[state.activeSlot] ? state.activeSlot : null;
  return { slots, activeSlot: active };
}

export const useProStore = create<ProStoreState>()(
  persist(
    (set, get) => ({
      slots: emptySlots(),
      activeSlot: null,
      lastWeek: null,

      playWeek: (plan) => {
        const { slots, activeSlot } = get();
        const save = activeProSave({ slots, activeSlot });
        if (activeSlot === null || !save || save.stage === "retired") return;
        const played = playProWeekFlow(save, plan);
        const next = [...slots];
        next[activeSlot] = { ...played.save, lastPlayedAt: Math.max(Date.now(), (save.lastPlayedAt ?? 0) + 1) };
        const log = played.log;
        set({
          slots: next,
          lastWeek: log ? { player: played.save.player, growth: log.growth, notes: log.notes, energyTrace: log.energyTrace } : null,
        });
      },

      apply: (fn) => {
        const { slots, activeSlot } = get();
        const save = activeProSave({ slots, activeSlot });
        if (activeSlot === null || !save) return;
        const base = save.host ? save : ensureProHost(save);
        const out = fn(base);
        if (out === save) return;
        const next = [...slots];
        next[activeSlot] = { ...out, lastPlayedAt: Math.max(Date.now(), (save.lastPlayedAt ?? 0) + 1) };
        set({ slots: next });
      },

      createPro: (slot, input, customSeed) => {
        if (slot < 0 || slot >= CAREER_PRO.slots || get().slots[slot]) return;
        const seed = (customSeed ?? randomSeed()) >>> 0;
        // PROSPINE: the world's calendar is the hidden host's from the first day.
        const save = ensureProHost(createProSave(input, seed, SITE.version));
        save.careerId = anonymousId("p");
        save.lastPlayedAt = Date.now();
        const slots = [...get().slots];
        slots[slot] = save;
        set({ slots, activeSlot: slot });
      },

      selectSlot: (slot) => {
        if (get().slots[slot]) set({ activeSlot: slot });
      },

      deleteSlot: (slot) => {
        const slots = [...get().slots];
        slots[slot] = null;
        set({ slots, activeSlot: get().activeSlot === slot ? null : get().activeSlot });
      },
    }),
    {
      name: "rocket-draft:pro:v1",
      version: PRO_PERSIST_VERSION,
      storage: skipUnchangedWrites(reportingJSONStorage("pro"), ["slots", "activeSlot"]),
      migrate: reportingMigrate("pro", PRO_PERSIST_VERSION, (persisted) => migrateProState(persisted)),
      partialize: (state) => ({ slots: state.slots, activeSlot: state.activeSlot }),
      // A stored list of the wrong length (or a damaged slot) is repaired on load too.
      merge: (persisted, current) => ({ ...current, ...migrateProState(persisted) }),
    },
  ),
);

/** The active Pro save, or null. */
export function activeProSave(state: Pick<ProStoreState, "slots" | "activeSlot">): ProSave | null {
  return state.activeSlot === null ? null : (state.slots[state.activeSlot] ?? null);
}
