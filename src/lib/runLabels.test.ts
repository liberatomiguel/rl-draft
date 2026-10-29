/**
 * rc.29 (E2E DRAFT-09 / DRAFT-10 / DRAFT-16): Draft-run labels come from the
 * active copy dictionary, not from the engine's English strings.
 */

import { describe, expect, it } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import type { DailyObjective, TournamentState, XpLine } from "@/engine/types";
import { planDaily } from "./dailyPlan";
import {
  USER_TEAM_ID,
  dailyDescription,
  dailyLabel,
  dailyObjectiveLabel,
  dailyRunTag,
  resultStageLabel,
  seriesStageLabel,
  signedDelta,
  stageRefLabel,
  teamDisplayName,
  xpLineLabel,
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

/** A year of days: every template, region and objective the wheel can roll (+ the authored day). */
const DAYS = [
  "2026-06-17",
  ...Array.from({ length: 366 }, (_, i) => new Date(Date.UTC(2026, 6, 1) + i * 86_400_000).toISOString().slice(0, 10)),
];
const plans = DAYS.map((d) => planDaily(d, () => true).info);

describe("Daily text in the active language (rc.30)", () => {
  it("every day names its template; EN copy reads exactly the plan's own English text", () => {
    const ids = new Set<string>();
    for (const info of plans) {
      expect(info.templateId, info.date).toBeDefined();
      ids.add(info.templateId!);
      expect(dailyLabel(info, EN.DAILY_TEXT)).toBe(info.label);
      expect(dailyDescription(info, EN.DAILY_TEXT)).toBe(info.description);
      if (info.objective) expect(dailyObjectiveLabel(info.objective, EN.DAILY_TEXT)).toBe(info.objective.label);
    }
    // The wheel really covers the copy table (every template rolls within a year).
    expect([...ids].sort()).toEqual(Object.keys(EN.DAILY_TEXT.templates).sort());
  });

  it("PT names the day in Portuguese; a run saved before rc.30 keeps its stored text", () => {
    const legacy = plans.find((p) => p.templateId === "legacyDay")!;
    expect(dailyRunTag(legacy, EN.DAILY_TEXT)).toBe("Daily · Legacy Day");
    expect(dailyRunTag(legacy, PT.DAILY_TEXT)).toBe("Diário · Dia Legacy");
    const lockdown = plans.find((p) => p.templateId === "regionalLockdown")!;
    expect(dailyLabel(lockdown, PT.DAILY_TEXT)).toBe(`Bloqueio Regional: ${lockdown.region}`);
    const saved = { ...legacy, templateId: undefined, region: undefined };
    expect(dailyLabel(saved, PT.DAILY_TEXT)).toBe("Legacy Day");
    expect(dailyDescription(saved, PT.DAILY_TEXT)).toBe(legacy.description);
    const objective: DailyObjective = { type: "concede_under", value: 25, label: "Concede fewer than 25 goals", bonusXp: 50 };
    expect(dailyObjectiveLabel(objective, PT.DAILY_TEXT)).toBe("Sofra menos de 25 gols");
  });
});

describe("xpLineLabel (rc.30)", () => {
  const lines: XpLine[] = [
    { label: "Run completed", amount: 50, key: "completeRun" },
    { label: "Swiss wins ×3", amount: 60, key: "swissWins", n: 3 },
    { label: "Qualified for playoffs", amount: 40, key: "qualified" },
    { label: "Playoff series wins ×2", amount: 80, key: "playoffWins", n: 2 },
    { label: "Grand finalist", amount: 60, key: "placement", placement: "runner_up" },
    {
      label: "Objective: Win the whole thing",
      amount: 75,
      key: "objective",
      objective: { type: "win_title", label: "Win the whole thing", bonusXp: 75 },
    },
    { label: "Achievements", amount: 30, key: "achievements" },
    { label: "New special cards", amount: 20, key: "specials" },
  ];

  it("EN reads the engine's own labels; PT translates every line", () => {
    for (const line of lines) {
      expect(xpLineLabel(line, EN.RESULTS_UI, EN.DAILY_TEXT)).toBe(line.label);
      expect(xpLineLabel(line, PT.RESULTS_UI, PT.DAILY_TEXT)).not.toBe(line.label);
    }
    expect(xpLineLabel(lines[1], PT.RESULTS_UI, PT.DAILY_TEXT)).toBe("Vitórias no Swiss ×3");
    expect(xpLineLabel(lines[5], PT.RESULTS_UI, PT.DAILY_TEXT)).toBe("Objetivo: Vença o torneio inteiro");
  });

  it("a result saved before rc.30 (no key) shows its stored label", () => {
    expect(xpLineLabel({ label: "Run completed", amount: 50 }, PT.RESULTS_UI, PT.DAILY_TEXT)).toBe("Run completed");
  });
});
