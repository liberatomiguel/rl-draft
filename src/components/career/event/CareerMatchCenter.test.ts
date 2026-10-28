/**
 * GAME-04 (R41) — the Match Center's side of the reveal contract, rendered to
 * static markup (node, no DOM): game chips read A–B, OVERTIME shows from the
 * OT beat on (never off game.overtime early), the board never shows a game's
 * final score before its last beat, and the chip row does not give away how
 * long a live series will run.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildGameTimeline } from "@/engine/career/matchTimeline";
import type { CareerSave } from "@/engine/career/types";
import type { GameResult, SeriesResult, TournamentState } from "@/engine/types";
import { CareerMatchCenter } from "./CareerMatchCenter";
import type { RoundRef } from "./eventPlayback";

const A = "user";
const B = "fill:test-opp";

const save = {
  identity: {
    orgName: "Test Org",
    abbrev: "TST",
    crestId: "shield",
    colors: { primary: "#ff7a1a", secondary: "#101820" },
  },
  world: { orgs: {} },
  careerSeed: 7,
  clock: { seasonIndex: 0 },
} as unknown as CareerSave;

const t = {
  teams: {
    [A]: { id: A, name: "Test Org", playerNames: ["Alpha", "Bravo", "Charlie"] },
    [B]: { id: B, name: "Rival Club", playerNames: ["Delta", "Echo", "Foxtrot"] },
  },
  playoffs: null,
} as unknown as TournamentState;

/** One game: `w`-`l` won by side `by`, scorers on the first roster slot. */
function game(index: number, by: "a" | "b", w: number, l: number, overtime = false): GameResult {
  const [goalsA, goalsB] = by === "a" ? [w, l] : [l, w];
  return {
    index,
    winnerTeamId: by === "a" ? A : B,
    score: [w, l],
    overtime,
    deciding: false,
    notes: overtime ? ["overtime"] : [],
    scorers: { a: [goalsA, 0, 0], b: [goalsB, 0, 0] },
  };
}

function seriesOf(games: GameResult[]): SeriesResult {
  const winsA = games.filter((g) => g.winnerTeamId === A).length;
  const winsB = games.length - winsA;
  return {
    teamAId: A,
    teamBId: B,
    games,
    score: [winsA, winsB],
    winnerTeamId: winsA > winsB ? A : B,
    ratingDiff: 0,
    upset: false,
  };
}

function roundOf(series: SeriesResult): RoundRef {
  return {
    order: 0,
    stage: "swiss", // best of 5
    stageIndex: 0,
    key: "sw:0",
    name: null,
    roundNo: 1,
    series: [series],
    userSeriesIndex: 0,
  };
}

function render(series: SeriesResult, progress: { game: number; beat: number } | null): string {
  return renderToStaticMarkup(
    createElement(CareerMatchCenter, { save, t, round: roundOf(series), series, progress, status: null }),
  );
}

/** The board's two game-score numbers (A, B) while a game is live. */
function boardScore(html: string): [number, number] {
  const nums = [...html.matchAll(/min-w-\[1ch\][^"]*">(\d+)<\/span>/g)].map((m) => Number(m[1]));
  expect(nums).toHaveLength(2);
  return [nums[0], nums[1]];
}

/** The not-yet-played chip slots, in order: "G4|<class list>". */
function placeholderChips(html: string): string[] {
  return [...html.matchAll(/<span class="([^"]*)" aria-hidden="true">G(\d)<\/span>/g)].map(
    (m) => `G${m[2]}|${m[1]}`,
  );
}

const count = (html: string, text: string) => html.split(text).length - 1;

describe("CareerMatchCenter (GAME-04 reveal contract)", () => {
  // Team B wins game 1 in overtime, 3-2; team A takes the series 3-1.
  const otFirst = seriesOf([
    game(1, "b", 3, 2, true),
    game(2, "a", 2, 0),
    game(3, "a", 1, 0),
    game(4, "a", 4, 1),
  ]);

  it("prints the game chips A–B, also when team B won the game", () => {
    const html = render(otFirst, { game: 1, beat: 0 });
    // game.score is winner-first ([3, 2]); the chip must read like the board.
    expect(html).toContain('title="Game 1 · 2–3 OVERTIME">2–3<span class="text-orange-bright">OT</span>');
    // Finished series: every chip, A–B.
    const done = render(otFirst, null);
    for (const chip of ["2–3", "2–0", "1–0", "4–1"]) expect(done).toContain(`>${chip}<`);
    expect(done).not.toContain(">3–2<");
  });

  it("shows OVERTIME from the OT beat on, never before it", () => {
    const tl = buildGameTimeline(otFirst, otFirst.games[0], "sw:0");
    const otAt = tl.beats.findIndex((b) => b.kind === "overtime");
    expect(otAt).toBe(4); // regulation ends 2-2, then the OT beat
    for (let beat = 0; beat <= tl.beats.length; beat++) {
      const html = render(otFirst, { game: 0, beat });
      // `beat` beats are shown: the OT beat is visible once beat > otAt.
      if (beat <= otAt) expect(count(html, "OVERTIME"), `beat ${beat}`).toBe(0);
      else expect(count(html, "OVERTIME"), `beat ${beat}`).toBeGreaterThan(0);
    }
  });

  it("never shows a game's final score on the board before its last beat", () => {
    const tl = buildGameTimeline(otFirst, otFirst.games[0], "sw:0");
    for (let beat = 0; beat < tl.beats.length; beat++) {
      expect(boardScore(render(otFirst, { game: 0, beat })), `beat ${beat}`).not.toEqual(tl.final);
    }
    expect(boardScore(render(otFirst, { game: 0, beat: tl.beats.length }))).toEqual([2, 3]);
  });

  it("does not give away the series length while it is live (TIM-C1)", () => {
    // Same first two games; one series ends 3-0, the other goes the distance.
    const sweep = seriesOf([game(1, "a", 2, 0), game(2, "a", 3, 1), game(3, "a", 1, 0)]);
    const decider = seriesOf([
      game(1, "a", 2, 0),
      game(2, "a", 3, 1),
      game(3, "b", 2, 1),
      game(4, "b", 1, 0, true),
      game(5, "a", 2, 1),
    ]);
    for (const at of [
      { game: 0, beat: 0 },
      { game: 0, beat: 1 },
      { game: 1, beat: 2 },
      { game: 2, beat: 0 },
    ]) {
      // The slots still to come must look exactly alike in both.
      const s = render(sweep, at);
      const d = render(decider, at);
      expect(placeholderChips(s), JSON.stringify(at)).toEqual(placeholderChips(d));
      expect(s, JSON.stringify(at)).not.toContain("opacity-40");
    }
    // Once the series is fully shown, the slots it never needed dim.
    const done = placeholderChips(render(sweep, null));
    expect(done.map((c) => c.split("|")[0])).toEqual(["G4", "G5"]);
    for (const chip of done) expect(chip).toContain("opacity-40");
    expect(placeholderChips(render(decider, null))).toEqual([]);
  });
});
