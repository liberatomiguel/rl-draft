/**
 * Road to Worlds — the DAY machine (store-layer orchestration, v0.2).
 *
 * Pure-ish helpers that advance a CareerSave through the season one day at a
 * time: every function takes a save, works on a structuredClone draft, calls
 * PURE engine functions (src/engine/career/*) with derived seed streams, and
 * returns the new save. No React, no storage — the Zustand store
 * (careerStore.ts) is a thin shell over these.
 *
 * Day-arrival order (v0.2 day clock over the design §7 week grid):
 *  - MONDAY: split-start bookkeeping → scripted beats → transfer window (AI
 *    market + incoming bids) / offer expiry → major/worlds field resolution →
 *    upcoming-event commit (lobby opens on its matchday) + random-event roll →
 *    unofficial offer → split-boundary payday → contract telegraphs.
 *  - MON-FRI: the daily training tick (skipped on committed event weeks).
 *  - v2.0 (R40) THE WEEKEND — every event resolves on its own day, and an
 *    event the user is not playing resolves headlessly on its LAST day
 *    (`eventEndDayFor`); the user's committed event waits in the lobby
 *    (Advance stops there):
 *      regional week  SAT the qualifiers (Swiss only)   SUN the regionals
 *      Major / Worlds SAT lobby + Swiss stage           SUN the playoffs
 *      open week      SAT unofficial cups               SUN rest
 *    A two-day event the user plays PAUSES after its Swiss on Saturday
 *    (`isEventPaused`): the clock may then move to Sunday, where its
 *    playoffs play and `finishEvent` runs once.
 * Seed streams stay WEEK-keyed (each fires once per week) — the day clock
 * changes when things surface, never how they roll.
 */

import {
  CAREER_CALENDAR,
  CAREER_CONTRACT,
  CAREER_ECONOMY,
  CAREER_GEAR,
  CAREER_LOAN,
  CAREER_NEGOTIATION,
  CAREER_PAYROLL,
  CAREER_QUALIFIER,
  CAREER_REP,
  CAREER_SALARY,
  CAREER_SAVE,
  CAREER_SCOUT,
  CAREER_SCRIM,
  CAREER_SEASONS,
  CAREER_SPONSOR,
  CAREER_SUB,
  CAREER_TRAINING,
  CAREER_TRANSFER,
  CAREER_UNLOCKS,
  CAREER_UNOFFICIAL,
  CAREER_WORLD,
  TOURNAMENT,
} from "@/config/balance";
import { SITE } from "@/config/site";
import { CAREER_BEATS } from "@/data/career/beats";
import { playerNameBankFor } from "@/data/career/names";
import { simulateSeries } from "@/engine/match";
import {
  asSwissOnly,
  atPlayoffsStart,
  initFieldTournament,
  playNextRound,
  userHasPendingSeries,
} from "@/engine/tournament";
import { createRng } from "@/lib/rng";
import {
  DAYS_PER_SEASON,
  dayOfWeekOf,
  eventDayFor,
  eventEndDayFor,
  isTwoDayEvent,
  isWindowStartWeek,
  isWindowWeek,
  officialEventDefsForWeek,
  playoffsDayFor,
  qualifierDayFor,
  qualifierDefsForWeek,
  regionalDayFor,
  regionalForQualifier,
  seasonIdFor,
  seasonLabelFor,
  splitOfWeek,
  unofficialOfferFor,
  weekAt,
  weekOfDay,
  windowCloseDayFor,
  windowIndexOf,
} from "@/engine/career/calendar";
import {
  compileEventResult,
  applyResultToStandings,
  hasChampion,
  legacyGradeFor,
  majorFieldFor,
  placementOf,
  rankByPoints,
  seasonGoalsFor,
  seasonGradeFor,
  stabilityAssess,
  worldsFieldFor,
} from "@/engine/career/careerResults";
import {
  ageOf,
  applyMatchXp,
  autoDrillFor,
  becomesCoachOnRetirement,
  isCompetitiveAge,
  drillEffectFor,
  fieldQualityFor,
  playerViewById,
  seasonYear,
  signsForFinalSeason,
  squadRollover,
  trainDay,
  trainWeek,
  trainingProjection,
  type DrillEffect,
} from "@/engine/career/development";
import { insertById } from "@/data/career/inserts";
import { insertDowFor, rollInsertFor } from "@/engine/career/inserts";
import {
  applyPrize,
  applyTransferIncome,
  backerLineFor,
  backerTopUp,
  bankLoanRefusal,
  bootcampCostFor,
  bootcampTierFor,
  breachOutcomeFor,
  computeSalaryAsk,
  debtPaymentFor,
  eventRepKindFor,
  foundingPartnerBaseFor,
  foundingPartnerEnds,
  gearNextItem,
  gearPriceFor,
  gearTrainingBonus,
  insertMoneyFor,
  loanBreachesOf,
  marketValueFor,
  mondaysToBreach,
  negotiationAccepts,
  payBankLoanDown,
  payLoanDown,
  payrollProjection,
  playerShareFor,
  pushLedger,
  quantize,
  repGainFor,
  repLossFloor,
  repTierOf,
  runwayShortened,
  runwayWeeks,
  runwayWeeksAfter,
  scoutReportCostFor,
  severanceFor,
  signableOverallCap,
  sponsorOffersFor,
  standInFeeFor,
  t3RepKeyFor,
  takeBankLoan,
  unlocksFor,
  weeklyPayroll,
  weeklyStatement,
  weeklyWageBill,
  type BackerLine,
  type GearItemId,
  type WeeklyStatement,
} from "@/engine/career/economy";
import {
  aiWindowMoves,
  askPackageFor,
  coachCandidatesFor as marketCoachCandidates,
  contractedSplitsRemaining,
  fieldingBuyerFor,
  incomingBidForDay,
  listingOfferFor,
  listingWaitDaysFor,
  renewalAskFor,
  userBidsBlocked,
  type AskPackage,
} from "@/engine/career/market";
import { ACH_FLAGS } from "@/engine/career/achievements";
import { isLocalRef, localRegionOf, localTeamName } from "@/engine/career/localScene";
import { derivedFloat, deriveSeed, streams } from "@/engine/career/seeds";
import {
  agePassAndIntake,
  bestTrioRatingFor,
  buildWorldAtCreation,
  committedSeedingFor,
  computeStars,
  fieldForEvent,
  localSeedRowsFor,
  orgTeamFor,
  realOrgIntake,
  regionalSeedingFor,
  repairLegacyWorld,
  simulateAiEvent,
  starterRosterOffers,
  userTeamFor,
  type StarterOffer,
} from "@/engine/career/worldSim";
import type {
  CareerDifficulty,
  CareerEventDef,
  CareerIdentity,
  CareerPlayerView,
  CareerPrefs,
  CareerSave,
  CoachState,
  CompactEventResult,
  DrillId,
  MailItem,
  ManagementStyle,
  NewsItem,
  ScrimLogEntry,
  SeasonRecord,
  SquadPlayer,
  TransferLogEntry,
  TransferOffer,
} from "@/engine/career/types";
import type { Placement, Region, TournamentState } from "@/engine/types";

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function clone(save: CareerSave): CareerSave {
  return structuredClone(save);
}

export function nameOfRef(save: CareerSave, ref: string): string {
  if (ref === "user") return save.identity.orgName;
  return save.world.orgs[ref]?.name ?? (isLocalRef(ref) ? localTeamName(ref, save.careerSeed) : ref);
}

/**
 * Squad invariant (v0.1 fix): `starterIds` must always hold exactly three ids
 * that are ON the squad, and every player's `role` must match (in-lineup =
 * starter, else sub). Called after EVERY squad mutation, and by the store's
 * load-time self-heal — a stale starter id was crashing userTeamFor and
 * corrupting saves on the next write.
 */
export function syncSquadRoles(save: CareerSave): void {
  const ids = new Set(save.squad.map((p) => p.id));
  const starters: string[] = [];
  for (const id of save.starterIds) {
    if (ids.has(id) && !starters.includes(id)) starters.push(id);
  }
  for (const p of save.squad) {
    if (starters.length >= 3) break;
    if (!starters.includes(p.id)) starters.push(p.id);
  }
  save.starterIds = [starters[0] ?? "", starters[1] ?? "", starters[2] ?? ""] as [
    string,
    string,
    string,
  ];
  const starterSet = new Set(starters);
  for (const p of save.squad) {
    p.role = starterSet.has(p.id) ? "starter" : "sub";
  }
}

export function regionOfRef(save: CareerSave, ref: string): Region {
  if (ref === "user") return save.identity.region;
  // RTW-01 (R49): a local side's home is in its ref — its Major points bank
  // into ITS region's season table (it fell back to the user's region).
  return save.world.orgs[ref]?.region ?? localRegionOf(ref) ?? save.identity.region;
}

function nextSeq(save: CareerSave): number {
  save.seq = (save.seq ?? 0) + 1;
  return save.seq;
}

function pushNews(
  save: CareerSave,
  item: Omit<NewsItem, "id" | "seasonIndex" | "week" | "day" | "read">,
): void {
  save.news.unshift({
    id: `n:${nextSeq(save)}`,
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    read: false,
    ...item,
  });
  if (save.news.length > CAREER_SAVE.newsCap) save.news.length = CAREER_SAVE.newsCap;
}

/** v0.2 Inbox: actionable mail addressed to the manager. */
function pushMail(
  save: CareerSave,
  item: Omit<MailItem, "id" | "seasonIndex" | "day" | "read">,
): void {
  save.mail.unshift({
    id: `m:${nextSeq(save)}`,
    seasonIndex: save.clock.seasonIndex,
    day: save.clock.day,
    read: false,
    ...item,
  });
  if (save.mail.length > CAREER_SAVE.mailCap) save.mail.length = CAREER_SAVE.mailCap;
}

/** v0.3: append to the transfer wire (ring buffer, newest first). */
function logTransfer(
  save: CareerSave,
  entry: Omit<TransferLogEntry, "id" | "seasonIndex" | "day">,
): void {
  save.transferLog.unshift({
    id: `t:${nextSeq(save)}`,
    seasonIndex: save.clock.seasonIndex,
    day: save.clock.day,
    ...entry,
  });
  if (save.transferLog.length > CAREER_SAVE.transferLogCap) {
    save.transferLog.length = CAREER_SAVE.transferLogCap;
  }
}

function gainRep(save: CareerSave, kind: keyof typeof CAREER_REP.gains): void {
  const before = save.reputation;
  save.reputation = Math.min(100, save.reputation + repGainFor(kind, save.reputation));
  announceUnlockCrossings(save, before);
}

function loseRep(save: CareerSave, amount: number, reasonKey: string): void {
  const floor = repLossFloor(save.reputation, highestSponsorTierEarned(save));
  const next = Math.max(floor, save.reputation - amount);
  if (next < save.reputation) {
    save.reputation = next;
    pushNews(save, { type: "rep", priority: 2, titleKey: reasonKey, params: { org: save.identity.orgName } });
  }
}

function highestSponsorTierEarned(save: CareerSave): number {
  const gates = CAREER_SPONSOR.tiers.filter((t) => save.reputation >= t.repGate);
  return gates.length ? gates[gates.length - 1].tier : 0;
}

function announceUnlockCrossings(save: CareerSave, repBefore: number): void {
  const crossings: [number, string][] = [
    ...CAREER_GEAR.items.map((i): [number, string] => [i.repGate, i.id]),
    [CAREER_GEAR.bootcamp[0].repGate, "bootcamp1"],
    [CAREER_GEAR.bootcamp[1].repGate, "bootcamp2"],
    [CAREER_GEAR.psychologistRep, "psychologist"],
    [CAREER_UNLOCKS.coachRep, "coach"],
    [CAREER_UNLOCKS.t2InvitationalRep, "t2"],
    [CAREER_UNLOCKS.relocationRep, "relocation"],
  ];
  for (const [gate, key] of crossings) {
    if (repBefore < gate && save.reputation >= gate) {
      pushNews(save, { type: "org", priority: 2, titleKey: "unlock", params: { name: key } });
      pushMail(save, {
        kind: "unlock",
        titleKey: "unlock",
        bodyKey: "unlock",
        params: { name: key },
        fromKey: "board",
        linkTo: "/career/club",
      });
    }
  }
}

function isInfinite(save: CareerSave): boolean {
  return save.clock.seasonIndex >= CAREER_SEASONS.length;
}

/** R49: the season's first regional week (W4) — the local scene's anchor freezes on its Monday. */
const FIRST_REGIONAL_WEEK =
  Array.from({ length: CAREER_CALENDAR.weeksPerSeason }, (_, i) => i + 1).find(
    (w) => weekAt(w).kind === "regional",
  ) ?? 1;

/**
 * rc.30 (direct-8): the user's seeding rating — the team rating HQ and the
 * squad screen show (the fielded trio with chemistry, coach and gear), on the
 * scale of the orgs' stored intrinsic ratings it is ranked against. It
 * replaced the starters' plain average, which sat on another scale.
 */
export function userSeedRatingFor(save: CareerSave): number {
  return userTeamFor({
    identity: save.identity,
    squad: save.squad,
    starterIds: save.starterIds,
    coach: save.coach,
    gear: save.finances.gear,
    bootcampSharp: save.finances.bootcampSharp,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
    unavailablePlayerId: null,
  }).team.rating.total;
}

/**
 * RTW-01 (R49): what the user's region's local scene is rated around — the
 * squad's best trio (worldSim.bestTrioRatingFor: userTeamFor's own team
 * rating with chemistry, coach and gear), never the lineup the user fields
 * nor the bootcamp edge. Frozen on the season's first regional Monday
 * (`competition.localAnchor`), so a lineup swap or an armed bootcamp on the
 * eve of the freeze cannot soften the season's local sides.
 */
export function localAnchorRatingFor(save: CareerSave): number {
  return bestTrioRatingFor({
    identity: save.identity,
    squad: save.squad,
    coach: save.coach,
    gear: save.finances.gear,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
  });
}

/**
 * Today's seeding of the user's region: stored fields + the user's current
 * team rating. R49: local sides holding split points race for the direct 8 too.
 */
function liveUserSeeding(save: CareerSave): { direct: string[]; rest: string[] } {
  const region = save.identity.region;
  return regionalSeedingFor({
    orgs: Object.values(save.world.orgs).filter((o) => o.region === region),
    splitPoints: save.competition.splitPoints[region] ?? {},
    user: { rating: userSeedRatingFor(save), prestige: repTierOf(save.reputation) },
    locals: localSeedRowsFor({
      world: save.world,
      competition: save.competition,
      region,
      careerSeed: save.careerSeed,
    }),
  });
}

/**
 * v2.0 (R30): the user's regional seeding for `week` of the current season
 * (default: the week holding the clock) — split points → prestige → rating,
 * the rule the engine fields with. rc.30 (direct-8): a regional week's
 * Monday commits it (`competition.weekSeeding`) and that decision answers
 * for the rest of the week; any other week previews it live.
 */
export function userSeedingFor(
  save: CareerSave,
  week: number = weekOfDay(save.clock.day),
): { direct: string[]; rest: string[] } {
  return (
    committedSeedingFor(save.competition, {
      region: save.identity.region,
      seasonIndex: save.clock.seasonIndex,
      week,
    }) ?? liveUserSeeding(save)
  );
}

/** True when the user holds one of the split's direct regional slots on `week` (default: this week). */
export function userIsDirect(save: CareerSave, week?: number): boolean {
  return userSeedingFor(save, week).direct.includes("user");
}

/** The user's own result for an event, when they played it (and it is still on file). */
function userResultFor(save: CareerSave, eventId: string): CompactEventResult | null {
  return save.eventResults.find((r) => r.eventId === eventId && r.userPlacement) ?? null;
}

/**
 * v2.0 (R30): may the user play this regional? Direct, or through the
 * qualifier (R40: Saturday → Sunday's regional); a regional whose qualifier
 * was played without the user making it is off. Regionals without qualifier
 * data (pre-2.0 saves mid-season) stay open, as before.
 * R40 review: the week's commit and results outrank today's seeding — a
 * committed, in-progress or played regional is the user's, and a qualifier
 * the user PLAYED decides (through → yes, out → no) even if the seeding has
 * drifted across the direct-8 line since (the flow resolves it the same way).
 */
export function regionalUserEligible(save: CareerSave, def: CareerEventDef): boolean {
  if (def.tier !== "regional" || def.region !== save.identity.region) return false;
  if (isUsersOwnEvent(save, def) || userResultFor(save, def.id)) return true;
  const q = qualifierDefsForWeek(def.seasonIndex, def.week).find((d) => d.region === def.region);
  const played = q ? userResultFor(save, q.id) : null;
  if (played) return played.userPlacement !== "swiss_exit";
  if (userIsDirect(save, def.week)) return true;
  const qualified = save.competition.qualifiedRefs?.[def.region];
  if (!qualified || qualified.eventId !== def.id) return true;
  return qualified.refs.includes("user");
}

/**
 * v2.0 (R40): is this own-region qualifier the user's? For the week holding
 * the clock (and earlier weeks) the commit decides — the qualifier committed
 * on Monday (outside the direct 8), in progress or played — never today's
 * seeding: a user committed direct who drifts out of the 8 still plays
 * Sunday, while Saturday's qualifier resolves without them. Future weeks
 * preview with today's seeding (outside the direct 8 → the qualifier).
 */
export function userOwnsQualifier(save: CareerSave, def: CareerEventDef): boolean {
  if (def.tier !== "qualifier" || def.region !== save.identity.region) return false;
  if (isUsersOwnEvent(save, def) || userResultFor(save, def.id)) return true;
  const committed =
    def.seasonIndex < save.clock.seasonIndex ||
    (def.seasonIndex === save.clock.seasonIndex && def.week <= weekOfDay(save.clock.day));
  return !committed && !userIsDirect(save, def.week);
}

/**
 * v2.0 (R40): the user-relevant event occupying `day` — committed, in
 * progress or scheduled (the agenda / calendar / next-stop source):
 *  - the own-region qualifier on Saturday (`userOwnsQualifier`: this week's
 *    commit or result; future weeks preview a user outside the direct 8 of
 *    the CURRENT split standings — the honest preview);
 *  - the own regional on Sunday, until a played qualifier rules the user out
 *    (`regionalUserEligible`);
 *  - a Major / Worlds on BOTH weekend days — `def.day` (Saturday, Swiss) and
 *    `playoffsDayFor(def)` (Sunday, Championship Sunday) — spectators too.
 * Compare `day` with `def.day` / `playoffsDayFor(def)` to tell the phase.
 * rc.30 (SEAM-1): an event the user already PLAYED never lands on a day ahead
 * of the clock — a save from before rc.28 played its qualifier midweek (or
 * its regional, or a whole Major, on Saturday), and the re-timed weekend day
 * still to come is not a stop.
 */
export function userEventDefOnDay(save: CareerSave, day: number): CareerEventDef | null {
  const playedAhead = (def: CareerEventDef) => day > save.clock.day && userResultFor(save, def.id) !== null;
  const covers = (def: CareerEventDef) =>
    (day === def.day || day === eventEndDayFor(def)) && !playedAhead(def);
  const active = save.activeEvent?.def;
  if (active && covers(active)) return active;
  const pending = save.pendingEventDef;
  if (pending && covers(pending)) return pending;
  const week = weekOfDay(day);
  const seasonIndex = save.clock.seasonIndex;
  // The user's committed / in-progress event lands only on its OWN day(s)
  // (matched above) — a pre-R40 event still running keeps the day it really
  // started, and never shows again on the re-timed weekend day.
  if (day === qualifierDayFor(week)) {
    const q = qualifierDefsForWeek(seasonIndex, week).find((d) => d.region === save.identity.region);
    if (q && !isUsersOwnEvent(save, q) && !playedAhead(q) && userOwnsQualifier(save, q)) return q;
  }
  for (const def of officialEventDefsForWeek(seasonIndex, week)) {
    if (!covers(def) || isUsersOwnEvent(save, def)) continue;
    if (def.tier === "regional") {
      if (def.region !== save.identity.region) continue;
      return regionalUserEligible(save, def) ? def : null;
    }
    return def;
  }
  return null;
}

