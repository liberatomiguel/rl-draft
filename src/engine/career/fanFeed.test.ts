/**
 * v2.3 FEED: the derivation. Determinism, variety (the no-repeat window, two
 * slots a variant, the copy's keys), the claims that need their data, the
 * handle bank, the receipt in the feed and EN/PT parity. The store side is in
 * store/fanFeedFlow.test.ts.
 */
import { describe, expect, it } from "vitest";
import { CAREER_FEED } from "@/config/balance";
import { CAREER_FEED_EN } from "@/content/copy.career.feed.en";
import { CAREER_FEED_PT } from "@/content/copy.career.feed.pt";
import { NAME_CATALOG } from "@/data/career/nameCatalog";
import { orgs, players } from "@/data";
import { createRng } from "@/lib/rng";
import { createCareerSave, type CreateCareerInput } from "@/store/careerFlow";
import { claimHolds, eligibleVariants, fanFeedFor, managerPostDraftOf, windowFor } from "./fanFeed";
import { FEED_VARIANTS } from "./fanFeedVariants";
import { feedTextOf, fillTemplate, placeholdersOf } from "./fanFeedText";
import type { FanFeedSave, FeedKind, FeedSeries } from "./fanFeedTypes";
import { HANDLE_HEADS, HANDLE_TAILS, handleFrom, handleKey } from "./fanHandles";
import type { CareerSave, CompactEventResult } from "./types";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Feed Test Org",
    abbrev: "FTO",
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

const SHARED = createCareerSave(INPUT, 4242);
/** A fresh-looking save (the shared one: tests only spread it, never mutate it). */
const base = (seed?: number): CareerSave => (seed === undefined ? SHARED : { ...SHARED, careerSeed: seed });

const OPPONENTS = ["Rival Alpha", "Rival Beta", "Rival Gamma", "Rival Delta", "Rival Epsilon"];

/** A deterministic run of series: `pattern` is W / L / U (upset win) / X (upset loss). */
function series(pattern: string, from = 1): FeedSeries[] {
  return [...pattern].map((c, i) => {
    const won = c === "W" || c === "U";
    return {
      n: from + i,
      seasonIndex: 1,
      week: 3 + Math.floor(i / 3),
      eventId: `e${Math.floor(i / 3)}`,
      event: `Test Event ${Math.floor(i / 3) + 1}`,
      opponentRef: `opp${i % 5}`,
      opponentName: OPPONENTS[i % 5],
      us: won ? 3 : i % 2,
      them: won ? i % 2 : 3,
      won,
      upset: c === "U" || c === "X",
    };
  });
}

function feedOf(list: FeedSeries[], extra: Partial<FanFeedSave> = {}): FanFeedSave {
  return { v: 1, seq: list.length + 1, series: list, posts: [], answered: 0, followers: 400, ...extra };
}

function withFeed(save: CareerSave, feed: FanFeedSave): CareerSave {
  return { ...save, fanFeed: feed };
}

const textsOf = (save: CareerSave, lang: "en" | "pt" = "en", limit = 500) =>
  fanFeedFor(save, { limit }).map((p) => feedTextOf(p, (lang === "en" ? CAREER_FEED_EN : CAREER_FEED_PT).feed));

const MIX = "WWLWUWWWWWLLXLLLLLWUXWWWLWWWWWWWWLLLLLLLLWWWWWWWWWWWWLWLWLXU";

