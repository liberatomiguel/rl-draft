/**
 * rc.29 (E2E DRAFT-09 / DRAFT-10 / DRAFT-16): Draft-run labels come from the
 * active copy dictionary, not from the engine's English strings.
 */

import { describe, expect, it } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import type { TournamentState } from "@/engine/types";
import {
  USER_TEAM_ID,
  resultStageLabel,
  seriesStageLabel,
  signedDelta,
  stageRefLabel,
  teamDisplayName,
  xpMultiplierRows,
} from "./runLabels";

describe("teamDisplayName", () => {
  it("names the player's team in the active language, never the engine's English default", () => {
    const user = { id: USER_TEAM_ID, name: "Your Team" };
    expect(teamDisplayName(user, EN.TOURNAMENT_UI)).toBe("Your Team");
    expect(teamDisplayName(user, PT.TOURNAMENT_UI)).toBe("Seu Time");
  });

  it("keeps every other team's own name", () => {
    const ai = { id: "lineup-123", name: "Team BDS '22-23" };
    expect(teamDisplayName(ai, EN.TOURNAMENT_UI)).toBe("Team BDS '22-23");
    expect(teamDisplayName(ai, PT.TOURNAMENT_UI)).toBe("Team BDS '22-23");
  });
});

describe("results stage labels", () => {
  it("maps a Swiss round through the tournament copy", () => {
    expect(stageRefLabel({ kind: "swiss", round: 4 }, EN.TOURNAMENT_UI)).toBe("Swiss Round 4");
    expect(stageRefLabel({ kind: "swiss", round: 4 }, PT.TOURNAMENT_UI)).toBe("Swiss · Rodada 4");
  });

  it("maps a playoff round through TOURNAMENT_UI.roundNames", () => {
    expect(stageRefLabel({ kind: "playoffs", round: "grand_final" }, EN.TOURNAMENT_UI)).toBe("Grand Final");
    expect(stageRefLabel({ kind: "playoffs", round: "grand_final" }, PT.TOURNAMENT_UI)).toBe("Grande Final");
    expect(stageRefLabel({ kind: "playoffs", round: "lb_round1" }, PT.TOURNAMENT_UI)).toBe(PT.TOURNAMENT_UI.roundNames.lb_round1);
  });

  it("every playoff round the engine names has an EN and a PT label", () => {
    for (const round of Object.keys(EN.TOURNAMENT_UI.roundNames)) {
      expect(PT.TOURNAMENT_UI.roundNames[round], round).toBeTruthy();
      expect(stageRefLabel({ kind: "playoffs", round }, PT.TOURNAMENT_UI)).not.toBe(round);
    }
  });

  it("a result saved before rc.29 (no stageRef) keeps its English label", () => {
    expect(resultStageLabel({ stage: "Swiss Round 2" }, PT.TOURNAMENT_UI)).toBe("Swiss Round 2");
    expect(resultStageLabel({ stage: "Swiss Round 2", stageRef: { kind: "swiss", round: 2 } }, PT.TOURNAMENT_UI)).toBe(
      "Swiss · Rodada 2",
    );
  });
});

describe("seriesStageLabel (Match Center kicker)", () => {
  const t = {
    swiss: { rounds: [{ round: 1 }, { round: 2 }] },
    playoffs: { rounds: [{ name: "ub_quarterfinal" }, { name: "grand_final" }] },
  } as unknown as TournamentState;

  it("is built from the CURRENT dictionary, so a language switch relabels it", () => {
    const entry = { stage: "swiss" as const, roundIndex: 1 };
    expect(seriesStageLabel(t, entry, EN.TOURNAMENT_UI)).toBe("Swiss Stage · Round 2");
    expect(seriesStageLabel(t, entry, PT.TOURNAMENT_UI)).toBe("Fase Swiss · Rodada 2");
  });

  it("names playoff rounds", () => {
    expect(seriesStageLabel(t, { stage: "playoffs", roundIndex: 1 }, EN.TOURNAMENT_UI)).toBe("Grand Final");
    expect(seriesStageLabel(t, { stage: "playoffs", roundIndex: 0 }, PT.TOURNAMENT_UI)).toBe("Quartas (Sup)");
  });
});

describe("signedDelta (Season Rating line)", () => {
  it("prints one signed number, ±0 when nothing moved", () => {
    expect(signedDelta(12)).toBe("+12");
    expect(signedDelta(-8)).toBe("-8");
    expect(signedDelta(0)).toBe("±0");
  });
});

describe("xpMultiplierRows", () => {
  it("labels the Quick Draft ×0.5 as a mode multiplier, not a difficulty one", () => {
    const rows = xpMultiplierRows({ difficultyMultiplier: 0.5, factors: { difficulty: 1, mode: 0.5 } }, "quick", EN.RESULTS_UI);
    expect(rows).toEqual([{ label: "Quick Draft multiplier", value: 0.5 }]);
    expect(xpMultiplierRows({ difficultyMultiplier: 0.5, factors: { difficulty: 1, mode: 0.5 } }, "quick", PT.RESULTS_UI)).toEqual([
      { label: "Multiplicador do Draft Rápido", value: 0.5 },
    ]);
  });

  it("shows difficulty and mode apart when both apply", () => {
    const rows = xpMultiplierRows({ difficultyMultiplier: 3, factors: { difficulty: 2, mode: 1.5 } }, "daily", EN.RESULTS_UI);
    expect(rows).toEqual([
      { label: "Difficulty multiplier", value: 2 },
      { label: "Daily Challenge multiplier", value: 1.5 },
    ]);
  });

  it("leaves factors of 1 out (a Classic Normal run has no multiplier row)", () => {
    expect(xpMultiplierRows({ difficultyMultiplier: 1, factors: { difficulty: 1, mode: 1 } }, "classic", EN.RESULTS_UI)).toEqual([]);
    expect(xpMultiplierRows({ difficultyMultiplier: 1.5, factors: { difficulty: 1.5, mode: 1 } }, "classic", EN.RESULTS_UI)).toEqual([
      { label: "Difficulty multiplier", value: 1.5 },
    ]);
  });

  it("a result saved before the split shows one neutral row", () => {
    expect(xpMultiplierRows({ difficultyMultiplier: 0.5 }, "quick", EN.RESULTS_UI)).toEqual([{ label: "XP multiplier", value: 0.5 }]);
    expect(xpMultiplierRows({ difficultyMultiplier: 1 }, "classic", EN.RESULTS_UI)).toEqual([]);
  });
});