function userQualifiedFor(save: CareerSave, def: CareerEventDef): boolean {
  if (def.tier === "regional") return regionalUserEligible(save, def);
  if (def.tier === "qualifier") return def.region === save.identity.region && !userIsDirect(save, def.week);
  if (def.tier === "major") return save.competition.majorFieldRefs?.includes("user") ?? false;
  if (def.tier === "worlds") return save.competition.worldsFieldRefs?.includes("user") ?? false;
  return true; // unofficials are invitations
}

// ---------------------------------------------------------------------------
// rc.32 money reads (ECONOMY-CONTRACT M1 / M3 / M4 — provisional): ONE source
// for the Monday funnel, the screens, the bot and the probe
// ---------------------------------------------------------------------------

/** The founding partner's base this split (0 = none, ended or switched off). */
export function foundingPartnerPerSplitOf(save: CareerSave): number {
  return foundingPartnerBaseFor(save.foundingPartner, save.clock.seasonIndex);
}

/** The weekly statement of THIS save — what the next Monday books (economy.weeklyStatement). */
export function weeklyStatementOf(save: CareerSave): WeeklyStatement {
  return weeklyStatement({
    squadSalaries: save.squad.map((p) => ({ name: p.name, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    sponsor: save.sponsor,
    rep: save.reputation,
    gear: save.finances.gear,
    bankLoan: save.finances.bankLoan ?? null,
    seasonIndex: save.clock.seasonIndex,
    foundingPartnerPerSplit: foundingPartnerPerSplitOf(save),
  });
}

/** The Backer's floor and rescue target on this save's wage bill (economy.backerLineFor). */
export function backerLineOf(save: CareerSave): BackerLine {
  return backerLineFor(
    weeklyWageBill(
      save.squad.map((p) => p.salaryPerSplit),
      save.coach?.salaryPerSplit ?? null,
    ),
    save.clock.seasonIndex,
  );
}

/** Has the org ever signed a real sponsor deal (the founding partner's end condition)? */
function realDealSigned(save: CareerSave): boolean {
  return Boolean(save.flags[ACH_FLAGS.sponsorSigned]) || save.sponsor !== null;
}

/**
 * M4 (decision 4-B — provisional): while the Backer is owed, would this
 * decision shorten the runway? `upfront` = its one-off cost, `weeklyCost` =
 * the weekly cost it adds (negative = a saving). False when the lock is off
 * (CAREER_LOAN.lockCommitments) or nothing is owed.
 */
export function backerLocks(save: CareerSave, upfront: number, weeklyCost: number): boolean {
  if (!CAREER_LOAN.lockCommitments || !save.finances.loan) return false;
  const net = weeklyStatementOf(save).net;
  const now = runwayWeeks(save.finances.balance, net);
  const after = runwayWeeksAfter({ balance: save.finances.balance, weeklyNet: net, upfront, weeklyChange: -weeklyCost });
  return runwayShortened(now, after);
}

/**
 * M3 (decision 3-A — provisional): the founding partner, sized on the wage
 * bill per split right now (squad + coach) in this season's money. Called on
 * the founding day and by the load backfill; announced once in the inbox.
 */
function openFoundingPartner(save: CareerSave): void {
  const wageBillPerSplit = save.squad.reduce((n, p) => n + p.salaryPerSplit, save.coach?.salaryPerSplit ?? 0);
  save.foundingPartner = { wageBillPerSplit, sizedSeason: save.clock.seasonIndex };
  pushMail(save, {
    kind: "sponsor",
    titleKey: "foundingPartner",
    bodyKey: "foundingPartner",
    params: {
      base: foundingPartnerPerSplitOf(save),
      pct: Math.round(CAREER_SPONSOR.founding.payrollShare * 100),
      through: seasonLabelFor(CAREER_SPONSOR.founding.throughSeasonIndex),
    },
    fromKey: "sponsor",
    linkTo: "/career/finances",
  });
}

/** M3: the founding partner steps back (its end condition met) — a mail says so. */
function closeFoundingPartner(save: CareerSave): void {
  if (!save.foundingPartner) return;
  save.foundingPartner = { ...save.foundingPartner, endedSeason: save.clock.seasonIndex };
  pushMail(save, {
    kind: "sponsor",
    titleKey: "foundingPartnerEnds",
    bodyKey: "foundingPartnerEnds",
    params: {},
    fromKey: "sponsor",
    linkTo: "/career/finances",
  });
}

/** M8: drop listings whose player left the squad (sold, released, retired, out of contract). */
function pruneListings(save: CareerSave): void {
  if (!save.saleListings || save.saleListings.length === 0) return;
  const ids = new Set(save.squad.map((p) => p.id));
  save.saleListings = save.saleListings.filter((l) => ids.has(l.playerId));
}

/** rc.32: a Blockbuster bid the user refused (declined or let expire) surcharges that deal's renewal. */
function stampBlockbusterRefusal(save: CareerSave, offer: TransferOffer): void {
  if (!offer.blockbuster || offer.direction !== "out") return;
  const player = save.squad.find((p) => p.id === offer.playerId);
  if (player) player.blockbusterRefusedUntil = player.contractEndSeason;
}

// ---------------------------------------------------------------------------
// Day arrival — the heart of Advance (v0.2 day clock)
// ---------------------------------------------------------------------------

export function processDayArrival(input: CareerSave): CareerSave {
  const save = clone(input);
  const { seasonIndex, day } = save.clock;
  const week = weekOfDay(day);
  const dow = dayOfWeekOf(day);
  const cal = weekAt(week);

  // =========================== MONDAY =====================================
  if (dow === 1) {
    save.scrimsThisWeek = 0;

    // --- 0. split START bookkeeping (weeks 3 / 13 / 23) --------------------
    if (week === 3 || week === 13 || week === 23) {
      for (const region of Object.keys(save.competition.splitPoints) as Region[]) {
        save.competition.splitPoints[region] = {};
      }
      save.competition.majorFieldRefs = null;
      save.competition.squadAtSplitStart = save.squad.map((p) => p.id);
      save.competition.newFacesThisSplit = [];
      save.competition.stabilityTierApplied = 0;
      save.t3EntriesThisSplit = 0;
      if (save.sponsor) {
        save.sponsor.progress = 0;
        save.sponsor.hitThisSplit = false;
      }
    }

    // --- 0a. rc.32 (M3, provisional): the founding partner opens on the founding day.
    if (seasonIndex === 0 && day === 1 && save.foundingPartner === undefined && CAREER_SPONSOR.founding.enabled) {
      openFoundingPartner(save);
    }

    // --- 0b. v2.0 WEEKLY PAYROLL (R20) — every Monday but the founding day --
    if (!(seasonIndex === 0 && week === 1)) {
      runWeeklyPayroll(save);
      if (save.phase === "ended") return capNews(save);
    }

    // --- 1. scripted beats --------------------------------------------------
    if (!isInfinite(save)) {
      for (const beat of CAREER_BEATS) {
        if (beat.trigger.seasonIndex !== seasonIndex || beat.trigger.week !== week) continue;
        if (save.firedBeatIds.includes(beat.id)) continue;
        save.firedBeatIds.push(beat.id);
        const targetOnSquad =
          beat.requiresPlayerFree && save.squad.some((p) => p.id === beat.requiresPlayerFree);
        // ECO-03b (ROADMAP, R47): the career's first window is bid-free — a
        // Blockbuster for a user-owned target there reads as preempted instead.
        const bidFree = userBidsBlocked(seasonIndex, windowIndexOf(week));
        if (targetOnSquad && beat.degradeToOffer && beat.requiresPlayerFree && !bidFree) {
          // Degrade into a Blockbuster incoming bid for the user-owned target.
          const player = save.squad.find((p) => p.id === beat.requiresPlayerFree)!;
          const fee = quantize(
            marketValueFor({
              overall: player.overall,
              age: ageOf(player.birthYear, seasonIndex),
              potential: player.potential,
              seasonIndex,
            }) * CAREER_TRANSFER.blockbusterFeeMult,
          );
          const toOrg = beat.effect?.forceTransfer.toOrgRef;
          save.pendingOffers.push({
            id: `bid:${beat.id}`,
            direction: "out",
            playerId: player.id,
            playerName: player.name,
            fee,
            salaryPerSplit: 0,
            lengthSeasons: 2,
            role: "starter",
            otherRef: toOrg,
            status: "pending",
            resolveSeason: seasonIndex,
            resolveDay: Math.min(DAYS_PER_SEASON, day + 2 * CAREER_CALENDAR.daysPerWeek),
            factors: [],
            blockbuster: true,
          });
          pushNews(save, { type: "beat", priority: 3, titleKey: "beat", beatId: beat.id });
          // rc.32 (Miguel, 30/10): the mail explains the bid — the scripted
          // moment behind it, the fee multiple, the renewal cost of refusing.
          pushMail(save, {
            kind: "offer",
            titleKey: "blockbusterBid",
            bodyKey: "blockbusterBid",
            params: {
              player: player.name,
              org: toOrg ? nameOfRef(save, toOrg) : "?",
              fee,
              mult: CAREER_TRANSFER.blockbusterFeeMult,
              pct: Math.round((CAREER_SALARY.blockbusterRefusalRenewalMult - 1) * 100),
            },
            fromKey: "agent",
            linkTo: "/career/market",
          });
        } else if (targetOnSquad) {
          pushNews(save, { type: "beat", priority: 3, titleKey: "beatPreempted", beatId: beat.id });
        } else {
          if (beat.effect?.forceTransfer && beat.requiresPlayerFree) {
            const { playerId, toOrgRef } = beat.effect.forceTransfer;
            const view = playerViewById(playerId, {
              careerSeed: save.careerSeed,
              seasonIndex,
              world: save.world,
            });
            forceTransferInWorld(save, playerId, toOrgRef);
            if (view) {
              logTransfer(save, {
                playerId,
                playerName: view.name,
                fromRef: null,
                toRef: toOrgRef,
                fee: 0,
                kind: "beat",
                region: regionOfRef(save, toOrgRef),
              });
            }
          }
          pushNews(save, { type: "beat", priority: 3, titleKey: "beat", beatId: beat.id });
        }
      }
    }

    // --- 2. transfer window: AI market + incoming bids ----------------------
    const windowIdx = windowIndexOf(week);
    if (windowIdx !== null) {
      if (isWindowStartWeek(week)) {
        pushNews(save, { type: "window", priority: 1, titleKey: "windowOpen" });
        // v0.3: per-window incoming-bid bookkeeping resets on open.
        save.bidsThisWindow = 0;
        save.lastBidDay = -99;
      }
      const { world, transfers } = aiWindowMoves(save.world, {
        seasonIndex,
        windowIdx,
        week,
        careerSeed: save.careerSeed,
        userSquadIds: save.squad.map((p) => p.id),
        isPreseason: windowIdx === 0,
        infinite: isInfinite(save),
      });
      save.world = world;
      // v0.3: every AI move lands on the transfer wire (HQ window panel).
      for (const t of transfers) {
        logTransfer(save, {
          playerId: t.playerId,
          playerName: t.playerName,
          fromRef: t.fromRef,
          toRef: t.toRef,
          fee: t.fee,
          kind: t.fromRef ? "fee" : "fa",
          region: regionOfRef(save, t.toRef),
        });
      }
      const shown = transfers.slice(0, 3);
      for (const t of shown) {
        pushNews(save, {
          type: "transfer",
          priority: 1,
          titleKey: t.fromRef ? "transferFee" : "transferFa",
          params: {
            player: t.playerName,
            from: t.fromRef ? nameOfRef(save, t.fromRef) : "",
            to: nameOfRef(save, t.toRef),
            fee: t.fee,
          },
        });
      }
      if (transfers.length > shown.length) {
        pushNews(save, {
          type: "transfer",
          priority: 0,
          titleKey: "digest",
          params: { n: transfers.length - shown.length },
        });
      }
    }

    // --- 2b. v0.3 window-close report (first Monday after a window shuts) --
    if (windowIndexOf(week) === null && week >= 2 && windowIndexOf(week - 1) !== null) {
      emitWindowReport(save, week - 1);
    }

    // --- 3. field announcements (major week / worlds window Monday) --------
    if (cal.kind === "major" && !save.competition.majorFieldRefs) {
      save.competition.majorFieldRefs = majorFieldFor(save.competition, save.careerSeed);
      if (save.competition.majorFieldRefs.includes("user")) {
        gainRep(save, "majorQualify");
        if (save.sponsor?.objectiveKind === "majorQualify") save.sponsor.hitThisSplit = true;
        pushNews(save, { type: "milestone", priority: 2, titleKey: "qualifiedMajor" });
      } else {
        pushNews(save, { type: "milestone", priority: 2, titleKey: "missedMajor" });
        if (save.reputation >= CAREER_REP.lossMajorMissAtRep) {
          loseRep(save, CAREER_REP.lossMajorMiss, "repDown");
        }
      }
    }
    if (week === CAREER_CALENDAR.worldsWindowWeek && !save.competition.worldsFieldRefs) {
      save.competition.worldsFieldRefs = worldsFieldFor(save.competition, save.careerSeed);
      if (save.competition.worldsFieldRefs.includes("user")) {
        gainRep(save, "worldsQualify");
        save.stats.worldsQualified += 1;
        pushNews(save, { type: "milestone", priority: 3, titleKey: "qualifiedWorlds" });
      } else {
        pushNews(save, { type: "milestone", priority: 2, titleKey: "missedWorlds" });
        if (save.reputation >= CAREER_REP.lossWorldsMissAtRep) {
          loseRep(save, CAREER_REP.lossWorldsMiss, "repDown");
        }
      }
    }

    // --- 4. this week's user event commit + unofficial offer ---------------
    save.pendingEventDef = null;
    save.unofficialOffer = null;

    const defs = officialEventDefsForWeek(seasonIndex, week);
    // v2.0 (R30 → R40): on a regional week, a user outside the direct 8 plays
    // the SATURDAY qualifier first — Sunday's regional only lands if they get
    // through. A direct user commits straight to the Sunday regional.
    const qualifier = qualifierDefsForWeek(seasonIndex, week).find(
      (q) => q.region === save.identity.region,
    );
    // RTW-01 (R49): the user's region's local scene is rated around the
    // squad's best trio as it stands on the season's first regional Monday,
    // for the whole season (the Saturday qualifier, Sunday, a Major, Worlds,
    // the cups) — the lineup fielded and an armed bootcamp never move it. A
    // save from before rc.31 freezes it on its next Monday.
    if (!save.competition.localAnchor && week >= FIRST_REGIONAL_WEEK) {
      save.competition.localAnchor = { region: save.identity.region, rating: localAnchorRatingFor(save) };
    }
    // rc.30 (direct-8): the week's seeding is decided ONCE, here, and stored —
    // Saturday, Sunday, the lobby and HQ read this decision, never a re-seed.
    if (qualifier) {
      const seeding = liveUserSeeding(save);
      save.competition.weekSeeding = { seasonIndex, week, region: save.identity.region, ...seeding };
    }
    if (qualifier && !userIsDirect(save)) {
      save.pendingEventDef = qualifier;
      rollUnavailability(save, qualifier);
    } else {
      for (const def of defs) {
        const isUsers =
          userQualifiedFor(save, def) &&
          (def.tier !== "regional" || def.region === save.identity.region);
        if (isUsers) {
          save.pendingEventDef = def;
          rollUnavailability(save, def);
        }
      }
    }

    if (!save.pendingEventDef && (cal.kind === "open" || cal.kind === "preseason")) {
      const userRating = approxUserRating(save);
      const offer = unofficialOfferFor(seasonIndex, week, {
        userTeamRating: userRating,
        rep: save.reputation,
        t3EntriesThisSplit: save.t3EntriesThisSplit,
        careerSeed: save.careerSeed,
      });
      if (offer) {
        save.unofficialOffer = offer;
        if (save.prefs.autoEnterUnofficials) {
          save.pendingEventDef = offer;
        }
      }
    }

    // --- 5. split boundary: sponsor objective + turnover (weeks 11/21/31) --
    if (week === 11 || week === 21 || week === CAREER_CALENDAR.worldsWindowWeek) {
      runSplitBoundary(save);
      if (save.phase === "ended") return capNews(save);
    }

    // --- 6. contract-expiry telegraph (final contract season, week 23) -----
    if (week === 23) {
      for (const p of save.squad) {
        if (p.contractEndSeason === seasonIndex) {
          pushNews(save, {
            type: "org",
            priority: 2,
            titleKey: "contractExpiring",
            params: { player: p.name },
          });
          pushMail(save, {
            kind: "contract",
            titleKey: "contractExpiring",
            bodyKey: "contractExpiring",
            params: { player: p.name },
            fromKey: "agent",
            linkTo: "/career/squad",
          });
        }
      }
    }
  }

  // ============ WINDOW DAYS: incoming-bid roll (v0.3, any day) =============
  const dayWindowIdx = windowIndexOf(week);
  if (dayWindowIdx !== null && save.phase === "running" && save.squad.length > 0) {
    const bid = incomingBidForDay({
      world: save.world,
      squad: save.squad,
      seasonIndex,
      windowIdx: dayWindowIdx,
      day,
      careerSeed: save.careerSeed,
      rep: save.reputation,
      bidsThisWindow: save.bidsThisWindow ?? 0,
      lastBidDay: save.lastBidDay ?? -99,
      pendingTargetIds: save.pendingOffers
        .filter((o) => o.status === "pending" && o.direction === "out")
        .map((o) => o.playerId),
    });
    if (bid) {
      save.bidsThisWindow = (save.bidsThisWindow ?? 0) + 1;
      save.lastBidDay = day;
      save.pendingOffers.push(bid);
      pushNews(save, {
        type: "transfer",
        priority: 2,
        titleKey: "incomingBid",
        params: { player: bid.playerName, org: bid.otherRef ? nameOfRef(save, bid.otherRef) : "?" },
      });
      pushMail(save, {
        kind: "offer",
        titleKey: "incomingBid",
        bodyKey: "incomingBid",
        params: {
          player: bid.playerName,
          org: bid.otherRef ? nameOfRef(save, bid.otherRef) : "?",
          fee: bid.fee,
        },
        fromKey: "agent",
        linkTo: "/career/market",
      });
    }
  }

  // ===== WINDOW DAYS: rc.32 (M8, provisional) — a listed player's offer =====
  // Each eligible window day counts a listing down; at zero an AI org that
  // would field him makes its offer. The career's bid-free first window (R47)
  // is not an eligible day.
  if (
    dayWindowIdx !== null &&
    save.phase === "running" &&
    CAREER_TRANSFER.listingEnabled &&
    (save.saleListings?.length ?? 0) > 0 &&
    !userBidsBlocked(seasonIndex, dayWindowIdx)
  ) {
    pruneListings(save);
    for (const listing of save.saleListings ?? []) {
      if (save.pendingOffers.some((o) => o.listing && o.playerId === listing.playerId)) continue;
      if (listing.waitDays > 0) listing.waitDays -= 1;
      if (listing.waitDays > 0) continue;
      const player = save.squad.find((p) => p.id === listing.playerId);
      const offer = player
        ? listingOfferFor({
            world: save.world,
            player,
            seasonIndex,
            windowIdx: dayWindowIdx as 0 | 1 | 2 | 3,
            day,
            careerSeed: save.careerSeed,
          })
        : null;
      if (!offer) continue;
      save.pendingOffers.push(offer);
      const org = offer.otherRef ? nameOfRef(save, offer.otherRef) : "?";
      pushNews(save, { type: "transfer", priority: 2, titleKey: "listingOffer", params: { player: offer.playerName, org } });
      pushMail(save, {
        kind: "offer",
        titleKey: "listingOffer",
        bodyKey: "listingOffer",
        params: { player: offer.playerName, org, fee: offer.fee },
        fromKey: "agent",
        linkTo: "/career/market",
      });
    }
  }

  // ==================== EVERY DAY: offer expiry ============================
  const beforeCount = save.pendingOffers.length;
  for (const offer of save.pendingOffers) {
    if (
      offer.status === "pending" &&
      offer.direction === "out" &&
      (save.clock.seasonIndex > offer.resolveSeason ||
        (save.clock.seasonIndex === offer.resolveSeason && day > offer.resolveDay))
    ) {
      offer.status = "expired";
      // rc.32: letting a Blockbuster lapse refuses it (the renewal surcharge);
      // a listing whose offer lapsed is over — he stays.
      stampBlockbusterRefusal(save, offer);
      if (offer.listing && save.saleListings) {
        save.saleListings = save.saleListings.filter((l) => l.playerId !== offer.playerId);
      }
    }
  }
  if (beforeCount > 0) {
    save.pendingOffers = save.pendingOffers.filter((o) => o.status === "pending");
  }

  // ==================== MON-FRI: scheduled scrims (v0.3) ===================
  if (save.phase === "running" && !save.activeEvent && save.scheduledScrims.length > 0) {
    const due = save.scheduledScrims.filter((s) => s.day === day);
    for (const s of due) performScrim(save, s.oppRef);
    save.scheduledScrims = save.scheduledScrims.filter((s) => s.day > day);
  }

  // ==================== MON-FRI: daily training tick =======================
  // v0.3: committed-event weeks are match-prep weeks — they now train at
  // matchPrepShare instead of freezing entirely (playing a weak-field event
  // must never develop players SLOWER than skipping it).
  if (dow <= CAREER_TRAINING.trainingDaysPerWeek) {
    const prep = save.pendingEventDef !== null;
    applyDailyTraining(
      save,
      (cal.kind === "open" || cal.kind === "preseason") && !prep,
      prep ? CAREER_TRAINING.matchPrepShare : 1,
    );
  }

  // ==================== TUE–THU (v2.0 R33: the weekly insert) ===============
  // One roll per week on the week's insert day; a card the player never
  // answers simply expires when its day passes (no penalty, no nag).
  if (save.pendingInsert && save.pendingInsert.day < day) save.pendingInsert = null;
  if (
    save.phase === "running" &&
    !save.pendingInsert &&
    dow === insertDowFor(save, week) &&
    !save.flags[`insertRolled:${seasonIndex}:${week}`]
  ) {
    save.flags[`insertRolled:${seasonIndex}:${week}`] = true;
    const def = rollInsertFor(save, week);
    if (def) {
      save.pendingInsert = { id: def.id, day };
      save.insertsSeen = [...(save.insertsSeen ?? []), def.id].slice(-12);
    }
  }

  // ============ THE WEEKEND (v2.0 R40: every event on its own day) ==========
  // SATURDAY of a regional week: every AI qualifier resolves (Swiss only); the
  // user's own — outside the direct 8 — waits in the lobby.
  if (day === qualifierDayFor(week)) {
    for (const q of qualifierDefsForWeek(seasonIndex, week)) {
      if (isUsersOwnEvent(save, q)) continue;
      resolveAiEvent(save, q);
    }
  }
  // An official event the user is not playing resolves on its LAST day: the
  // regionals on SUNDAY, an AI-only Major/Worlds on SUNDAY as well (its
  // champion and news land on Championship Sunday). The user's own regional
  // (direct or qualified), Major or Worlds waits in the lobby / is in progress.
  for (const def of officialEventDefsForWeek(seasonIndex, week)) {
    if (day !== eventEndDayFor(def) || isUsersOwnEvent(save, def)) continue;
    resolveAiEvent(save, def);
    // An unattended Worlds still closes the season (watch-party digest →
    // straight to the review; design §7 spectator weeks) — on the season's
    // last day (W32 Sunday = DAYS_PER_SEASON).
    if (def.tier === "worlds") {
      const worldsResult = save.eventResults.find((r) => r.eventId === def.id) ?? null;
      enterSeasonReview(save, worldsResult);
      return capNews(save);
    }
  }

  return capNews(save);
}

/**
 * v2.0 (R40): the user's OWN instance of an event — committed (lobby) or in
 * progress. The commit (Monday, or Saturday's qualifier → Sunday's regional)
 * is the authority: today's seeding never re-decides whose event it is.
 */
function isUsersOwnEvent(save: CareerSave, def: CareerEventDef): boolean {
  return save.pendingEventDef?.id === def.id || save.activeEvent?.def.id === def.id;
}

function capNews(save: CareerSave): CareerSave {
  if (save.news.length > CAREER_SAVE.newsCap) save.news.length = CAREER_SAVE.newsCap;
  return save;
}

/**
 * The starters' plain average overall — the unofficial-offer and scrim
 * matchmaking read (DEV-03 rebuilds scrims). Never the direct-8 seeding:
 * that is `userSeedRatingFor` (rc.30).
 */
function approxUserRating(save: CareerSave): number {
  const starters = save.squad.filter((p) => save.starterIds.includes(p.id));
  if (starters.length === 0) return 70;
  return starters.reduce((s, p) => s + p.overall, 0) / starters.length;
}

function rollUnavailability(save: CareerSave, def: CareerEventDef): void {
  const { seasonIndex, day } = save.clock;
  const week = weekOfDay(day);
  const split = splitOfWeek(week) ?? 3;
  // Novice guard + one-per-split cap.
  if (seasonIndex === 0 && split === 1) return;
  const usedKey = `unav:${seasonIndex}:${split}`;
  if (save.flags[usedKey]) return;
  if (def.tier === "t3" || def.tier === "t2") return; // officials only
  const rng = createRng(deriveSeed(save.careerSeed, streams.random(seasonIndex, week)));
  // Heavy training raises the telegraphed fatigue risk (v0.2 intensity).
  const heavyCount = save.squad.filter(
    (p) => save.starterIds.includes(p.id) && p.trainingIntensity === "heavy",
  ).length;
  const chance =
    CAREER_WORLD.unavailabilityChancePerWeek * CAREER_WORLD.unavailabilityEventMult +
    heavyCount * CAREER_TRAINING.heavyUnavailabilityAdd;
  if (!rng.chance(chance)) return;
  const starters = save.squad.filter((p) => save.starterIds.includes(p.id));
  if (starters.length < 3) return;
  const victim = rng.pick(starters);
  save.flags[usedKey] = true;
  save.pendingUnavailability = { playerId: victim.id, eventId: def.id };
  pushNews(save, {
    type: "org",
    priority: 2,
    titleKey: "unavailable",
    params: { player: victim.name, event: def.name },
  });
  // v0.3: this is exactly the kind of thing that must land on your desk.
  pushMail(save, {
    kind: "club",
    titleKey: "unavailable",
    bodyKey: "unavailable",
    params: { player: victim.name, event: def.name },
    fromKey: "staff",
    linkTo: "/career/squad",
  });
}

function resolveAiEvent(save: CareerSave, def: CareerEventDef): void {
  // v2.0 (R40): idempotent — an event already on file (a legacy save that
  // resolved it under the pre-R40 weekday layout, e.g. a midweek (day 3)
  // qualifier or a Saturday regional) is never simulated twice: no double
  // points or news.
  if (save.eventResults.some((r) => r.eventId === def.id)) return;
  // R40 review: the user's own-region qualifier resolves without them only
  // when they hold a direct seat in Sunday's regional (the week's commit) —
  // seed the region with the user in it, so the org the user displaced from
  // the direct 8 plays Saturday instead of missing both events.
  const regional = def.tier === "qualifier" ? regionalForQualifier(def) : null;
  // rc.30: the week's committed seeding (competition.weekSeeding) already
  // holds the user's row; this one only serves a week without it.
  const userSeedRow =
    regional && def.region === save.identity.region && isUsersOwnEvent(save, regional)
      ? { rating: userSeedRatingFor(save), prestige: repTierOf(save.reputation) }
      : null;
  const state = simulateAiEvent(def, {
    world: save.world,
    competition: save.competition,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
    userSeedRow,
  });
  const result = compileEventResult(def, state, {
    difficulty: save.difficulty,
    fieldQuality: 1,
    nameOf: (id) => nameOfRef(save, id),
  });
  ingestResult(save, result);
  if (def.tier === "major" || def.tier === "worlds") {
    pushNews(save, {
      type: "result",
      priority: 1,
      titleKey: "seasonChampion",
      params: { org: nameOfRef(save, result.championRef), event: def.name },
    });
  }
}

/**
 * Surface sponsor offers once the org has earned some standing (no day-1
 * sponsorship, v0.1 adjustment). Called at split boundaries and rollover.
 */
function maybeOfferSponsors(save: CareerSave): void {
  if (save.sponsor) return;
  if (save.sponsorOffers && save.sponsorOffers.length > 0) return;
  if (save.reputation < CAREER_SPONSOR.firstOfferRepGate) return;
  save.sponsorOffers = sponsorOffersFor(
    save.reputation,
    save.clock.seasonIndex,
    save.careerSeed,
    null,
    false,
    save.difficulty,
  );
  if (save.sponsorOffers.length > 0) {
    pushMail(save, {
      kind: "sponsor",
      titleKey: "sponsorOffers",
      bodyKey: "sponsorOffers",
      params: { n: save.sponsorOffers.length },
      fromKey: "sponsor",
      linkTo: "/career/finances",
    });
  }
}

function ingestResult(save: CareerSave, result: CompactEventResult): void {
  save.competition = applyResultToStandings(save.competition, result, (ref) =>
    regionOfRef(save, ref),
  );
  save.eventResults.push(result);
  if (save.eventResults.length > CAREER_SAVE.eventResultsCap) {
    // R40 review: the oldest rows go first — but never the user's OWN results
    // of the running season: the season review counts its Majors and titles
    // from this list (a season files ~130 results, mostly AI qualifiers and
    // regionals, so a plain FIFO dropped the split-1 Major before Worlds).
    const season = save.clock.seasonIndex;
    let excess = save.eventResults.length - CAREER_SAVE.eventResultsCap;
    save.eventResults = save.eventResults.filter((r) => {
      if (excess <= 0 || (r.seasonIndex === season && r.userPlacement)) return true;
      excess -= 1;
      return false;
    });
  }
}

/**
 * v2.0 (R27): the drill in force this week — the player's pick for THIS
 * week, else (when training is delegated) the coach's auto pick, else none.
 */
export function activeDrillFor(save: CareerSave): DrillEffect | null {
  const week = weekOfDay(save.clock.day);
  const chosen =
    save.drill && save.drill.seasonIndex === save.clock.seasonIndex && save.drill.week === week
      ? save.drill.id
      : null;
  if (chosen) return drillEffectFor(chosen);
  // Delegation needs a coach to delegate to (the Training screen's rule too).
  if (save.prefs.autoTrain && save.coach) return drillEffectFor(autoDrillFor(save.coach.bonusType, week));
  return null;
}

/** v2.0 (R27): choose this week's team drill (null clears it). */
export function setDrillFlow(input: CareerSave, id: DrillId | null): CareerSave {
  const save = clone(input);
  save.drill = id
    ? { seasonIndex: save.clock.seasonIndex, week: weekOfDay(save.clock.day), id }
    : null;
  return save;
}

function applyDailyTraining(save: CareerSave, trainingWeekBonus: boolean, weekShare = 1): void {
  const gearBonus = gearTrainingBonus(save.finances.gear);
  const drill = activeDrillFor(save);
  for (const p of save.squad) {
    const res = trainDay(
      p,
      {
        seasonIndex: save.clock.seasonIndex,
        coachOverall: save.coach?.overall ?? null,
        gearBonus,
        trainingWeekBonus,
        splitGained: p.gainedThisSplit,
        seasonGained: p.gainedThisSeason,
        drill,
      },
      weekShare,
    );
    Object.assign(p, res.player);
  }
}

/**
 * v0.3 window-close report: the first Monday after a window shuts mails a
 * digest of the market — volume, the biggest fees, where they landed — and
 * prunes that window's negotiation bookkeeping.
 */
function emitWindowReport(save: CareerSave, lastWindowWeek: number): void {
  const windowIdx = windowIndexOf(lastWindowWeek);
  if (windowIdx === null) return;
  const closeDay = lastWindowWeek * CAREER_CALENDAR.daysPerWeek;
  const spanWeeks = windowIdx === 3 ? 1 : CAREER_CALENDAR.windowWeeks;
  const fromDay = closeDay - spanWeeks * CAREER_CALENDAR.daysPerWeek;
  const moves = save.transferLog.filter(
    (t) => t.seasonIndex === save.clock.seasonIndex && t.day > fromDay && t.day <= closeDay,
  );
  // Prune the closed window's negotiation counters regardless of volume.
  const suffix = `:${save.clock.seasonIndex}:w${windowIdx}`;
  for (const k of Object.keys(save.negotiationTries ?? {})) {
    if (k.endsWith(suffix)) delete save.negotiationTries[k];
  }
  if (moves.length === 0) return;
  const top = [...moves].sort((a, b) => b.fee - a.fee).slice(0, 3);
  const line = (t: TransferLogEntry | undefined) =>
    t ? `${t.playerName} → ${t.toRef ? nameOfRef(save, t.toRef) : "FA"}` : "";
  pushNews(save, {
    type: "window",
    priority: 2,
    titleKey: "windowReport",
    params: { n: moves.length },
  });
  pushMail(save, {
    kind: "club",
    titleKey: "windowReport",
    bodyKey: "windowReport",
    params: {
      n: moves.length,
      p1: line(top[0]),
      f1: top[0]?.fee ?? 0,
      p2: line(top[1]),
      f2: top[1]?.fee ?? 0,
      p3: line(top[2]),
      f3: top[2]?.fee ?? 0,
    },
    fromKey: "league",
    linkTo: "/career",
  });
}

/**
 * v2.0 (R20): the Monday money funnel. Books the weekly statement through
 * economy.weeklyPayroll, then owns the consequences: Backer rescue news,
 * insolvency (career end), bank loan cleared, and the runway warning when
 * the balance covers only CAREER_PAYROLL.runwayWarnWeeks more Mondays.
 * rc.32 (provisional): the founding partner's end condition (M3), the
 * restructuring of a breach between the rescue and the last one (M4), and
 * the weekly warnings with the projected breach (M4).
 */
function runWeeklyPayroll(save: CareerSave): void {
  const { seasonIndex, day } = save.clock;
  const week = weekOfDay(day);
  // rc.32 (M3): past season index throughSeasonIndex with a real deal signed, the founding partner steps back.
  if (foundingPartnerEnds(save.foundingPartner, seasonIndex, realDealSigned(save))) closeFoundingPartner(save);
  const payroll = weeklyPayroll({
    fin: save.finances,
    squadSalaries: save.squad.map((p) => ({ name: p.name, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    sponsor: save.sponsor,
    rep: save.reputation,
    gear: save.finances.gear,
    seasonIndex,
    week,
    day,
    difficulty: save.difficulty,
    foundingPartnerPerSplit: foundingPartnerPerSplitOf(save),
  });
  save.finances = payroll.fin;
  if (payroll.bankCleared) {
    save.flags[ACH_FLAGS.bankCleared] = true;
    pushNews(save, { type: "org", priority: 2, titleKey: "bankCleared" });
    pushMail(save, {
      kind: "finance",
      titleKey: "bankCleared",
      bodyKey: "bankCleared",
      params: {},
      fromKey: "bank",
      linkTo: "/career/finances",
    });
  }
  if (payroll.rescued) {
    pushNews(save, { type: "org", priority: 3, titleKey: "backerIn" });
    pushMail(save, {
      kind: "finance",
      titleKey: "backerIn",
      bodyKey: "backerIn",
      // rc.32 (M4): the window it buys, what is owed and what the next breach means.
      params: {
        rescueTo: payroll.line.rescueTo,
        owed: save.finances.loan?.remaining ?? 0,
        weeks: CAREER_LOAN.sizing === "weeks" ? CAREER_LOAN.rescueToWeeks : 0,
        garnishPct: Math.round(CAREER_LOAN.garnishRate[save.difficulty] * 100),
        lock: CAREER_LOAN.lockCommitments ? 1 : 0,
        next: breachOutcomeFor(loanBreachesOf(save.finances) + 1, save.difficulty),
      },
      fromKey: "backer",
      linkTo: "/career/finances",
    });
  }
  if (payroll.insolvent) {
    endCareer(save, "insolvency");
    pushNews(save, { type: "org", priority: 3, titleKey: "insolvency" });
    return;
  }
  if (payroll.restructure) restructureAfterBreach(save);
  if (CAREER_PAYROLL.runwayWarnMode === "rc31") {
    const runway = runwayWeeks(save.finances.balance, payroll.statement.net);
    if (runway !== null && runway === CAREER_PAYROLL.runwayWarnWeeks && save.finances.balance > 0) {
      pushNews(save, {
        type: "org",
        priority: 2,
        titleKey: "cashWarning",
        params: { weeks: runway },
      });
      pushMail(save, {
        kind: "finance",
        titleKey: "cashWarning",
        bodyKey: "cashWarning",
        params: { weeks: runway, net: payroll.statement.net },
        fromKey: "accountant",
        linkTo: "/career/finances",
      });
    }
    return;
  }
  warnRunway(save, payroll.restructure ? weeklyStatementOf(save).net : payroll.statement.net);
}

/** Save flags of the M4 warnings: the 8-week notice sent, the 4-week news line sent (this squeeze). */
const RUNWAY_NOTICE_FLAG = "runwayNotice";
const RUNWAY_WARNED_FLAG = "runwayWarned";

/**
 * rc.32 M4 (decision 4-B — provisional): the accountant's warnings, read on
 * the Monday just booked. At ≤ runwayWarnWeeks of runway (the overdraft
 * included): a mail every Monday (the news line once a squeeze); once, when
 * it first drops to ≤ runwayNoticeWeeks: a notice. Each quotes the projected
 * breach (the Monday the books would close below the Backer's floor at this
 * net) and what that breach would mean; the copy carries the recovery
 * checklist. A runway back above the notice level re-arms both.
 */
function warnRunway(save: CareerSave, net: number): void {
  const balance = save.finances.balance;
  const runway = runwayWeeks(balance, net);
  if (runway === null || runway > CAREER_PAYROLL.runwayNoticeWeeks) {
    delete save.flags[RUNWAY_NOTICE_FLAG];
    delete save.flags[RUNWAY_WARNED_FLAG];
    return;
  }
  const line = backerLineOf(save);
  const mondays = mondaysToBreach(balance, net, line.floor) ?? 1;
  const breachWeek = weekOfDay(save.clock.day) + mondays;
  const nextSeason = breachWeek > CAREER_CALENDAR.weeksPerSeason;
  const params = {
    weeks: runway,
    net,
    burn: -net,
    mondays,
    breachWeek: nextSeason ? breachWeek - CAREER_CALENDAR.weeksPerSeason : breachWeek,
    nextSeason: nextSeason ? 1 : 0,
    floor: line.floor,
    next: breachOutcomeFor(loanBreachesOf(save.finances) + 1, save.difficulty),
    backer: save.finances.loan ? 1 : 0,
  };
  if (runway <= CAREER_PAYROLL.runwayWarnWeeks) {
    if (!save.flags[RUNWAY_WARNED_FLAG]) {
      save.flags[RUNWAY_WARNED_FLAG] = true;
      pushNews(save, { type: "org", priority: 2, titleKey: "cashWarning", params: { weeks: runway } });
    }
    pushMail(save, {
      kind: "finance",
      titleKey: "cashWarning",
      bodyKey: "cashWarning",
      params,
      fromKey: "accountant",
      linkTo: "/career/finances",
    });
  } else if (!save.flags[RUNWAY_NOTICE_FLAG]) {
    save.flags[RUNWAY_NOTICE_FLAG] = true;
    pushMail(save, {
      kind: "finance",
      titleKey: "cashNotice",
      bodyKey: "cashNotice",
      params,
      fromKey: "accountant",
      linkTo: "/career/finances",
    });
  }
}

/**
 * rc.32 M4 (decision 4-B — provisional): a breach strictly between the
 * Backer's rescue and the last one (CAREER_LOAN.breachesToEnd). The
 * highest-paid player is sold at market value to an AI org of his region
 * that would field him (half the fee to the Backer while it is owed, like
 * any sale), reputation drops by restructureRepLoss (never below the rep
 * floor) and the Backer's rescue rule tops the books back up to its target.
 * The squad stays playable: the reserve is promoted (syncSquadRoles) and an
 * event short of three starters fields a stand-in. An inbox mail and an HQ
 * line say what happened, why, and what the next breach means.
 */
function restructureAfterBreach(save: CareerSave): void {
  const { seasonIndex, day } = save.clock;
  const week = weekOfDay(day);
  const breach = loanBreachesOf(save.finances);
  const top = [...save.squad].sort(
    (a, b) => b.salaryPerSplit - a.salaryPerSplit || b.overall - a.overall || a.id.localeCompare(b.id),
  )[0];
  let sold: { player: string; org: string; fee: number } | null = null;
  if (top) {
    const buyer = fieldingBuyerFor({
      world: save.world,
      player: top,
      seasonIndex,
      careerSeed: save.careerSeed,
      key: `restructure:${seasonIndex}:${day}`,
    });
    if (buyer) {
      const fee = marketValueFor({
        overall: top.overall,
        age: ageOf(top.birthYear, seasonIndex),
        potential: top.potential,
        seasonIndex,
      });
      sellSquadPlayer(save, top, fee, buyer, { lateSigning: false });
      sold = { player: top.name, org: nameOfRef(save, buyer), fee };
    }
  }
  const repBefore = save.reputation;
  loseRep(save, CAREER_LOAN.restructureRepLoss, "repDown");
  const line = backerLineOf(save);
  const topUp = backerTopUp(save.finances, line.rescueTo, { seasonIndex, week, day });
  save.finances = topUp.fin;
  const next = breachOutcomeFor(breach + 1, save.difficulty);
  const params = {
    n: breach,
    player: sold?.player ?? "",
    org: sold?.org ?? "",
    fee: sold?.fee ?? 0,
    // The real drop: the shipped rep floor (repLossFloor) can make it smaller than restructureRepLoss.
    rep: Math.round(repBefore - save.reputation),
    rescueTo: line.rescueTo,
    owed: save.finances.loan?.remaining ?? 0,
    next,
  };
  pushNews(save, { type: "org", priority: 3, titleKey: "restructured", params });
  pushMail(save, {
    kind: "finance",
    titleKey: "restructured",
    bodyKey: "restructured",
    params,
    fromKey: "backer",
    linkTo: "/career/finances",
  });
}

function runSplitBoundary(save: CareerSave): void {
  const { seasonIndex, day } = save.clock;
  const week = weekOfDay(day);
  // Sponsor objective settlement — the bonus lands as its own line.
  if (save.sponsor) {
    const s = save.sponsor;
    const hit =
      s.hitThisSplit ||
      (s.objectiveKind === "enterEvents" && s.progress >= CAREER_SPONSOR.enterEventsTarget);
    if (hit) {
      save.finances = pushLedger(save.finances, {
        seasonIndex,
        week,
        day,
        kind: "sponsorBonus",
        amount: s.bonus,
        refName: s.sponsorId,
      });
      pushNews(save, { type: "org", priority: 2, titleKey: "objectiveHit", params: { name: s.sponsorId } });
      pushMail(save, {
        kind: "sponsor",
        titleKey: "objectiveHit",
        bodyKey: "objectiveHit",
        params: { name: s.sponsorId, bonus: s.bonus },
        fromKey: "sponsor",
        linkTo: "/career/finances",
      });
    } else {
      s.missedCount += 1;
      pushNews(save, { type: "org", priority: 2, titleKey: "objectiveMissed", params: { name: s.sponsorId } });
      pushMail(save, {
        kind: "sponsor",
        titleKey: "objectiveMissed",
        bodyKey: "objectiveMissed",
        params: { name: s.sponsorId, misses: s.missedCount },
        fromKey: "sponsor",
        linkTo: "/career/finances",
      });
    }
  }

  // Split turnover: chemistry credit, scout narrowing, training accumulators,
  // bootcamp availability.
  for (const p of save.squad) {
    const credit = p.role === "sub" ? CAREER_SUB.chemistryCreditFactor : 1;
    p.splitsTogether += credit;
    p.scoutLevel = Math.min(3, p.scoutLevel + CAREER_SCOUT.autoRevealPerSplit) as 0 | 1 | 2 | 3;
    p.gainedThisSplit = 0;
  }
  save.finances.bootcampUsedThisSplit = false;

  // Sponsor offers appear once the org has earned some standing.
  maybeOfferSponsors(save);
}

function forceTransferInWorld(save: CareerSave, playerId: string, toOrgRef: string): void {
  const world = save.world;
  const target = world.orgs[toOrgRef];
  if (!target) return;
  // Pull from wherever the player currently is.
  for (const org of Object.values(world.orgs)) {
    const idx = org.playerIds.indexOf(playerId);
    if (idx >= 0) {
      const replacement = world.freeAgentIds.find((id) => {
        const v = playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world });
        return v?.region === org.region;
      });
      if (replacement) {
        org.playerIds[idx] = replacement;
        world.freeAgentIds = world.freeAgentIds.filter((id) => id !== replacement);
      }
    }
  }
  world.freeAgentIds = world.freeAgentIds.filter((id) => id !== playerId);
  // Displace the target org's weakest player to FA.
  const views = target.playerIds.map((id) =>
    playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world }),
  );
  let weakest = 0;
  for (let i = 1; i < views.length; i++) {
    if ((views[i]?.overall ?? 60) < (views[weakest]?.overall ?? 60)) weakest = i;
  }
  world.freeAgentIds.push(target.playerIds[weakest]);
  target.playerIds[weakest] = playerId;
  world.version += 1;
}

// ---------------------------------------------------------------------------
// Offers (market decisions resolved through the store)
// ---------------------------------------------------------------------------

/**
 * rc.30 (review): accepting a bid is a roster move — locked while an event is
 * in progress (its team froze at startEvent; a sold starter would still play
 * Sunday's playoffs for the user).
 */
export function acceptBidFlow(input: CareerSave, offerId: string): FlowResult {
  if (input.activeEvent) return { save: input, error: "rosterLocked" };
  const offer = input.pendingOffers.find((o) => o.id === offerId);
  if (!offer) return { save: input, error: "unknown" };
  // ECO-03 (R47): a bid for a player no longer on the squad cannot complete —
  // say so and drop it, instead of "accepting" a sale that moves nothing.
  if (!input.squad.some((p) => p.id === offer.playerId)) {
    return { save: declineBidFlow(input, offerId), error: "unknown" };
  }
  return { save: resolveAcceptedBid(input, offer) };
}

export function resolveAcceptedBid(input: CareerSave, offer: TransferOffer): CareerSave {
  const save = clone(input);
  const player = save.squad.find((p) => p.id === offer.playerId);
  if (!player) return save;
  save.pendingOffers = save.pendingOffers.filter((o) => o.id !== offer.id);
  // rc.32 (M8): a seat sold in a window may be refilled after it closes.
  sellSquadPlayer(save, player, offer.fee, offer.otherRef ?? null, { lateSigning: true });
  return save;
}

/**
 * ONE sale of a squad player (an accepted bid or listing offer, a
 * restructuring — ECO-03 / R47: atomic, fee + wages + slot together): he
 * leaves the squad (the lineup re-syncs), the buying org takes him (or he
 * lands in its world roster slot), the fee books through
 * applyTransferIncome (half to the Backer while it is owed — selling pays
 * the Backer), the wire logs it and every other bid or listing for him is
 * settled. rc.32 (M8): a sale inside a window opens the late signing.
 */
function sellSquadPlayer(
  save: CareerSave,
  player: SquadPlayer,
  fee: number,
  toRef: string | null,
  opts: { lateSigning: boolean },
): void {
  save.squad = save.squad.filter((p) => p.id !== player.id);
  syncSquadRoles(save);
  // The buying org takes him (or he lands in their world roster slot).
  if (toRef) forceTransferInWorld(save, player.id, toRef);
  // v0.3 debt-lock fix: while the Backer loan is active, half the sale
  // amortizes the debt (line-itemized) — selling finally pays the Backer.
  const { fin, garnished } = applyTransferIncome(save.finances, fee, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    refName: player.name,
  });
  save.finances = fin;
  if (garnished > 0 && !save.finances.loan) {
    pushNews(save, { type: "org", priority: 2, titleKey: "debtCleared" });
    pushMail(save, {
      kind: "finance",
      titleKey: "debtCleared",
      bodyKey: "debtCleared",
      params: {},
      fromKey: "backer",
      linkTo: "/career/finances",
    });
  }
  logTransfer(save, {
    playerId: player.id,
    playerName: player.name,
    fromRef: "user",
    toRef,
    fee,
    kind: "userOut",
    region: save.identity.region,
  });
  // ECO-03 (R47): the sale settles every bid for him — none is left to
  // "complete" later (a release drops them the same way).
  save.pendingOffers = save.pendingOffers.filter((o) => !(o.direction === "out" && o.playerId === player.id));
  pruneListings(save);
  pushNews(save, {
    type: "transfer",
    priority: 2,
    titleKey: "userSold",
    params: {
      player: player.name,
      org: save.identity.orgName,
      to: toRef ? nameOfRef(save, toRef) : "?",
    },
  });
  if (opts.lateSigning) openLateSigning(save);
}

/**
 * rc.32 M8 (decision 8-B — provisional): a seat sold in a window may be
 * refilled with a free agent until CAREER_TRANSFER.lateSigningDays after the
 * window closes — one late signing per window (so one per split).
 */
function openLateSigning(save: CareerSave): void {
  if (!CAREER_TRANSFER.listingEnabled || CAREER_TRANSFER.lateSigningDays <= 0) return;
  const windowIdx = windowIndexOf(weekOfDay(save.clock.day));
  if (windowIdx === null) return;
  const { seasonIndex } = save.clock;
  const prev = save.lateSigning;
  if (prev && prev.seasonIndex === seasonIndex && prev.windowIdx === windowIdx) return;
  save.lateSigning = {
    seasonIndex,
    windowIdx,
    untilDay: Math.min(
      DAYS_PER_SEASON,
      windowCloseDayFor(windowIdx as 0 | 1 | 2 | 3) + CAREER_TRANSFER.lateSigningDays,
    ),
    used: false,
  };
}

/**
 * rc.32 M8: is the late signing open today? After a window sale, between the
 * window's close and `untilDay`, unused — a free agent only (signingPlanFor).
 */
export function lateSigningOpen(save: CareerSave): boolean {
  const late = save.lateSigning;
  if (!late || late.used || !CAREER_TRANSFER.listingEnabled || CAREER_TRANSFER.lateSigningDays <= 0) return false;
  if (late.seasonIndex !== save.clock.seasonIndex) return false;
  const day = save.clock.day;
  return day > windowCloseDayFor(late.windowIdx as 0 | 1 | 2 | 3) && day <= late.untilDay;
}

/**
 * v0.3: manual Backer pay-down from the Finances screen — any amount, any
 * time (clamped to the outstanding debt and the available balance headroom).
 */
export function payDebtFlow(input: CareerSave, amount: number): FlowResult {
  if (input.phase === "ended") return { save: input, error: "blocked" }; // ECO-02: the books are closed
  const save = clone(input);
  if (!save.finances.loan) return { save: input, error: "none" };
  // ECO-02 (R46): settle the exact remainder when the request covers it.
  const pay = debtPaymentFor(save.finances.loan.remaining, amount);
  if (pay <= 0) return { save: input, error: "invalid" };
  if (save.finances.balance - pay < backerLineOf(save).floor) return { save: input, error: "funds" };
  save.finances = payLoanDown(save.finances, pay, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
  });
  if (!save.finances.loan) {
    pushNews(save, { type: "org", priority: 2, titleKey: "debtCleared" });
    pushMail(save, {
      kind: "finance",
      titleKey: "debtCleared",
      bodyKey: "debtCleared",
      params: {},
      fromKey: "backer",
      linkTo: "/career/finances",
    });
  }
  return { save: capNews(save) };
}

