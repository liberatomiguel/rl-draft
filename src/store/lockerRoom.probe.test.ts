/**
 * rc9 LOCKER probe (opt-in: LOCKER_PROBE=1). Plays careers with the arc bot,
 * which since rc9 runs the store's `lockerRoomAfter` on every write, and logs
 * what the locker room did:
 *
 *  - per week: the squad's mood spread (player-weeks in each mood);
 *  - per season: how many times a player's mood changed, how many changes
 *    reverted within two weeks (flapping), the reasons that moved morale
 *    (summed |delta|), the talks opened by topic, the team match bonus at
 *    each event start;
 *  - per arm (LOCKER_PROBE_ARMS, default "on"): the career's results, so the
 *    flag-off arm ("off"), the flag-on arm with no match effect ("zero") and
 *    the flag-on arm with it ("on") can be compared on the same seeds.
 *
 *   LOCKER_PROBE=1 LOCKER_PROBE_REGIONS=NA,EU,SAM LOCKER_PROBE_DIFFS=normal,hard \
 *   LOCKER_PROBE_SEASONS=2 LOCKER_PROBE_SEEDS=2 LOCKER_PROBE_ARMS=off,zero,on \
 *   LOCKER_PROBE_OUT=out.json node ../../../node_modules/vitest/vitest.mjs run src/store/lockerRoom.probe.test.ts
 *
 * LOCKER_PROBE_ERA=N starts a takeover at era N (needs NEXT_PUBLIC_REAL_ORG_START=1).
 * LOCKER_PROBE_ANSWER=accept|refuse|lapse: how the bot answers talks (default lapse).
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAREER_LOCKER, FEATURES } from "@/config/balance";
import { dayOfWeekOf } from "@/engine/career/calendar";
import * as Locker from "@/engine/career/lockerRoom";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { playArcCareer } from "./careerArcBot";
import * as Flow from "./careerFlow";
import { createCareerSave } from "./careerFlow";
import { answerLockerTalkFlow } from "./lockerRoomFlow";
import { seriesOfUser } from "@/engine/career/lockerRoomFacts";

const env = process.env;
const ON = env.LOCKER_PROBE === "1";
const REGIONS = (env.LOCKER_PROBE_REGIONS ?? "EU").split(",") as Region[];
const DIFFS = (env.LOCKER_PROBE_DIFFS ?? "normal").split(",") as CareerDifficulty[];
const SEEDS = Number(env.LOCKER_PROBE_SEEDS ?? 1);
const SEED0 = Number(env.LOCKER_PROBE_SEED0 ?? 0);
const SEASONS = Number(env.LOCKER_PROBE_SEASONS ?? 2);
const ARMS = (env.LOCKER_PROBE_ARMS ?? "on").split(",") as Arm[];
const ERA = env.LOCKER_PROBE_ERA === undefined ? null : Number(env.LOCKER_PROBE_ERA);
const ANSWER = (env.LOCKER_PROBE_ANSWER ?? "lapse") as "accept" | "refuse" | "lapse";
const POLICY = (env.LOCKER_PROBE_POLICY ?? "tuned") as "tuned" | "autopilot";

type Arm = "off" | "zero" | "on";
type MoodId = Locker.MoodId;
const MOODS: MoodId[] = ["angry", "unhappy", "neutral", "content", "delighted"];

/** The mood a screen shows for a player (rc9: the stored, hysteresis-held mood when the engine has it). */
function shownMood(save: CareerSave, id: string): MoodId {
  const view = (Locker as Record<string, unknown>).shownMoodOf as ((s: Locker.LockerRoomState | null | undefined, id: string) => MoodId) | undefined;
  return view ? view(save.lockerRoom, id) : Locker.moodOf(Locker.moraleOf(save.lockerRoom, id));
}

/** The team match bonus the locker room gives the fielded trio (rc9; 0 before it existed). */
function matchBonus(save: CareerSave): number {
  const f = (Flow as Record<string, unknown>).lockerMatchBonusFor as ((s: CareerSave, ids: readonly string[]) => number) | undefined;
  return f ? f(save, save.starterIds) : 0;
}

