/**
 * v2.2 board front — the seat swap: the user takes an AI org's seat (a
 * takeover at creation, a job offer) or founds a new club, and the club he
 * leaves lives on as an AI org with the squad he built. Pure on a save the
 * caller has cloned (mutates it).
 *
 * World rules (R-BOARD): the org the user runs is not an AI side — it leaves
 * `world.orgs` and a fresh filler takes its seat, so every region keeps its
 * AI count (the rc.47 soft lock came from a region short of orgs). Its
 * dataset future never reaches the user's squad: the preseason anchor pass
 * skips an org that is not in the world, and `realOrgIntake` never re-enters
 * `world.userOrgRef`. The players the dataset sends to that org later stay
 * where they are (their club or free agency). The club left behind re-enters
 * the world in the place of its region's weakest filler.
 */

import { CAREER_GEAR, FEATURES } from "@/config/balance";
import { inheritedGearFor, structureWeeklyOf } from "./established";
import { startAchievementBaseline } from "./achievements";
import type { Region } from "../types";
import { playerViewById } from "./development";
import { quantize, weeklyWageBill } from "./economy";
import { abbrevFor, datasetCoachOf, orgMoneyFor, statureOfOrg, takeoverSquadOf, type OrgMoney, type ProfileKey, profileOf } from "./orgProfile";
import { computeStars, fillerOrgName, nextFillerId } from "./worldSim";
import type { Stature } from "./boardTypes";
import type { CareerSave, GearState, SquadPlayer, WorldOrgState, WorldState } from "./types";

const ratingOf = (o: WorldOrgState) => o.rating ?? 70 + o.prestige * 6;

function viewCtx(save: CareerSave) {
  return { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
}

/** A squad player going back to the world must resolve there (careerFlow.keepInWorld's rule). */
function keepInWorld(save: CareerSave, p: SquadPlayer): void {
  if (save.world.formerSquad?.[p.id] === undefined && playerViewById(p.id, viewCtx(save)) !== null) return;
  const { name, country, region, birthYear, archetype, overall, attrOffsets, potential, peakAge, declineRate } = p;
  save.world.formerSquad = {
    ...(save.world.formerSquad ?? {}),
    [p.id]: { name, ...(country !== undefined ? { country } : {}), region, birthYear, archetype, overall, attrOffsets: { ...attrOffsets }, potential, peakAge, declineRate },
  };
  delete save.world.overallDelta[p.id];
}

function toFreeAgency(world: WorldState, ids: readonly string[]): void {
  for (const id of ids) if (id && !world.freeAgentIds.includes(id)) world.freeAgentIds.push(id);
}

/** Three fresh filler ids for a region (reserved, as realOrgIntake mints them). */
function freshFillerIds(world: WorldState, region: Region): [string, string, string] {
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const id = nextFillerId(region, world);
    ids.push(id);
    world.freeAgentIds.push(id);
  }
  world.freeAgentIds = world.freeAgentIds.filter((id) => !ids.includes(id));
  return ids as [string, string, string];
}

function prestigeForRep(rep: number): WorldOrgState["prestige"] {
  return rep >= 60 ? 3 : rep >= 40 ? 2 : rep >= 20 ? 1 : 0;
}

/**
 * The user leaves his seat. `leaveBehind`: his club stays in the world as an
 * AI org (its starters, his coach's quality), in the place of its region's
 * weakest filler; otherwise (a takeover at creation: the placeholder squad)
 * everyone goes to free agency. The squad is emptied either way.
 */