describe("fanFeedFor: derived, seeded, stored nowhere", () => {
  it("is deterministic for a fixed save", () => {
    const save = withFeed(base(), feedOf(series(MIX)));
    expect(fanFeedFor(save, { limit: 500 })).toEqual(fanFeedFor(save, { limit: 500 }));
    expect(fanFeedFor(structuredClone(save), { limit: 500 })).toEqual(fanFeedFor(save, { limit: 500 }));
  });

  it("does not change a post when the cap changes", () => {
    const save = withFeed(base(), feedOf(series(MIX)));
    const all = fanFeedFor(save, { limit: 500 });
    expect(fanFeedFor(save, { limit: 10 })).toEqual(all.slice(0, 10));
  });

  it("does not write to the save", () => {
    const save = withFeed(base(), feedOf(series(MIX)));
    const before = JSON.stringify(save);
    fanFeedFor(save);
    expect(JSON.stringify(save)).toBe(before);
  });

  it("gives a save with no feed and no history no posts (older save: skip, never invent)", () => {
    expect(fanFeedFor(base())).toEqual([]);
  });

  it("two saves with different results read differently", () => {
    const a = withFeed(base(), feedOf(series("WWWLW")));
    const b = withFeed(base(), feedOf(series("LLLWL")));
    expect(textsOf(a)).not.toEqual(textsOf(b));
    const c = withFeed(base(), feedOf(series("WWWLW")));
    c.fanFeed!.series[0].opponentName = "Someone Else";
    expect(textsOf(c).join("|")).not.toBe(textsOf(a).join("|"));
  });

  it("a different career seed picks different variants and handles for the same results", () => {
    const list = series(MIX);
    const a = fanFeedFor(withFeed(base(1), feedOf(list)), { limit: 500 });
    const b = fanFeedFor(withFeed({ ...base(1), careerSeed: 99_991 }, feedOf(list)), { limit: 500 });
    expect(a.map((p) => p.variant)).not.toEqual(b.map((p) => p.variant));
    expect(a.map((p) => p.author)).not.toEqual(b.map((p) => p.author));
  });

  it("names a series' kind from its result: win, loss, upset, streak", () => {
    const kinds = fanFeedFor(withFeed(base(), feedOf(series("WLUXWWWLLL"))), { limit: 50 })
      .map((p) => p.kind)
      .reverse();
    expect(kinds).toEqual(["seriesWon", "seriesLost", "upsetWin", "upsetLoss", "seriesWon", "seriesWon", "winStreak", "seriesLost", "seriesLost", "loseStreak"]);
  });
});

