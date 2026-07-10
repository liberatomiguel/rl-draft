"use client";

/**
 * Road to Worlds — the career store (v1.5).
 *
 * A THIN Zustand shell over src/store/careerFlow.ts: every action delegates
 * to a flow function (which calls pure engine code) and persists the result.
 * Three save slots under one key; additive migrate from day one (a career is
 * a 20-hour save — never a destructive reset like the run store's).
 *
 * Persistence: rocket-draft:career:v1 · { slots, activeSlot } only.
 * v0.2 bumps the persist version to 2 (day clock + gear ladder + mail):
 * migrateSaveToV2 upgrades each slot in place — never a reset.
 * AppShell's leave-run clearing NEVER touches this store (design §11).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CAREER_SAVE, CAREER_SEASONS } from "@/config/balance";
import { seasonLabelFor, weekOfDay } from "@/engine/career/calendar";
import { repTierOf } from "@/engine/career/economy";
import { deriveSeed, streams } from "@/engine/career/seeds";
import { userStarsFor } from "@/engine/career/worldSim";
import type {
  CareerSave,
  CareerSlotMeta,
  CoachState,
  SquadPlayer,
  TransferOffer,
} from "@/engine/career/types";
import { createRng, randomSeed } from "@/lib/rng";
import {
  advanceDayFlow,
  advanceToNextStopFlow,
  buyGearFlow,
  buyScoutReportFlow,
  chooseSponsorFlow,
  createCareerSave,
  declineBidFlow,
  declineUnofficial,
  endCareer,
  finishEvent,
  fireCoachFlow,
  hireCoachFlow,
  migrateSaveToV2,
  releasePlayerFlow,
  renewPlayerFlow,
  resolveAcceptedBid,
  rolloverToNextSeason,
  runBootcampFlow,
  runScrimFlow,
  setPsychologistFlow,
  setStartersFlow,
  setTrainingFocusFlow,
  setTrainingIntensityFlow,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  stepEventRound,
  syncSquadRoles,
  type CreateCareerInput,
} from "./careerFlow";
import type { GearItemId } from "@/engine/career/economy";

interface CareerStoreState {
  slots: (CareerSave | null)[];
  activeSlot: number | null;
  /** Last action error (copy key suffix) — cleared on the next action. */
  lastError: string | null;

  createCareer: (slot: number, input: CreateCareerInput, customSeed?: number) => void;
  selectSlot: (slot: number) => void;
  deleteSlot: (slot: number) => void;

  advanceDay: () => void;
  advanceToNextStop: () => void;

  enterEvent: (watch: boolean) => void;
  playEventRound: () => void;
  simEvent: () => void;
  completeEvent: () => void;
  passUnofficial: () => void;
  /** Accept this week's unofficial invite when auto-enter is off. */
  acceptUnofficial: () => void;

  runScrim: () => void;

  signPlayer: (playerId: string, role: "starter" | "sub", lengthSeasons: 1 | 2 | 3) => void;
  releasePlayer: (playerId: string) => void;
  renewPlayer: (playerId: string, lengthSeasons: 1 | 2 | 3) => void;
  acceptBid: (offerId: string) => void;
  declineBid: (offerId: string) => void;

  setStarters: (ids: [string, string, string]) => void;
  setTrainingFocus: (playerId: string, focus: SquadPlayer["trainingFocus"]) => void;
  setTrainingIntensity: (
    playerId: string,
    intensity: SquadPlayer["trainingIntensity"],
  ) => void;
  setAutoTrain: (on: boolean) => void;

  buyGear: (itemId: GearItemId) => void;
  setPsychologist: (on: boolean) => void;
  runBootcamp: () => void;
  buyScoutReport: (playerId: string) => void;
  hireCoach: (coach: CoachState) => void;
  fireCoach: () => void;
  chooseSponsor: (sponsorId: string) => void;

  continueToNextSeason: () => void;
  continueInfinite: () => void;
  retireCareer: () => void;

  markFlag: (flag: string) => void;
  markNewsRead: () => void;
  markMailRead: (mailId: string) => void;
  markAllMailRead: () => void;
  clearError: () => void;
}

function emptySlots(): (CareerSave | null)[] {
  return Array.from({ length: CAREER_SAVE.maxSlots }, () => null);
}

