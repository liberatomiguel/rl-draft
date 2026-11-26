/**
 * v2.2 Pro slice 6 (PRO-SPEC §4.1, §7.6, §9, R150): the decline, the end and
 * the final card.
 */

import { describe, expect, it } from "vitest";
import { CAREER_PRO, CAREER_PRO_AGING as A } from "@/config/balance";
import cardsJson from "@/data/playerCards.json";
import playersJson from "@/data/players.json";
import { applyAging, declineYears, phaseOf, seasonDecline } from "./aging";
import { allTimeRanking, cardFromSave, decodeCard, encodeCard, legendNeighbours, sanitizeCard, type ProCard } from "./card";
import { createProPlayer, createProSave } from "./create";
import { proAgeOf, proOverall } from "./growth";
import { canRetireByChoice, checkRetirement, retireChanceAt, retireProSave } from "./retire";
import { rolloverProPlayer } from "./weekFlow";
import type { CreateProInput, ProPlayer } from "./types";

const INPUT: CreateProInput = { name: "Veteran", country: "br", region: "SAM", startAge: 13, archetype: "allround", difficulty: "normal" };

const withAll = (v: number) => ({ offense: v, defense: v, mechanics: v, consistency: v, experience: v, clutch: v });
const prime = (over: Partial<ProPlayer> = {}): ProPlayer => ({
  ...createProPlayer(INPUT, 5),
  attrs: withAll(90),
  peakAge: 22,
  declineRate: "normal",
  ...over,
});
/** The season index at which the player is `age` years old. */
const seasonAt = (p: ProPlayer, age: number) => age - proAgeOf(p, 0);

describe("Pro aging", () => {
  it("does nothing while he is rising or on the plateau year", () => {
    const p = prime();
    for (const age of [14, 18, 22, 23]) {
      const r = applyAging(p, { seasonIndex: seasonAt(p, age), careerSeed: 1 });
      expect(r.growth).toHaveLength(0);
      expect(r.player.attrs).toEqual(p.attrs);
    }
    expect(phaseOf(p, seasonAt(p, 20))).toBe("rising");
    expect(phaseOf(p, seasonAt(p, 23))).toBe("peak");
    expect(phaseOf(p, seasonAt(p, 24))).toBe("declining");
    expect(declineYears(p, seasonAt(p, 24))).toBe(1);
  });

  it("a season of decline costs 0.5 to 1.5 overall, for every rate, age and seed: never a big single drop", () => {
    for (const declineRate of ["slow", "normal", "fast"] as const) {
      for (let age = 24; age <= 34; age++) {
        for (let seed = 1; seed <= 20; seed++) {
          const p = prime({ declineRate });
          const before = proOverall(p.attrs);
          const r = applyAging(p, { seasonIndex: seasonAt(p, age), careerSeed: seed });
          const loss = before - proOverall(r.player.attrs);
          expect(loss).toBeGreaterThanOrEqual(A.min - 0.1);
          expect(loss).toBeLessThanOrEqual(A.max + 0.1);
          for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) {
            expect(p.attrs[k] - r.player.attrs[k]).toBeLessThanOrEqual(A.maxPerStat);
            expect(r.player.attrs[k]).toBeLessThanOrEqual(p.attrs[k]);
          }
        }
      }
    }
  });

  it("every change is in the log with a reason key and the source 'age'", () => {
    const p = prime();
    const r = applyAging(p, { seasonIndex: seasonAt(p, 26), careerSeed: 3 });
    expect(r.growth.length).toBeGreaterThan(0);
    for (const e of r.growth) {
      expect(e.source).toBe("age");
      expect(e.delta).toBeLessThan(0);
      expect(Object.values(A.reasons)).toContain(e.reason);
    }
  });

  it("experience and clutch hold longer: they start later and lose least", () => {
    const p = prime();
    const first = applyAging(p, { seasonIndex: seasonAt(p, 24), careerSeed: 2 });
    expect(first.player.attrs.experience).toBe(p.attrs.experience);
    expect(first.player.attrs.clutch).toBe(p.attrs.clutch);
    expect(first.player.attrs.mechanics).toBeLessThan(p.attrs.mechanics);
    let q = p;
    for (let age = 24; age <= 30; age++) q = applyAging(q, { seasonIndex: seasonAt(p, age), careerSeed: age }).player;
    const lost = (k: keyof typeof p.attrs) => p.attrs[k] - q.attrs[k];
    expect(lost("experience")).toBeLessThan(lost("mechanics"));
    expect(lost("clutch")).toBeLessThan(lost("mechanics"));
    expect(lost("experience")).toBeLessThan(lost("defense"));
  });

  it("the loss grows with the years and with a faster decline rate", () => {
    const mean = (rate: ProPlayer["declineRate"], age: number) => {
      let t = 0;
      for (let s = 1; s <= 50; s++) t += seasonDecline(prime({ declineRate: rate }), seasonAt(prime(), age), s);
      return t / 50;
    };
    expect(mean("normal", 29)).toBeGreaterThan(mean("normal", 24));
    expect(mean("fast", 26)).toBeGreaterThan(mean("slow", 26));
  });

  it("a ten-year decline is gradual, ends well above the floor and is deterministic", () => {
    let p = prime({ declineRate: "fast" });
    const start = proOverall(p.attrs);
    let worst = 0;
    for (let age = 24; age <= 33; age++) {
      const before = proOverall(p.attrs);
      p = applyAging(p, { seasonIndex: seasonAt(p, age), careerSeed: age }).player;
      worst = Math.max(worst, before - proOverall(p.attrs));
    }
    expect(worst).toBeLessThanOrEqual(A.max + 0.1);
    expect(proOverall(p.attrs)).toBeGreaterThan(start - 16);
    expect(proOverall(p.attrs)).toBeGreaterThan(CAREER_PRO.attrMin);
    expect(applyAging(prime(), { seasonIndex: 12, careerSeed: 4 })).toEqual(applyAging(prime(), { seasonIndex: 12, careerSeed: 4 }));
  });

  it("tracks the peak overall and never lowers it", () => {
    const p = prime();
    const r = applyAging(p, { seasonIndex: seasonAt(p, 26), careerSeed: 3 });
    expect(r.player.peakOverall).toBe(proOverall(p.attrs));
    const again = applyAging(r.player, { seasonIndex: seasonAt(p, 27), careerSeed: 4 });
    expect(again.player.peakOverall).toBe(proOverall(p.attrs));
  });
});