export function leaveSeat(save: CareerSave, leaveBehind: boolean): string | null {
  const world = save.world;
  for (const p of save.squad) keepInWorld(save, p);
  let leftRef: string | null = null;
  if (leaveBehind && save.squad.length > 0) {
    const region = save.identity.region;
    const ref = save.identity.realOrgRef ?? `club:${save.clock.seasonIndex}:${save.seq + 1}`;
    save.seq += 1;
    const starters = save.starterIds.filter((id) => save.squad.some((p) => p.id === id));
    for (const p of save.squad) if (starters.length < 3 && !starters.includes(p.id)) starters.push(p.id);
    while (starters.length < 3) {
      const fa = world.freeAgentIds.find((id) => playerViewById(id, viewCtx(save))?.region === region);
      const id = fa ?? nextFillerId(region, world);
      world.freeAgentIds = world.freeAgentIds.filter((x) => x !== id);
      starters.push(id);
    }
    toFreeAgency(world, save.squad.map((p) => p.id).filter((id) => !starters.includes(id)));
    const victim = Object.values(world.orgs)
      .filter((o) => o.region === region && o.ref.startsWith("fill:"))
      .sort((a, b) => ratingOf(a) - ratingOf(b) || a.ref.localeCompare(b.ref))[0];
    if (victim) {
      delete world.orgs[victim.ref];
      toFreeAgency(world, [...victim.playerIds, ...(victim.reserveIds ?? [])]);
    }
    const prestige = prestigeForRep(save.reputation);
    world.orgs[ref] = {
      ref,
      name: save.identity.orgName,
      region,
      prestige,
      playerIds: [starters[0], starters[1], starters[2]],
      ...(save.coach ? { coachOverall: save.coach.overall } : {}),
      stars: prestige,
      ...(victim?.rating !== undefined ? { rating: victim.rating } : {}),
    };
    world.freeAgentIds = world.freeAgentIds.filter((id) => !starters.includes(id));
    if (save.identity.realOrgRef && !(world.userBuiltRefs ?? []).includes(ref)) world.userBuiltRefs = [...(world.userBuiltRefs ?? []), ref];
    leftRef = ref;
  } else {
    toFreeAgency(world, save.squad.map((p) => p.id));
  }
  save.squad = [];
  save.starterIds = ["", "", ""];
  save.coach = null;
  delete world.userOrgRef;
  world.version += 1;
  return leftRef;
}

function gearFor(count: number): GearState {
  const ids = CAREER_GEAR.items.map((i) => i.id).filter((id) => id === "peripherals" || id === "monitors" || id === "pcs");
  return {
    peripherals: ids.slice(0, count).includes("peripherals"),
    monitors: ids.slice(0, count).includes("monitors"),
    pcs: ids.slice(0, count).includes("pcs"),
    perfCenter: false,
    psychologist: false,
  };
}

/** The per-club state a new seat starts clean (sponsor, books, bids, lists). */
function resetClubState(save: CareerSave, balance: number, gear: GearState): void {
  save.finances = {
    balance,
    ledger: [],
    loan: null,
    loanUsed: false,
    gear,
    bootcampSharp: 0,
    bootcampUsedThisSplit: false,
    freeBootcampsUsedThisSeason: 0,
  };
  save.sponsor = null;
  save.sponsorOffers = null;
  delete save.sponsorDemotedSlot;
  save.foundingPartner = null;
  save.pendingOffers = [];
  save.transferList = [];
  save.tradeProposals = [];
  save.bidsThisWindow = 0;
  save.pendingUnavailability = null;
  save.scheduledScrims = [];
  save.moneyNotices = [];
  save.parkedDecisions = [];
  delete save.dayOne;
  save.foundingSquadIds = [];
}

export interface SeatTaken {
  stature: ProfileKey;
  money: OrgMoney;
}

/**
 * The user takes AI org `ref`'s seat: its roster (on the market's asks), its
 * dataset coach when the data has one, its name and region; its money and
 * reputation from its stature. A fresh filler takes the org's place in the
 * world. Null (nothing changed) when the org or a player does not resolve.
 */