function takeoverAt(region: Region, difficulty: CareerDifficulty, seed: number): CareerSave | null {
  if (ERA === null) return null;
  const world = computeStars(buildWorldAtCreation(seed, ERA), { seasonIndex: ERA, careerSeed: seed, difficulty });
  const list = realOrgChoicesFor(region, { careerSeed: seed, seasonIndex: ERA, difficulty, world });
  const pick = list[env.LOCKER_PROBE_PICK === undefined ? Math.floor(list.length / 3) : Math.min(list.length - 1, Number(env.LOCKER_PROBE_PICK))];
  if (!pick) return null;
  return createCareerSave(
    { identity: { orgName: pick.name, abbrev: "ORG", managerName: "Bot", country: pick.country, region, crestId: "shield", colors: { primary: "#f97316", secondary: "#fff" }, buffType: "offense" }, difficulty, rosterKey: "balanced", realOrgRef: pick.ref, startSeasonIndex: ERA },
    seed,
  );
}

interface SeasonTally {
  season: number;
  playerWeeks: Record<MoodId, number>;
  moodChanges: number;
  flaps: number;
  players: number;
  reasons: Record<string, number>;
  talks: Record<string, number>;
  /** The fielded trio's match bonus, sampled each Monday. */
  bonusAtEvents: number[];
  /** Every squad player's morale, sampled each Monday. */
  morale: number[];
  /** The user's official series: count, wins, and the wins the ratings expected (Σ p). */
  series: number;
  wins: number;
  expected: number;
  regionRank: number;
  majors: number;
  worlds: string | null;
  titles: number;
}

const blankSeason = (season: number): SeasonTally => ({
  season,
  playerWeeks: { angry: 0, unhappy: 0, neutral: 0, content: 0, delighted: 0 },
  moodChanges: 0,
  flaps: 0,
  players: 0,
  reasons: {},
  talks: {},
  bonusAtEvents: [],
  morale: [],
  series: 0,
  wins: 0,
  expected: 0,
  regionRank: 0,
  majors: 0,
  worlds: null,
  titles: 0,
});

function answerTalks(save: CareerSave): CareerSave {
  if (ANSWER === "lapse" || !save.lockerRoom) return save;
  let out = save;
  for (const t of Locker.openTalksOf(save.lockerRoom)) {
    const pick = ANSWER === "accept" ? t.answers[0] : t.answers[t.answers.length - 1];
    const r = answerLockerTalkFlow(out, t.id, pick);
    if (!r.error) out = r.save;
  }
  return out;
}

function runCareer(region: Region, difficulty: CareerDifficulty, seed: number, arm: Arm) {
  const flags = FEATURES as Record<string, unknown>;
  const L = CAREER_LOCKER as unknown as Record<string, unknown>;
  const wasFlag = flags.lockerRoom;
  const savedMatch = { ...(L.match as Record<string, unknown> | undefined) };
  flags.lockerRoom = arm !== "off";
  if (arm === "zero" && L.match) (L.match as Record<string, unknown>).enabled = false;
  // LOCKER_PROBE_MATCH='{"byMood":{...},"teamMax":0.5}': a candidate match table for the "on" arm.
  if (arm === "on" && L.match && env.LOCKER_PROBE_MATCH) {
    const over = JSON.parse(env.LOCKER_PROBE_MATCH) as Record<string, unknown>;
    const m = L.match as Record<string, unknown>;
    Object.assign(m, over, over.byMood ? { byMood: { ...(m.byMood as object), ...(over.byMood as object) } } : {});
  }
  const seasons = new Map<number, SeasonTally>();
  const lastMood = new Map<string, { mood: MoodId; week: number; prev?: MoodId; prevWeek?: number }>();
  const seenLog = new Set<string>();
  const seenTalks = new Set<string>();
  try {
    const from = takeoverAt(region, difficulty, seed);
    const career = playArcCareer({
      region,
      difficulty,
      policy: POLICY,
      seed,
      seasons: SEASONS,
      budgetMs: 1_800_000,
      ...(from ? { startFrom: from } : {}),
      lockerDay: answerTalks,
      onEvent: (save) => {
        const ev = save.activeEvent;
        if (!ev || ev.def.teamSize) return;
        const tally = seasons.get(save.clock.seasonIndex) ?? blankSeason(save.clock.seasonIndex);
        seasons.set(save.clock.seasonIndex, tally);
        // The raw rating expectation (no difficulty shift), so the calibration stays visible.
        for (const s of seriesOfUser(ev.tournament)) {
          tally.series += 1;
          tally.wins += s.won ? 1 : 0;
          tally.expected += s.p;
        }
      },
      onDay: (save) => {
        const si = save.clock.seasonIndex;
        const tally = seasons.get(si) ?? blankSeason(si);
        seasons.set(si, tally);
        const st = save.lockerRoom;
        if (st) {
          for (const e of st.log) {
            const key = `${e.playerId}:${e.reason}:${e.delta}:${e.morale}:${e.on.seasonIndex}:${e.on.day}`;
            if (seenLog.has(key)) continue;
            seenLog.add(key);
            tally.reasons[e.reason] = (tally.reasons[e.reason] ?? 0) + Math.abs(e.delta);
          }
          for (const t of st.talks) {
            if (seenTalks.has(t.id)) continue;
            seenTalks.add(t.id);
            tally.talks[t.topic] = (tally.talks[t.topic] ?? 0) + 1;
          }
        }
        if (dayOfWeekOf(save.clock.day) !== 1) return;
        const week = si * 32 + Math.floor((save.clock.day - 1) / 7);
        tally.players = Math.max(tally.players, save.squad.length);
        tally.bonusAtEvents.push(matchBonus(save));
        for (const p of save.squad) tally.morale.push(Locker.moraleOf(save.lockerRoom, p.id));
        for (const p of save.squad) {
          const mood = shownMood(save, p.id);
          tally.playerWeeks[mood] += 1;
          const was = lastMood.get(p.id);
          if (was && was.mood !== mood) {
            tally.moodChanges += 1;
            if (was.prev === mood && was.prevWeek !== undefined && week - was.prevWeek <= 2) tally.flaps += 1;
            lastMood.set(p.id, { mood, week, prev: was.mood, prevWeek: was.week });
          } else if (!was) lastMood.set(p.id, { mood, week });
        }
      },
    });
    for (const row of career.seasons) {
      const tally = seasons.get(row.seasonIndex) ?? blankSeason(row.seasonIndex);
      tally.regionRank = row.regionRank;
      tally.majors = row.majorsQualified;
      tally.worlds = row.worlds;
      tally.titles = row.titles;
      seasons.set(row.seasonIndex, tally);
    }
    return { region, difficulty, seed, arm, ended: career.ended, softlock: career.softlock, seasons: [...seasons.values()].sort((a, b) => a.season - b.season) };
  } finally {
    flags.lockerRoom = wasFlag;
    if (L.match) Object.assign(L.match as Record<string, unknown>, savedMatch);
  }
}