describe("Pro retirement", () => {
  it("retires by age with a chance that rises and is certain at the forced age", () => {
    expect(retireChanceAt(25)).toBe(0);
    expect(retireChanceAt(28)).toBeGreaterThan(0);
    for (let a = 29; a <= 31; a++) expect(retireChanceAt(a)).toBeGreaterThan(retireChanceAt(a - 1));
    expect(retireChanceAt(A.retireForcedAge)).toBe(1);
    const p = prime();
    for (let seed = 1; seed <= 30; seed++) {
      expect(checkRetirement(p, { seasonIndex: seasonAt(p, 24), careerSeed: seed }).retire).toBeNull();
      expect(checkRetirement(p, { seasonIndex: seasonAt(p, A.retireForcedAge), careerSeed: seed }).retire).toBe("age");
    }
    let n = 0;
    for (let seed = 1; seed <= 400; seed++) if (checkRetirement(p, { seasonIndex: seasonAt(p, 30), careerSeed: seed }).retire) n++;
    expect(n / 400).toBeGreaterThan(0.25);
    expect(n / 400).toBeLessThan(0.45);
  });

  it("a year without a contract offers the end and never forces it", () => {
    const p = prime({ seasonsWithoutContract: 1 });
    const c = checkRetirement(p, { seasonIndex: seasonAt(p, 22), careerSeed: 1 });
    expect(c.retire).toBeNull();
    expect(c.offer).toBe("noContract");
    expect(checkRetirement(prime({ seasonsWithoutContract: 0 }), { seasonIndex: seasonAt(p, 22), careerSeed: 1 }).offer).toBeNull();
    expect(checkRetirement(prime({ seasonsWithoutContract: 3 }), { seasonIndex: seasonAt(p, 15), careerSeed: 1 }).offer).toBeNull();
  });

  it("by choice from an age where it is no misclick; the end is the legend bridge and keeps everything", () => {
    expect(canRetireByChoice(prime(), seasonAt(prime(), 17))).toBe(false);
    expect(canRetireByChoice(prime(), seasonAt(prime(), 18))).toBe(true);
    const save = createProSave(INPUT, 9, "test");
    const done = retireProSave(save, "choice");
    expect(done.stage).toBe("retired");
    expect(done.team).toBeNull();
    expect(done.bridge).toEqual({ to: "legend", atSeason: save.clock.seasonIndex });
    expect(done.flags["retired:choice"]).toBe(true);
    expect(done.player).toEqual(save.player);
    expect(done.growthLog).toEqual(save.growthLog);
    expect(done.world).toBe(save.world);
    expect(save.stage).toBe("ranked");
    expect(retireProSave(done, "age")).toBe(done);
  });

  it("the rollover runs the decline, counts the seasons without a team and retires at the forced age", () => {
    const base = createProSave(INPUT, 9, "test");
    const p = { ...base.player, attrs: withAll(90), peakAge: 22 };
    const at = (age: number, over: Partial<typeof base> = {}) => ({ ...base, player: p, clock: { seasonIndex: seasonAt(p, age), day: 1 }, ...over });
    const young = rolloverProPlayer(at(18));
    expect(young.save.growthLog).toHaveLength(0);
    expect(young.save.stage).toBe("ranked");
    const old = rolloverProPlayer(at(26));
    expect(old.save.growthLog.some((e) => e.source === "age")).toBe(true);
    expect(old.save.world.proSelf?.overall).toBeCloseTo(proOverall(old.save.player.attrs), 1);
    const free = rolloverProPlayer(at(22, { stage: "freeAgent" }));
    expect(free.save.player.seasonsWithoutContract).toBe(1);
    expect(free.check.offer).toBe("noContract");
    const end = rolloverProPlayer(at(A.retireForcedAge));
    expect(end.save.stage).toBe("retired");
    expect(end.save.bridge?.to).toBe("legend");
  });
});