/**
 * v2.0 (R21): request a bank loan. Validation lives in economy.bankLoanRefusal
 * (one active loan, none while the Backer debt is open, min amount, rep-tier
 * limit); the principal lands immediately and instalments book every Monday.
 */
export function takeBankLoanFlow(input: CareerSave, principal: number): FlowResult {
  if (input.phase === "ended") return { save: input, error: "blocked" }; // ECO-02: no loan to a closed org
  const save = clone(input);
  const amount = quantize(principal);
  const refusal = bankLoanRefusal(save.finances, save.reputation, amount, save.clock.seasonIndex);
  if (refusal === "active") return { save: input, error: "bankActive" };
  if (refusal === "backer") return { save: input, error: "bankBacker" };
  if (refusal === "amount") return { save: input, error: "bankAmount" };
  if (refusal === "limit") return { save: input, error: "bankLimit" };
  save.finances = takeBankLoan(save.finances, amount, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
  });
  const loan = save.finances.bankLoan!;
  pushNews(save, { type: "org", priority: 1, titleKey: "bankLoan", params: { amount } });
  pushMail(save, {
    kind: "finance",
    titleKey: "bankLoan",
    bodyKey: "bankLoan",
    params: { amount, weekly: loan.weeklyPayment, total: loan.remaining },
    fromKey: "bank",
    linkTo: "/career/finances",
  });
  return { save: capNews(save) };
}

