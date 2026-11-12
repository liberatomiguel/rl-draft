/**
 * SEASON 1 CUTOVER REHEARSAL (ONDA3 step 3): pre-season saves entering v2.0.
 *
 * Two parts:
 *  1. Always on (cheap, in the suite): saves built in the EXACT shape the 455
 *     production accounts have (surveyed on 12/11/2026: the same 18 keys on every
 *     row, two run-history shapes, no `season` block) with the real extremes
 *     (2,471,855 XP, rating 4469, 530 titles, every id anyone holds).
 *  2. On demand: real saves from a file kept OUTSIDE the repo.
 *       PRESEASON_SAVES=<file> npx vitest run src/store/preseasonRehearsal.test.ts
 *     Accepted: the Supabase CSV export of `profiles` (uses the `durable` column
 *     only, rows are reported by number, never by name), a JSON array of rows or
 *     durable blobs, or a localStorage dump holding `rocket-draft:profile:v1`.
 *
 * Every save goes through the three ways a pre-season profile reaches Season 1:
 *  A. the persist migrate (the same browser opens v2.0),
 *  B. a sign-in on a clean device (fresh v2.0 profile merged with the cloud row),
 *  C. the migrated browser merged with its own stale cloud row (and again: the
 *     merge must settle).
 *
 * `__fixtures__/preseason-held-ids.json` lists every achievement / special /
 * challenge id held by a real account. An id that leaves the build is pruned
 * from those accounts on migrate, so the guard below fails first. Retiring one
 * on purpose = remove it from the fixture in the same change, with a
 * DESIGN-DECISIONS line saying players lose it.
 */

import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HISTORY_LIMIT, mmrBackfillFloor, PRESEASON_RANKS, SEASON_RATING } from "@/config/balance";
import { SEASON } from "@/config/season";
import { achievementById, specialCardIds } from "@/data/catalog";
import { COSMETICS } from "@/data/cosmetics";
import held from "./__fixtures__/preseason-held-ids.json";

type Blob = Record<string, unknown>;
type Wins = { easy: number; normal: number; hard: number; legacy: number };

const PROFILE_KEY = "rocket-draft:profile:v1";
const REAL_FILE = process.env.PRESEASON_SAVES;
const DATE = "2026-09-01T12:00:00.000Z";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

const storage = new MemoryStorage();
let profileStore: typeof import("./profileStore").useProfileStore;
let sync: typeof import("@/lib/profileSync");
let migrate: (persisted: unknown, version: number) => unknown;

beforeAll(async () => {
  await import("@/lib/analytics");
  vi.stubGlobal("window", { localStorage: storage });
  try {
    profileStore = (await import("./profileStore")).useProfileStore;
    sync = await import("@/lib/profileSync");
  } finally {
    vi.unstubAllGlobals();
  }
  const persist = (profileStore as unknown as { persist: { getOptions: () => { migrate?: typeof migrate } } }).persist;
  migrate = persist.getOptions().migrate!;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Saves in the production shape
// ---------------------------------------------------------------------------

const dateMap = (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, DATE]));

function historyEntry(i: number, old = false): Blob {
  const entry: Blob = {
    date: new Date(Date.parse(DATE) - i * 3_600_000).toISOString(),
    difficulty: i % 2 ? "hard" : "legacy",
    hiddenOverall: false,
    placement: i % 3 ? "champion" : "swiss",
    rosterNames: ["Player A", "Player B", "Player C"],
    runId: `run-${i}`,
    swissRecord: "3-1",
    teamOverall: 91,
    xpGained: 480,
  };
  // 75 of the 8,985 real entries predate these three keys.
  return old ? entry : { ...entry, mode: "classic", recap: { finalScore: "4-2" }, region: "worldwide" };
}

function productionShape(over: Blob = {}): Blob {
  return {
    achievements: {},
    challengesCompleted: {},
    dailyResults: {},
    flags: { seenHowToPlay: true, seenLegacyIntro: true, seenRegionalIntro: true, seenTutorial: true },
    gamesWon: 0,
    goalsScored: 0,
    legacyUnlocked: false,
    mmr: 1000,
    playoffAppearances: 0,
    podiums: 0,
    records: {
      bestOverall: { easy: 0, normal: 0, hard: 0, legacy: 0 },
      bestOverallSam: 0,
      bestOverallWorldwide: 0,
    },
    runHistory: [],
    runsCompleted: 0,
    settings: { lastDifficulty: "normal", lastMode: "classic", lastRegionLock: "worldwide", lastShowOverall: true },
    swissWinsTotal: 0,
    unlockedSpecials: {},
    wins: { easy: 0, hard: 0, legacy: 0, normal: 0 },
    xp: 0,
    ...over,
  };
}

