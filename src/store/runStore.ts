"use client";

/**
 * Active run store — the state machine for one game:
 * setup → draft → review → tournament → results.
 *
 * All game logic lives in src/engine (pure functions); this store only
 * orchestrates engine calls, keeps the RNG cursor and persists the run so a
 * page refresh resumes exactly where the player stopped.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DIFFICULTY } from "@/config/balance";
import { playerById, playerCardById } from "@/data";
import {
  applyFreeReroll,
  applyPick,
  applyReroll,
  createDraft,
  drawNextOffer,
} from "@/engine/draft";
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
  RosterSlotId,
  RunHistoryEntry,
  RunState,
} from "@/engine/types";
import { createRng, randomSeed } from "@/lib/rng";
import { uid } from "@/lib/util";
import { useProfileStore } from "./profileStore";

interface RunStore {
  run: RunState | null;

  startRun: (difficulty: Difficulty, showOverallChoice: boolean) => void;
  clearRun: () => void;

  // Draft phase
  pickCard: (card: DraftOfferCard, slot: RosterSlotId) => void;
  reroll: () => void;
  freeReroll: () => void;

  // Review phase
  startTournament: () => void;

  // Tournament phase
  playRound: () => void;
  finishRun: () => void;
}

export const useRunStore = create<RunStore>()(
  persist(
    (set, get) => ({
      run: null,

      startRun: (difficulty, showOverallChoice) => {
        const seed = randomSeed();
        const rng = createRng(seed);
        const profile = DIFFICULTY[difficulty];
        const draft = drawNextOffer(createDraft(difficulty), rng);

        const run: RunState = {
          runId: uid("run"),
          seed,
          rngState: rng.state,
          difficulty,
          showOverall: profile.overallLockedHidden ? false : showOverallChoice,
          phase: "draft",
          startedAt: new Date().toISOString(),
          draft,
          tournament: null,
          results: null,
        };
        set({ run });
      },

      clearRun: () => set({ run: null }),

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
        const userTeam = buildUserTeam(run.draft.roster, run.difficulty);
        const tournament = initTournament(userTeam, run.difficulty, rng);
        set({
          run: { ...run, tournament, rngState: rng.state, phase: "tournament" },
        });
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
          guard < 10
        ) {
          tournament = playNextRound(tournament, run.difficulty, rng);
          guard += 1;
        }

        set({ run: { ...run, tournament, rngState: rng.state } });
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
          hiddenOverall: !run.showOverall,
          placement: results.placement,
          teamOverall: userTeam ? displayTeamOverall(userTeam.rating) : 0,
          swissRecord: userSwissRecord(run.tournament.swiss),
          rosterNames: playerNames,
          xpGained: results.xp.total,
        };

        profile.applyRunResults(results, entry);
        set({
          run: { ...run, results, rngState: rng.state, phase: "results" },
        });
      },
    }),
    {
      name: "rocket-draft:run:v1",
      version: 2,
      // v0.2 changed the run shape (double elim, slot-target picks):
      // discard any older persisted run instead of resuming a broken one.
      migrate: (persisted, version) =>
        version < 2 ? { run: null } : (persisted as { run: RunState | null }),
      partialize: (state) => ({ run: state.run }),
    },
  ),
);