/**
 * v2.0 (R33): answer the pending insert. Effects are small and legible —
 * money (one ledger line), reputation, chemistry credit, bonus or lost
 * training-week equivalents for the squad.
 */
export function resolveInsertFlow(input: CareerSave, key: "a" | "b"): FlowResult {
  const save = clone(input);
  const pending = save.pendingInsert;
  if (!pending) return { save: input, error: "none" };
  const def = insertById.get(pending.id);
  if (!def) {
    save.pendingInsert = null;
    return { save };
  }
  const option = def.options.find((o) => o.key === key) ?? def.options[1];
  const fx = option.effects;
  const seasonIndex = save.clock.seasonIndex;
  const week = weekOfDay(save.clock.day);
  if (fx.money) {
    save.finances = pushLedger(save.finances, {
      seasonIndex,
      week,
      day: save.clock.day,
      kind: "insert",
      // rc.32 (M1): the catalogue is season-0 money, on the money index.
      amount: insertMoneyFor(fx.money, seasonIndex),
      refName: def.id,
    });
  }
  if (fx.rep && fx.rep > 0) save.reputation = Math.min(100, save.reputation + fx.rep);
  if (fx.rep && fx.rep < 0) loseRep(save, -fx.rep, "repDown");
  if (fx.chemistry) for (const p of save.squad) p.splitsTogether += fx.chemistry;
  if (fx.trainingWeeks) {
    const gearBonus = gearTrainingBonus(save.finances.gear);
    const drill = activeDrillFor(save);
    for (const p of save.squad) {
      const weeks = fx.trainingWeeks;
      if (weeks > 0) {
        const res = trainWeek(p, {
          seasonIndex,
          coachOverall: save.coach?.overall ?? null,
          gearBonus,
          trainingWeekBonus: false,
          splitGained: p.gainedThisSplit,
          seasonGained: p.gainedThisSeason,
          weeks,
          drill,
        });
        Object.assign(p, res.player);
      } else {
        // A lost session: a small, capped step back (never below 60).
        const proj = trainingProjection(p, { seasonIndex, coachOverall: save.coach?.overall ?? null, gearBonus, trainingWeekBonus: false, drill });
        p.overall = Math.max(60, p.overall - proj.weeklyOverall * -weeks);
      }
    }
  }
  save.pendingInsert = null;
  pushNews(save, { type: "org", priority: 1, titleKey: "insertResolved", params: { insert: def.id } });
  return { save: capNews(save) };
}

/** v2.0 (R21): pay the bank loan down early, any amount from the balance. */
export function payBankLoanFlow(input: CareerSave, amount: number): FlowResult {
  if (input.phase === "ended") return { save: input, error: "blocked" }; // ECO-02: the books are closed
  const save = clone(input);
  if (!save.finances.bankLoan) return { save: input, error: "none" };
  // ECO-02 (R46): "pay it all" settles the exact remainder (no stub left).
  const pay = debtPaymentFor(save.finances.bankLoan.remaining, amount);
  if (pay <= 0) return { save: input, error: "invalid" };
  if (save.finances.balance - pay < backerLineOf(save).floor) return { save: input, error: "funds" };
  save.finances = payBankLoanDown(save.finances, pay, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
  });
  if (!save.finances.bankLoan) {
    save.flags[ACH_FLAGS.bankCleared] = true;
    pushNews(save, { type: "org", priority: 2, titleKey: "bankCleared" });
  }
  return { save: capNews(save) };
}

// ---------------------------------------------------------------------------
// Event lifecycle
// ---------------------------------------------------------------------------

/**
 * The user team an event fields (startEvent's build: this event's ruled-out
 * player, the armed bootcamp edge). rc.29 (CAR-06): shared with the event
 * lobby, so the Community Cup field it lists is the one that plays.
 */
export function userTeamForEvent(
  save: CareerSave,
  def: CareerEventDef,
): ReturnType<typeof userTeamFor> {
  const unavailable =
    save.pendingUnavailability?.eventId === def.id ? save.pendingUnavailability.playerId : null;
  return userTeamFor({
    identity: save.identity,
    squad: save.squad,
    starterIds: save.starterIds,
    coach: save.coach,
    gear: save.finances.gear,
    bootcampSharp: save.finances.bootcampSharp,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
    unavailablePlayerId: unavailable,
  });
}

export function startEvent(input: CareerSave, watch: boolean): CareerSave {
  const save = clone(input);
  const def = save.pendingEventDef;
  if (!def || save.activeEvent) return save;
  // The lobby opens on the matchday only (the day clock stops there).
  if (save.clock.day !== def.day) return save;

  const { team, usedStandIn, fieldedIds } = userTeamForEvent(save, def);
  if (usedStandIn) {
    save.finances = pushLedger(save.finances, {
      seasonIndex: save.clock.seasonIndex,
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      kind: "standInFee",
      amount: -standInFeeFor(save.clock.seasonIndex),
      refName: def.name,
    });
    pushNews(save, { type: "org", priority: 2, titleKey: "standIn", params: { event: def.name } });
  }
  const { field, fieldQuality } = fieldForEvent(def, {
    world: save.world,
    competition: save.competition,
    userTeam: team,
    userRegion: save.identity.region,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
    userPrestige: repTierOf(save.reputation),
  });
  const rng = createRng(deriveSeed(save.careerSeed, `evt:${def.id}`));
  const tournament = initFieldTournament(field, def.format, rng);
  save.activeEvent = {
    def,
    rngState: rng.state,
    tournament,
    fieldQuality,
    watched: watch,
    fieldedIds,
  };
  // Consumed the bootcamp edge (applies to this event's team build).
  if (save.finances.bootcampSharp > 0 && def.tier !== "t3" && def.tier !== "t2") {
    save.finances.bootcampSharp = 0;
  }
  if (def.tier === "t3") save.t3EntriesThisSplit += 1;
  if (save.sponsor?.objectiveKind === "enterEvents") save.sponsor.progress += 1;
  save.unofficialOffer = null;
  return save;
}

export function declineUnofficial(input: CareerSave): CareerSave {
  const save = clone(input);
  if (!save.unofficialOffer && save.pendingEventDef?.tier !== "t3" && save.pendingEventDef?.tier !== "t2") {
    return save;
  }
  if (
    save.pendingEventDef &&
    (save.pendingEventDef.tier === "t3" || save.pendingEventDef.tier === "t2")
  ) {
    save.pendingEventDef = null;
  }
  save.unofficialOffer = null;
  // The freed matchday becomes a Training Week boost (one bonus week).
  const gearBonus = gearTrainingBonus(save.finances.gear);
  for (const p of save.squad) {
    const res = trainDay(p, {
      seasonIndex: save.clock.seasonIndex,
      coachOverall: save.coach?.overall ?? null,
      gearBonus,
      trainingWeekBonus: true,
      splitGained: p.gainedThisSplit,
      seasonGained: p.gainedThisSeason,
    });
    Object.assign(p, res.player);
  }
  return save;
}

// --- v2.0 (R40): the two-day Major / Worlds -----------------------------------

/**
 * True while the user's two-day event (Major/Worlds) sits between its
 * Saturday Swiss and its Sunday playoffs: the Swiss stage is complete, the
 * bracket is seeded, no playoff round has been played and the clock is still
 * before the playoffs day. Derived purely from persisted fields (activeEvent
 * + clock), so the pause survives a reload with no extra state. While paused,
 * stepEventRound / simEventToEnd refuse and advanceDayFlow may move the clock
 * to Sunday. A legacy event already INTO its playoffs on Saturday is not
 * paused (it simply finishes that day).
 */
export function isEventPaused(save: CareerSave): boolean {
  const ev = save.activeEvent;
  if (!ev || !isTwoDayEvent(ev.def)) return false;
  return save.clock.day < playoffsDayFor(ev.def) && atPlayoffsStart(ev.tournament);
}