export const useCareerStore = create<CareerStoreState>()(
  persist(
    (set, get) => {
      /** Apply a flow mutation to the active save and persist it. */
      const withSave = (fn: (save: CareerSave) => CareerSave): void => {
        const { slots, activeSlot } = get();
        if (activeSlot === null || !slots[activeSlot]) return;
        const next = fn(slots[activeSlot]!);
        next.lastPlayedAt = Date.now();
        const nextSlots = [...slots];
        nextSlots[activeSlot] = next;
        set({ slots: nextSlots, lastError: null });
      };

      /** Flow functions returning { save, error } surface errors to the UI. */
      const withResult = (fn: (save: CareerSave) => { save: CareerSave; error?: string }): void => {
        const { slots, activeSlot } = get();
        if (activeSlot === null || !slots[activeSlot]) return;
        const { save, error } = fn(slots[activeSlot]!);
        if (error) {
          set({ lastError: error });
          return;
        }
        save.lastPlayedAt = Date.now();
        const nextSlots = [...slots];
        nextSlots[activeSlot] = save;
        set({ slots: nextSlots, lastError: null });
      };

      return {
        slots: emptySlots(),
        activeSlot: null,
        lastError: null,

        createCareer: (slot, input, customSeed) => {
          const seed = (customSeed ?? randomSeed()) >>> 0;
          const save = createCareerSave(input, seed);
          save.lastPlayedAt = Date.now();
          const slots = [...get().slots];
          slots[slot] = save;
          set({ slots, activeSlot: slot, lastError: null });
        },

        selectSlot: (slot) => {
          if (get().slots[slot]) set({ activeSlot: slot });
        },

        deleteSlot: (slot) => {
          const slots = [...get().slots];
          slots[slot] = null;
          const active = get().activeSlot === slot ? null : get().activeSlot;
          set({ slots, activeSlot: active });
        },

        advanceDay: () => withSave(advanceDayFlow),
        advanceToNextStop: () => withSave(advanceToNextStopFlow),

        enterEvent: (watch) => withSave((s) => startEvent(s, watch)),
        playEventRound: () => withSave(stepEventRound),
        simEvent: () => withSave(simEventToEnd),
        completeEvent: () => withSave(finishEvent),
        passUnofficial: () => withSave(declineUnofficial),
        acceptUnofficial: () =>
          withSave((s) => {
            if (!s.unofficialOffer || s.pendingEventDef) return s;
            const next = structuredClone(s);
            next.pendingEventDef = next.unofficialOffer;
            return next;
          }),

        runScrim: () => withResult(runScrimFlow),

        signPlayer: (playerId, role, lengthSeasons) =>
          withResult((s) => signPlayerFlow(s, playerId, { role, lengthSeasons })),
        releasePlayer: (playerId) => withResult((s) => releasePlayerFlow(s, playerId)),
        renewPlayer: (playerId, lengthSeasons) =>
          withResult((s) => renewPlayerFlow(s, playerId, lengthSeasons)),
        acceptBid: (offerId) =>
          withSave((s) => {
            const offer = s.pendingOffers.find((o: TransferOffer) => o.id === offerId);
            return offer ? resolveAcceptedBid(s, offer) : s;
          }),
        declineBid: (offerId) => withSave((s) => declineBidFlow(s, offerId)),

        setStarters: (ids) => withResult((s) => setStartersFlow(s, ids)),
        setTrainingFocus: (playerId, focus) =>
          withSave((s) => setTrainingFocusFlow(s, playerId, focus)),
        setTrainingIntensity: (playerId, intensity) =>
          withSave((s) => setTrainingIntensityFlow(s, playerId, intensity)),
        setAutoTrain: (on) =>
          withSave((s) => {
            const next = structuredClone(s);
            next.prefs.autoTrain = on;
            for (const p of next.squad) {
              if (on && p.trainingFocus !== "auto") p.trainingFocus = "auto";
            }
            return next;
          }),

        buyGear: (itemId) => withResult((s) => buyGearFlow(s, itemId)),
        setPsychologist: (on) => withResult((s) => setPsychologistFlow(s, on)),
        runBootcamp: () => withResult(runBootcampFlow),
        buyScoutReport: (playerId) => withResult((s) => buyScoutReportFlow(s, playerId)),
        hireCoach: (coach) => withResult((s) => hireCoachFlow(s, coach)),
        fireCoach: () => withResult(fireCoachFlow),
        chooseSponsor: (sponsorId) => withResult((s) => chooseSponsorFlow(s, sponsorId)),

        continueToNextSeason: () => withSave(rolloverToNextSeason),
        continueInfinite: () =>
          withSave((s) => {
            const next = structuredClone(s);
            next.end.infinite = true;
            next.end.creditsShown = true;
            return rolloverToNextSeason(next);
          }),
        retireCareer: () =>
          withSave((s) => {
            const next = structuredClone(s);
            endCareer(next, "retired");
            return next;
          }),

        markFlag: (flag) =>
          withSave((s) => {
            const next = structuredClone(s);
            next.flags[flag] = true;
            return next;
          }),
        markNewsRead: () =>
          withSave((s) => {
            const next = structuredClone(s);
            for (const n of next.news) n.read = true;
            return next;
          }),
        markMailRead: (mailId) =>
          withSave((s) => {
            const next = structuredClone(s);
            const item = next.mail.find((m) => m.id === mailId);
            if (item) item.read = true;
            return next;
          }),
        markAllMailRead: () =>
          withSave((s) => {
            const next = structuredClone(s);
            for (const m of next.mail) m.read = true;
            return next;
          }),
        clearError: () => set({ lastError: null }),
      };
    },
    {
      name: "rocket-draft:career:v1",
      version: 2,
      // ADDITIVE migrate, forever: upgrade each slot in place — new versions
      // add defaults for new fields per slot instead of resetting saves.
      migrate: (persisted) => {
        const state = persisted as CareerStoreState;
        if (state?.slots) {
          state.slots = state.slots.map((slot) => (slot ? migrateSaveToV2(slot) : null));
        }
        return state;
      },
      partialize: (state) => ({ slots: state.slots, activeSlot: state.activeSlot }),
      // Load-time self-heal: repair any save whose starterIds drifted out of
      // sync with the squad (the release-crash bug) and make sure the v2
      // migration ran even if zustand skipped `migrate` (same version).
      onRehydrateStorage: () => (state) => {
        if (!state?.slots) return;
        state.slots = state.slots.map((slot) => {
          if (!slot) return null;
          try {
            const upgraded = migrateSaveToV2(slot) ?? slot;
            syncSquadRoles(upgraded);
            return upgraded;
          } catch {
            /* never block hydration on a repair */
            return slot;
          }
        });
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Read-side selectors (cheap, derived — never persisted)
// ---------------------------------------------------------------------------

export function selectActiveSave(state: CareerStoreState): CareerSave | null {
  return state.activeSlot === null ? null : state.slots[state.activeSlot];
}

/** Slot cards for the saves picker — rendered without hydrating full saves. */
export function slotMetaFor(slots: (CareerSave | null)[]): (CareerSlotMeta | null)[] {
  return slots.map((save, slot) => {
    if (!save) return null;
    const starters = save.squad.filter((p) => save.starterIds.includes(p.id));
    const avg =
      starters.length > 0
        ? starters.reduce((s, p) => s + p.overall, 0) / starters.length
        : 70;
    return {
      slot,
      orgName: save.identity.orgName,
      abbrev: save.identity.abbrev,
      crestId: save.identity.crestId,
      colors: save.identity.colors,
      managerName: save.identity.managerName,
      region: save.identity.region,
      difficulty: save.difficulty,
      seasonLabel: seasonLabelFor(save.clock.seasonIndex),
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      balance: save.finances.balance,
      reputation: save.reputation,
      stars: userStarsFor({
        userRating: avg,
        world: save.world,
        repTier: repTierOf(save.reputation),
      }),
      champion: save.stats.titlesWorlds > 0,
      ended: save.end.ended && !save.end.infinite,
      lastPlayedAt: save.lastPlayedAt,
    };
  });
}

/** Deterministic per-event seed helper for UI-side derived flavor. */
export function eventSeedFor(save: CareerSave, eventId: string): number {
  return deriveSeed(save.careerSeed, `evt:${eventId}`);
}

export { seasonLabelFor, CAREER_SEASONS, createRng, streams };