const CARD: ProCard = {
  v: 1,
  name: "Veteran",
  country: "BR",
  style: "playmaker",
  peak: 96.4,
  seasons: 11,
  orgs: ["Team One", "Team Two", "Team Three"],
  titles: ["Worlds 2027", "Major 2026", "Regional 2026", "Regional 2027"],
  awards: ["MVP 2026", "Rookie 2024", "Season team 2026"],
  bestRating: 8.6,
  nickname: "The Wall",
};

describe("Pro card: payload", () => {
  it("round-trips, is URL-safe, and stays small for a long career", () => {
    const enc = encodeCard(CARD);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCard(enc)).toEqual(CARD);
    expect(decodeCard(`#${enc}`)).toEqual(CARD);
    expect(enc.length).toBeLessThan(400);
  });

  it("round-trips accents, other scripts and an empty card", () => {
    const odd = sanitizeCard({ ...CARD, name: "João Ñandú", nickname: "O Muro ⚽", orgs: ["Équipe ÅÄÖ", "日本チーム"] });
    expect(decodeCard(encodeCard(odd))).toEqual(odd);
    const bare = sanitizeCard({ name: "A1", country: "", style: "allround", peak: 80 });
    expect(decodeCard(encodeCard(bare))).toEqual(bare);
  });

  it("is capped: the largest card a player can make is still a small payload", () => {
    const long = "x".repeat(200);
    const big = sanitizeCard({ ...CARD, name: long, orgs: Array(50).fill(long), titles: Array(50).fill(long), awards: Array(50).fill(long), nickname: long });
    expect(big.orgs.length).toBe(A.card.maxList);
    expect(big.name.length).toBeLessThanOrEqual(CAREER_PRO.nameMax);
    expect(encodeCard(big).length).toBeLessThan(2500);
    expect(decodeCard(encodeCard(big))).toEqual(big);
  });

  it("tolerates a tampered, truncated or foreign payload without throwing", () => {
    const enc = encodeCard(CARD);
    const bad: string[] = [
      "",
      "#",
      "not base64 at all!",
      "@@@@",
      enc.slice(0, 10),
      enc.slice(0, enc.length - 5),
      enc + enc,
      "a".repeat(5000),
      btoa("[]").replace(/=/g, ""),
      btoa('{"v":1}').replace(/=/g, ""),
      btoa('[2,"x"]').replace(/=/g, ""),
      btoa('[1,5,5,5,5,5,5,5,5,5,5]').replace(/=/g, ""),
      btoa('[1,"A",{"a":1},99,"x","y",1,2,3,"z",{}]').replace(/=/g, ""),
      btoa("null").replace(/=/g, ""),
    ];
    for (const b of bad) {
      expect(() => decodeCard(b)).not.toThrow();
    }
    expect(decodeCard("")).toBeNull();
    expect(decodeCard("not base64 at all!")).toBeNull();
    expect(decodeCard(btoa("[2,\"x\"]").replace(/=/g, ""))).toBeNull();
    // Flip every character in turn: it may decode to something or to null, never throw, and a result is always sane.
    for (let i = 0; i < enc.length; i++) {
      const flipped = enc.slice(0, i) + (enc[i] === "A" ? "B" : "A") + enc.slice(i + 1);
      const c = decodeCard(flipped);
      if (c) {
        expect(c.peak).toBeGreaterThanOrEqual(CAREER_PRO.attrMin);
        expect(c.peak).toBeLessThanOrEqual(CAREER_PRO.attrMax);
        expect(c.bestRating).toBeLessThanOrEqual(10);
        expect(c.orgs.length).toBeLessThanOrEqual(A.card.maxList);
      }
    }
  });

  it("strips markup and control characters from text", () => {
    const c = decodeCard(encodeCard({ ...CARD, name: "<b>Hi</b>", nickname: "A\u0000B\nC" }));
    expect(c?.name).not.toMatch(/[<>]/);
    expect(c?.nickname).not.toMatch(/[\u0000-\u001f]/);
  });

  it("is built from a save: the peak, the seasons and what the world hands over", () => {
    const save = createProSave(INPUT, 7, "test");
    const aged = { ...save, clock: { seasonIndex: 9, day: 40 }, player: { ...save.player, peakOverall: 93.5 } };
    const c = cardFromSave(aged, { orgs: ["A"], titles: ["Worlds 2027"], bestRating: 8.24, nickname: "Mr. LAN" });
    expect(c.peak).toBe(93.5);
    expect(c.seasons).toBe(10);
    expect(c.orgs).toEqual(["A"]);
    expect(c.bestRating).toBe(8.2);
    expect(c.nickname).toBe("Mr. LAN");
    const retired = retireProSave({ ...aged, clock: { seasonIndex: 12, day: 3 } }, "age");
    expect(cardFromSave(retired).seasons).toBe(13);
  });
});

