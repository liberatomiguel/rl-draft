/**
 * Road to Worlds — RTW-04 (rc.33, Miguel 30/10): "fewer known players
 * without a team: it should happen, but much less often than now".
 *
 * rc.32's cause, in the world sim: the creation free-agent pool held every
 * real player without a Season X card — 72 careers that had ended before
 * 2020-21, 44 of them rated 80+, at their peak — and the first window's
 * scavenger pass signed them onto active rosters, pushing about 20 active
 * Season X pros into free agency; later, every player the anchor pass pushed
 * out when his real org moved on stayed a free agent for years.
 *  - CAREER_WORLD.creationFreeAgentRecentSeasons: only a recent career (or
 *    one that resumes later) seeds the pool;
 *  - CAREER_WORLD.historyOverFreeAgentLeaveChance: at each dataset rollover a
 *    real free agent whose history is over leaves the scene with this chance.
 */

import { describe, expect, it } from "vitest";
import { CAREER_SEASONS, CAREER_WORLD } from "@/config/balance";
import { lineupById, playerCards, seasonById } from "@/data";
import { firstDayOfWeek } from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import { agePassAndIntake, buildWorldAtCreation } from "@/engine/career/worldSim";
import { advanceDayFlow, createCareerSave, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Pool Test",
    abbrev: "POO",
    managerName: "Bot",
    country: "BR",
    region: "EU",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

/** Each real player's club card season orders (FIFAe nations left out, as the world does). */
const orders = new Map<string, number[]>();
for (const c of playerCards) {
  if (lineupById.get(c.lineupId)?.national) continue;
  const o = seasonById.get(c.seasonId)?.order ?? 0;
  orders.set(c.playerId, [...(orders.get(c.playerId) ?? []), o]);
}
const seasonX = CAREER_SEASONS[0];
const last = (id: string) => Math.max(...(orders.get(id) ?? [0]));
const isReal = (id: string) => !id.includes(":");

describe("RTW-04 — the creation pool", () => {
  it("takes no real player whose career ended before Season X − creationFreeAgentRecentSeasons", () => {
    const recent = CAREER_WORLD.creationFreeAgentRecentSeasons!;
    expect(recent).not.toBeNull();
    const world = buildWorldAtCreation(9100);
    const reals = world.freeAgentIds.filter(isReal);
    for (const id of reals) expect(last(id), id).toBeGreaterThanOrEqual(seasonX.order - recent);
    // rc.32 seeded 66 of them; a handful remain.
    expect(reals.length).toBeLessThan(20);
  });

  it("switch back: null seeds every real player without a Season X card (rc.32)", () => {
    const W = CAREER_WORLD as { creationFreeAgentRecentSeasons: number | null };
    const saved = W.creationFreeAgentRecentSeasons;
    try {
      W.creationFreeAgentRecentSeasons = null;
      expect(buildWorldAtCreation(9100).freeAgentIds.filter(isReal).length).toBeGreaterThan(50);
    } finally {
      W.creationFreeAgentRecentSeasons = saved;
    }
  });

  it("the first window no longer swaps active Season X pros out for retired stars (the real flow)", () => {
    let save: CareerSave = createCareerSave(INPUT, 9100);
    const target = firstDayOfWeek(3);
    for (let guard = 0; guard < 30 && save.clock.day < target; guard++) save = advanceDayFlow(save);
    expect(save.clock.day).toBe(target);
    const seasonXPros = new Set(
      playerCards.filter((c) => c.seasonId === seasonX.seasonId && !lineupById.get(c.lineupId)?.national).map((c) => c.playerId),
    );
    const idle = save.world.freeAgentIds.filter((id) => seasonXPros.has(id));
    // rc.32: 21–26 active pros were free agents by week 3.
    expect(idle.length).toBeLessThanOrEqual(8);
  });
});

/**
 * A Season X world with two groups of its pros moved into free agency (a
 * fresh filler keeps each seat): those whose last club card is Season X —
 * their history is over at the 2021-22 rollover — and those who play on.
 */
function poolWorld(seed: number) {
  const world = buildWorldAtCreation(seed);
  const rostered = Object.values(world.orgs).flatMap((o) => o.playerIds).filter(isReal);
  const done = rostered.filter((id) => last(id) === seasonX.order);
  const continuing = rostered.filter((id) => last(id) > seasonX.order + 1).slice(0, 30);
  const moved = new Set([...done, ...continuing]);
  let n = 0;
  for (const org of Object.values(world.orgs)) {
    org.playerIds = org.playerIds.map((id) => (moved.has(id) ? `fic:${org.region}:${900_000 + n++}` : id)) as [string, string, string];
  }
  world.freeAgentIds.push(...moved);
  return { world, done, continuing };
}

describe("RTW-04 — players whose history is over leave free agency", () => {
  it("at a dataset rollover more of them leave than the age window alone retires; a player with history ahead never does", () => {
    const { world, done, continuing } = poolWorld(17019);
    expect(done.length).toBeGreaterThan(20);
    const next = agePassAndIntake(structuredClone(world), 1, 17019, [], false).world;
    const gone = (ids: string[]) => ids.filter((id) => next.retiredIds.includes(id)).length;
    // At least the leave chance's share goes (the age window takes some on its own too).
    expect(gone(done) / done.length).toBeGreaterThan(CAREER_WORLD.historyOverFreeAgentLeaveChance - 0.2);
    expect(gone(continuing)).toBe(0);
  });

  it("chance 0 keeps them (rc.32): only the age window retires", () => {
    const W = CAREER_WORLD as { historyOverFreeAgentLeaveChance: number };
    const saved = W.historyOverFreeAgentLeaveChance;
    const { world, done } = poolWorld(17019);
    try {
      W.historyOverFreeAgentLeaveChance = 0;
      const ageOnly = agePassAndIntake(structuredClone(world), 1, 17019, [], false).world;
      W.historyOverFreeAgentLeaveChance = saved;
      const withLeave = agePassAndIntake(structuredClone(world), 1, 17019, [], false).world;
      const gone = (w: typeof world) => done.filter((id) => w.retiredIds.includes(id)).length;
      expect(gone(withLeave)).toBeGreaterThan(gone(ageOnly) + done.length * 0.2);
    } finally {
      W.historyOverFreeAgentLeaveChance = saved;
    }
  });
});
