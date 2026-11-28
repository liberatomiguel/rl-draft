/**
 * rc9 STORIES (R256): with the board flag on, a post moves the board's
 * confidence by CAREER_FEED.effects[tone][result].board and its log names the
 * post ("managerPost"); the sheet's figure is the applied move.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, fanFeed: true, board: true } };
});

import { CAREER_FEED } from "@/config/balance";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { TournamentState } from "@/engine/types";
import { createCareerSave, type CreateCareerInput } from "./careerFlow";
import { postEffectsOf, postToFeedFlow, recordFeedSeries } from "./fanFeedFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Board Post Org",
    abbrev: "BPO",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

const t = (won: boolean): TournamentState =>
  ({
    teams: { user: { id: "user", name: "Board Post Org", rating: { total: 80 } }, b: { id: "b", name: "Team b", rating: { total: 80 } } },
    swiss: { rounds: [{ round: 1, series: [{ teamAId: "user", teamBId: "b", games: [], score: won ? [3, 1] : [1, 3], winnerTeamId: won ? "user" : "b", ratingDiff: 0, upset: false }], userSeriesIndex: 0 }] },
    playoffs: won ? { rounds: [], championTeamId: "user" } : null,
  }) as unknown as TournamentState;

const DEF = { id: "e", name: "SAM Major", tier: "major", seasonIndex: 0, week: 6, day: 40 } as CareerEventDef;

describe("the board reads the post", () => {
  it("moves confidence by the tone's figure and logs it; the sheet shows the same number", () => {
    for (const won of [true, false]) {
      for (const tone of ["humble", "confident", "provocative"] as const) {
        const save: CareerSave = createCareerSave(INPUT, 5150);
        expect(save.board).toBeDefined();
        if (!save.board) return;
        save.board = { ...save.board, protectedUntil: null };
        recordFeedSeries(save, t(won), DEF);
        const fx = postEffectsOf(save, tone)!;
        const after = postToFeedFlow(save, tone);
        const want = CAREER_FEED.effects[tone][won ? "won" : "lost"].board;
        const moved = after.board!.confidence - save.board.confidence;
        expect(fx.board).toBe(moved);
        if (want !== 0 && save.board.confidence + want >= 0 && save.board.confidence + want <= 100) {
          expect(moved).toBe(want);
          expect(after.board!.log[0]).toMatchObject({ reason: "managerPost", delta: want });
        } else {
          expect(after.board!.log[0]?.reason).not.toBe("managerPost");
        }
      }
    }
  });
});