/** The account with everything: the real maxima and every id anyone holds. */
const veteran = () =>
  productionShape({
    xp: 2_471_855,
    mmr: 4469,
    wins: { easy: 40, hard: 180, legacy: 250, normal: 60 },
    runsCompleted: 2100,
    playoffAppearances: 1500,
    podiums: 900,
    swissWinsTotal: 5200,
    gamesWon: 14000,
    goalsScored: 52000,
    legacyUnlocked: true,
    achievements: dateMap(held.achievements),
    unlockedSpecials: dateMap(held.specials),
    challengesCompleted: dateMap(held.challenges),
    runHistory: Array.from({ length: HISTORY_LIMIT }, (_, i) => historyEntry(i, i > 20)),
    dailyResults: {
      "2026-08-30": { label: "Champion", placement: "champion", xp: 900 },
      "2026-08-31": { label: "Swiss 1-3", placement: "swiss", xp: 120 },
    },
    records: {
      bestOverall: { easy: 96, normal: 96, hard: 95, legacy: 97 },
      bestOverallSam: 91,
      bestOverallWorldwide: 97,
    },
  });

/** Literal expectations for the frozen v1.3.5 ladder (not derived from the code). */
const RANK_AT_XP: [number, string][] = [
  [0, "unranked"],
  [199, "unranked"],
  [200, "bronze"],
  [1499, "bronze"],
  [1500, "silver"],
  [4000, "gold"],
  [8500, "platinum"],
  [15000, "diamond"],
  [23999, "diamond"],
  [24000, "champion"],
  [38000, "grand-champion"],
  [59999, "grand-champion"],
  [60000, "supersonic-legend"],
  [2_471_855, "supersonic-legend"],
];

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Blob) : {});
const winsOf = (v: unknown): Wins => ({ easy: 0, normal: 0, hard: 0, legacy: 0, ...(obj(v) as Partial<Wins>) });
const rankFor = (xp: number) => PRESEASON_RANKS.reduce<string>((id, r) => (xp >= r.minXp ? r.id : id), "unranked");

const pruned = { achievements: new Set<string>(), specials: new Set<string>() };

/** Everything a pre-season player must find after entering Season 1. */
function problemsOf(oldIn: Blob, outIn: unknown, path: "migrate" | "sign-in" | "re-merge"): string[] {
  const old = oldIn;
  const out = obj(outIn);
  const bad: string[] = [];
  const same = (name: string, got: unknown, want: unknown) => {
    if (!isDeepStrictEqual(got, want)) bad.push(`${name}: got ${JSON.stringify(got)?.slice(0, 120)}, want ${JSON.stringify(want)?.slice(0, 120)}`);
  };

  const xp = Math.max(0, num(old.xp));
  const runs = Math.max(0, num(old.runsCompleted));
  const wins = winsOf(old.wins);
  const titles = wins.easy + wins.normal + wins.hard + wins.legacy;

  // The reset.
  same("xp", out.xp, 0);
  same("mmr", out.mmr, SEASON_RATING.start);
  same("season.id", obj(out.season).id, SEASON.id);
  same("season.runs", obj(out.season).runs, 0);
  same("season.titles", obj(out.season).titles, 0);
  same("challengesCompleted", out.challengesCompleted, {});
  same("lifetime.xp", obj(out.lifetime).xp, xp);

  // The archive.
  const snap = obj(out.legacy).preseason as Blob | null | undefined;
  if (xp === 0 && runs === 0) {
    same("legacy.preseason (nothing to archive)", snap ?? null, null);
  } else if (!snap) {
    bad.push("legacy.preseason missing");
  } else {
    same("preseason.xp", snap.xp, xp);
    same("preseason.rankId", snap.rankId, rankFor(xp));
    same("preseason.runsCompleted", snap.runsCompleted, runs);
    same("preseason.titles", snap.titles, titles);
    same("preseason.mmr", snap.mmr, Math.max(num(old.mmr), mmrBackfillFloor(wins)));
    same("preseason.challengesCleared", snap.challengesCleared, Object.keys(obj(old.challengesCompleted)).length);
  }

  // What is kept.
  same("wins", winsOf(out.wins), wins);
  for (const k of ["runsCompleted", "playoffAppearances", "podiums", "swissWinsTotal", "gamesWon", "goalsScored"]) {
    same(k, out[k], num(old[k]));
  }
  if (old.legacyUnlocked || wins.hard > 0 || wins.legacy > 0) same("legacyUnlocked", out.legacyUnlocked, true);

  const keptMap = (name: "achievements" | "specials", field: string, known: (id: string) => boolean) => {
    const before = obj(old[field]);
    const after = obj(out[field]);
    for (const [id, date] of Object.entries(before)) {
      if (!known(id)) pruned[name].add(id);
      else if (after[id] !== date) bad.push(`${field}.${id}: got ${String(after[id])}, want ${String(date)}`);
    }
  };
  keptMap("achievements", "achievements", (id) => achievementById.has(id));
  keptMap("specials", "unlockedSpecials", (id) => specialCardIds.has(id));

  const history = (v: unknown) => new Map((Array.isArray(v) ? (v as Blob[]) : []).map((e) => [String(e.runId), e]));
  const before = history(old.runHistory);
  const after = history(out.runHistory);
  same("runHistory size", after.size, Math.min(before.size, HISTORY_LIMIT));
  for (const [id, entry] of after) if (!isDeepStrictEqual(entry, before.get(id))) bad.push(`runHistory entry ${id} changed`);
  same("dailyResults", out.dailyResults, obj(old.dailyResults));
  same("records", out.records, old.records);

  // The rewards (rule-agnostic: the peak rank's own rewards and First Chapter).
  const owned = obj(obj(out.cosmetics).owned);
  const expectOwned = runs > 0;
  for (const c of COSMETICS) {
    const mine =
      c.source.type === "legacy-participation" || (c.source.type === "legacy-rank" && c.source.rankId === rankFor(xp));
    if (mine && expectOwned && !owned[c.id]) bad.push(`reward ${c.id} not owned`);
    if ((c.source.type === "legacy-participation" || c.source.type === "legacy-rank") && !expectOwned && owned[c.id]) {
      bad.push(`reward ${c.id} owned without a finished pre-season run`);
    }
  }
  return bad.map((b) => `[${path}] ${b}`);
}

