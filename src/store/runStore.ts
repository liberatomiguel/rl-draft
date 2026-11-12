"use client";

/**
 * Active run store — the state machine for one game:
 * setup → draft → review → tournament → results.
 *
 * All game logic lives in src/engine (pure functions); this store only
 * orchestrates engine calls, keeps the RNG cursor and persists the run so a
 * page refresh resumes exactly where the player stopped. Leaving to the menu
 * clears the run (no resume system, v0.2 rule).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DIFFICULTY, regionOpponentBoost, SPECIALS } from "@/config/balance";
import {
  challengeById,
  challenges,
  lineupById,
  lineupPoolForRegion,
  nationalSpecialIdsByLineupId,
  playerById,
  playerCardById,
  seasonById,
  specialCards,
} from "@/data";
import { completeNationalLineups, nationalCardIdsOf, unownedOfferSpecials } from "@/engine/collection";
import { rankForXp, rankRewardsForXp } from "@/engine/progression";
import { challengeStatus } from "@/engine/challengeStars";
import { evaluateChallengeAchievements } from "@/engine/counterAchievements";
import {
  applyFreeReroll,
  applyPick,
  applyReroll,
  createDraft,
  drawNextOffer,
  eventSpecialsFor,
} from "@/engine/draft";
import {
  buildChallengeOpponent,
  challengeRerolls,
  countStars,
  createChallengeDraft,
  resolveChallengeAttempt,
  starRewardXp,
} from "@/engine/challenges";
import { liveAchievements, teamAchievements } from "@/engine/achievements";
import { compileResults } from "@/engine/results";
import { displayTeamOverall } from "@/engine/rating";
import { buildUserTeam } from "@/engine/teams";
import {
  initTournament,
  playNextRound,
  userHasPendingSeries,
} from "@/engine/tournament";
import { userSwissRecord } from "@/engine/swiss";
import type {
  Difficulty,
  DraftOfferCard,
  DraftState,
  Region,
  Roster,
  RosterSlotId,
  RunHistoryEntry,
  RunMode,
  RunState,
} from "@/engine/types";
import { generateDailyConfig } from "@/lib/daily";
import { dailySeedForDate, todayKey } from "@/lib/dailyPlan";
import { createRng, randomSeed } from "@/lib/rng";
import { uid } from "@/lib/util";
import { noteRunReset, registerSessionProps, takeRunResets, trackEvent, trackOnboardingStep } from "@/lib/analytics";
import { registerRunStore } from "./lazyRunStore";
import { reportingJSONStorage, reportingMigrate } from "./persistStorage";
import { selectChallengesUnlocked, useProfileStore } from "./profileStore";
import { useRewardToasts } from "./rewardToastStore";

/**
 * COL-02a (rc.33): the offer's specials the player does not own, decided NOW —
 * right after the offer is drawn, before anything is collected — and kept with
 * the run, so the NEW tag never re-reads an inventory a grant has changed.
 */
function offerNewOf(draft: DraftState): RunState["offerNew"] {
  if (!draft.offer) return undefined;
  return { round: draft.round, ids: unownedOfferSpecials(draft.offer, useProfileStore.getState().unlockedSpecials) };
}

/**
 * COL-01b (rc.33): SEEING a national team reveals its album page; it grants no
 * card. Each card is collected by drafting it and finishing the run, like every
 * special (compileResults → applyRunResults), so an abandoned run keeps the
 * discovery and collects nothing. A first find gets a toast; a team already
 * found — or with a card owned (a save from before rc.33) — stays quiet.
 * Idempotent: re-renders and re-hydrated offers discover nothing new.
 */