export function takeOrgSeat(save: CareerSave, ref: string): SeatTaken | null {
  const world = save.world;
  const org = world.orgs[ref];
  const stature: Stature | null = statureOfOrg(world, ref);
  if (!org || !stature) return null;
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, difficulty: save.difficulty, world };
  const squad = takeoverSquadOf(ref, stature, ctx);
  if (!squad) return null;
  const coach = datasetCoachOf(ref, save.clock.seasonIndex, save.difficulty, save.world.eraStart);
  const usable = coach && !(save.retiredCoachIds ?? []).includes(coach.id) ? coach : null;

  delete world.orgs[ref];
  toFreeAgency(world, org.reserveIds ?? []);
  world.freeAgentIds = world.freeAgentIds.filter((id) => !org.playerIds.includes(id));
  const k = 100 + Object.keys(world.orgs).filter((r) => r.startsWith(`fill:${org.region}:`)).length;
  let fillRef = `fill:${org.region}:${k}`;
  for (let n = k; world.orgs[fillRef]; n++) fillRef = `fill:${org.region}:${n + 1}`;
  world.orgs[fillRef] = {
    ref: fillRef,
    name: fillerOrgName(org.region, k, save.careerSeed, world.nameBankVersion ?? 1),
    region: org.region,
    prestige: 0,
    playerIds: freshFillerIds(world, org.region),
    stars: 0,
  };
  world.userOrgRef = ref;
  world.version += 1;

  save.identity = { ...save.identity, orgName: org.name, abbrev: abbrevFor(org.name), region: org.region, realOrgRef: ref };
  save.squad = squad;
  save.starterIds = [squad[0].id, squad[1].id, squad[2].id];
  save.coach = usable;
  const profile = profileOf(stature);
  save.reputation = Math.max(profile.rep, 0);
  const week = weeklyWageBill(squad.map((p) => p.salaryPerSplit), usable?.salaryPerSplit ?? null);
  // rc.6 (ORGMODE E2): the org arrives with its installations and its retained staff; rc.6 (R169): its cash
  // and budget are weeks of its whole running bill (wages + that structure), so the retainers are funded.
  const gear = FEATURES.realOrgStart ? inheritedGearFor(stature) : gearFor(profile.gear);
  const running = FEATURES.realOrgStart ? week + structureWeeklyOf(gear, save.clock.seasonIndex) : week;
  const money = orgMoneyFor(stature, week, save.difficulty, save.clock.seasonIndex, running);
  resetClubState(save, money.startCash, gear);
  save.world = computeStars(world, { seasonIndex: save.clock.seasonIndex, careerSeed: save.careerSeed, difficulty: save.difficulty });
  return { stature, money };
}

/**
 * "Found a new club" after a dismissal: a new project in the home region,
 * signed from its three best free agents on their asks, a name from the
 * region's org bank, the founding budget of its difficulty.
 */
export function foundNewSeat(save: CareerSave, name: string): SeatTaken | null {
  const world = save.world;
  const region = save.identity.region;
  const ctx = viewCtx(save);
  const views = world.freeAgentIds
    .map((id) => playerViewById(id, ctx))
    .filter((v): v is NonNullable<typeof v> => v !== null && v.region === region)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))
    .slice(0, 3);
  if (views.length < 3) return null;
  // Borrow the takeover's squad builder through a temporary org.
  const tmp = `club:new:${save.clock.seasonIndex}`;
  world.orgs[tmp] = { ref: tmp, name, region, prestige: 0, playerIds: [views[0].id, views[1].id, views[2].id], stars: 0 };
  const squad = takeoverSquadOf(tmp, "owners", { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, difficulty: save.difficulty, world });
  delete world.orgs[tmp];
  if (!squad) return null;
  world.freeAgentIds = world.freeAgentIds.filter((id) => !squad.some((p) => p.id === id));
  world.version += 1;
  delete world.userOrgRef;
  const { realOrgRef: _gone, ...identity } = save.identity;
  void _gone;
  save.identity = { ...identity, orgName: name, abbrev: abbrevFor(name) };
  save.squad = squad;
  save.starterIds = [squad[0].id, squad[1].id, squad[2].id];
  save.coach = null;
  save.reputation = profileOf("owners").rep;
  // rc.6 (R171): the founded road's permanent achievements count from here, nothing earned before.
  startAchievementBaseline(save, save.clock.seasonIndex);
  const week = weeklyWageBill(squad.map((p) => p.salaryPerSplit), null);
  const money = orgMoneyFor("owners", week, save.difficulty, save.clock.seasonIndex);
  resetClubState(save, quantize(money.startCash), gearFor(0));
  return { stature: "owners", money };
}