/** One save through the three paths; returns every problem found. */
function rehearse(durable: Blob, version = 11): string[] {
  const migrated = migrate(structuredClone(durable), version) as Blob;
  const problems = problemsOf(durable, migrated, "migrate");

  const fresh = sync.toDurable(profileStore.getInitialState());
  const cloud = structuredClone(durable) as unknown as ReturnType<typeof sync.toDurable>;
  const signIn = sync.mergeProfiles(structuredClone(fresh), cloud);
  problems.push(...problemsOf(durable, signIn, "sign-in"));

  const local = sync.toDurable(migrated as unknown as Parameters<typeof sync.toDurable>[0]);
  const once = sync.mergeProfiles(structuredClone(local), structuredClone(cloud));
  problems.push(...problemsOf(durable, once, "re-merge"));
  const twice = sync.mergeProfiles(structuredClone(once), structuredClone(cloud));
  if (!isDeepStrictEqual(twice, once)) problems.push("[re-merge] a second merge with the same cloud row changed the profile");
  return problems;
}

// ---------------------------------------------------------------------------

describe("pre-season ids real accounts hold are still in the build", () => {
  it("every held achievement id exists", () => {
    expect(held.achievements.filter((id) => !achievementById.has(id))).toEqual([]);
  });
  it("every held special card id exists", () => {
    expect(held.specials.filter((id) => !specialCardIds.has(id))).toEqual([]);
  });
});

