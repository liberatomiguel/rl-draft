/**
 * v2.2 Pro slice 7 (PRO-SPEC §8, R150): the gala and the scene nicknames.
 */

import { describe, expect, it } from "vitest";
import { CAREER_PRO_GALA as G, CAREER_PRO_NICKNAMES as N } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { awardKey, decodeCard, encodeCard, parseAwardKey, sanitizeCard } from "./card";
import { galaAwards, galaForSeason, honorsOf, type GalaCandidate } from "./gala";
import { activeNickname, earnedNicknames, NICKNAME_IDS, nicknameProgress } from "./nickname";

const cand = (id: string, over: Partial<GalaCandidate> = {}): GalaCandidate => ({
  id,
  name: id,
  region: "SAM",
  age: 24,
  overall: 80,
  overallStart: 80,
  seasonsPro: 5,
  teamResult: 0.5,
  ...over,
});

const pool = (): GalaCandidate[] => [
  cand("a", { overall: 90, teamResult: 0.9 }),
  cand("b", { overall: 88, teamResult: 0.7 }),
  cand("c", { overall: 85, teamResult: 0.6 }),
  cand("d", { overall: 82, teamResult: 0.3 }),
  cand("e", { overall: 79, teamResult: 0.2, age: 18, overallStart: 72, seasonsPro: 1 }),
  cand("f", { overall: 95, teamResult: 0.95, region: "EU" }),
  cand("g", { overall: 60, teamResult: 0.1 }),
];

const kindOf = (r: ReturnType<typeof galaAwards>, k: string) => r.find((a) => a.kind === k)!;

describe("Pro gala", () => {
  it("MVP and the team of the season rank on overall and the team result, within the scope", () => {
    const reg = galaAwards({ seasonIndex: 3, scope: "region", region: "SAM", candidates: pool() });
    expect(kindOf(reg, "mvp").winners).toEqual(["a"]);
    expect(kindOf(reg, "teamOfSeason").winners).toEqual(["a", "b", "c"]);
    expect(kindOf(reg, "mvp").nominees).toEqual(["b", "c", "d"]);
    const world = galaAwards({ seasonIndex: 3, scope: "world", candidates: pool() });
    expect(kindOf(world, "mvp").winners).toEqual(["f"]);
    // Below the floor nobody is an MVP candidate.
    expect(kindOf(reg, "mvp").nominees).not.toContain("g");
  });

  it("the breakout needs a young player with a real gain, and is empty without one", () => {
    const reg = galaAwards({ seasonIndex: 3, scope: "region", region: "SAM", candidates: pool() });
    expect(kindOf(reg, "breakout").winners).toEqual(["e"]);
    const noYoung = galaAwards({ seasonIndex: 3, scope: "world", candidates: pool().filter((c) => c.id !== "e") });
    expect(kindOf(noYoung, "breakout").winners).toEqual([]);
    const flat = galaAwards({ seasonIndex: 3, scope: "world", candidates: [cand("y", { age: 18, seasonsPro: 1, overallStart: 79, overall: 80 })] });
    expect(kindOf(flat, "breakout").winners).toEqual([]);
    const old = galaAwards({ seasonIndex: 3, scope: "world", candidates: [cand("z", { age: 27, overallStart: 70, overall: 80 })] });
    expect(kindOf(old, "breakout").winners).toEqual([]);
  });

  it("the most decisive needs a box-score line: with none, or too few games, nobody gets it", () => {
    const base = galaAwards({ seasonIndex: 3, scope: "world", candidates: pool() });
    expect(kindOf(base, "mostDecisive").winners).toEqual([]);
    const few = pool().map((c) => (c.id === "c" ? { ...c, line: { games: 4, avgRating: 9, mvps: 4, decidingMoments: 4 } } : c));
    expect(kindOf(galaAwards({ seasonIndex: 3, scope: "world", candidates: few }), "mostDecisive").winners).toEqual([]);
    const weak = pool().map((c) => (c.id === "c" ? { ...c, line: { games: 30, avgRating: 7, mvps: 1, decidingMoments: 1 } } : c));
    expect(kindOf(galaAwards({ seasonIndex: 3, scope: "world", candidates: weak }), "mostDecisive").winners).toEqual([]);
    const strong = pool().map((c) => (c.id === "c" ? { ...c, line: { games: 30, avgRating: 8, mvps: 6, decidingMoments: 6 } } : c));
    expect(kindOf(galaAwards({ seasonIndex: 3, scope: "world", candidates: strong }), "mostDecisive").winners).toEqual(["c"]);
  });

  it("the Pro can win or be a nominee, and honorsOf says which", () => {
    const withPro = [...pool(), cand("pro:self", { overall: 93, teamResult: 0.8, line: { games: 40, avgRating: 7.5, mvps: 8, decidingMoments: 9 } })];
    const awards = galaForSeason(3, "SAM", withPro);
    const honors = honorsOf(awards, "pro:self", 3);
    expect(honors.find((h) => h.kind === "mvp" && h.scope === "region")?.place).toBe("winner");
    expect(honors.find((h) => h.kind === "mostDecisive" && h.scope === "world")?.place).toBe("winner");
    expect(honors.find((h) => h.kind === "mvp" && h.scope === "world")?.place).toBe("nominee");
    expect(honorsOf(awards, "nobody", 3)).toEqual([]);
    // A weak season gets nothing.
    const weak = galaForSeason(3, "SAM", [...pool(), cand("pro:self", { overall: 65, teamResult: 0.1 })]);
    expect(honorsOf(weak, "pro:self", 3)).toEqual([]);
  });

  it("is deterministic and independent of the order of the candidates", () => {
    const a = galaForSeason(3, "SAM", pool());
    const b = galaForSeason(3, "SAM", [...pool()].reverse());
    expect(b).toEqual(a);
    const ties = [cand("x1"), cand("x2"), cand("x0")];
    expect(kindOf(galaAwards({ seasonIndex: 1, scope: "world", candidates: ties }), "mvp").winners).toEqual(["x0"]);
    expect(G.nominees).toBe(3);
  });

  it("an empty pool gives empty awards, never a throw", () => {
    for (const a of galaForSeason(0, "NA", [])) expect(a.winners).toEqual([]);
  });

  it("a win goes on the card as a language-free key and the card round-trips", () => {
    const key = awardKey({ kind: "mvp", scope: "world", seasonIndex: 3, place: "winner" }, 2026)!;
    expect(key).toBe("mvp.world.2026");
    expect(awardKey({ kind: "mvp", scope: "world", seasonIndex: 3, place: "nominee" }, 2026)).toBeNull();
    expect(parseAwardKey(key)).toEqual({ kind: "mvp", scope: "world", year: 2026 });
    expect(parseAwardKey("Worlds 2026")).toBeNull();
    const card = sanitizeCard({ name: "Pro", peak: 90, awards: [key], nickname: "theWall", style: "anchor", seasons: 3 });
    expect(decodeCard(encodeCard(card))?.awards).toEqual([key]);
    expect(decodeCard(encodeCard(card))?.nickname).toBe("theWall");
  });
});