/** Where the user's event stands today (the screens' single source). */
export type EventDayPhase =
  /** No user event today. */
  | "none"
  /** `pendingEventDef` opens today; `startEvent` (store `enterEvent`) not called yet. */
  | "lobby"
  /** `activeEvent` in its Swiss stage (Saturday for a Major/Worlds). */
  | "swiss"
  /** Two-day event, Saturday: Swiss complete, playoffs seeded — waits for Sunday (`isEventPaused`). */
  | "paused"
  /** `activeEvent` in its playoffs (Sunday for a Major/Worlds — "Championship Sunday"). */
  | "playoffs"
  /** Tournament finished; `finishEvent` (store `completeEvent`) pending — the digest. */
  | "finished";

export function eventDayPhaseOf(save: CareerSave): EventDayPhase {
  const ev = save.activeEvent;
  if (ev) {
    if (ev.tournament.stage === "finished") return "finished";
    if (isEventPaused(save)) return "paused";
    return ev.tournament.stage;
  }
  if (save.pendingEventDef && save.pendingEventDef.day === save.clock.day) return "lobby";
  return "none";
}

/**
 * rc.30 (SEAM-2): a Major/Worlds already PAST its Swiss on its Saturday — only
 * a save from before rc.28, whose flow had no pause (migrateSaveToV4 lets it
 * finish on Saturday). Its playoffs are today's: a plain playoffs day, never
 * "Championship Sunday", and nothing waits for tomorrow.
 */
export function isLegacySaturdayPlayoffs(save: CareerSave): boolean {
  const ev = save.activeEvent;
  return Boolean(
    ev && isTwoDayEvent(ev.def) && save.clock.day === ev.def.day &&
      ev.tournament.stage !== "swiss" && !isEventPaused(save),
  );
}

/**
 * True when the in-progress Major/Worlds is on its playoffs day (Sunday) —
 * "Championship Sunday", whether or not a playoff round has been played yet.
 */
export function isChampionshipSunday(save: CareerSave): boolean {
  const ev = save.activeEvent;
  return Boolean(
    ev && isTwoDayEvent(ev.def) && ev.tournament.stage !== "finished" &&
      save.clock.day >= playoffsDayFor(ev.def) && save.clock.day !== ev.def.day,
  );
}

/** v2.0 (R40): the save flag marking an event's Championship Sunday intro as seen. */
export function sundayIntroFlagFor(eventId: string): string {
  return `sundayIntro:${eventId}`;
}

/**
 * v2.0 (R40): Championship Sunday opens like a matchday — the CTA of its
 * title card. In ONE write: marks the intro seen (it plays at most once per
 * event), re-picks watch / instant for the playoffs (`watched` is a UI flag
 * and never feeds the sim, so the choice cannot change a result) and, for
 * instant, sims the playoffs to the finish (the digest follows). Only on
 * Championship Sunday before the first playoff round; the SAME save otherwise.
 */
export function startChampionshipSundayFlow(input: CareerSave, watch: boolean): CareerSave {
  const ev = input.activeEvent;
  if (!ev || !isChampionshipSunday(input) || !atPlayoffsStart(ev.tournament)) return input;
  const save = clone(input);
  save.activeEvent!.watched = watch;
  save.flags[sundayIntroFlagFor(ev.def.id)] = true;
  return watch ? save : simEventToEnd(save);
}

/**
 * A two-day event must not cross from its Swiss into its playoffs before the
 * playoffs day: true when `t` sits exactly on that boundary too early.
 */
function holdsForPlayoffsDay(save: CareerSave, t: TournamentState): boolean {
  const ev = save.activeEvent;
  if (!ev || !isTwoDayEvent(ev.def)) return false;
  return save.clock.day < playoffsDayFor(ev.def) && atPlayoffsStart(t);
}

export function stepEventRound(input: CareerSave): CareerSave {
  // R40: the Saturday pause — nothing to play until Sunday (same object back,
  // so a watch-mode clock calling this cannot spin store writes).
  if (isEventPaused(input)) return input;
  const save = clone(input);
  const ev = save.activeEvent;
  if (!ev || ev.tournament.stage === "finished") return save;
  const rng = createRng(ev.rngState);
  let t: TournamentState = playNextRound(ev.tournament, save.difficulty, rng);
  let guard = 0;
  while (
    t.stage !== "finished" &&
    !userHasPendingSeries(t) &&
    !holdsForPlayoffsDay(save, t) &&
    guard < 16
  ) {
    t = playNextRound(t, save.difficulty, rng);
    guard += 1;
  }
  ev.tournament = t;
  ev.rngState = rng.state;
  return save;
}

/**
 * Instant sim. R40: on a two-day event's Saturday it sims to the END OF THE
 * SWISS only (the event then pauses); on Sunday — or for any one-day event —
 * it runs to the finish. Same rng order as stepping round by round, so a
 * paused-and-resumed event ends exactly where an uninterrupted one would.
 */
export function simEventToEnd(input: CareerSave): CareerSave {
  if (isEventPaused(input)) return input;
  const save = clone(input);
  const ev = save.activeEvent;
  if (!ev || ev.tournament.stage === "finished") return save;
  const rng = createRng(ev.rngState);
  let t = ev.tournament;
  let guard = 0;
  while (t.stage !== "finished" && !holdsForPlayoffsDay(save, t) && guard < 20) {
    t = playNextRound(t, save.difficulty, rng);
    guard += 1;
  }
  ev.tournament = t;
  ev.rngState = rng.state;
  return save;
}

export function finishEvent(input: CareerSave): CareerSave {
  const save = clone(input);
  const ev = save.activeEvent;
  if (!ev || ev.tournament.stage !== "finished") return save;
  const def = ev.def;

  const result = compileEventResult(def, ev.tournament, {
    difficulty: save.difficulty,
    fieldQuality: ev.fieldQuality,
    nameOf: (id) => nameOfRef(save, id),
  });
  ingestResult(save, result);

  const placement = result.userPlacement ?? placementOf(ev.tournament, "user");
  const userRow = result.rows.find((r) => r.ref === "user");

  // Prize (+ rc.32 the players' share of a podium, M6 provisional; + Backer garnish).
  if (userRow && userRow.prize > 0) {
    const { fin } = applyPrize(save.finances, userRow.prize, {
      seasonIndex: save.clock.seasonIndex,
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      refName: def.name,
      difficulty: save.difficulty,
      playerShare: playerShareFor(def.tier, placement, userRow.prize),
    });
    save.finances = fin;
    save.stats.totalPrize += userRow.prize;
  }

  // Reputation.
  applyEventRep(save, def, placement);

  // Sponsor objective progress.
  if (save.sponsor) {
    const s = save.sponsor;
    const top8 = placement !== "swiss_exit";
    if (s.objectiveKind === "regionalTop8" && def.tier === "regional" && top8) s.hitThisSplit = true;
    if (
      s.objectiveKind === "majorTop4" &&
      def.tier === "major" &&
      ["champion", "runner_up", "third", "fourth", "top4"].includes(placement)
    ) {
      s.hitThisSplit = true;
    }
  }

  // Roster stability (fielded new faces). R40 review: the players who
  // actually played — the team froze at startEvent (a two-day event pauses
  // overnight; the lineup is locked meanwhile, older saves read it now).
  const fielded = ev.fieldedIds ?? fieldedIdsFor(save);
  const stab = stabilityAssess({
    fieldedIds: fielded,
    squadAtSplitStart: save.competition.squadAtSplitStart,
    newFacesSoFar: save.competition.newFacesThisSplit,
    exemptIds: save.pendingUnavailability ? [save.pendingUnavailability.playerId] : [],
    isPreseason: splitOfWeek(weekOfDay(save.clock.day)) === null,
    seasonPointsUser: save.competition.seasonPoints[save.identity.region]?.user ?? 0,
    tierApplied: save.competition.stabilityTierApplied,
  });
  save.competition.newFacesThisSplit = Array.from(
    new Set([...save.competition.newFacesThisSplit, ...stab.newFaces]),
  );
  if (stab.tier > save.competition.stabilityTierApplied && stab.pointsLost > 0) {
    save.competition.stabilityTierApplied = stab.tier;
    const region = save.identity.region;
    const cur = save.competition.seasonPoints[region]?.user ?? 0;
    save.competition.seasonPoints[region].user = Math.max(0, cur - stab.pointsLost);
    pushNews(save, {
      type: "org",
      priority: 2,
      titleKey: "stability",
      params: { points: stab.pointsLost },
    });
  }

  // Match XP (field-quality scaled, ALL events).
  const gearBonus = gearTrainingBonus(save.finances.gear);
  for (const p of save.squad) {
    const wasFielded = fielded.includes(p.id);
    const isSub = !wasFielded && p.role === "sub";
    if (wasFielded || isSub) {
      const next = applyMatchXp(p, {
        seasonIndex: save.clock.seasonIndex,
        fieldQuality: ev.fieldQuality,
        isSub,
        coachOverall: save.coach?.overall ?? null,
        gearBonus,
      });
      Object.assign(p, next);
    }
  }

  // Lifetime stats from the user's series.
  accumulateStats(save, ev.tournament);
  if (placement === "champion") {
    if (def.tier === "t3") save.stats.titlesT3 += 1;
    if (def.tier === "t2") save.stats.titlesT2 += 1;
    if (def.tier === "regional") save.stats.titlesRegional += 1;
    if (def.tier === "major") save.stats.titlesMajor += 1;
    if (def.tier === "worlds") save.stats.titlesWorlds += 1;
    // rc.4 (Underdog): how far below the rest of the field the user's team was.
    if (def.tier === "regional" || def.tier === "major" || def.tier === "worlds") {
      const gap = underdogGapOf(ev.tournament);
      const flags = save.flags as Record<string, unknown>;
      const prev = typeof flags[ACH_FLAGS.underdogGap] === "number" ? (flags[ACH_FLAGS.underdogGap] as number) : 0;
      if (gap > prev) flags[ACH_FLAGS.underdogGap] = gap;
    }
  }
  if (def.tier === "major") save.stats.majorsQualified += 1;

  pushNews(save, {
    type: "result",
    priority: 2,
    titleKey: "resultUser",
    // R40: `tier` lets the feed read a qualifier's "top8" as "Qualified".
    params: { event: def.name, placement, tier: def.tier },
  });

  save.activeEvent = null;
  save.pendingEventDef = null;
  save.pendingUnavailability = null;

  // v2.0 (R30 → R40): through Saturday's qualifier → Sunday's regional is on
  // (the player advances one day to its lobby); out → it plays without them.
  if (def.tier === "qualifier") {
    const regional = regionalForQualifier(def);
    const advanced = placement !== "swiss_exit";
    if (regional && advanced) {
      save.flags[ACH_FLAGS.qualifierAdvanced] = true;
      save.pendingEventDef = regional;
      rollUnavailability(save, regional);
      pushNews(save, { type: "milestone", priority: 2, titleKey: "qualifiedRegional", params: { event: regional.name } });
      pushMail(save, {
        kind: "club",
        titleKey: "qualifiedRegional",
        bodyKey: "qualifiedRegional",
        params: { event: regional.name },
        fromKey: "league",
        linkTo: "/career/event",
      });
    } else if (regional) {
      pushNews(save, { type: "milestone", priority: 2, titleKey: "missedRegional", params: { event: regional.name } });
      pushMail(save, {
        kind: "club",
        titleKey: "missedRegional",
        bodyKey: "missedRegional",
        params: { event: regional.name },
        fromKey: "league",
        linkTo: "/career/standings",
      });
    }
  }

  // Worlds resolves the season (and possibly the career).
  if (def.tier === "worlds") {
    if (placement === "champion") {
      // v2.0 (R32): the roster context the career achievements read.
      const fieldedOvr = fielded
        .map((id) => save.squad.find((p) => p.id === id)?.overall ?? 0)
        .filter((o) => o > 0);
      (save.flags as Record<string, unknown>)[ACH_FLAGS.worldsMaxStarterOvr] =
        fieldedOvr.length ? Math.round(Math.max(...fieldedOvr)) : 0;
      const founding = save.foundingSquadIds;
      // rc.30 (review): every player who took the stage counts, not only the squad at the end.
      if (founding && save.squad.every((p) => founding.includes(p.id)) && fielded.every((id) => founding.includes(id))) {
        save.flags[ACH_FLAGS.worldsHomegrown] = true;
      }
      save.end = {
        ...save.end,
        ended: true,
        reason: "worlds_won",
        endedSeasonIndex: save.clock.seasonIndex,
        legacyGrade: "legend",
      };
      save.reputation = 100;
    }
    enterSeasonReview(save, result);
  }
  return capNews(save);
}

/** Field average player overall minus the user team's (positive = underdog), one decimal. */
function underdogGapOf(t: TournamentState): number {
  const teams = Object.values(t.teams);
  const user = teams.find((tm) => tm.isUser);
  const others = teams.filter((tm) => !tm.isUser);
  if (!user || others.length === 0) return 0;
  const avg = others.reduce((n, tm) => n + tm.rating.avgPlayerOverall, 0) / others.length;
  return Math.round((avg - user.rating.avgPlayerOverall) * 10) / 10;
}

/** The lineup as it stands now — the fallback for events started before `fieldedIds` existed. */
function fieldedIdsFor(save: CareerSave): string[] {
  const unavailable = save.pendingUnavailability?.playerId;
  const ids = save.starterIds.filter((id) => id !== unavailable);
  if (ids.length < 3) {
    const sub = save.squad.find((p) => p.role === "sub");
    if (sub) ids.push(sub.id);
  }
  return ids;
}

function applyEventRep(save: CareerSave, def: CareerEventDef, placement: Placement): void {
  // The rule lives in the engine (eventRepKindFor — the digest previews the
  // same one). t3 rep (win or final) shares one per-split cap counter; the
  // regional's Swiss-exit floor keeps a losing season 1 climbing.
  const key = t3RepKeyFor(save.clock.seasonIndex, splitOfWeek(weekOfDay(save.clock.day)));
  const used = Number(save.flags[key] as unknown as number) || 0;
  const kind = eventRepKindFor(def.tier, placement, {
    t3CapReached: used >= CAREER_UNOFFICIAL.t3RepCapPerSplit,
  });
  if (!kind) return;
  gainRep(save, kind);
  if (def.tier === "t3") (save.flags as Record<string, unknown>)[key] = used + 1;
}

function accumulateStats(save: CareerSave, t: TournamentState): void {
  const allSeries = [
    ...t.swiss.rounds.flatMap((r) => r.series),
    ...(t.playoffs?.rounds.flatMap((r) => r.series) ?? []),
  ];
  for (const s of allSeries) {
    const isUser = s.teamAId === "user" || s.teamBId === "user";
    if (!isUser) continue;
    const won = s.winnerTeamId === "user";
    if (won) save.stats.seriesWins += 1;
    else save.stats.seriesLosses += 1;
    for (const g of s.games) {
      const userWonGame = g.winnerTeamId === "user";
      if (userWonGame) save.stats.gameWins += 1;
      else save.stats.gameLosses += 1;
      save.stats.goalsFor += userWonGame ? g.score[0] : g.score[1];
      save.stats.goalsAgainst += userWonGame ? g.score[1] : g.score[0];
    }
  }
}

// ---------------------------------------------------------------------------
// Season review + rollover + endgame
// ---------------------------------------------------------------------------

export function enterSeasonReview(save: CareerSave, worldsResult: CompactEventResult | null): void {
  const region = save.identity.region;
  const table = save.competition.seasonPoints[region] ?? {};
  // R49: the Worlds table's own order (rankByPoints — local sides included).
  const rows = rankByPoints(table, region, save.careerSeed).map((ref) => ({
    ref,
    name: nameOfRef(save, ref),
    points: table[ref],
  }));
  const rank = Math.max(1, rows.findIndex((r) => r.ref === "user") + 1 || rows.length + 1);
  const seasonEvents = save.eventResults.filter((r) => r.seasonIndex === save.clock.seasonIndex);
  const majorsQualified = seasonEvents.filter(
    (r) => r.tier === "major" && r.rows.some((row) => row.ref === "user"),
  ).length;
  const worlds = worldsResult ?? seasonEvents.find((r) => r.tier === "worlds") ?? null;
  const userWorlds = worlds?.rows.find((r) => r.ref === "user")?.placement ?? null;

  const grade = seasonGradeFor({
    regionRank: rank,
    majorsQualified,
    worldsPlacement: userWorlds,
    seasonIndex: save.clock.seasonIndex,
    rep: save.reputation,
  });

  // Season-goal settlement (rep risk telegraphed on the goals card).
  if (save.seasonGoals && save.seasonGoals.targetMet === null) {
    const met = grade === "S" || grade === "A" || grade === "B";
    save.seasonGoals.targetMet = met;
    if (!met && save.seasonGoals.repRisk > 0) {
      loseRep(save, save.seasonGoals.repRisk, "repDown");
    }
  }

  const record: SeasonRecord = {
    seasonIndex: save.clock.seasonIndex,
    seasonId: seasonIdFor(save.clock.seasonIndex),
    label: seasonLabelFor(save.clock.seasonIndex),
    worldsChampionRef: worlds?.championRef ?? null,
    worldsChampionName: worlds ? nameOfRef(save, worlds.championRef) : null,
    userWorldsPlacement: userWorlds,
    userSeasonPoints: table.user ?? 0,
    userRegionRank: rank,
    regionTable: rows.slice(0, 8),
    earnings: save.stats.totalPrize,
    balanceEnd: save.finances.balance,
    repEnd: save.reputation,
    grade,
    majorsQualified,
    // R40: a qualifier never crowns anyone (legacy pre-R40 qualifier rows included).
    titles: seasonEvents.filter((r) => hasChampion(r) && r.rows.find((x) => x.ref === "user")?.placement === "champion")
      .length,
  };
  save.history.push(record);
  save.phase = "seasonReview";

  // Timeline complete (2026 done without the title) → Final Whistle.
  if (
    !save.end.ended &&
    save.clock.seasonIndex >= CAREER_SEASONS.length - 1 &&
    !isInfinite(save)
  ) {
    save.end = {
      ...save.end,
      ended: true,
      reason: "timeline_complete",
      endedSeasonIndex: save.clock.seasonIndex,
      legacyGrade: legacyGradeFor(save.stats),
    };
  }
}

export function endCareer(save: CareerSave, reason: "insolvency" | "retired"): void {
  save.end = {
    ...save.end,
    ended: true,
    // ECO-02 (R46): an insolvency always records itself. A career that played
    // on past a Worlds title or the timeline (continuable endings) and then
    // broke the floor again used to keep "worlds_won" / "timeline_complete",
    // so the season screen offered "Defend the title" / "Endless era" and the
    // broke org rolled into a new season. Retiring keeps the earned ending.
    reason: reason === "insolvency" ? "insolvency" : (save.end.reason ?? reason),
    endedSeasonIndex: save.clock.seasonIndex,
    legacyGrade: save.end.legacyGrade ?? legacyGradeFor(save.stats),
  };
  save.phase = "ended";
}

/**
 * The season screen's "Endless era" (store `continueInfinite`): past the
 * timeline or a Worlds title, into the procedural seasons. ECO-02 (R46): an
 * ended career (insolvency, retired) never continues.
 */
export function continueInfiniteFlow(input: CareerSave): CareerSave {
  if (input.phase === "ended") return input;
  const save = clone(input);
  save.end.infinite = true;
  save.end.creditsShown = true;
  return rolloverToNextSeason(save);
}