/**
 * LOCKER_PRICE=1: the match bonus priced as a title chance. A Sunday bracket
 * (quarters Bo5, semis Bo7, final Bo7) against opponents a step stronger each
 * round (the rc.37 F6 briefing probe's model), for a favourite, an even side and
 * an underdog, with the team bonus at each value of CAREER_LOCKER.match.
 */
describe.skipIf(env.LOCKER_PRICE !== "1")("rc9 LOCKER match bonus as title odds", () => {
  it("prices each team bonus", async () => {
    const { simulateSeries } = await import("@/engine/match");
    const { createRng } = await import("@/lib/rng");
    const N = Number(env.LOCKER_PRICE_N ?? 20000);
    const team = (id: string, total: number) =>
      ({
        id, name: id, isUser: false, region: "EU", rating: { total, avgPlayerOverall: total, coachMod: 0, subMod: 0 },
        chemistry: { percent: 0 }, stats: { offense: 84, defense: 84, mechanics: 84, consistency: 84, experience: 84, clutch: 84 },
        specialIds: [], playerNames: [], orgId: id, rollRange: [-4, 4],
      }) as unknown as Parameters<typeof simulateSeries>[0];
    const win = (edge: number, bestOf: number, seed: number) => {
      const rng = createRng(seed);
      let w = 0;
      for (let i = 0; i < N; i++) {
        const r = simulateSeries(team("a", 85 + edge), team("b", 85), { bestOf, stage: "playoff", difficulty: "normal" }, rng);
        if (r.games.filter((g) => g.winnerTeamId === "a").length >= Math.ceil(bestOf / 2)) w++;
      }
      return w / N;
    };
    const title = (edge: number, step: number) =>
      [5, 7, 7].reduce((p, bo, i) => p * win(edge - step * i, bo, 20261127 + i), 1);
    const sides = [["strong favourite", 3, 1], ["favourite", 2, 1], ["even", 0.5, 0.75], ["underdog", -1, 0.75]] as const;
    const bonuses = [-1, -0.5, -0.25, 0.17, 0.25, 0.5, 0.75];
    const lines = [`N=${N} series per point; title % at bonus 0, then the change in points per bonus ${bonuses.join(" / ")}`];
    for (const [label, edge, stepUp] of sides) {
      const base = title(edge, stepUp);
      const cells = bonuses.map((b) => ((title(edge + b, stepUp) - base) * 100).toFixed(1));
      lines.push(`${label} (edge ${edge}) | ${(base * 100).toFixed(1)}% | ${cells.join(" / ")}`);
    }
    if (env.LOCKER_PROBE_TXT) writeFileSync(env.LOCKER_PROBE_TXT, lines.join("\n") + "\n");
    console.log(lines.join("\n"));
    expect(lines.length).toBe(sides.length + 1);
  }, 3_600_000);
});

