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
 *  - SATURDAY (matchday): AI events resolve; the user's committed event waits
 *    in the lobby (Advance stops here).
 *  - SUNDAY: rest.
 * Seed streams stay WEEK-keyed (each fires once per week) — the day clock
 * changes when things surface, never how they roll.
 */

import {
  CAREER_CALENDAR,
  CAREER_CONTRACT,
  CAREER_ECONOMY,
  CAREER_GEAR,
  CAREER_LOAN,
  CAREER_REP,
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
import { PLAYER_NAME_BANK } from "@/data/career/names";
import { simulateSeries } from "@/engine/match";
import {
  fastForward,
  initFieldTournament,
  playNextRound,
  userHasPendingSeries,
} from "@/engine/tournament";
import { createRng } from "@/lib/rng";
import {
  DAYS_PER_SEASON,
  dayOfWeekOf,
  eventDayFor,
  isWindowStartWeek,
  isWindowWeek,
  officialEventDefsForWeek,
  seasonIdFor,
  seasonLabelFor,
  splitOfWeek,
  unofficialOfferFor,
  weekAt,
  weekOfDay,
  windowIndexOf,
} from "@/engine/career/calendar";
import {
  compileEventResult,
  applyResultToStandings,
  legacyGradeFor,
  majorFieldFor,
  placementOf,
  seasonGoalsFor,
  seasonGradeFor,
  stabilityAssess,
  worldsFieldFor,
} from "@/engine/career/careerResults";
import {
  ageOf,
  applyMatchXp,
  fieldQualityFor,
  playerViewById,
  seasonYear,
  squadRollover,
  trainDay,
} from "@/engine/career/development";
import {
  applyPrize,
  bootcampTierFor,
  computeSalaryAsk,
  gearNextItem,
  gearPriceFor,
  gearTrainingBonus,
  pushLedger,
  quantize,
  repGainFor,
  repLossFloor,
  repTierOf,
  splitPayday,
  sponsorOffersFor,
  transferFeeFor,
  unlocksFor,
  type GearItemId,
} from "@/engine/career/economy";
import {
  aiWindowMoves,
  askPackageFor,
  coachCandidatesFor as marketCoachCandidates,
  contractedSplitsRemaining,
  incomingBids,
} from "@/engine/career/market";
import { derivedFloat, deriveSeed, streams } from "@/engine/career/seeds";
import {
  agePassAndIntake,
  buildWorldAtCreation,
  computeStars,
  fieldForEvent,
  orgTeamFor,
  simulateAiEvent,
  starterRosterOffers,
  userTeamFor,
  type StarterOffer,
} from "@/engine/career/worldSim";
import type {
  CareerDifficulty,
  CareerEventDef,
  CareerIdentity,
  CareerPrefs,
  CareerSave,
  CoachState,
  CompactEventResult,
  MailItem,
  ManagementStyle,
  NewsItem,
  SeasonRecord,
  SquadPlayer,
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
  return save.world.orgs[ref]?.name ?? ref;
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
  return save.world.orgs[ref]?.region ?? save.identity.region;
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

function userQualifiedFor(save: CareerSave, def: CareerEventDef): boolean {
  if (def.tier === "regional") return def.region === save.identity.region;
  if (def.tier === "major") return save.competition.majorFieldRefs?.includes("user") ?? false;
  if (def.tier === "worlds") return save.competition.worldsFieldRefs?.includes("user") ?? false;
  return true; // unofficials are invitations
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

    // --- 1. scripted beats --------------------------------------------------
    if (!isInfinite(save)) {
      for (const beat of CAREER_BEATS) {
        if (beat.trigger.seasonIndex !== seasonIndex || beat.trigger.week !== week) continue;
        if (save.firedBeatIds.includes(beat.id)) continue;
        save.firedBeatIds.push(beat.id);
        const targetOnSquad =
          beat.requiresPlayerFree && save.squad.some((p) => p.id === beat.requiresPlayerFree);
        if (targetOnSquad && beat.degradeToOffer && beat.requiresPlayerFree) {
          // Degrade into a Blockbuster incoming bid for the user-owned target.
          const player = save.squad.find((p) => p.id === beat.requiresPlayerFree)!;
          const ask = computeSalaryAsk({
            overall: player.overall,
            age: 18,
            potential: player.potential,
            rep: save.reputation,
            role: "starter",
            seasonIndex,
            lengthSeasons: 2,
            difficulty: save.difficulty,
            careerSeed: save.careerSeed,
            playerId: player.id,
          });
          const fee = quantize(
            transferFeeFor(ask, 4) * CAREER_TRANSFER.blockbusterFeeMult,
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
          pushMail(save, {
            kind: "offer",
            titleKey: "blockbusterBid",
            bodyKey: "blockbusterBid",
            params: { player: player.name, org: toOrg ? nameOfRef(save, toOrg) : "?", fee },
            fromKey: "agent",
            linkTo: "/career/market",
          });
        } else if (targetOnSquad) {
          pushNews(save, { type: "beat", priority: 3, titleKey: "beatPreempted", beatId: beat.id });
        } else {
          if (beat.effect?.forceTransfer && beat.requiresPlayerFree) {
            const { playerId, toOrgRef } = beat.effect.forceTransfer;
            forceTransferInWorld(save, playerId, toOrgRef);
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
      if (isWindowStartWeek(week) && save.squad.length > 0) {
        const bids = incomingBids({
          world: save.world,
          squad: save.squad,
          seasonIndex,
          windowIdx,
          week,
          careerSeed: save.careerSeed,
          rep: save.reputation,
          regionRatings: [],
        });
        for (const bid of bids) {
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
    for (const def of defs) {
      const isUsers =
        userQualifiedFor(save, def) &&
        (def.tier !== "regional" || def.region === save.identity.region);
      if (isUsers) {
        save.pendingEventDef = def;
        rollUnavailability(save, def);
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

    // --- 5. split boundary: payday + sponsor + turnover (weeks 11/21/31) ---
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
    }
  }
  if (beforeCount > 0) {
    save.pendingOffers = save.pendingOffers.filter((o) => o.status === "pending");
  }

  // ==================== MON-FRI: daily training tick =======================
  // Weeks with a committed user event are match-prep weeks (no training gains
  // — the event pays match XP instead), mirroring the v0.1 weekly rule.
  if (dow <= CAREER_TRAINING.trainingDaysPerWeek && !save.pendingEventDef) {
    applyDailyTraining(save, cal.kind === "open" || cal.kind === "preseason");
  }

  // ==================== SATURDAY (matchday) ================================
  if (dow === CAREER_CALENDAR.eventDayOfWeek) {
    const defs = officialEventDefsForWeek(seasonIndex, week);
    for (const def of defs) {
      const isUsers =
        userQualifiedFor(save, def) &&
        (def.tier !== "regional" || def.region === save.identity.region);
      if (!isUsers) {
        resolveAiEvent(save, def);
        // An unattended Worlds still closes the season (watch-party digest →
        // straight to the review; design §7 spectator weeks).
        if (def.tier === "worlds") {
          const worldsResult =
            save.eventResults.find(
              (r) => r.seasonIndex === seasonIndex && r.tier === "worlds",
            ) ?? null;
          enterSeasonReview(save, worldsResult);
          return capNews(save);
        }
      }
    }
  }

  return capNews(save);
}

function capNews(save: CareerSave): CareerSave {
  if (save.news.length > CAREER_SAVE.newsCap) save.news.length = CAREER_SAVE.newsCap;
  return save;
}

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
}

function resolveAiEvent(save: CareerSave, def: CareerEventDef): void {
  const state = simulateAiEvent(def, {
    world: save.world,
    competition: save.competition,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
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
    save.eventResults = save.eventResults.slice(-CAREER_SAVE.eventResultsCap);
  }
}

function applyDailyTraining(save: CareerSave, trainingWeekBonus: boolean): void {
  const gearBonus = gearTrainingBonus(save.finances.gear);
  for (const p of save.squad) {
    const res = trainDay(p, {
      seasonIndex: save.clock.seasonIndex,
      coachOverall: save.coach?.overall ?? null,
      gearBonus,
      trainingWeekBonus,
      splitGained: p.gainedThisSplit,
      seasonGained: p.gainedThisSeason,
    });
    Object.assign(p, res.player);
  }
}

function runSplitBoundary(save: CareerSave): void {
  const { seasonIndex, day } = save.clock;
  const week = weekOfDay(day);
  // Sponsor objective settlement (before payday so the bonus rides along).
  let sponsorBonusDue = 0;
  if (save.sponsor) {
    const s = save.sponsor;
    const hit =
      s.hitThisSplit ||
      (s.objectiveKind === "enterEvents" && s.progress >= CAREER_SPONSOR.enterEventsTarget);
    if (hit) {
      sponsorBonusDue = s.bonus;
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

  const payday = splitPayday({
    fin: save.finances,
    squadSalaries: save.squad.map((p) => ({ name: p.name, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    sponsor: save.sponsor,
    rep: save.reputation,
    seasonIndex,
    week,
    day,
    difficulty: save.difficulty,
  });
  save.finances = payday.fin;
  if (sponsorBonusDue > 0) {
    save.finances = pushLedger(save.finances, {
      seasonIndex,
      week,
      day,
      kind: "sponsorBonus",
      amount: sponsorBonusDue,
      refName: save.sponsor?.sponsorId,
    });
  }
  if (payday.rescued) {
    pushNews(save, { type: "org", priority: 3, titleKey: "backerIn" });
    pushMail(save, {
      kind: "finance",
      titleKey: "backerIn",
      bodyKey: "backerIn",
      params: {},
      fromKey: "backer",
      linkTo: "/career/finances",
    });
  }
  if (payday.insolvent) {
    endCareer(save, "insolvency");
    pushNews(save, { type: "org", priority: 3, titleKey: "insolvency" });
    return;
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

export function resolveAcceptedBid(input: CareerSave, offer: TransferOffer): CareerSave {
  const save = clone(input);
  const player = save.squad.find((p) => p.id === offer.playerId);
  if (!player) return save;
  save.squad = save.squad.filter((p) => p.id !== offer.playerId);
  syncSquadRoles(save);
  // The buying org takes him (or he lands in their world roster slot).
  if (offer.otherRef) forceTransferInWorld(save, offer.playerId, offer.otherRef);
  save.finances = pushLedger(save.finances, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    kind: "transferIn",
    amount: offer.fee,
    refName: player.name,
  });
  save.pendingOffers = save.pendingOffers.filter((o) => o.id !== offer.id);
  pushNews(save, {
    type: "transfer",
    priority: 2,
    titleKey: "userSold",
    params: {
      player: player.name,
      org: save.identity.orgName,
      to: offer.otherRef ? nameOfRef(save, offer.otherRef) : "?",
    },
  });
  return save;
}

// ---------------------------------------------------------------------------
// Event lifecycle
// ---------------------------------------------------------------------------

export function startEvent(input: CareerSave, watch: boolean): CareerSave {
  const save = clone(input);
  const def = save.pendingEventDef;
  if (!def || save.activeEvent) return save;
  // The lobby opens on the matchday only (the day clock stops there).
  if (save.clock.day !== def.day) return save;

  const unavailable =
    save.pendingUnavailability?.eventId === def.id ? save.pendingUnavailability.playerId : null;
  const { team, usedStandIn } = userTeamFor({
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
  if (usedStandIn) {
    save.finances = pushLedger(save.finances, {
      seasonIndex: save.clock.seasonIndex,
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      kind: "standInFee",
      amount: -CAREER_SUB.standInFee,
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
  });
  const rng = createRng(deriveSeed(save.careerSeed, `evt:${def.id}`));
  const tournament = initFieldTournament(field, def.format, rng);
  save.activeEvent = {
    def,
    rngState: rng.state,
    tournament,
    fieldQuality,
    watched: watch,
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

export function stepEventRound(input: CareerSave): CareerSave {
  const save = clone(input);
  const ev = save.activeEvent;
  if (!ev || ev.tournament.stage === "finished") return save;
  const rng = createRng(ev.rngState);
  let t: TournamentState = playNextRound(ev.tournament, save.difficulty, rng);
  let guard = 0;
  while (t.stage !== "finished" && !userHasPendingSeries(t) && guard < 16) {
    t = playNextRound(t, save.difficulty, rng);
    guard += 1;
  }
  ev.tournament = t;
  ev.rngState = rng.state;
  return save;
}

export function simEventToEnd(input: CareerSave): CareerSave {
  const save = clone(input);
  const ev = save.activeEvent;
  if (!ev || ev.tournament.stage === "finished") return save;
  const rng = createRng(ev.rngState);
  ev.tournament = fastForward(ev.tournament, save.difficulty, rng);
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

  // Prize (+ Backer garnish).
  if (userRow && userRow.prize > 0) {
    const { fin } = applyPrize(save.finances, userRow.prize, {
      seasonIndex: save.clock.seasonIndex,
      week: weekOfDay(save.clock.day),
      day: save.clock.day,
      refName: def.name,
      difficulty: save.difficulty,
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

  // Roster stability (fielded new faces).
  const fielded = fieldedIdsFor(save);
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
  }
  if (def.tier === "major") save.stats.majorsQualified += 1;

  pushNews(save, {
    type: "result",
    priority: 2,
    titleKey: "resultUser",
    params: { event: def.name, placement },
  });

  save.activeEvent = null;
  save.pendingEventDef = null;
  save.pendingUnavailability = null;

  // Worlds resolves the season (and possibly the career).
  if (def.tier === "worlds") {
    if (placement === "champion") {
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
  if (def.tier === "t3" && placement === "champion") {
    const key = `t3rep:${save.clock.seasonIndex}:${splitOfWeek(weekOfDay(save.clock.day)) ?? 0}`;
    const used = (save.flags[key] as unknown as number) || 0;
    if (Number(used) < CAREER_UNOFFICIAL.t3RepCapPerSplit) {
      gainRep(save, "t3Win");
      (save.flags as Record<string, unknown>)[key] = Number(used) + 1;
    }
  }
  if (def.tier === "t2" && placement === "champion") gainRep(save, "t2Win");
  if (def.tier === "regional") {
    if (placement === "champion") gainRep(save, "regionalWin");
    else if (["runner_up", "third", "fourth", "top4"].includes(placement)) gainRep(save, "regionalTop4");
    else if (placement !== "swiss_exit") gainRep(save, "regionalTop8");
  }
  if (def.tier === "major") {
    if (placement === "champion") gainRep(save, "majorWin");
    else if (["runner_up", "third", "fourth", "top4"].includes(placement)) gainRep(save, "majorTop4");
  }
  if (def.tier === "worlds") {
    if (["champion", "runner_up", "third", "fourth", "top4"].includes(placement)) {
      gainRep(save, "worldsTop4");
    }
  }
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
  const rows = Object.entries(table)
    .map(([ref, points]) => ({ ref, name: nameOfRef(save, ref), points }))
    .sort((a, b) => b.points - a.points);
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
    titles: seasonEvents.filter((r) => r.rows.find((x) => x.ref === "user")?.placement === "champion")
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
    reason: save.end.reason ?? reason,
    endedSeasonIndex: save.clock.seasonIndex,
    legacyGrade: save.end.legacyGrade ?? legacyGradeFor(save.stats),
  };
  save.phase = "ended";
}

export function rolloverToNextSeason(input: CareerSave): CareerSave {
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
  );
  save.world = pass.world;
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
      pushNews(save, { type: "milestone", priority: 2, titleKey: "retired", params: { player: p.name } });
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
    saveVersion: 2,
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
  if (input.phase !== "running" || input.activeEvent) return input;
  if (input.clock.day >= DAYS_PER_SEASON) return input;
  // An OFFICIAL matchday must be resolved (play or sim) — never skipped.
  const pending = input.pendingEventDef;
  if (
    pending &&
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

/** True when the save is at a state the batched Advance must stop at. */
function isStopState(save: CareerSave, startedAtDay: number): boolean {
  if (save.phase !== "running") return true;
  const day = save.clock.day;
  // A committed event's matchday (the lobby).
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
  // Pending decisions: incoming bids and sponsor offers.
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

export function signPlayerFlow(
  input: CareerSave,
  playerId: string,
  opts: { role: "starter" | "sub"; lengthSeasons: 1 | 2 | 3 },
): FlowResult {
  const save = clone(input);
  if (!isWindowWeek(weekOfDay(save.clock.day))) return { save: input, error: "windowClosed" };
  if (save.squad.some((p) => p.id === playerId)) return { save: input, error: "alreadySigned" };
  const starters = save.squad.filter((p) => p.role === "starter").length;
  const subs = save.squad.filter((p) => p.role === "sub").length;
  if (opts.role === "starter" && starters >= 3) return { save: input, error: "squadFull" };
  if (opts.role === "sub" && subs >= 1) return { save: input, error: "squadFull" };

  const viewCtx = {
    careerSeed: save.careerSeed,
    seasonIndex: save.clock.seasonIndex,
    world: save.world,
  };
  const view = playerViewById(playerId, viewCtx);
  if (!view) return { save: input, error: "unavailable" };

  const onOrg = Object.values(save.world.orgs).find((o) => o.playerIds.includes(playerId));
  const pack = askPackageFor(view, {
    rep: save.reputation,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
    role: opts.role,
    lengthSeasons: opts.lengthSeasons,
    contracted: onOrg
      ? {
          splitsRemaining: contractedSplitsRemaining(
            playerId,
            save.clock.seasonIndex,
            save.careerSeed,
          ),
        }
      : undefined,
  });
  const cost = pack.fee + pack.signingBonus;
  if (save.finances.balance - cost < CAREER_LOAN.floor) return { save: input, error: "funds" };
  if (pack.fee > 0 && save.finances.loan) return { save: input, error: "loanActive" };

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
    role: opts.role,
    salaryPerSplit: pack.salaryPerSplit,
    contractEndSeason: save.clock.seasonIndex + opts.lengthSeasons,
    trainingFocus: "auto",
    trainingIntensity: "normal",
    scoutLevel,
    splitsTogether: 0,
    joinedSeason: save.clock.seasonIndex,
    gainedThisSplit: 0,
    gainedThisSeason: 0,
  });
  // A starter signing only takes the pitch if there's an open lineup slot
  // (fewer than 3 valid starters); otherwise it's depth. syncSquadRoles is the
  // single source of truth for starterIds + roles.
  if (opts.role === "starter") {
    const validStarters = save.starterIds.filter((id) =>
      save.squad.some((p) => p.id === id && p.id !== view.id),
    );
    if (validStarters.length < 3) {
      save.starterIds = [...validStarters, view.id].slice(0, 3) as [string, string, string];
    }
  }
  syncSquadRoles(save);

  pushNews(save, {
    type: "transfer",
    priority: 2,
    titleKey: "userSigned",
    params: { player: view.name, org: save.identity.orgName },
  });
  return { save: capNews(save) };
}

export function releasePlayerFlow(input: CareerSave, playerId: string): FlowResult {
  const save = clone(input);
  const player = save.squad.find((p) => p.id === playerId);
  if (!player) return { save: input, error: "unknown" };
  const splitsLeft = Math.max(1, (player.contractEndSeason - save.clock.seasonIndex) * 3);
  const severance = quantize(
    player.salaryPerSplit * splitsLeft * CAREER_CONTRACT.releaseFeeFactor,
  );
  save.finances = pushLedger(save.finances, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    kind: "severance",
    amount: -severance,
    refName: player.name,
  });
  save.squad = save.squad.filter((p) => p.id !== playerId);
  syncSquadRoles(save);
  save.world.freeAgentIds.push(playerId);
  save.world.version += 1;
  pushNews(save, {
    type: "transfer",
    priority: 2,
    titleKey: "userReleased",
    params: { player: player.name, org: save.identity.orgName },
  });
  return { save: capNews(save) };
}

export function renewPlayerFlow(
  input: CareerSave,
  playerId: string,
  lengthSeasons: 1 | 2 | 3,
): FlowResult {
  const save = clone(input);
  const player = save.squad.find((p) => p.id === playerId);
  if (!player) return { save: input, error: "unknown" };
  const age = ageOf(player.birthYear, save.clock.seasonIndex);
  const prestige = repTierOf(save.reputation);
  const ambitious = player.overall >= 88 && prestige < 3;
  const ask = computeSalaryAsk({
    overall: player.overall,
    age,
    potential: player.potential,
    rep: save.reputation,
    role: player.role,
    seasonIndex: save.clock.seasonIndex,
    lengthSeasons,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
    playerId: player.id,
    ambitious,
  });
  player.salaryPerSplit = ask;
  player.contractEndSeason = save.clock.seasonIndex + lengthSeasons;
  return { save };
}

export function declineBidFlow(input: CareerSave, offerId: string): CareerSave {
  const save = clone(input);
  save.pendingOffers = save.pendingOffers.filter((o) => o.id !== offerId);
  return save;
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
  const cost = gearPriceFor(next.cost, save.sponsor?.tier ?? null);
  if (save.finances.balance - cost < CAREER_LOAN.floor) return { save: input, error: "funds" };
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
  save.finances.gear.psychologist = on;
  return { save };
}

export function runBootcampFlow(input: CareerSave): FlowResult {
  const save = clone(input);
  const tier = bootcampTierFor(save.reputation);
  if (tier === 0) return { save: input, error: "locked" };
  if (save.finances.bootcampUsedThisSplit) return { save: input, error: "used" };
  const camp = CAREER_GEAR.bootcamp[tier - 1];

  // Sponsor perk: free bootcamps per season (tier 3+ deals).
  const freeAllowance = save.sponsor
    ? (CAREER_SPONSOR.tiers[save.sponsor.tier - 1]?.freeBootcampsPerSeason ?? 0)
    : 0;
  const isFree = save.finances.freeBootcampsUsedThisSeason < freeAllowance;
  if (!isFree && save.finances.balance - camp.cost < CAREER_LOAN.floor) {
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
      amount: -camp.cost,
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
  if (save.finances.balance - CAREER_SCOUT.reportCost < CAREER_LOAN.floor) {
    return { save: input, error: "funds" };
  }
  const current = Number(save.scouted[playerId] ?? 0);
  if (current >= CAREER_SCOUT.reportMaxLevel) return { save: input, error: "maxed" };
  save.finances = pushLedger(save.finances, {
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    day: save.clock.day,
    kind: "buff",
    amount: -CAREER_SCOUT.reportCost,
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
    nameBank: [...PLAYER_NAME_BANK[save.identity.region]],
  });
}

export function hireCoachFlow(input: CareerSave, coach: CoachState): FlowResult {
  const save = clone(input);
  // Validate the candidate came from the current shortlist (no injected coaches).
  const candidates = coachCandidatesFor(save);
  const valid = candidates.find((c) => c.id === coach.id);
  if (!valid) return { save: input, error: "unknown" };
  if (save.coach?.id === valid.id) return { save: input, error: "alreadySigned" };
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
// Scrims (v0.2 — weekday blocks between events)
// ---------------------------------------------------------------------------

/** The scrim opponent for a given day (derived; null when none makes sense). */
export function scrimOpponentFor(save: CareerSave): { ref: string; name: string } | null {
  const region = save.identity.region;
  const userRating = approxUserRating(save);
  const candidates = Object.values(save.world.orgs)
    .filter((o) => o.region === region)
    .map((o) => ({
      ref: o.ref,
      name: o.name,
      gap: Math.abs((o.rating ?? 70 + o.prestige * 6) - userRating),
    }))
    .sort((a, b) => a.gap - b.gap || a.ref.localeCompare(b.ref));
  const band = candidates.filter((c) => c.gap <= CAREER_SCRIM.ratingBand);
  const pool = band.length > 0 ? band : candidates.slice(0, 4);
  if (pool.length === 0) return null;
  const pick = Math.floor(
    derivedFloat(
      save.careerSeed,
      streams.gen("scrim", `${save.clock.seasonIndex}:${save.clock.day}`),
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
 * Run a scrim block today: one Bo5 vs a nearby-strength org from the region.
 * Grants a small chemistry credit + light match XP; no money, no points.
 */
export function runScrimFlow(input: CareerSave): FlowResult & { outcome?: ScrimOutcome } {
  const save = clone(input);
  const dow = dayOfWeekOf(save.clock.day);
  if (save.phase !== "running" || save.activeEvent) return { save: input, error: "blocked" };
  if (dow > CAREER_TRAINING.trainingDaysPerWeek) return { save: input, error: "restDay" };
  if (save.scrimsThisWeek >= CAREER_SCRIM.maxPerWeek) return { save: input, error: "used" };

  const opponent = scrimOpponentFor(save);
  if (!opponent) return { save: input, error: "unavailable" };

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
  const rng = createRng(
    deriveSeed(save.careerSeed, `scrim:${save.clock.seasonIndex}:${save.clock.day}`),
  );
  const series = simulateSeries(
    team,
    oppTeam,
    { bestOf: TOURNAMENT.swiss.bestOf, stage: "swiss", difficulty: save.difficulty },
    rng,
  );
  const won = series.winnerTeamId === "user";
  const score: [number, number] = [series.score[0], series.score[1]];

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
  pushNews(save, {
    type: "training",
    priority: 1,
    titleKey: won ? "scrimWin" : "scrimLoss",
    params: { opponent: opponent.name, a: score[0], b: score[1] },
  });
  return { save: capNews(save), outcome: { opponentName: opponent.name, won, score } };
}

export function chooseSponsorFlow(input: CareerSave, sponsorId: string): FlowResult {
  const save = clone(input);
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
  return { save: capNews(save) };
}

// ---------------------------------------------------------------------------
// Squad management
// ---------------------------------------------------------------------------

export function setStartersFlow(
  input: CareerSave,
  starterIds: [string, string, string],
): FlowResult {
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
