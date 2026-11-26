/**
 * v2.2 Pro spine (PROSPINE, slice 3, PRO-SPEC §7.2): the amateur side.
 *
 * A local side calls the Pro: two teammates near his level, named from the
 * local scene's banks. The side is not a world org; it takes the manager's
 * "user" seat in the cups and the Open Qualifier through the hidden host
 * (store/proFlow), so its points, fields and series are the calendar's own.
 * Everything here is pure and seeded with cursor-free `derivedFloat` streams
 * under "pro:team:", so a draw added later never moves an earlier one.
 */

import { CAREER_PRO, CAREER_PRO_TEAM } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { StatKey } from "../../types";
import { ageOf, seasonYear } from "../development";
import { localPlayerNames, localRef, localTeamName } from "../localScene";
import { derivedFloat } from "../seeds";
import type { ArchetypeId, SquadPlayer } from "../types";
import { PRO_STAT_KEYS, proOverall, round2 } from "./attrs";
import type { ProAmateurSide, ProOffer } from "./spineTypes";
import type { ProPlayer, ProSave } from "./types";
import { rankedOpensCups } from "./spineBridge";
import { PRO_SELF_ID } from "./world";

const ARCHETYPES: ArchetypeId[] = ["allround", "mechanical", "playmaker", "anchor", "icecold", "veteranmind"];

/** Local refs of a far season: the names exist in the bank but are never fielded this season. */
const SIDE_SEASON_OFFSET = 500;

/** The squad entry of the Pro himself on the host (his attributes are the save's; the host never grows them). */
export function proSquadPlayer(player: ProPlayer, seasonIndex: number): SquadPlayer {
  const overall = proOverall(player.attrs);
  const attrOffsets = {} as Record<StatKey, number>;
  for (const k of PRO_STAT_KEYS) attrOffsets[k] = round2(player.attrs[k] - overall);
  return {
    id: PRO_SELF_ID,
    kind: "fictional",
    name: player.name,
    country: player.country,
    region: player.region,
    birthYear: player.birthYear,
    archetype: player.archetype,
    overall,
    attrOffsets,
    potential: overall,
    peakAge: player.peakAge,
    declineRate: player.declineRate,
    role: "starter",
    salaryPerSplit: 0,
    prizeSharePct: 0,
    contractEndSeason: seasonIndex + 99,
    trainingFocus: "auto",
    trainingIntensity: "normal",
    scoutLevel: 2,
    splitsTogether: 0,
    joinedSeason: seasonIndex,
    gainedThisSplit: 0,
    gainedThisSeason: 0,
  };
}

/** The two teammates of a side (ids "proam:<ref>:<k>", never in the world). */
export function amateurTeammates(save: Pick<ProSave, "careerSeed" | "clock" | "player" | "world">, side: ProAmateurSide): SquadPlayer[] {
  const names = localPlayerNames(side.ref, save.careerSeed, save.world.nameBankVersion);
  const region = save.player.region;
  const out: SquadPlayer[] = [];
  for (let k = 0; k < 2; k++) {
    const u = (what: string) => derivedFloat(save.careerSeed, `pro:team:${side.ref}:${k}:${what}`);
    const overall = round2(clamp(side.level + (u("lvl") * 2 - 1) * CAREER_PRO_TEAM.teammateSpread, CAREER_PRO.attrMin, CAREER_PRO.attrMax));
    const age = 14 + Math.floor(u("age") * 4);
    const offsets = {} as Record<StatKey, number>;
    for (const s of PRO_STAT_KEYS) offsets[s] = round2((u(`off:${s}`) * 2 - 1) * 3);
    out.push({
      id: `proam:${side.ref}:${k}`,
      kind: "fictional",
      name: names[k] === save.player.name ? `${names[k]}.` : names[k],
      country: save.player.country,
      region,
      birthYear: seasonYear(save.clock.seasonIndex) - age,
      archetype: ARCHETYPES[Math.floor(u("arch") * ARCHETYPES.length) % ARCHETYPES.length],
      overall,
      attrOffsets: offsets,
      potential: round2(overall + CAREER_PRO_TEAM.teammateHeadroom),
      peakAge: 20,
      declineRate: "normal",
      role: "starter",
      salaryPerSplit: 0,
      prizeSharePct: 0,
      contractEndSeason: save.clock.seasonIndex + 99,
      trainingFocus: "auto",
      trainingIntensity: "normal",
      scoutLevel: 2,
      splitsTogether: 0,
      joinedSeason: save.clock.seasonIndex,
      gainedThisSplit: 0,
      gainedThisSeason: 0,
    });
  }
  return out;
}