describe("Pro nicknames", () => {
  it("about a dozen, each with an EN and a PT name and an explanation", () => {
    expect(N.length).toBeGreaterThanOrEqual(12);
    for (const id of NICKNAME_IDS) {
      expect(CAREER_EN.proCard.nicknames[id]).toBeTruthy();
      expect(CAREER_PT.proCard.nicknames[id]).toBeTruthy();
      expect(CAREER_EN.proCard.nicknameWhy[id](3)).toBeTruthy();
      expect(CAREER_PT.proCard.nicknameWhy[id](3)).toBeTruthy();
    }
    expect(new Set(NICKNAME_IDS).size).toBe(NICKNAME_IDS.length);
  });

  it("none reads as an insult", () => {
    const bad = /\b(loser|bad|trash|noob|fraud|choke|bottler|weak|slow|fat|stupid|idiot|lixo|fraco|ruim|burro|perdedor|amarelão)\b/i;
    for (const id of NICKNAME_IDS) {
      expect(CAREER_EN.proCard.nicknames[id]).not.toMatch(bad);
      expect(CAREER_PT.proCard.nicknames[id]).not.toMatch(bad);
    }
  });

  it("is earned only by its verifiable milestone, and none with an empty record", () => {
    expect(earnedNicknames({})).toEqual([]);
    expect(activeNickname({})).toBeNull();
    expect(earnedNicknames({ saves: 399 })).toEqual([]);
    expect(earnedNicknames({ saves: 400 })).toEqual(["theWall"]);
    expect(earnedNicknames({ lanTitles: 2, worldsTitles: 1 })).toEqual(["mrLan", "theChamp"]);
    expect(nicknameProgress("theWall", { saves: 120 })).toEqual({ have: 120, need: 400 });
    for (const n of N) expect(earnedNicknames({ [n.fact]: n.min })).toContain(n.id);
  });

  it("at most one is active: the best-ranked earned, and a worn one is kept until a better one is earned", () => {
    expect(activeNickname({ lanTitles: 2, saves: 500 })).toBe("theWall");
    expect(activeNickname({ lanTitles: 2, assists: 500 }, "theMaestro")).toBe("mrLan");
    expect(activeNickname({ assists: 500, goals: 900 }, "theFinisher")).toBe("theMaestro");
    expect(activeNickname({ assists: 500, goals: 900 }, "theMaestro")).toBe("theMaestro");
    expect(activeNickname({ assists: 500 }, "theWall")).toBe("theMaestro");
  });
});