export function rolloverToNextSeason(input: CareerSave): CareerSave {
  // ECO-02 (R46): an ended career (insolvency, retired) is final — no rollover.
  if (input.phase === "ended") return input;
  const save = clone(input);
  const nextSeason = save.clock.seasonIndex + 1;
  const rng = createRng(deriveSeed(save.careerSeed, streams.rollover(nextSeason)));

  // 1. World: aging, retirement, rookie intake (procedural era included).
  const pass = agePassAndIntake(
    save.world,
    nextSeason,
    save.careerSeed,
    save.squad.map((p) => p.id),
    nextSeason >= CAREER_SEASONS.length,
    save.squad.map((p) => p.name),
  );
  save.world = pass.world;
  // v2.0 (R31): real orgs whose first lineup is this season enter the world.
  const intake = realOrgIntake(save.world, nextSeason);
  save.world = intake.world;
  for (const org of intake.entered.slice(0, 4)) {
    pushNews(save, {
      type: "milestone",
      priority: org.region === save.identity.region ? 2 : 1,
      titleKey: "orgEnters",
      params: { org: org.name, region: org.region },
    });
  }
  for (const r of pass.retired.slice(0, 3)) {
    pushNews(save, { type: "milestone", priority: 1, titleKey: "retired", params: { player: r.name } });
  }
  if (pass.rookies.length > 0) {
    const headline = pass.rookies[0];
    pushNews(save, {
      type: "milestone",
      priority: 1,
      titleKey: "rookieClass",
      params: { region: headline.region, name: headline.name },
    });
  }

  // 2. User squad: aging, decline, retirement announcements, contract expiry.
  const keep: SquadPlayer[] = [];
  for (const p of save.squad) {
    const res = squadRollover(p, nextSeason, rng);
    if (res.retiresNow) {
      // DEV-02 (R48): he leaves the world for good (a retired id never
      // resolves again — the anchor pass used to re-sign a real one to his
      // real org), and the news says which way he went: a real ex-pro may move
      // into coaching (then he is on the coach market), else he leaves.
      const coach = becomesCoachOnRetirement(p.id, save.careerSeed);
      if (!save.world.retiredIds.includes(p.id)) save.world.retiredIds.push(p.id);
      delete save.world.overallDelta[p.id];
      save.world.version += 1;
      const key = coach ? "retiredToCoach" : "retiredLeaves";
      pushNews(save, { type: "milestone", priority: 2, titleKey: key, params: { player: p.name } });
      pushMail(save, {
        kind: "club",
        titleKey: key,
        bodyKey: key,
        params: { player: p.name },
        fromKey: "staff",
        linkTo: coach ? "/career/market#coaches" : "/career/squad",
      });
      continue;
    }
    if (res.announcedRetirement) {
      pushNews(save, {
        type: "org",
        priority: 2,
        titleKey: "retirementAnnounce",
        params: { player: p.name },
      });
    }
    if (res.declined > 0.5) {
      pushNews(save, {
        type: "training",
        priority: 1,
        titleKey: "decline",
        params: { player: p.name, n: Math.round(res.player.overall) },
      });
    }
    if (p.contractEndSeason < nextSeason) {
      pushNews(save, { type: "org", priority: 2, titleKey: "playerLeft", params: { player: p.name } });
      save.world.freeAgentIds.push(p.id);
      continue;
    }
    const next = res.player;
    next.gainedThisSeason = 0;
    next.gainedThisSplit = 0;
    keep.push(next);
  }
  save.squad = keep;
  // Repair starters if someone left.
  const ids = save.squad.map((p) => p.id);
  const starters = save.starterIds.filter((id) => ids.includes(id));
  for (const p of save.squad) {
    if (starters.length >= 3) break;
    if (!starters.includes(p.id)) starters.push(p.id);
  }
  save.starterIds = [starters[0] ?? "", starters[1] ?? "", starters[2] ?? ""] as [
    string,
    string,
    string,
  ];

  // 3. Sponsor renewal offers for the new season (only once the org has earned
  //    standing — no day-1 sponsorship).
  const patienceMissed = (save.sponsor?.missedCount ?? 0) >= CAREER_SPONSOR.patienceMisses;
  const hadSponsor = save.sponsor !== null;
  save.sponsorOffers =
    hadSponsor || save.reputation >= CAREER_SPONSOR.firstOfferRepGate
      ? sponsorOffersFor(
          save.reputation,
          nextSeason,
          save.careerSeed,
          save.sponsor?.tier ?? null,
          patienceMissed,
          save.difficulty,
        )
      : null;
  save.sponsor = null;

  // 4. Fresh competition + goals + clock; stars refresh.
  save.competition = emptyCompetition();
  save.seasonGoals = seasonGoalsFor({ rep: save.reputation, seasonIndex: nextSeason });
  save.eventResults = [];
  // v0.3 season-scoped bookkeeping resets.
  save.scheduledScrims = [];
  save.negotiationTries = {};
  save.bidsThisWindow = 0;
  save.lastBidDay = -99;
  save.clock = { seasonIndex: nextSeason, day: 1 };
  save.phase = "running";
  save.finances.freeBootcampsUsedThisSeason = 0;
  save.world = computeStars(save.world, {
    seasonIndex: nextSeason,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
  });

  return processDayArrival(save);
}

export function emptyCompetition(): CareerSave["competition"] {
  const regions: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
  const empty = () =>
    Object.fromEntries(regions.map((r) => [r, {}])) as Record<Region, Record<string, number>>;
  return {
    splitPoints: empty(),
    seasonPoints: empty(),
    majorFieldRefs: null,
    worldsFieldRefs: null,
    newFacesThisSplit: [],
    squadAtSplitStart: [],
    stabilityTierApplied: 0,
  };
}

// ---------------------------------------------------------------------------
// Career creation
// ---------------------------------------------------------------------------

export interface CreateCareerInput {
  identity: CareerIdentity;
  difficulty: CareerDifficulty;
  style: ManagementStyle;
  rosterKey: "prospects" | "journeymen" | "balanced";
}

function prefsFor(style: ManagementStyle): CareerPrefs {
  if (style === "handsOn") {
    return {
      managementStyle: style,
      autoTrain: false,
      autoEnterUnofficials: false,
      playbackDefault: "full",
      newsDigest: false,
    };
  }
  return {
    managementStyle: style,
    autoTrain: true,
    autoEnterUnofficials: true,
    playbackDefault: style === "delegate" ? "instant" : "full",
    newsDigest: true,
  };
}

function squadFromOffer(
  offer: StarterOffer,
  input: CreateCareerInput,
  careerSeed: number,
): SquadPlayer[] {
  return offer.players.map((view) => ({
    id: view.id,
    kind: view.kind,
    name: view.name,
    country: view.country,
    region: view.region,
    birthYear: seasonYear(0) - view.age,
    archetype: view.archetype,
    overall: view.overall,
    attrOffsets: view.attrOffsets,
    potential: view.potential,
    peakAge: view.peakAge,
    declineRate: view.declineRate,
    role: "starter" as const,
    salaryPerSplit: computeSalaryAsk({
      overall: view.overall,
      age: view.age,
      potential: view.potential,
      rep: CAREER_REP.start,
      role: "starter",
      seasonIndex: 0,
      lengthSeasons: 2,
      difficulty: input.difficulty,
      careerSeed,
      playerId: view.id,
    }),
    contractEndSeason: 1,
    trainingFocus: "auto" as const,
    trainingIntensity: "normal" as const,
    scoutLevel: 1 as const,
    splitsTogether: 0,
    joinedSeason: 0,
    gainedThisSplit: 0,
    gainedThisSeason: 0,
  }));
}

export function starterOffersForRegion(region: Region, careerSeed: number): StarterOffer[] {
  return starterRosterOffers(region, careerSeed);
}

export function createCareerSave(input: CreateCareerInput, careerSeed: number): CareerSave {
  let world = buildWorldAtCreation(careerSeed);
  world = computeStars(world, { seasonIndex: 0, careerSeed, difficulty: input.difficulty });

  const offers = starterRosterOffers(input.identity.region, careerSeed);
  const offer = offers.find((o) => o.key === input.rosterKey) ?? offers[0];
  const squad = squadFromOffer(offer, input, careerSeed);

  const save: CareerSave = {
    saveVersion: 5,
    createdAtAppVersion: SITE.version,
    careerSeed,
    identity: input.identity,
    difficulty: input.difficulty,
    prefs: prefsFor(input.style),
    flags: {},
    clock: { seasonIndex: 0, day: 1 },
    phase: "running",
    squad,
    starterIds: [squad[0].id, squad[1].id, squad[2].id],
    foundingSquadIds: squad.map((p) => p.id),
    coach: null,
    finances: {
      balance: CAREER_ECONOMY.startingBudget[input.difficulty],
      ledger: [],
      loan: null,
      loanUsed: false,
      gear: {
        peripherals: false,
        monitors: false,
        pcs: false,
        perfCenter: false,
        psychologist: false,
      },
      bootcampSharp: 0,
      bootcampUsedThisSplit: false,
      freeBootcampsUsedThisSeason: 0,
    },
    sponsor: null,
    // No day-1 sponsorship (v0.1 adjustment) — offers appear once the org has
    // earned a little standing (CAREER_SPONSOR.firstOfferRepGate).
    sponsorOffers: null,
    reputation: CAREER_REP.start,
    competition: emptyCompetition(),
    world,
    activeEvent: null,
    pendingEventDef: null,
    unofficialOffer: null,
    t3EntriesThisSplit: 0,
    scrimsThisWeek: 0,
    scheduledScrims: [],
    scrimLog: [],
    transferLog: [],
    negotiationTries: {},
    bidsThisWindow: 0,
    lastBidDay: -99,
    pendingOffers: [],
    pendingUnavailability: null,
    news: [],
    mail: [],
    firedBeatIds: [],
    scouted: {},
    eventResults: [],
    history: [],
    seasonGoals: seasonGoalsFor({ rep: CAREER_REP.start, seasonIndex: 0 }),
    end: { ended: false, infinite: false },
    stats: {
      seriesWins: 0,
      seriesLosses: 0,
      gameWins: 0,
      gameLosses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      titlesT3: 0,
      titlesT2: 0,
      titlesRegional: 0,
      titlesMajor: 0,
      titlesWorlds: 0,
      majorsQualified: 0,
      worldsQualified: 0,
      totalPrize: 0,
      biggestSigningFee: 0,
      biggestWinName: null,
    },
    seq: 0,
    lastPlayedAt: 0,
  };

  return processDayArrival(save);
}

// ---------------------------------------------------------------------------
// Advance (v0.2 — one day at a time)
// ---------------------------------------------------------------------------

export function advanceDayFlow(input: CareerSave): CareerSave {
  if (input.phase !== "running") return input;
  // An event in progress blocks the clock — EXCEPT a two-day event paused
  // after its Saturday Swiss (R40): moving to Sunday is how its playoffs open.
  const paused = isEventPaused(input);
  if (input.activeEvent && !paused) return input;
  if (input.clock.day >= DAYS_PER_SEASON) return input;
  // rc.2: a pending weekly insert blocks the clock until the player answers.
  if (input.pendingInsert && input.pendingInsert.day === input.clock.day) return input;
  // An OFFICIAL matchday must be resolved (play or sim) — never skipped. The
  // paused Saturday counts as resolved for the day (its Swiss is complete).
  const pending = input.pendingEventDef;
  if (
    pending &&
    !paused &&
    input.clock.day === pending.day &&
    pending.tier !== "t3" &&
    pending.tier !== "t2"
  ) {
    return input;
  }
  const save = clone(input);
  // Advancing past an unofficial matchday declines the invite.
  if (
    pending &&
    save.clock.day === pending.day &&
    (pending.tier === "t3" || pending.tier === "t2")
  ) {
    save.pendingEventDef = null;
    save.unofficialOffer = null;
  }
  save.clock.day += 1;
  return processDayArrival(save);
}

/**
 * v2.0 (R40): "Continue to Championship Sunday" — moves a Major/Worlds paused
 * after its Saturday Swiss to its playoffs day (exactly one day arrival).
 * Returns the SAME save unless `isEventPaused(save)`. (A plain advanceDayFlow
 * does the same on a paused Saturday; this is the intention-revealing name.)
 */
export function continueEventToNextDayFlow(input: CareerSave): CareerSave {
  return isEventPaused(input) ? advanceDayFlow(input) : input;
}

/** True when the save is at a state the batched Advance must stop at. */
function isStopState(save: CareerSave, startedAtDay: number): boolean {
  if (save.phase !== "running") return true;
  const day = save.clock.day;
  // R40: an event in progress — Championship Sunday after the Saturday pause.
  if (save.activeEvent) return true;
  // A committed event's matchday (the lobby): the Saturday qualifier (outside
  // the direct 8), the Sunday regional (direct or qualified), the Saturday
  // Major/Worlds, the Saturday unofficial cup.
  if (save.pendingEventDef && day === save.pendingEventDef.day) return true;
  // A fresh unofficial invite the player hasn't committed to: stop ONCE, on
  // the Monday it surfaces (hands-on players get the decision moment; a
  // second press continues past it toward the matchday / next stop).
  if (
    save.unofficialOffer &&
    !save.pendingEventDef &&
    day !== startedAtDay &&
    dayOfWeekOf(day) === 1
  ) {
    return true;
  }
  // Pending decisions: incoming bids, sponsor offers, a mid-week insert.
  if (save.pendingInsert && save.pendingInsert.day === day) return true;
  if (save.pendingOffers.some((o) => o.status === "pending" && o.direction === "out")) return true;
  if (save.sponsorOffers && save.sponsorOffers.length > 0) return true;
  // A transfer window just opened (its first Monday).
  if (
    day !== startedAtDay &&
    dayOfWeekOf(day) === 1 &&
    isWindowStartWeek(weekOfDay(day))
  ) {
    return true;
  }
  if (day >= DAYS_PER_SEASON) return true;
  return false;
}

/** Batched Advance: keeps stepping days until something needs the player. */
export function advanceToNextStopFlow(input: CareerSave): CareerSave {
  let save = input;
  let guard = 0;
  const startedAt = input.clock.day;
  while (guard < DAYS_PER_SEASON + 7) {
    guard += 1;
    const before = save.clock.day;
    save = advanceDayFlow(save);
    if (save.clock.day === before) break; // blocked (event lobby / season end)
    if (isStopState(save, startedAt)) break;
  }
  return save;
}

// ---------------------------------------------------------------------------
// User market actions (immediate resolution, window-gated)
// ---------------------------------------------------------------------------

export interface FlowResult {
  save: CareerSave;
  error?: string;
}

function removePlayerFromWorld(save: CareerSave, playerId: string): void {
  const viewCtx = {
    careerSeed: save.careerSeed,
    seasonIndex: save.clock.seasonIndex,
    world: save.world,
  };
  save.world.freeAgentIds = save.world.freeAgentIds.filter((id) => id !== playerId);
  for (const org of Object.values(save.world.orgs)) {
    const idx = org.playerIds.indexOf(playerId);
    if (idx < 0) continue;
    let best: string | null = null;
    let bestOvr = -1;
    for (const id of save.world.freeAgentIds) {
      const v = playerViewById(id, viewCtx);
      if (v && v.region === org.region && v.overall > bestOvr) {
        bestOvr = v.overall;
        best = id;
      }
    }
    if (best) {
      org.playerIds[idx] = best;
      save.world.freeAgentIds = save.world.freeAgentIds.filter((id) => id !== best);
    }
  }
  save.world.version += 1;
}

/** The negotiation bookkeeping key for this player in the current window. */
function negotiationKeyFor(save: CareerSave, playerId: string): string {
  const week = weekOfDay(save.clock.day);
  const bucket = windowIndexOf(week) !== null ? `w${windowIndexOf(week)}` : `s${splitOfWeek(week) ?? 0}`;
  return `${playerId}:${save.clock.seasonIndex}:${bucket}`;
}

export function negotiationTriesFor(save: CareerSave, playerId: string): number {
  return save.negotiationTries?.[negotiationKeyFor(save, playerId)] ?? 0;
}

/**
 * v0.3 negotiation resolution shared by sign + renew: `offered` below the ask
 * consults the hidden reserve. Returns the salary to write, or an error key —
 * and on rejection the tries counter is persisted on the DRAFT save (the
 * caller returns it so the player visibly hardens).
 */
function resolveSalaryOffer(
  save: CareerSave,
  playerId: string,
  ask: number,
  offered: number | undefined,
): { salary: number } | { error: string } {
  if (offered === undefined || offered >= ask) return { salary: ask };
  if (offered < quantize(ask * CAREER_NEGOTIATION.minOfferFactor)) return { error: "lowball" };
  const key = negotiationKeyFor(save, playerId);
  const tries = save.negotiationTries[key] ?? 0;
  const week = weekOfDay(save.clock.day);
  const accepted = negotiationAccepts({
    careerSeed: save.careerSeed,
    playerId,
    seasonIndex: save.clock.seasonIndex,
    windowKey: windowIndexOf(week) !== null ? `w${windowIndexOf(week)}` : `s${splitOfWeek(week) ?? 0}`,
    offered,
    ask,
    rejects: tries,
  });
  if (!accepted) {
    save.negotiationTries[key] = tries + 1;
    return { error: tries + 1 >= CAREER_NEGOTIATION.maxRejects ? "negotiationLocked" : "negotiationRejected" };
  }
  return { salary: offered };
}

/**
 * ECO-03 (R47): everything a signing would move, validated BEFORE anything
 * moves — the flow applies exactly this plan and the offer sheet renders it,
 * so the screen can never quote a different deal. The price is the player's
 * normal value whatever slot he takes (no "signed as a sub" discount); a full
 * squad must name who leaves (`releaseId`, released with severance in the
 * same operation). He lands in an open seat of the starting three, otherwise
 * in the reserve slot — the lineup is the player's call afterwards, and a
 * promotion never renegotiates (`setStartersFlow`).
 */
export interface SigningPlan {
  view: CareerPlayerView;
  /** The org he leaves (a fee transfer), null for a free agent. */
  fromRef: string | null;
  pack: AskPackage;
  /** The squad player the user chose to release for the slot, if any. */
  leaver: SquadPlayer | null;
  severance: number;
  /** Fee + signing bonus + severance: what the signing moves today. */
  cost: number;
  /** An open seat in the starting three, or the reserve slot. */
  slot: "starter" | "reserve";
  /**
   * DEV-02 (R48): this season must be his last (`signsForFinalSeason`: the
   * coming rollover retires him for sure) — he signs with his final season
   * announced and only for it.
   */
  finalSeason: boolean;
  /** The contract the plan prices and writes: 1 season for a final-season signing. */
  lengthSeasons: 1 | 2 | 3;
  /** rc.32 (M8): outside a window — the late signing a window sale opened (a free agent only). */
  lateSigning: boolean;
}