/** The side's level: the mean of its teammates' overall (the host's live squad, or the level it called at). */
export function sideLevelOf(teammates: readonly Pick<SquadPlayer, "overall">[], fallback: number): number {
  if (teammates.length === 0) return fallback;
  return round2(teammates.reduce((s, p) => s + p.overall, 0) / teammates.length);
}

/**
 * The amateur call due this Monday, or null. A Pro without a side hears from
 * one once his overall reaches `inviteOverall` (from `firstInviteWeek`); a Pro
 * on a side hears from a better one when he has outgrown his mates by
 * `betterSideGap`. At most one call every `inviteEveryWeeks` weeks.
 */
export function amateurInviteFor(
  save: Pick<ProSave, "careerSeed" | "clock" | "player" | "world" | "stage" | "offers">,
  ctx: { week: number; currentLevel: number | null; seq: number; currentRef?: string | null },
): ProOffer | null {
  const { seasonIndex, day } = save.clock;
  if (save.stage !== "ranked" && save.stage !== "freeAgent" && save.stage !== "amateur") return null;
  if (seasonIndex === 0 && ctx.week < CAREER_PRO_TEAM.firstInviteWeek) return null;
  const overall = proOverall(save.player.attrs);
  if (!rankedOpensCups(save.player) && overall < CAREER_PRO_TEAM.inviteOverall) return null;
  if (save.stage === "amateur" && (ctx.currentLevel === null || overall - ctx.currentLevel < CAREER_PRO_TEAM.betterSideGap)) return null;
  const last = [...save.offers].reverse().find((o) => o.kind === "amateur");
  if (last) {
    const since = (seasonIndex - last.madeSeason) * 224 + (day - last.madeDay);
    if (since < CAREER_PRO_TEAM.inviteEveryWeeks * 7) return null;
  }
  if (save.offers.some((o) => o.kind === "amateur" && o.status === "open")) return null;
  // QA round: a side he declined (or let lapse) this season does not call again; the next slot of the pool does.
  const turnedDown = new Set(save.offers.filter((o) => o.kind === "amateur" && o.madeSeason === seasonIndex && o.status !== "open").map((o) => o.ref));
  const k0 = Math.floor(derivedFloat(save.careerSeed, `pro:team:side:${seasonIndex}:${ctx.week}`) * 8) % 8;
  let ref = localRef(save.player.region, SIDE_SEASON_OFFSET + seasonIndex, k0);
  for (let i = 1; i < 8 && (turnedDown.has(ref) || ref === ctx.currentRef); i++) ref = localRef(save.player.region, SIDE_SEASON_OFFSET + seasonIndex, (k0 + i) % 8);
  if (turnedDown.has(ref) || ref === ctx.currentRef) return null;
  const level = round2(overall + CAREER_PRO_TEAM.teammateOffset);
  const age = ageOf(save.player.birthYear, seasonIndex);
  return {
    id: `am:${seasonIndex}:${day}:${ctx.seq}`,
    kind: "amateur",
    ref,
    name: localTeamName(ref, save.careerSeed, save.world.nameBankVersion),
    level,
    salaryPerSplit: 0,
    lengthSeasons: 1,
    role: "starter",
    reason: { key: "level", params: { level: Math.floor(level), age } },
    madeSeason: seasonIndex,
    madeDay: day,
    expiresSeason: seasonIndex,
    expiresDay: Math.min(224, day + CAREER_PRO_TEAM.inviteDays),
    status: "open",
    counterRisk: 0,
  };
}