describe("pre-season saves in the production shape enter Season 1", () => {
  it("the veteran with everything keeps everything", () => {
    expect(rehearse(veteran())).toEqual([]);
  });

  it.each(RANK_AT_XP)("%i XP freezes as %s and is rewarded for it", (xp, rankId) => {
    const save = productionShape({ xp, runsCompleted: 3, wins: { easy: 1, hard: 0, legacy: 0, normal: 0 } });
    expect(rankFor(xp)).toBe(rankId);
    expect(rehearse(save)).toEqual([]);
    const out = migrate(structuredClone(save), 11) as { legacy: { preseason: { rankId: string } } };
    expect(out.legacy.preseason.rankId).toBe(rankId);
  });

  it("an account that never played has no pre-season and no rewards (19 real rows)", () => {
    expect(rehearse(productionShape())).toEqual([]);
  });

  it("XP without a finished run is archived but earns no reward (4 real rows)", () => {
    expect(rehearse(productionShape({ xp: 350 }))).toEqual([]);
  });

  it("the veteran hydrates end to end and is written back at the current version", async () => {
    profileStore.setState(profileStore.getInitialState(), true);
    storage.clear();
    storage.setItem(PROFILE_KEY, JSON.stringify({ state: veteran(), version: 11 }));
    await (profileStore as unknown as { persist: { rehydrate: () => Promise<void> | void } }).persist.rehydrate();
    const state = profileStore.getState();
    expect(state.xp).toBe(0);
    expect(state.mmr).toBe(SEASON_RATING.start);
    expect(state.legacy.preseason).toMatchObject({ xp: 2_471_855, rankId: "supersonic-legend", titles: 530, mmr: 4469 });
    expect(Object.keys(state.unlockedSpecials)).toHaveLength(held.specials.length);
    const written = JSON.parse(storage.getItem(PROFILE_KEY)!);
    expect(written.version).toBe(12);
    expect(written.state.legacy.preseason.xp).toBe(2_471_855);
    expect(written.state.runHistory).toHaveLength(HISTORY_LIMIT);
  });
});

// ---------------------------------------------------------------------------
// Real saves (file outside the repo)
// ---------------------------------------------------------------------------

/** RFC 4180 reader, enough for the Supabase export (quoted JSON, doubled quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function loadRealSaves(file: string): { label: string; durable: Blob; version: number }[] {
  const text = readFileSync(file, "utf8").replace(/^﻿/, "");
  const blob = (v: unknown): Blob | null => {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return parsed && typeof parsed === "object" ? (parsed as Blob) : null;
  };
  if (file.toLowerCase().endsWith(".csv")) {
    const [header, ...rows] = parseCsv(text);
    const col = header.indexOf("durable");
    if (col < 0) throw new Error("no `durable` column in the CSV");
    return rows.flatMap((r, i) => {
      const durable = r[col] ? blob(r[col]) : null;
      return durable ? [{ label: `row ${i + 1}`, durable, version: 11 }] : [];
    });
  }
  const json = JSON.parse(text) as unknown;
  if (Array.isArray(json)) {
    return json.flatMap((row, i) => {
      const durable = blob(obj(row).durable ?? row);
      return durable ? [{ label: `row ${i + 1}`, durable, version: 11 }] : [];
    });
  }
  const dump = obj(json);
  const saved = blob(dump[PROFILE_KEY] ?? dump);
  if (!saved?.state) throw new Error("not a localStorage dump: no `state`");
  return [{ label: "localStorage save", durable: obj(saved.state), version: num(saved.version) }];
}

describe.skipIf(!REAL_FILE)("real pre-season saves (PRESEASON_SAVES)", () => {
  it("every real save enters Season 1 with nothing lost", () => {
    if (!REAL_FILE || !existsSync(REAL_FILE)) throw new Error(`PRESEASON_SAVES not found: ${REAL_FILE}`);
    const saves = loadRealSaves(REAL_FILE);
    expect(saves.length).toBeGreaterThan(0);

    const byRank: Record<string, number> = {};
    const failures: string[] = [];
    let crashed = 0;
    for (const save of saves) {
      const rank = rankFor(Math.max(0, num(save.durable.xp)));
      byRank[rank] = (byRank[rank] ?? 0) + 1;
      try {
        // A save already at v12 took the reset before: it is checked for stability only.
        if (save.version >= 12) {
          const again = migrate(structuredClone(save.durable), save.version) as Blob;
          if (num(again.xp) !== num(save.durable.xp)) failures.push(`${save.label}: a current save changed XP on reload`);
          continue;
        }
        const problems = rehearse(save.durable, save.version);
        if (problems.length) failures.push(`${save.label}: ${problems.slice(0, 6).join(" | ")}`);
      } catch (error) {
        crashed++;
        failures.push(`${save.label}: THREW ${(error as Error).message}`);
      }
    }

    console.log(
      [
        `real saves: ${saves.length}`,
        `frozen rank: ${PRESEASON_RANKS.map((r) => `${r.id} ${byRank[r.id] ?? 0}`).join(", ")}`,
        `saves with a problem: ${failures.length} (threw: ${crashed})`,
        `ids pruned: achievements [${[...pruned.achievements].join(", ")}] specials [${[...pruned.specials].join(", ")}]`,
        ...failures.slice(0, 40),
      ].join("\n"),
    );
    expect(failures).toEqual([]);
    expect([...pruned.achievements, ...pruned.specials]).toEqual([]);
  });
});