describe("variety (F3)", () => {
  it("every kind has at least six variants and the copy has exactly their keys, EN and PT", () => {
    const keys = Object.values(FEED_VARIANTS).flatMap((vs) => vs.map((v) => v.key));
    for (const [kind, vs] of Object.entries(FEED_VARIANTS)) expect(vs.length, kind).toBeGreaterThanOrEqual(6);
    const wanted = [...keys].sort();
    expect(Object.keys(CAREER_FEED_EN.feed.text).sort()).toEqual(wanted);
    expect(Object.keys(CAREER_FEED_PT.feed.text).sort()).toEqual(wanted);
    expect(Object.keys(CAREER_FEED_PT.feed.tones).sort()).toEqual(Object.keys(CAREER_FEED_EN.feed.tones).sort());
    for (const k of Object.keys(CAREER_FEED_EN.feed)) expect(Object.keys(CAREER_FEED_PT.feed)).toContain(k);
  });

  it("every variant uses at least two data slots, and exactly the ones it declares", () => {
    const all = Object.values(FEED_VARIANTS).flat();
    for (const v of all) {
      expect(new Set(v.needs).size, v.key).toBeGreaterThanOrEqual(2);
      for (const dict of [CAREER_FEED_EN.feed.text, CAREER_FEED_PT.feed.text]) {
        const used = new Set(placeholdersOf(dict[v.key]));
        expect([...used].sort(), v.key).toEqual([...new Set(v.needs)].sort());
      }
    }
  });

  it("a rendered variant leaves no placeholder behind", () => {
    const slots = { opponent: "OPP", score: "3-1", event: "EVT", org: "ORG", streak: "5", player: "PLR", fee: "$1M", from: "FRM", to: "TO", titles: "3", week: "7" };
    for (const dict of [CAREER_FEED_EN.feed.text, CAREER_FEED_PT.feed.text]) {
      for (const t of Object.values(dict)) expect(fillTemplate(t, slots)).not.toMatch(/[{}]/);
    }
  });

  it("never repeats a variant inside the window, over many seeds", () => {
    const list = series(MIX);
    let checked = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const save = withFeed({ ...base(7), careerSeed: seed * 7919 }, feedOf(list));
      const chronological = fanFeedFor(save, { limit: 500 }).reverse();
      const byKind = new Map<FeedKind, string[]>();
      for (const p of chronological) {
        const seen = byKind.get(p.kind) ?? [];
        const eligible = eligibleVariants(p.kind as Exclude<FeedKind, "managerPost">, p.slots, { ledger: 0, regionalChampion: false });
        const w = Math.min(CAREER_FEED.window, Math.max(0, eligible.length - 1));
        expect(seen.slice(seen.length - w), `${p.id} seed ${seed}`).not.toContain(p.variant);
        seen.push(p.variant);
        byKind.set(p.kind, seen);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it("every kind with a full pool honours the whole window (six always-eligible variants)", () => {
    for (const kind of ["seriesWon", "seriesLost", "upsetWin", "upsetLoss", "winStreak", "loseStreak", "signing", "sale", "titleWon", "finalLost", "receipt"] as const) {
      const alwaysEligible = FEED_VARIANTS[kind].filter((v) => !v.claim && v.needs.every((s) => !["fee", "from", "to", "titles"].includes(s)));
      expect(alwaysEligible.length, kind).toBeGreaterThan(CAREER_FEED.window);
    }
    expect(windowFor(7)).toBe(CAREER_FEED.window);
    expect(windowFor(3)).toBe(2);
    expect(windowFor(1)).toBe(0);
  });

  it("uses most of the variants on a long run (not one line repeated)", () => {
    const save = withFeed(base(), feedOf(series(MIX)));
    const used = new Set(fanFeedFor(save, { limit: 500 }).map((p) => p.variant));
    expect(used.size).toBeGreaterThan(20);
  });
});

describe("claims need their data (R197)", () => {
  const claimWords: Record<string, RegExp[]> = {
    dynasty: [/dynast/i, /dinasti/i],
    bestInRegion: [/best team in the region/i, /melhor time da regi/i],
    firstMajor: [/\bfirst\b/i, /primeiro/i],
  };

  it("a claim word sits only in a variant tagged with that claim", () => {
    const tagged = new Map(Object.values(FEED_VARIANTS).flat().map((v) => [v.key, v.claim]));
    for (const dict of [CAREER_FEED_EN.feed.text, CAREER_FEED_PT.feed.text]) {
      for (const [key, text] of Object.entries(dict)) {
        for (const [claim, words] of Object.entries(claimWords)) {
          if (words.some((w) => w.test(text))) expect(tagged.get(key), `${key} says ${claim}`).toBe(claim);
        }
      }
    }
    // and each tagged variant does say its claim, so the tag is not decoration
    for (const [key, claim] of tagged) {
      if (!claim) continue;
      for (const dict of [CAREER_FEED_EN.feed.text, CAREER_FEED_PT.feed.text]) expect(claimWords[claim].some((w) => w.test(dict[key])), key).toBe(true);
    }
  });

  it("no claim variant is picked on a save without the data, over many seeds", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const save = withFeed({ ...base(3), careerSeed: seed * 104_729 }, feedOf(series(MIX)));
      for (const p of fanFeedFor(save, { limit: 500 })) {
        const v = Object.values(FEED_VARIANTS).flat().find((x) => x.key === p.variant);
        expect(v?.claim, `${p.variant} seed ${seed}`).toBeUndefined();
      }
      for (const lang of ["en", "pt"] as const) {
        for (const t of textsOf(save, lang)) for (const words of Object.values(claimWords)) for (const w of words) expect(t).not.toMatch(w);
      }
    }
  });

  it("the predicates read the ledger and the latest regional", () => {
    expect(claimHolds("dynasty", { ledger: 2, regionalChampion: false }, {})).toBe(false);
    expect(claimHolds("dynasty", { ledger: CAREER_FEED.claims.dynastyTitles, regionalChampion: false }, {})).toBe(true);
    expect(claimHolds("bestInRegion", { ledger: 0, regionalChampion: false }, {})).toBe(false);
    expect(claimHolds("bestInRegion", { ledger: 0, regionalChampion: true }, {})).toBe(true);
    expect(claimHolds("firstMajor", { ledger: 1, regionalChampion: false }, { titles: "1" })).toBe(true);
    expect(claimHolds("firstMajor", { ledger: 2, regionalChampion: false }, { titles: "2" })).toBe(false);
  });

  const result = (over: Partial<CompactEventResult>): CompactEventResult => ({
    eventId: "ev",
    tier: "major",
    seasonIndex: 1,
    week: 10,
    name: "Test Major",
    rows: [
      { ref: "user", name: "Feed Test Org", placement: "champion", points: 0, prize: 0 },
      { ref: "opp1", name: "Rival Beta", placement: "runner_up", points: 0, prize: 0 },
    ],
    championRef: "user",
    userPlacement: "champion",
    fieldQuality: 1,
    ...over,
  });
  const honor = (eventId: string, seasonIndex: number) => ({ eventId, seasonIndex, tier: "major" as const, orgRef: "user", orgName: "Feed Test Org", players: [] });

  it("a first title says first, a third says dynasty, a regional says neither", () => {
    const first = { ...base(), eventResults: [result({})], honors: [honor("ev", 1)] };
    const [a] = fanFeedFor(first);
    expect(a.kind).toBe("titleWon");
    expect(a.slots.titles).toBe("1");
    const third = { ...base(), eventResults: [result({})], honors: [honor("old1", 0), honor("old2", 0), honor("ev", 1)] };
    const [b] = fanFeedFor(third);
    expect(b.slots.titles).toBe("3");
    const keysSeen = new Set<string>();
    const dynastyKey = FEED_VARIANTS.titleWon.find((v) => v.claim === "dynasty")!.key;
    const firstKey = FEED_VARIANTS.titleWon.find((v) => v.claim === "firstMajor")!.key;
    for (let seed = 1; seed <= 200; seed++) {
      keysSeen.add(fanFeedFor({ ...first, careerSeed: seed })[0].variant);
      expect(fanFeedFor({ ...first, careerSeed: seed })[0].variant).not.toBe(dynastyKey);
      expect(fanFeedFor({ ...third, careerSeed: seed })[0].variant).not.toBe(firstKey);
    }
    expect(keysSeen.has(firstKey)).toBe(true);
    const dyn = new Set(Array.from({ length: 200 }, (_, i) => fanFeedFor({ ...third, careerSeed: i + 1 })[0].variant));
    expect(dyn.has(dynastyKey)).toBe(true);
    const regional = { ...base(), eventResults: [result({ tier: "regional", eventId: "rg" })], honors: [] };
    for (let seed = 1; seed <= 100; seed++) {
      const [p] = fanFeedFor({ ...regional, careerSeed: seed });
      expect(p.slots.titles).toBeUndefined();
      expect(Object.values(FEED_VARIANTS).flat().find((v) => v.key === p.variant)?.claim).toBeUndefined();
    }
  });

  it("best in the region needs the latest regional won, on a streak or a series", () => {
    const run = feedOf(series("WWW"));
    const won = { ...base(), fanFeed: run, eventResults: [result({ tier: "regional", eventId: "rg", week: 2 })] };
    const lost = { ...base(), fanFeed: run, eventResults: [result({ tier: "regional", eventId: "rg", week: 2, userPlacement: "swiss_exit", championRef: "opp1" })] };
    const claimKeys = new Set(["seriesWon.7", "winStreak.7"]);
    let hit = false;
    for (let seed = 1; seed <= 200; seed++) {
      if (fanFeedFor({ ...won, careerSeed: seed }).some((p) => claimKeys.has(p.variant))) hit = true;
      expect(fanFeedFor({ ...lost, careerSeed: seed }).some((p) => claimKeys.has(p.variant))).toBe(false);
    }
    expect(hit).toBe(true);
  });

  it("a lost final names the champion; a title's older seasons without a name are skipped", () => {
    const final = { ...base(), eventResults: [result({ userPlacement: "runner_up", championRef: "opp1" })], honors: [honor("gone", 0)] };
    const feed = fanFeedFor(final);
    expect(feed.map((p) => p.kind)).toEqual(["finalLost"]);
    expect(feed[0].slots.opponent).toBe("Rival Beta");
  });
});

describe("signings and sales", () => {
  const log = (kind: "userIn" | "userOut", id: string, extra: object = {}) => ({
    id,
    seasonIndex: 1,
    day: 20,
    playerId: `p-${id}`,
    playerName: `Player ${id}`,
    fromRef: null,
    toRef: null,
    fee: 0,
    kind,
    region: "SAM" as const,
    ...extra,
  });

  it("reads the transfer wire, and drops the slots a free agent does not have", () => {
    const save = { ...base(), transferLog: [log("userIn", "t1"), log("userOut", "t2", { fee: 250_000 })] };
    const feed = fanFeedFor(save);
    expect(feed.map((p) => p.kind).sort()).toEqual(["sale", "signing"]);
    for (const p of feed) {
      expect(p.slots.from).toBeUndefined();
      expect(p.slots.player).toBeDefined();
    }
    expect(feed.find((p) => p.kind === "sale")!.slots.fee).toBe("$250k");
    for (let seed = 1; seed <= 100; seed++) {
      for (const p of fanFeedFor({ ...save, careerSeed: seed })) {
        const needs = Object.values(FEED_VARIANTS).flat().find((v) => v.key === p.variant)!.needs;
        for (const s of needs) expect(p.slots[s], `${p.variant} needs ${s}`).toBeDefined();
      }
    }
  });

  it("names the other org when the world knows it", () => {
    const refs = Object.keys(base().world.orgs);
    const other = refs[0];
    const save = { ...base(), transferLog: [log("userIn", "t3", { fromRef: other, fee: 1_200_000 })] };
    const [p] = fanFeedFor(save);
    expect(p.slots.from).toBe(save.world.orgs[other].name);
    expect(p.slots.fee).toBe("$1.2M");
  });
});

describe("handles (F2)", () => {
  const real = new Set<string>([
    ...players.map((p) => handleKey(p.nickname)),
    ...orgs.map((o) => handleKey(o.name)),
    ...Object.values(NAME_CATALOG.players).flat().map(handleKey),
    ...Object.values(NAME_CATALOG.orgs).flat().map(handleKey),
  ]);

  it("no bank word, and no generated handle, equals a dataset player or org name", () => {
    expect([...HANDLE_HEADS, ...HANDLE_TAILS].filter((w) => real.has(handleKey(w)))).toEqual([]);
    const rng = createRng(2026);
    for (let i = 0; i < 20_000; i++) {
      const h = handleFrom(rng);
      expect(h, h).toMatch(/^[a-z0-9._]+$/);
      expect(real.has(handleKey(h)), h).toBe(false);
    }
  });

  it("the feed's authors are fans with handles, and the manager's own post is his", () => {
    const post = { seriesN: 3, tone: "humble" as const, opponentRef: "opp2", opponentName: "Rival Gamma", seasonIndex: 1, week: 4 };
    const save = withFeed(base(), feedOf(series("WWL"), { posts: [post] }));
    for (const p of fanFeedFor(save)) {
      if (p.kind === "managerPost") expect(p.author).toEqual({ type: "manager" });
      else {
        expect(p.author.type).toBe("fan");
        expect(real.has(handleKey((p.author as { handle: string }).handle))).toBe(false);
      }
    }
  });
});

describe("the manager's post, the fans' answer and the receipt in the feed (F4)", () => {
  const post = (tone: "humble" | "confident" | "provocative", over: object = {}) => ({
    seriesN: 2,
    tone,
    opponentRef: "opp1",
    opponentName: "Rival Beta",
    seasonIndex: 1,
    week: 4,
    ...over,
  });

  it("a post yields his own post and a reply that answers its tone", () => {
    for (const tone of ["humble", "confident", "provocative"] as const) {
      const save = withFeed(base(), feedOf(series("WW"), { posts: [post(tone)] }));
      const feed = fanFeedFor(save);
      const mine = feed.filter((p) => p.kind === "managerPost");
      expect(mine).toHaveLength(1);
      expect(FEED_VARIANTS.managerPost.find((v) => v.key === mine[0].variant)).toMatchObject({ tone, result: "won" });
      const reply = feed.find((p) => p.kind === "managerReply")!;
      const def = FEED_VARIANTS.managerReply.find((v) => v.key === reply.variant)!;
      expect(def).toMatchObject({ tone, result: "won" });
      expect(feed.some((p) => p.kind === "receipt")).toBe(false);
    }
  });

  it("a settled receipt becomes a receipt post naming the opponent and the score, winner first", () => {
    const settled = { kind: "receipt" as const, seriesN: 3, seasonIndex: 1, week: 5, event: "Test Event 2", us: 1, them: 3 };
    const save = withFeed(base(), feedOf(series("WWL"), { posts: [post("provocative", { settled })] }));
    const r = fanFeedFor(save).find((p) => p.kind === "receipt")!;
    expect(r.slots).toMatchObject({ opponent: "Rival Beta", score: "3-1", event: "Test Event 2" });
    const text = feedTextOf(r, CAREER_FEED_EN.feed);
    expect(text).toMatch(/Rival Beta/);
    expect(text).not.toMatch(/[{}]/);
  });

  it("a backed-up post makes no receipt", () => {
    const save = withFeed(base(), feedOf(series("WWW"), { posts: [post("provocative", { settled: { kind: "backedUp", seriesN: 3 } })] }));
    expect(fanFeedFor(save).some((p) => p.kind === "receipt")).toBe(false);
  });
});

describe("likes", () => {
  it("scale with followers and stay inside the kind's range at base reach", () => {
    const small = fanFeedFor(withFeed(base(), feedOf(series("WWWWWWWW"), { followers: 400 })), { limit: 100 });
    const big = fanFeedFor(withFeed(base(), feedOf(series("WWWWWWWW"), { followers: 4000 })), { limit: 100 });
    for (const p of small) {
      const [lo, hi] = CAREER_FEED.likes[p.kind];
      expect(p.likes).toBeGreaterThanOrEqual(lo);
      expect(p.likes).toBeLessThanOrEqual(hi);
    }
    expect(big.reduce((n, p) => n + p.likes, 0)).toBeGreaterThan(small.reduce((n, p) => n + p.likes, 0) * 5);
  });
});

describe("eligibleVariants", () => {
  it("drops a variant whose slot is missing and a tone that is not his", () => {
    const keys = eligibleVariants("signing", { player: "X", org: "Y" }, { ledger: 0, regionalChampion: false }).map((v) => v.key);
    expect(keys).toHaveLength(6);
    const reply = eligibleVariants("managerReply", { opponent: "A", org: "B", week: "3", score: "3-0" }, { ledger: 0, regionalChampion: false }, "humble");
    expect(reply.map((v) => `${v.tone}/${v.result}`)).toEqual(["humble/won", "humble/won"]);
    const lost = eligibleVariants("managerReply", { opponent: "A", org: "B", week: "3", score: "3-0" }, { ledger: 0, regionalChampion: false }, "humble", "lost");
    expect(lost.map((v) => `${v.tone}/${v.result}`)).toEqual(["humble/lost", "humble/lost"]);
  });
});

// v2.3 FIX: the manager's post and the fans' answer are written after the series, by its result.
describe("the manager's post follows the result of the series (v2.3 FIX)", () => {
  const TONES = ["humble", "confident", "provocative"] as const;
  const RESULTS = ["won", "lost"] as const;
  const COPIES = [
    ["en", CAREER_FEED_EN.feed],
    ["pt", CAREER_FEED_PT.feed],
  ] as const;
  /** Words that only make sense before a series is played. */
  const PRE_MATCH = {
    en: /\b(ready for|coming for|should be worried|before facing|ahead of|prepared for|getting ready|say you are ready)\b/i,
    pt: /\b(prontos? pra|vem pra cima|pode se preocupar|antes de enfrentar|se preparando|diz que est[aá] pronto)\b/i,
  };
  const postKeys = () => [...FEED_VARIANTS.managerPost, ...FEED_VARIANTS.managerReply, ...FEED_VARIANTS.receipt].map((v) => v.key);

  it("has at least two variants for each tone x result, each with two or more slots", () => {
    for (const kind of ["managerPost", "managerReply"] as const) {
      for (const tone of TONES) {
        for (const result of RESULTS) {
          const cell = FEED_VARIANTS[kind].filter((v) => v.tone === tone && v.result === result);
          expect(cell.length, `${kind} ${tone} ${result}`).toBeGreaterThanOrEqual(2);
          for (const v of cell) expect(new Set(v.needs).size, v.key).toBeGreaterThanOrEqual(2);
        }
      }
    }
    for (const v of FEED_VARIANTS.managerPost) {
      expect(v.needs, v.key).toContain("opponent");
      expect(v.needs.some((s) => s === "score" || s === "event"), v.key).toBe(true);
    }
  });

  it("EN and PT have the same keys for post, reply and receipt, and every text drops in exactly its slots", () => {
    for (const k of postKeys()) {
      const need = [...new Set(Object.values(FEED_VARIANTS).flat().find((v) => v.key === k)!.needs)].sort();
      for (const [, copy] of COPIES) expect([...new Set(placeholdersOf(copy.text[k]))].sort(), k).toEqual(need);
    }
  });

  it("carries no pre-match sentence in any variant or tone description, EN or PT", () => {
    for (const [lang, copy] of COPIES) {
      for (const k of postKeys()) expect(copy.text[k], `${lang} ${k}`).not.toMatch(PRE_MATCH[lang]);
      for (const t of TONES) expect(copy.tones[t].hint, `${lang} ${t}`).not.toMatch(PRE_MATCH[lang]);
    }
  });

  it("PT keeps its rules: events take the article, an org never follows a bare de / pra / em cima de", () => {
    for (const k of postKeys()) {
      const t = CAREER_FEED_PT.feed.text[k];
      expect(t, k).not.toMatch(/\b(de|pra|para|em cima de|a|ao)\s+\{(opponent|org)\}/);
      expect(t, k).not.toMatch(/\b(em|de)\s+\{event\}/);
    }
  });

  it("after a win and after a loss the post and the reply draw only that result's variants; the draft is the post", () => {
    for (const won of [true, false]) {
      for (const tone of TONES) {
        for (let seed = 1; seed <= 30; seed++) {
          const list = series(won ? "WW" : "WL");
          const post = { seriesN: 2, tone, opponentRef: "opp1", opponentName: "Rival Beta", seasonIndex: 1, week: 4 };
          const save = withFeed({ ...base(), careerSeed: seed * 131 }, feedOf(list, { posts: [post] }));
          const feed = fanFeedFor(save);
          for (const kind of ["managerPost", "managerReply"] as const) {
            const p = feed.find((x) => x.kind === kind)!;
            expect(FEED_VARIANTS[kind].find((v) => v.key === p.variant), `${kind} ${tone} ${won}`).toMatchObject({ tone, result: won ? "won" : "lost" });
            for (const [lang, copy] of COPIES) {
              const text = feedTextOf(p, copy);
              expect(text).not.toMatch(/[{}]/);
              expect(text).not.toMatch(PRE_MATCH[lang]);
              expect(text).toContain("Rival Beta");
            }
          }
          const mine = feed.find((x) => x.kind === "managerPost")!;
          const draft = managerPostDraftOf(save, list[1], tone);
          expect(draft.variant).toBe(mine.variant);
          expect(feedTextOf(draft, CAREER_FEED_EN.feed)).toBe(feedTextOf(mine, CAREER_FEED_EN.feed));
        }
      }
    }
  });

  it("the draft names the score and the event of the series, winner first", () => {
    const lost = series("WL")[1];
    expect([lost.us, lost.them]).toEqual([1, 3]);
    const draft = managerPostDraftOf(base(), lost, "provocative");
    expect(draft.slots).toMatchObject({ opponent: "Rival Beta", score: "3-1", event: lost.event });
    expect(FEED_VARIANTS.managerPost.find((v) => v.key === draft.variant)?.result).toBe("lost");
  });

  it("a post stored without a result reads the series ring; with neither it is a win with nothing to name", () => {
    const post = { seriesN: 2, tone: "confident" as const, opponentRef: "opp1", opponentName: "Rival Beta", seasonIndex: 1, week: 4 };
    const fromRing = fanFeedFor(withFeed(base(), feedOf(series("WL"), { posts: [post] }))).find((p) => p.kind === "managerPost")!;
    expect(FEED_VARIANTS.managerPost.find((v) => v.key === fromRing.variant)?.result).toBe("lost");
    const stored = { ...post, result: { won: true, us: 3, them: 0, event: "Stored Event" } };
    const fromRecord = fanFeedFor(withFeed(base(), feedOf(series("WL"), { posts: [stored] }))).find((p) => p.kind === "managerPost")!;
    expect(FEED_VARIANTS.managerPost.find((v) => v.key === fromRecord.variant)?.result).toBe("won");
    expect(fromRecord.slots).toMatchObject({ score: "3-0", event: "Stored Event" });
    const bare = fanFeedFor(withFeed(base(), feedOf([], { posts: [post] })));
    expect(bare.some((p) => p.kind === "managerPost")).toBe(false);
    for (const p of bare.filter((x) => x.kind === "managerReply")) expect(FEED_VARIANTS.managerReply.find((v) => v.key === p.variant)?.result).toBe("won");
  });

  it("a receipt never repeats a post's own claim (it would read wrong after a win or a loss)", () => {
    for (const [, copy] of COPIES) {
      for (const v of FEED_VARIANTS.receipt) {
        expect(copy.text[v.key], v.key).not.toMatch(/\b(ready|pronto|coming|worried|preocupar|will be back|volta)\b/i);
      }
    }
  });
});
