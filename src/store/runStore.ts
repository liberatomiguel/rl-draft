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
import { DIFFICULTY, REGION_LOCK, SPECIALS } from "@/config/balance";
import { challengeById, lineupPoolForRegion, playerById, playerCardById, specialCardById } from "@/data";
import { rankRewardsForXp } from "@/engine/progression";
import {
  applyFreeReroll,
  applyPick,
  applyReroll,
  createDraft,
  drawNextOffer,
} from "@/engine/draft";
import {
  buildChallengeOpponent,
  createChallengeDraft,
  playChallengeSeries,
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
  Region,
  RosterSlotId,
  RunHistoryEntry,
  RunMode,
  RunState,
} from "@/engine/types";
import { generateDailyConfig, seedFromDate, todayKey } from "@/lib/daily";
import { createRng, randomSeed } from "@/lib/rng";
import { uid } from "@/lib/util";
import { trackEvent } from "@/lib/analytics";
import { useProfileStore } from "./profileStore";

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
        const rewards = rankRewardsForXp(useProfileStore.getState().xp);
        const draft = drawNextOffer(
          createDraft(difficulty, {
            mode,
            poolLineupIds,
            specialChanceMult: rewards.specialChance / SPECIALS.rankBaselineChance,
            specialRarities: rewards.rarities,
          }),
          rng,
        );

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
          startedAt: new Date().toISOString(),
          draft,
          tournament: null,
          challenge: null,
          results: null,
        };
        set({ run });
        trackEvent("run_started", {
          mode,
          difficulty,
          hiddenOverall: !run.showOverall,
          region: region ?? "worldwide",
        });
      },

      startDailyRun: () => {
        const date = todayKey();
        const config = generateDailyConfig(date);
        const seed = seedFromDate(date);
        const rng = createRng(seed);

        const draft = drawNextOffer(
          createDraft(config.difficulty, {
            mode: "daily",
            poolLineupIds: config.poolLineupIds,
            rerollsOverride: config.rerollsOverride,
            specialChanceMult: config.specialChanceMult,
            scriptedLineups: config.scriptedLineups,
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
          daily: config.info,
          draft,
          tournament: null,
          challenge: null,
          results: null,
        };
        set({ run });
        trackEvent("run_started", {
          mode: "daily",
          difficulty: config.difficulty,
          hiddenOverall: !run.showOverall,
        });
      },

      startChallenge: (challengeId) => {
        const challenge = challengeById.get(challengeId);
        if (!challenge) return;
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
          tournament: null,
          challenge: null,
          results: null,
        };
        set({ run });
        trackEvent("run_started", {
          mode: "challenge",
          difficulty: challenge.sim.difficulty,
          hiddenOverall: false,
          region: challenge.constraint?.region ?? "worldwide",
        });
      },

      clearRun: () => {
        // A run cleared before its results screen is an abandonment — the
        // funnel drop-off signal. (Clearing FROM results = a completed run,
        // so it's excluded.) Fires via the page.tsx + AppShell route guards.
        const { run } = get();
        if (run && run.phase !== "results") {
          trackEvent("run_abandoned", {
            mode: run.mode,
            difficulty: run.difficulty,
            phase: run.phase,
            reason: "quit",
            hiddenOverall: !run.showOverall,
            region: run.regionLock ?? "worldwide",
          });
        }
        set({ run: null });
      },

      restartRun: () => {
        const { run } = get();
        if (!run) return;
        // Restarting mid-run abandons the current one (a fresh run_started
        // fires from startRun/startDailyRun below). A restart from results is
        // just "play again", so it isn't counted as an abandonment.
        if (run.phase !== "results") {
          trackEvent("run_abandoned", {
            mode: run.mode,
            difficulty: run.difficulty,
            phase: run.phase,
            reason: "restart",
            hiddenOverall: !run.showOverall,
            region: run.regionLock ?? "worldwide",
          });
        }
        // Daily restarts re-roll today's seeded run; everything else re-runs
        // startRun with the same settings (a brand-new seed → fresh draft).
        if (run.mode === "daily") {
          get().startDailyRun();
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
        set({
          run: {
            ...run,
            draft,
            rngState: rng.state,
            phase: draft.complete ? "review" : "draft",
          },
        });
      },

      reroll: () => {
        const { run } = get();
        if (!run || run.phase !== "draft" || run.draft.rerollsLeft <= 0) return;
        const rng = createRng(run.rngState);
        const draft = applyReroll(run.draft, rng);
        set({ run: { ...run, draft, rngState: rng.state } });
      },

      freeReroll: () => {
        const { run } = get();
        if (!run || run.phase !== "draft") return;
        if (run.draft.offer?.hasPickableCard) return;
        const rng = createRng(run.rngState);
        const draft = applyFreeReroll(run.draft, rng);
        set({ run: { ...run, draft, rngState: rng.state } });
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
              challenge: { user: userTeam, opponent, series: null, cleared: false },
              rngState: rng.state,
              phase: "challenge",
            },
          });
          trackEvent("tournament_started", {
            mode: "challenge",
            difficulty: run.difficulty,
          });
          for (const id of userTeam.specialIds) {
            const sp = specialCardById.get(id);
            if (sp) {
              trackEvent("special_used", {
                specialId: id,
                title: sp.title,
                rarity: sp.rarity,
                mode: "challenge",
                difficulty: run.difficulty,
              });
            }
          }
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
            ? REGION_LOCK.opponentRatingBoost[run.difficulty]
            : 0,
        });
        set({
          run: { ...run, tournament, rngState: rng.state, phase: "tournament" },
        });
        trackEvent("tournament_started", {
          mode: run.mode,
          difficulty: run.difficulty,
        });
        // Special-card usage: one event per special on the locked roster, so
        // PostHog can rank which specials players actually take into a tournament.
        for (const id of userTeam.specialIds) {
          const sp = specialCardById.get(id);
          if (sp) {
            trackEvent("special_used", {
              specialId: id,
              title: sp.title,
              rarity: sp.rarity,
              mode: run.mode,
              difficulty: run.difficulty,
            });
          }
        }
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

        // Real-time: in-match / series feats (hat-trick, 7-goal win, reverse
        // sweep, giant-slayer, game-7…) pop as soon as the round that produced
        // them is played — not only at run end (v1.4). awardAchievements dedupes.
        useProfileStore.getState().awardAchievements(liveAchievements(tournament, new Set()));
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
        };

        trackEvent("run_completed", {
          mode: run.mode,
          difficulty: run.difficulty,
          placement: results.placement,
          won: results.placement === "champion",
          hiddenOverall: !run.showOverall,
          teamOverall: entry.teamOverall,
          swissWins: entry.swissRecord.wins,
          swissLosses: entry.swissRecord.losses,
          xpGained: entry.xpGained,
        });

        profile.applyRunResults(
          results,
          entry,
          run.daily ? { date: run.daily.date, label: run.daily.label } : undefined,
        );
        set({
          run: { ...run, results, rngState: rng.state, phase: "results" },
        });
      },

      playChallenge: () => {
        const { run } = get();
        if (
          !run ||
          run.phase !== "challenge" ||
          !run.challenge ||
          run.challenge.series || // already played
          !run.challengeId
        ) {
          return;
        }
        const challenge = challengeById.get(run.challengeId);
        if (!challenge) return;
        const rng = createRng(run.rngState);
        const { user, opponent } = run.challenge;
        const series = playChallengeSeries(user, opponent, challenge, rng);
        const cleared = series.winnerTeamId === user.id;
        // Sync AFTER the result is known (the single funnel for challenge rewards)
        // — one-and-done, so re-clearing never re-rewards (#55.5 spirit).
        if (cleared) {
          useProfileStore.getState().completeChallenge(challenge.id, challenge.reward);
        }
        set({
          run: {
            ...run,
            challenge: { ...run.challenge, series, cleared },
            rngState: rng.state,
          },
        });
        trackEvent("challenge_played", {
          challengeId: challenge.id,
          difficulty: challenge.sim.difficulty,
          cleared,
        });
      },
    }),
    {
      name: "rocket-draft:run:v1",
      version: 3,
      // The run shape changed in v0.2 (double elim) and v0.3 (modes):
      // discard older persisted runs instead of resuming a broken one.
      migrate: (persisted, version) =>
        version < 3 ? { run: null } : (persisted as { run: RunState | null }),
      partialize: (state) => ({ run: state.run }),
    },
  ),
);
