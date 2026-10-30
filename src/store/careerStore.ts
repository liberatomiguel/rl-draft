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
 * v0.2 bumped the persist version to 2 (day clock + gear ladder + mail);
 * v0.3 bumps to 3 (scrim scheduling/log, transfer wire, negotiation):
 * migrateSaveToV3 upgrades each slot in place — never a reset. v2.0 (R40)
 * chains migrateSaveToV4 (the weekend calendar) WITHOUT a persist bump: it is
 * gated by each save's own `saveVersion` (4) and runs on every rehydrate.
 * rc.30 chains migrateSaveToV5 the same way (saveVersion 5: the one-time
 * world repair and the week's committed direct-8 seeding).
 * AppShell's leave-run clearing NEVER touches this store (design §11).
 *
 * v0.3 session-only state (never persisted): `autoAdvance` (the FIFA-style
 * autoplay switch — a component in the career layout drives the day ticks)
 * and `toasts` (popup queue mirrored from newly created mail + high-priority
 * news after each action).
 */

import { create } from "zustand";
import { careerAchievementById } from "@/data/career/achievements";
import {
  EMPTY_ACHIEVEMENT_MEMORY,
  evaluateCareerAchievements,
  worldsWonOnAfter,
  type CareerAchievementMemory,
} from "@/engine/career/achievements";
import { useProfileStore } from "@/store/profileStore";
import { persist } from "zustand/middleware";
import { CAREER_SAVE, CAREER_SEASONS } from "@/config/balance";
import { seasonLabelFor, weekOfDay } from "@/engine/career/calendar";
import { repTierOf } from "@/engine/career/economy";
import { deriveSeed, streams } from "@/engine/career/seeds";
import { LINEUP_SEATS, userStarsFor } from "@/engine/career/worldSim";
import type {
  CareerSave,
  CareerSlotMeta,
  CoachState,
  TrainingMode,
  TrainingPackage,
} from "@/engine/career/types";
import { createRng, randomSeed } from "@/lib/rng";
import {
  acceptBidFlow,
  advanceDayFlow,
  advanceToNextStopFlow,
  buyGearFlow,
  buyScoutReportFlow,
  cancelScrimFlow,
  chooseSponsorFlow,
  continueEventToNextDayFlow,
  continueInfiniteFlow,
  createCareerSave,
  declineBidFlow,
  declineUnofficial,
  endCareer,
  finishEvent,
  fireCoachFlow,
  hireCoachFlow,
  migrateSaveToV5,
  payBankLoanFlow,
  payDebtFlow,
  resolveInsertFlow,
  releasePlayerFlow,
  renewPlayerFlow,
  rolloverToNextSeason,
  runBootcampFlow,
  runScrimFlow,
  scheduleScrimFlow,
  setPsychologistFlow,
  setStartersFlow,
  takeBankLoanFlow,
  signPlayerFlow,
  simEventToEnd,
  startChampionshipSundayFlow,
  startEvent,
  stepEventRound,
  syncSquadRoles,
  type CreateCareerInput,
} from "./careerFlow";
import {
  approveTrainingProposalFlow,
  keepBaseTrainingFlow,
  setTrainingModeFlow,
  setTrainingPackageFlow,
  setTrainingRepeatFlow,
} from "./careerTraining";
import type { GearItemId } from "@/engine/career/economy";
import type { ContractOffer } from "@/engine/career/contract";
import { analyticsAllowed, anonymousId, trackEvent, trackEvents } from "@/lib/analytics";
import { careerCreatedEvent, careerEventsFor, careerIdOf, type CareerAction } from "./careerAnalytics";
import { reportingJSONStorage, reportingMigrate, reportMigration } from "./persistStorage";

/** A popup toast mirrored from a new mail/news item (session-only). */
export interface CareerToast {
  id: string;
  source: "mail" | "news" | "achievement";
  titleKey: string;
  params?: Record<string, string | number>;
  linkTo?: string;
}

const TOASTS_PER_ACTION = 3;
const TOAST_QUEUE_CAP = 5;

/** Numeric tail of a mail/news id ("m:412" → 412). */
function seqOf(id: string): number {
  const n = Number(id.slice(id.indexOf(":") + 1));
  return Number.isFinite(n) ? n : 0;
}

/** New popup-worthy items created after `prevSeq` (newest first, capped). */
function collectToasts(save: CareerSave, prevSeq: number): CareerToast[] {
  const out: CareerToast[] = [];
  for (const m of save.mail) {
    if (seqOf(m.id) <= prevSeq) break; // newest-first list
    out.push({ id: m.id, source: "mail", titleKey: m.titleKey, params: m.params, linkTo: m.linkTo });
  }
  for (const n of save.news) {
    if (seqOf(n.id) <= prevSeq) break;
    if (n.priority < 2) continue;
    if (out.some((t) => t.titleKey === n.titleKey)) continue; // mail twin exists
    out.push({ id: n.id, source: "news", titleKey: n.titleKey, params: n.params });
  }
  return out.slice(0, TOASTS_PER_ACTION);
}

interface CareerStoreState {
  slots: (CareerSave | null)[];
  activeSlot: number | null;
  /** Last action error (copy key suffix) — cleared on the next action. */
  lastError: string | null;
  /** v0.3 FIFA-style autoplay switch (session-only; driven by CareerAutopilot). */
  autoAdvance: boolean;
  /**
   * v2.0 (R32): permanent career achievements — across saves, never reset
   * by a season. Unlock dates by id + the difficulties Worlds was won on.
   */
  achievements: CareerAchievementMemory;
  /** v0.3 popup queue (session-only). */
  toasts: CareerToast[];

  createCareer: (slot: number, input: CreateCareerInput, customSeed?: number) => void;
  selectSlot: (slot: number) => void;
  deleteSlot: (slot: number) => void;

  advanceDay: () => void;
  advanceToNextStop: () => void;
  /**
   * v2.0 (R40): a Major/Worlds paused after its Saturday Swiss → Championship
   * Sunday (one day; no-op unless `isEventPaused`). `advanceDay` /
   * `advanceToNextStop` also move a paused Saturday on — this names the intent.
   */
  continueEventToNextDay: () => void;
  setAutoAdvance: (on: boolean) => void;
  dismissToast: (id: string) => void;

  enterEvent: (watch: boolean) => void;
  /**
   * v2.0 (R40): the Championship Sunday title card's CTA — marks the intro
   * seen, re-picks watch / instant for the playoffs and (instant) sims them to
   * the finish, in one write. No-op unless it is Championship Sunday before
   * the first playoff round. Never changes a result.
   */
  startChampionshipSunday: (watch: boolean) => void;
  playEventRound: () => void;
  simEvent: () => void;
  completeEvent: () => void;
  passUnofficial: () => void;
  /** Accept this week's unofficial invite when auto-enter is off. */
  acceptUnofficial: () => void;

  /** Run a scrim now — optionally vs a chosen shortlist opponent. */
  runScrim: (oppRef?: string) => void;
  /** v0.3: book a scrim ahead (shows on the calendar, runs on arrival). */
  scheduleScrim: (day: number, oppRef: string) => void;
  cancelScrim: (day: number) => void;

  /**
   * ECO-03 (R47): sign at the player's normal value; he takes an open seat in
   * the starting three, else the reserve slot. A full squad names who leaves
   * (`releaseId`), released in the same operation. rc.33 (ECO-10/11): `offer`
   * is the weekly wage and prize share the talk settled (omitted = his ask).
   */
  signPlayer: (
    playerId: string,
    opts: { lengthSeasons: 1 | 2 | 3; offer?: ContractOffer; releaseId?: string },
  ) => void;
  releasePlayer: (playerId: string) => void;
  renewPlayer: (playerId: string, lengthSeasons: 1 | 2 | 3, offer?: ContractOffer) => void;
  acceptBid: (offerId: string) => void;
  declineBid: (offerId: string) => void;

  setStarters: (ids: [string, string, string]) => void;
  /**
   * rc.34 (DEV-03): the period's training package ("I set it" / "Adjust"; null
   * = the base) — it replaces rc.33's weekly drill and per-card focus /
   * intensity. The rest: the delegation mode, "repeat", and the coach's
   * waiting proposal (approve or keep the base).
   */
  setTrainingPackage: (pkg: TrainingPackage | null) => void;
  setTrainingMode: (mode: TrainingMode) => void;
  setTrainingRepeat: (on: boolean) => void;
  approveTrainingProposal: () => void;
  keepBaseTraining: () => void;
  /** v2.0 (R33): answer the pending mid-week insert. */
  resolveInsert: (key: "a" | "b") => void;

  buyGear: (itemId: GearItemId) => void;
  setPsychologist: (on: boolean) => void;
  runBootcamp: () => void;
  buyScoutReport: (playerId: string) => void;
  hireCoach: (coach: CoachState) => void;
  fireCoach: () => void;
  chooseSponsor: (sponsorId: string) => void;
  /** v0.3: manual Backer debt pay-down. */
  payDebt: (amount: number) => void;
  /** v2.0 bank loan (R21). */
  takeBankLoan: (principal: number) => void;
  payBankLoan: (amount: number) => void;

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

/**
 * OBS-01 (#145): send the career events this write produced — read off the
 * save before the action and the save just written (`careerAnalytics.ts`).
 * Production only, and never throws into gameplay.
 */
function trackCareerWrite(prev: CareerSave, next: CareerSave, action?: CareerAction): void {
  try {
    if (analyticsAllowed()) trackEvents(careerEventsFor(prev, next, action));
  } catch {
    // analytics must never break a save
  }
}

export const useCareerStore = create<CareerStoreState>()(
  persist(
    (set, get) => {
      /** Apply a flow mutation to the active save and persist it. */
      /**
       * v2.0 (R32): after any flow, unlock the career achievements the save
       * now satisfies — permanent memory here, a toast, Season XP + the
       * cosmetic mark on the profile.
       */
      const settleAchievements = (save: CareerSave): { memory: CareerAchievementMemory; toasts: CareerToast[] } => {
        const memory = get().achievements ?? EMPTY_ACHIEVEMENT_MEMORY;
        const worldsWonOn = worldsWonOnAfter(save, memory);
        const probe = { ...memory, worldsWonOn };
        const fresh = evaluateCareerAchievements(save, probe);
        if (fresh.length === 0 && worldsWonOn === memory.worldsWonOn) return { memory, toasts: [] };
        const now = Date.now();
        const unlocked = { ...memory.unlocked };
        const toasts: CareerToast[] = [];
        let xp = 0;
        for (const id of fresh) {
          unlocked[id] = now;
          xp += careerAchievementById.get(id)?.xp ?? 0;
          toasts.push({ id: `ach:${id}:${now}`, source: "achievement", titleKey: id, linkTo: "/career/club" });
        }
        if (fresh.length > 0) {
          const profile = useProfileStore.getState();
          profile.addCareerMarks(fresh);
          if (xp > 0) profile.grantXp(xp);
        }
        return { memory: { unlocked, worldsWonOn }, toasts };
      };

      /**
       * ECO-02 (R46): an ended career is closed — the ONE guard every action
       * that changes the career passes (money, roster, staff, events, the
       * clock): on an ended save it is refused with "blocked" and the save is
       * left untouched. Only what the end still needs opts out
       * (`allowEnded`): retiring (the legacy screen) and the viewing state
       * (read marks, seen flags).
       */
      const refuseEnded = (): boolean => {
        const { slots, activeSlot } = get();
        if (activeSlot === null || slots[activeSlot]?.phase !== "ended") return false;
        set({ lastError: "blocked" });
        return true;
      };

      const withSave = (
        fn: (save: CareerSave) => CareerSave,
        opts?: { allowEnded?: boolean; track?: CareerAction },
      ): void => {
        const { slots, activeSlot } = get();
        if (activeSlot === null || !slots[activeSlot]) return;
        if (!opts?.allowEnded && refuseEnded()) return;
        const prevSave = slots[activeSlot]!;
        const prevSeq = slots[activeSlot]!.seq ?? 0;
        const prevWorlds = slots[activeSlot]!.stats.titlesWorlds ?? 0;
        const next = fn(slots[activeSlot]!);
        // rc.4: Worlds titles feed the profile's cross-save + season counters
        // (World Champion / Dynasty badges). Read before the flow mutates.
        const worldsWon = (next.stats.titlesWorlds ?? 0) - prevWorlds;
        if (worldsWon > 0) useProfileStore.getState().addCareerWorlds(worldsWon);
        next.lastPlayedAt = Date.now();
        const nextSlots = [...slots];
        nextSlots[activeSlot] = next;
        const fresh = collectToasts(next, prevSeq);
        const ach = settleAchievements(next);
        set((state) => ({
          slots: nextSlots,
          lastError: null,
          achievements: ach.memory,
          toasts:
            fresh.length + ach.toasts.length > 0
              ? [...ach.toasts, ...fresh, ...state.toasts].slice(0, TOAST_QUEUE_CAP)
              : state.toasts,
        }));
        trackCareerWrite(prevSave, next, opts?.track);
      };

      /**
       * Flow functions returning { save, error } surface errors to the UI.
       * The returned save persists EVEN on error — v0.3 negotiation rejections
       * mutate bookkeeping (the agent hardens) and must stick.
       */
      const withResult = (
        fn: (save: CareerSave) => { save: CareerSave; error?: string },
        track?: CareerAction,
      ): void => {
        const { slots, activeSlot } = get();
        if (activeSlot === null || !slots[activeSlot]) return;
        if (refuseEnded()) return;
        const prevSave = slots[activeSlot]!;
        const prevSeq = slots[activeSlot]!.seq ?? 0;
        const { save, error } = fn(slots[activeSlot]!);
        const changed = save !== slots[activeSlot];
        if (changed) save.lastPlayedAt = Date.now();
        const nextSlots = changed ? [...slots] : slots;
        if (changed) nextSlots[activeSlot] = save;
        const fresh = changed ? collectToasts(save, prevSeq) : [];
        const ach = changed ? settleAchievements(save) : { memory: get().achievements, toasts: [] };
        set((state) => ({
          slots: nextSlots,
          lastError: error ?? null,
          achievements: ach.memory,
          toasts:
            fresh.length + ach.toasts.length > 0
              ? [...ach.toasts, ...fresh, ...state.toasts].slice(0, TOAST_QUEUE_CAP)
              : state.toasts,
        }));
        if (changed) trackCareerWrite(prevSave, save, track);
      };

      return {
        slots: emptySlots(),
        activeSlot: null,
        lastError: null,
        autoAdvance: false,
        achievements: EMPTY_ACHIEVEMENT_MEMORY,
        toasts: [],

        createCareer: (slot, input, customSeed) => {
          const seed = (customSeed ?? randomSeed()) >>> 0;
          const save = createCareerSave(input, seed);
          save.careerId = anonymousId("c"); // OBS-01: the anonymous analytics id
          save.lastPlayedAt = Date.now();
          const slots = [...get().slots];
          slots[slot] = save;
          set({ slots, activeSlot: slot, lastError: null, autoAdvance: false, toasts: [] });
          const created = careerCreatedEvent(save, input.rosterKey);
          trackEvent(created.name, created.props);
        },

        selectSlot: (slot) => {
          if (get().slots[slot]) set({ activeSlot: slot, autoAdvance: false, toasts: [] });
        },

        deleteSlot: (slot) => {
          const slots = [...get().slots];
          slots[slot] = null;
          const active = get().activeSlot === slot ? null : get().activeSlot;
          set({ slots, activeSlot: active });
        },

        advanceDay: () => withSave(advanceDayFlow),
        advanceToNextStop: () => withSave(advanceToNextStopFlow),
        continueEventToNextDay: () => withSave(continueEventToNextDayFlow),
        setAutoAdvance: (on) => set({ autoAdvance: on }),
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        enterEvent: (watch) => withSave((s) => startEvent(s, watch)),
        startChampionshipSunday: (watch) => withSave((s) => startChampionshipSundayFlow(s, watch)),
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

        runScrim: (oppRef) => withResult((s) => runScrimFlow(s, oppRef)),
        scheduleScrim: (day, oppRef) => withResult((s) => scheduleScrimFlow(s, day, oppRef)),
        cancelScrim: (day) => withResult((s) => cancelScrimFlow(s, day)),

        signPlayer: (playerId, opts) =>
          withResult((s) => signPlayerFlow(s, playerId, opts), { kind: "sign", playerId }),
        releasePlayer: (playerId) =>
          withResult((s) => releasePlayerFlow(s, playerId), { kind: "release", playerId }),
        renewPlayer: (playerId, lengthSeasons, offer) =>
          withResult((s) => renewPlayerFlow(s, playerId, lengthSeasons, offer), { kind: "renew", playerId }),
        acceptBid: (offerId) => withResult((s) => acceptBidFlow(s, offerId), { kind: "sell", offerId }),
        declineBid: (offerId) => withSave((s) => declineBidFlow(s, offerId)),

        setStarters: (ids) => withResult((s) => setStartersFlow(s, ids)),
        setTrainingPackage: (pkg) => withResult((s) => setTrainingPackageFlow(s, pkg)),
        setTrainingMode: (mode) => withResult((s) => setTrainingModeFlow(s, mode)),
        setTrainingRepeat: (on) => withResult((s) => setTrainingRepeatFlow(s, on)),
        approveTrainingProposal: () => withResult(approveTrainingProposalFlow),
        keepBaseTraining: () => withResult(keepBaseTrainingFlow),
        resolveInsert: (key) => withResult((s) => resolveInsertFlow(s, key)),

        buyGear: (itemId) => withResult((s) => buyGearFlow(s, itemId)),
        setPsychologist: (on) => withResult((s) => setPsychologistFlow(s, on)),
        runBootcamp: () => withResult(runBootcampFlow),
        buyScoutReport: (playerId) =>
          withResult((s) => buyScoutReportFlow(s, playerId), { kind: "scout", playerId }),
        hireCoach: (coach) => withResult((s) => hireCoachFlow(s, coach), { kind: "hireCoach" }),
        fireCoach: () => withResult(fireCoachFlow, { kind: "fireCoach" }),
        chooseSponsor: (sponsorId) =>
          withResult((s) => chooseSponsorFlow(s, sponsorId), { kind: "chooseSponsor" }),
        payDebt: (amount) => withResult((s) => payDebtFlow(s, amount)),
        takeBankLoan: (principal) => withResult((s) => takeBankLoanFlow(s, principal)),
        payBankLoan: (amount) => withResult((s) => payBankLoanFlow(s, amount)),

        continueToNextSeason: () => withSave(rolloverToNextSeason),
        continueInfinite: () => withSave(continueInfiniteFlow),
        // ECO-02 (R46): the end flow and the viewing state pass the closed-career guard.
        retireCareer: () =>
          withSave(
            (s) => {
              const next = structuredClone(s);
              endCareer(next, "retired");
              return next;
            },
            { allowEnded: true },
          ),

        markFlag: (flag) =>
          withSave(
            (s) => {
              const next = structuredClone(s);
              next.flags[flag] = true;
              return next;
            },
            { allowEnded: true },
          ),
        markNewsRead: () =>
          withSave(
            (s) => {
              const next = structuredClone(s);
              for (const n of next.news) n.read = true;
              return next;
            },
            { allowEnded: true },
          ),
        markMailRead: (mailId) =>
          withSave(
            (s) => {
              const next = structuredClone(s);
              const item = next.mail.find((m) => m.id === mailId);
              if (item) item.read = true;
              return next;
            },
            { allowEnded: true, track: { kind: "readMail", mailId } },
          ),
        markAllMailRead: () =>
          withSave(
            (s) => {
              const next = structuredClone(s);
              for (const m of next.mail) m.read = true;
              return next;
            },
            { allowEnded: true },
          ),
        clearError: () => set({ lastError: null }),
      };
    },
    {
      name: "rocket-draft:career:v1",
      version: 3,
      storage: reportingJSONStorage("career"),
      // ADDITIVE migrate, forever: upgrade each slot in place — new versions
      // add defaults for new fields per slot instead of resetting saves.
      migrate: reportingMigrate("career", 3, (persisted) => {
        const state = persisted as CareerStoreState;
        if (state?.slots) {
          state.slots = state.slots.map((slot) => (slot ? migrateSaveToV5(slot) : null));
        }
        return state;
      }),
      partialize: (state) => ({
        slots: state.slots,
        activeSlot: state.activeSlot,
        achievements: state.achievements,
      }),
      // Load-time self-heal: repair any save whose starterIds drifted out of
      // sync with the squad (the release-crash bug) and make sure the latest
      // migration ran even if zustand skipped `migrate` (same version).
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // v2.0 (R32): additive — older stores carry no achievement memory.
        if (!state.achievements || typeof state.achievements !== "object") {
          state.achievements = EMPTY_ACHIEVEMENT_MEMORY;
        } else {
          state.achievements = {
            unlocked: state.achievements.unlocked ?? {},
            worldsWonOn: state.achievements.worldsWonOn ?? {},
          };
        }
        if (!state.slots) return;
        state.slots = state.slots.map((slot) => {
          if (!slot) return null;
          // OBS-01: read before the migration, which upgrades the slot in place.
          const fromVersion = slot.saveVersion ?? 1;
          try {
            const upgraded = migrateSaveToV5(slot) ?? slot;
            syncSquadRoles(upgraded);
            if (upgraded.saveVersion > fromVersion) {
              reportMigration("career", fromVersion, upgraded.saveVersion, `career:${careerIdOf(upgraded)}`);
            }
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
    // RTW-05 (rc.33): three seats, an empty one counts 0.
    const avg = starters.reduce((s, p) => s + p.overall, 0) / LINEUP_SEATS;
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
      // ECO-02 (R46): an insolvency (or retirement) in the endless era archives too.
      ended: save.phase === "ended" || (save.end.ended && !save.end.infinite),
      lastPlayedAt: save.lastPlayedAt,
    };
  });
}

/** Deterministic per-event seed helper for UI-side derived flavor. */
export function eventSeedFor(save: CareerSave, eventId: string): number {
  return deriveSeed(save.careerSeed, `evt:${eventId}`);
}

export { seasonLabelFor, CAREER_SEASONS, createRng, streams };
