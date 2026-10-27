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
  lineupById,
  lineupPoolForRegion,
  nationalSpecialIdsByLineupId,
  playerById,
  playerCardById,
  seasonById,
  specialCardById,
  specialCards,
} from "@/data";
import { rankRewardsForXp } from "@/engine/progression";
import {
  applyFreeReroll,
  applyPick,
  applyReroll,
  createDraft,
  drawNextOffer,
  eventSpecialsFor,
  nationalUnlocks,
} from "@/engine/draft";
import {
  buildChallengeOpponent,
  buildGauntletOpponents,
  countStars,
  createChallengeDraft,
  evaluateStars,
  playChallengeSeries,
  playGauntletStage,
  starRewardXp,
} from "@/engine/challenges";
import { CHALLENGE } from "@/config/balance";
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
  RosterSlotId,
  RunHistoryEntry,
  RunMode,
  RunState,
  SeriesResult,
} from "@/engine/types";
import { generateDailyConfig, seedFromDate, todayKey } from "@/lib/daily";
import { createRng, randomSeed } from "@/lib/rng";
import { uid } from "@/lib/util";
import { trackEvent } from "@/lib/analytics";
import { useProfileStore } from "./profileStore";
import { useRewardToasts } from "./rewardToastStore";

/**
 * National teams the player has fully collected (v2.0) — the draft favours the
 * others (DRAFT.nationalUndiscoveredWeight) so the album can be completed.
 */
function discoveredNationalLineups(unlocked: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [lineupId, ids] of nationalSpecialIdsByLineupId) {
    if (ids.every((id) => unlocked[id])) out.push(lineupId);
  }
  return out;
}

/**
 * Seeing a national team collects ALL its cards (v2.0, engine nationalUnlocks);
 * a find that adds new cards gets a toast. Idempotent — re-renders and
 * re-hydrated offers collect nothing new.
 */
function collectNationalOffer(draft: DraftState): void {
  const ids = nationalUnlocks(draft.offer);
  if (ids.length === 0 || !draft.offer) return;
  const profile = useProfileStore.getState();
  const fresh = ids.filter((id) => !profile.unlockedSpecials[id]);
  if (fresh.length === 0) return;
  profile.collectSpecials(ids);
  const lineup = lineupById.get(draft.offer.lineupId);
  if (!lineup) return;
  useRewardToasts.getState().push([
    {
      kind: "nationalTeam",
      orgId: lineup.orgId,
      name: lineup.name,
      edition: seasonById.get(lineup.seasonId)?.shortLabel ?? "",
      cards: fresh.length,
    },
  ]);
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
            // National teams (v2.0): a rare draw of their own in classic/quick.
            nationalTeams: { discovered: discoveredNationalLineups(useProfileStore.getState().unlockedSpecials) },
          }),
          rng,
        );
        collectNationalOffer(draft);

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
          xpAtStart,
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
        collectNationalOffer(draft);
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
        collectNationalOffer(draft);
        set({ run: { ...run, draft, rngState: rng.state } });
      },

      freeReroll: () => {
        const { run } = get();
        if (!run || run.phase !== "draft") return;
        if (run.draft.offer?.hasPickableCard) return;
        const rng = createRng(run.rngState);
        const draft = applyFreeReroll(run.draft, rng);
        collectNationalOffer(draft);
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
              challenge: {
                user: userTeam,
                opponent,
                series: null,
                cleared: false,
                // Rerolls spent in the draft (the "maxRerolls" star, v2.0).
                rerollsUsed: Math.max(
                  0,
                  CHALLENGE.rerollsByDifficulty[challenge.sim.difficulty] - run.draft.rerollsLeft,
                ),
              },
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
            ? regionOpponentBoost(run.regionLock, run.difficulty)
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
        const profile = useProfileStore.getState();

        // Gauntlet (v2.0): the stages play in order; the first loss ends the run
        // before the boss. A plain boss challenge has no stages.
        const stageOpponents = run.challenge.stages?.opponents ?? buildGauntletOpponents(challenge);
        const stageResults: SeriesResult[] = [];
        let failedAt: number | null = null;
        for (let i = 0; i < stageOpponents.length; i++) {
          const r = playGauntletStage(user, stageOpponents[i], challenge, rng);
          stageResults.push(r);
          if (r.winnerTeamId !== user.id) {
            failedAt = i;
            break;
          }
        }
        const series = failedAt === null ? playChallengeSeries(user, opponent, challenge, rng) : null;
        const cleared = !!series && series.winnerTeamId === user.id;

        // Specials drafted onto the challenge team unlock into the collection just
        // like a normal run, win or lose (v1.4.3, #100).
        profile.collectSpecials(user.specialIds);
        // Capture XP BEFORE the reward so the cleared screen can fire the rank-up
        // celebration if the reward crossed a rank threshold (v1.4).
        const xpBefore = profile.xp;

        // Stars (v2.0): evaluate on a clear, pay only what is new for the profile.
        const rerollsUsed = run.challenge.rerollsUsed ?? 0;
        const starsEarned = series
          ? evaluateStars(challenge, {
              user,
              boss: series,
              all: [...stageResults, series],
              bossOverall: displayTeamOverall(opponent.rating),
              rerollsUsed,
              roster: run.draft.roster,
            })
          : 0;
        let starsNew = 0;
        if (starsEarned) {
          const had = profile.challengeStars[challenge.id] ?? 0;
          const xpForNew = starRewardXp(challenge, had, starsEarned);
          starsNew = profile.recordChallengeResult(challenge.id, starsEarned, xpForNew, challenge.reward);
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
              series,
              cleared,
              xpBefore,
              starsEarned,
              starsNew,
              stages: stageOpponents.length ? { opponents: stageOpponents, results: stageResults, failedAt } : undefined,
            },
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
