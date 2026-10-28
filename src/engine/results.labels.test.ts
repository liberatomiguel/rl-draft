/**
 * rc.29 (E2E DRAFT-09 / DRAFT-10): the results carry their stages as data
 * (`stageRef`, named in the active language by the screens) and the XP
 * multiplier's two factors (difficulty × game mode) for the breakdown.
 * Real dataset, fixed seeds — no hardcoded ids.
 */

import { describe, expect, it } from "vitest";
import { DIFFICULTY, XP } from "@/config/balance";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { resultStageLabel } from "@/lib/runLabels";
import { createRng } from "@/lib/rng";
import { applyFreeReroll, applyPick, createDraft, drawNextOffer, openPlayerSlot } from "./draft";
import { compileResults } from "./results";
import { buildUserTeam } from "./teams";
import { fastForward, initTournament } from "./tournament";
import type { DraftState, Difficulty, RosterSlotId, RunMode, RunState, SeriesHighlight, StageRef } from "./types";

function autoDraft(seed: number, mode: RunMode) {
  const rng = createRng(seed);
  let draft: DraftState = drawNextOffer(createDraft("normal", mode === "quick" ? { mode: "quick" } : undefined), rng);
  let guard = 0;
  while (!draft.complete && guard < 200) {
    const card = draft.offer!.cards.find((c) => c.availability === "available");
    if (card) {
      const slot: RosterSlotId | null =
        card.kind === "player" ? openPlayerSlot(draft.roster) : card.kind === "coach" ? "coach" : card.kind === "sub" ? "sub" : "org";
      draft = applyPick(draft, card, slot!, rng);
    } else {
      draft = applyFreeReroll(draft, rng);
    }
    guard += 1;
  }
  expect(draft.complete).toBe(true);
  return { draft, rng };
}

function playRun(seed: number, mode: RunMode, difficulty: Difficulty) {
  const { draft, rng } = autoDraft(seed, mode);
  const run: RunState = {
    runId: `labels-${seed}`,
    mode,
    seed,
    rngState: rng.state,
    difficulty,
    showOverall: true,
    phase: "tournament",
    startedAt: new Date().toISOString(),
    draft,
    tournament: null,
    challenge: null,
    results: null,
  };
  const opts = mode === "quick" ? { mode: "quick" as const } : undefined;
  const user = buildUserTeam(draft.roster, difficulty, opts);
  const tournament = fastForward(initTournament(user, difficulty, rng, opts), difficulty, rng);
  return { run, tournament, results: compileResults(run, tournament, { unlockedSpecialIds: [], achievementIds: [] }, rng) };
}

/** The English label the engine writes for a stage — the ref must say the same. */
function englishOf(ref: StageRef): string {
  return ref.kind === "swiss" ? `Swiss Round ${ref.round}` : ref.round;
}

describe("results stages as data", () => {
  it("every highlight and the eliminator carry a stageRef matching their English label", () => {
    let seen = 0;
    for (const seed of [42, 777, 31337, 2024, 9]) {
      const { results } = playRun(seed, "classic", "normal");
      const items: (Pick<SeriesHighlight, "stage" | "stageRef"> | null | undefined)[] = [
        results.biggestWin,
        results.closestSeries,
        results.worstLoss,
        results.eliminatedBy,
      ];
      for (const h of items) {
        if (!h) continue;
        seen += 1;
        expect(h.stageRef, h.stage).toBeDefined();
        const ref = h.stageRef!;
        if (ref.kind === "swiss") expect(h.stage).toBe(englishOf(ref));
        else expect(Object.keys(EN.TOURNAMENT_UI.roundNames)).toContain(ref.round);
        // The PT screen never shows the engine's English stage.
        if (ref.kind === "swiss") expect(resultStageLabel(h, PT.TOURNAMENT_UI)).not.toBe(h.stage);
        expect(resultStageLabel(h, PT.TOURNAMENT_UI)).toBe(
          ref.kind === "swiss" ? PT.TOURNAMENT_UI.swissRound(ref.round) : PT.TOURNAMENT_UI.roundNames[ref.round],
        );
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("XP multiplier factors", () => {
  it("splits the run multiplier into difficulty × game mode", () => {
    const cases: [RunMode, Difficulty][] = [
      ["classic", "normal"],
      ["classic", "hard"],
      ["quick", "normal"],
      ["quick", "hard"],
      ["daily", "legacy"],
    ];
    for (const [mode, difficulty] of cases) {
      const { results } = playRun(31337, mode, difficulty);
      const f = results.xp.factors!;
      expect(f, `${mode}/${difficulty}`).toBeDefined();
      expect(f.difficulty).toBe(DIFFICULTY[difficulty].xpMultiplier);
      expect(f.mode).toBe(XP.modeMultiplier[mode] ?? 1);
      expect(results.xp.difficultyMultiplier).toBeCloseTo(f.difficulty * f.mode, 10);
    }
  });

  it("a Quick Draft's factor is the mode's, not the difficulty's", () => {
    const { results } = playRun(555, "quick", "normal");
    expect(results.xp.factors).toEqual({ difficulty: 1, mode: XP.modeMultiplier.quick });
  });
});
