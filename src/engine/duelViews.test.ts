import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { makeDuelChallenge, makeDuelReply } from "./duelLink";
import { playDuel } from "./duelMatch";
import { DUEL_GRANTS, makeDuelRules } from "./duelRules";
import { botDraft } from "./duelTestKit";
import {
  duelErrorText,
  duelGameRows,
  duelGameTimeline,
  duelRulesLine,
  duelRulesTags,
  duelScoreline,
  duelSideLabel,
  duelWinner,
  duelWinnerLine,
  formatDuelClock,
} from "./duelViews";

const rules = makeDuelRules({ mode: "classic", rerolls: 7, showOverall: true, region: null }, 77);
const a = botDraft(rules, { pickSeed: 1 }).team;
const b = botDraft(makeDuelRules({}, 5), { pickSeed: 2 }).team;
const reply = makeDuelReply(makeDuelChallenge(rules, { name: "Ana", team: a }), { name: "", team: b });
const series = playDuel(rules, a, b);

describe("duel views", () => {
  it("says what the challenger chose, in both languages", () => {
    expect(duelRulesTags(rules, EN.DUEL_MATCH_UI, "Worldwide")).toEqual(["Classic draft", "Worldwide", "7 rerolls", "Overalls visible"]);
    const quick = { ...rules, mode: "quick" as const, rerolls: 0, showOverall: false };
    expect(duelRulesLine(quick, EN.DUEL_MATCH_UI, "EU")).toBe("Quick draft · EU · No rerolls · Overalls hidden");
    expect(duelRulesLine({ ...quick, rerolls: 1 }, PT.DUEL_MATCH_UI, "UE")).toBe("Draft rápido · UE · 1 reroll · Overalls escondidos");
  });

  it("gives the scoreline, the winner and the game rows in play order", () => {
    const line = duelScoreline(series);
    expect(line.text).toBe(`${series.score[0]}-${series.score[1]}`);
    expect(line.winnerKey).toBe(duelWinner(series));
    expect(line.games).toBe(series.games.length);
    expect(Math.max(line.a, line.b)).toBe(4);
    const rows = duelGameRows(series, EN.DUEL_MATCH_UI);
    expect(rows.map((r) => r.index)).toEqual(series.games.map((_, i) => i + 1));
    expect(rows.at(-1)!.afterText).toBe(line.text);
    expect(duelWinnerLine(reply, series, EN.DUEL_MATCH_UI)).toMatch(/takes the series$/);
    expect(duelSideLabel(reply, "opponent", EN.DUEL_MATCH_UI)).toBe("Opponent");
    expect(duelSideLabel(reply, "challenger", EN.DUEL_MATCH_UI)).toBe("Ana");
  });

  it("lists a game's timeline in play order with clock, scorer and running score", () => {
    for (const g of series.games) {
      const rows = duelGameTimeline(series, g.index, EN.DUEL_MATCH_UI);
      expect(rows.length).toBe(g.timeline.beats.length);
      let lastElapsed = -1;
      let prevScore = 0;
      for (const r of rows) {
        const total = r.score[0] + r.score[1];
        if (r.kind === "goal") {
          expect(total).toBe(prevScore + 1);
          expect(r.clock).toMatch(/^\+?\d:\d\d$/);
          if (r.period === "regulation") {
            const elapsed = 300 - r.seconds!;
            expect(elapsed).toBeGreaterThan(lastElapsed);
            lastElapsed = elapsed;
          }
          expect(r.player).toBeTruthy();
        } else {
          expect(r.score[0]).toBe(r.score[1]);
        }
        prevScore = total;
      }
      expect(rows.at(-1)!.score).toEqual(g.final);
      expect(rows.some((r) => r.golden)).toBe(g.overtime);
    }
    expect(duelGameTimeline(series, 99, EN.DUEL_MATCH_UI)).toEqual([]);
  });

  it("formats the clock: regulation counts down, overtime counts up", () => {
    expect(formatDuelClock("regulation", 295)).toBe("4:55");
    expect(formatDuelClock("regulation", 9)).toBe("0:09");
    expect(formatDuelClock("overtime", 41)).toBe("+0:41");
  });

  it("has an error text for every link problem", () => {
    for (const reason of ["missing", "malformed", "tampered", "unsupported", "unknownCards", "region"] as const) {
      expect(duelErrorText(reason, EN.DUEL_MATCH_UI).length).toBeGreaterThan(5);
      expect(duelErrorText(reason, PT.DUEL_MATCH_UI).length).toBeGreaterThan(5);
    }
  });

  it("keeps EN and PT keyed alike", () => {
    const shape = (o: unknown): unknown =>
      typeof o === "function" ? "fn" : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : typeof o;
    expect(shape(PT.DUEL_MATCH_UI)).toEqual(shape(EN.DUEL_MATCH_UI));
  });
});

describe("a duel is an exhibition", () => {
  it("grants nothing, and no duel module can: none reaches the profile, progression, missions or achievements", () => {
    expect(DUEL_GRANTS).toEqual({ xp: 0, seasonRating: 0, cards: false, missions: false, achievements: false });
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => /^duel(Rules|Draft|Match|Link|Views)\.ts$/.test(f));
    expect(files).toHaveLength(5);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const i of imports) {
        expect(i, `${f} imports ${i}`).not.toMatch(/store|profile|progression|missions|achievements|collection|season$|results/);
      }
    }
  });
});