function discoverNationalOffer(draft: DraftState): void {
  const lineup = draft.offer ? lineupById.get(draft.offer.lineupId) : undefined;
  if (!lineup?.national) return;
  if (!useProfileStore.getState().discoverNationalTeam(lineup.id, nationalCardIdsOf(lineup.id))) return;
  useRewardToasts.getState().push([
    {
      kind: "nationalTeam",
      orgId: lineup.orgId,
      name: lineup.name,
      edition: seasonById.get(lineup.seasonId)?.shortLabel ?? "",
    },
  ]);
}

/**
 * OBS-01: the `region` every Draft event reports — the region lock, "daily",
 * a challenge's constraint region, else "worldwide" (rc.25: never empty, or
 * the dashboards bucket the run as "None").
 */
function regionLabelOf(run: RunState): string {
  if (run.mode === "daily") return "daily";
  if (run.mode === "challenge") {
    return (run.challengeId ? challengeById.get(run.challengeId)?.constraint?.region : undefined) ?? "worldwide";
  }
  return run.regionLock ?? "worldwide";
}

/** Analytics: the drafted cards in slot order, `slot:refId` joined by "|" (short slot codes). */
const PICK_SLOTS: readonly (readonly [RosterSlotId, string])[] = [
  ["player1", "p1"],
  ["player2", "p2"],
  ["player3", "p3"],
  ["sub", "sub"],
  ["coach", "coach"],
  ["org", "org"],
];
function picksOf(roster: Roster): string {
  return PICK_SLOTS.flatMap(([slot, code]) => (roster[slot] ? [`${code}:${roster[slot]!.refId}`] : [])).join("|");
}

/** Analytics: wall clock since the run was created (a resumed run counts its pause too). */
function durationSecOf(run: RunState): number | null {
  const startedMs = Date.parse(run.startedAt);
  return Number.isFinite(startedMs) ? Math.max(0, Math.round((Date.now() - startedMs) / 1000)) : null;
}

/** Analytics: an album completed by this run or challenge (`before` = the complete albums before it). */
function trackAlbumsCompleted(before: readonly string[]): void {
  const after = completeNationalLineups(useProfileStore.getState().unlockedSpecials);
  const known = new Set(before);
  for (const lineupId of after) {
    if (known.has(lineupId)) continue;
    trackEvent("collection_milestone", { kind: "album_completed", id: lineupId, albumsCompleted: after.length });
  }
}

/** OBS-01: a special the profile did not own when this run started. */
function isNewThisRun(run: RunState, specialId: string): boolean {
  const since = useProfileStore.getState().unlockedSpecials[specialId];
  return !since || since >= run.startedAt;
}

export interface StartRunOptions {
  mode: Exclude<RunMode, "daily">;
  difficulty: Difficulty;
  showOverall: boolean;
  /** Region-locked run (v1.2.0). null/undefined = worldwide (default). */
  regionLock?: Region | null;
}

interface RunStore {
  run: RunState | null;
  /** Mode the setup screen configures — set by the home menu cards. */
  setupMode: Exclude<RunMode, "daily">;

  setSetupMode: (mode: Exclude<RunMode, "daily">) => void;
  startRun: (options: StartRunOptions) => void;
  startDailyRun: () => void;
  /** Start a challenge run (v1.4) — a constrained draft vs a fixed boss. */
  startChallenge: (challengeId: string) => void;
  clearRun: () => void;
  /** Abandon the current run and immediately start a fresh one with the SAME
   *  mode/difficulty/visibility — drops straight into a new draft. */
  restartRun: () => void;

  // Draft phase
  pickCard: (card: DraftOfferCard, slot: RosterSlotId) => void;
  reroll: () => void;
  freeReroll: () => void;

  // Review phase
  startTournament: () => void;

  // Tournament phase
  playRound: () => void;
  /** Award live feats for the first N user series revealed on screen (v1.4). */
  awardRevealedAchievements: (revealedUserSeries: number) => void;
  finishRun: () => void;

  // Challenge phase (v1.4) — single Bo7 vs the fixed boss.
  playChallenge: () => void;
}