export function signingPlanFor(
  save: CareerSave,
  playerId: string,
  opts: { lengthSeasons: 1 | 2 | 3; releaseId?: string },
): { plan: SigningPlan } | { error: string } {
  if (save.activeEvent) return { error: "rosterLocked" }; // rc.30: roster moves wait for the event
  // rc.32 (M8, provisional): outside a window only the late signing a window sale opened.
  const lateSigning = !isWindowWeek(weekOfDay(save.clock.day));
  if (lateSigning && !lateSigningOpen(save)) return { error: "windowClosed" };
  if (save.squad.some((p) => p.id === playerId)) return { error: "alreadySigned" };
  const leaver = opts.releaseId ? (save.squad.find((p) => p.id === opts.releaseId) ?? null) : null;
  if (opts.releaseId && !leaver) return { error: "invalid" };

  const viewCtx = {
    careerSeed: save.careerSeed,
    seasonIndex: save.clock.seasonIndex,
    world: save.world,
  };
  const view = playerViewById(playerId, viewCtx);
  if (!view) return { error: "unavailable" };
  const onOrg = Object.values(save.world.orgs).find((o) => o.playerIds.includes(playerId));
  // rc.32 (M8): the late seat takes a free agent only — say so before any other reason.
  if (lateSigning && onOrg) return { error: "windowClosed" };
  // DEV-02 (R48): signable (and so playable) from the minimum competitive age, 13.
  if (!isCompetitiveAge(view.age)) return { error: "tooYoung" };

  // v0.3 visible signing gate: new signings accept only up to the rep cap.
  if (Math.round(view.overall) > signableOverallCap(save.reputation)) return { error: "repGate" };

  // ECO-03 (R47): a full squad asks who leaves — never a silent release or demotion.
  if (save.squad.length - (leaver ? 1 : 0) >= CAREER_CONTRACT.squadCap) return { error: "squadFull" };

  // DEV-02 (R48): a player whose season now must be his last (the coming
  // rollover retires him for sure) signs for that final season only — he
  // never plays at 30 for the user.
  const finalSeason = signsForFinalSeason(view, save.clock.seasonIndex);
  const lengthSeasons = finalSeason ? 1 : opts.lengthSeasons;

  const pack = askPackageFor(view, {
    rep: save.reputation,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
    lengthSeasons,
    contracted: onOrg
      ? { splitsRemaining: contractedSplitsRemaining(playerId, save.clock.seasonIndex, save.careerSeed) }
      : undefined,
  });
  const severance = leaver ? severanceFor(leaver, save.clock.seasonIndex) : 0;
  const cost = pack.fee + pack.signingBonus + severance;
  if (save.finances.balance - cost < backerLineOf(save).floor) return { error: "funds" };
  if (pack.fee > 0 && save.finances.loan) return { error: "loanActive" };
  // rc.32 (M4, provisional): while the Backer is owed, no signing that shortens the runway —
  // except a free agent into an empty starting seat (a restructuring can sell a squad down
  // below three; the org must be able to field its own three again, never a soft lock).
  const bill = payrollProjection({
    squadSalaries: save.squad.map((p) => ({ id: p.id, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    remove: leaver ? [leaver.id] : [],
    add: [pack.salaryPerSplit],
  });
  const refillsEmptySeat = !onOrg && !leaver && save.squad.length < 3;
  if (!refillsEmptySeat && backerLocks(save, cost, bill.after - bill.now)) return { error: "loanRunway" };

  const openSeats =
    3 - save.starterIds.filter((id) => id !== leaver?.id && save.squad.some((p) => p.id === id)).length;
  return {
    plan: {
      view,
      fromRef: onOrg?.ref ?? null,
      pack,
      leaver,
      severance,
      cost,
      slot: openSeats > 0 ? "starter" : "reserve",
      finalSeason,
      lengthSeasons,
      lateSigning,
    },
  };
}

/**
 * Release a squad player into free agency, paying `severance` (one ledger
 * line). `refill` false = a signing takes his seat right after (the caller
 * syncs the lineup), so the reserve is not promoted into it in between.
 */
function releaseFromSquad(save: CareerSave, player: SquadPlayer, severance: number, refill = true): void {
  save.finances = pushLedger(save.finances, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    kind: "severance",
    amount: -severance,
    refName: player.name,
  });
  save.squad = save.squad.filter((p) => p.id !== player.id);
  if (refill) syncSquadRoles(save);
  // A pending bid for him can no longer complete.
  save.pendingOffers = save.pendingOffers.filter((o) => o.playerId !== player.id || o.direction !== "out");
  pruneListings(save); // rc.32 (M8): nor can a listing
  save.world.freeAgentIds.push(player.id);
  save.world.version += 1;
  pushNews(save, {
    type: "transfer",
    priority: 2,
    titleKey: "userReleased",
    params: { player: player.name, org: save.identity.orgName },
  });
}

export function signPlayerFlow(
  input: CareerSave,
  playerId: string,
  opts: {
    /**
     * @deprecated ECO-03 (R47): the slot is decided by the squad (an open seat
     * in the starting three, else the reserve slot) and never prices the deal.
     * Kept optional so older callers compile; ignored.
     */
    role?: "starter" | "sub";
    lengthSeasons: 1 | 2 | 3;
    /** v0.3 negotiation: counter-offer below the ask (omit = pay the ask). */
    offeredSalary?: number;
    /** ECO-03 (R47): with a full squad, who leaves (released, severance paid) in the same operation. */
    releaseId?: string;
  },
): FlowResult {
  const planned = signingPlanFor(input, playerId, opts);
  if ("error" in planned) return { save: input, error: planned.error };
  const { view, pack, leaver, severance, slot, fromRef, finalSeason, lengthSeasons, lateSigning } = planned.plan;
  const save = clone(input);

  // v0.3 negotiation: a counter-offer may sign cheaper — or harden the agent.
  // A rejection keeps only the hardened counter: no money and no slot moves.
  const negotiated = resolveSalaryOffer(save, playerId, pack.salaryPerSplit, opts.offeredSalary);
  if ("error" in negotiated) return { save: capNews(save), error: negotiated.error };
  const finalSalary = negotiated.salary;

  // ECO-03 (R47): from here everything moves together — the leaver and his
  // severance, the fee, the bonus, the wage and the slot.
  if (leaver) releaseFromSquad(save, leaver, severance, false);
  if (pack.fee > 0) {
    save.finances = pushLedger(save.finances, {
      seasonIndex: save.clock.seasonIndex,
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      kind: "transferOut",
      amount: -pack.fee,
      refName: view.name,
    });
    save.stats.biggestSigningFee = Math.max(save.stats.biggestSigningFee, pack.fee);
  }
  if (pack.signingBonus > 0) {
    save.finances = pushLedger(save.finances, {
      seasonIndex: save.clock.seasonIndex,
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      kind: "signingBonus",
      amount: -pack.signingBonus,
      refName: view.name,
    });
  }

  removePlayerFromWorld(save, playerId);
  // Signing a real player takes him off his script forever.
  if (view.kind === "real" && !(playerId in save.world.overallDelta)) {
    save.world.overallDelta[playerId] = 0;
  }

  const scoutLevel = Math.min(
    CAREER_SCOUT.reportMaxLevel,
    Math.max(0, Number(save.scouted[playerId] ?? 0)),
  ) as 0 | 1 | 2;

  save.squad.push({
    id: view.id,
    kind: view.kind,
    name: view.name,
    country: view.country,
    region: view.region,
    birthYear: seasonYear(save.clock.seasonIndex) - view.age,
    archetype: view.archetype,
    overall: view.overall,
    attrOffsets: view.attrOffsets,
    potential: view.potential,
    peakAge: view.peakAge,
    declineRate: view.declineRate,
    role: slot === "starter" ? "starter" : "sub",
    salaryPerSplit: finalSalary,
    contractEndSeason: save.clock.seasonIndex + lengthSeasons,
    trainingFocus: "auto",
    trainingIntensity: "normal",
    scoutLevel,
    splitsTogether: 0,
    joinedSeason: save.clock.seasonIndex,
    gainedThisSplit: 0,
    gainedThisSeason: 0,
    // DEV-02 (R48): announced at signing — he retires at the coming rollover.
    ...(finalSeason ? { finalSeasonAnnounced: true } : {}),
  });
  // He takes the open seat — the leaver's own seat when a starter left —
  // otherwise he is the reserve and nobody is demoted. syncSquadRoles stays
  // the single source of truth for starterIds + roles.
  if (slot === "starter") {
    const seats = [...save.starterIds];
    const seat = seats.findIndex((id) => !save.squad.some((p) => p.id === id && p.id !== view.id));
    if (seat >= 0) seats[seat] = view.id;
    save.starterIds = seats as [string, string, string];
  }
  syncSquadRoles(save);

  logTransfer(save, {
    playerId: view.id,
    playerName: view.name,
    fromRef,
    toRef: "user",
    fee: pack.fee,
    kind: "userIn",
    region: save.identity.region,
  });
  pushNews(save, {
    type: "transfer",
    priority: 2,
    titleKey: "userSigned",
    params: { player: view.name, org: save.identity.orgName },
  });
  // rc.32 (M8): the late seat is used — one per window.
  if (lateSigning && save.lateSigning) save.lateSigning = { ...save.lateSigning, used: true };
  return { save: capNews(save) };
}

export function releasePlayerFlow(input: CareerSave, playerId: string): FlowResult {
  // rc.30 (review): the event's team froze at startEvent — a release mid-event
  // (a Major paused overnight) changed the squad while Sunday fielded the old one.
  if (input.activeEvent) return { save: input, error: "rosterLocked" };
  const save = clone(input);
  const player = save.squad.find((p) => p.id === playerId);
  if (!player) return { save: input, error: "unknown" };
  releaseFromSquad(save, player, severanceFor(player, save.clock.seasonIndex));
  return { save: capNews(save) };
}

export function renewPlayerFlow(
  input: CareerSave,
  playerId: string,
  lengthSeasons: 1 | 2 | 3,
  /** v0.3 negotiation: counter-offer below the fresh ask (omit = pay it). */
  offeredSalary?: number,
): FlowResult {
  const save = clone(input);
  const player = save.squad.find((p) => p.id === playerId);
  if (!player) return { save: input, error: "unknown" };
  // ECO-03 (R47): a reserve renews at his normal value, like a starter — and
  // an old save's cheap sub contract reprices here, never retroactively.
  const ask = renewalAskFor(player, {
    rep: save.reputation,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
    lengthSeasons,
  });
  const negotiated = resolveSalaryOffer(save, playerId, ask, offeredSalary);
  if ("error" in negotiated) return { save, error: negotiated.error };
  player.salaryPerSplit = negotiated.salary;
  player.contractEndSeason = save.clock.seasonIndex + lengthSeasons;
  return { save };
}

export function declineBidFlow(input: CareerSave, offerId: string): CareerSave {
  const save = clone(input);
  const offer = save.pendingOffers.find((o) => o.id === offerId);
  save.pendingOffers = save.pendingOffers.filter((o) => o.id !== offerId);
  if (offer) {
    // rc.32: refusing a Blockbuster surcharges his next renewal (the offer and
    // the mail say so); declining a listing's offer keeps him and ends it.
    stampBlockbusterRefusal(save, offer);
    if (offer.listing && save.saleListings) {
      save.saleListings = save.saleListings.filter((l) => l.playerId !== offer.playerId);
    }
  }
  return save;
}

/**
 * rc.32 M8 (ECONOMY-CONTRACT §6 decision 8-B — provisional): "List for sale".
 * A squad player under contract goes on the market: after
 * CAREER_TRANSFER.listingOfferDays eligible window days (never the career's
 * bid-free first window, R47) an AI org of his region that would field him
 * offers market value × listingOfferRange. Accept it like any bid (atomic,
 * the Backer's share included), decline it (he stays, the listing ends) or
 * withdraw the listing first.
 */
export function listForSaleFlow(input: CareerSave, playerId: string): FlowResult {
  if (input.phase === "ended") return { save: input, error: "blocked" };
  if (!CAREER_TRANSFER.listingEnabled) return { save: input, error: "listingOff" };
  const player = input.squad.find((p) => p.id === playerId);
  if (!player) return { save: input, error: "unknown" };
  if ((input.saleListings ?? []).some((l) => l.playerId === playerId)) return { save: input, error: "alreadyListed" };
  const save = clone(input);
  const { seasonIndex, day } = save.clock;
  save.saleListings = [
    ...(save.saleListings ?? []),
    { playerId, seasonIndex, day, waitDays: listingWaitDaysFor(playerId, seasonIndex, day, save.careerSeed) },
  ];
  pushNews(save, { type: "transfer", priority: 1, titleKey: "listed", params: { player: player.name } });
  return { save: capNews(save) };
}

/** rc.32 M8: take a player off the market — the listing and any offer it drew. */
export function withdrawListingFlow(input: CareerSave, playerId: string): FlowResult {
  if (!(input.saleListings ?? []).some((l) => l.playerId === playerId)) return { save: input, error: "none" };
  const save = clone(input);
  save.saleListings = (save.saleListings ?? []).filter((l) => l.playerId !== playerId);
  save.pendingOffers = save.pendingOffers.filter((o) => !(o.listing && o.playerId === playerId));
  return { save };
}

// ---------------------------------------------------------------------------
// Purchases (gear ladder), staff & scouting
// ---------------------------------------------------------------------------

export function buyGearFlow(input: CareerSave, itemId: GearItemId): FlowResult {
  const save = clone(input);
  const next = gearNextItem(save.finances.gear);
  if (!next) return { save: input, error: "maxed" };
  if (next.id !== itemId) return { save: input, error: "locked" }; // strict ladder order
  if (save.reputation < next.repGate) return { save: input, error: "locked" };
  if (save.finances.loan) return { save: input, error: "loanActive" };
  const cost = gearPriceFor(next.cost, save.sponsor?.tier ?? null, save.clock.seasonIndex);
  if (save.finances.balance - cost < backerLineOf(save).floor) return { save: input, error: "funds" };
  save.finances = pushLedger(save.finances, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    kind: "facility",
    amount: -cost,
    refName: itemId,
  });
  save.finances.gear[itemId] = true;
  pushNews(save, { type: "org", priority: 2, titleKey: "gearBought", params: { name: itemId } });
  return { save };
}

export function setPsychologistFlow(input: CareerSave, on: boolean): FlowResult {
  const save = clone(input);
  if (on && !unlocksFor(save.reputation).psychologist) return { save: input, error: "locked" };
  // rc.32 (M4, provisional): a new retainer while the Backer is owed must not shorten the runway.
  if (on && !save.finances.gear.psychologist) {
    const withRetainer = weeklyStatementOf({ ...save, finances: { ...save.finances, gear: { ...save.finances.gear, psychologist: true } } });
    if (backerLocks(save, 0, weeklyStatementOf(save).net - withRetainer.net)) return { save: input, error: "loanRunway" };
  }
  save.finances.gear.psychologist = on;
  return { save };
}

export function runBootcampFlow(input: CareerSave): FlowResult {
  const save = clone(input);
  const tier = bootcampTierFor(save.reputation);
  if (tier === 0) return { save: input, error: "locked" };
  if (save.finances.bootcampUsedThisSplit) return { save: input, error: "used" };
  const camp = CAREER_GEAR.bootcamp[tier - 1];
  const campCost = bootcampCostFor(tier, save.clock.seasonIndex); // rc.32 (M1): indexed

  // Sponsor perk: free bootcamps per season (tier 3+ deals).
  const freeAllowance = save.sponsor
    ? (CAREER_SPONSOR.tiers[save.sponsor.tier - 1]?.freeBootcampsPerSeason ?? 0)
    : 0;
  const isFree = save.finances.freeBootcampsUsedThisSeason < freeAllowance;
  if (!isFree && save.finances.balance - campCost < backerLineOf(save).floor) {
    return { save: input, error: "funds" };
  }
  if (isFree) {
    save.finances.freeBootcampsUsedThisSeason += 1;
  } else {
    save.finances = pushLedger(save.finances, {
      seasonIndex: save.clock.seasonIndex,
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      kind: "buff",
      amount: -campCost,
      refName: "Bootcamp",
    });
  }
  save.finances.bootcampSharp = camp.sharpRating;
  save.finances.bootcampUsedThisSplit = true;
  // Shared-week grind: a permanent chemistry-accrual bump (time-together
  // convention; the structured camp bonds harder).
  for (const p of save.squad) p.splitsTogether += camp.chemistryCredit;
  pushNews(save, {
    type: "org",
    priority: 2,
    titleKey: "bootcampRun",
    params: { tier },
  });
  return { save };
}

export function buyScoutReportFlow(input: CareerSave, playerId: string): FlowResult {
  const save = clone(input);
  const cost = scoutReportCostFor(save.clock.seasonIndex); // rc.32 (M1): indexed
  if (save.finances.balance - cost < backerLineOf(save).floor) {
    return { save: input, error: "funds" };
  }
  const current = Number(save.scouted[playerId] ?? 0);
  if (current >= CAREER_SCOUT.reportMaxLevel) return { save: input, error: "maxed" };
  save.finances = pushLedger(save.finances, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    kind: "buff",
    amount: -cost,
    refName: "Scout report",
  });
  save.scouted[playerId] = CAREER_SCOUT.reportMaxLevel;
  return { save };
}

/**
 * Coach candidates for the current window (v0.2 coach market: real retired
 * pros + generated names). Derived, never persisted.
 */
export function coachCandidatesFor(save: CareerSave): CoachState[] {
  return marketCoachCandidates({
    world: save.world,
    region: save.identity.region,
    seasonIndex: save.clock.seasonIndex,
    windowIdx: windowIndexOf(weekOfDay(save.clock.day)) ?? 0,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
    nameBank: [...playerNameBankFor(save.identity.region, save.world.nameBankVersion)],
  });
}

export function hireCoachFlow(input: CareerSave, coach: CoachState): FlowResult {
  const save = clone(input);
  // v0.3: a coach is earned early — hiring unlocks at CAREER_UNLOCKS.coachRep.
  if (save.reputation < CAREER_UNLOCKS.coachRep) return { save: input, error: "repGate" };
  // Validate the candidate came from the current shortlist (no injected coaches).
  const candidates = coachCandidatesFor(save);
  const valid = candidates.find((c) => c.id === coach.id);
  if (!valid) return { save: input, error: "unknown" };
  if (save.coach?.id === valid.id) return { save: input, error: "alreadySigned" };
  // rc.32 (M4, provisional): while the Backer is owed, a hire must not shorten the runway.
  const coachWeeklyDelta =
    weeklyWageBill([], valid.salaryPerSplit) - weeklyWageBill([], save.coach?.salaryPerSplit ?? null);
  if (backerLocks(save, save.coach?.salaryPerSplit ?? 0, coachWeeklyDelta)) return { save: input, error: "loanRunway" };
  // Replacing a coach pays one split of severance (rolling deal).
  if (save.coach) {
    save.finances = pushLedger(save.finances, {
      seasonIndex: save.clock.seasonIndex,
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      kind: "severance",
      amount: -save.coach.salaryPerSplit,
      refName: save.coach.name,
    });
  }
  save.coach = valid;
  pushNews(save, {
    type: "org",
    priority: 2,
    titleKey: "coachHired",
    params: { coach: valid.name, org: save.identity.orgName },
  });
  return { save };
}

export function fireCoachFlow(input: CareerSave): FlowResult {
  const save = clone(input);
  if (!save.coach) return { save: input, error: "none" };
  save.finances = pushLedger(save.finances, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    kind: "severance",
    amount: -save.coach.salaryPerSplit,
    refName: save.coach.name,
  });
  save.coach = null;
  return { save };
}

// ---------------------------------------------------------------------------
// Scrims (v0.3 — schedulable, opponent choice, visible results)
// ---------------------------------------------------------------------------

export interface ScrimCandidate {
  ref: string;
  name: string;
  rating: number;
  /** Signed rating gap vs the user team (negative = weaker sparring). */
  gap: number;
  stars: number;
}

/** Nearest-strength regional orgs — the Training screen's opponent shortlist. */
export function scrimShortlistFor(save: CareerSave): ScrimCandidate[] {
  const region = save.identity.region;
  const userRating = approxUserRating(save);
  return Object.values(save.world.orgs)
    .filter((o) => o.region === region)
    .map((o) => {
      const rating = o.rating ?? 70 + o.prestige * 6;
      return {
        ref: o.ref,
        name: o.name,
        rating,
        gap: Math.round((rating - userRating) * 10) / 10,
        stars: o.stars,
      };
    })
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap) || a.ref.localeCompare(b.ref))
    .slice(0, CAREER_SCRIM.shortlistSize);
}

/** Org refs already scrimmed today (a same-day rematch is never offered). */
function todaysScrimOpponents(save: CareerSave): Set<string> {
  return new Set(
    save.scrimLog
      .filter((e) => e.seasonIndex === save.clock.seasonIndex && e.day === save.clock.day)
      .map((e) => e.oppRef),
  );
}

/** The auto-picked scrim opponent (derived; excludes today's opponents). */
export function scrimOpponentFor(save: CareerSave): { ref: string; name: string } | null {
  const region = save.identity.region;
  const userRating = approxUserRating(save);
  const exclude = todaysScrimOpponents(save);
  const candidates = Object.values(save.world.orgs)
    .filter((o) => o.region === region && !exclude.has(o.ref))
    .map((o) => ({
      ref: o.ref,
      name: o.name,
      gap: Math.abs((o.rating ?? 70 + o.prestige * 6) - userRating),
    }))
    .sort((a, b) => a.gap - b.gap || a.ref.localeCompare(b.ref));
  const band = candidates.filter((c) => c.gap <= CAREER_SCRIM.ratingBand);
  const pool = band.length > 0 ? band : candidates.slice(0, 4);
  if (pool.length === 0) return null;
  const n = todaysScrimOpponents(save).size;
  const pick = Math.floor(
    derivedFloat(
      save.careerSeed,
      streams.gen("scrim", `${save.clock.seasonIndex}:${save.clock.day}:${n}`),
    ) * pool.length,
  );
  return pool[Math.min(pick, pool.length - 1)];
}

export interface ScrimOutcome {
  opponentName: string;
  won: boolean;
  score: [number, number];
}

/**
 * The scrim core (mutates the draft save): one Bo5 vs the chosen (or
 * auto-picked) org — chemistry credit + light match XP, a game-by-game log
 * entry and a news line. Returns an error key, or null on success.
 */