describe("Pro card: the legends beside him", () => {
  const ranking = [
    { name: "A", peak: 98 },
    { name: "B", peak: 96 },
    { name: "C", peak: 94 },
    { name: "D", peak: 94 },
    { name: "E", peak: 90 },
    { name: "F", peak: 85 },
  ];

  it("places a peak between its neighbours, nearest first", () => {
    const n = legendNeighbours(92, ranking, 2);
    expect(n.place).toBe(5);
    expect(n.of).toBe(6);
    expect(n.above.map((l) => l.name)).toEqual(["D", "C"]);
    expect(n.below.map((l) => l.name)).toEqual(["E", "F"]);
  });

  it("handles the top, the bottom and ties", () => {
    expect(legendNeighbours(99, ranking, 2)).toMatchObject({ place: 1, above: [], below: [{ name: "A" }, { name: "B" }] });
    const low = legendNeighbours(60, ranking, 2);
    expect(low.place).toBe(7);
    expect(low.below).toEqual([]);
    expect(legendNeighbours(94, ranking, 2).place).toBe(3);
    expect(legendNeighbours(90, [], 2)).toEqual({ place: 1, of: 0, above: [], below: [] });
  });

  it("is computed from the dataset: best card per real player, highest first", () => {
    const names = new Map((playersJson as { id: string; nickname: string }[]).map((p) => [p.id, p.nickname]));
    const rank = allTimeRanking(cardsJson as { playerId: string; overall: number }[], names);
    expect(rank.length).toBeGreaterThan(200);
    for (let i = 1; i < rank.length; i++) expect(rank[i].peak).toBeLessThanOrEqual(rank[i - 1].peak);
    expect(rank[0].peak).toBeGreaterThanOrEqual(95);
    const n = legendNeighbours(rank[40].peak, rank, 2);
    expect(n.above).toHaveLength(2);
    expect(n.below).toHaveLength(2);
    expect(n.place).toBeLessThanOrEqual(41);
    // Every name resolved from the dataset, none left as a raw id for a known player.
    expect(rank.every((l) => l.name.length > 0)).toBe(true);
  });
});