export const useRunStore = create<RunStore>()(
  persist(
    (set, get) => ({
      run: null,
      setupMode: "classic",

      setSetupMode: (setupMode) => set({ setupMode }),

      startRun: ({ mode, difficulty, showOverall, regionLock }) => {
        // Stamped when the run starts: a special collected by this run counts as
        // new this run (`special_used.isNew`, OBS-01).
        const startedAt = new Date().toISOString();
        const seed = randomSeed();
        const rng = createRng(seed);
        const profile = DIFFICULTY[difficulty];
        const region = regionLock ?? null;
        // Region-locked runs draw from the region's full pool (Worlds finalists
        // + its samOnly Top-8 teams); worldwide runs use the default pool.
        const poolLineupIds = region ? lineupPoolForRegion(region) : undefined;
        // v1.3 rank rewards: the player's rank gates which special rarities can
        // appear and scales their chance (Unranked → none; Champion+ → richer).
        // Folded into specialChanceMult so the draft engine stays unchanged.
        const xpAtStart = useProfileStore.getState().xp;
        const rewards = rankRewardsForXp(xpAtStart);
        const draft = drawNextOffer(
          createDraft(difficulty, {
            mode,
            poolLineupIds,
            specialChanceMult: rewards.specialChance / SPECIALS.rankBaselineChance,
            specialRarities: rewards.rarities,
            // Event-exclusive cards live today + the Special Hunt boost (v2.0).
            eventSpecials: eventSpecialsFor(specialCards, todayKey(), useProfileStore.getState().events),
            // National teams (v2.0): a rare draw of their own in classic/quick,
            // favouring the teams the player has not completed (rc.33).
            // v2.0 (C2): rank-gated like the special rarities (`national`, Gold).
            ...(rewards.rarities.includes("national")
              ? { nationalTeams: { complete: completeNationalLineups(useProfileStore.getState().unlockedSpecials) } }
              : {}),
          }),
          rng,
        );
        const offerNew = offerNewOf(draft);
        discoverNationalOffer(draft);

        // Remember the setup for next time (and for "Play again").
        useProfileStore.getState().setLastSetup(difficulty, showOverall, mode, region);

        const run: RunState = {
          runId: uid("run"),
          mode,
          ...(region ? { regionLock: region } : {}),
          seed,
          rngState: rng.state,
          difficulty,
          showOverall: profile.overallLockedHidden ? false : showOverall,
          phase: "draft",
          startedAt,
          xpAtStart,
          draft,
          offerNew,
          tournament: null,
          challenge: null,
          results: null,
        };
        set({ run });
        // 2.0: no event per run start (a run is ONE event, at its end) - only the funnel's first.
        trackOnboardingStep("draft_started");
      },

      startDailyRun: () => {
        const date = todayKey();
        if (useProfileStore.getState().dailyResults[date]) return;
        const config = generateDailyConfig(date);
        const seed = dailySeedForDate(date);
        const rng = createRng(seed);

        const draft = drawNextOffer(
          createDraft(config.difficulty, {
            mode: "daily",
            poolLineupIds: config.poolLineupIds,
            rerollsOverride: config.rerollsOverride,
            specialChanceMult: config.specialChanceMult,
            scriptedLineups: config.scriptedLineups,
            // The daily is shared, so only the WINDOW applies (no per-player hunt
            // boost) — everyone sees the same odds on the same day.
            eventSpecials: (() => {
              const ev = eventSpecialsFor(specialCards, date, undefined);
              return ev ? { active: ev.active, boosted: [] } : undefined;
            })(),
          }),
          rng,
        );

        const run: RunState = {
          runId: uid("daily"),
          mode: "daily",
          seed,
          rngState: rng.state,
          difficulty: config.difficulty,
          // Dailies set their OWN visibility (v1.2.1): a challenge can run a
          // stronger field (Hard) while keeping overalls visible. The daily's
          // hiddenOverall is the single source of truth, so a Hard daily no
          // longer force-hides — only `hiddenOverall: true` templates do.
          showOverall: config.hiddenOverall ? false : true,
          phase: "draft",
          startedAt: new Date().toISOString(),
          xpAtStart: useProfileStore.getState().xp,
          daily: config.info,
          draft,
          offerNew: offerNewOf(draft),
          tournament: null,
          challenge: null,
          results: null,
        };
        set({ run });
        trackOnboardingStep("draft_started");
      },

      startChallenge: (challengeId) => {
        const challenge = challengeById.get(challengeId);
        if (!challenge) return;
        const profile = useProfileStore.getState();
        if (challengeStatus(challenge, profile.xp, profile.challengesCompleted, {
          challengeStars: profile.challengeStars, careerMarks: profile.careerMarks, quizSolved: profile.quiz.solved,
          veteran: selectChallengesUnlocked(profile),
        }) === "locked") return;
        // Deterministic per-challenge seed → a repeatable, solvable puzzle.
        const rng = createRng(challenge.seed);
        const draft = createChallengeDraft(challenge, rng);
        const run: RunState = {
          runId: uid("challenge"),
          mode: "challenge",
          challengeId,
          seed: challenge.seed,
          rngState: rng.state,
          difficulty: challenge.sim.difficulty,
          // Challenges always show overalls — they're strategy puzzles, not the
          // knowledge test that hides overalls on Hard/Legacy runs.
          showOverall: true,
          phase: "draft",
          startedAt: new Date().toISOString(),
          draft,
          offerNew: offerNewOf(draft),
          tournament: null,
          challenge: null,
          results: null,
        };
        set({ run });
        trackOnboardingStep("draft_started");
      },

      clearRun: () => {
        // A run cleared before its results screen is an abandonment — the
        // funnel drop-off signal. (Clearing FROM results = a completed run,
        // so it's excluded.) Fires via the page.tsx + AppShell route guards.
        const { run } = get();
        // A challenge that was already played is reported by `challenge_played`:
        // leaving its result screen is not an abandonment (it has no "results" phase).
        const played = !!run?.challenge && (run.challenge.evaluated || !!run.challenge.series);
        if (run && run.phase !== "results" && !played) {
          trackEvent("run_abandoned", {
            runId: run.runId,
            mode: run.mode,
            difficulty: run.difficulty,
            phase: run.phase,
            reason: "quit",
            hiddenOverall: !run.showOverall,
            region: regionLabelOf(run),
            resets: takeRunResets(),
            picksMade: Object.keys(run.draft?.roster ?? {}).length, // defensive: a malformed stored run still clears
            durationSec: durationSecOf(run),
          });
        } else if (run) {
          takeRunResets(); // a finished run closes its chain of resets
        }
        set({ run: null });
      },

      restartRun: () => {
        const { run } = get();
        if (!run) return;
        // 2.0: a restart mid-run is a RESET - a counter carried by the run's one
        // event (`resets`), not an event of its own (resets were almost half of
        // all run starts). A restart from results is just "play again"; so is a
        // replay of a challenge that was already played.
        const played = !!run.challenge && (run.challenge.evaluated || !!run.challenge.series);
        if (run.phase !== "results" && !played) noteRunReset();
        else takeRunResets();
        // Daily restarts re-roll today's seeded run; everything else re-runs
        // startRun with the same settings (a brand-new seed → fresh draft).
        if (run.mode === "daily") {
          get().startDailyRun();
          return;
        }
        // Challenges are FIXED-SEED puzzles — a reset must replay the SAME
        // challenge (same offers + boss), not spin up a fresh classic draft.
        if (run.mode === "challenge" && run.challengeId) {
          get().startChallenge(run.challengeId);
          return;
        }
        get().startRun({
          mode: run.mode,
          difficulty: run.difficulty,
          showOverall: run.showOverall,
          regionLock: run.regionLock ?? null,
        });
      },

      pickCard: (card, slot) => {
        const { run } = get();
        if (!run || run.phase !== "draft") return;
        const rng = createRng(run.rngState);
        const draft = applyPick(run.draft, card, slot, rng);
        // Missions (v2.0): "select a special card" counts at pick time.
        if (card.specialId) useProfileStore.getState().applyMissionEvent({ type: "special_selected" });
        const offerNew = offerNewOf(draft);
        discoverNationalOffer(draft);
        set({
          run: {
            ...run,
            draft,
            offerNew,
            rngState: rng.state,
            phase: draft.complete ? "review" : "draft",
          },
        });
      },

      reroll: () => {
        const { run } = get();
        if (!run || run.phase !== "draft") return;
        // rc.29: when nothing in the offer fits, the reroll is the free one — a
        // paid reroll is never spent on a dead offer.
        if (run.draft.offer && !run.draft.offer.hasPickableCard) {
          get().freeReroll();
          return;
        }
        if (run.draft.rerollsLeft <= 0) return;
        const rng = createRng(run.rngState);
        const draft = applyReroll(run.draft, rng);
        const offerNew = offerNewOf(draft);
        discoverNationalOffer(draft);
        set({ run: { ...run, draft, offerNew, rngState: rng.state } });
      },

      freeReroll: () => {
        const { run } = get();
        if (!run || run.phase !== "draft") return;
        if (run.draft.offer?.hasPickableCard) return;
        const rng = createRng(run.rngState);
        const draft = applyFreeReroll(run.draft, rng);
        const offerNew = offerNewOf(draft);
        discoverNationalOffer(draft);
        set({ run: { ...run, draft, offerNew, rngState: rng.state } });
      },

      startTournament: () => {
        const { run } = get();
        if (!run || run.phase !== "review") return;
        const rng = createRng(run.rngState);
        const userTeam = buildUserTeam(run.draft.roster, run.difficulty, {
          mode: run.mode,
        });

        // Challenge mode (v1.4): no Swiss/playoffs — build the fixed boss and go
        // straight to the single-Bo7 "challenge" phase.
        if (run.mode === "challenge") {
          if (!run.challengeId) return;
          const challenge = challengeById.get(run.challengeId);
          if (!challenge) return;
          const opponent = buildChallengeOpponent(challenge);
          set({
            run: {
              ...run,
              challenge: {
                user: userTeam,
                opponent,
                series: null,
                cleared: false,
                // Rerolls spent in the draft (the "maxRerolls" star, v2.0).
                rerollsUsed: Math.max(
                  0,
                  challengeRerolls(challenge) - run.draft.rerollsLeft,
                ),
              },
              rngState: rng.state,
              phase: "challenge",
            },
          });
          trackOnboardingStep("draft_confirmed");
          if (challenge.kind === "draft") get().playChallenge();
          return;
        }

        // Real-time: team-build achievements (perfect chemistry, all-one-region,
        // loaded-with-specials, etc.) pop the moment the team is locked in (v1.4).
        useProfileStore
          .getState()
          .awardAchievements(
            teamAchievements(run.draft.roster, userTeam.chemistry, userTeam.specialIds.length, new Set()),
          );

        const tournament = initTournament(userTeam, run.difficulty, rng, {
          mode: run.mode,
          poolLineupIds: run.draft.poolLineupIds,
          // Region-locked runs face a weaker regional field — normalise it so the
          // difficulty curve matches worldwide with adapted overalls (v1.3.1;
          // per-difficulty boost since v1.3.3).
          opponentRatingBoost: run.regionLock
            ? regionOpponentBoost(run.regionLock, run.difficulty)
            : run.daily?.opponentShift ?? 0,
        });
        set({
          run: { ...run, tournament, rngState: rng.state, phase: "tournament" },
        });
        // 2.0: the fielded specials ride on `run_completed.specials` (no event per card).
        trackOnboardingStep("draft_confirmed");
      },

      playRound: () => {
        const { run } = get();
        if (!run || run.phase !== "tournament" || !run.tournament) return;
        const rng = createRng(run.rngState);

        let tournament = playNextRound(run.tournament, run.difficulty, rng);
        // Auto-resolve AI-only rounds (user advanced early or eliminated)
        // until the user's next series — or the champion is crowned.
        let guard = 0;
        while (
          tournament.stage !== "finished" &&
          !userHasPendingSeries(tournament) &&
          guard < 16
        ) {
          tournament = playNextRound(tournament, run.difficulty, rng);
          guard += 1;
        }

        set({ run: { ...run, tournament, rngState: rng.state } });
        // NOTE: live feats are NOT awarded here. The engine simulates the whole
        // round (and AI rounds) ahead of the animation, so awarding now made a
        // feat (e.g. a hat-trick) pop before its match was even revealed on
        // screen. The UI calls `awardRevealedAchievements` as each user series
        // finishes REVEALING; `finishRun` re-evaluates the full tournament as a
        // safety net for anything skipped. (v1.4)
      },

      /**
       * Award in-match / series feats for the first `revealedUserSeries` user
       * series in reveal order — called by TournamentScreen the moment a series
       * finishes animating, so feats pop at the dramatically-correct time, not
       * when the bracket was simulated. `awardAchievements` dedupes. (v1.4)
       */
      awardRevealedAchievements: (revealedUserSeries: number) => {
        const t = get().run?.tournament;
        if (!t) return;
        useProfileStore
          .getState()
          .awardAchievements(liveAchievements(t, new Set(), revealedUserSeries));
      },

      finishRun: () => {
        const { run } = get();
        if (!run || !run.tournament || run.phase === "results") return;
        if (run.tournament.stage !== "finished") return;

        const rng = createRng(run.rngState);
        const profile = useProfileStore.getState();
        const results = compileResults(
          run,
          run.tournament,
          {
            unlockedSpecialIds: Object.keys(profile.unlockedSpecials),
            achievementIds: Object.keys(profile.achievements),
          },
          rng,
        );

        // A restored/stale Daily may reach the finish action after that date's
        // official result was recorded. Show its outcome without a second grant
        // or a second mission/Hunt event.
        if (run.daily && profile.dailyResults[run.daily.date]) {
          set({ run: { ...run, phase: "results", results: {
            ...results, unlockedSpecialIds: [], newAchievementIds: [],
            xp: { ...results.xp, lines: [], total: 0 },
          } } });
          return;
        }

        const userTeam = run.tournament.teams["user"];
        const playerNames = [
          run.draft.roster.player1,
          run.draft.roster.player2,
          run.draft.roster.player3,
        ].map((pick) => {
          const card = pick && playerCardById.get(pick.refId);
          return card ? playerById.get(card.playerId)?.nickname ?? "?" : "?";
        });

        const entry: RunHistoryEntry = {
          runId: run.runId,
          date: new Date().toISOString(),
          difficulty: run.difficulty,
          mode: run.mode,
          region: run.regionLock ?? null,
          hiddenOverall: !run.showOverall,
          placement: results.placement,
          teamOverall: userTeam ? displayTeamOverall(userTeam.rating) : 0,
          swissRecord: userSwissRecord(run.tournament.swiss),
          rosterNames: playerNames,
          xpGained: results.xp.total,
          // Rich recap (v1.4): the drafted roster + outcome facts, so the profile
          // can show how the run went. Stored as refs (resolved at render time).
          recap: {
            roster: run.draft.roster,
            chemistryTier: userTeam?.chemistry.tier ?? "Poor",
            chemistryPercent: userTeam?.chemistry.percent ?? 0,
            championName: results.championName,
            goalsConceded: results.goalsConceded,
          },
        };

        const albumsBefore = completeNationalLineups(profile.unlockedSpecials);
        profile.applyRunResults(
          results,
          entry,
          run.daily ? { date: run.daily.date, label: run.daily.label } : undefined,
        );
        // v2.0 (C2): FIFAe album achievements, read after the run's cards landed.
        {
          const complete = completeNationalLineups(useProfileStore.getState().unlockedSpecials).length;
          const ids: string[] = [];
          if (complete >= 1) ids.push("ach-national-first");
          if (nationalSpecialIdsByLineupId.size > 0 && complete >= nationalSpecialIdsByLineupId.size) ids.push("ach-national-all");
          if (ids.length) useProfileStore.getState().awardAchievements(ids);
        }
        // Special Hunt (v2.0): every event card live during this run counts a run
        // toward its boost threshold.
        if (run.draft.eventSpecials?.active.length) {
          useProfileStore.getState().recordEventRuns(run.draft.eventSpecials.active);
        }
        // Missions (v2.0): one event with the run's facts, folded after the profile
        // write so mission XP lands on top of the run's own.
        const starters = [run.draft.roster.player1, run.draft.roster.player2, run.draft.roster.player3];
        useProfileStore.getState().applyMissionEvent({
          type: "run_completed",
          mode: run.mode,
          difficulty: run.difficulty,
          placement: results.placement,
          region: run.regionLock ?? null,
          hiddenOverall: !run.showOverall,
          seriesWins: entry.swissRecord.wins + results.playoffWins,
          gameWins: results.userGameWins,
          goals: results.userGoals,
          specialsFielded: userTeam?.specialIds.length ?? 0,
          chemistryTier: userTeam?.chemistry.tier ?? "Poor",
          sameLineupTrio:
            starters.every(Boolean) && new Set(starters.map((p) => p!.fromLineupId)).size === 1,
          teamOverall: entry.teamOverall,
        });
        set({
          run: { ...run, results, rngState: rng.state, phase: "results" },
        });

        // 2.0: ONE event for the whole run, read after every grant landed (the
        // run's XP, rating, achievements, missions) - the key outcome event.
        {
          const after = useProfileStore.getState();
          const rankAfter = rankForXp(after.xp);
          const specialIds = userTeam?.specialIds ?? [];
          trackEvent("run_completed", {
            runId: run.runId,
            mode: run.mode,
            difficulty: run.difficulty,
            region: regionLabelOf(run),
            placement: results.placement,
            won: results.placement === "champion",
            hiddenOverall: !run.showOverall,
            teamOverall: entry.teamOverall,
            swissWins: entry.swissRecord.wins,
            swissLosses: entry.swissRecord.losses,
            playoffWins: results.playoffWins,
            gameWins: results.userGameWins,
            goalsFor: results.userGoals,
            goalsAgainst: results.goalsConceded,
            eliminatedStage: results.eliminatedBy?.stage ?? null,
            xpGained: entry.xpGained,
            chemistryTier: entry.recap?.chemistryTier ?? "Poor",
            chemistryPercent: entry.recap?.chemistryPercent ?? 0,
            durationSec: durationSecOf(run),
            dailyTemplate: run.daily?.templateId ?? null,
            resets: takeRunResets(),
            rerollsLeft: run.draft.rerollsLeft,
            picks: picksOf(run.draft.roster),
            specials: specialIds.join("|"),
            specialsCount: specialIds.length,
            specialsNew: specialIds.filter((id) => isNewThisRun(run, id)).length,
            achievementsNew: Math.max(0, Object.keys(after.achievements).length - Object.keys(profile.achievements).length),
            ratingDelta: after.mmr - profile.mmr,
            ratingAfter: after.mmr,
            rankId: rankAfter.id,
            rankUp: rankAfter.index > rankForXp(profile.xp).index,
          });
          trackAlbumsCompleted(albumsBefore);
          trackOnboardingStep("run_completed");
        }
      },

      playChallenge: () => {
        const { run } = get();
        if (
          !run ||
          run.phase !== "challenge" ||
          !run.challenge ||
          (run.challenge.evaluated || run.challenge.series || run.challenge.stages?.failedAt != null) || // already played
          !run.challengeId
        ) {
          return;
        }
        const challenge = challengeById.get(run.challengeId);
        if (!challenge) return;
        const rng = createRng(run.rngState);
        const { user, opponent } = run.challenge;
        const profile = useProfileStore.getState();

        const rerollsUsed = run.challenge.rerollsUsed ?? 0;
        const outcome = resolveChallengeAttempt(challenge, user, opponent, run.draft.roster, rerollsUsed, rng);
        const { cleared, starsEarned } = outcome;

        // Specials drafted onto the challenge team unlock into the collection just
        // like a normal run, win or lose (v1.4.3, #100).
        const albumsBefore = completeNationalLineups(profile.unlockedSpecials);
        profile.collectSpecials(user.specialIds, "challenge");
        // Capture XP BEFORE the reward so the cleared screen can fire the rank-up
        // celebration if the reward crossed a rank threshold (v1.4).
        const xpBefore = profile.xp;

        let starsNew = 0;
        if (starsEarned) {
          const had = profile.challengeStars[challenge.id] ?? 0;
          const xpForNew = starRewardXp(challenge, had, starsEarned);
          starsNew = profile.recordChallengeResult(challenge.id, starsEarned, xpForNew, challenge.reward);
          // v2.0 (C2): challenge achievements, read from the profile after the result.
          {
            // E1: the rule lives in the engine (three stars, every clear, 45 / 90 / every star).
            const after = useProfileStore.getState();
            const ids = evaluateChallengeAchievements(
              { stars: after.challengeStars, completed: after.challengesCompleted, challengeIds: challenges.map((c) => c.id) },
              new Set(Object.keys(after.achievements)),
            );
            if (ids.length) after.awardAchievements(ids);
          }
          if (starsNew) {
            useProfileStore.getState().applyMissionEvent({
              type: "challenge_cleared",
              newStars: countStars(starsNew),
            });
          }
        }
        set({
          run: {
            ...run,
            challenge: {
              ...run.challenge,
              ...outcome,
              evaluated: true,
              xpBefore,
              starsNew,
            },
            rngState: rng.state,
          },
        });
        {
          const xpAfter = useProfileStore.getState().xp;
          trackEvent("challenge_played", {
            challengeId: challenge.id,
            difficulty: challenge.sim.difficulty,
            kind: challenge.kind ?? "boss",
            cleared,
            stars: countStars(starsEarned),
            starsNew: countStars(starsNew),
            firstClear: cleared && !profile.challengesCompleted[challenge.id],
            resets: takeRunResets(),
            rerollsUsed,
            teamOverall: displayTeamOverall(user.rating),
            chemistryPercent: user.chemistry.percent,
            picks: picksOf(run.draft.roster),
            specials: user.specialIds.join("|"),
            xpGained: Math.max(0, xpAfter - xpBefore),
          });
          trackAlbumsCompleted(albumsBefore);
          trackOnboardingStep("challenge_played");
        }
      },
    }),
    {
      name: "rocket-draft:run:v1",
      version: 3,
      storage: reportingJSONStorage("run"),
      // The run shape changed in v0.2 (double elim) and v0.3 (modes):
      // discard older persisted runs instead of resuming a broken one.
      migrate: reportingMigrate("run", 3, (persisted, version) =>
        version < 3 ? { run: null } : (persisted as { run: RunState | null }),
      ),
      partialize: (state) => ({ run: state.run }),
    },
  ),
);

// AppShell and the home menu reach the store through ./lazyRunStore (#60).
registerRunStore(useRunStore);

// Analytics: an unfinished run waiting to be resumed, for `session_started`.
registerSessionProps(() => ({ openRunPhase: useRunStore.getState().run?.phase ?? null }));