function performScrim(save: CareerSave, oppRefWanted: string | null): string | null {
  const dow = dayOfWeekOf(save.clock.day);
  if (save.phase !== "running" || save.activeEvent) return "blocked";
  if (dow > CAREER_TRAINING.trainingDaysPerWeek) return "restDay";
  if (save.scrimsThisWeek >= CAREER_SCRIM.maxPerWeek) return "used";

  let opponent: { ref: string; name: string } | null = null;
  if (oppRefWanted) {
    const org = save.world.orgs[oppRefWanted];
    if (!org || org.region !== save.identity.region) return "unavailable";
    if (todaysScrimOpponents(save).has(org.ref)) return "sameDay";
    opponent = { ref: org.ref, name: org.name };
  } else {
    opponent = scrimOpponentFor(save);
  }
  if (!opponent) return "unavailable";

  const { team } = userTeamFor({
    identity: save.identity,
    squad: save.squad,
    starterIds: save.starterIds,
    coach: save.coach,
    gear: save.finances.gear,
    bootcampSharp: 0,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
  });
  const oppTeam = orgTeamFor(opponent.ref, {
    world: save.world,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
  });
  const n = todaysScrimOpponents(save).size;
  const rng = createRng(
    deriveSeed(save.careerSeed, `scrim:${save.clock.seasonIndex}:${save.clock.day}:${n}`),
  );
  const series = simulateSeries(
    team,
    oppTeam,
    { bestOf: TOURNAMENT.swiss.bestOf, stage: "swiss", difficulty: save.difficulty },
    rng,
  );
  const won = series.winnerTeamId === "user";
  const score: [number, number] = [series.score[0], series.score[1]];
  // Game scores oriented user-first (engine stores winner-first per game).
  const games = series.games.map((g) => {
    const userWon = g.winnerTeamId === "user";
    return userWon ? `${g.score[0]}-${g.score[1]}` : `${g.score[1]}-${g.score[0]}`;
  });

  // Chemistry credit + light match XP for the fielded squad.
  const oppRating = save.world.orgs[opponent.ref]?.rating ?? 74;
  const quality = fieldQualityFor([oppRating]);
  const gearBonus = gearTrainingBonus(save.finances.gear);
  for (const p of save.squad) {
    p.splitsTogether += CAREER_SCRIM.chemistryCredit;
    const isSub = !save.starterIds.includes(p.id);
    const next = applyMatchXp(p, {
      seasonIndex: save.clock.seasonIndex,
      fieldQuality: quality,
      isSub,
      coachOverall: save.coach?.overall ?? null,
      gearBonus,
      xpWeeksOverride: CAREER_SCRIM.xpWeeks,
    });
    Object.assign(p, next);
  }
  save.scrimsThisWeek += 1;

  const entry: ScrimLogEntry = {
    id: `s:${nextSeq(save)}`,
    seasonIndex: save.clock.seasonIndex,
    day: save.clock.day,
    oppRef: opponent.ref,
    oppName: opponent.name,
    won,
    scoreA: score[0],
    scoreB: score[1],
    games,
  };
  save.scrimLog.unshift(entry);
  if (save.scrimLog.length > CAREER_SAVE.scrimLogCap) {
    save.scrimLog.length = CAREER_SAVE.scrimLogCap;
  }

  // Priority 2: your team's result — it also surfaces as an autoplay toast.
  pushNews(save, {
    type: "training",
    priority: 2,
    titleKey: won ? "scrimWin" : "scrimLoss",
    params: { opponent: opponent.name, a: score[0], b: score[1] },
  });
  return null;
}

/** Run a scrim block right now (optionally vs a chosen shortlist opponent). */
export function runScrimFlow(
  input: CareerSave,
  oppRef?: string | null,
): FlowResult & { outcome?: ScrimOutcome } {
  const save = clone(input);
  const err = performScrim(save, oppRef ?? null);
  if (err) return { save: input, error: err };
  const last = save.scrimLog[0];
  return {
    save: capNews(save),
    outcome: { opponentName: last.oppName, won: last.won, score: [last.scoreA, last.scoreB] },
  };
}

/**
 * v0.3: book a scrim ahead from the Training screen — it runs automatically
 * when the day arrives and shows on the calendar as a training event.
 */
export function scheduleScrimFlow(input: CareerSave, day: number, oppRef: string): FlowResult {
  const save = clone(input);
  if (save.phase !== "running") return { save: input, error: "blocked" };
  const today = save.clock.day;
  if (day <= today || day > DAYS_PER_SEASON) return { save: input, error: "invalid" };
  if (day - today > CAREER_SCRIM.scheduleHorizonDays) return { save: input, error: "invalid" };
  if (dayOfWeekOf(day) > CAREER_TRAINING.trainingDaysPerWeek) {
    return { save: input, error: "restDay" };
  }
  const org = save.world.orgs[oppRef];
  if (!org || org.region !== save.identity.region) return { save: input, error: "unavailable" };
  // Weekly cap counts booked + already-run scrims of that week.
  const week = weekOfDay(day);
  const bookedThatWeek = save.scheduledScrims.filter((s) => weekOfDay(s.day) === week).length;
  const runThatWeek = week === weekOfDay(today) ? save.scrimsThisWeek : 0;
  if (bookedThatWeek + runThatWeek >= CAREER_SCRIM.maxPerWeek) {
    return { save: input, error: "used" };
  }
  // Never two scrims vs the same org on the same day.
  if (save.scheduledScrims.some((s) => s.day === day && s.oppRef === oppRef)) {
    return { save: input, error: "sameDay" };
  }
  save.scheduledScrims.push({ day, oppRef });
  save.scheduledScrims.sort((a, b) => a.day - b.day);
  return { save };
}

/** Cancel a booked scrim (by day; removes every booking on that day). */
export function cancelScrimFlow(input: CareerSave, day: number): FlowResult {
  const save = clone(input);
  const before = save.scheduledScrims.length;
  save.scheduledScrims = save.scheduledScrims.filter((s) => s.day !== day);
  if (save.scheduledScrims.length === before) return { save: input, error: "unknown" };
  return { save };
}

/**
 * Engine-truth benefit preview for a scrim vs `oppRef` (Training screen):
 * field quality, XP-week equivalents, chemistry credit and the projected
 * average overall gain across current starters (pre-cap, like
 * trainingProjection).
 */
export function scrimProjection(
  save: CareerSave,
  oppRef: string,
): { quality: number; xpWeeks: number; chemistryCredit: number; avgOverallGain: number } {
  const oppRating = save.world.orgs[oppRef]?.rating ?? 74;
  const quality = fieldQualityFor([oppRating]);
  const weeks = CAREER_SCRIM.xpWeeks * quality;
  const gearBonus = gearTrainingBonus(save.finances.gear);
  const starters = save.squad.filter((p) => save.starterIds.includes(p.id));
  const gains = starters.map(
    (p) =>
      trainingProjection(p, {
        seasonIndex: save.clock.seasonIndex,
        coachOverall: save.coach?.overall ?? null,
        gearBonus,
        trainingWeekBonus: false,
      }).weeklyOverall * weeks,
  );
  const avg = gains.length > 0 ? gains.reduce((s, g) => s + g, 0) / gains.length : 0;
  return {
    quality,
    xpWeeks: weeks,
    chemistryCredit: CAREER_SCRIM.chemistryCredit,
    avgOverallGain: Math.round(avg * 100) / 100,
  };
}

export function chooseSponsorFlow(input: CareerSave, sponsorId: string): FlowResult {
  const save = clone(input);
  save.flags[ACH_FLAGS.sponsorSigned] = true;
  const offer = save.sponsorOffers?.find((o) => o.sponsorId === sponsorId);
  if (!offer) return { save: input, error: "unknown" };
  save.sponsor = { ...offer, progress: 0, hitThisSplit: false, missedCount: 0 };
  save.sponsorOffers = null;
  save.finances = pushLedger(save.finances, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    kind: "sponsorSigning",
    amount: offer.basePerSplit * CAREER_SPONSOR.signingBonusSplits,
    refName: offer.sponsorId,
  });
  pushNews(save, {
    type: "org",
    priority: 2,
    titleKey: "sponsorSigned",
    params: { org: save.identity.orgName, name: offer.sponsorId },
  });
  // rc.32 (M3): past its minimum term, the first real deal ends the founding partner.
  if (foundingPartnerEnds(save.foundingPartner, save.clock.seasonIndex, true)) closeFoundingPartner(save);
  return { save: capNews(save) };
}

// ---------------------------------------------------------------------------
// Squad management
// ---------------------------------------------------------------------------

export function setStartersFlow(
  input: CareerSave,
  starterIds: [string, string, string],
): FlowResult {
  // R40 review: the event's team froze at startEvent (a Major / Worlds pauses
  // overnight) — the lineup is locked until the event ends, so a change can
  // never look like it applies to Sunday's playoffs.
  if (input.activeEvent) return { save: input, error: "eventLocked" };
  const save = clone(input);
  const ids = new Set(starterIds);
  if (ids.size !== 3) return { save: input, error: "invalid" };
  for (const id of starterIds) {
    if (!save.squad.some((p) => p.id === id)) return { save: input, error: "invalid" };
  }
  save.starterIds = starterIds;
  syncSquadRoles(save);
  return { save };
}

export function setTrainingFocusFlow(
  input: CareerSave,
  playerId: string,
  focus: SquadPlayer["trainingFocus"],
): CareerSave {
  const save = clone(input);
  const p = save.squad.find((x) => x.id === playerId);
  if (p) p.trainingFocus = focus;
  return save;
}

export function setTrainingIntensityFlow(
  input: CareerSave,
  playerId: string,
  intensity: SquadPlayer["trainingIntensity"],
): CareerSave {
  const save = clone(input);
  const p = save.squad.find((x) => x.id === playerId);
  if (p) p.trainingIntensity = intensity;
  return save;
}

// ---------------------------------------------------------------------------
// Save migration (v1 week clock → v2 day clock + gear + mail)
// ---------------------------------------------------------------------------

/**
 * Upgrade a persisted save in place to saveVersion 2. Additive-forever
 * policy: derive the day clock from the old week, map the facilities scalar
 * onto the gear ladder, seed the new fields. Safe to call on any save.
 */
export function migrateSaveToV2(raw: unknown): CareerSave | null {
  if (!raw || typeof raw !== "object") return null;
  const save = raw as CareerSave & {
    clock: { seasonIndex: number; week?: number; day?: number };
    finances: CareerSave["finances"] & {
      facilities?: number;
      psychologist?: boolean;
      bootcampSharp: number | boolean;
    };
    pendingOffers: (TransferOffer & { resolveWeek?: number })[];
  };
  if ((save.saveVersion ?? 1) >= 2) return save as CareerSave;

  const week = Math.max(1, Math.min(CAREER_CALENDAR.weeksPerSeason, save.clock.week ?? 1));
  save.clock = {
    seasonIndex: save.clock.seasonIndex ?? 0,
    day: (week - 1) * CAREER_CALENDAR.daysPerWeek + 1,
  };

  const fac = save.finances.facilities ?? 0;
  save.finances.gear = {
    peripherals: fac >= 1,
    monitors: fac >= 1,
    pcs: fac >= 2,
    perfCenter: fac >= 3,
    psychologist: !!save.finances.psychologist,
  };
  delete save.finances.facilities;
  delete save.finances.psychologist;
  save.finances.bootcampSharp =
    typeof save.finances.bootcampSharp === "boolean"
      ? save.finances.bootcampSharp
        ? CAREER_GEAR.bootcamp[1].sharpRating
        : 0
      : (save.finances.bootcampSharp ?? 0);
  save.finances.freeBootcampsUsedThisSeason ??= 0;

  save.mail ??= [];
  save.scrimsThisWeek ??= 0;
  save.seq ??= (save.news?.length ?? 0) + 1000;
  for (const p of save.squad ?? []) {
    p.trainingIntensity ??= "normal";
  }

  const fixDef = (def: (CareerEventDef & { day?: number }) | null) =>
    def ? { ...def, day: def.day ?? eventDayFor(def.week) } : null;
  save.pendingEventDef = fixDef(save.pendingEventDef);
  save.unofficialOffer = fixDef(save.unofficialOffer);
  if (save.activeEvent) {
    save.activeEvent.def = fixDef(save.activeEvent.def)!;
  }
  for (const offer of save.pendingOffers ?? []) {
    if (offer.resolveDay === undefined) {
      const w = offer.resolveWeek ?? weekOfDay(save.clock.day);
      offer.resolveDay = w * CAREER_CALENDAR.daysPerWeek;
      delete offer.resolveWeek;
    }
  }

  save.saveVersion = 2;
  return save as CareerSave;
}

/**
 * v0.3 additive migration: scrim scheduling/log, the transfer wire,
 * negotiation + bid bookkeeping. Runs after migrateSaveToV2 (chain in the
 * store); safe to call on any save.
 */
export function migrateSaveToV3(raw: unknown): CareerSave | null {
  const save = migrateSaveToV2(raw);
  if (!save) return null;
  if ((save.saveVersion ?? 2) >= 3) return save;

  save.scheduledScrims ??= [];
  save.scrimLog ??= [];
  save.transferLog ??= [];
  save.negotiationTries ??= {};
  save.bidsThisWindow ??= 0;
  save.lastBidDay ??= -99;

  save.saveVersion = 3;
  return save;
}

/**
 * v2.0 (R40) additive migration — the weekend calendar (qualifier Saturday,
 * regional Sunday, Major/Worlds over Saturday + Sunday). Chained after
 * migrateSaveToV3; the store runs it in `migrate` AND on every rehydrate, so
 * it is idempotent and gated by saveVersion (the zustand persist version
 * stays 3 — frozen by persistContract.test.ts). Never a reset:
 *  - pending qualifier (the pre-R40 midweek day 3) → re-dated to that week's Saturday,
 *    Swiss-only format.
 *  - pending regional (old Saturday) while the clock is on/before Sunday →
 *    re-dated to Sunday (a lobby already open on Saturday re-opens Sunday).
 *  - pending Major/Worlds → unchanged (Saturday Swiss, Sunday playoffs).
 *  - active legacy qualifier → Swiss-only (`asSwissOnly`): a Swiss still in
 *    progress ends at its end; one already played ends there and then — any
 *    playoff rounds are dropped, placements come from the Swiss, so no
 *    qualifier champion is ever produced. Its `def.day` stays the day it
 *    actually started — and so does its `pendingEventDef` copy (an event in
 *    progress is never re-dated, so the agenda lists it once).
 *  - active Major/Worlds → unchanged: it pauses at the Swiss end like a new
 *    one; one ALREADY into its playoffs simply finishes on Saturday.
 *  - history (eventResults incl. old qualifier rows, news, qualifiedRefs) is
 *    left exactly as it is; AI events the old layout already resolved this
 *    week are never re-run (resolveAiEvent is idempotent by event id).
 */
export function migrateSaveToV4(raw: unknown): CareerSave | null {
  const save = migrateSaveToV3(raw);
  if (!save) return null;
  if ((save.saveVersion ?? 3) >= 4) return save;

  const day = save.clock?.day ?? 1;
  const redate = (def: CareerEventDef | null | undefined): CareerEventDef | null => {
    if (!def) return null;
    if (def.tier === "qualifier") {
      const saturday = qualifierDayFor(def.week);
      return day <= saturday ? { ...def, day: saturday, format: "swissOnly" } : { ...def, format: "swissOnly" };
    }
    if (def.tier === "regional") {
      const sunday = regionalDayFor(def.week);
      return day <= sunday ? { ...def, day: sunday } : def;
    }
    return def;
  };
  const ev = save.activeEvent;
  if (ev && ev.def.tier === "qualifier") {
    ev.def = { ...ev.def, format: "swissOnly" };
    ev.tournament = asSwissOnly(ev.tournament);
  }
  // startEvent never clears pendingEventDef: an event already in progress
  // keeps ONE def — the day it actually started — so the agenda never shows
  // it twice (its own day + the re-dated copy).
  save.pendingEventDef =
    ev && save.pendingEventDef?.id === ev.def.id ? { ...ev.def } : redate(save.pendingEventDef);

  save.saveVersion = 4;
  return save;
}

/**
 * rc.30: upgrade a persisted save in place to saveVersion 5. Additive and
 * idempotent, gated by saveVersion (persist version 3 stays frozen):
 *  - A4: the world's one-time repair (worldSim.repairLegacyWorld — one roster
 *    per player, one gamertag per player in a region; a no-op on a clean
 *    world) with one news line when it changed anything. IDs, the squad,
 *    contracts, results and cards are untouched.
 *  - direct-8: a save inside a regional week whose Monday commit predates
 *    rc.30 gets that week's seeding from the commit it already made (the
 *    qualifier it plays or played → outside the 8; the regional it holds
 *    without one → inside), so Saturday and Sunday cannot re-seed the user.
 */
export function migrateSaveToV5(raw: unknown): CareerSave | null {
  const save = migrateSaveToV4(raw);
  if (!save) return null;
  backfillEconomyOnLoad(save); // rc.32: every load, idempotent, no version bump
  if ((save.saveVersion ?? 4) >= 5) return save;

  const repair = repairLegacyWorld(save.world, {
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    userSquad: save.squad,
  });
  save.world = repair.world;
  const fixes = repair.reseated + repair.renamed;
  if (fixes > 0) pushNews(save, { type: "org", priority: 1, titleKey: "registryRepair", params: { n: fixes } });

  backfillWeekSeeding(save);
  save.saveVersion = 5;
  return save;
}

/**
 * rc.32 (ECONOMY-CONTRACT M3 — provisional): the economy's additive load
 * step, run by migrateSaveToV5 on every load BEFORE its saveVersion gate
 * (idempotent; persist version 3 and saveVersion 5 unchanged). A save from
 * before rc.32 still in season index ≤ CAREER_SPONSOR.founding.
 * throughSeasonIndex that never signed a sponsor gets the founding partner,
 * sized on its wage bill at this load and announced once in the inbox;
 * every other one records `null` (decided: none). Nothing else moves: IDs,
 * contracts, the Backer and the progress are as saved; `loanBreaches` reads
 * from `loanUsed` until the next breach writes it.
 */
export function backfillEconomyOnLoad(save: CareerSave): void {
  if (!CAREER_SPONSOR.founding.enabled || save.foundingPartner !== undefined) return;
  if (!save.clock || !Array.isArray(save.squad) || !save.finances) return;
  save.flags ??= {};
  save.mail ??= [];
  const neverSigned =
    !realDealSigned(save) &&
    !(save.finances.ledger ?? []).some((l) => l.kind === "sponsorSigning" || l.kind === "sponsorBase");
  if (save.phase !== "ended" && save.clock.seasonIndex <= CAREER_SPONSOR.founding.throughSeasonIndex && neverSigned) {
    openFoundingPartner(save);
  } else {
    save.foundingPartner = null;
  }
}

/** rc.30 (direct-8): the in-flight regional week's seeding, rebuilt from its commit (migrateSaveToV5). */
function backfillWeekSeeding(save: CareerSave): void {
  const { seasonIndex, day } = save.clock;
  const week = weekOfDay(day);
  const region = save.identity.region;
  const q = qualifierDefsForWeek(seasonIndex, week).find((d) => d.region === region);
  if (!q || committedSeedingFor(save.competition, { region, seasonIndex, week })) return;
  const regional = regionalForQualifier(q);
  const outside = isUsersOwnEvent(save, q) || userResultFor(save, q.id) !== null;
  const inside =
    !outside && regional !== null && (isUsersOwnEvent(save, regional) || userResultFor(save, regional.id) !== null);
  if (!outside && !inside) return; // no commit on file: the live preview stands
  const live = liveUserSeeding(save);
  const seeding = live.direct.includes("user") === inside ? live : moveUserAcrossLine(live, inside);
  save.competition.weekSeeding = { seasonIndex, week, region, ...seeding };
}

/** The same seeding with the user on the other side of the direct-8 line (8 stay direct). */
function moveUserAcrossLine(
  seeding: { direct: string[]; rest: string[] },
  toDirect: boolean,
): { direct: string[]; rest: string[] } {
  const direct = seeding.direct.filter((r) => r !== "user");
  const rest = seeding.rest.filter((r) => r !== "user");
  if (toDirect) {
    const bumped = direct.length >= CAREER_QUALIFIER.directSlots ? direct.splice(CAREER_QUALIFIER.directSlots - 1) : [];
    return { direct: [...direct, "user"], rest: [...bumped, ...rest] };
  }
  const promoted = rest.splice(0, Math.max(0, CAREER_QUALIFIER.directSlots - direct.length));
  return { direct: [...direct, ...promoted], rest: ["user", ...rest] };
}