describe.skipIf(!ON)("rc9 LOCKER probe", () => {
  it(
    "logs the locker room week by week",
    () => {
      const out: ReturnType<typeof runCareer>[] = [];
      const lines: string[] = [];
      // The repo's vitest config swallows console output: the report goes to a file as well.
      const log = (line: string) => {
        lines.push(line);
        console.log(line);
        if (env.LOCKER_PROBE_TXT) writeFileSync(env.LOCKER_PROBE_TXT, lines.join("\n") + "\n");
      };
      for (const region of REGIONS)
        for (const difficulty of DIFFS)
          for (let k = SEED0; k < SEED0 + SEEDS; k++)
            for (const arm of ARMS) {
              const seed = 9100 + k * 7919;
              const t0 = Date.now();
              const r = runCareer(region, difficulty, seed, arm);
              out.push(r);
              log(`${region} ${difficulty} seed ${seed} ${arm}: ${r.seasons.length} seasons, ended ${r.ended ?? "-"}, ${Math.round((Date.now() - t0) / 1000)}s`);
              for (const s of r.seasons) {
                const total = MOODS.reduce((n, m) => n + s.playerWeeks[m], 0) || 1;
                const spread = MOODS.map((m) => `${m[0]}${Math.round((s.playerWeeks[m] / total) * 100)}`).join(" ");
                const reasons = Object.entries(s.reasons).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k2, v]) => `${k2}:${v}`).join(" ");
                const bonus = s.bonusAtEvents.length
                  ? `${(s.bonusAtEvents.reduce((a, b) => a + b, 0) / s.bonusAtEvents.length).toFixed(2)} [${Math.min(...s.bonusAtEvents)}, ${Math.max(...s.bonusAtEvents)}]`
                  : "-";
                const m = s.morale;
                const mean = m.length ? m.reduce((a, b) => a + b, 0) / m.length : 0;
                const sd = m.length ? Math.sqrt(m.reduce((a, b) => a + (b - mean) ** 2, 0) / m.length) : 0;
                log(
                  `     morale mean ${mean.toFixed(1)} sd ${sd.toFixed(1)} range ${m.length ? Math.min(...m) : "-"}..${m.length ? Math.max(...m) : "-"} | series ${s.series} won ${s.wins} expected ${s.expected.toFixed(1)}`,
                );
                log(
                  `  S${s.season} rank ${s.regionRank} majors ${s.majors} worlds ${s.worlds ?? "-"} titles ${s.titles} | moods % ${spread} | changes ${s.moodChanges} (${s.players} players) flaps ${s.flaps} | talks ${JSON.stringify(s.talks)} | bonus avg ${bonus} | ${reasons}`,
                );
              }
              if (env.LOCKER_PROBE_OUT) writeFileSync(env.LOCKER_PROBE_OUT, JSON.stringify(out, null, 1));
            }
      // Per region × difficulty × arm, by season of the career: mean rank, titles, majors, Worlds titles, careers still running.
      log("== summary: region diff arm | per career season: rank / titles / majors / worlds titles / bonus | ended");
      const groups = new Map<string, typeof out>();
      for (const r of out) {
        const k = `${r.region} ${r.difficulty} ${r.arm}`;
        groups.set(k, [...(groups.get(k) ?? []), r]);
      }
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
      for (const [k, rs] of groups) {
        const cells: string[] = [];
        for (let i = 0; i < SEASONS; i++) {
          const ss = rs.map((r) => r.seasons[i]).filter(Boolean);
          const bonus = avg(ss.flatMap((s) => s.bonusAtEvents));
          cells.push(
            `S+${i}: ${avg(ss.map((s) => s.regionRank)).toFixed(1)} / ${avg(ss.map((s) => s.titles)).toFixed(2)} / ${avg(ss.map((s) => s.majors)).toFixed(2)} / ${ss.filter((s) => s.worlds === "champion").length} / ${bonus.toFixed(2)} (n ${ss.length})`,
          );
        }
        log(`${k} | ${cells.join(" | ")} | ended ${rs.filter((r) => r.ended).length}/${rs.length}`);
      }
      expect(out.length).toBeGreaterThan(0);
    },
    7_200_000,
  );
});
