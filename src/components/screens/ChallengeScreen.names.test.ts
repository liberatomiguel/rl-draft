/**
 * rc.29 review R1 (the DRAFT-10 rule on the challenge screen): the player's
 * team is named from the copy dictionary (`TOURNAMENT_UI.yourTeam`) in the
 * matchup header and the series scoreline, never with the engine's English
 * default ("Your Team" under a PT kicker). Rendered to static markup (node, no
 * DOM) with the active dictionary swapped in, since `useCopy` answers EN until
 * the client has mounted.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { challenges } from "@/data";
import { buildChallengeOpponent, playChallengeSeries, rosterFromLineup } from "@/engine/challenges";
import { buildUserTeam } from "@/engine/teams";
import type { DraftState, RunState, TournamentTeam } from "@/engine/types";
import { createRng } from "@/lib/rng";
import { ChallengeScreen } from "./ChallengeScreen";

const dict = vi.hoisted(() => ({ lang: "en" as "en" | "pt" }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }));
vi.mock("@/content/copy", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/content/copy")>();
  const { EN: en } = await import("@/content/copy.en");
  const { PT: pt } = await import("@/content/copy.pt");
  return { ...mod, useCopy: () => (dict.lang === "pt" ? pt : en) };
});

/** A challenge run whose boss series has been played (the scoreline shows). */
function playedChallengeRun(rename?: string): RunState {
  const ch = challenges[0];
  // Any complete roster renders; the boss lineup's own is the simplest one.
  const roster = rosterFromLineup(ch.opponentLineupId);
  const built = buildUserTeam(roster, ch.sim.difficulty, { mode: "challenge" });
  const user: TournamentTeam = rename ? { ...built, name: rename } : built;
  const opponent = buildChallengeOpponent(ch);
  const series = playChallengeSeries(user, opponent, ch, createRng(1));
  return {
    runId: "challenge-test",
    mode: "challenge",
    challengeId: ch.id,
    seed: ch.seed,
    rngState: 1,
    difficulty: ch.sim.difficulty,
    showOverall: true,
    phase: "challenge",
    startedAt: "2026-10-28T00:00:00.000Z",
    draft: { roster } as DraftState,
    tournament: null,
    challenge: { user, opponent, series, cleared: series.winnerTeamId === user.id },
    results: null,
  };
}

function render(run: RunState, lang: "en" | "pt"): string {
  dict.lang = lang;
  return renderToStaticMarkup(createElement(ChallengeScreen, { run }));
}

/** How many times `needle` occurs in `hay`. */
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

describe("ChallengeScreen — the player's team name (review R1)", () => {
  it("the engine still names the team in English (what the screen must not print)", () => {
    expect(playedChallengeRun().challenge!.user.name).toBe("Your Team");
  });

  it("a PT run reads 'Seu Time' in the header and the scoreline, never 'Your Team'", () => {
    const html = render(playedChallengeRun(), "pt");
    expect(html).not.toContain("Your Team");
    // The header's name line and the scoreline, both from TOURNAMENT_UI.
    expect(count(html, PT.TOURNAMENT_UI.yourTeam)).toBeGreaterThanOrEqual(2);
  });

  it("names the team from the copy, not from the engine's team object", () => {
    const html = render(playedChallengeRun("ENGINE TEAM NAME"), "en");
    expect(html).not.toContain("ENGINE TEAM NAME");
    expect(count(html, EN.TOURNAMENT_UI.yourTeam)).toBeGreaterThanOrEqual(2);
  });
});
