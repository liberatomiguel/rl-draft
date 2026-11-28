import { CAREER_FEED_EN } from "./copy.career.feed.en"; // v2.3 FEED

/**
 * Road to Worlds — English copy (career mode).
 *
 * One grouped object, read ONLY by career code through `useCareerCopy()` /
 * `getCareerCopy()` (`careerCopy.ts`) — it is deliberately not part of the
 * core EN dictionary, so draft-game pages never download it. Do not import
 * this file from non-career modules; the home card's strings are in
 * `HOME.career*` (copy.en.ts / copy.pt.ts).
 * `copy.career.pt.ts` mirrors this shape exactly (enforced by its type).
 * Tone: broadcast desk / post-match analysis — clean esports language.
 */

import { CAREER_LOCKER_EN } from "./copy.career.locker.en"; // v2.3 LOCKER
import { CAREER_MEDIA_EN } from "./copy.career.media.en"; // v2.3 MEDIA

/** v2.2 ENDLESS: the host cities a season draws its Majors and Worlds from (indexes are stored in the save). */
const ENDLESS_HOSTS_EN = [
  "London", "Paris", "Copenhagen", "Stockholm", "Boston", "Dallas",
  "Los Angeles", "São Paulo", "Riyadh", "Sydney", "Tokyo", "Madrid",
] as const;
const hostEn = (i: string | number | undefined): string => ENDLESS_HOSTS_EN[Number(i)] ?? "";
/** v2.2 ENDLESS: "A", "A and B", "A, B and C". */
/** v2.2 ENDLESS: a rival project's kit, the user's own toolbox by name (keys: engine/career/endless KIT_ORDER). */
const ENDLESS_KIT_EN: Record<string, string> = {
  facilities: "a performance centre",
  coach: "the region's best coach",
  bench: "a reserve on the bench",
  bootcamp: "a bootcamp",
  psychologist: "a team psychologist",
};
const joinEn = (xs: string[]): string => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const kitEn = (kit: string | number | undefined): string => joinEn(String(kit ?? "").split(",").filter(Boolean).map((k) => ENDLESS_KIT_EN[k] ?? k));
const listEn = (p: Record<string, string | number>): string => {
  const xs = [p.p1, p.p2, p.p3].filter((x) => x !== undefined && x !== "").map(String);
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
};

/** rc.33 review: how long the rescue partner pays (rc.34: the investor, CAREER_LOAN.investor.weeks, passed in) — nothing when unknown. */
/** v2.2 board front: a board objective's chance, in words (CAREER_BOARD.bands sets the cut points). */
const swingEn = (hit: string | number | undefined, miss: string | number | undefined): string => (hit === undefined ? "" : ` (+${hit} / −${Math.abs(Number(miss))} confidence)`);
const BOARD_BANDS_EN: Record<string, string> = { expected: "Likely", reach: "Within reach", stretch: "A stretch", longShot: "A long shot" };
// rc9 org (R222): the owner's letter on a tier change, by the tier the org reaches: where it stands, then what changes.
const OWNER_UP_EN: Record<string, string> = {
  mid: "We are no longer the side people expect to beat. Better players will take our calls now, and the board will want us in the regional fight every split.",
  contender: "People in the scene count us among the contenders now. Players who turned us down a year ago are listening, and the board will look at Majors, not just regionals.",
  elite: "We are one of the orgs the rest of the scene measures itself against. Any player will listen to us now, and the board will judge the season by titles.",
};
const OWNER_DOWN_EN: Record<string, string> = {
  contender: "We are not at the very top any more. A few of the names we chase will wait for a bigger offer, and the board will ask for Majors rather than titles.",
  mid: "We have dropped back into the pack. The best free agents will look elsewhere first, and the board has eased what it asks of us.",
  underdog: "We are back to being the side nobody fears. The market will be harder, and the board knows it: it asks less of us this time.",
};

const partnerRunEn = (weeks?: string | number): string => (Number(weeks) > 0 ? ` for ${weeks} weeks` : "");

/**
 * HISTORY (rc.32–rc.33): what the next breach did under the Emergency
 * Backer — only the rc.33 `backerIn` and rc.32 `restructured` mails an older
 * save still holds read it, so their text stays as it was sent.
 */
const legacyNextBreachEn = (
  next: string | number | undefined,
  partner?: string | number,
  partnerWeeks?: string | number,
): string =>
  next === "insolvent"
    ? "The next breach of the floor ends the career."
    : next === "restructure"
      ? ""
      : Number(partner)
        ? `Below the floor on a Monday, the Emergency Backer steps in, and a rescue partner adds income${partnerRunEn(partnerWeeks)}.`
        : "Below the floor on a Monday, the Emergency Backer steps in.";

/**
 * rc.34 (Miguel, 31/10): what the next Monday below the floor does, from the
 * flow's `nextBreachParamsOf` — `next` (economy.breachOutcomeOf: "rescue" or
 * "insolvent"), `owing` (a loan is open: the bank adds to it, the deadline
 * stays), `nextPartner` / `partnerRun` (the investor joins the first loan),
 * `term` (weeks to repay a new loan; 0 = no deadline), `topUpsLeft`
 * (-1 = no cap) and, rc.34 review, `loansLeft` (new loans the career still
 * gets, CAREER_LOAN.emergency.maxLoans; -1 = no cap). Older mails pass only
 * `next`: they read the general rule.
 */
const nextBreachEn = (p: Record<string, string | number | undefined>): string => {
  if (p.next === "insolvent") {
    if (Number(p.owing) && Number(p.topUpsLeft) === 0)
      return "The bank will not add to the loan again: the next breach of the floor ends the career.";
    if (!Number(p.owing) && Number(p.loansLeft) === 0)
      return "The bank will not open another emergency loan: the next breach of the floor ends the career.";
    return "The next breach of the floor ends the career.";
  }
  if (p.next === "restructure") return "";
  if (Number(p.owing)) {
    const left = Number(p.topUpsLeft);
    return `If you go below the floor again, the bank adds to the loan and the deadline stays${left > 0 ? ` (${left === 1 ? "once more" : `${left} more times`} at most)` : ""}.`;
  }
  const term = Number(p.term) > 0 ? `, to be repaid within ${p.term} weeks` : "";
  const last = Number(p.loansLeft) === 1 ? ": the last one it will open in this career" : "";
  return Number(p.nextPartner)
    ? `Below the floor on a Monday, the bank opens an emergency loan${term}${last}, and an investor adds a little income${partnerRunEn(p.partnerRun)}.`
    : `Below the floor on a Monday, the bank opens an emergency loan${term}${last}.`;
};

/** rc.34: an emergency-loan Monday as the bank's mails quote it (this season, next, or N seasons on). */
const mondayWhenEn = (week: string | number | undefined, ahead: string | number | undefined): string => {
  const a = Number(ahead) || 0;
  return a <= 0
    ? `the Monday of week ${week}`
    : a === 1
      ? `the Monday of next season's week ${week}`
      : `the Monday of week ${week}, ${a} seasons from now`;
};

/**
 * rc.34: what happens on the deadline Monday — one sentence every loan mail
 * and notice repeats. rc.34 review: the bank's rule is "Pay it all"'s own
 * (economy.canSettleLoan): it collects as long as the books stay at or above
 * the floor after paying — the overdraft counts.
 */
const deadlineRuleEn =
  "On that Monday the bank collects what you owe. If paying it would put you below the floor, the career ends.";

/**
 * rc.34 review: what closes the gap to the deadline — new money (a sale, a
 * prize: each repays its share and the rest stays in the books) or a lower
 * burn. A partial payment from Finances moves money from the balance to the
 * debt and closes nothing; "Pay it all" settles it the day the books allow.
 */
const gapWaysEn = (p: Record<string, string | number | undefined>): string =>
  `To close the gap: sell a player (${p.salePct}% of the fee repays the loan), win prizes (${p.garnishPct}% of each repays it) or lower the wage bill.`;

/** rc.34 review: the projection the bank's deadline mails and notices quote ("on this pace"). */
const onPaceEn = (p: Record<string, string | number | undefined>): string =>
  Number(p.covered)
    ? `At ${p.net} a week you will have ${p.projected} on the deadline Monday, enough to repay.`
    : `At ${p.net} a week you will have ${p.projected} on the deadline Monday, ${p.gap} short.`;

/** rc.34: one money notice's text — a title, a lead sentence, label/value rows and an optional footnote. */
export interface MoneyNoticeText {
  title: string;
  lead: string;
  rows: [string, string][];
  foot?: string;
}

/** rc.34: the notice's rows, the conditional ones (`false` / `undefined`) left out. Shared with the PT copy. */
export const noticeRows = (...rows: ([string, string] | false | null | undefined)[]): [string, string][] =>
  rows.filter((r): r is [string, string] => Array.isArray(r));

/**
 * rc.33 review: a money param arrives formatted ("$1,540", news/newsText's
 * MONEY_PARAM_KEYS) — `Number()` of it is NaN. True for a positive amount,
 * formatted or raw.
 */
const positive = (v: string | number | undefined): boolean =>
  typeof v === "number" ? v > 0 : typeof v === "string" && /[1-9]/.test(v) && !v.trim().startsWith("-");

/** rc.32 (M4): the projected breach, as the warnings quote it (week of this or next season). */
const breachWhenEn = (p: Record<string, string | number>): string =>
  `the Monday of ${Number(p.nextSeason) ? "next season's " : ""}week ${p.breachWeek}`;

/**
 * rc9 TRAIN-MARKET: what the bank does at the next breach, as one clause for the money
 * notice's rows (the mails keep `nextBreachEn`). rc.9 integration: the notices say "floor", as the mail and Finances do.
 */
const noticeNextEn = (p: Record<string, string | number | undefined>): string => {
  if (p.next === "restructure") return "";
  if (p.next === "insolvent") {
    if (Number(p.owing) && Number(p.topUpsLeft) === 0) return "The bank will not add to the loan again, so the career ends";
    if (!Number(p.owing) && Number(p.loansLeft) === 0) return "The bank will not open another emergency loan, so the career ends";
    return "The career ends";
  }
  if (Number(p.owing)) {
    const left = Number(p.topUpsLeft);
    return `The bank adds to the loan and the deadline stays${left > 0 ? ` (${left === 1 ? "once more" : `${left} more times`} at most)` : ""}`;
  }
  const term = Number(p.term) > 0 ? `, repaid within ${p.term} weeks` : "";
  return `The bank opens an emergency loan${term}${Number(p.loansLeft) === 1 ? ": the last one in this career" : ""}`;
};

/** rc9 TRAIN-MARKET: how to close the gap to the loan's deadline, in one line. */
const noticeWaysEn = (p: Record<string, string | number | undefined>): string =>
  `Sell a player (${p.salePct}% of the fee goes to the loan), win prizes (${p.garnishPct}% of each) or lower the wage bill`;

/** rc.34 review: a small count in words for the wizard's money line ("two", "three"; digits past five). */
const countWordEn = (n: number): string => ["zero", "one", "two", "three", "four", "five"][n] ?? String(n);

/** rc.33 (UX-07, ECO-08): "first", "second"… for the wizard's money line and the rescue mail (any count). */
const ordinalEn = (n: number): string =>
  ["first", "second", "third", "fourth", "fifth"][n - 1] ??
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

/**
 * rc.34 (ECO-04): a sponsor goal in words — its kind, count, place and split
 * (sponsorDeals.SponsorGoal). One function for the offer card, the desk and
 * the mails.
 */
const sponsorGoalEn = (kind: string, count: number, place: number, split: number): string => {
  // v2.0 (C1): split 0 = a contract goal, counted from signing to the deal's end.
  if (!split) return sponsorContractGoalEn(kind, count, place);
  const regionals = `Split ${split}'s 3 regionals`;
  switch (kind) {
    case "enterEvents":
      return `Enter ${count} events in Split ${split}`;
    case "regionalReach":
      return count === 1 ? `Reach a Split ${split} regional` : `Reach ${count} of ${regionals}`;
    case "regionalFinish":
      if (place <= 1) return count === 1 ? `Win a Split ${split} regional` : `Win ${count} of ${regionals}`;
      return count === 1 ? `A regional top ${place} in Split ${split}` : `Top ${place} at ${count} of ${regionals}`;
    case "majorQualify":
      return `Qualify for the Split ${split} Major`;
    case "majorFinish":
      return place <= 1 ? `Win the Split ${split} Major` : `Top ${place} at the Split ${split} Major`;
    default:
      return "";
  }
};

/** v2.0 (C1): a contract goal in words: it runs for the whole deal, from the day it is signed. */
const sponsorContractGoalEn = (kind: string, count: number, place: number): string => {
  const n = (one: string, many: string) => (count === 1 ? one : many);
  switch (kind) {
    case "enterEvents":
      return `Enter ${count} ${n("event", "events")} during the deal`;
    case "regionalReach":
      return `Reach ${n("a regional", `${count} regionals`)} during the deal`;
    case "regionalFinish":
      if (place <= 1) return `Win ${n("a regional", `${count} regionals`)} during the deal`;
      return `Top ${place} at ${n("a regional", `${count} regionals`)} during the deal`;
    case "majorQualify":
      return `Qualify for ${n("a Major", `${count} Majors`)} during the deal`;
    case "majorFinish":
      return place <= 1 ? `Win a Major during the deal` : `Top ${place} at a Major during the deal`;
    default:
      return "";
  }
};

/** rc.34 (ECO-04, decision 4-A): a goal's difficulty word. */
const SPONSOR_WORD_EN: Record<string, string> = { likely: "Likely", even: "Even", stretch: "Stretch" };

/** rc.34: a goal carried in mail params (goalKind, goalCount, goalPlace, goalSplit). */
const goalOfParamsEn = (p: Record<string, string | number>): string =>
  sponsorGoalEn(String(p.goalKind), Number(p.goalCount), Number(p.goalPlace), Number(p.goalSplit));

/** rc.34 (S6): a handover step's Monday, as the mail quotes it. */
const stepWhenEn = (week: string | number | undefined, nextSeason: string | number | undefined): string =>
  `the Monday of ${Number(nextSeason) ? "next season's " : ""}week ${week}`;

export const CAREER_EN = {
  ...CAREER_FEED_EN, // v2.3 FEED
  meta: {
    title: "Road to Worlds",
    nav: "Career",
    locked: "Available soon",
  },

  nav: {
    hub: "HQ",
    calendar: "Calendar",
    squad: "Squad",
    training: "Training",
    market: "Market",
    finances: "Finances",
    standings: "Standings",
    news: "Inbox",
    club: "Club",
    board: "Board", // rc9 ORG-UI: the board's own tab (a save with a board)
    more: "More",
    exit: "Exit to menu",
    saves: "Careers",
  },

  // v0.2 day clock — date rendering (Monday-start weeks).
  dates: {
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weekdaysLong: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    /** e.g. "Sat, Oct 24" */
    short: (dow: string, month: string, d: number) => `${dow}, ${month} ${d}`,
    /** e.g. "Oct 24" */
    tiny: (month: string, d: number) => `${month} ${d}`,
    today: "Today",
    tomorrow: "Tomorrow",
    inDays: (n: number) => `in ${n} days`,
    daysShort: (n: number) => `${n}d`,
  },

  wizard: {
    regionLevels: { hard: "Harder", mid: "Intermediate", easy: "Easier" },
    iconColor: "Emblem colour",
    tertiaryColor: "Third colour",
    title: "Found your organization",
    step: (n: number, total: number) => `Step ${n} of ${total}`,
    quickStart: "Quick start",
    quickStartHint: "Fills every step at random",
    // Step 1 — identity
    identityTitle: "Identity",
    orgName: "Organization name",
    orgNamePlaceholder: "e.g. Horizon Esports",
    orgNameTaken: "That name belongs to an existing org",
    orgNameLength: "2 to 18 characters",
    abbrev: "Tag",
    abbrevHint: "2-4 letters, shown on tables and the crest",
    managerName: "Manager name",
    managerNamePlaceholder: "Your name",
    country: "Country",
    // Step 2 — crest (v0.2: shapes × symbols × patterns × free colors)
    crestTitle: "Crest & colors",
    crestLabel: "Shape",
    crestSymbol: "Symbol",
    crestPattern: "Pattern",
    crestNone: "None",
    randomizeCrest: "Randomize",
    kits: "Kits",
    kitsHint: "Sets both colours. Adjust either",
    primaryColor: "Primary color",
    secondaryColor: "Accent",
    // rc.36 (UX-04, R88): layouts, the free colour pick and the contrast guard.
    crestLayout: "Layout",
    crestLayouts: { emblem: "Emblem", monogram: "Letters", stacked: "Emblem + letters", band: "Band" },
    playstyleHelp: {"offense":"Helps the team create chances and finish attacks.","defense":"Strengthens positioning and protection of the goal.","mechanics":"Improves technical execution and ball control.","consistency":"Helps players keep a steady level during a series.","experience":"Adds composure and better decisions during matches.","clutch":"Helps the team perform in decisive moments."},
    colorNames: {
      "black": "Black", "graphite": "Graphite", "navy-light": "Light navy", "royal-light": "Light royal blue", "scarlet-light": "Light scarlet", "burgundy-light": "Light burgundy", "forest-light": "Light forest", "teal-light": "Light teal", "plum-light": "Light plum", "orange-light": "Light orange", "gold-light": "Light gold", "olive-light": "Light olive",
      navy: "Navy", gold: "Gold", burgundy: "Burgundy", ivory: "Ivory", royal: "Royal blue", silver: "Silver",
      forest: "Forest", cream: "Cream", scarlet: "Scarlet", sky: "Sky", charcoal: "Charcoal", amber: "Amber",
      petrol: "Petrol", white: "White", plum: "Plum", steel: "Steel", wine: "Wine", olive: "Olive",
      indigo: "Indigo", "burnt-orange": "Burnt orange", teal: "Teal", slate: "Slate",
    } as Record<string, string>,
    identityBuff: "Org identity",
    identityBuffHint: "Your org's specialty: a small team-wide edge",
    // Step 3 — region
    regionTitle: "Home region",
    regionKicker: "Sets your rivals and the Worlds slots",
    regionSlots: (n: number) => `${n} Worlds slots`,
    regionRivals: "RLCS X rivals",
    regionNote: "Relocating to another region unlocks later in the career",
    // Step 4 — roster
    rosterTitle: "First signings",
    rosterKicker: "Choose your first three players",
    rosterProspects: "Prospects",
    rosterProspectsDesc: "Young, high potential, need time",
    rosterJourneymen: "Journeymen",
    rosterJourneymenDesc: "Veterans: strong now, little growth left",
    rosterBalanced: "Balanced",
    rosterBalancedDesc: "A mix of veterans and prospects",
    recommended: "Recommended",
    wageBill: "Wage bill",
    avgAge: "Avg age",
    avgOverall: "Avg OVR",
    // rc.34 review: the start budget on the difficulty picked (Normal until the next step changes it),
    // and how many weeks of this roster's wages it covers.
    rosterBudget: (difficulty: string) => `Start budget · ${difficulty}`,
    rosterRunway: (weeks: number) => `Covers about ${weeks} weeks of wages`,
    // Step 5 — difficulty + summary. rc.34 (front I, Miguel 31/10): rewritten
    // for a first-time player on a phone — a promise and three plain bullets.
    finalTitle: "Difficulty",
    finalKicker: "Your pick stays for the whole career",
    // rc.32 (BAL-02): the career presets replace the Management Style step.
    presets: {
      easy: { label: "Easy", promise: "For learning the game" },
      normal: { label: "Normal", promise: "The intended balance" },
      hard: { label: "Hard", promise: "For experienced managers" },
    } as Record<"easy" | "normal" | "hard", { label: string; promise: string }>,
    // The bullets (wizard/PresetEffects.tsx), read live from balance.ts.
    presetMatches: {
      easier: "Matches lean your way",
      even: "Fair matches",
      harder: "Tougher rivals",
    } as Record<"easier" | "even" | "harder", string>,
    // rc.34 review: the preset's whole money rule (economy.moneyRuleFor) — the emergency loans a
    // career gets (null = no cap), the weeks to repay each, or no deadline (the loan never ends it).
    presetMoney: (r: { loans: number | null; deadlineWeeks: number | null }): string => {
      // rc.9 integration: CLUB-NEWS's plain sentences, back under the bullet's 18 words.
      const head = r.loans === null ? "the bank lends it" : r.loans === 1 ? "one bank loan" : `up to ${countWordEn(r.loans)} bank loans`;
      if (r.deadlineWeeks === null) return `Out of money: ${head}. No deadline: prizes and sales repay ${r.loans === null || r.loans === 1 ? "it" : "them"}`;
      const repay = r.loans === null || r.loans === 1 ? "it" : "each";
      return `Out of money: ${head}. Repay ${repay} within ${r.deadlineWeeks} ${r.deadlineWeeks === 1 ? "week" : "weeks"} or the career ends`;
    },
    // CAREER_LOAN.breachesToEnd 1: the first Monday below the floor ends the career — no loan.
    presetMoneyNoLoan: "If you run out of money, the career ends",
    // rc.34 review: the training delegation the preset starts on (difficulty.presetTrainingModeOf,
    // CAREER_PLAN.modeByPreset) and whether cups are entered for you (the preset's prefs).
    presetHelp: (mode: "auto" | "recommend" | "manual", autoCups: boolean): string =>
      `${{ auto: "The best training plan is tagged for you", recommend: "The best plan is tagged and you pick", manual: "You plan training, no hints" }[mode]}. ${autoCups ? "Cups are entered for you" : "You pick every cup"}`,
    summaryTitle: "Summary",
    found: (org: string) => `Found ${org}`,
    founded: "EST. 2020",
  },

  hub: {
    title: "HQ",
    continue: "Continue",
    continueTo: (label: string) => `Advance: ${label}`,
    advanceDay: "Advance one day",
    nowDecision: "Decision required",
    week: (n: number) => `Week ${n}`,
    matchdayIn: (n: number) => (n === 0 ? "Matchday" : n === 1 ? "Matchday tomorrow" : `Matchday in ${n} days`),
    seasonGoal: "Season goal",
    form: "Form",
    chemistry: "Chemistry",
    pointsRace: "Road to Worlds",
    pointsRank: (rank: number, pts: number) => `#${rank} · ${pts} pts`,
    pointsGap: (pts: number) => `${pts} pts below the line`,
    pointsSafe: "Above the cut-line",
    // RTW-01 (R49): level with the last seat on points, below it on the tie-break.
    pointsLevel: "Level with the line",
    // RTW-01 (R49): before the race has points (the table is only an order by name).
    pointsNone: "No points yet",
    budget: "Balance",
    news: "The wire",
    newsAll: "Full feed",
    inboxTeaser: "Inbox",
    inboxAll: "Open inbox",
    trainingWeek: "Training week: squad gets extra reps",
    emptyStateBody: "Your first event is on the calendar",
    // v0.3 FIFA-style autoplay
    play: "Play",
    pause: "Pause",
    playHint: (label: string) => `Playing, next: ${label}`,
    skipToNext: "Skip ahead",
    // v0.3 transfer wire panel
    transfersTitle: "Transfer window",
    transfersAll: "All regions",
    transfersEmpty: "No moves logged yet: the wire fills as the window runs.",
    transfersFa: "Free agent",
    transfersUser: "Your move",
    transfersShowAll: (n: number) => `Show all ${n} moves`,
    // v2.0 hub rebuild (R26)
    today: "Today",
    dayOf: (d: number, total: number) => `Day ${d} of ${total}`,
    nextStop: (label: string, s: string) => `Next stop: ${label} · ${s}`,
    inviteTitle: (name: string) => `Invite: ${name}`,
    inviteBody: (day: string) => `Community cup on ${day}. Accept to enter, or pass and keep training.`,
    inviteAccept: "Accept invite",
    invitePass: "Pass",
    // RTW-05 (rc.33): a squad under three — the clock waits for a third player.
    squadShortKicker: "Squad short",
    squadShortTitle: "Sign a player",
    squadShortBody: (n: number, event: string) =>
      `Only ${n} of 3 seats filled before ${event}. A free agent can join today, window or not.`,
    // rc.39 F6 (R103): a starter ruled out and no reserve — the same hold, worded for it.
    squadShortAbsentTitle: "No substitute",
    absenceReasons: { fatigue: "training fatigue", illness: "illness", fitness: "fitness issues", media: "a media day" }, // v2.3 MEDIA
    squadShortAbsentBody: (player: string, event: string, reason?: string) =>
      `${player} is out of ${event} (${reason ?? "fitness issues"}) and there is no sub. Sign one in a transfer window or sit this event out.`,
    squadShortAbsentSkip: "Sit this event out",
    squadShortAbsentSkipHint: (event: string) => `${event}: no entry, no points, no prize.`,
    squadShortMarket: "Go to the Market",
    squadShortSquad: "Squad",
    contractsExpiring: (n: number) => (n === 1 ? "1 contract ends this season" : `${n} contracts end this season`),
    cashWarningCard: (weeks: number) => `Cash lasts about ${weeks} weeks at the current spending`,
    // ECO-02 (R46): the card names the debt Finances shows. rc.34: the bank's emergency loan and its deadline.
    backerOpen: (owed: string) => `Emergency loan: ${owed} owed`,
    loanDue: (date: string, weeks: number) =>
      weeks <= 0
        ? `Due this Monday (${date}).`
        : weeks === 1
          ? `Due next Monday, ${date}.`
          : `Due ${date} (${weeks} weeks).`,
    // rc.32 (M4): the HQ line under it — what the next breach means (rc.34: the flow's nextBreachParamsOf).
    backerNextBreach: (p: Record<string, string | number>) => nextBreachEn(p),
    autoplayOn: "Autoplay on: pausing at the next stop",
    // rc.2 hub v3
    skipTo: (label: string) => `Skip to ${label}`,
    plusDay: "+1 day",
    squadTitle: "Squad",
    squadManage: "Manage squad",
    squadSub: "Sub",
    squadCoach: "Coach",
    squadNoCoach: "No coach: hire one in the Market",
    squadNoSub: "No sub signed",
    growthNext: (days: number) => (days === 1 ? "+1 OVR tomorrow" : `+1 OVR in ${days} days`),
    growthStalled: "Growth capped",
    trainingTitle: "Training",
    trainingToday: "Session today",
    trainingRest: "Rest day",
    trainingMatch: "Match prep",
    financesTitle: "Finances",
    financesOpen: "Open finances",
    // rc.34 (UX-01a, HQ-CONTRACT H1): one decision at a time; 1-B's "Later" for bids and sponsor offers.
    decisionCount: (i: number, n: number) => `${i} of ${n}`,
    later: "Later",
    alsoDue: "Also",
    parked: "Parked",
    dueBy: (date: string) => `by ${date}`,
    dueToday: "last day",
    lastDay: "Last day to answer. The clock waits.",
    standsUntil: (date: string) => `Open until ${date}`,
    decisionKind: {
      event: "Matchday",
      seasonReview: "Season review",
      notice: "Notice",
      contractReview: "Contract review",
      squadShort: "Squad short",
      insert: "Weekly decision",
      invite: "Invite",
      training: "Training plan",
      bid: (player: string) => `Bid for ${player}`,
      trade: (player: string) => `Trade: ${player}`,
      sponsor: "Sponsor offers",
      sunday: "Start Sunday",
      follow: "Without you",
      board: "The board",
      post: "Post to the fans", // rc9 STORIES
    },
    noticeTitle: "A notice needs you",
    // rc.36 (front S2, Miguel on rc.35): the sponsor choice is a pop-up; the block only prompts it.
    sponsorSeeOffers: "See the offers",
    // rc.34 (Miguel, 31/10): a short squad can sit a regional out.
    squadShortSkip: "Skip this regional",
    squadShortSkipHint: (event: string) => `${event}: no entry, no points, no prize.`,
    // rc.34 (UX-01b, HQ-CONTRACT H2): the squad as Draft cards.
    cardStarter: "Starter",
    cardReserve: "Reserve",
    cardEmptySeat: "Empty seat",
    cardSignHint: "Sign a player",
    cardUntil: (season: string) => `Until ${season}`,
    cardEndsIn: (weeks: number) => (weeks <= 0 ? "Leaves at the rollover" : weeks === 1 ? "Ends in 1 week" : `Ends in ${weeks} weeks`),
    cardFinalSeason: "Final season",
    // rc.35 (front C): the coach card's training chip.
    coachTrainingPct: (pct: number) => `${pct > 0 ? "+" : ""}${pct}% training`,
    // rc.34 (UX-01d, decision 6-A): the week's seeding question.
    nextRegional: (ordinal: number, week: number) => `Next regional (R${ordinal}, week ${week})`,
    // rc.34 (UX-01e, HQ-CONTRACT H5): the money, booked or committed only.
    financePerWeek: (amount: string) => `${amount} a week`,
    financePayroll: "Next payroll",
    financeRunway: "Runway",
    // rc.36 (POL-02): the runway line's value.
    financeRunwayWeeks: (weeks: number) => (weeks === 1 ? "1 week of cash" : `${weeks} weeks of cash`),
    financeOverdraft: (floor: string) => `Using credit. Below ${floor} on a Monday, the bank lends.`,
    financeRunwayOk: "In the black",
    // rc.34 review: the emergency loan (rc.31–rc.33's "Backer" is gone from the product).
    financeDebtBacker: (owed: string) => `Emergency loan ${owed}`,
    // rc9 HQ (#244): the season's player stats on HQ.
    statsAll: "All stats",
    statsBest: "Best rating",
    statsEmptyHint: "The box scores of your first event fill this in.",
  },

  // v0.2 Inbox — mail addressed to the manager (offers, sponsors, contracts).
  mail: {
    greeting: "Hello,",
    signoff: "Best regards,",
    title: "Inbox",
    unread: (n: number) => `${n} unread`,
    unreadLabel: "Unread",
    needsReply: "Reply needed",
    back: "Inbox",
    markAllRead: "Mark all read",
    empty: "No mail",
    emptyHint: "Offers, sponsorship deals and contract notices arrive here",
    open: "Open",
    from: {
      bank: "Northline Bank",
      accountant: "Org accountant",
      board: "The Board",
      owner: "The Owner",
      agent: "Player Agents",
      sponsor: "Sponsor Relations",
      // History: rc.31–rc.33 mails from the Emergency Backer (rc.34: the bank lends instead).
      backer: "Emergency Backer",
      league: "League Operations",
      staff: "Team Operations",
    },
    kinds: {
      offer: "Transfer",
      sponsor: "Sponsorship",
      contract: "Contracts",
      finance: "Finances",
      unlock: "Unlocked",
      club: "Club",
    },
    tpl: {
      incomingBid: (p: Record<string, string | number>) => `Offer for ${p.player}`,
      listingNoBuyer: (p: Record<string, string | number>) => `No takers for ${p.player}`,
      listingTooDear: (p: Record<string, string | number>) => `${p.player}: the ask drew no offer`,
      listingOffer: (p: Record<string, string | number>) => `${p.org} meet your ask for ${p.player}`,
      listingCounter: (p: Record<string, string | number>) => `${p.org} counter for ${p.player}`,
      tradeRefusedFit: (p: Record<string, string | number>) => `${p.org} turn down the trade for ${p.take}`,
      tradeRefusedValue: (p: Record<string, string | number>) => `${p.org} find the trade for ${p.take} too light`,
      tradeAgreed: (p: Record<string, string | number>) => `${p.org} agree to trade ${p.take}`,
      tradeCountered: (p: Record<string, string | number>) => `${p.org} ask for cash in the ${p.take} trade`,
      blockbusterBid: (p: Record<string, string | number>) => `Blockbuster bid: ${p.org} want ${p.player}`,
      sponsorOffers: () => `Sponsorship offers are waiting`,
      objectiveHit: (p: Record<string, string | number>) => `${p.name}: objective met`,
      objectiveMissed: (p: Record<string, string | number>) => `${p.name}: objective missed`,
      contractExpiring: (p: Record<string, string | number>) => `${p.player}: contract in its final season`,
      // rc.34 (UX-06b): the reminders before a player can leave.
      contractReminder: (p: Record<string, string | number>) => `Contracts: ${p.weeks} weeks left for ${p.players}`,
      bankLoan: (p: Record<string, string | number>) => `Bank loan approved: ${p.amount}`,
      // rc.37 F2: the bank's offer before the floor, and the emergency sale's offer.
      creditOffer: (p: Record<string, string | number>) => `The bank offers a ${p.loanNet} loan`,
      emergencyBid: (p: Record<string, string | number>) => `Emergency offer for ${p.player}`,
      bankCleared: () => `Bank loan repaid`,
      cashWarning: (p: Record<string, string | number>) => `Cash lasts about ${p.weeks} more weeks`,
      qualifiedRegional: (p: Record<string, string | number>) => `Through the qualifier: ${p.event} is on`,
      missedRegional: (p: Record<string, string | number>) => `Out at the qualifier: ${p.event} goes on without you`,
      // History: the rc.31–rc.33 Backer's rescue mail (rc.34 sends emergencyLoan instead).
      backerIn: () => `Emergency funding arranged`,
      // rc.34 (Miguel, 31/10): the bank's emergency loan, its top-ups, its deadline.
      emergencyLoan: () => `Emergency loan from the bank`,
      emergencyTopUp: () => `The bank adds to your emergency loan`,
      loanDeadline: (p: Record<string, string | number>) =>
        Number(p.weeksLeft) === 1 ? `Emergency loan: due next Monday` : `Emergency loan: ${p.weeksLeft} weeks to the deadline`,
      loanCollected: () => `Emergency loan settled on its deadline`,
      // rc.34 review: the projection stopped covering the debt inside the deadline's last weeks.
      loanSlipped: () => `Emergency loan: no longer covered`,
      loanTakenOver: () => `The bank takes over the Backer's loan`,
      unlock: (p: Record<string, string | number>) => `New for the org: ${p.name}`,
      windowReport: (p: Record<string, string | number>) => `Window report: ${p.n} moves`,
      unavailable: (p: Record<string, string | number>) => `${p.player} out for ${p.event}`,
      noReserve: () => `No reserve in the squad`,
      debtCleared: () => `Emergency loan repaid`,
      // DEV-02 (R48): the user's own retiree — which way he went.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} retires and moves into coaching`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} retires from competition`,
      // v2.1 M1 (R139): the user's coach ages and retires.
      coachRetireAnnounce: (p: Record<string, string | number>) => `${p.coach} announces his last season`,
      coachRetired: (p: Record<string, string | number>) => `${p.coach} retires from coaching`,
      // rc.32 (ECONOMY-CONTRACT M3 / M4).
      foundingPartner: () => `A founding partner backs the org`,
      foundingPartnerEnds: () => `The founding partner steps back`,
      cashNotice: (p: Record<string, string | number>) => `Cash lasts about ${p.weeks} more weeks`,
      // rc.32 history (ECO-08 / ECO-12): nothing sends these since rc.33 — kept so an older save's inbox still reads.
      restructured: () => `The Backer restructured the org`,
      // rc.34 (ECO-04): the deals' mails.
      sponsorLapsed: () => `The sponsorship offers lapsed`,
      // rc.36 (front S2): CAREER_SPONSOR.deadlineRule "signSafest" — nobody picked by the deadline.
      sponsorAutoSigned: (p: Record<string, string | number>) => `${p.name}: the safest deal, signed for you`,
      sponsorGoalHit: (p: Record<string, string | number>) => `${p.name}: goal reached`,
      sponsorGoalMissed: (p: Record<string, string | number>) => `${p.name}: goal missed`,
      sponsorGoalSet: (p: Record<string, string | number>) => `${p.name}: the Split ${p.goalSplit} goal`,
      sponsorEnded: (p: Record<string, string | number>) => `${p.name}: the deal is complete`,
      foundingHandover: () => `The founding partner hands over`,
      // v2.0 (C1)
      sponsorBootcamp: (p: Record<string, string | number>) => `${p.name}: your bootcamp is booked`,
      coachContractExpiring: (p: Record<string, string | number>) => `${p.coach}: deal in its final season`,
      coachRenewed: (p: Record<string, string | number>) => `${p.coach} renews`,
      coachLeft: (p: Record<string, string | number>) => `${p.coach} leaves at the end of his deal`,
    },
    body: {
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} bid ${p.fee} for ${p.player}. Answer in Market, Deals, before the window closes.`,
      listingNoBuyer: (p: Record<string, string | number>) =>
        `No org in his region answered your ${p.ask} listing for ${p.player}. Withdraw him, or list him again in the next window.`,
      listingTooDear: (p: Record<string, string | number>) =>
        `The market passed on ${p.player} at ${p.ask}. Lower the ask in Market, Deals, or withdraw him.`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} will pay ${p.fee} for ${p.player}, the fee you asked. Answer in Market, Deals, before the window closes.`,
      listingCounter: (p: Record<string, string | number>) =>
        `${p.org} offer ${p.fee} for ${p.player}, under your ask of ${p.ask}. Answer in Market, Deals, before the window closes.`,
      tradeRefusedFit: (p: Record<string, string | number>) =>
        `${p.org} will not swap ${p.take} for ${p.give}: it would weaken their lineup too much. The proposal is closed.`,
      tradeRefusedValue: (p: Record<string, string | number>) =>
        `${p.org} value ${p.take} well above ${p.give}, and the cash offered does not close the gap. The proposal is closed.`,
      tradeAgreed: (p: Record<string, string | number>) =>
        `${p.org} agree to send ${p.take} for ${p.give}, with ${p.cash} in cash from you. Answer in Market, Deals, before the window closes.`,
      tradeCountered: (p: Record<string, string | number>) =>
        `${p.org} will send ${p.take} for ${p.give} if you add ${p.cash} in cash. Answer in Market, Deals, before the window closes.`,
      // rc.32 (Miguel, 30/10): what a Blockbuster bid is, why it came, its price and the cost of refusing.
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} bid ${p.fee} for ${p.player}, ${p.mult === undefined ? "well above" : `${Math.round((Number(p.mult) - 1) * 100)}% above`} his market value. If you refuse or let it expire he stays, and his next renewal ask ${p.pct === undefined ? "can rise" : `rises ${p.pct}%`}.`,
      foundingPartner: (p: Record<string, string | number>) =>
        `A local partner pays ${p.base} a split, every Monday, for entering events. It stays until your first sponsorship deal, and at least through ${p.through}.`,
      foundingPartnerEnds: () =>
        `The founding partner's term has ended. Income now comes from sponsors and prizes.`,
      cashNotice: (p: Record<string, string | number>) =>
        `At ${p.burn} a week your cash lasts about ${p.weeks} more weeks, and the books go below the floor (${p.floor}) on ${breachWhenEn(p)}. ${nextBreachEn(p)} Ways out: accept a bid for a player, win prizes, keep the next renewals in check${Number(p.backer) ? "" : ", or take a bank loan"}.`,
      // rc.32 history (ECO-08 / ECO-12): nothing sends these since rc.33 — kept so an older save's inbox still reads.
      restructured: () => `The Backer restructured the org (older save).`,
      sponsorOffers: () =>
        `Brands are bidding for the org. Review the offers in Finances: the base pay is guaranteed and the bonus depends on the goal.`,
      objectiveHit: (p: Record<string, string | number>) =>
        `Sponsor objective met. The bonus of ${p.bonus} arrives with the next payday.`,
      objectiveMissed: (p: Record<string, string | number>) =>
        `Sponsor objective missed. Repeated misses worsen the next offer. Misses so far: ${p.misses}.`,
      // rc.34 (ECO-04): the deals' mails.
      // rc.36 (front S2): two or three brands (the ladder's access), priced by risk (rc.35), and the deadline rule.
      sponsorDecision: (p: Record<string, string | number>) =>
        `Brands offer the org a ${Number(p.n) === 2 ? "Steady or a Balanced deal" : "Steady, Balanced or Bold deal"} (level ${p.tier}). Bolder deals pay more, with harder goals and bigger fines. Sign one by Sunday of week ${p.byWeek}${Number(p.auto) ? "; after that the safest is signed for you" : "; that day the clock waits for your pick"}.${Number(p.demoted) ? " Three goals slipped on the last Steady deal, so this round is a level lower." : ""}`,
      sponsorLapsed: () =>
        `Nobody signed before the deadline, so the brands moved on. New offers come at the next split.`,
      sponsorAutoSigned: (p: Record<string, string | number>) =>
        `No deal was picked by the deadline, so the org signed the safest one: ${p.name}. Its terms are in Finances.`,
      sponsorGoalHit: (p: Record<string, string | number>) =>
        `${goalOfParamsEn(p)}: done. The bonus of ${p.bonus} arrives today${positive(p.milestone) ? `, with the milestone payment of ${p.milestone}` : ""}.`,
      sponsorGoalMissed: (p: Record<string, string | number>) =>
        `${goalOfParamsEn(p)}: ${p.done} of ${p.target}. ${
          positive(p.fine)
            ? `The fine is ${p.fine}, paid as ${p.perMonday} on each of the next ${p.mondays} Mondays.`
            : Number(p.steady)
              ? `No fine on a Steady deal. After ${p.patience} misses the next offers get worse (${p.misses} so far).`
              : "No fine."
        }`,
      sponsorGoalSet: (p: Record<string, string | number>) =>
        `New goal: ${goalOfParamsEn(p)} (${SPONSOR_WORD_EN[String(p.word)] ?? p.word}). It pays ${p.bonus}${positive(p.fine) ? `; a miss costs up to ${p.fine}` : ""}.`,
      sponsorEnded: (p: Record<string, string | number>) =>
        `The deal is over: ${p.hits} of ${p.goals} goals reached. New offers are on your desk.${Number(p.demoted) ? " After three misses on a Steady deal, they come at a lower level." : ""}`,
      foundingHandover: (p: Record<string, string | number>) =>
        `The partner steps back: ${p.first}% of its pay until ${stepWhenEn(p.stepWeek, p.stepNextSeason)}, ${p.second}% until ${stepWhenEn(p.endWeek, p.endNextSeason)}, then it ends.`,
      contractExpiring: (p: Record<string, string | number>) =>
        `${p.player} is in the final season of his deal. You can re-sign him through Split 3; after that he leaves for free.`,
      contractReminder: (p: Record<string, string | number>) =>
        `${p.players}: out of contract after this season, ${p.weeks} weeks left. Renew in Squad or they leave as free agents.`,
      bankLoan: (p: Record<string, string | number>) =>
        `The bank paid in ${p.amount}. Instalments of ${p.weekly} come out every Monday until ${p.total} is repaid.`,
      // rc.37 F2 (package 2): the bank's ordinary loan, offered on the Monday the runway reaches the warning level.
      creditOffer: (p: Record<string, string | number>) =>
        `${Number(p.weeks) > 0 ? `At ${p.burn} a week your cash lasts about ${p.weeks} more weeks` : `The balance is ${p.balance} at ${p.burn} a week`}, and the books go below the floor (${p.floor}) on ${breachWhenEn(p)}. The bank offers ${p.loanNet} now, repaid at ${p.loanWeekly} a week for ${p.loanTerm} weeks (${p.loanTotal} in all, ${p.loanPct}% interest). The emergency loan costs ${p.emergencyPct}%${Number(p.emergencyTerm) > 0 ? `, repaid within ${p.emergencyTerm} weeks` : ""}. You can pick another amount in Finances.`,
      // rc.37 F2 (package 3): an emergency-sale offer — below market value, while the books are in the red.
      emergencyBid: (p: Record<string, string | number>) =>
        `${p.org} offer ${p.fee} for ${p.player}, ${p.pct}% of his market value, while your books are in the red (${p.balance}). It stays open ${p.days} days or until the window closes, and accepting sells him now. Details in Market, Deals.`,
      bankCleared: () =>
        `Last instalment paid. The bank will lend again if you need it.`,
      // rc.32 (M4, provisional): every Monday at ≤ 4 weeks — the projected breach and the way out.
      cashWarning: (p: Record<string, string | number>) =>
        p.breachWeek === undefined
          ? `At ${p.net} a week your cash lasts about ${p.weeks} more weeks. Trim wages, win prizes or take a bank loan before the books break the floor.`
          : `At ${p.burn} a week your cash lasts about ${p.weeks} more weeks, and the books go below the floor (${p.floor}) on ${breachWhenEn(p)}. ${nextBreachEn(p)} Ways out: accept a bid for a player, win prizes, trim the wage bill at renewal${Number(p.backer) ? "" : ", or take a bank loan"}.`,
      qualifiedRegional: (p: Record<string, string | number>) =>
        `The org finished Saturday's Swiss among the eight that go through. ${p.event} is on Sunday.`,
      missedRegional: (p: Record<string, string | number>) =>
        `Three losses in Saturday's Swiss: the org is out of ${p.event}, played on Sunday. A new training week starts Monday.`,
      // HISTORY (rc.32–rc.33): the Backer's rescue mail, as it was sent (rc.34 sends emergencyLoan).
      backerIn: () => `Emergency funding arranged (older save).`,
      // rc.34 (Miguel, 31/10): the bank's emergency loan — why, how much, how it is repaid, by when,
      // the investor if it came with it, and what ends the career.
      emergencyLoan: (p: Record<string, string | number>) =>
        `The balance fell below the floor (${p.floor}), so the bank lent ${p.lent}. You owe ${p.owed} with interest${p.dlWeek !== undefined ? `, due on ${mondayWhenEn(p.dlWeek, p.dlAhead)}` : ""}. Prizes (${p.garnishPct}%) and sales (${p.salePct}%) repay it automatically.${positive(p.partnerWeekly) ? ` The investor ${p.partnerName} adds ${p.partnerWeekly} a week for ${p.partnerWeeks} weeks.` : ""}${Number(p.lock) ? " Transfer fees, gear and new commitments are on hold while it is owed." : ""} ${nextBreachEn(p)} Full terms in Finances.`,
      emergencyTopUp: (p: Record<string, string | number>) =>
        `The balance fell below the floor again, so the bank lent ${p.lent} more. You now owe ${p.owed}${p.dlWeek !== undefined ? `, and the deadline stays: ${mondayWhenEn(p.dlWeek, p.dlAhead)}` : ""}. ${nextBreachEn(p)}`,
      // rc.34 review: the books projected to the deadline (an older mail without the projection reads today's balance).
      loanDeadline: (p: Record<string, string | number>) =>
        `${Number(p.weeksLeft) === 1 ? "One week" : `${p.weeksLeft} weeks`} to the emergency loan deadline, ${mondayWhenEn(p.dlWeek, p.dlAhead)}. You owe ${p.owed} and the balance is ${p.balance}. ${p.projected === undefined ? (Number(p.covered) ? "The balance covers it." : "The balance does not cover it.") : onPaceEn(p)}${Number(p.covered) ? "" : ` ${gapWaysEn(p)}`}`,
      loanCollected: (p: Record<string, string | number>) =>
        `The emergency loan fell due and the bank took ${p.collected}. The balance is ${p.balance}. ${p.next === undefined ? "Going below the floor again opens a new loan." : nextBreachEn(p)}`,
      loanSlipped: (p: Record<string, string | number>) =>
        `${Number(p.weeksLeft) === 1 ? "One week" : `${p.weeksLeft} weeks`} before the deadline, ${mondayWhenEn(p.dlWeek, p.dlAhead)}, the books stopped covering the ${p.owed} owed: at ${p.net} a week the balance would be ${p.projected} that Monday, ${p.gap} short. ${gapWaysEn(p)}`,
      loanTakenOver: () => `The bank took over the Backer's loan (older save).`,
      unlock: (p: Record<string, string | number>) =>
        `${p.name} is now available.`,
      windowReport: (p: Record<string, string | number>) =>
        `${p.n} moves across all regions. Headline fees: ${p.p1} (${p.f1})${p.p2 ? ` · ${p.p2} (${p.f2})` : ""}${p.p3 ? ` · ${p.p3} (${p.f3})` : ""}.`,
      unavailable: (p: Record<string, string | number>) =>
        `${p.player} can't play ${p.event}. The sub takes his seat with his chemistry.`,
      unavailableNoReserve: (p: Record<string, string | number>) =>
        `${p.player} is out of ${p.event} and there is no reserve. Reserves only sign in a transfer window: without one open before the event, the team misses it.`,
      noReserve: () =>
        `A starter can be ruled out of an official event. A reserve steps in; without one the team misses it. Reserves only sign in a transfer window.`,
      // rc.34 review: with what the next breach does (the career's last loan repaid: the end) — an older mail reads as sent.
      debtCleared: (p: Record<string, string | number> = {}) =>
        `The emergency loan is repaid and its deadline is gone. ${p.next === undefined ? "The bank will lend again if you need it." : nextBreachEn(p)}`,
      retiredToCoach: (p: Record<string, string | number>) =>
        `${p.player} retires and moves into coaching. He is in the coach pool.`,
      retiredLeaves: (p: Record<string, string | number>) =>
        `${p.player} retires. His slot is open.`,
      coachRetireAnnounce: (p: Record<string, string | number>) =>
        `${p.coach} will retire at the end of this season. Hire a successor before the first event of next season.`,
      coachRetired: (p: Record<string, string | number>) =>
        `${p.coach} retires. The bench is empty: hire a coach from the market before the first event.`,
      // v2.0 (C1)
      sponsorBootcamp: (p: Record<string, string | number>) =>
        `The sponsor pays for this split's bootcamp. It is already running and its edge lasts until the split ends. ${
          Number(p.left) > 0
            ? `${p.left} more this season.`
            : `That is this season's allowance (${p.perSeason}).`
        }`,
      coachContractExpiring: (p: Record<string, string | number>) =>
        `${p.coach}'s deal ends this season. He asks ${p.wage} a week (now ${p.old}). Renew him on the Coaches page or he leaves at the rollover, with no severance.`,
      coachRenewed: (p: Record<string, string | number>) =>
        Number(p.raised)
          ? `${p.coach} signed for ${p.seasons} more seasons at ${p.wage} a week, up from ${p.old}.`
          : `${p.coach} signed for ${p.seasons} more seasons at ${p.wage} a week.`,
      coachLeft: (p: Record<string, string | number>) =>
        `${p.coach}'s deal ended without a renewal. No severance is owed. The squad trains without a coach until you hire one.`,
    },
  },

  // v0.2 scrims — weekday blocks between events. v0.3: schedulable, opponent
  // choice, visible results.
  // rc9 MATCHDAY (copy audit): the old booking UI's keys are gone.
  scrim: {
    live: "Scrim live",
    title: "Scrim",
    vs: (opp: string) => `vs ${opp}`,
    won: (opp: string, a: number, b: number) => `Won ${a}-${b} vs ${opp}`,
    lost: (opp: string, a: number, b: number) => `Lost ${a}-${b} vs ${opp}`,
    cancel: "Cancel",
    noResults: "No scrims yet this season.",
    gameLine: (scores: string) => `Games: ${scores}`,
  },

  calendar: {
    previousMonth: "Previous month",
    nextMonth: "Next month",
    title: "Calendar",
    today: "Today",
    preseason: "Preseason",
    openWeek: "Open week",
    window: "Transfer window",
    worldsWindow: "Worlds window",
    windowOpen: "Window open",
    windowCloses: (n: number) =>
      n <= 0 ? "Window closes today" : n === 1 ? "Window closes tomorrow" : `Window closes in ${n} days`,
    regional: (n: number) => `Regional ${n}`,
    major: "Major",
    worlds: "World Championship",
    split: (n: number) => `Split ${n}`,
    registered: "Entered",
    notQualified: "Not qualified",
    done: "Done",
    stakes: "Stakes",
    prizePool: "Prize pool",
    points: "Season Points",
    field: "Field",
    fieldQuality: "Field level",
    enter: "Enter",
    skip: "Pass",
    skipHint: "Skip to train that week (+25%).",
    offerTitle: "Tournament invite",
    // v0.2 day view
    nextForYou: "Next for you",
    later: "After that", // rc9 HQ: the stops after the next one
    matchday: "Matchday",
    payday: "Payday",
    trainingDay: "Training",
    restDay: "Rest",
    scrimDay: "Scrim",
    legend: "Legend",
    advanceDay: "Advance one day",
    advanceToStop: (label: string) => `Continue: ${label}`,
    seasonEnd: "Season close",
    // rc.36 (CAL-01, SUN-01/03)
    windowUntil: (date: string) => `Transfer window · until ${date}`,
    sundayAhead: "Start Sunday in HQ",
    follow: "Follow it",
  },

  squad: {
    title: "Squad",
    starters: "Starters",
    bench: "Bench",
    subSlot: "Substitute",
    coachSlot: "Coach",
    staffRow: "Staff & boosts",
    hire: "Hire",
    emptySub: "No reserve. If a starter is ruled out, the team misses the event. Reserves only sign in a transfer window.",
    emptyCoach: "A coach boosts development and match prep.",
    contracts: "Contracts",
    wage: "Wage",
    perWeek: (s: string) => `${s} / week`,
    expires: (label: string) => `Ends ${label}`,
    expiring: "Contract expiring",
    // rc.34 (UX-06b): the time left on a final-season contract, and the review before the rollover.
    weeksLeft: (n: number) => (n <= 0 ? "leaves at the rollover" : n === 1 ? "1 week left" : `${n} weeks left`),
    reviewTitle: "Before the new season: contracts",
    reviewBody: (n: number) =>
      n === 1
        ? "1 contract ends with this season. Renew it in Squad, or let it run out: he leaves at the rollover."
        : `${n} contracts end with this season. Renew them in Squad, or let them run out: they leave at the rollover.`,
    reviewRenew: "Renew in Squad",
    reviewConfirm: (n: number) => (n === 1 ? "Let him go" : `Let all ${n} go`),
    reviewDone: "Reviewed: they leave at the rollover.",
    reviewHeld: "A decision still waits at HQ: answer it before the new season.",
    renew: "Renew",
    release: "Release",
    releaseFee: (s: string) => `Severance: ${s}`,
    releaseConfirm: (name: string) => `Release ${name}?`,
    releaseBody: "Severance is paid now; the wage comes off the books.",
    makeStarter: "Move to starters",
    makeSub: "Move to bench",
    swapPreview: (a: number, b: number) => `Team rating ${a} → ${b}`,
    chemPreview: (a: number, b: number) => `Chemistry ${a}% → ${b}%`,
    bestLineup: "Best lineup",
    stability: "Roster stability",
    stabilityState: (used: number, max: number) => `New faces this split: ${used}/${max}`,
    stabilityWarning: (pct: number, pts: number) =>
      `Fielding another new face costs ${pct}% of your ${pts} Season Points`,
    finalSeason: "Final season",
    squadFull: "Squad full (3 starters + 1 sub)",
    // rc.32 (M2, provisional): the renewal rule and both numbers.
    renewalTerms: "Renewal terms",
    renewalRuleCapFloor: (cap: string, floorPct: number, jump: string) =>
      `Renewing your own player: the raise is capped at ×${cap} his current wage, never under ${floorPct}% of his market ask, and one renewal moves it ×${jump} at most.`,
    renewalRuleFresh: "Renewing prices his market ask.",
    renewalMarketAsk: "Market ask",
    renewalAsk: "Renewal ask",
    renewalBoundFresh: "Under the cap: he renews at his market ask.",
    renewalBoundCap: (cap: string) => `Capped at ×${cap} his current wage.`,
    renewalBoundFloor: (floorPct: number) => `Held at ${floorPct}% of his market ask.`,
    renewalBoundJump: (jump: string) => `Held at ×${jump} his current wage: the most one renewal moves it.`,
    renewalTitles: (pct: number) => `+${pct}% for the titles he won with you lately.`,
    renewalAmbition: (pct: number) => `+${pct}% ambition: a star at a smaller org asks more.`,
    renewalBlockbuster: (pct: number) => `+${pct}%: you turned down a Blockbuster bid for him.`,
    // rc.37 (F1): the tenure ladder and the premium cap.
    renewalTenure: (seasons: number) =>
      `${seasons} seasons with you: his renewal gets pricier every year.`,
    renewalPremiumCapped: (pct: number) =>
      `Premiums capped: ambition, a refused Blockbuster and titles add +${pct}% at most.`,
    renewalsTitle: "Contracts up for renewal",
    renewalsEmpty: "No contract ends this season.",
    renewalsGo: "Renew on Squad",
    // rc9 DS: the Squad screen's rebuilt contracts and stability line.
    colPlayer: "Player",
    colEnds: "Contract",
    colWage: "Wage",
    colMood: "Mood",
    contractsEnding: (n: number) =>
      n === 1 ? "1 ends this season" : `${n} end this season`,
    contractsSettled: "None ends this season",
    stabilityLine: (used: number, max: number) => `Roster stability: ${used} of ${max} new faces this split`,
    openMood: (name: string) => `Why ${name} feels this way`,
    roleStarter: "Starter",
  },

  player: {
    age: (n: number) => `Age ${n}`,
    potential: "Potential",
    potBand: (min: number, max: number) => `POT ${min}-${max}`,
    potExact: (v: number) => `POT ${v}`,
    overall: "Overall",
    attributes: "Attributes",
    development: "Development",
    contract: "Contract",
    history: "History",
    scoutReport: "Scout report",
    scoutCost: (s: string) => `Order report · ${s}`,
    scoutDone: "Fully scouted",
    scoutHint: "Narrows the potential range and reveals his phase.",
    growthRoom: "Growth room",
    // DEV-04 (rc.33): his phase on his own arc — "?" until a scouting report reveals it.
    phase: { growing: "Developing", prime: "At his peak", declining: "Declining", unknown: "Not scouted" },
    phaseUnknownHint: "A scouting report shows whether he is developing, at his peak or declining",
    // ECO-10 (rc.33): the prize share his contract carries.
    prizeShare: "Prize share",
    prizeSharePct: (pct: number) => `${pct}% of podium prizes`,
    // rc.34 (front I): a contract with no prize share (under the threshold, a founding deal, or talked to 0 %).
    prizeShareNone: "No prize share",
    // rc.33 review: the seats the old team share is split over (CAREER_PRIZE_SHARE.legacySeats).
    prizeShareLegacy: (seats: number, regional: number, major: number, worlds: number) =>
      `Older deal: the team's ${regional} / ${major} / ${worlds}% split ${seats} ways (regional / Major / Worlds)`,
    projected: (v: string) => `Projected: ${v} by split's end`,
    trainingFocusLabel: "Training focus",
    archetype: {
      mechanical: "Mechanical",
      anchor: "Anchor",
      playmaker: "Playmaker",
      icecold: "Ice Cold",
      veteranmind: "Veteran Mind",
      allround: "All-Around",
    },
    archetypeHint: {
      mechanical: "Flashy ceiling, shaky floor.",
      anchor: "Holds the back post. Wins ugly games.",
      playmaker: "Creates for everyone. Reads the pitch first.",
      icecold: "Wants the deciding game.",
      veteranmind: "Slower hands, faster brain.",
      allround: "No holes in the kit.",
    },
    fictionalTag: "Sim player",
  },

  training: {
    weekSummary: "Squad growth this cycle",
    weekChemistry: "Chemistry",
    weekScrims: "This week’s scrims",
    weekScrimsEmpty: "No scrims recorded this week yet.",
    title: "Training",
    // rc9 TRAIN-MARKET: the screen's own titles and states.
    coachTitle: "Coach",
    noCoachTitle: "No coach",
    growthEmpty: "No players on the squad yet",
    effectsOpen: "Show",
    effectsClose: "Hide",
    facilityEffect: (pct: number) => `Gear: +${pct}% training`,
    matchXpHint: "Playing strong fields develops players faster than training",
    perWeekOverall: (v: string) => `+${v} OVR a week`,
    sessionToday: "Today",
    noSessionToday: "Not today",
    // rc.34 (DEV-03 §4b): the engine trains a committed week at half load (matchPrepShare).
    matchPrepWeek: "Match week: half load, and the event gives match XP",
    drills: {
      "mechanics-lab": "Mechanics lab",
      rotations: "Rotations",
      "set-plays": "Set plays",
      "film-room": "Film room",
      "clutch-sets": "Clutch sets",
    } as Record<string, string>,
    growth: "Growth",
    nextPoint: (ovr: number) => `Next: ${ovr} OVR`,
    etaDays: (days: number) => (days === 1 ? "about 1 training day" : `about ${days} training days`),
    etaNone: "Not moving: capped or at potential",
    etaAtPotential: "At potential",
    etaAtPeak: "At his peak, holding this level",
    declineLine: (perWeek: string) => `Past his prime: about −${perWeek} OVR a week`,
    effectsTitle: "What your attributes do",
    effectBaseline: (n: number) => `Below ${n} an attribute hurts the team. Overall matters most.`,
    effectDescription: {
      offense: "Pressure and scoring chances in every game",
      defense: "Keeps the opposition quiet in every game",
      mechanics: "The chance of a big play that swings a game",
      consistency: "Softens a bad game, never removes it",
      experience: "Composure when the team reaches the playoffs",
      clutch: "Rating in the deciding game of a series",
    } as Record<string, string>,
    effectWhen: {
      always: "every game",
      deciding: "deciding games",
      playoffs: "playoff games",
      badRolls: "evens out bad games",
      proc: "chance of a big play",
    } as Record<string, string>,
    effectRating: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} rating`,
    effectPct: (v: number) => `${v}%`,
    // rc.35 (front T, Miguel): the simplified training cycle — objective + intensity + scrims.
    cycle: {
      restart: "Restart the same plan",
      title: "Training cycle",
      cycleOf: (n: number, count: number) => `Cycle ${n} of ${count}`,
      dayOf: (day: number, len: number) => `Day ${day} of ${len}`,
      daysLeft: (n: number) => (n === 1 ? "1 day left" : `${n} days left`),
      endsOn: (date: string) => `Ends ${date}`,
      running: "Running now",
      by: { coach: "Coach's plan", user: "Your plan", auto: "Auto plan", base: "Base growth" } as Record<string, string>,
      controllerCoach: (name: string) => `${name} plans and starts every cycle. You can adjust it`,
      // rc.36 (front T2): a hired coach who no longer plans — he only recommends.
      controllerCoachOff: (name: string) => `You start each cycle. ${name}'s plan is tagged Recommended`,
      controller: {
        auto: "The best plan is tagged Recommended",
        recommend: "The best option in each step is tagged Recommended",
        manual: "You pick everything",
      } as Record<string, string>,
      steps: { objective: "Objective", focus: "Focus", intensity: "Intensity", scrims: "Scrims" } as Record<string, string>,
      // rc.36 (front T2, Miguel): Evolve / Gel / Recover.
      objectives: { development: "Evolve", preparation: "Gel", recovery: "Recover" } as Record<string, string>,
      objectiveEffect: {
        development: "Faster growth toward each player's peak",
        preparation: "Scrims build chemistry faster, with a little growth",
        recovery: "Less wear. Veterans hold their level longer",
      } as Record<string, string>,
      // rc.36 (front T2, Miguel): the squad focus is a choice again — one per plan.
      focuses: {
        balanced: "Balanced",
        "mechanics-lab": "Mechanics",
        rotations: "Defense",
        "set-plays": "Offense",
        "film-room": "Consistency",
        "clutch-sets": "Clutch",
      } as Record<string, string>,
      focusBalanced: "Overall growth only",
      focusEffect: (stats: string, perWeek: string) => `+${perWeek} ${stats} a week for everyone`,
      focusHint: "The attribute everyone sharpens, at no cost to overall growth",
      intensities: { light: "Light", normal: "Normal", heavy: "Heavy" } as Record<string, string>,
      intensityEffect: {
        light: "Slower growth, less wear",
        normal: "Standard growth, no added risk",
        heavy: "Faster growth, a small chance a starter misses an event",
      } as Record<string, string>,
      scrimChoices: { off: "None", easy: "Easy", even: "Even", hard: "Hard" } as Record<string, string>,
      scrimEffect: {
        off: "No scrims, no scrim wear",
        easy: "Builds confidence, little wear",
        even: "Builds the most chemistry",
        hard: "Most learning, small chance a starter misses an event",
      } as Record<string, string>,
      // rc.36 (front T2): nothing runs until a plan is picked and started.
      pickTitle: "Choose this cycle's plan",
      idle: "No plan running",
      idleLine: "Everyone grows at the base pace. A plan speeds it up",
      // rc9 TRAIN-MARKET: nothing to plan while the season is not running.
      paused: "Training runs while the season is on. Come back when it starts",
      choosePlan: "Choose a plan",
      start: "Start training",
      applyChanges: "Apply changes",
      pickAll: "Pick one option in each step",
      useRecommended: "Use the recommended plan",
      runsTo: (date: string, days: number) => `Runs to ${date} · ${days === 1 ? "1 day" : `${days} days`}`,
      fromTomorrow: "Today's session already ran: it starts tomorrow",
      startsTomorrow: "Starts tomorrow",
      promisedUnit: "OVR by the end",
      gainOf: (total: string) => `of +${total} OVR`,
      promiseTitle: "Cycle gain",
      onCompletion: (v: string) => `+${v} more lands when the cycle ends`,
      legend: { paid: "Earned", toCome: "To come", completion: "On completion" } as Record<string, string>,
      adjustHint: "Changing the plan keeps what you earned",
      facts: { session: "Session", risk: "Risk" },
      coachPlans: (name: string) => `${name} plans each cycle`,
      coachPlansHint: "Off: you start each cycle, his plan is tagged Recommended",
      riskLine: (pts: string) => `+${pts}% chance a starter misses an event`,
      scrimsAWeek: (n: number) => `${n} a week, practice only`,
      recommended: "Recommended",
      expectedGain: (v: string) => `+${v} OVR`,
      risk: (pts: string) => `+${pts}% chance a starter misses an event`,
      noRisk: "No added absence risk",
      adjust: "Adjust plan",
      useBase: "Use the base",
      cancel: "Cancel",
      scrimsDone: (done: number, planned: number) => `${done} of ${planned} scrims`,
      record: (w: number, l: number) => `${w}–${l}`,
      lastCycle: "Last cycle",
      noCoach: "Training runs at half strength",
      hireCoach: "Hire a coach",
      coachBoost: (pct: number) => `+${pct}% from your coach`,
      scrims: "Scrims",
      chemistry: "Chemistry",
      report: {
        kicker: "Cycle complete",
        title: (n: number, season: string) => `Cycle ${n} · ${season}`,
        avg: "Squad average",
        best: "Top gain",
        plan: "Plan",
        close: "Continue",
        open: "Open training",
        // rc.36 (front T2): the prettier report.
        completion: (v: string) => `+${v} landed on completion`,
        completionShort: (v: string) => `+${v} at the end`,
        planNext: "Change the next cycle",
        dontShowAgain: "Stop showing this report",
        showAutomatic: "Show cycle reports",
        coachNext: (name: string) => `${name} has started the next cycle`,
        joined: "Joined mid-cycle",
        players: "Player by player",
      },
      coach: {
        quality: "Quality",
        experience: "Experience",
        specialty: "Specialty",
        qualityEffect: (pct: number) => `Plans reach ${pct}% of full effect`,
        experienceEffect: (seasons: number) => (seasons === 1 ? "1 season" : `${seasons} seasons`),
        experienceHint: (pct: number, wear: number) => `Alone, his plan reaches ${pct}%${wear > 0 ? ` · ${wear}% less wear` : ""}`,
        specialtyEffect: (pct: number) => `+${pct}% on this objective`,
        expected: "Per starter, next cycle",
        vsNow: (v: string) => `${v} vs now`,
        same: "Same as now",
        wage: "Wage",
        exPro: "Ex-pro",
        proCoach: "Pro coach",
        staff: "Staff coach",
      },
    },
    // rc.34 (DEV-03, TRAINING-CONTRACT): one training package per period.
    plan: {
      base: "Base growth",
      rest: "Rest",
      proposalTitle: (name: string) => `${name}'s plan for this period`,
      approve: "Approve",
      notes: {
        joined: (p: Record<string, string | number>) => `${p.player} joined the plan`,
        coachHired: (p: Record<string, string | number>) => `${p.coach} took over the plan`,
        coachFired: (p: Record<string, string | number>) => `${p.coach} left: the plan ran on at the coachless rate`,
        objectiveChange: () => "The objective changed mid-period",
        // rc.36 (front T2): a cycle stopped before its end forfeits its held gain.
        cycleStopped: (p: Record<string, string | number>) => `The cycle stopped early: +${p.lost} held was forfeited`,
        coachEvent: () => "The coach planned preparation for the period's big event",
        coachWear: () => "The coach planned recovery after a heavy period",
      } as Record<string, (p: Record<string, string | number>) => string>,
      squadGrowth: "Squad growth",
    },
  },

  market: {
    title: "Market",
    freeAgents: "Free agents",
    contracted: "Under contract",
    myDeals: "My deals",
    // The phone's one-row tab strip: each label in a quarter of the screen.
    tabsShort: { free: "Free", contracted: "Signed", coaches: "Coaches", deals: "Deals" },
    windowClosed: "Market closed",
    windowClosedHint: (label: string) => `Transfer window opens ${label}`,
    scoutingOpen: "Scouting stays open between windows",
    // RTW-05 (rc.33): a squad under three signs a free agent into the empty seat, window or not.
    emptySeatOpen: "Your squad is short of three: a free agent can take the empty seat today",
    // RTW-05 (rc.33 review): the free agent the empty seat always takes, whatever the balance (careerFlow.emptySeatPriceFor).
    emptySeatCheapest: (name: string, wage: string) =>
      `Short of money? ${name} (${wage} / week) is the cheapest free agent for the seat`,
    // rc9 TRAIN-MARKET: the candidate board's heads, and what a candidate changes in the team.
    feeLine: (fee: string) => `Fee ${fee}`,
    teamUp: (n: number, name: string) => `+${n} over ${name}`,
    teamSub: "Joins as sub",
    teamSeat: "Takes the empty seat",
    clearFilters: "Clear filters",
    noResultsEmpty: "Check back when the next window opens",
    cons: { balance: "Balance after", wages: "Wages a week", runway: "Cash lasts" },
    wageBillTo: (now: string, after: string) => `${now} to ${after}`,
    runwayValue: (weeks: number | null) => (weeks === null ? "Stays in the black" : weeks === 1 ? "1 week" : `${weeks} weeks`),
    fee: "Transfer fee",
    signingBonus: "Signing bonus",
    freeAgentTag: "Free agent",
    ask: "Asking terms",
    whyPrice: "Why this price",
    // The wage effects keep their unit: per split (the weekly wage line rounds them).
    whyPriceWages: "Wage effects · per split",
    perSplit: (s: string) => `${s} / split`,
    oneOff: (s: string) => `${s} one-off`,
    factor: {
      overall: "Rating",
      age: "Age",
      potential: "Upside",
      repPremium: "Star premium",
      length: "Contract length",
      contract: "Under contract",
    },
    seasons: (n: number) => (n === 1 ? "1 season" : `${n} seasons`),
    starter: "Starter",
    sub: "Sub",
    signCta: "Sign",
    signed: (name: string) => `${name} signs for the org`,
    rejected: (name: string) => `${name} declined the terms`,
    affordable: "Affordable now",
    incomingBid: "Incoming offer",
    bidFrom: (org: string) => `${org} bid`,
    accept: "Accept",
    decline: "Decline",
    blockbuster: "Blockbuster",
    // rc.33 (UX-07): the Blockbuster explained in one sentence, on a Blockbuster bid only
    // (its refusal cost included — CAREER_SALARY.blockbusterRefusalRenewalMult).
    blockbusterWhat: (org: string, mult: string, pct: number) =>
      `${org} bid ${Math.round((Number(mult) - 1) * 100)}% above his value: refuse and he stays, but his next renewal asks ${pct}% more`,
    consequences: "After this deal",
    balanceAfter: (s: string) => `Balance after: ${s}`,
    // rc.32 (M4, provisional): the runway a signing leaves.
    runwayAfter: (weeks: number | null) =>
      weeks === null
        ? "Cash stays in the black after this deal"
        : `Cash lasts ${weeks === 1 ? "1 week" : `${weeks} weeks`} after this deal`,
    // rc.37 F2 (package 3): the emergency sale — the offer's badge, what it is, and what the sale leaves.
    emergencyBadge: "Emergency offer",
    emergencyWhat: (days: number) =>
      `The books are in the red, so this buyer offers below market value. It stands ${days} days or until the window closes`,
    // rc.37 F2 (Miguel, 05/11): the market-value tag on emergency offers and Blockbuster bids.
    belowValue: (pct: number | null) => (pct === null ? "Below market value" : `Below market value · ${pct}%`),
    aboveValue: (pct: number | null) => (pct === null ? "Above market value" : `Above market value · ${pct}%`),
    // rc9 TRAIN-MARKET: what accepting a bid books, as rows (SaleConsequences).
    sale: {
      leavesFor: "Leaves for",
      squadAfter: "Squad after",
      players: (n: number) => (n === 1 ? "1 player" : `${n} players`),
      lands: "Lands after the bank's share",
      loanShare: "Goes to the emergency loan",
    },
    saleShortSeat: "An empty starting seat: a free agent can fill it any day from the Market",
    // ECO-03 (R47): the slot is set after the signing and never prices it.
    slotStarter: "Takes an open seat in the starting three",
    slotReserve: "Joins as sub. Promote him any time on Squad, same contract",
    // rc.33 (UX-07): a full squad only warns and points to Squad; the signing waits for a free seat.
    squadFullWarn: (cap: number) =>
      `Your squad is full (${cap} of ${cap}). Release or sell a player on the Squad screen, then sign him.`,
    toSquad: "Go to Squad",
    // DEV-02 (R48): a signing whose current season must be his last.
    finalSeasonDeal: "Final season: he retires when this season ends, a 1-season deal only.",
    payrollWeek: (now: string, after: string) => `Wage bill: ${now} → ${after} / week`,
    coachEffects: "What this coach does",
    // rc.34 (DEV-03 T4): his effect lands through the period's package — no package = the base, coach or not.
    coachTraining: (pct: number) => `+${pct}% training growth`,
    coachRating: (n: number) => `+${n} team rating in every series`,
    coachNoneEffects: () => "No coach: training runs at half strength",
    // rc.34 (DEV-03 T4): the hire card.
    coachQuality: (q: number) => `Quality ${q}`,
    coachBestCard: (card: number) => `Best card as a player: ${card}`,
    coachCompare: "Compare",
    // v0.2 — coach market + browsing tools
    coaches: "Coaches",
    coachRealTag: "Former pro",
    coachProTag: "Pro coach",
    coachGenTag: "Coach",
    coachBonus: (stat: string) => `Boosts ${stat}`,
    hireCoach: "Hire",
    currentCoach: "Current coach",
    replaceWarning: "Replacing a coach pays one split of severance.",
    searchPlaceholder: "Search players…",
    sortBy: "Sort",
    sortOvr: "Overall",
    sortAge: "Age",
    sortPrice: "Price",
    sortPot: "Potential",
    sortAsc: "Low → high",
    sortDesc: "High → low",
    filterRegion: "Region",
    allRegions: "All regions",
    // rc.33 (UX-07): only the players the org's reputation can sign (the rule a signing checks).
    filterAvailable: "Available",
    filterSignableCount: (n: number) => `${n} ${n === 1 ? "player" : "players"} within reach`,
    /** rc.35 (front C): an org signed him in this window. */
    justSignedTag: "Just signed",
    viewSheet: "View sheet",
    noResults: "No players match the filters",
    dealsEmpty: "No offers on the table. Bids for your players arrive during transfer windows",
    // v0.3 rep-gated signings (visible lock)
    lockedAtRep: (rep: number) => `Signs at ${rep} reputation`,
    lockedHint: "Needs more reputation",
    coachLockedAt: (rep: number) => `Coach hiring unlocks at ${rep} reputation`,
    exProLockedAt: (rep: number) => `Ex-pro coaches unlock at ${rep} reputation`,
    // rc.33 (ECO-10 + ECO-11): the contract talk — two levers, the zone shown, one answer.
    negotiation: {
      title: "Contract talk",
      // rc.35 (front N): the visual talk — a third lever and the odds.
      bonus: "Signing bonus",
      bonusAsk: (amount: string) => `Asks ${amount}`,
      bonusDown: "Lower the signing bonus",
      bonusUp: "Raise the signing bonus",
      shareAskNone: "Asks none",
      odds: "Chance he signs",
      oddsSure: "Sure",
      perWeek: "/ week",
      fullAsk: "Pay his ask",
      wage: "Weekly wage",
      share: "Prize share",
      shareAsk: (pct: number) => `He asks ${pct}%`,
      // rc.33 review: each stepper names its own lever for screen readers.
      wageDown: "Lower the weekly wage",
      wageUp: "Raise the weekly wage",
      shareDown: "Lower his prize share",
      shareUp: "Raise his prize share",
      // rc.34 (front I): why a lever stops, under the button it closes (contract.TalkLimits).
      why: {
        floor: "His floor",
        minimum: "League minimum",
        ask: "His full ask",
        shareLeast: "The least he takes",
        shareMost: "The most he takes",
        shareMinimum: "Wage at the minimum",
        noShare: "No share",
        // rc.36 (front S2): the bonus's own ends.
        noBonus: "No bonus",
        bonusMost: "The most on offer",
      },
      // rc.36 (front S2, Miguel on rc.35): three groups — your offer, his position, send — and his answer only once sent.
      groupOffer: "Your offer",
      groupPosition: "His view",
      length: "Length",
      worthTitle: "How he sees your offer",
      sureFrom: (wage: string) => `Signs for sure from ${wage}`,
      askMark: (wage: string) => `His ask ${wage}`,
      effectsTitle: "What moves his answer",
      effectShare: (pts: number) => `Share ${pts > 0 ? "+" : "−"}${Math.abs(pts)} pt${Math.abs(pts) === 1 ? "" : "s"}`,
      effectBonus: (delta: string) => `Bonus ${delta}`,
      effectLength: (seasons: number) => `${seasons}-season deal`,
      effectRefusals: (n: number) => (n === 1 ? "1 offer refused" : `${n} offers refused`),
      effectWeekly: (amount: string) => `${amount} / wk`,
      send: "Send offer",
      sendHint: "He answers when you send it. A refusal raises what he needs",
      refused: (wage: string) => `He turned down ${wage} / week`,
      nowWants: (wage: string) => `He now signs for sure from ${wage} / week`,
      meetPrice: "Meet his price",
    },
    errors: {
      bootcampEventActive: "Finish the active event before booking a bootcamp. Its team is already locked.",
      windowClosed: "The transfer window is closed.",
      alreadySigned: "Already on the squad.",
      squadFull: "Squad is full: release or sell first.",
      unavailable: "Player unavailable.",
      funds: "Not enough money for this deal.",
      // rc.36 (front S2, rc.35-(d)): a broke short squad's waiver covers the empty seat at the bonus he asks.
      fundsSeatBonus: "Short of money, the empty seat is covered only at the signing bonus he asks: lower the bonus.",
      loanActive: "No fee transfers while the emergency loan is owed.",
      bankActive: "One bank loan at a time: clear the current one first.",
      bankBacker: "The bank opens no other loan while the emergency loan is owed: repay it first.",
      bankNegative: "Your balance is too low for a bank loan. Only the emergency loan is available.",
      bankAmount: "Enter a valid amount.",
      bankLimit: "That is above what the bank offers at your reputation.",
      unknown: "That deal is no longer available.",
      locked: "Locked for now.",
      maxed: "Already at the maximum.",
      used: "Already used.",
      restDay: "Not on a rest day.",
      /** RTW-05 (rc.33 review): a scrim with fewer than three players. */
      squadShort: "No scrims with fewer than three players: sign a third first.",
      blocked: "Not right now.",
      none: "Nothing to do.",
      invalid: "Invalid selection.",
      contractedRep: "Signing contracted players unlocks at reputation 20.",
      repGate: "The org's reputation is too low for a player of this level.",
      /** rc.35 (front C): an org signed him in this window. */
      justSigned: "He just signed elsewhere in this window: try again in the next one.",
      /** rc.35: an ex-pro coach before his ladder rung. */
      exProGate: "Ex-pro and pro coaches need more reputation: the progression ladder shows when.",
      // rc.33 (ECO-11): an offer under his floor — the sheet shows his counter.
      negotiationCounter: "That is under his floor: take his counter or raise the offer.",
      sameDay: "Already scrimmed this team today.",
      /** rc.30: signing, releasing or selling during an event in progress. */
      rosterLocked: "Roster moves wait until the event ends.",
      /** DEV-02 (R48): the minimum competitive age. */
      tooYoung: "Too young to compete: players sign from age 13.",
      /** rc.32 (M4): the lock on commitments that shorten the runway (off since rc.34 — CAREER_LOAN.lockCommitments). */
      loanRunway: "Locked while the emergency loan is owed. Repay it or free some wages first.",
      /** R135 (ECO-06): the transfer list and player-for-player trades. */
      listDisabled: "The transfer list is not available.",
      listFirstWindow: "The first window is closed to sales: no listings and no trades yet.",
      listWindowClosing: "The window closes today. It is too late to list a player or propose a trade.",
      listFull: "The transfer list is full. Withdraw a player first.",
      listOffered: "An offer for him is on the table. Answer it first.",
      resaleLocked: "A player you signed cannot be listed or traded in his signing window or the next one.",
      tradeDisabled: "Trades are not available.",
      tradeFreeAgent: "He is no longer under contract with an org.",
      tradeRegion: "Trades stay inside a region. Your player must be from the same region as his org.",
      tradePending: "One trade proposal at a time. Wait for the answer or withdraw it.",
      buyBack: "He left your club under a season ago. He will not sign for you again yet.",
      tradeGone: "One of the two players is no longer available.",
    },
    /** R135 (ECO-06): the transfer list, on the Market's deals tab and the Squad screen. */
    transferList: {
      title: "Transfer list",
      empty: "Set an asking fee. An org from his region answers in a few days. Nobody leaves until you accept",
      listPlayer: "List a player",
      listForSale: "List for sale",
      listedTag: "Listed",
      changePrice: "Change price",
      withdraw: "Withdraw",
      waiting: (date: string) => `Answer expected by ${date}`,
      offered: "Offer on the table, see above",
      noBuyer: "No org in his region is buying right now",
      tooDear: "The asking fee was too high",
      offerTag: "Answer to your listing",
      counterLine: (ask: string) => `Counter-offer: you asked ${ask}`,
      sheetTitle: "List a player",
      repriceTitle: "Change the asking fee",
      pickTitle: "Choose a player",
      value: "Market value",
      askLabel: "Asking fee",
      askPct: (pct: number) => `${pct}% of his market value`,
      guidance: (minDays: number, maxDays: number) =>
        `A fair ask is met in full. A high ask may get a lower counter or nothing. Answer in ${minDays} to ${maxDays} days`,
      confirm: "List",
      confirmReprice: "Update price",
      shortTenure: (pct: number) => `He arrived under a season ago: clubs pay about ${pct}% of his value for now`,
    },
    /** R135 (ECO-06): player-for-player trades. */
    trade: {
      title: "Trades",
      empty: "To propose a trade, open an offer for a player under contract. Trades only run in a transfer window",
      proposeCta: "Propose a trade",
      proposeHint: "Offer one of your players for him instead of paying the fee",
      row: (give: string, take: string, org: string) => `${give} for ${take} (${org})`,
      cashLine: (money: string) => `plus ${money} in cash`,
      waiting: (date: string) => `Answer expected by ${date}`,
      agreed: "Agreed, waiting for your yes or no",
      countered: (money: string) => `They ask for ${money} in cash`,
      nowTitle: "Trade offer",
      withdraw: "Withdraw",
      confirmTitle: "Confirm the trade",
      leaves: "Leaves",
      arrives: "Arrives",
      cash: "Cash you pay",
      noCash: "No cash",
      wageLine: (wage: string, share: string) => `${wage} · ${share}`,
      lengthLine: (n: number) => (n === 1 ? "1 season" : `${n} seasons`),
      irreversible: "This cannot be undone",
      sheetTitle: (name: string) => `Trade for ${name}`,
      target: "He arrives",
      pickGive: "Choose who goes to his org",
      length: "Contract length",
      cashLabel: "Cash added",
      cashHint: "Optional, covers a gap in value",
      summary: "His deal",
      wage: "Wage",
      share: "Prize share",
      outlook: {
        likely: "Likely to accept",
        close: "Close: they may ask for cash",
        unlikely: "Unlikely at this price",
        noFit: "They will not weaken their lineup that much",
      },
      rules: (minDays: number, maxDays: number) =>
        `The org never pays a difference: any gap is yours to cover in cash. It answers in ${minDays} to ${maxDays} days`,
      send: "Send proposal",
    },
  },

  finances: {
    title: "Finances",
    balance: "Balance",
    net: "Net / week",
    projected: "Projected after Monday",
    weeklyStatement: "Weekly statement",
    runway: (weeks: number) => (weeks === 1 ? "Runway: 1 week at this burn" : `Runway: ${weeks} weeks at this burn`),
    runwayOk: "The books run in the black",
    nextPayday: (s: string) => `Next payday ${s}`,
    // rc.33 (UX-07): the balance chart's expanded view — the Mondays the save recorded.
    chartOpen: "Open the balance chart",
    chartTitle: "Balance history",
    chartRange: (n: number, from: string, to: string) =>
      n === 1 ? `One balance recorded: ${from}.` : `${n} balances recorded, ${from} to ${to}.`,
    chartEmpty: "The chart fills in from Monday to Monday: come back after the next payday.",
    chartLegendBalance: "Balance, including current cash",
    chartLegendFloor: "The floor (a Monday below it is a breach)",
    chartLegendSeason: "Season start",
    chartHigh: (s: string) => `High ${s}`,
    chartLow: (s: string) => `Low ${s}`,
    chartFloor: (s: string) => `Floor ${s}`,
    chartColSeason: "Season",
    chartColLow: "Low",
    chartColHigh: "High",
    chartColLast: "Latest",
    chartSummary: (n: number, first: string, last: string, low: string, high: string) =>
      `Balance across ${n} records: from ${first} to ${last}, low ${low}, high ${high}.`,
    chartClose: "Close",
    line: {
      sponsorBase: "Sponsor base",
      foundingPartner: "Founding partner",
      rescuePartner: "Investor",
      payroll: "Squad wages",
      coach: "Coach",
      psychologist: "Sports psychologist",
      staff: "Support staff",
      upkeep: "Facility upkeep",
      bankPayment: "Bank instalment",
      // rc.34 (ECO-04): a missed goal's fine, in Monday instalments.
      sponsorFine: "Sponsor fine",
    },
    loans: "Loans & debt",
    // rc.34: one bank, two loans — the voluntary one and the emergency one.
    loansHint: "Two loans: a voluntary one whenever you want, and an emergency one if the books break the floor.",
    // The next breach of the floor ends the career — no emergency loan to fall back on.
    loansHintEnd: "Only the voluntary loan is left. Breaking the floor again ends the career.",
    bankTitle: "Bank loan",
    bankHint: (weeks: number, pct: number) =>
      `Credit sized by your reputation: ${weeks} weekly instalments, ${pct}% interest.`,
    bankHintEnd: (weeks: number, pct: number) =>
      `Credit sized by your reputation: ${weeks} weekly instalments, ${pct}% interest. No emergency loan is left: breaking the floor ends the career.`,
    bankAvailable: (s: string) => `Available now: up to ${s}`,
    bankTerms: (weekly: string, weeks: number, total: string) =>
      `${weekly} / week for ${weeks} weeks · ${total} total`,
    bankRequest: "Request loan",
    bankAmount: "Principal",
    bankRemaining: (s: string) => `Bank: ${s} to repay`,
    bankWeekly: (s: string) => `${s} / week instalment`,
    bankPayEarly: "Pay the bank early",
    bankBlockedActive: "One bank loan at a time: clear this one first.",
    bankLockedRep: "The bank opens its doors once the org has a little reputation.",
    // ECO-02 (R46): the bank's schedule, as the Monday payroll books it.
    bankNext: (amount: string, date: string) => `Next instalment ${amount} on ${date}`,
    bankLeft: (n: number) => (n === 1 ? "last instalment" : `${n} instalments left`),
    // ECO-02 (R46): a pay-down that leaves the balance below zero warns first. rc.34: the bank's loan.
    payRiskBacker: (floor: string) =>
      `This leaves the books in the red. Below ${floor} on a Monday, the emergency loan steps in, with a deadline.`,
    payRiskEnd: (floor: string) =>
      `This leaves the books in the red. Below ${floor} on a Monday, the career ends.`,
    // What the next breach does on these books (the flow's nextBreachParamsOf).
    payRiskNext: (floor: string, p: Record<string, string | number>) =>
      `This leaves the books in the red. Below ${floor} on a Monday is a breach. ${nextBreachEn(p)}`,
    // The amount steppers' accessible names (pay-downs and the bank request).
    amountDown: "Lower the amount",
    amountUp: "Raise the amount",
    income: "In",
    expenses: "Out",
    ledger: "Movements",
    payday: "Payday",
    ledgerKind: {
      prize: "Prize money",
      sponsorBase: "Sponsor payment",
      sponsorBonus: "Sponsor bonus",
      sponsorSigning: "Sponsor signing bonus",
      salary: "Player wages",
      coachSalary: "Coach wages",
      severance: "Severance",
      transferIn: "Transfer fee received",
      transferOut: "Transfer fee paid",
      signingBonus: "Signing bonus",
      releaseFee: "Release fee",
      standInFee: "Emergency stand-in",
      facility: "Facility upgrade",
      upkeep: "Facility upkeep",
      buff: "Staff & boosts",
      loanGrant: "Emergency loan",
      loanGarnish: "Emergency loan repayment",
      loanPayment: "Loan repayment",
      foundingPartner: "Founding partner",
      rescuePartner: "Investor",
      playerShare: "Players' prize share",
      // rc.36 (POL-04): the income is gone; kept so an rc.35 save's books still read.
      fanbase: "Merch & streaming revenue",
      payroll: "Squad wages",
      bankLoan: "Bank loan received",
      bankPayment: "Bank instalment",
      insert: "Side event",
      // rc.34 (ECO-04): a Bold deal's milestone payment and a missed goal's fine instalment.
      sponsorMilestone: "Sponsor milestone",
      sponsorFine: "Sponsor fine",
      // v2.2 board front: the board's seasonal budget and an objective's bonus.
      boardGrant: "Board budget",
      boardBonus: "Board bonus",
      mediaDay: "Media day", // v2.3 MEDIA
    },
    sponsors: "Sponsors",
    sponsorTier: (t: number) => `Tier ${t}`,
    sponsorObjective: "Objective",
    objective: {
      enterEvents: (n: number) => `Enter ${n}+ events this split (officials count)`,
      regionalTop8: "Reach a regional top-8 this split",
      majorQualify: "Qualify for the Major",
      majorTop4: "Reach the Major top-4",
    },
    onTrack: "On track",
    objectiveHit: "Delivered",
    objectiveMissed: "Missed this split",
    patience: (n: number, max: number) => `Sponsor confidence: ${max - n} of ${max}`,
    patienceWarn: "Another miss and next season's offer drops a tier.",
    offerTitle: "Sponsorship offers",
    perWeekBase: (s: string) => `${s} / week guaranteed`,
    bonusFor: (s: string) => `+${s} per objective hit`,
    // rc.34 (ECO-04, SPONSOR-CONTRACT S5): the deals — the comparison card's five rows and the desk.
    deal: {
      profile: { steady: "Steady", balanced: "Balanced", bold: "Bold" } as Record<string, string>,
      word: SPONSOR_WORD_EN,
      rowLength: "Length",
      rowGoal: "Goal",
      // rc.35 (front S): the visual comparison — one band per row, icons first.
      rowWeekly: "Weekly pay",
      rowUpfront: "Up front",
      rowBonus: "Bonus per goal",
      rowFine: "Fine if missed",
      upfrontSigning: "on signing",
      upfrontMilestone: "at 1st goal",
      upToWeekly: (s: string) => `up to ${s} / week`,
      contractTotal: (s: string, n: number) => `${s} total · ${n === 3 ? "1 season" : `${n} splits`}`,
      upTo: (s: string) => `up to ${s}`,
      noFine: "None",
      lengthShort: (splits: number) =>
        splits === 1 ? "1 split" : splits === 3 ? "1 season" : splits === 6 ? "2 seasons" : `${splits} splits`,
      difficultyMeter: (word: string) => `Goal difficulty: ${word}`,
      profileTag: { steady: "Safest", balanced: "Middle ground", bold: "Biggest pay" } as Record<string, string>,
      boldLocked: "Bold deals open as your reputation grows.",
      globalSponsor: "Global",
      nextPay: "Next payment",
      noNextPay: "Last one paid",
      finesNone: "No fines owed",
      finesShort: (mondays: number) => `over ${mondays} Mondays`,
      seasonFineCap: (s: string) => `Fines: ${s} a season at most`,
      dealRun: (paid: number, total: number) => `${paid} of ${total} Mondays paid`,
      total: (sure: string, upTo: string) => `${sure} sure · up to ${upTo}`,
      length: (splits: number, date: string) =>
        `${splits === 1 ? "One split" : splits === 3 ? "One season" : splits === 6 ? "Two seasons" : `${splits} splits`} · ends ${date}`,
      goal: sponsorGoalEn,
      goalBy: (date: string) => `by ${date}`,
      laterGoals: "Then a new goal every split, at the same difficulty",
      sign: "Sign",
      // rc.36 (front S2): CAREER_SPONSOR.deadlineRule — "hold" (the deadline day waits for a pick) or "signSafest".
      decideBy: (date: string) => `Pick one by ${date}: that day the clock waits for your pick.`,
      decideBySafest: (date: string) => `Pick one by ${date}: after that the safest deal is signed for you.`,
      compareHint:
        "All three are worth about the same on average. They differ in guaranteed money, length and goals.",
      // rc.34: a Tier 3 / 4 brand pays a side below its level less (sponsorDeals.levelValueShareOf).
      // rc9 ORG-UI (#273): said without the brand's tier number.
      levelScaled: (tier: number, pct: number) =>
        tier >= 4
          ? `These brands pay ${pct}% today. Full pay needs a squad that contends for Worlds.`
          : tier === 3
            ? `These brands pay ${pct}% today. Full pay needs a squad at Major level.`
            : `These brands pay ${pct}% today. Full pay needs a regional top-8 squad.`,
      handover: (first: number, second: number) =>
        `Your founding partner steps back once this deal starts: ${first}%, then ${second}% of its pay, one split each.`,
      // rc.34 review (S6): before season index 2 signing does not start the handover — the partner pays in full through its term.
      handoverLater: (season: string, first: number, second: number) =>
        `Your founding partner pays in full through the end of ${season}, whatever you sign; then it steps back: ${first}%, then ${second}% of its pay, one split each.`,
      handoverNet: (delta: string, date: string) => `Net weekly change at the handover (${date}): ${delta}`,
      activeTitle: "Current deal",
      // rc9 ORG-UI: the comparison's rows and the running deal's sections.
      rowMost: "Most it pays",
      signedForYou: "Signed for you on the deadline",
      dealPays: "Pays a week",
      dealEnds: "Ends",
      dealGoing: "How it is going",
      endsOn: (date: string) => `Ends ${date}`,
      milestonePending: (s: string) => `${s} the day you reach a first goal`,
      milestonePaid: (s: string) => `Milestone of ${s} paid`,
      thisGoal: "This split's goal",
      nextGoal: (date: string) => `The next goal is set on ${date}`,
      progress: (done: number, target: number) => `${done} of ${target}`,
      goalReached: "Reached",
      goalMissed: "Missed",
      goalOpen: "Open",
      record: (hits: number, misses: number) => `Goals so far: ${hits} reached, ${misses} missed`,
      finesOwed: (s: string, mondays: number) => `Fines still to pay: ${s} over the next ${mondays} Mondays`,
      fineFloorNote: "paid in weekly instalments",
      otherIncome: "Other income",
      otherIncomeLine: (taken: string, cap: string, n: number, max: number) =>
        `${taken} of ${cap} this season · ${n} of ${max} this split`,
      otherIncomeHint: (pct: number, max: number) =>
        `Showmatches and partner days pay on top: up to ${pct}% of the season's earnings, ${max} a split.`,
    },
    // rc.34 (Miguel, 31/10): the bank's emergency loan (rc.31–rc.33: the Emergency Backer).
    backer: "Emergency loan",
    backerRemaining: (s: string) => `Emergency loan: ${s} to repay`,
    backerLine: (pct: number) => `Repaid from prize money (${pct}%) and sales, or pay it down below`,
    // v0.3 debt pay-down
    backerSaleLine: (pct: number) => `Player sales repay ${pct}% automatically`,
    payDebt: "Repay the loan",
    payDebtAll: (s: string) => `Pay it all (${s})`,
    payDebtAmount: "Amount",
    payDebtHint: "Repaid in full before the deadline, the loan closes and the deadline is lifted.",
    debtCleared: "Loan repaid: the deadline is lifted.",
    backerWarning: "This deal likely breaks the floor: the bank's emergency loan would step in, with a deadline.",
    // rc.33 review (ECO-08): the same risk where the next breach ends the career.
    endsCareerWarning: "This deal likely ends the career: the next breach of the floor is the last.",
    // rc.37 F2: the bank's ordinary loan as Finances suggests it while the books burn (careerFlow.creditOfferOf).
    creditSuggest: (net: string, total: string, weekly: string, weeks: number, covers: number) =>
      `The bank suggests ${net} now, ${weekly} every Monday for ${weeks} weeks (${total} in all). It covers about ${covers} Mondays at this pace.`,
    // rc.37 F2 (package 4): the season review's consolidated view of next season's books (careerFlow.seasonOutlookOf).
    outlook: {
      title: "Next season's books",
      payroll: "Wage bill",
      payrollLine: (now: string, next: string) => `${now} a week now → ${next} a week next season (after the contract review)`,
      leaving: (names: string) => `Leaving at the rollover, no new deal: ${names}`,
      debt: "Owed",
      debtNone: "Nothing owed.",
      debtEmergency: (s: string) => `Emergency loan: ${s}`,
      debtBank: (s: string, n: number) => `Bank loan: ${s} (${n === 1 ? "1 Monday instalment" : `${n} Monday instalments`} left)`,
      deadline: (date: string, weeks: number) => `The emergency loan is due ${date}: ${weeks === 1 ? "1 week" : `${weeks} weeks`} from now.`,
      cash: "To the first regional",
      cashLine: (balance: string, week: number, mondays: number, net: string) =>
        `${balance} on the balance by week ${week}: ${mondays} Mondays at ${net} a week, no prize counted.`,
      sponsorEnds: "The sponsor deal ends this season: the projection drops its base until you sign a new one.",
      retirements: "Retirements",
      retireNone: "No one is near the end of his career.",
      retireNow: (name: string) => `${name} retires at the rollover (his final season was announced).`,
      retireLikely: (name: string) => `${name} will likely announce next season as his last.`,
      retirePossible: (name: string) => `${name} may announce next season as his last.`,
    },
    // rc.34: the rule when nothing is owed — the floor, the loan back to the rescue target, the term (null = none).
    backerIdle: (floor: string, rescueTo: string, term: number | null) =>
      `Not in use. If a Monday closes below ${floor}, the bank lends the balance back to ${rescueTo}${term !== null ? `, to be repaid within ${term} weeks` : ""}.`,
    // CAREER_LOAN.breachesToEnd ends this difficulty's careers at the first breach — no emergency loan.
    backerIdleNone: (floor: string) =>
      `No emergency loan on this difficulty: a Monday that closes below ${floor} ends the career.`,
    backerRescued: "The last emergency loan is repaid.",
    insolvencyWarning: "The books are failing: the next breach of the floor ends the career.",
    // rc.32 (M4): the line in weeks of wages.
    backerWeeksLine: (floorWeeks: number, rescueWeeks: number) =>
      `The floor sits ${floorWeeks} weeks of wages below zero. The emergency loan lifts the balance back to ${rescueWeeks} weeks above.`,
    // rc.34: the whole rule on this difficulty — the term, the investor, the top-ups, the deadline,
    // and CAREER_LOAN.breachesToEnd if it ends careers outright (null = it does not).
    loanRule: (p: { term: number | null; partnerPct: number; partnerWeeks: number; maxTopUps: number | null; endAt: number | null; maxLoans?: number | null }) => {
      if (p.endAt !== null && p.endAt <= 1) return "On this difficulty the first breach of the floor ends the career.";
      const partner = p.partnerPct > 0 ? ` (the first time, an investor adds ${p.partnerPct}% of the wage bill${partnerRunEn(p.partnerWeeks)})` : "";
      const term = p.term !== null ? ` Repay it within ${p.term} weeks: prizes and sales cover part, you pay the rest in Finances.` : "";
      const topUps = `If the floor breaks again before it is repaid, the bank adds to the loan${p.maxTopUps !== null ? ` (up to ${p.maxTopUps} times)` : ""} and the deadline stays.`;
      const end = p.term !== null ? ` On the deadline the bank collects; if the books cannot take it, the career ends.` : "";
      const count = p.endAt !== null ? ` The ${ordinalEn(p.endAt)} breach ends the career.` : "";
      // rc.34 review: the career-wide cap on new loans (CAREER_LOAN.emergency.maxLoans).
      const loans =
        p.maxLoans !== undefined && p.maxLoans !== null
          ? ` ${p.maxLoans === 1 ? "One emergency loan" : `${p.maxLoans} emergency loans`} at most in a career: after the last one, breaking the floor ends it.`
          : "";
      return `A breach opens the bank's emergency loan${partner}.${term} ${topUps}${end}${loans}${count}`;
    },
    // History count (rc.33's rule ended careers at a breach count; `end` null = no count does).
    breachCount: (n: number, end: number | null) =>
      end === null
        ? `Breaches so far: ${n}`
        : n + 1 >= end
          ? `Breaches so far: ${n}, the next one ends the career`
          : `Breaches so far: ${n}, the career ends at breach ${end}`,
    backerLock: "While it is owed: no transfer fees, no gear, nothing that shortens the runway.",
    // rc.34: nothing is locked while the loan is owed (CAREER_LOAN.lockCommitments false).
    loanNoLock: "Nothing is locked while you owe: signings, fees and gear stay open.",
    // rc.34: the loan's deadline and state, as Finances and HQ show it.
    loanDeadline: (date: string, weeks: number) =>
      weeks <= 0 ? `Due this Monday (${date})` : weeks === 1 ? `Due next Monday, ${date}` : `Due ${date}: ${weeks} weeks left`,
    loanDeadlineRule: deadlineRuleEn,
    // rc.34 review: the books projected to the deadline Monday (the weekly burn counted), the bank's own test.
    loanCovered: (covered: boolean): string =>
      covered ? "On this pace the books cover it on the day." : "On this pace the books will not cover it on the day.",
    loanLent: (s: string) => `Lent in all: ${s}`,
    loanTopUps: (n: number, max: number | null) =>
      max === null ? `Top-ups so far: ${n}` : n >= max ? `Top-ups: ${n} of ${max}, the next breach ends the career` : `Top-ups: ${n} of ${max}`,
    // rc.33 (ECO-07): the rescue partner card — rc.34: the investor that joins the first emergency loan.
    rescueTitle: "Investor",
    rescueTerms: (weeks: number) => `Came in with the first emergency loan · ${weeks} weeks of extra income`,
    rescueUntil: (date: string, left: number) =>
      left === 1 ? `Last payment ${date}.` : `${left} payments left: the last on ${date}.`,
    // rc.32 (M3, provisional): the founding partner card.
    foundingTitle: "Founding partner",
    foundingTerms: (pct: number) => `${pct}% of the founding wage bill · objective: enter events · no signing bonus`,
    foundingEnds: (through: string) => `Ends with your first sponsorship deal, not before the end of ${through}.`,
    foundingEnded: "Stepped back once the org signed its own sponsorship deal.",
    // rc.34 (S6): the handover — a share of its pay, one split per step.
    foundingTapering: (pct: number, last: boolean) =>
      last ? `Handing over: ${pct}% of its pay this split, its last.` : `Handing over: ${pct}% of its pay this split, less the next, then it ends.`,
    // rc.32 (M6, provisional): the players' share of podium prizes.
    // rc.33 (ECO-10): each contract carries its own share (Squad and the offer show it).
    playerShareRule:
      "Players keep a share of top-four prizes at regionals, Majors and Worlds. Each player's share is in Squad.",
    boosts: "Boosts & staff",
    psychologist: "Sports Psychologist",
    staff: {
      assistant: { title: "Assistant coach", desc: "Reserves earn 80% of the team's series experience instead of 60%." },
      analyst: { title: "Opponent analyst", desc: "+0.75 team rating in every playoff round." },
      physio: { title: "Physical trainer", desc: "Cuts the risk of a player missing an event from training wear by 25%." },
      brand: { title: "Brand manager", desc: "New sponsor offers are worth 15% more. Pays off from global sponsors up." },
    },
    psychologistDesc: (clutch: number, consistency: number) => `+${clutch} Clutch, +${consistency} Consistency while retained. Support for deciding games.`,
    bootcamp: "Bootcamp",
    bootcampUsed: "Bootcamp already run this split.",
    upkeepLabel: (s: string) => `Upkeep ${s} / week`,
    lockedAtRep: (rep: number) => `Unlocks at ${rep} Reputation`,
    activeLabel: "Active",
    ownedLabel: "Owned",
    retainedLabel: "Retained",
    hireLabel: "Retain",
    dropLabel: "End retainer",
    buy: "Purchase",
    // v0.2 gear & staff ladder
    gearLadder: "The org's toolbox",
    gear: {
      peripherals: "Pro peripherals",
      monitors: "240Hz monitors",
      pcs: "Tournament PCs",
      perfCenter: "Performance Center",
    },
    gearDesc: {
      peripherals: "Controllers, mice and keyboards the players actually asked for. +5% training.",
      monitors: "No more excuses about frames. +5% training.",
      pcs: "Scrim-server-grade rigs. +10% training and a real team-rating edge.",
      perfCenter: "The full building: analysts' room, gym, review theater. +15% training, elite-level edge.",
    },
    bootcampT1: "Bootcamp",
    bootcampT1Desc: "A week under one roof. Chemistry and competitive preparation for the active period.",
    bootcampT2: "Structured bootcamp",
    bootcampT2Desc: "Coaching staff, scrim schedule and VOD review. Stronger chemistry and competitive preparation for the active period.",
    sponsorPerks: "Sponsor perks",
    perkDiscount: (pct: number) => `${pct}% off gear purchases`,
    perkBootcamps: (n: number) => (n === 1 ? "1 free bootcamp / season" : `${n} free bootcamps / season`),
    perkNone: "No perks at this tier",
    freeBootcampLeft: (n: number) => `${n} sponsor-paid bootcamp${n === 1 ? "" : "s"} left this season`,
    // rc.34 (UX-01f, 5-A): the bootcamp lasts the split — its end on the ladder.
    bootcampUntil: (date: string) => `Active until ${date}`,
    // rc.34 (UX-01e): Finances' projection, the same figure as HQ's.
    projectionSplit: (date: string, balance: string) => `End of split (${date}), no prizes counted: ${balance}`,
  },

  // rc.34 (UX-01f, HQ-CONTRACT H6; UX-06a): the toolbox on HQ — buy with a confirm sheet.
  toolbox: {
    title: "Toolbox",
    open: "Full ladder in Finances",
    active: "Active",
    owned: "Owned",
    next: "To buy",
    none: "Nothing to buy yet: reputation opens the toolbox.",
    lockedRep: (rep: number) => `Reputation ${rep}`,
    after: (name: string) => `After ${name}`,
    used: "Used this split",
    superseded: "Replaced by the next tier",
    training: (pct: number) => `+${pct}% training`,
    buff: (n: number) => `+${n} buff level`,
    rating: (n: string) => `+${n} team rating`,
    chemistry: "a chemistry boost",
    stats: "+5 Clutch, +5 Consistency",
    permanent: "Permanent",
    until: (date: string) => `Until ${date}`,
    nextEvent: "The next official event",
    weekly: (amount: string) => `${amount} a week until dropped`,
    upkeep: (amount: string) => `upkeep ${amount} a week`,
    priceLabel: "Price",
    effectLabel: "Effect",
    durationLabel: "Duration",
    afterLabel: "After",
    afterLine: (balance: string, runway: string) => `Balance ${balance} · ${runway}`,
    free: "Free: a sponsor perk",
    discount: (pct: number) => `−${pct}% sponsor discount`,
    buy: "Buy",
    hire: "Hire",
    refusal: {
      locked: "Locked: reputation, or the ladder's previous rung first.",
      funds: "Not enough money above the floor.",
      loanActive: "Not while the emergency loan is open.",
      loanRunway: "Not while the emergency loan is owed: it would shorten the runway.",
      used: "Already used this split.",
      maxed: "The ladder is complete.",
      blocked: "The career has ended.",
      other: "It cannot be bought right now.",
    },
    // UX-06a: the centred unlock modal — once per novelty; unlocked is not bought.
    unlockTitle: "New in the toolbox",
    bootcampHint: "Bring the squad together for a short camp: build lasting chemistry and carry a temporary edge into competition.",
    available: "Upgrades available",
    unlockBody: (name: string) => `${name} is unlocked: ready to buy, not bought yet.`,
    unlockSee: "See it",
    unlockLater: "Later",
    newTag: "New",
    // rc.35: the visual unlock / buy modal.
    unlockKicker: "Unlocked",
    // rc.36: the announcement has no Buy — where the item waits.
    unlockNote: "Not bought yet: it waits in Progression, ready to buy.",
    benefits: "Benefits",
    close: "Close",
  },

  // rc.35 — the progression ladder (HQ card + Finances).
  ladder: {
    title: "Progression",
    rep: (n: number) => `Rep ${n}`,
    next: "Next unlock",
    progress: (rep: number, gate: number) => `${rep} / ${gate} rep`,
    top: "Ladder complete",
    seeMore: "See more",
    owned: "Owned",
    open: "Unlocked",
    locked: "Locked",
    gate: (n: number) => `Rep ${n}`,
    toBuy: "Ready to buy",
    running: "Running",
    finances: "Finances",
    rung: {
      peripherals: "Pro peripherals",
      coach: "Coach",
      monitors: "240Hz monitors",
      sponsors1: "Local sponsors",
      pcs: "Tournament PCs",
      exProCoach: "Ex-pro coaches",
      bootcamp1: "Bootcamp",
      sponsors2: "Challenger sponsors",
      bootcamp2: "Structured bootcamp",
      psychologist: "Psychologist",
      assistant: "Assistant coach",
      analyst: "Analyst",
      physio: "Physical trainer",
      brand: "Brand manager",
      sponsors3: "Global sponsors",
      perfCenter: "Performance centre",
      sponsors4: "Headline sponsors",
    },
    hint: {
      peripherals: "Faster training gains",
      coach: "Hire a generic coach",
      monitors: "Faster training gains",
      sponsors1: "Two safe offers a split",
      pcs: "Training and a team buff",
      exProCoach: "Retired pros on the shortlist",
      bootcamp1: "Chemistry and a rating edge",
      sponsors2: "Three offers, Bold deals, bigger pay",
      bootcamp2: "A bigger chemistry and rating edge",
      psychologist: "+5 Clutch, +5 Consistency",
      assistant: "Reserves learn more from events",
      analyst: "A rating edge in playoffs",
      physio: "Less wear risk before events",
      brand: "Sponsor offers worth more",
      sponsors3: "Global brands: higher pay, better perks",
      perfCenter: "The top training and team buff",
      sponsors4: "The brand on the jersey: the biggest deal",
    },
  },

  standings: {
    title: "Standings",
    majorLine: "Major line",
    worldsLine: "Worlds line",
    ptsShort: "pts",
    maxAvailable: (n: number) => `${n} pts still on the board`,
    regionLabel: "Region",
    worldsField: "Worlds field",
    fieldRevealPending: "Revealed when every region concludes",
  },

  // RTW-01 (R49): the two race tables — the Standings tabs and the HQ toggle.
  race: {
    majorTab: "Major table",
    worldsTab: "Worlds table",
    majorToggle: "Major",
    worldsToggle: "Worlds",
    majorScope: (split: number, slots: number) =>
      `Split ${split} · regional points · ${slots === 1 ? "the leader reaches" : `top ${slots} reach`} the Major`,
    worldsScope: (slots: number) =>
      `Season · regional + Major points · ${slots === 1 ? "the leader reaches" : `top ${slots} reach`} Worlds`,
    fixturesMajor: (n: number) =>
      n === 0 ? "Split complete" : n === 1 ? "1 regional left in the split" : `${n} regionals left in the split`,
    fixturesWorlds: (regionals: number, majors: number) => {
      const parts = [
        regionals ? `${regionals} regional${regionals === 1 ? "" : "s"}` : "",
        majors ? `${majors} Major${majors === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return parts.length ? `${parts.join(" + ")} left in the season` : "Season complete";
    },
    status: { clinched: "Slot secured", contention: "In the race", out: "Out of reach" },
    localTag: "Local",
    localLegend: "Local: an amateur side from the regional scene. It scores like any team and can earn a slot.",
    qualifiedTag: "Qualified",
    majorField: "Major field",
    majorFieldPending: "Announced on the Major week's Monday",
    open: "Full standings",
    toggleLabel: "Race table",
    fixturesLabel: "Still to play",
  },

  news: {
    title: "Inbox",
    unread: (n: number) => `${n} unread`,
    markAllRead: "Mark all read",
    filter: { all: "All", mine: "My org", region: "My region", world: "World", deals: "Deals" },
    wire: "THE WIRE",
    // rc.36 (UX-03, R87): the visual feed — a lead story, crests, the subject, the action.
    feed: {
      name: "Newsroom",
      lead: "Top story",
      archive: "From the archive",
      archiveNote: "Real RLCS history",
      subject: {
        result: "Result",
        transfer: "Transfer",
        beat: "The scene",
        org: "Your org",
        training: "Training",
        milestone: "Milestone",
        window: "Window",
        rep: "Reputation",
        flavor: "Around the scene",
      } as Record<string, string>,
      action: {
        market: "Market",
        standings: "Standings",
        squad: "Squad",
        finances: "Finances",
        training: "Training",
        club: "Club",
        calendar: "Calendar",
      } as Record<string, string>,
      moved: (player: string, org: string) => `${player} → ${org}`,
    },
    // rc.36 (UX-03): who presents the desk (CAREER_NEWS.brand) — the headlines are always the game's own.
    brand: {
      wire: { name: "The Wire", kicker: "THE WIRE", credit: "" },
      fiftyFifty: { name: "50/50", kicker: "50/50", credit: "Rocket League news, presented by 50/50" },
    } as Record<string, { name: string; kicker: string; credit: string }>,
    digest: (n: number) => `Around the league: ${n} more moves`,
    // Template keys — params: {player} {org} {from} {to} {fee} {event} {placement} {points} {name} {region} {n}
    tpl: {
      transfer: (p: Record<string, string | number>) => `${p.player} signs with ${p.to}`,
      transferFee: (p: Record<string, string | number>) => `${p.to} lands ${p.player} from ${p.from} (${p.fee})`,
      transferFa: (p: Record<string, string | number>) => `${p.player} finds a home at ${p.to}`,
      userSigned: (p: Record<string, string | number>) => `Official: ${p.player} joins ${p.org}`,
      userSold: (p: Record<string, string | number>) => `${p.player} departs ${p.org} for ${p.to}`,
      userTraded: (p: Record<string, string | number>) => `${p.club} swap ${p.give} for ${p.take} with ${p.org}`,
      listingLapsed: (p: Record<string, string | number>) =>
        Number(p.n) === 1 ? `Transfer list closes: ${p.players} stays` : `Transfer list closes: ${p.players} stay`,
      listingNoBuyer: (p: Record<string, string | number>) => `No takers for ${p.player} at ${p.ask}`,
      listingTooDear: (p: Record<string, string | number>) => `${p.player}: no offer at ${p.ask}`,
      listingOffer: (p: Record<string, string | number>) => `${p.org} offer ${p.fee} for ${p.player}`,
      listingCounter: (p: Record<string, string | number>) => `${p.org} counter at ${p.fee} for ${p.player}`,
      tradeLapsed: (p: Record<string, string | number>) => `Trade lapses: ${p.give} for ${p.take}`,
      tradeRefusedFit: (p: Record<string, string | number>) => `${p.org} refuse ${p.give} for ${p.take}`,
      tradeRefusedValue: (p: Record<string, string | number>) => `${p.org} refuse ${p.give} for ${p.take}`,
      tradeAgreed: (p: Record<string, string | number>) => `${p.org} agree to ${p.give} for ${p.take}`,
      tradeCountered: (p: Record<string, string | number>) => `${p.org} ask ${p.cash} on top for ${p.take}`,
      userReleased: (p: Record<string, string | number>) => `${p.org} releases ${p.player}`,
      result: (p: Record<string, string | number>) => `${p.org} take ${p.event}`,
      resultUser: (p: Record<string, string | number>) => `${p.org ?? "The team"} finishes ${p.placement} at ${p.event}`,
      // v2.0 (R40): a qualifier result reads qualified / eliminated, never a placement.
      resultUserQualified: (p: Record<string, string | number>) => `${p.event}: qualified for Sunday`,
      resultUserEliminated: (p: Record<string, string | number>) => `${p.event}: out in the Swiss`,
      qualifiedRegional: (p: Record<string, string | number>) => `Through the qualifier: ${p.event} is on`,
      missedRegional: (p: Record<string, string | number>) => `Out at the qualifier: ${p.event} goes on without you`,
      qualifiedMajor: () => `Qualified for the Major`,
      missedMajor: () => `Missed the Major this split`,
      qualifiedWorlds: () => `Qualified for Worlds`,
      missedWorlds: () => `Out of the Worlds race this season`,
      stability: (p: Record<string, string | number>) => `Roster shake-up costs ${p.points} Season Points`,
      contractExpiring: (p: Record<string, string | number>) => `${p.player}'s contract is in its final season`,
      contractReminder: (p: Record<string, string | number>) => `Contract clock: ${p.players}, ${p.weeks} weeks left`,
      // rc.34 (Miguel, 31/10): a short squad sat a regional out.
      regionalSkipped: (p: Record<string, string | number>) => `${p.org} sit out ${p.event}`,
      eventMissedNoReserve: (p: Record<string, string | number>) => `${p.org} miss ${p.event}: no reserve`,
      playerLeft: (p: Record<string, string | number>) => `${p.player} walks as a free agent`,
      retirementAnnounce: (p: Record<string, string | number>) => `${p.player} announces his final season`,
      retired: (p: Record<string, string | number>) => `${p.player} retires`,
      // DEV-02 (R48): the user's own retiree — coaching or out of the game.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} retires and joins the coach pool`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} retires and leaves the scene`,
      insertResolved: (p: Record<string, string | number>) => `Decision made: ${p.insert}`,
      orgEnters: (p: Record<string, string | number>) => `${p.org} enters the ${p.region} scene`,
      // rc.33 (RTW-03): an org whose history is over gives its seat to an entrant.
      orgLeaves: (p: Record<string, string | number>) => `${p.org} leaves the ${p.region} scene`,
      // v2.1 M1 (R139): the world renews itself.
      orgNewcomer: (p: Record<string, string | number>) => `${p.org} takes ${p.old}'s seat in ${p.region}`,
      stackSigned: (p: Record<string, string | number>) => `Local stack ${p.stack} signs with ${p.org}`,
      prospectScouted: (p: Record<string, string | number>) => `${p.org} signs prospect ${p.player} for its bench`,
      // v2.1 M2.1 (R142): the world grows.
      prodigyRises: (p: Record<string, string | number>) => `${p.player} (${p.region}) breaks out as a prodigy`,
      // v2.2 ENDLESS
      endlessProject: (p: Record<string, string | number>) => `${p.org} build around ${listEn(p)}`,
      endlessProjectGrows: (p: Record<string, string | number>) => `${p.org} keep building, season ${p.season} of the project`,
      endlessGeneration: (p: Record<string, string | number>) => `A stronger generation: ${p.player} (${p.region}) leads ${p.n} new prodigies`,
      endlessHosts: (p: Record<string, string | number>) => `${p.season}: the Majors go to ${hostEn(p.h1)}, ${hostEn(p.h2)} and ${hostEn(p.h3)}`,
      rookieClass: (p: Record<string, string | number>) => `${p.region} rookie class arrives: ${p.name} headlines`,
      decline: (p: Record<string, string | number>) => `${p.player}, ${p.n}, has lost half a step`,
      breakout: (p: Record<string, string | number>) => `${p.player} is outgrowing everyone's projections`,
      trainingReport: (p: Record<string, string | number>) => `Training report: squad ${p.n} OVR`,
      // rc.34 (DEV-03 T7): a period's summary is filed — one feed line, never a toast.
      trainingPeriod: (p: Record<string, string | number>) =>
        `Cycle ${p.n} report (${({ development: "Evolve", preparation: "Gel", recovery: "Recover" } as Record<string, string>)[String(p.objective)] ?? "Base growth"}): squad +${p.avg} avg, ${p.player} +${p.gain}`,
      // rc.36 (front T2): a signing's unknown phase, read after a few training days.
      phaseRead: (p: Record<string, string | number>) =>
        `After ${p.n} training days the staff reads ${p.player}: ${({ growing: "still developing", peak: "at his peak", declining: "past his peak" } as Record<string, string>)[String(p.phase)] ?? "phase unclear"}`,
      // rc.34 (T3): one line a week for the package's scrims (practice only).
      scrimWeek: (p: Record<string, string | number>) =>
        `Scrim week (${({ easy: "easy", even: "even", hard: "hard" } as Record<string, string>)[String(p.level)] ?? String(p.level)}): ${p.won}–${p.lost}`,
      windowOpen: () => `Transfer window opens`,
      windowClose: () => `Transfer window closed`,
      windowClosing: (p: Record<string, string | number>) => `Transfer window closes in ${p.n} days`, // v2.3 SKIP
      windowReport: (p: Record<string, string | number>) => `Window report: ${p.n} moves across the regions`,
      debtCleared: () => `Emergency loan repaid`,
      sponsorSigned: (p: Record<string, string | number>) => `${p.org} announces ${p.name} partnership`,
      // rc.34 (ECO-04): a deal that ran its course (it ends on a split boundary).
      sponsorEnded: (p: Record<string, string | number>) => `${p.name}: the sponsorship deal is complete`,
      repUp: (p: Record<string, string | number>) => `${p.org}'s reputation rises`,
      repDown: (p: Record<string, string | number>) => `${p.org}'s reputation drops`,
      starUp: (p: Record<string, string | number>) => `${p.org} reaches ${p.n}-star status`,
      unlock: (p: Record<string, string | number>) => `Unlocked: ${p.name}`,
      // rc.30 (A4): the one-time cleanup of a career started before rc.29.
      registryRepair: (p: Record<string, string | number>) =>
        `League registry updated: ${p.n} roster and gamertag fixes`,
      unavailable: (p: Record<string, string | number>) => `${p.player} unavailable for ${p.event}`,
      standIn: (p: Record<string, string | number>) => `Emergency stand-in suits up for ${p.event}`,
      bankLoan: (p: Record<string, string | number>) => `The org takes a ${p.amount} bank loan`,
      // rc.37 F2 (package 3): an emergency-sale offer lands.
      emergencyBid: (p: Record<string, string | number>) => `${p.org} table an emergency offer for ${p.player}`,
      bankCleared: () => `The org clears its bank loan`,
      cashWarning: (p: Record<string, string | number>) => `Cash lasts about ${p.weeks} more weeks`,
      // History (rc.31–rc.33); rc.34 files emergencyLoan / emergencyTopUp / loanCollected.
      backerIn: () => `An emergency backer stabilizes the books`,
      emergencyLoan: () => `The bank steps in with an emergency loan`,
      emergencyTopUp: () => `The bank adds to the org's emergency loan`,
      loanCollected: () => `The org settles its emergency loan on the deadline`,
      insolvency: () => `The org closes: the books fell below the floor`,
      seasonChampion: (p: Record<string, string | number>) => `${p.org} are the ${p.event} champions`,
      gearBought: (p: Record<string, string | number>) => `Org upgrade: ${p.name} installed`,
      bootcampRun: (p: Record<string, string | number>): string =>
        Number(p.tier) >= 2 ? "Structured bootcamp concluded" : "Bootcamp week concluded",
      coachHired: (p: Record<string, string | number>) => `${p.org} bring in ${p.coach}`,
      scrimWin: (p: Record<string, string | number>) => `Closed doors: scrim W ${p.a}-${p.b} vs ${p.opponent}`,
      scrimLoss: (p: Record<string, string | number>) => `Closed doors: scrim L ${p.a}-${p.b} vs ${p.opponent}`,
      // RTW-05 (rc.33 review): a booked scrim on a day the squad is short of three.
      scrimSkipped: (p: Record<string, string | number>) =>
        `Scrim vs ${p.opponent} called off: the squad is short of three`,
      blockbusterBid: (p: Record<string, string | number>) => `${p.org} table a blockbuster for ${p.player}`,
      // rc.32 history (ECO-08 / ECO-12): nothing sends these since rc.33 — kept so an older save's feed still reads.
      restructured: (p: Record<string, string | number>) =>
        p.player ? `Restructuring: ${p.player} sold to balance the books` : `Restructuring: the Backer steps in again`,
      listed: (p: Record<string, string | number>) => `${p.player} is on the market: the org listed him`,
      flavor1: () => `Desk notes: rotation discipline is the new meta buzzword`,
      flavor2: () => `Scrim servers busy: the whole region is grinding`,
      flavor3: () => `A caster's mic caught a very honest halftime take`,
      flavor4: () => `Ping complaints pile up`,
      flavor5: () => `A community montage is doing numbers this week`,
      // v2.0 (C1)
      worldsCancelled: () => `World Championship cancelled over the pandemic`,
      orgRelocates: (p: Record<string, string | number>) => `${p.org} moves from ${p.from} to ${p.to}`,
      // Season 1 (R133): Rocket Street's desk — South America. `v` picks the line (0–2).
      rsCupPreview: (p: Record<string, string | number>) =>
        [
          `${p.event}: the bracket plays this Saturday`,
          `Rocket Street week: the LATAM Championship is back`,
          `South America's community championship returns on Saturday`,
        ][Number(p.v ?? 0) % 3],
      rsCupRecap: (p: Record<string, string | number>) =>
        [
          `${p.champion} win the ${p.event}`,
          `${p.champion} take the ${p.event} title`,
          `${p.event}: ${p.champion} are the champions`,
        ][Number(p.v ?? 0) % 3],
      rsRegionalRecap: (p: Record<string, string | number>) =>
        [
          `${p.champion} win ${p.event}`,
          `${p.event} goes to ${p.champion}`,
          `${p.champion} beat ${p.runnerUp} to take ${p.event}`,
        ][Number(p.v ?? 0) % 3],
      rsBerths: (p: Record<string, string | number>) => {
        const sides = p.t2 ? `${p.t1} and ${p.t2}` : `${p.t1}`;
        return [
          `${sides} carry South America to the ${p.event}`,
          `South America at the ${p.event}: ${sides}`,
          `${sides} qualify for the ${p.event}`,
        ][Number(p.v ?? 0) % 3];
      },
      rsWindowWrap: (p: Record<string, string | number>) =>
        [
          `South America's window closes: ${p.n} ${Number(p.n) === 1 ? "move" : "moves"}`,
          `Window shut in South America: ${p.player} to ${p.to} leads the list`,
          `${p.to} sign ${p.player} as the South American window closes`,
        ][Number(p.v ?? 0) % 3],
    },
    // v0.2 — body text per template (same params; HQ feed renders these). A story whose
    // title already carries the fact has no body (rc9 CLUB-NEWS).
    body: {
      userReleased: (p: Record<string, string | number>) =>
        `${p.org} paid the severance. ${p.player} joins the free-agent pool.`,
      resultUserQualified: (p: Record<string, string | number>) =>
        `Three Swiss wins at ${p.event} give the org its regional seat. Season Points are played for on Sunday.`,
      resultUserEliminated: (p: Record<string, string | number>) =>
        `Three losses ended the org's ${p.event} in the Swiss. The prize money still lands.`,
      qualifiedMajor: () =>
        `Above the line when the standings locked. The Major has a cross-region field and doubled points.`,
      missedMajor: () =>
        `Below the line when the standings locked. The next split resets the race, and the Worlds points already banked still count.`,
      qualifiedWorlds: () =>
        `A full season of points did it. Worlds has the biggest field in the game.`,
      missedWorlds: () =>
        `The season's points were not enough. The org watches Worlds from home.`,
      stability: (p: Record<string, string | number>) =>
        `A new player mid-split cost ${p.points} Season Points. Rebuild in the preseason.`,
      contractExpiring: () =>
        `You can re-sign him through Split 3.`,
      contractReminder: () =>
        `Renew before the rollover or they leave as free agents.`,
      regionalSkipped: (p: Record<string, string | number>) =>
        `Only ${p.n} of 3 seats are filled, so the squad is not entered in ${p.event}: no points, no prize.`,
      eventMissedNoReserve: (p: Record<string, string | number>) =>
        `A starter was ruled out and there was no reserve, so the squad is not entered in ${p.event}: no points, no prize. A reserve signs in the next transfer window.`,
      playerLeft: (p: Record<string, string | number>) =>
        `No renewal came, so ${p.player} left for free. Future negotiations will be harder.`,
      orgLeaves: (p: Record<string, string | number>) =>
        `${p.org} fields no roster this season. Its seat goes to a new name and its players look for a new team.`,
      orgNewcomer: (p: Record<string, string | number>) =>
        `After two seasons at the bottom of the ${p.region} table, ${p.old} sold its seat. ${p.org} enters with the same players.`,
      prospectScouted: () =>
        `He starts once he is better than one of the starters.`,
      prodigyRises: (p: Record<string, string | number>) =>
        `${p.player} has a ceiling among the best in the world.`,
      // v2.2 ENDLESS: what the save shows, nothing more (the signings and the rating before and after).
      endlessProject: (p: Record<string, string | number>) =>
        `${p.org} (${p.region}) signs ${listEn(p)} for the new season${p.kit ? ` and adds ${kitEn(p.kit)}` : ""}. The team rating goes from ${p.before} to ${p.after}.`,
      endlessProjectGrows: (p: Record<string, string | number>) =>
        `${p.org} (${p.region}) keep the core together${p.p1 ? `, sign ${p.p1}` : ""}${p.kit ? ` and add ${kitEn(p.kit)}` : ""}. The team rating is ${p.after}.`,
      endlessHosts: (p: Record<string, string | number>) =>
        `Majors in ${hostEn(p.h1)}, ${hostEn(p.h2)} and ${hostEn(p.h3)}, and the World Championship in ${hostEn(p.h4)}.`,
      windowOpen: () =>
        `Deals resolve as the days advance.`,
      windowClosing: () => `Open proposals and listed players lapse when the window closes.`, // v2.3 SKIP
      sponsorSigned: (p: Record<string, string | number>) =>
        `${p.org} and ${p.name} signed a partnership: weekly pay, and a bonus for every goal reached. Terms are in Finances.`,
      registryRepair: () =>
        `Players listed by two orgs now sit on one roster, and repeated gamertags were renamed. Your squad, contracts and results are unchanged.`,
      unavailable: () =>
        `The sub takes his seat with his chemistry.`,
      standIn: (p: Record<string, string | number>) =>
        `A stand-in keeps the org in ${p.event}: full lineup, no chemistry.`,
      emergencyBid: (p: Record<string, string | number>) =>
        `${p.org} bid below his value while your books are in the red. Answer in Market, Deals.`,
      cashWarning: () =>
        `Costs are running ahead of income.`,
      emergencyLoan: () =>
        `Prizes and sales repay part of it, and it has a deadline. Terms are in the inbox.`,
      emergencyTopUp: () =>
        `The deadline has not moved.`,
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} bid for ${p.player}. Answer in Market, Deals.`,
      gearBought: () =>
        `Training efficiency goes up.`,
      bootcampRun: () =>
        `Chemistry is up and the squad is sharper in the next official event.`,
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} bid for ${p.player}. Answer in Market, Deals.`,
      // rc.32 history (ECO-08 / ECO-12): nothing sends these since rc.33 — kept so an older save's feed still reads.
      restructured: (p: Record<string, string | number>) =>
        `The org closed below the floor again and the Backer forced its hand${p.player ? `: ${p.player} heads to ${p.org}` : ""} (older save). ${legacyNextBreachEn(p.next)}`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} answered your listing with a formal offer for ${p.player}. Accept before the window closes, or keep him.`,
      listed: () =>
        `An offer from a side that would start him can come within a few window days.`,
      // v2.0 (C1)
      orgRelocates: (p: Record<string, string | number>) =>
        Number(p.withRoster)
          ? `${p.org} is leaving ${p.from} and registers in ${p.to} for the new season with the same squad.`
          : `${p.org} leaves ${p.from} for ${p.to} and starts over there with a new squad. The players it leaves behind are free agents.`,
      worldsCancelled: () =>
        `The league cancelled this season's World Championship because of the pandemic. Split 3 and its Major go ahead and the season ends after them. No world title this year.`,
      // Season 1 (R133): Rocket Street's desk — South America. `v` picks the line (0–2).
      rsCupPreview: (p: Record<string, string | number>) =>
        [
          `Rocket Street opens its bracket this Saturday: South American sides, single elimination, one day. ${p.org} is invited; the entry is on the calendar.`,
          `The region's community championship plays on Saturday, start to finish in one day. ${p.org} has an invitation on the calendar.`,
          `One bracket, one day: the ${p.event} is this Saturday. ${p.org} is invited; the entry is on the calendar.`,
        ][Number(p.v ?? 0) % 3],
      rsCupRecap: (p: Record<string, string | number>) =>
        Number(p.won)
          ? `${p.champion} beat ${p.runnerUp} in the final and take the community's trophy home.`
          : `${p.champion} beat ${p.runnerUp} in the final of Rocket Street's bracket.${p.org && p.org !== p.runnerUp ? ` ${p.org} finished: ${p.placement}.` : ""}`,
      rsRegionalRecap: (p: Record<string, string | number>) =>
        [
          `${p.champion} beat ${p.runnerUp} in the grand final of ${p.event}. The Season Points go on the South American table.`,
          `Split ${p.split} has another winner: ${p.champion} beat ${p.runnerUp} in the grand final of ${p.event}.`,
          `${p.runnerUp} reached the grand final of ${p.event}, and ${p.champion} took the title and the larger share of the points.`,
        ][Number(p.v ?? 0) % 3],
      rsBerths: (p: Record<string, string | number>) => {
        const sides = p.t2 ? `${p.t1} and ${p.t2}` : `${p.t1}`;
        return [
          `The field for the ${p.event} is set. ${sides} represent South America.`,
          `South America's places at the ${p.event} are decided: ${sides}.`,
          `${sides} carry the region to the ${p.event}.`,
        ][Number(p.v ?? 0) % 3];
      },
      rsWindowWrap: (p: Record<string, string | number>) => {
        const moves = `${p.n} ${Number(p.n) === 1 ? "move" : "moves"}`;
        return [
          `South America registered ${moves} before the window shut. The headline: ${p.player} to ${p.to}${Number(p.paid) ? ` for ${p.fee}` : ", as a free agent"}.`,
          `The window is closed in South America. ${p.player} joining ${p.to}${Number(p.paid) ? ` for ${p.fee}` : " on a free transfer"} was the move of the window, out of ${moves}.`,
          `Rosters are locked until the next window. ${p.to} made the region's biggest signing with ${p.player}${Number(p.paid) ? ` (${p.fee})` : ""}, out of ${moves}.`,
        ][Number(p.v ?? 0) % 3];
      },
    },
  },

  achievements: {
    title: "Career achievements",
    hint: "Kept across saves and season resets. Each pays Season XP once",
    // rc.6 (R171): an established org earns none of them; they belong to the founded road.
    foundedOnly: "Earned with a club you found. Seasons at an established organization do not count",
    unlocked: "Achievement unlocked",
    lockedLabel: "Locked",
    unlockedOn: (date: string) => `Unlocked ${date}`,
    xp: (n: number) => `+${n} Season XP`,
    progress: (done: number, total: number) => `${done} of ${total}`,
    showAll: (n: number) => `Show all ${n}`,
    showLess: "Show fewer",
    tier: { common: "Common", rare: "Rare", epic: "Epic", legend: "Legend" } as Record<string, string>,
    // rc.36 (UX-05, #155): the achievements' names and descriptions moved to the core copy
    // (ACH_UI.careerItems) — one source, read by the general list and the career screens.
  },

  inserts: {
    kinds: { random: "Side quest", sponsor: "Sponsor ask", training: "Training call" } as Record<string, string>,
    expires: "Decide today: the moment passes with the day.",
    fx: {
      rep: (n: number) => `${n > 0 ? "+" : ""}${n} rep`,
      chemistry: "+ chemistry",
      training: (w: number) => (w > 0 ? `+${w} training weeks` : `${w} training weeks`),
      none: "No effect",
      // rc.2 icon rows
      money: "Cash",
      repLabel: "Reputation",
      chemLabel: "Chemistry",
      trainingLabel: "Training",
      trainingWeeks: (w: number) => `${w > 0 ? "+" : ""}${w} wk`,
    },
    items: {
      "ins-showmatch": { title: "A streamer wants a showmatch", body: "An invitation arrives for a friendly on stream. The appearance fee is agreed, but the squad would need to give up an afternoon of practice.", a: "Play it", b: "Pass" },
      "ins-5050-showmatch": { title: "An invitation from 50/50", body: "50/50 is putting together a showmatch and would like your org on the broadcast. There is an appearance fee and a chance to meet a new audience; the staff will have to move an afternoon of practice.", a: "Join the 50/50 showmatch", b: "Keep the training schedule" },
      "ins-duds-showmatch": { title: "Duds Melow invited you to play a showmatch on stream", body: "Duds Melow is organizing a showmatch with the community and has invited your squad. The players are keen, and the appearance fee helps; it would mean cutting practice short that day.", a: "Accept Duds Melow’s invitation", b: "Sit this one out" },
      "ins-charity-cup": { title: "Charity cup appearance", body: "A local charity cup wants your org on the poster. It costs a little and buys goodwill.", a: "Show up", b: "Decline" },
      "ins-pc-dies": { title: "A PC dies mid-week", body: "One of the tournament rigs gave out. Replace it now, or borrow a spare and lose practice time.", a: "Replace it", b: "Borrow a spare" },
      "ins-fan-meetup": { title: "Fans ask for a meetup", body: "The fanbase wants a meetup after practice. A small cost, a little standing.", a: "Host it", b: "Not this week" },
      "ins-media-day": { title: "Media day request", body: "Press wants a full media day with the roster. Good for the brand, one session shorter.", a: "Full media day", b: "Keep it minimal" },
      "ins-sponsor-content": { title: "Your sponsor wants a content day", body: "The sponsor asks for a day of content with the players. It pays, and practice pays for it.", a: "Shoot the content", b: "Decline politely" },
      "ins-sponsor-jersey": { title: "Jersey reveal photo op", body: "The sponsor wants the new jersey revealed at the next event with a photo op. Quick money and a little standing.", a: "Do the reveal", b: "Skip it" },
      "ins-rest-request": { title: "A starter asks for a lighter week", body: "The squad is tired. Lighter sessions keep the mood up; pushing on keeps the pace.", a: "Lighten the week", b: "Push on" },
      "ins-lan-bootcamp": { title: "A LAN café offers a cheap bootcamp", body: "A local LAN café offers the squad a weekend under one roof for a flat fee.", a: "Book it", b: "Pass" },
      "ins-coach-clinic": { title: "Coach proposes a clinic", body: "The coach wants to run a focused clinic this week: a small cost, a real step forward.", a: "Run the clinic", b: "Not now" },
    } as Record<string, { title: string; body: string; a: string; b: string }>,
  },

  club: {
    honorsEntityFilter: "Compare organizations or players",
    honorsEventFilter: "Title competition",
    honorsTitles: "Titles",
    honorsEmpty: "No titles recorded for this competition yet",
    honorsAll: "Full title standings",
    honorsTitle: "Chasing history",
    honorsHint: "Real titles through Season 9, plus results in this career. RLCS Majors begin in Season X.",
    honorsOrgs: "Organizations",
    honorsPlayers: "Players",
    honorsLegacy: "In older saves, individual titles are recorded from this update onward.",
    title: "Club",
    identity: "Identity",
    manager: "Manager",
    founded: "Founded",
    region: "Region",
    reputation: "Reputation",
    repNext: (v: number, label: string) => `Next at ${v}: ${label}`,
    stars: "Team rating",
    starLabel: (n: number) => `${n}-star org`,
    trophies: "Trophy room",
    trophyEmpty: "No trophies yet",
    worldsPedestal: "Worlds trophy",
    records: "Records",
    recordPrize: "Total prize money",
    recordSeries: "Series record",
    recordBiggestFee: "Biggest signing",
    recordTitles: "Titles",
    seasonHistory: "Season history",
    progression: "Progression",
    unlockAt: (v: number) => `Unlocks at ${v} Reputation`,
    unlockWorlds: "Unlocks with a Worlds berth",
    unlockFuture: "Future update",
    unlocked: "Unlocked",
    unlockables: {
      peripherals: "Pro peripherals",
      monitors: "240Hz monitors",
      pcs: "Tournament PCs",
      bootcamp1: "Bootcamp",
      bootcamp2: "Structured bootcamp",
      psychologist: "Sports Psychologist",
      assistant: "Assistant coach",
      analyst: "Opponent analyst",
      physio: "Physical trainer",
      brand: "Brand manager",
      perfCenter: "Performance Center",
      coach: "Coach hiring",
      t2: "Invitational circuit",
      sponsorT2: "Challenger sponsors",
      sponsorT3: "Global sponsors",
      // rc.35: "Title partners" read as unclear — the top sponsor tier, the brand on the jersey.
      sponsorT4: "Headline sponsors (top tier)",
      exProCoach: "Ex-pro coaches",
      sponsors1: "Local sponsors",
      sponsors2: "Challenger sponsors",
      sponsors3: "Global sponsors",
      sponsors4: "Headline sponsors (top tier)",
      relocation: "Org relocation",
      star5: "5-star status",
    },
    settings: "Career settings",
    // v2.1 Matchday slice 3: the setting's label and options (the screen comes with slice 5).
    // rc9 MATCHDAY (R245): the one setting, on the Training screen.
    matchdayMode: {
      label: "Matchday",
      beta: "Beta",
      betaNote: "In beta: the plan and the live view may still change.",
      levels: { result: "Result only", watch: "Watch", manage: "Manage" },
      notes: {
        result: "Events go straight to the result.",
        watch: "Your series play live. The coach picks the plan.",
        manage: "Before each series you pick the plan, then it plays live.",
      },
    },
    abandonCareer: "Abandon career",
    abandonConfirm: "This deletes the save permanently",
  },

  event: {
    placementLabel: "Placement",
    rewardsTable: "Rewards by placement",
    communityLineup: (n: number) => `Your ${n}v${n} lineup`,
    communitySeat: (n: number) => `Player ${n}`,
    lobbyTitle: "Event lobby",
    format: "Format",
    formatSwiss: "16-team Swiss → top-8 double elimination",
    formatSingle: "8-team knockout",
    /** v2.2 event formats (FORMATS-SPEC.md): a Major / Worlds in its season's shape. */
    formats: {
      /** Saturday's headline, by stage. */
      stage: { swiss: "Swiss stage", groups4: "Group stage", gsl8: "Group stage", none: "Opening rounds" },
      stageShort: {
        swiss: "16-team Swiss",
        groups4: "4 groups of 4",
        gsl8: "2 double-elimination groups of 8",
        none: "16-team double elimination",
      },
      bracketShort: {
        double8: "top-8 double elimination",
        single8: "top-8 knockout",
        hybrid8: "top-8 hybrid bracket",
        hybrid12: "top-12 hybrid bracket",
        single12: "top-12 knockout",
        double16: "the last eight on Sunday",
      },
      /** Saturday's one line on the weekend strip. */
      stageSub: {
        swiss: (teams: number, wins: number) => `${teams}-team Swiss · ${wins} wins to advance`,
        groups4: "4 groups of 4 · everyone plays everyone in the group",
        gsl8: "2 groups of 8 · 2 wins to qualify, 2 losses to go out",
        none: "16-team double elimination · down to the last eight",
      },
      /** Sunday's one line on the weekend strip. */
      bracketSub: {
        double8: "Top-8 double elimination",
        single8: "Top-8 knockout",
        hybrid8: "Top-8 hybrid bracket",
        hybrid12: "Top-12 hybrid bracket",
        single12: "Top-12 knockout",
        double16: "The last eight of the double elimination",
      },
      /** How the stage sends sides on (the lobby). */
      stageRule: {
        swiss: "Three wins to qualify, three losses to go out.",
        groups4: "Everyone plays everyone in the group. Ties are settled by the table.",
        gsl8: "Two wins to qualify, two losses to go out. Four go through from each group.",
        none: "Everyone starts in the upper bracket. Two losses and you are out.",
      },
      /** How the bracket is entered and played (the lobby). */
      bracketRule: {
        double8: "Double elimination with a third-place series.",
        single8: "One loss and you are out. The grand final is one series.",
        hybrid8: "An upper bracket win goes to the semifinals, a loss to the quarterfinals. The lower bracket is a knockout.",
        hybrid12: "Group winners start in the upper bracket. Seconds and thirds play the lower bracket, one knockout round longer.",
        single12: "Group winners go straight to the quarterfinals. Seconds and thirds play the first round.",
        double16: "The grand final is one series.",
      },
      /** Who starts where in a hybrid bracket, by the stage that fills it. */
      hybridEntry: {
        swiss: "The top four of the Swiss start in the upper bracket, the other four in the lower.",
        groups4: "Group winners start in the upper bracket, runners-up in the lower.",
        gsl8: "Sides through at 2-0 start in the upper bracket, those through at 2-1 in the lower.",
        none: "",
      },
      stageComplete: { swiss: "Swiss stage complete", groups4: "Group stage complete", gsl8: "Group stage complete", none: "Saturday complete" },
      eliminatedIn: { swiss: "Eliminated in the Swiss", groups4: "Eliminated in the groups", gsl8: "Eliminated in the groups", none: "Eliminated on Saturday" },
      /** The 13th-16th placement's name, by stage. */
      stageExit: { swiss: "Swiss exit", groups4: "Group stage exit", gsl8: "Group stage exit", none: "Out in lower round 1" },
      simStage: { swiss: "Sim the Swiss", groups4: "Sim the groups", gsl8: "Sim the groups", none: "Sim Saturday" },
      sundayField: (n: number): string => (n === 12 ? "The playoff twelve" : "The playoff eight"),
      lastEight: "The last eight",
      side: { upper: "Upper bracket", lower: "Lower bracket", bye: "Bye to the quarterfinals", round1: "First round" },
      group: (letter: string) => `Group ${letter}`,
      groupStandings: "Group standings",
    },
    yourSeed: (n: number) => `Seed #${n}`,
    watch: "Play it out",
    instant: "Instant result",
    simToEnd: "Sim to end",
    skipSeries: "Skip series",
    lineupLocked: "Lineup locked for the event",
    roundLabel: (n: number) => `Round ${n}`,
    swissStage: "Swiss stage",
    playoffs: "Playoffs",
    semifinal: "Semifinal",
    quarterfinal: "Quarterfinal",
    upperBracket: "Upper bracket",
    lowerBracket: "Lower bracket",
    game: (n: number) => `Game ${n}`,
    goal: "GOAL",
    overtime: "OVERTIME",
    // GAME-04 — goal timeline + overtime presentation
    goldenGoal: "GOLDEN GOAL",
    endOfRegulation: "End of regulation",
    gameClock: "Game clock",
    playByPlay: "Play-by-play",
    seriesTag: "Series",
    matchPoint: "Match point",
    deciding: "Deciding game",
    upset: "UPSET",
    seriesWin: (name: string) => `${name} take the series`,
    sweep: "A clean sweep",
    reverseSweep: "REVERSE SWEEP",
    eliminated: "Out of the event",
    advancing: "Through to the next round",
    champion: (name: string) => `${name}: CHAMPIONS`,
    earned: "Earned",
    unavailableNotice: (player: string) => `${player} can't play this event. A reserve plays instead.`,
    aiTicker: "Around the bracket",
    speed: "Speed",
    // v0.2 rebuild — live standings, bracket, match center
    standings: "Standings",
    bracket: "Bracket",
    matchCenter: "Match center",
    throughRound: (n: number) => `Through round ${n}`,
    record: "W-L",
    gameDiff: "GD",
    advancedTag: "Through",
    eliminatedTag: "Out",
    liveTag: "LIVE",
    nextUp: "Next up",
    yourMatch: "Your series",
    starOfSeries: (name: string) => `Player of the series: ${name}`,
    scorerLine: (name: string, n: number) => `${name} ×${n}`,
    resultsDigest: "Results digest",
    digestPlacement: "Placement",
    digestPrize: "Prize",
    // rc.32 (M6, provisional): the players' share booked out of a podium prize.
    digestPlayerShare: (s: string) => `Players' share −${s}`,
    digestPoints: "Season Points",
    digestRep: "Reputation",
    // rc.33 (RTW-02): reputation paid by the newcomer's path (a result beyond the seed).
    digestRepUnderdog: "An underdog's run: the scene takes note",
    digestTopScorer: "Top scorer",
    continueToHq: "Back to HQ",
    continueToReview: "Season review",
    fieldTitle: "The field",
    avgOvr: "Avg OVR",
    // v2.0 (R40) — the weekend: qualifier Saturday → regional Sunday;
    // Major / Worlds: Swiss stage Saturday → Championship Sunday.
    formatQualifier: (teams: number, slots: number, wins: number, regional: string) =>
      `${teams}-team Swiss · the ${slots} that reach ${wins} wins qualify for Sunday's ${regional}`,
    formatTwoDay: (teams: number, playoffTeams: number) =>
      `Saturday: ${teams}-team Swiss · Sunday: top-${playoffTeams} double elimination`,
    championshipSunday: "Championship Sunday",
    directSunday: "Already through to Sunday",
    weekendTitle: "The weekend",
    roleQualifierSub: (teams: number, slots: number) => `${teams}-team Swiss · top ${slots} go through`,
    roleRegionalSub: (direct: number, qualified: number) => `${direct} direct + ${qualified} from Saturday`,
    roleSundaySub: (playoffTeams: number) => `Top-${playoffTeams} double elimination`,
    entryQualified: "You qualified",
    entryDirect: "Seeded direct",
    spots: "Spots",
    spotsValue: (slots: number, teams: number) => `${slots} of ${teams}`,
    qualifiedTag: "Q",
    qualifiedTagHint: "Came through Saturday's qualifier",
    simSwiss: "Sim the Swiss",
    qualified: "Qualified",
    eliminatedTitle: "Eliminated",
    qualifiedForSunday: "Qualified for Sunday",
    eliminatedInSwiss: "Eliminated in the Swiss",
    qualifiedFor: (regional: string) => `Through to Sunday's ${regional}`,
    regionalWithoutYou: (regional: string) => `${regional} goes on Sunday without you`,
    throughToSunday: "Through to Championship Sunday",
    seedLocks: "Your seed locks when the last Swiss round ends",
    sundayWithoutYou: "Sunday's playoffs go on without you",
    swissComplete: "Swiss stage complete",
    playoffEight: "The playoff eight",
    continueToSunday: "Continue to Championship Sunday",
    continueToSundayShort: "Continue to Sunday",
    sundaySub: (playoffTeams: number, bestOf: number) =>
      `Top ${playoffTeams} · double elimination · best of ${bestOf}`,
    sundayOpener: (opp: string, seed: number, oppSeed: number) =>
      `Seed #${seed}: you open against ${opp} (#${oppSeed})`,
    sundaySpectating: "Out in the Swiss: the crown is decided without you today",
    startNow: "Start now",
    startPlayoffs: "Start the playoffs",
    tapToSkip: "Tap anywhere to skip",
    swissRecord: "Record",
    onToSunday: "On to Sunday",
    // rc.29 — E2E fixes (CAR-03 · CAR-10)
    /** Fine pointers (mouse): the intro card skips on a click or Escape. */
    clickToSkip: "Click or press Esc to skip",
    /** Reduced motion: the day's last round shows first; the results wait for this. */
    seeResults: "See results",
    seeSwissResult: "See the Swiss result",
    /** The playoffs header badge when the user has no seed: Saturday's record, labelled. */
    swissRecordBadge: (record: string) => `Swiss ${record}`,
  },

  // rc.36 (SUN-01..03, R88) — the weekend: Saturday → HQ → Sunday.
  sunday: {
    today: "Today",
    tomorrow: "Tomorrow",
    qualifiedLine: "Through Saturday's qualifier",
    seedLine: (seed: number, record: string) => `Seed #${seed} · Swiss ${record}`,
    openerLabel: "Your opener",
    fieldLabel: "Sunday's field",
    briefingTitle: "Coach's briefing",
    briefingHint: "Briefing and bootcamp together: +2 rating at most",
    championshipBriefing: { keep: "Balanced preparation", recover: "Peak for the grand final", prepare: "Win the early rounds" },
    effectChampionship: (q: number, s: number, o: number, f: number) => `Quarterfinals ${q > 0 ? "+" : ""}${q}; semifinals ${s > 0 ? "+" : ""}${s}; other rounds ${o > 0 ? "+" : ""}${o}; grand final ${f > 0 ? "+" : ""}${f}.`,
    briefing: {
      keep: "Continuity",
      recover: "Recover",
      prepare: "Study the Swiss field",
    },
    effectContinuity: (n: number) => `+${n} team rating in every series; no extra risk.`,
    effectTradeoff: (first: number, later: number) => `${first > 0 ? "+" : ""}${first} in Swiss; ${later > 0 ? "+" : ""}${later} in playoffs.`,
    start: "Start Sunday",
    startHint: "Advances one day. No training or pay on Sunday.",
    fromHqHint: "Sunday starts from HQ, with the coach's briefing if you want one.",
    briefingChip: (label: string) => `Briefing · ${label}`,
    outTitle: "Championship Sunday without you",
    outLine: (record: string) => `Out in the Swiss (${record}). The playoff eight play for the crown.`,
    watch: "Watch Sunday",
    withoutYouTitle: (event: string) => `${event} without you`,
    withoutYouLine: "Out at Saturday's qualifier.",
    whoQualified: "Through Saturday's qualifier",
    resultsInTitle: (event: string) => `${event}: the results are in`,
    resultsInLine: "You were not in it.",
  },

  // rc.36 (SUN-03, R88) — /career/follow: an event the user is out of.
  follow: {
    swissStandings: "Swiss standings",
    kicker: "From the stands",
    reasonEliminated: "Out at the qualifier",
    reasonNotQualified: "Not in the field",
    field: "Who's in",
    swissRound: (n: number) => `Swiss round ${n}`,
    results: "Final results",
    champion: "Champion",
    nextRound: "Next round",
    pause: "Pause",
    play: "Play",
    skipToResults: "Skip to results",
    backToHq: "Back to HQ",
    nothing: "No event to follow",
    nothingWhy: "An event you are out of appears here",
    progress: (n: number, total: number) => `Round ${n} of ${total}`,
    teams: (n: number) => `${n} teams`,
  },

  ceremonies: {
    seasonReview: "Season review",
    seasonGrade: (g: string) => `Season grade: ${g}`,
    grade: "Grade", // rc9 HQ: the label under the season's grade figure
    devRecap: "Squad growth",
    nextSeason: "Before the next season", // rc9 HQ
    rank: "In the region",
    results: "Podiums",
    otherEvents: (n: number) => (n === 1 ? "1 more event played" : `${n} more events played`),
    noPodium: "No podium this season",
    prize: "Prize money",
    rolloverCta: "Start the season",
    worldsChampion: (name: string) => `World champions: ${name}`,
    yourTitle: "World champions",
    finalWhistle: "Final whistle",
    finalWhistleBody: "The 2026 season ends here. You can keep playing in the endless era.",
    insolvencyTitle: "Insolvency",
    // A breach that ended it (rc.33's count; rc.34: the top-up cap or CAREER_LOAN.breachesToEnd).
    insolvencyBody: "The books went below the floor once too often.",
    // rc.34 (end.moneyCause "deadline"): the emergency loan unpaid on its deadline.
    insolvencyBodyDeadline: "The emergency loan was due and the balance could not cover it.",
    legacyTitle: "Career legacy",
    legacyGrade: { legend: "Legend", contender: "Contender", challenger: "Challenger", journeyman: "Journeyman" },
    retire: "Retire",
    retireDesc: "The career is archived: trophies and history stay browsable.",
    infinite: "Endless era",
    infiniteDesc: "The history is generated from now on.",
    infiniteExplainer: "From 2027 the world is generated: rookies appear, veterans retire.",
    defendTitle: "Defend the title",
  },

  // v2.2 share kit: the career's share card (components/career/share).
  share: {
    button: "Share career",
    buttonTitle: "Share the title",
    sheetTitle: "Share your career",
    kicker: "Road to Worlds",
    manager: (name: string) => `Manager ${name}`,
    meta: (region: string, season: string) => `${region} · ${season}`,
    headlineWorlds: (n: number) => (n > 1 ? `${n}× World champions` : "World champions"),
    headlineMajors: (n: number) => (n > 1 ? `${n}× Major champions` : "Major champions"),
    headlineRegionals: (n: number) => (n > 1 ? `${n} regional titles` : "Regional champions"),
    headlineTitles: (n: number) => (n > 1 ? `${n} titles` : "First silverware"),
    // rc9 SHARE (#258 revised): a club with no title leads with its season; the record is a figure.
    headlineSeason: (n: number) => `Season ${n}`,
    shelfWorlds: "Worlds",
    shelfMajors: "Majors",
    shelfRegionals: "Regionals",
    shelfOther: "Other titles",
    figSeries: "Series",
    figPrize: "Prize money",
    textWorlds: (org: string, n: number) =>
      `${org} ${n > 1 ? `have won the Worlds ${n} times` : "are world champions"} in Road to Worlds, the RLCS career mode on Rocket Draft. Build your own org from nothing:`,
    textTitles: (org: string, n: number) =>
      `${org}: ${n} ${n === 1 ? "title" : "titles"} so far in Road to Worlds, the RLCS career mode on Rocket Draft. Run your own org:`,
    textNone: (org: string) =>
      `I'm running ${org} in Road to Worlds, the RLCS career mode on Rocket Draft. Build your own org and meet me at the Worlds:`,
    hint: "The link opens Road to Worlds. Your save stays on this device.",
  },

  cloud: {
    synced: (when: string) => `Saved in your account · ${when}`,
    pending: "Waiting to save to your account",
    syncing: "Saving to your account…",
    conflict: "Two copies of this career",
    choose: "Choose",
    newer: "The copy in your account is from a newer version of the game. Reload to update",
    error: "Could not reach your account. Retrying",
    tryNow: "Try now",
    restoring: "Restoring from your account…",
    exportSave: "Export save",
    importSave: "Import a save file",
    importErrors: {
      unreadable: "That file could not be read.",
      "not-a-save": "That is not a Rocket Draft career save.",
      newer: "That save comes from a newer version of the game. Reload to update, then import again.",
      damaged: "That file is incomplete or damaged.",
      invalid: "The game could not load that save.",
      "slot-taken": "This slot already holds a career.",
    },
    deleteAlso: "The copy in your account is deleted too",
    helpActive: "Careers are also saved in your account. Export a file for a backup of your own",
    helpLocal: "Careers are saved in this browser. Export a file to move one to another device or keep a backup",
    helpSignIn: "Sign in to keep a copy in your account",
    notice: {
      titleDiverged: "This career was played on two devices",
      titleDifferent: "This slot holds a different career in your account",
      titleDeleted: "This career was deleted from your account",
      bodyDiverged: "The two copies cannot be merged. Choose the one to keep; the other is replaced.",
      bodyDifferent: "Choose the career to keep in this slot; the other is replaced.",
      bodyDeleted: "It was deleted on another device. Keep it here and it goes back to your account, or delete it here too.",
      thisDevice: "This device",
      account: "Your account",
      mostRecent: "Most recent",
      keepDevice: "Keep this device's career",
      useAccount: "Use the career from your account",
      keepHere: "Keep it here",
      deleteHere: "Delete it here too",
      exportFirst: "Export this device's career first",
      decideLater: "Decide later",
      seasonWeek: (season: string, week: string) => `${season} · ${week}`,
    },
    toast: {
      updated: (org: string) => `${org}: updated from your account`,
      restored: (org: string) => `${org}: restored from your account`,
    },
  },

  saves: {
    title: "Careers",
    empty: "Found a new org",
    resume: "Resume",
    archived: "Archived",
    champion: "Champions",
    delete: "Delete",
    deleteConfirm: (org: string, n: number) =>
      `Delete ${org}? ${n} season${n === 1 ? "" : "s"} of history disappears. This cannot be undone.`,
    lastPlayed: "Last played",
    newCareer: "New career",
    emptySlot: "Empty slot",
    slotsFull: "All three slots are taken",
  },

  /** v2.0.34: the one-off HQ card about several careers and the account copy (lib/careerSavesNotice.ts). */
  savesNotice: {
    title: "Your careers, on every device",
    body: "Run up to three careers. Signed in, each one is saved to your account and opens on any device.",
    open: "See my careers",
    dismiss: "Got it",
  },

  /** v2.0.31: the player-research invitation on the season review (lib/researchInvite.ts). */
  research: {
    title: "Help shape Road to Worlds",
    body: "A short form on what works, what does not and what is missing.",
    note: "Opens in a new tab. We only ask once.",
    open: "Open the form",
    dismiss: "No thanks",
  },

  goals: {
    reward: (n: number) => `+${n} reputation at review`,
    reachMajor: "Reach a Major",
    regionalTop4: "A regional top-4",
    majorTop8: "A Major top-8",
    majorTop4: "A Major top-4",
    qualifyWorlds: "Qualify for Worlds",
    worldsTop4: "A Worlds top-4",
    winMajor: "Win a Major",
    winWorlds: "Win Worlds",
    // rc.35 (front S): a season goal from the sponsors' level model — reached in any split.
    model: (kind: string, count: number, place: number): string => {
      switch (kind) {
        case "enterEvents":
          return `Enter ${count} events in a split`;
        case "regionalReach":
          return count === 1 ? "Reach a regional" : `Reach ${count} regionals in one split`;
        case "regionalFinish":
          if (place <= 1) return count === 1 ? "Win a regional" : `Win ${count} regionals in one split`;
          return count === 1 ? `A regional top ${place}` : `Top ${place} at ${count} regionals in one split`;
        case "majorQualify":
          return "Reach a Major";
        case "majorFinish":
          return place <= 1 ? "Win a Major" : `A Major top ${place}`;
        default:
          return "";
      }
    },
    repRisk: (n: number) => `Your reputation expects it (−${n} if missed)`,
    // rc.36 (UX-02, R87): the board's season goal — over the whole season, fixed at its start.
    season: (kind: string, count: number, place: number): string => {
      switch (kind) {
        case "cupFinal":
          return count === 1 ? "Reach a Community Cup final" : `Reach ${count} Community Cup finals`;
        case "cupWin":
          return count === 1 ? "Win a Community Cup" : `Win ${count} Community Cups`;
        case "regionalReach":
          return count === 1 ? "Play a Sunday regional" : `Play ${count} Sunday regionals`;
        case "regionalFinish":
          if (place <= 1) return count === 1 ? "Win a regional" : `Win ${count} regionals`;
          return count === 1 ? `A regional top ${place}` : `Top ${place} at ${count} regionals`;
        case "majorQualify":
          return count === 1 ? "Qualify for a Major" : count === 3 ? "Qualify for all three Majors" : `Qualify for ${count} Majors`;
        case "majorFinish":
          // rc.6 (R172): a count above one was dropped ("Win a Major" for two titles).
          if (place <= 1) return count === 1 ? "Win a Major" : `Win ${count} Majors`;
          return count === 1 ? `A Major top ${place}` : `Top ${place} at ${count} Majors`;
        case "worldsQualify":
          return "Qualify for Worlds";
        case "worldsFinish":
          return place <= 1 ? "Win Worlds" : `A Worlds top ${place}`;
        default:
          return "";
      }
    },
    // rc.6 (ORGMODE E4): an established board's goal with the season's total ("top 4 in 3 of the 9 regionals").
    seasonTotal: (kind: string, count: number, place: number, total: number): string => {
      switch (kind) {
        case "regionalReach":
          return count === 1 ? "Play a Sunday regional" : `Play ${count} of the ${total} Sunday regionals`;
        case "regionalFinish":
          if (place <= 1) return count === 1 ? "Win a regional" : `Win ${count} of the ${total} regionals`;
          return count === 1 ? `A regional top ${place}` : `Top ${place} in ${count} of the ${total} regionals`;
        case "majorQualify":
          return count === 1 ? "Qualify for a Major" : count >= total ? `Qualify for all ${total} Majors` : `Qualify for ${count} of the ${total} Majors`;
        case "majorFinish":
          if (place <= 1) return count === 1 ? "Win a Major" : `Win ${count} of the ${total} Majors`;
          return count === 1 ? `A Major top ${place}` : `Top ${place} at ${count} of the ${total} Majors`;
        case "worldsQualify":
          return "Qualify for Worlds";
        case "worldsFinish":
          return place <= 1 ? "Win Worlds" : `A Worlds top ${place}`;
        case "cupFinal":
          return count === 1 ? "Reach a Community Cup final" : `Reach ${count} Community Cup finals`;
        case "cupWin":
          return count === 1 ? "Win a Community Cup" : `Win ${count} Community Cups`;
        default:
          return "";
      }
    },
    role: { target: "Target", stretch: "Stretch" } as Record<string, string>,
    deadline: {
      // rc.9 integration: the event in words; the row adds its date (no "W32").
      lastCup: "Last chance: the final Community Cup",
      lastRegional: "Last chance: Split 3's last regional",
      majorField: "Decided when the Split 3 Major field is set",
      majorFinal: "Last chance: the Split 3 Major",
      worldsField: "Decided when the Worlds field is set",
      worldsFinal: "Last chance: Worlds",
    } as Record<string, string>,
    status: { done: "Done", open: "In play", out: "Out of reach", met: "Met", missed: "Missed" } as Record<string, string>,
    left: (n: number, kind: string): string => {
      if (kind === "cupFinal" || kind === "cupWin") return n === 1 ? "1 cup left" : `${n} cups left`;
      if (kind === "majorQualify" || kind === "majorFinish") return n === 1 ? "1 Major left" : `${n} Majors left`;
      if (kind === "worldsQualify" || kind === "worldsFinish") return "Worlds still open";
      return n === 1 ? "1 regional left" : `${n} regionals left`;
    },
    splitLeft: (n: number) => (n === 1 ? "1 split left" : `${n} splits left`),
    missCost: (n: number) => `Miss it: −${n} rep`,
    noCost: "No reputation at stake",
    fixedNote: "Set by the board at the season's start.",
    why: {
      rank: (rank: number, teams: number) => `#${rank} of ${teams} in your region`,
      stage: { founding: "Founding season", rising: "Rising org", established: "Established org" } as Record<string, string>,
      money: { tight: "Tight budget: eased", flush: "Healthy budget: raised" } as Record<string, string>,
      last: { met: "Last goal met: raised", missed: "Last goal missed: eased" } as Record<string, string>,
    },
  },

  // rc9 HQ: the first-visit `explainers` group was removed (no component read it since the guided tour, rc.54).

  // v0.3 org sheet — any AI org's roster, opened from standings/events/market.
  orgSheet: {
    roster: "Roster",
    coach: "Coach",
    noCoach: "No coach",
    points: "Season Points",
    viewTeam: "View team",
    prestige: (n: number) => `Prestige ${n}`,
    // rc.2 local sides
    localSide: "Local side",
    // rc.29: since R30 the local scene also fills the Saturday qualifiers.
    // rc.31 (R49): its regional points count in the Major and Worlds races.
    localHint:
      "An amateur team from the regional scene: they play the community cups and the Saturday qualifiers, and their regional points count in the Major and Worlds races.",
  },

  // rc.34 (Miguel, 31/10: "communicate it better with a modal that says what is happening"): the
  // money notice, one per event that changes the stakes (careerFlow.moneyNoticeOf). The modal
  // passes the notice's params with money formatted and `dlDate` (the deadline's date) added.
  moneyNotice: {
    // rc9 TRAIN-MARKET: each rule once, where it is needed. The loan opening says how a loan works;
    // the deadline warning says what the deadline costs; the rest carry only what is new.
    received: "Cash received",
    repayTotal: "Total to repay",
    weeklyPayment: "Weekly payment",
    termWeeks: "Weeks",
    ok: "Understood",
    toFinances: "Open Finances",
    loanOpened: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The bank stepped in",
      lead: `Your balance fell below the floor (${p.floor}), so the bank lent you ${p.lent}.`,
      rows: noticeRows(
        ["You owe", `${p.owed}, with ${p.repayPct}% interest`],
        p.dlDate !== undefined && ["Repay by", `${p.dlDate} (${p.dlWeeks} weeks)`],
        p.dlDate !== undefined && ["On the deadline", "The bank collects. If that puts you below the floor, the career ends"],
        ["How it is repaid", `${p.garnishPct}% of each prize and ${p.salePct}% of each sale go to the bank. Pay the rest from Finances`],
        positive(p.partnerWeekly) && [
          "Investor",
          `${p.partnerName} joins with this loan: ${p.partnerWeekly} a week for ${p.partnerWeeks} weeks, never taken back`,
        ],
        noticeNextEn(p) !== "" && ["If it happens again", noticeNextEn(p)],
      ),
      foot: Number(p.lock) ? "While you owe: no transfer fees and no gear" : undefined,
    }),
    loanTopUp: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The bank added to your loan",
      lead: `Your balance fell below the floor again, so the bank lent you ${p.lent} more.`,
      rows: noticeRows(
        ["You owe", `${p.owed} in all`],
        p.dlDate !== undefined && ["Repay by", `${p.dlDate}, the deadline does not move`],
        noticeNextEn(p) !== "" && ["If it happens again", noticeNextEn(p)],
      ),
    }),
    deadlineWarning: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: Number(p.weeksLeft) === 1 ? "One week to repay the bank" : `${p.weeksLeft} weeks to repay the bank`,
      lead: `The emergency loan is due on ${p.dlDate}. You owe ${p.owed}; the balance is ${p.balance}.`,
      rows: noticeRows(
        // rc.34 review: the books projected to the deadline (the weekly spending counted), not today's balance.
        ["At this pace", onPaceEn(p)],
        !Number(p.covered) && ["Ways to close the gap", noticeWaysEn(p)],
        !Number(p.covered) && ["On the deadline", "The bank collects. If that puts you below the floor, the career ends"],
        // rc.9 integration: how to repay early; a partial payment closes nothing.
        ["Repay early", "Pay it all, in Finances, clears the debt any day the balance stays above the floor after paying"],
      ),
    }),
    // rc.34 review: inside the last weeks the projection stopped covering the debt (a fee, a purchase, a lost prize).
    deadlineSlipped: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The loan is no longer covered",
      lead: `${Number(p.weeksLeft) === 1 ? "One week" : `${p.weeksLeft} weeks`} to the deadline (${p.dlDate}). At this pace you are ${p.gap} short of the ${p.owed} owed.`,
      rows: noticeRows(["Ways to close the gap", noticeWaysEn(p)]),
    }),
    deadlineCollected: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "Loan settled",
      lead: `The deadline arrived and the books could pay it: the bank took ${p.collected}. The balance is now ${p.balance}.`,
      rows: noticeRows([
        "What comes next",
        p.next === undefined ? "Another dip below the floor opens a new loan, with a new deadline" : noticeNextEn(p),
      ]),
    }),
    careerEnded: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The career ends here",
      lead:
        p.cause === "deadline"
          ? `The emergency loan came due with ${p.owed} owed and ${p.balance} in the bank. Paying it would have put you below the floor, so the org closed.`
          : !positive(p.owed) && Number(p.maxLoans) >= 0 && Number(p.loans) >= Number(p.maxLoans)
            ? `Your balance fell below the floor again and the bank would not open another emergency loan after ${Number(p.loans) === 1 ? "the one it lent" : `the ${p.loans} it lent`}. The org closed.`
            : `Your balance fell below the floor again and the bank would not lend any more${Number(p.topUps) > 0 ? ` after ${p.topUps} top-ups` : ""}. The org closed.`,
      rows: noticeRows(["What stays", "The season review, the archive and the trophies"]),
    }),
    loanTakenOver: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The bank took over your debt",
      lead: `The Emergency Backer is gone. The ${p.owed} you owed it is now an emergency loan with the bank.`,
      rows: noticeRows(
        p.dlDate !== undefined && ["Repay by", `${p.dlDate} (${p.dlWeeks} weeks)`],
        ["How it is repaid", `${p.garnishPct}% of each prize and ${p.salePct}% of each sale go to the bank. Pay the rest from Finances`],
      ),
    }),
    // rc.37 F2 (package 2): the bank's ordinary loan, offered before the floor (careerFlow.offerCreditOnRunway).
    notNow: "Not now",
    takeLoan: (amount: string) => `Take ${amount}`,
    creditOffer: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The bank offers a loan",
      lead:
        Number(p.weeks) > 0
          ? `At ${p.burn} spent a week, your cash lasts about ${p.weeks} more Mondays. Before you reach the floor (${p.floor}), the bank offers a loan.`
          : `You are in the red (${p.balance}) and losing ${p.burn} a week. Before you reach the floor (${p.floor}), the bank offers a loan.`,
      rows: noticeRows(
        ["You receive", `${p.loanNet} now`],
        ["You repay", `${p.loanTotal} in all, with ${p.loanPct}% interest`],
        ["Term", `${p.loanTerm} weeks, ${p.loanWeekly} every Monday`],
        ["Without it", `At this pace you go below the floor on ${breachWhenEn(p)}`],
      ),
      foot: `The emergency loan costs more: ${p.emergencyPct}%${Number(p.emergencyTerm) > 0 ? `, repaid within ${p.emergencyTerm} weeks` : ""}`,
    }),
    // rc.37 F2 (package 4): a one-off spend brought the floor within reach (careerFlow.spendAlertFlow).
    spendRisk: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: Number(p.mondays) === 1 ? "Next Monday breaks the floor" : "This leaves you near the floor",
      lead: positive(p.burn)
        ? `After ${p.spent}, ${p.balance} is left. At ${p.burn} spent a week, you go below the floor (${p.floor}) on ${breachWhenEn(p)}.`
        : `After ${p.spent}, ${p.balance} is left, below the floor (${p.floor}) even with the week's income: ${breachWhenEn(p)} breaks it.`,
      rows: noticeRows(
        noticeNextEn(p) !== "" && ["On that Monday", noticeNextEn(p)],
        Number(p.offer) > 0 && [
          "The bank's offer",
          `${p.loanNet} now, ${p.loanTotal} in all, ${p.loanWeekly} every Monday for ${p.loanTerm} weeks`,
        ],
        ["Other ways out", "Prizes before that Monday, a good bid for a player or a lighter wage bill"],
      ),
    }),
  },

  // rc9 MATCHDAY (R240-R246): the user's series when you manage it. The plan
  // before the series (three directives), the live games, the one break call,
  // the end with what the plan did.
  seriesDesk: {
    planTitle: "Your plan",
    favourite: (gap: number) => `You are the favourite, ${gap} rating ${gap === 1 ? "point" : "points"} up`,
    underdog: (gap: number) => `They are the favourite, ${gap} rating ${gap === 1 ? "point" : "points"} up`,
    even: "An even match",
    read: (theirs: string, answer: string) => `They play ${theirs}. ${answer} beats it.`,
    readPlain: (theirs: string) => `They play ${theirs}.`,
    approach: "Approach",
    ourGame: (style: string) => `Our game: ${style}`,
    answer: (style: string) => `Answer with ${style}`,
    ourGameEdge: (theirs: string) => `Already beats their ${theirs}.`,
    ourGameAgainst: (theirs: string) => `Their ${theirs} has the edge on it.`,
    ourGameNeutral: "The team's best fit. No edge either way.",
    answerNote: (theirs: string, fit: number, own: number) => `Beats their ${theirs}, but the team fits it at ${fit}% (${own}% in its own style).`,
    switchTo: (style: string) => `Switch to ${style}`,
    switchNote: (theirs: string, fit: number) => `Takes away their ${theirs}'s edge. The team fits it at ${fit}%.`,
    risk: "Risk",
    risks: { safe: "Steady", standard: "Normal", aggressive: "All in" },
    riskNote: {
      safe: "Fewer swings in every game. Suits the favourite.",
      standard: "Games swing as much as usual.",
      aggressive: "More swings in every game. Suits the underdog.",
    },
    shutDown: "Shut down",
    free: "Nobody",
    mark: (name: string) => `Mark ${name}`,
    freeNote: "Everyone keeps their own role.",
    markNote: (name: string) => `Cuts ${name}'s special plays, and ties up some of your defence.`,
    coachPick: "Coach",
    captainPick: "Captain",
    play: "Play the series",
    skip: "Skip to the result",
    pause: "Pause",
    resume: "Resume",
    speed: "Speed",
    skipGame: "Skip game",
    skipSeries: "Skip series",
    gameOf: (n: number, bo: number) => `Game ${n} · Best of ${bo}`,
    series: (a: number, b: number) => `Series ${a}-${b}`,
    // The Timeout button: called for the next break, once a series.
    timeout: "Timeout",
    timeoutLeft: "1 left",
    timeoutCalled: "Timeout called",
    timeoutUsed: "Timeout used",
    seriesWon: "Series won",
    seriesLost: "Series lost",
    continue: "Continue",
    noGoalsYet: "No goals yet.",
    final: "Final",
    goalLine: (scorer: string, a: number, b: number) => `${scorer} scores, ${a}-${b}`,
    clock: "Game clock",
    strip: { shots: "Shots", saves: "Saves", assists: "Assists", demos: "Demos", score: "Points" },
    styles: {
      pressure: "Pressure",
      possession: "Possession",
      counter: "Counter",
      individual: "Individual",
      teamplay: "Teamplay",
    },
    // What the plan did, from the engine's log of the series (planLine.ts).
    games: (list: string) => (list.includes(" ") ? `games ${list}` : `game ${list}`),
    and: "and",
    lineEdge: (style: string, theirs: string, games: string, won: number) =>
      `${style} had the edge on their ${theirs} in ${games}, and you won ${won} of them.`,
    lineEdgeLost: (style: string, theirs: string, games: string) =>
      `${style} had the edge on their ${theirs} in ${games}, but those games went their way.`,
    lineEdgeAll: (style: string, theirs: string, won: number, n: number) =>
      `${style} had the edge on their ${theirs} in every game. You won ${won} of ${n}.`,
    lineSwitch: (style: string, theirs: string, games: string, to: string) =>
      `${style} had the edge on their ${theirs} in ${games}, then they switched to ${to}.`,
    lineAgainst: (theirs: string, style: string, games: string) => `Their ${theirs} had the edge on your ${style} in ${games}.`,
    lineNeutral: "Neither style had the edge on the other.",
    lineTimeout: (game: number) => `The timeout before game ${game} cleared their momentum.`,
    lineTimeoutEmpty: (game: number) => `The timeout before game ${game} found no momentum to clear.`,
  },

  // rc9 MATCHDAY (STORIES): your players' numbers on the Event screen.
  eventStats: {
    title: "Your players",
    event: "This event",
    last: "Last series",
    empty: "Numbers appear after your first series.",
  },

  // v2.1 Matchday slice 5: the box score in the Match Center and the roster's season stats.
  boxScore: {
    title: "Box score",
    series: "Series",
    game: (n: number) => `G${n}`,
    gameLabel: (n: number) => `Game ${n}`,
    player: "Player",
    goals: "G",
    assists: "A",
    saves: "Sv",
    shots: "Sh",
    score: "Pts",
    rating: "Rtg",
    games: "GP",
    mvp: "MVP",
    moments: "Key moments",
    legend: "G goals · A assists · Sv saves · Sh shots · Pts score · Rtg rating (0-10)",
    seasonTitle: "Season stats",
    // rc9 MATCHDAY: seasonSub cut (copy audit); a player's games under his name.
    gamesPlayed: (n: number) => (n === 1 ? "1 game" : `${n} games`),
    seasonEmpty: "No series played yet this season.",
  },

  // v2.1 Matchday slice 4: the key moments of a game (engine/career/boxScore.ts).
  // Three variants per type; a series never repeats one. (player, clock, n).
  moments: {
    overtimeWinner: [
      (p: string, c: string) => `${p} ends it in overtime at ${c}.`,
      (p: string, c: string) => `Overtime golden goal: ${p}, ${c} in.`,
      (p: string, c: string) => `${p} settles the game in extra time, ${c}.`,
    ],
    comeback: [
      (p: string, _c: string, n: number) => `Down ${n}, they turn it around: ${p} puts them ahead.`,
      (p: string, _c: string, n: number) => `From ${n} behind to the lead, ${p} with the goal.`,
      (p: string, _c: string, n: number) => `${p} completes the comeback from ${n} down.`,
    ],
    hatTrick: [
      (p: string, _c: string, n: number) => `${p} reaches ${n} goals: hat-trick.`,
      (p: string, _c: string, n: number) => `Hat-trick for ${p}, ${n} on the night.`,
      (p: string, _c: string, n: number) => `${p} scores ${n}. A hat-trick in this game.`,
    ],
    cleanSheet: [
      (p: string, _c: string, n: number) => `Clean sheet in the decider, ${p} with ${n} saves.`,
      (p: string, _c: string, n: number) => `Nothing gets past ${p} (${n} saves). Shutout.`,
      (p: string, _c: string, n: number) => `Shutout in the deciding game, ${p} makes ${n} saves.`,
    ],
    lateGoal: [
      (p: string, c: string) => `${p} scores with ${c} left.`,
      (p: string, c: string) => `Late goal from ${p}, ${c} on the clock.`,
      (p: string, c: string) => `${p} finds the net at ${c}.`,
    ],
    saveMarathon: [
      (p: string, _c: string, n: number) => `${p} makes ${n} saves.`,
      (p: string, _c: string, n: number) => `${n} saves from ${p}, the wall of this game.`,
      (p: string, _c: string, n: number) => `${p} stops ${n} shots.`,
    ],
    demoBlitz: [
      (p: string, _c: string, n: number) => `${p} takes down ${n} opponents.`,
      (p: string, _c: string, n: number) => `${n} demos for ${p}.`,
      (p: string, _c: string, n: number) => `${p} is relentless: ${n} demolitions.`,
    ],
    decider: [
      (p: string, c: string) => `${p} scores the goal that decides it, ${c}.`,
      (p: string, c: string) => `The decisive goal: ${p}, ${c}.`,
      (p: string, c: string) => `${p} puts the game away at ${c}.`,
    ],
    unknownPlayer: "A player",
  },

  common: {
    ovr: "OVR",
    pot: "POT",
    ovrShort: (n: number) => `${n} OVR`,
    starsShort: (n: number) => `${n}★`,
    rep: "Rep",
    reputation: "Reputation",
    seasonPoints: "Season Points",
    prize: "Prize",
    confirm: "Confirm",
    cancel: "Cancel",
    back: "Back",
    next: "Next",
    close: "Close",
    locked: "Locked",
    free: "Free",
    perWeek: "/ week",
    you: "You",
    placement: {
      champion: "Champions",
      runner_up: "Runners-up",
      third: "3rd place",
      fourth: "4th place",
      top4: "Top 4",
      top6: "Top 6",
      top8: "Top 8",
      top12: "Top 12",
      swiss_exit: "Swiss exit",
    },
    /** v2.0 (R40): a qualifier row never has a bracket placement (top8 = qualified). */
    qualifierOutcome: { qualified: "Qualified", eliminated: "Eliminated" },
    tier: {
      t3: "Community Cup",
      t2: "Invitational",
      qualifier: "Qualifier",
      regional: "Regional",
      major: "Major",
      worlds: "Worlds",
    },
    // v2.0 (P1): an action that failed inside the game (the save is untouched).
    actionFailed: "That did not go through, and nothing in your save changed. Try again; if it keeps happening, tell us on Discord.",
  },
  launch: {
    seasonDetailUnavailable: "Detailed results from this season were not kept in this save.",
    competition: "Competition",
    futureGoal: "Goal set at the start of this split",
    careerStats: "Career totals",
    lineup: "Change lineup", swapWith: (name: string) => `Swap with ${name}`,
    unlocked: "New possibilities", open: "Explore", breaking: "Breaking news",
    coachTypes: { generated: "Common coach", dataset: "Professional coach", real: "Former pro" },
    coachDetails: "Effects and development", coachGrowth: (quality: number, ceiling: number) => `Quality ${quality} → potential ${ceiling}`,
    coachRetainer: "Fixed-term contract · renew it before it ends or the coach leaves",
    offersTitle: "Offers received", coachDealEnds: (season: string) => `Contract through ${season}`, coachDealLast: "Final season of the contract", coachDealOpen: "Contract dated at the next season review",
    coachRenewAsk: "Asks to renew", coachRenewFor: (n: number) => `Renew ${n} ${n === 1 ? "season" : "seasons"}`,
    coachEvolution: "Quality and experience develop at each season review, up to the coach’s ceiling.",
    coachShortlist: "Available coaches", coachCompare: "Compare type, quality, specialty and weekly wage. Open details for training effects.",
    sponsorSchedule: "Goals across this contract", automaticCamp: "Sponsor-funded bootcamp · activates on its own.",
    seasonTitles: "Titles this season", totalTitles: "Career titles", events: "Events played", wins: "Series won", losses: "Series lost", games: "Games W–L", goals: "Goals scored / conceded", winRate: "Series win rate", podiums: "Podiums",
    calendarPlan: "Plan your season", calendarHint: "Choose a month, then select a day for its schedule and actions.", calendarOverview: "Season progress", calendarLegend: "Calendar key",
    sundayQualified: "Championship Sunday secured", majorChampion: "Major champions", worldsChampion: "World champions",
    rocketStreet: "Rocket Street",
  },

  // T1 (v2.0): the guided tour. A chapter is shown on the first visit and
  // reopened by the help button. Each step spotlights a real element
  // (`data-tour`), so a body says what the player does there, in one or two lines.
  // rc.54: chapters for the HQ, Squad, Training and Finances only (Calendar,
  // Market, Standings, Inbox and Club have no tour).
  tour: {
    kicker: "Road to Worlds",
    next: "Next",
    back: "Back",
    skip: "Skip",
    done: "Got it",
    progress: (n: number, total: number) => `${n} of ${total}`,
    help: "Guide to this screen",
    beta: {
      title: "Road to Worlds is in beta",
      body: "The career mode is playable from the first qualifier to the World Championship. Balance and prices are still changing.",
      feedback: "Tell us on Discord what feels off.",
      discord: "Join the Discord",
      close: "Start my career",
    },
    hub: {
      welcome: {
        title: "Welcome to Road to Worlds",
        body: "You run an org from its first roster to the World Championship.",
        points: [
          { label: "Squad", text: "Sign, train and renew" },
          { label: "Cash", text: "Wages go out every Monday" },
          { label: "Season Points", text: "They take you to Majors and Worlds" },
        ],
      },
      tabs: {
        title: "One tab per area of the club",
        body: "",
        items: {
          hub: "Today and decisions",
          calendar: "Events and cups",
          squad: "Lineup and contracts",
          training: "How the team grows",
          market: "Players and coaches",
          finances: "Cash and sponsors",
          standings: "The race to Worlds",
          news: "Offers and notices",
          club: "Trophies and progress",
          board: "The board's targets", // rc9 HQ
        } as Record<string, string>,
      },
      advance: {
        title: "You move the clock",
        body: "Time passes only when you advance. The game stops when something needs you.",
        points: [
          { label: "Play", text: "Day by day, up to the next stop" },
          { label: "Skip ahead", text: "Straight to the next stop" },
        ],
      },
      day: {
        title: "Today's card",
        body: "Whatever needs a decision today shows up here: an offer, a sponsor, an event.",
      },
      inbox: {
        title: "Inbox",
        body: "Bids, bank notices and invitations arrive by mail. Open the ones that ask for an answer.",
      },
      finances: {
        title: "Keep an eye on the cash",
        body: "Prizes and sponsors bring money in, wages take it out every Monday. If the balance sinks too far, the bank lends with a deadline.",
      },
      progress: {
        title: "Progression",
        body: "Results raise your reputation. Reputation unlocks the coach, better sponsors and new facilities.",
      },
    },
    training: {
      cycle: {
        title: "Pick the cycle",
        body: "Every 14 days you choose what the squad works on.",
        points: [
          { label: "Evolve", text: "Attributes grow faster" },
          { label: "Gel", text: "Chemistry builds faster" },
          { label: "Recover", text: "Less wear, veterans hold their level" },
        ],
      },
      coach: {
        title: "The coach",
        body: "With a coach the plan comes ready and training pays more. Without one, you set each cycle yourself.",
      },
      growth: {
        title: "Watch them grow",
        body: "See who is still improving, who is at his peak and who is past it, before you renew or sell.",
      },
    },
    finances: {
      overview: {
        title: "Your money at a glance",
        body: "The balance over time, and what each Monday brings in and takes out.",
      },
      sponsor: {
        title: "Sponsors",
        body: "A deal pays a guaranteed base plus a bonus for each goal you reach. Safer deals pay less; bold ones fine a miss.",
      },
      loans: {
        title: "Loans and the floor",
        body: "Borrow when you choose. Below the floor on a Monday, the bank lends with a deadline; missing it ends the career.",
      },
      progress: {
        title: "Invest in the org",
        body: "Gear, staff and bootcamps make the squad grow and play better. Each step unlocks with reputation.",
      },
    },
    squad: {
      starters: {
        title: "Your three starters",
        body: "They play every series. Open a player to see his attributes, contract and options.",
      },
      bench: {
        title: "Reserve and coach",
        body: "The reserve steps in when a starter cannot play. Without one, the team misses that event.",
      },
      contracts: {
        title: "Contracts",
        body: "Renew before the season ends, or the player leaves for free.",
      },
    },
  },

  /** v2.2 Pro slice 2: the week, ranked and the growth log (docs/PRO-SPEC.md §5, §7.1). */
  proWeek: {
    title: "This week",
    openWeek: "Plan the week",
    kicker: "Three blocks: Monday and Tuesday, Wednesday and Thursday, Friday. The weekend is for events.",
    blockNames: ["Mon-Tue", "Wed-Thu", "Fri"] as string[],
    activity: {
      train: "Train",
      ranked: "Ranked",
      scrim: "Scrim",
      content: "Content",
      rest: "Rest",
    } as Record<string, string>,
    activityHint: {
      train: "Points on one attribute. Costs 20 energy.",
      ranked: "Climbs or drops your MMR and gives a little XP. Costs 15 energy.",
      scrim: "Experience and chemistry with your team. Costs 15 energy.",
      content: "Money and fans. Costs 10 energy.",
      rest: "Gives back 35 energy.",
    } as Record<string, string>,
    focus: "Focus",
    focusBalanced: "Balanced",
    needsTeam: "You need a team to scrim.",
    burnedOutBlock: "Out this week: every block counts as rest.",
    energy: "Energy",
    energyTrace: (values: number[]) => `${values.slice(0, -1).join(" → ")}, then ${values[values.length - 1]} after the weekend`,
    energyTraceLabel: "Energy after each block and after the week",
    projected: {
      gain: (stat: string, n: number) => `${stat} +${n.toFixed(2)}`,
      none: "No attribute change",
      allStats: (n: number) => `Every attribute +${n.toFixed(2)}`,
      mmr: (n: number) => `Expected ${n >= 0 ? "+" : ""}${n} MMR`,
      money: (n: number) => `+${n} money`,
      fame: (n: number) => `+${n} fans`,
      chemistry: (n: number) => `+${n} chemistry`,
      energy: (n: number) => `${n} energy left`,
    },
    warn: {
      tired: (n: number) => `This plan ends the week at ${n} energy. A week that ends under 30 after a warning can end in burnout.`,
      warning: (n: number) => `This plan ends the week at ${n} energy, under the line where the burnout warning shows. Burnout can only come a week after the warning.`,
      ok: (n: number) => `This plan ends the week at ${n} energy.`,
      burnedOut: "You are burned out. This week is rest, and you come back with energy.",
    },
    shortcuts: {
      coach: "Coach's plan",
      repeat: "Repeat last week",
      coachHint: "Rests when you are tired, trains your weakest attributes, and ranked (or a scrim with a team) in the middle.",
    },
    play: "Play the week",
    result: {
      title: "Last week",
      energy: "Energy through the week",
      noGrowth: "No attribute moved.",
    },
    notes: {
      tiredTraining: (n?: number) => `You trained at ${n ?? 0} energy, so the block gave less.`,
      lowEnergy: (n?: number) => `You played at ${n ?? 0} energy, which hurts your form.`,
      burnoutWarning: (n?: number) => `Warning: the week ended at ${n ?? 0} energy. Another week this low can end in burnout. Rest to clear it.`,
      burnedOut: (n?: number) => `Burnout. You are out for ${n ?? 1} ${n === 1 ? "week" : "weeks"}.`,
      stillBurnedOut: () => "Still out: the blocks counted as rest.",
      backFromBurnout: (n?: number) => `Back from burnout with ${n ?? 0} energy.`,
      scrimNeedsTeam: () => "The scrim did not happen: you have no team yet.",
      rankedResult: (n?: number) => `Ranked: ${(n ?? 0) >= 0 ? "+" : ""}${n ?? 0} MMR.`,
      rankUp: (_n?: number, ref?: string) => `Ranked up to ${ref ?? ""}.`,
      rankDown: (_n?: number, ref?: string) => `Dropped to ${ref ?? ""}.`,
      mechanicUnlocked: (_n?: number, ref?: string) => `New mechanic: ${ref ?? ""}.`,
      contentPaid: (n?: number) => `Content paid ${n ?? 0}.`,
    } as Record<string, (n?: number, ref?: string) => string>,
    ranked: {
      title: "Ranked",
      mmr: "MMR",
      division: (label: string, d: number) => (d > 0 ? `${label} ${"I".repeat(d)}` : label),
      toNext: (n: number, label: string) => `${n} MMR to ${label}`,
      top: "Top of the ladder",
      sessions: "Last sessions",
      noSessions: "No ranked session yet.",
      session: (wins: number, games: number, delta: number) => `${wins} of ${games} won, ${delta >= 0 ? "+" : ""}${delta} MMR`,
      cupsLocked: (rank: string) => `Reach ${rank} and the community cups send you an invitation.`,
      cupsOpen: "Invitations to the community cups are open.",
      grandChampion: "Grand Champion",
    },
    log: {
      title: "Why your overall moved",
      empty: "Nothing has moved yet. Train, play ranked or play a match and the reason shows up here.",
      source: {
        training: "Training",
        ranked: "Ranked",
        scrim: "Scrim",
        match: "Match",
        age: "Age",
      } as Record<string, string>,
      line: (stat: string, delta: number) => `${stat} ${delta > 0 ? "+" : ""}${delta.toFixed(2)}`,
      day: (season: number, week: number) => `Season ${season + 1}, week ${week}`,
      /** Why an attribute fell with age (the reason key on an "age" entry). */
      reasons: {
        reflexes: "Your reflexes are starting to go.",
        pace: "You are a step slower to the ball.",
        reactions: "Your reaction time on defense is slipping.",
        stamina: "Long series cost more than they used to.",
        nerve: "Big moments take a little more out of you.",
        reads: "Your read of the game slips, slowly.",
      } as Record<string, string>,
    },
    form: {
      confidence: "Confidence",
      words: ["Shaken", "Low", "Steady", "Sharp", "On form"] as string[],
      bonus: (n: string) => `${n} on your match ratings`,
      confidenceHint: "From your last five match ratings. It helps your ranked games and your calls in a match.",
    },
  },

  /** v2.2 Pro slice 5: the decision of a game and the signature mechanics (docs/PRO-SPEC.md §4.2, §6). */
  proMoments: {
    title: "Your call",
    kicker: "One call a game. The word beside each option says how likely it is to work for you right now; the line under the name is the attribute it tests. A locked call is a mechanic you have not unlocked yet.",
    moment: {
      decider: "The decider",
      overtimeWinner: "Overtime",
      lateGoal: "Late in the game",
      comeback: "Chasing the game",
      cleanSheet: "Holding the lead",
      saveMarathon: "Under pressure",
      hatTrick: "On a run",
      demoBlitz: "Winning the physical game",
    } as Record<string, string>,
    calls: {
      holdForSupport: "Hold for support",
      takeTheShot: "Take the shot",
      stayBack: "Stay back and hold the line",
      challengeEarly: "Challenge early",
      resetPlay: "Reset the play",
      keepPushing: "Keep pushing",
      wavedash: "Wavedash",
      speedflip: "Speedflip",
      airDribble: "Air dribble",
      ceilingShot: "Ceiling shot",
      doubleTap: "Double tap",
      mustyFlick: "Musty flick",
      flipReset: "Flip reset",
    } as Record<string, string>,
    hints: { risky: "Risky", uncertain: "Uncertain", likely: "Likely", mastered: "You own this" } as Record<string, string>,
    locked: "Not unlocked yet",
    instinct: "On instinct",
    instinctHint: "Your style makes the call. It does not help you and it does not hurt you.",
    result: {
      success: (call: string) => `${call} came off.`,
      miss: (call: string) => `${call} did not work.`,
      instinct: (call: string) => `On instinct you went for: ${call}.`,
      team: (n: number) => `Team rating this game ${n >= 0 ? "+" : ""}${n.toFixed(2)}`,
      own: (n: number) => `Your rating ${n >= 0 ? "+" : ""}${n.toFixed(2)}`,
    },
    mechanics: {
      title: "Signature mechanics",
      owned: "Unlocked",
      next: (name: string, blocks: number, mech: number) =>
        blocks > 0 && mech > 0
          ? `Next: ${name}. It needs ${blocks} more training blocks on Mechanics and ${mech} more points of Mechanics.`
          : blocks > 0
            ? `Next: ${name}. It needs ${blocks} more training blocks on Mechanics.`
            : mech > 0
              ? `Next: ${name}. It needs ${mech} more points of Mechanics.`
              : `Next: ${name}. One more Mechanics training block.`,
      all: "Every signature mechanic is unlocked.",
    },
  },

  /** v2.2 Pro slice 6: the final card page (docs/PRO-SPEC.md §9). */
  proCard: {
    kicker: "Pro career card",
    gala: {
      kinds: { mvp: "MVP", breakout: "Breakout player", teamOfSeason: "Team of the season", mostDecisive: "Most decisive player" } as Record<string, string>,
      scopes: { region: "Regional", world: "World" } as Record<string, string>,
      line: (scope: string, kind: string, year: number) => `${scope} ${kind} ${year}`,
      winner: (award: string) => `You won: ${award}.`,
      nominee: (award: string) => `You were named a nominee: ${award}.`,
    },
    nicknames: {
      theWall: "The Wall",
      mrLan: "Mr. LAN",
      theCloser: "The Closer",
      iceCold: "Ice Cold",
      theChamp: "The Champ",
      oneClub: "One-Club Player",
      theMaestro: "The Maestro",
      theFinisher: "The Finisher",
      theBulldozer: "The Bulldozer",
      comebackKid: "Comeback Kid",
      mrSteady: "Mr. Steady",
      theProdigy: "The Prodigy",
    } as Record<string, string>,
    nicknameWhy: {
      theWall: (n: number) => `${n} saves in your career.`,
      mrLan: (n: number) => `${n} LAN titles.`,
      theCloser: (n: number) => `${n} series won in the deciding game.`,
      iceCold: (n: number) => `${n} games rated high in clutch moments.`,
      theChamp: () => "A Worlds title.",
      oneClub: (n: number) => `${n} seasons with the same org.`,
      theMaestro: (n: number) => `${n} assists in your career.`,
      theFinisher: (n: number) => `${n} goals in your career.`,
      theBulldozer: (n: number) => `${n} demolitions in your career.`,
      comebackKid: (n: number) => `${n} series won after trailing.`,
      mrSteady: (n: number) => `${n} seasons with a high average rating.`,
      theProdigy: () => "Signed by an org at 15 or younger.",
    } as Record<string, (n: number) => string>,
    peak: "Peak overall",
    seasons: (n: number) => `${n} ${n === 1 ? "season" : "seasons"}`,
    orgs: "Orgs",
    titles: "Titles",
    awards: "Awards",
    bestRating: "Best season rating",
    none: "None yet",
    nickname: "Known as",
    legends: {
      title: "Among the real players",
      between: (peak: string, above: string, below: string) => `A peak overall of ${peak} sits between ${above} and ${below} in the all-time ranking of best cards.`,
      below: (peak: string, name: string) => `A peak overall of ${peak} sits just under ${name} in the all-time ranking of best cards.`,
      above: (peak: string, name: string) => `A peak overall of ${peak} is above every real player's best card, just over ${name}.`,
      place: (n: number, of: number) => `Place ${n} of ${of}`,
      loading: "Reading the ranking...",
    },
    download: "Download image",
    share: "Share",
    copyLink: "Copy link",
    copied: "Link copied",
    shareText: (name: string) => `${name}'s Pro career in Rocket Draft`,
    invalidTitle: "This card cannot be read",
    invalidBody: "The link is incomplete or was edited. Ask for the link again, or start your own career.",
    start: "Start a Pro career",
    own: "Share my card",
  },

  /** v2.2 Pro, the player career (docs/PRO-SPEC.md, R150). Staging only (FEATURES.proCareer). */
  pro: {
    door: {
      title: "Pro: player career",
      body: "Be the player. Start at 13 or 14 in ranked and climb through the amateur scene to the Worlds.",
      cta: "Start a Pro career",
      managerCareers: "Manager careers",
    },
    saves: {
      title: "Pro careers",
      kicker: "Player careers live beside your manager careers: three slots each.",
      empty: "Create a player",
      resume: "Resume",
      delete: "Delete",
      deleteConfirm: (name: string) => `Delete ${name}'s career? Permanent and local.`,
      slotsFull: "All three Pro slots are taken.",
      newCareer: "New Pro career",
      season: (n: number) => `Season ${n}`,
    },
    wizard: {
      title: "Create your player",
      kicker: "No fixed ceiling: how far you go depends on how you train, rest and play.",
      name: "Nickname",
      namePlaceholder: "Your name in the scene",
      nameLength: (min: number, max: number) => `${min}-${max} characters.`,
      country: "Country",
      region: "Region",
      regionHint: "Where you play ranked and your first cups.",
      age: "Starting age",
      ageHint: "The RLCS accepts players from 13. Starting at 13 gives you one more year before the orgs look.",
      ageOption: (n: number) => `${n} years old`,
      style: "Style",
      styleHint: "Your two strongest attributes at the start. Training decides the rest.",
      difficulty: "Difficulty",
      difficultyHint: "Harder means tougher offers and a harder fight for a starting spot, never a weaker player.",
      create: "Create player",
    },
    player: {
      age: (n: number) => `Age ${n}`,
      overall: "Overall",
      attributes: "Attributes",
      noCeiling: "There is no ceiling to discover. Training, rest, the team you play for and how you play decide how far you go.",
      stage: {
        ranked: "Ranked",
        amateur: "Amateur side",
        org: "Signed",
        freeAgent: "Free agent",
        retired: "Retired",
      } as Record<string, string>,
      energy: "Energy",
      fans: "Fans",
      money: "Money",
      mmr: "MMR",
      unranked: "Unranked",
      nextTitle: "What comes next",
      nextBody: "The career screen runs your calendar, matches and offers. The week screen sets your training and shows why your attributes moved.",
      openCareer: "Open career",
      allCareers: "All Pro careers",
    },
  },
  // v2.2 board front: taking over a real org, the board, its objectives, confidence and job offers.
  board: {
    title: "Board",
    // rc.6 (ORGMODE UI-B): a founded club answers to its owners through the same pieces.
    ownersTitle: "Owners",
    ownersConfidence: "Owners' confidence",
    stature: { elite: "Elite", contender: "Contender", mid: "Mid-table", underdog: "Underdog", owners: "Owners" } as Record<string, string>,
    statureNote: {
      elite: "Money and stars, little patience.",
      contender: "A strong squad, a demanding board.",
      mid: "Room to grow, a fair board.",
      underdog: "Less money, more time.",
      owners: "Your own club: the owners give you time.",
    } as Record<string, string>,
    packages: {
      title: "The season plan",
      body: "Choose one of three plans. The budget is paid when you accept.",
      ownersBody: "Choose one of three plans. The owners pay the budget when you accept.",
      name: { cautious: "Cautious", expected: "Expected", ambitious: "Ambitious" } as Record<string, string>,
      band: (key: string) => BOARD_BANDS_EN[key] ?? key,
      budget: (amount: string) => `Budget ${amount}`,
      bonus: (amount: string) => `Bonus ${amount} if met`,
      swing: (hit: number, miss: number) => `Confidence +${hit} if met, −${Math.abs(miss)} if missed`,
      accept: "Accept",
      acceptPlan: (name: string) => `Accept the ${name.toLowerCase()} plan`,
      recommended: "The board's proposal",
      ownersRecommended: "The owners' proposal",
      budgetLabel: "Budget",
      bonusLabel: "Bonus if met",
      hitLabel: "if met",
      missLabel: "if missed",
      confidenceLabel: "Confidence",
      plan: (name: string) => `${name} plan`,
    },
    confidence: "Board confidence",
    confidenceOf: (n: number) => `${n} / 100`,
    verdict: {
      title: "The board's verdict",
      met: (goal: string) => `Objective met: ${goal}.`,
      missed: (goal: string) => `Objective missed: ${goal}.`,
      confidence: (n: number) => `Board confidence ends the season at ${n} / 100.`,
      tier: (up: boolean, tier: string) => (up ? `Standing: up to ${tier}.` : `Standing: down to ${tier}.`),
      open: "Open the board",
      confidenceLabel: "Confidence at the review",
      tierUp: "Promoted",
      tierDown: "Relegated",
      tierNote: (up: boolean): string =>
        up ? "The budget base and the wage ceiling rise next season, and so does the board's ask." : "The budget base and the wage ceiling fall next season, and the board eases its ask.",
    },
    band: (n: number): string => (n >= 80 ? "Strong" : n >= 40 ? "Steady" : n >= 25 ? "Under pressure" : "Critical"),
    lines: (warn: number, ultimatum: number) => `Below ${warn} the board warns you. Below ${ultimatum}, after a warning, it sets an ultimatum.`,
    log: "Why it moved",
    logEmpty: "No change yet this season.",
    // rc.6 (ORGMODE UI-B): the Board page, the HQ figure.
    warnLine: (n: number) => `Warning ${n}`,
    ultimatumLine: (n: number) => `Ultimatum ${n}`,
    logWhen: (season: number, week: number) => `S${season} · W${week}`,
    outOf: "/ 100",
    progressOf: (done: number, target: number) => `${done} of ${target}`,
    bandStart: "At the start",
    bandNowLabel: "Now",
    bandSame: "Unchanged since the start",
    planTerms: (bonus: string, hit: number, miss: number) => `Bonus ${bonus} if met. Confidence +${hit} if met, −${Math.abs(miss)} if missed.`,
    alsoAsked: "Also asked",
    alsoNote: "These move confidence too, by less.",
    managerTitle: "The manager",
    contractLabel: "Contract through",
    contractValue: (season: number) => `Season ${season}`,
    reputationLabel: "Reputation",
    clubsLabel: "Clubs managed",
    money: {
      title: "The season's money",
      allocation: "Board's budget",
      ownersAllocation: "Owners' budget",
      notYet: "Paid when you choose the plan",
      notYetMandate: "Paid when you read the mandate",
      wages: "Wages / week",
      ceiling: (amount: string) => `Ceiling ${amount}`,
      over: "Over the board's ceiling",
      projected: "Projected end",
      projectedNote: (amount: string) => `${amount} with the bonus`,
      open: "Open Finances",
    },
    glance: {
      title: "Board",
      ownersTitle: "Owners",
      progress: (done: number, target: number) => `Objective ${done} of ${target}`,
      pending: "Choose the season plan",
      pendingMandate: "Read the board's mandate",
      ultimatum: "Ultimatum open",
      met: "Objective met",
      missed: "Objective missed",
    },
    reasons: {
      managerPost: "Your post to the fans", // rc9 STORIES
      objectiveMet: "Season objective met",
      objectiveMissed: "Season objective missed",
      objectiveOut: "Season objective out of reach",
      onTrack: "Checkpoint: on track",
      behind: "Checkpoint: behind",
      secondaryMet: "Secondary objective met",
      secondaryMissed: "Secondary objective missed",
      legacyMet: "Legacy objective met",
      titleMajor: "Major title",
      titleWorlds: "Worlds title",
      debt: "Deep debt",
      ultimatumMet: "Ultimatum answered",
      newSeason: "New season: the board eases its view",
      promoted: "Promoted a tier",
      mandateMoneyMet: "Money goal met",
      mandateMoneyMissed: "Money goal missed",
      mandateSquadMet: "Squad goal met",
      mandateSquadMissed: "Squad goal missed",
    } as Record<string, string>,
    objectives: "This season's objectives",
    sporting: "Season objective",
    secondary: "Secondary",
    legacy: "Legacy",
    legacyNote: "No penalty if missed.",
    secondaryLabel: (kind: string, value: string): string => {
      switch (kind) {
        case "balance":
          return "End the season with a positive balance";
        case "wages":
          return `Keep the wage bill under ${value} a week`;
        case "youth":
          return `Start a player under ${value} at the season's end`;
        case "homeCore":
          return `Reach a Major with ${value} home-region starters`;
        default:
          return "";
      }
    },
    bandWord: (key: string) => BOARD_BANDS_EN[key] ?? key,
    likely: (key: string) => `${BOARD_BANDS_EN[key] ?? key} at the season's start`,
    bandNow: (key: string) => `Now: ${(BOARD_BANDS_EN[key] ?? key).toLowerCase()}`,
    budgetLine: (mult: number) => `Next season's budget: ×${mult.toFixed(2)}`,
    contract: (season: number) => `Contract until season ${season}`,
    protectedUntil: (season: number) => `Title protection through season ${season}: losses halved, no ultimatum.`,
    freeze: "Hiring freeze: no signings in this window.",
    ultimatum: {
      title: "Ultimatum",
      body: "The board wants this by the end of the season. If it is not met, you leave the club at the season review.",
      progress: (done: number, target: number) => `${done} of ${target}`,
      chance: (key: string) => `${BOARD_BANDS_EN[key] ?? key} when set.`,
      met: "Answered. The board backs you again.",
    },
    dismissed: {
      title: "You have been dismissed",
      body: (org: string) => `${org} ends your contract at the season's end. Your record stays with you. Pick your next job to continue.`,
      offers: "Job offers",
      found: "Found a new club",
      foundBody: (name: string) => `Start ${name} in your home region with three free agents and the founding budget.`,
      accept: "Accept",
      accepted: (org: string) => `You start at ${org} next season.`,
      orgsLabel: "Organizations that want you",
      orLabel: "Or start again",
      rankLine: (rank: number) => `Squad #${rank} in the region`,
    },
    approach: {
      title: "An approach",
      body: (org: string) => `${org} want you as their manager next season. Your current club would continue without you.`,
      accept: "Accept the job",
      decline: "Stay",
    },
    managerRep: "Manager reputation",
    spells: "Career",
    spell: (org: string, from: number, to: string) => `${org}: season ${from + 1} to ${to}`,
    now: "now",
    openBoard: "Open the board",
    boardFreezeError: "The board froze hiring for this window.",
    wageBill: "Wage bill / week",
    upgrade: {
      title: "The board funds an upgrade",
      body: "Confidence is high, so the board pays for one upgrade of your choice. It is paid in full; a staff role is paid for one season.",
      pick: "Fund it",
      taken: (name: string) => `Funded by the board: ${name}.`,
    },
    // rc.6 (ORGMODE E1/E2/E4): an established org's Standing, the board's brief and its sign-off.
    standing: {
      title: "Standing",
      tier: { elite: "Elite", contender: "Contender", mid: "Mid-table", underdog: "Underdog" } as Record<string, string>,
      phrase: { elite: "an elite org", contender: "a contender", mid: "a mid-table org", underdog: "an underdog" } as Record<string, string>,
    },
    brief: {
      heading: "The board's brief",
      takeover: (p: { org: string; tier: string; goal?: string }) => `You take over ${p.org}, ${p.tier}. The board sets this first season on the squad you inherit.`,
      met: (p: { org: string; tier: string; goal?: string }) => `Last season's objective was met${p.goal ? ` (${p.goal})` : ""}. The board builds on it and expects ${p.org} to hold that level.`,
      missed: (p: { org: string; tier: string; goal?: string }) => `Last season's objective was missed${p.goal ? ` (${p.goal})` : ""}. The board wants that ground back this season.`,
      title: (p: { org: string; tier: string; goal?: string }) => `A title last season raised the bar at ${p.org}. The board now plans as ${p.tier} that wins.`,
      promoted: (p: { org: string; tier: string; goal?: string }) => `${p.org} moved up a tier at the review and now plan as ${p.tier}. The ask rises with it.`,
      relegated: (p: { org: string; tier: string; goal?: string }) => `${p.org} dropped a tier at the review and now plan as ${p.tier}. The board resets its ask to rebuild.`,
      ultimatumSurvived: (p: { org: string; tier: string; goal?: string }) => `You answered the board's ultimatum last season. ${p.org} keep you on and ask for steady progress.`,
      lastRank: (n: number) => `Last season: #${n} in the region.`,
      bestFinish: (tier: string, place: number) => `Best finish last season: ${place <= 1 ? "won" : `top ${place}`} at ${tier === "worlds" ? "Worlds" : tier === "major" ? "a Major" : "a regional"}.`,
    },
    // v2.2 MANDATE (ORGMODE 2027 stage 2): an established org's season mandate, the house's problems, the demand level.
    mandate: {
      title: "The board's mandate",
      season: (season: string) => `${season} · set by the board`,
      body: "The board sets three goals for the season.",
      goalLabel: "Goal", // rc9 ORG-UI: the goal table's first column
      demandLabel: "Demand",
      demand: { low: "Low", medium: "Medium", high: "High" } as Record<string, string>,
      demandNote: {
        low: "The board gives you time to build.",
        medium: "The board expects steady progress.",
        high: "The board expects to win, and soon.",
      } as Record<string, string>,
      demandLine: (level: string) => `${({ low: "Low", medium: "Medium", high: "High" } as Record<string, string>)[level] ?? level} demand`,
      area: { classification: "Classification", money: "Money", squad: "Squad" } as Record<string, string>,
      weighsMost: "Weighs most",
      gainLabel: "If met",
      lossLabel: "If missed",
      confidenceUnit: "confidence",
      budgetUnit: "next season's budget",
      bonusUnit: "bonus",
      noChange: "Nothing changes",
      money: (kind: string, amount: string, week: number): string => {
        switch (kind) {
          case "cashFloor":
            return `End the season with at least ${amount} in the bank`;
          case "wagesUnder":
            return `Bring the wage bill to ${amount} a week by week ${week}`;
          case "netSpend":
            return `Keep net transfer spending within ${amount}`;
          case "sales":
            return `Raise ${amount} in player sales`;
          default:
            return "";
        }
      },
      squad: (kind: string, value: number, names: string[]): string => {
        switch (kind) {
          case "signStarter":
            return `Sign a starter rated ${value} or better`;
          case "renew":
            return `Renew ${names[0] ?? "the starter"}'s contract`;
          case "ageUnder":
            return `Bring the starters' average age to ${value} or under`;
          case "youthEvents":
            return `Start ${names[0] ?? "the prospect"} at ${value} official events`;
          case "keepCore":
            return `Keep ${joinEn(names)} through the season`;
          default:
            return "";
        }
      },
      moneyNow: (kind: string, now: string): string =>
        kind === "cashFloor" ? `${now} in the bank now` : kind === "wagesUnder" ? `${now} a week now` : kind === "netSpend" ? `${now} spent net so far` : `${now} raised so far`,
      squadNow: (kind: string, now: number, target: number): string => {
        switch (kind) {
          case "signStarter":
            return now > 0 ? `Best new starter: ${now}` : "No new starter yet";
          case "renew":
            return now > 0 ? "Renewed" : "Not renewed yet";
          case "ageUnder":
            return `Average ${now} now`;
          case "youthEvents":
            return `${now} of ${target} events`;
          case "keepCore":
            return `${now} of ${target} still at the club`;
          default:
            return "";
        }
      },
      because: (issue: string) => `Because: ${issue.toLowerCase()}`,
      onTrack: "On track",
      behind: "Behind",
      issuesNow: "What needs fixing",
      noIssues: "Nothing pressing: the house is in order.",
      issue: {
        dealsEnding: "A deal runs out",
        wageBill: "Wages at the ceiling",
        shortCash: "Short of cash",
        weakLink: "A weak link",
        agingCore: "An ageing core",
        lowChemistry: "No chemistry yet",
        noCoach: "No head coach",
        costlyBench: "A costly bench",
        noReserve: "No reserve",
        sponsorEnding: "The sponsor deal ends",
        prospectBenched: "A prospect on the bench",
        noSponsor: "No sponsor",
        dealsSoon: "Deals end next season",
        wageRoom: "Little wage room",
      } as Record<string, string>,
      issueLine: (kind: string, value: number, name?: string): string => {
        switch (kind) {
          case "dealsEnding":
            return `${name ?? "A starter"}'s contract ends this season${value > 1 ? `, and ${value - 1} more` : ""}.`;
          case "wageBill":
            return `The wage bill is at ${value}% of the board's ceiling.`;
          case "shortCash":
            return `Cash covers ${value} weeks of running costs.`;
          case "weakLink":
            return `${name ?? "One starter"} is ${value} points under the other two starters.`;
          case "agingCore":
            return `The starters average ${value} years of age.`;
          case "lowChemistry":
            return `The starting three are at ${value}% chemistry.`;
          case "noCoach":
            return "Nobody runs the squad's training.";
          case "costlyBench":
            return `${name ?? "The reserve"} earns ${value}% of a starter's wage from the bench.`;
          case "noReserve":
            return "Nobody on the bench: an absent starter leaves a seat empty.";
          case "sponsorEnding":
            return "The sponsor's deal runs out this season.";
          case "prospectBenched":
            return `${name ?? "A prospect"} (${value}) is outside the starting three.`;
          case "noSponsor":
            return "No sponsor is under contract yet.";
          case "dealsSoon":
            return `${name ?? "A starter"}'s contract ends next season${value > 1 ? `, and ${value - 1} more` : ""}.`;
          case "wageRoom":
            return `The wage bill is at ${value}% of the ceiling.`;
          default:
            return "";
        }
      },
      lastTitle: "Last season",
      demandUp: "The demand rose with the org's tier.",
      demandDown: "The demand eased with the org's tier.",
      accept: "Start the season",
      reread: "Read the mandate",
      keptNote: "The mandate stays on the Board page and in the inbox.",
      pending: "The board's mandate is on your desk: read it to start the season.",
      metOf: (n: number, total: number) => `${n} of ${total} met`,
      dossierTitle: "What the board will ask",
      dossierNote: "Set at the takeover from the org as it is. You will not choose it.",
    },
    // rc.6 (R172): HQ's season goal while an established org's plan is pending.
    planPending: "The board's season plan is waiting for your answer. The season goal is the plan you accept.",
    planOpen: "Open the season plan",
    // rc.6: a market row above an established org's signing pull.
    signCapLock: (cap: number) => `Above this org's pull: it signs up to ${cap}`,
    approval: {
      boardApproval: (n: number) => `The board will not fund this while its confidence is under ${n}.`,
      boardFlagship: (n: number) => `The board funds the performance centre only with confidence at ${n} or more.`,
      boardFrozen: "The board froze capital spending for this window.",
      needs: (n: number) => `Needs the board's sign-off: confidence ${n}`,
    },
    mail: {
      tpl: {
        boardPackage: () => "The board's offer for the season",
        boardWelcome: (p: Record<string, string | number>) => `Welcome to ${p.org}`,
        boardMandate: (p: Record<string, string | number>) => `The board's mandate for season ${p.season}`,
        boardMandateReport: (p: Record<string, string | number>) => `Board report after split ${p.split}`,
        boardMandateVerdict: () => "The board's verdict on the mandate",
        boardCheckpoint: (p: Record<string, string | number>) => `Board review after split ${p.split}`,
        boardWarning: () => "A warning from the board",
        boardUltimatum: () => "Ultimatum from the board",
        boardUltimatumMet: () => "The board backs you again",
        boardDismissed: (p: Record<string, string | number>) => `${p.org} dismiss their manager`,
        boardHighConfidence: () => "The board extends your contract",
        boardFreeze: () => "Hiring freeze",
        boardVerdict: () => "The board's season verdict",
        boardApproach: (p: Record<string, string | number>) => `${p.org} make an approach`,
        boardNewJob: (p: Record<string, string | number>) => `Welcome to ${p.org}`,
        boardUpgrade: () => "The board will fund an upgrade",
        boardTierUp: (p: Record<string, string | number>) => `${p.org} move up a tier`,
        boardTierDown: (p: Record<string, string | number>) => `${p.org} drop a tier`,
        // rc9 org (R222, R221): the owner's letter on a tier change; the deal in force on the takeover day.
        ownerTierUp: () => "Where we stand now",
        ownerTierDown: () => "Where we stand now",
        sponsorInherited: (p: Record<string, string | number>) => `${p.name}: the deal you inherit`,
        orgTierUp: (p: Record<string, string | number>) => `${p.org} rise to the ${({ elite: "elite", contender: "contender", mid: "mid-table", underdog: "underdog" } as Record<string, string>)[String(p.to)] ?? p.to} tier`,
        orgTierDown: (p: Record<string, string | number>) => `${p.org} drop to the ${({ elite: "elite", contender: "contender", mid: "mid-table", underdog: "underdog" } as Record<string, string>)[String(p.to)] ?? p.to} tier`,
      } as Record<string, (p: Record<string, string | number>) => string>,
      body: {
        boardPackage: () => "Three packages are on your desk: cautious, expected and ambitious. More ambition brings more budget and a bigger bonus, and costs more confidence if the objective is missed.",
        boardWelcome: (p: Record<string, string | number>) =>
          `${p.manager}, welcome to ${p.org}.${Number(p.seasons) === 1 ? ` The org is new to the RLCS: its first roster dates from ${p.since}.` : ""}${Number(p.seasons) > 1 ? ` The org has played ${p.seasons} RLCS seasons, the first in ${p.since}${Number(p.top) > 0 ? `, ${p.top} of them among its region's strongest sides` : ""}.` : ""} You take over ${({ elite: "an elite org", contender: "a contender", mid: "a mid-table org", underdog: "an underdog" } as Record<string, string>)[String(p.tier)] ?? "the org"}. The board's mandate for the season is on your desk.`,
        boardMandate: (p: Record<string, string | number>) =>
          `${p.demandWord}. Classification: ${p.cls}${swingEn(p.clsHit, p.clsMiss)}. Money: ${p.money}${swingEn(p.moneyHit, p.moneyMiss)}. Squad: ${p.squad}${swingEn(p.squadHit, p.squadMiss)}. The budget steps and bonuses are on the Board page.`,
        boardMandateReport: (p: Record<string, string | number>) =>
          `Classification: ${p.cls}, ${p.clsDone} of ${p.clsTarget} (${Number(p.clsOk) === 1 ? "met" : Number(p.clsOk) === 0 ? "out of reach" : "open"}). Money: ${p.money} (${Number(p.moneyOk) ? "on track" : "behind"}). Squad: ${p.squad} (${Number(p.squadOk) ? "on track" : "behind"}). Board confidence ${Number(p.delta) > 0 ? `rose by ${p.delta} to` : Number(p.delta) < 0 ? `fell by ${Math.abs(Number(p.delta))} to` : "holds at"} ${p.confidence}.`,
        boardMandateVerdict: (p: Record<string, string | number>) =>
          `Classification ${Number(p.clsMet) ? "met" : "missed"}: ${p.cls}. Money ${Number(p.moneyMet) ? "met" : "missed"}: ${p.money}. Squad ${Number(p.squadMet) ? "met" : "missed"}: ${p.squad}. Board confidence ends the season at ${p.confidence}.`,
        boardCheckpoint: (p: Record<string, string | number>) =>
          `The board reviewed the split. Confidence ${Number(p.delta) >= 0 ? "rose" : "fell"} by ${Math.abs(Number(p.delta))} to ${p.confidence}.${p.band ? ` The season objective now reads as ${(BOARD_BANDS_EN[String(p.band)] ?? "").toLowerCase()}.` : ""}`,
        boardWarning: (p: Record<string, string | number>) =>
          `Board confidence is at ${p.confidence}. If it falls below ${p.line}, the board will set an ultimatum with a concrete mission.`,
        boardUltimatum: (p: Record<string, string | number>) =>
          `The board has set a mission for the rest of the season; it is on the Board page. The board rates it as ${(BOARD_BANDS_EN[String(p.band)] ?? "").toLowerCase()}. If it is not met by the season review, your contract ends there.`,
        boardUltimatumMet: (p: Record<string, string | number>) => `The mission is done. Confidence is back to ${p.confidence}.`,
        boardDismissed: (p: Record<string, string | number>) =>
          `${p.org} will not continue with you after this season. ${p.n} offers are waiting in the season review, one of them a new club of your own.`,
        boardHighConfidence: (p: Record<string, string | number>) =>
          `Confidence stands at ${p.confidence}. The board raises next season's budget and extends your contract to season ${p.until}.`,
        boardFreeze: (p: Record<string, string | number>) => `With confidence at ${p.confidence}, the board allows no signings in next season's first window.`,
        boardVerdict: (p: Record<string, string | number>) =>
          `The season objective was ${Number(p.met) ? "met" : "missed"}. Board confidence ends the season at ${p.confidence}.`,
        boardApproach: (p: Record<string, string | number>) =>
          `${p.org} (${p.region}) ask whether you would manage them next season. Answer in the season review.`,
        boardNewJob: (p: Record<string, string | number>) => `You take over ${p.org}. ${p.left} continue in the league without you.`,
        boardUpgrade: (p: Record<string, string | number>) => `With confidence at ${p.confidence}, the board will pay for one upgrade. Pick it on the Board page.`,
        boardTierUp: (p: Record<string, string | number>) =>
          `The org's standing lifts it to the ${({ elite: "elite", contender: "contender", mid: "mid-table", underdog: "underdog" } as Record<string, string>)[String(p.to)] ?? p.to} tier. The budget base and the wage ceiling rise with it, and so does the board's ask.`,
        boardTierDown: (p: Record<string, string | number>) =>
          `The org's standing drops it to the ${({ elite: "elite", contender: "contender", mid: "mid-table", underdog: "underdog" } as Record<string, string>)[String(p.to)] ?? p.to} tier. The budget base and the wage ceiling fall with it, and the board eases its ask.`,
        ownerTierUp: (p: Record<string, string | number>) =>
          `${p.manager}, I have just come out of the season review. ${OWNER_UP_EN[String(p.to)] ?? ""} Enjoy it for a day, then we go again.`,
        ownerTierDown: (p: Record<string, string | number>) =>
          `${p.manager}, the review is done and I will not dress it up. ${OWNER_DOWN_EN[String(p.to)] ?? ""} You still have my backing. Show me next season what this squad can do.`,
        sponsorInherited: (p: Record<string, string | number>) =>
          `${p.org} already play under a deal with ${p.name}. It was signed before you arrived and runs until week ${p.endWeek} of season ${p.endSeason}. It pays ${p.base} every Monday${p.bonus ? `, and ${p.bonus} if its goal is met` : ""}.${Number(p.fines) ? " Miss the goal and the brand charges a fine." : ""} The goal is on the Finances desk. When the deal ends, ${p.name} will talk to you about a renewal.`,
        orgTierUp: (p: Record<string, string | number>) => `${p.org} move up a tier in the scene after their season.`,
        orgTierDown: (p: Record<string, string | number>) => `${p.org} drop a tier in the scene after their season.`,
      } as Record<string, (p: Record<string, string | number>) => string>,
    },
  },
  /** v2.2 rc.6 (ORGMODE UI-A): the way in. The door, the pick, the dossier and the arrival. */
  takeover: {
    door: {
      title: "Start a manager career",
      kicker: "Build a club from nothing, or take the job at an organization that already exists.",
      found: {
        title: "Found a club",
        body: "Name it, draw its crest and sign three unknowns. The road runs from the amateur scene to Worlds.",
        action: "Found a club",
      },
      takeover: {
        title: "Take over an organization",
        body: "A real roster under contract, a coach, a budget and a board with a plan for every season.",
        action: "Choose an organization",
      },
      slotsFull: "All three career slots are taken. Delete one in Careers to start another.",
      openSaves: "Open Careers",
      savesHint: "Found a club or take over an organization",
    },
    pick: {
      title: "Take over an organization",
      kicker: (season: string) => `The organizations as they stand in ${season}. Pick one to read its file.`,
      regions: "Region",
      orgs: "Organizations",
      rank: (rank: number, teams: number) => `#${rank} of ${teams}`,
      empty: (season: string) => `No organization in this region can be taken over in ${season}.`,
      fewOrgs: (n: number) => (n === 1 ? "Only one organization in this region can be taken over." : `Only ${n} organizations in this region can be taken over.`),
      none: "Pick an organization from the list to read its file.",
      back: "Back",
      allOrgs: "All organizations",
      go: (org: string) => `Take over ${org}`,
      goShort: "Take over",
      /** v2.2 ORGMODE-2027: an org back from its last lineup to complete the region. */
      returning: (season: string) => `Returning, last seen in ${season}`,
      // rc9 ORG-UI: what the board asks of a tier (the group's line), the row's problem line.
      ask: {
        elite: "The board asks for Majors and Worlds",
        contender: "The board asks for Majors and a run at Worlds",
        mid: "The board asks for the regional fight",
        underdog: "The board asks for growth in the regionals",
      } as Record<string, string>,
      problemNone: "Nothing pressing",
      squadLabel: "Squad",
    },
    dossier: {
      squad: "The roster",
      coach: "Coach",
      noCoach: "No coach under contract. You can hire one from day one.",
      inherit: "What you inherit",
      cash: "Cash",
      budget: "Season budget",
      wages: "Weekly wages",
      ceiling: (amount: string) => `Ceiling ${amount}`,
      overCeiling: "Over the board's ceiling",
      grace: (n: number) => (n <= 1 ? "No ultimatum in the first season" : `No ultimatum for ${n} seasons`),
      noBoard: "This organization's board sets its plan on day one.",
      difficulty: "Difficulty",
      manager: "Your name",
      // rc9 ORG-UI: the fallback when the field is left blank.
      managerHint: (name: string) => `Left blank, you start as ${name}.`,
      // rc9 ORG-UI: the structure in the org catalogue's terms, the deal in force.
      structure: "Structure",
      departments: "Departments",
      noDepartments: "None staffed",
      sponsor: "Sponsor in force",
      sponsorTerms: (weekly: string, ends: string) => `${weekly} a week until ${ends}`,
      noSponsor: "No sponsor under contract",
    },
    splash: {
      kicker: "First day at the club",
      title: (manager: string, org: string) => `${manager}, manager of ${org}`,
      ask: "The board's first ask",
      action: "Go to HQ",
    },
  },
  /**
   * v2.2 rc.6 (ORGMODE UI-C): an established org's money and operations (Finances, Club, HQ),
   * and `words`: the strings an established org reads in place of the founded club's reputation
   * wording (merged over the copy by components/career/orgCopy.ts; same paths as the copy).
   */
  orgmode: {
    standing: "Standing",
    // rc9 ORG-UI (#272): the money board's remaining labels (SeasonMoney.tsx); the season budget card's went with it.
    budget: {
      when: (season: string, mondays: number) =>
        mondays > 1 ? `${season} · ${mondays} Mondays to go` : mondays === 1 ? `${season} · the last Monday to go` : `${season} · no Monday left to book`,
      wagesTitle: "Wage bill",
      wagesUnit: "a week, squad and coach",
      ceiling: (amount: string) => `The board's ceiling: ${amount} a week`,
      room: (amount: string) => `${amount} a week of room`,
      over: (amount: string) => `${amount} a week over the ceiling`,
      noCeiling: "The owners set no ceiling.",
      sponsorNone: "No sponsor deal yet. New offers reach this desk when the next split opens.",
    },
    ops: {
      title: "Operations",
      // rc9 org (R220): facilities you upgrade, departments with people, the event camp.
      running: "Running costs",
      perWeek: (amount: string) => `${amount} / week`,
      dept: { facilities: "Facilities", staff: "Departments", camps: "Event camp" } as Record<string, string>,
      deptNote: {
        facilities: "The board signs off each new level.",
        staff: "Paid every Monday. Staff or close each one.",
        camps: "One a split.",
      } as Record<string, string>,
      needs: (need: number, now: number) => `Needs board confidence ${need} (now ${now}).`,
      signs: "The board signs it",
      frozen: "The board froze capital spending for this window.",
      cantAfford: "Not enough money above the floor.",
      upkeep: (amount: string) => `Upkeep ${amount} a week`,
      buy: "Upgrade",
      hire: "Staff it",
      release: "Close",
      run: "Run the camp",
      saves: (split: string) => `Closing it saves ${split} a split`,
      releaseTitle: (name: string) => `Close: ${name}`,
      releaseBody: (split: string, week: string) =>
        `The department's pay stops from the next Monday: the org saves ${split} a split (${week} a week). You can staff it again later at the going rate.`,
      releaseConfirm: "Close it",
      keep: "Keep",
      campUsed: "Used this split",
      campActive: (date: string) => `Running until ${date}`,
      campReady: "Ready to run",
      allOwned: "Every facility is fully built",
      next: "Next upgrade",
      open: "Open operations",
      staffNone: "No department staffed",
      // rc9 ORG-UI (#274): what a new level adds to the weekly bill.
      addsUpkeep: (amount: string) => `+${amount} a week upkeep`,
      weekly: "a week",
    },
    club: {
      promotes: (pct: number, cap: number) =>
        `A promotion raises the budget base and the wage ceiling by ${pct}%, raises what the board expects, and lets the org sign players up to ${cap}.`,
      top: (pct: number) => `At the top tier the board expects titles. A drop cuts the budget base and the wage ceiling by ${pct}%.`,
      opsTitle: "Operations",
    },
    /** The founded club's reputation wording, as an established org reads it (same paths as the copy). */
    words: {
      common: { rep: "Standing", reputation: "Standing" },
      // rc9 org (R222): the standing is felt, not counted: no figure in an established org's lines.
      goals: {
        reward: (n: number): string => (n > 0 ? "Lifts the org's standing at the review" : "No standing at stake"),
        missCost: (n: number): string => (n > 0 ? "Miss it and the org's standing slips" : "No standing at stake"),
        noCost: "No standing at stake",
        repRisk: (n: number): string => (n > 0 ? "The org's standing expects it, and slips if it is missed" : "The org's standing expects it"),
      },
      inserts: { fx: { rep: (n: number): string => (n > 0 ? "Standing rises" : n < 0 ? "Standing slips" : "Standing holds"), repLabel: "Standing" } },
      event: { digestRep: "Standing" },
      // rc9 org (R220): the founded shelf's names, as the org catalogue names them (every screen and mail that still reads the founded ids).
      club: {
        unlockables: {
          peripherals: "Training centre, level 1",
          monitors: "Training centre, level 2",
          pcs: "Training centre, level 3",
          perfCenter: "Performance centre",
          bootcamp1: "Event bootcamp",
          bootcamp2: "Event bootcamp",
          psychologist: "Sports psychology",
          assistant: "Player development",
          analyst: "Analysis department",
          physio: "Health and conditioning",
          brand: "Commercial department",
        },
      },
      ladder: {
        rung: {
          peripherals: "Training centre, level 1",
          monitors: "Training centre, level 2",
          pcs: "Training centre, level 3",
          perfCenter: "Performance centre",
          bootcamp1: "Event bootcamp",
          bootcamp2: "Event bootcamp",
          psychologist: "Sports psychology",
          assistant: "Player development",
          analyst: "Analysis department",
          physio: "Health and conditioning",
          brand: "Commercial department",
        },
        hint: {
          peripherals: "Faster training gains",
          monitors: "Faster training gains",
          pcs: "Training and a team buff",
          perfCenter: "The top training and team buff",
          bootcamp1: "Chemistry and a rating edge",
          bootcamp2: "Chemistry and a rating edge",
          psychologist: "+5 Clutch, +5 Consistency",
          assistant: "Reserves learn more from events",
          analyst: "A rating edge in playoffs",
          physio: "Less wear risk before events",
          brand: "Sponsor offers worth more",
        },
      },
      toolbox: {
        refusal: { maxed: "Every facility is fully built.", locked: "Not available at this org." },
      },
      market: {
        lockedHint: "Players above this level will not join the org at its current standing.",
        errors: {
          bankLimit: "That is above what the bank offers at the org's standing.",
          repGate: "Above this org's pull: a player of this level will not join.",
        },
      },
      finances: {
        bankHint: (weeks: number, pct: number) => `Credit sized by the org's standing: ${weeks} weekly instalments, ${pct}% interest.`,
        bankHintEnd: (weeks: number, pct: number) =>
          `Credit sized by the org's standing: ${weeks} weekly instalments, ${pct}% interest. No emergency loan is left: breaking the floor ends the career.`,
        bankLockedRep: "The bank lends once the org's standing rises a little.",
        deal: { boldLocked: "Bold deals come with a higher standing." },
        // rc9 org (R220): the founded installations and roles, as the org catalogue names them.
        gear: { peripherals: "Training centre, level 1", monitors: "Training centre, level 2", pcs: "Training centre, level 3", perfCenter: "Performance centre" },
        gearDesc: {
          peripherals: "The org's practice rooms and scrim set-up. +5% training.",
          monitors: "A second practice room and a full-time scrim schedule. +5% training.",
          pcs: "The training centre at full size, with its own servers. +10% training and a team edge.",
          perfCenter: "Analysts' room, gym and review theatre under one roof. +15% training, the top team edge.",
        },
        psychologist: "Sports psychology",
        staff: {
          assistant: { title: "Player development", desc: "Coaches the reserves: a reserve earns 80% of the team's series experience instead of 60%." },
          analyst: { title: "Analysis department", desc: "Scouts every playoff opponent: +0.75 team rating in each playoff round." },
          physio: { title: "Health and conditioning", desc: "Manages the training load: a quarter less risk of a player missing an event from wear." },
          brand: { title: "Commercial department", desc: "Sells the org to brands: new sponsor offers are worth 15% more." },
        },
        bootcampT1: "Event bootcamp",
        bootcampT2: "Event bootcamp",
        line: { psychologist: "Sports psychology", staff: "Departments" },
      },
      news: {
        feed: { subject: { rep: "Standing" } },
        // rc9 org (R220): a facility upgrade and the event camp, in the org's words.
        tpl: {
          gearBought: (p: Record<string, string | number>) => `${p.name}: the upgrade is done`,
          bootcampRun: () => "Event bootcamp concluded",
        },
        body: {
          gearBought: (p: Record<string, string | number>) => `${p.name} is open. The players train in it from this week.`,
        },
      },
      mail: {
        body: {
          unlock: (p: Record<string, string | number>) => `The org's standing brings a new sponsor level: ${p.name}. Offers at that level reach the Finances desk.`,
        },
      },
      tour: {
        hub: { progress: { title: "Operations", body: "The org arrives with the facilities and departments of its tier. Upgrade a facility or staff a department when the money and the board allow it." } },
        finances: { progress: { title: "Run the org", body: "Facilities and departments make the squad grow and play better. The board signs off each facility upgrade." } },
      },
    },
    // rc9 org (R220): the org catalogue (engine/career/orgCatalogue.ts), named and explained.
    org: {
      name: {
        trainingCentre: "Training centre",
        performanceCentre: "Performance centre",
        deptDevelopment: "Player development",
        deptAnalysis: "Analysis department",
        deptPsychology: "Sports psychology",
        deptHealth: "Health and conditioning",
        deptCommercial: "Commercial department",
        eventCamp: "Event bootcamp",
      } as Record<string, string>,
      about: {
        trainingCentre: "Where the squad practises every day: rooms, scrim set-up and servers.",
        performanceCentre: "Analysts, gym and review theatre under one roof. The board's flagship project.",
        deptDevelopment: "Coaches who work with the reserves between events.",
        deptAnalysis: "Analysts who break down every playoff opponent.",
        deptPsychology: "A psychologist who works with the players before deciding games.",
        deptHealth: "Staff who manage the training load and the players' health.",
        deptCommercial: "People who sell the org to brands.",
        eventCamp: "The squad under one roof before a run of events.",
      } as Record<string, string>,
      /** What each department does in the game, with the engine's figures. */
      deptEffect: {
        deptDevelopment: (pct: number) => `A reserve earns ${pct}% of the team's series experience`,
        deptAnalysis: (rating: number) => `+${rating} team rating in each playoff round`,
        deptPsychology: (clutch: number, consistency: number) => `+${clutch} Clutch and +${consistency} Consistency`,
        deptHealth: (pct: number) => `${pct}% less risk of a player missing an event from wear`,
        deptCommercial: (pct: number) => `New sponsor offers are worth ${pct}% more`,
      },
      levelEffect: (training: number, buff: number, rating: number) =>
        [training > 0 ? `+${training}% training` : "", buff > 0 ? `+${buff} team buff level${buff === 1 ? "" : "s"}` : "", rating > 0 ? `+${rating} team rating` : ""].filter(Boolean).join(", "),
      level: (n: number, max: number) => `Level ${n} of ${max}`,
      levelName: (name: string, n: number) => `${name}, level ${n}`,
      notBuilt: "Not built",
      standard: "In place when you arrived",
      aboveStandard: "Built under your management",
      upgradeTo: (n: number) => `Upgrade to level ${n}`,
      // rc9 ORG-UI (#274): the next level and what it adds.
      nextLine: (n: number, effect: string) => `Level ${n} adds ${effect}`,
      complete: "Fully built",
      staffed: "Staffed",
      vacant: "Nobody in post",
      staffIt: "Staff the department",
      closeIt: "Close the department",
      perWeek: (amount: string) => `${amount} a week`,
      campFree: "Paid by the sponsor",
      boardSigns: (need: number) => `The board signs this off at confidence ${need}`,
    },
    // rc9 org (R222): the standing as a word and what it changes, never a figure.
    sense: {
      drift: {
        rising: "The scene rates the org above its tier. A season that meets the board's objective moves it up at the review.",
        steady: "The org holds its place in the scene.",
        slipping: "The org is slipping below its tier. Another weak season drops it at the review.",
      } as Record<string, string>,
      pull: (cap: number) => `Players rated up to ${cap} will join`,
      expects: {
        elite: "The board judges the season by Majors and Worlds.",
        contender: "The board expects Majors and a run at Worlds.",
        mid: "The board expects the regional fight and a Major when it comes.",
        underdog: "The board expects the org to grow in the regionals.",
      } as Record<string, string>,
      patience: {
        demanding: "A missed goal costs a lot of the board's confidence.",
        measured: "The board weighs a missed goal against the season.",
        forgiving: "The board gives the project time.",
      } as Record<string, string>,
    },
    // rc9 org (R223): one summary of the money whose figures add up (budget.orgMoneyOf).
    money: {
      title: "The season's money",
      cash: "Cash today",
      commitments: "Still to pay this season",
      payroll: "Squad wages",
      coach: "Coach",
      retainers: "Departments",
      upkeep: "Facility upkeep",
      loan: "Loan repayments",
      incomeToCome: "Income still contracted",
      sponsor: "Sponsor",
      fanbase: "Fanbase",
      projectedEnd: "At the season's end",
      projectedNote: "At this pace, before prizes and player sales",
      // rc9 ORG-UI (#272): the line's amount sits in its own column, so the label does not repeat it.
      keepBack: {
        cashFloor: () => "Kept in the bank by the board's mandate",
        transferCap: () => "Out of reach under the board's transfer limit",
        none: () => "The board's plan sets no line on the cash",
      } as Record<string, (amount: string) => string>,
      freeToSpend: "Free to spend",
      short: "Short of the mandate",
      readMandate: "Read the mandate",
      bonusIfMet: (amount: string) => `+${amount} if the objective is met`,
      // rc9 ORG-UI (#272) second pass: the lead's labels.
      budgetLabel: "The board's budget",
      pool: "Cash and income still to come",
      kept: "Kept by the mandate",
      budgetPaid: "The board's budget, paid into the cash",
      budgetProposed: "The board's budget, paid when you read the mandate",
      gap: {
        pending: (budget: string) => `The board pays its ${budget} into the cash when you read the mandate.`,
        carried: (budget: string, opening: string) => `The cash holds the board's ${budget} and the ${opening} the org already had.`,
        carriedAndSpent: (budget: string, opening: string, net: string) =>
          `The cash holds the board's ${budget} and the ${opening} the org already had, less ${net} spent since.`,
        carriedAndEarned: (budget: string, opening: string, net: string) =>
          `The cash holds the board's ${budget} and the ${opening} the org already had, plus ${net} taken in since.`,
        spent: (budget: string, _opening: string, net: string) => `The cash is the board's ${budget}, less ${net} spent since.`,
        earned: (budget: string, _opening: string, net: string) => `The cash is the board's ${budget}, plus ${net} taken in since.`,
        same: (budget: string) => `The cash is the board's ${budget}, untouched so far.`,
        unknown: () => "The board paid its budget into the cash at the season's start. The cash has moved with the season's income and spending since.",
      } as Record<string, (budget: string, opening: string, net: string) => string>,
    },
  },
  proWorld: {
    title: "Career",
    tabs: { today: "Today", team: "Team", offers: "Offers", inbox: "Inbox" } as Record<string, string>,
    date: (season: number, week: number, day: string) => `Season ${season}, week ${week}, ${day}`,
    days: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    noTeam: "No team yet. Your rank and your training bring the first call from an amateur side.",
    prologue: (cups: string, rank: string, overall: number, need: number) => `No team yet. An amateur side calls once you reach ${cups} in ranked or an overall of ${need}. You are ${rank}, overall ${overall}.`,
    freeAgent: "You are a free agent. Amateur sides and orgs can still call.",
    amateurTeam: (side: string) => `You play for ${side}, an amateur side.`,
    orgTeam: (org: string, starts: boolean) => (starts ? `You start for ${org}.` : `You are on the ${org} bench.`),
    next: "Next for your team",
    nextEvent: (name: string, weekday: string) => `${name}, ${weekday}`,
    nextNone: "No event on the calendar for your team this week.",
    nextOrg: "Your org plays the region's qualifiers and regionals. The report arrives after each one.",
    advance: "Continue",
    advanceHint: "Moves day by day and stops when something needs you: a matchday, a report, an offer, the end of the season.",
    oneDay: "One day",
    offerOpenHint: "You have an open offer. It closes on its date if you keep going without answering.",
    playMatchday: (name: string) => `Play ${name}`,
    continueEvent: (name: string) => `Continue ${name}`,
    seasonEnd: "The season is over",
    seasonEndBody: "Your season line goes into the record and contracts are settled. Then the world moves to next season.",
    startSeason: "Start next season",
    openWeek: "Plan the week",
    weekPlan: "This week",
    block: ["Mon-Tue", "Wed-Thu", "Fri"],
    activity: { train: "Train", ranked: "Ranked", scrim: "Scrim", content: "Content", rest: "Rest" } as Record<string, string>,
    coachPlan: "The coach's plan",
    yourPlan: "Your plan",
    retire: {
      title: "Your career",
      offerTitle: "A season without a team",
      offerBody: "You can end it here with your card, or keep playing and wait for the next call.",
      keepGoing: "Keep playing",
      retire: "Retire",
      retireHint: "Retiring ends the career. Nothing you earned is taken away.",
      lastSeason: (age: number) => `This is your last season: the career ends at ${age + 1}, when the season closes.`,
      mayEnd: "From here the career can end when any season closes.",
      confirmTitle: "Retire now?",
      confirmBody: "The career ends here and the card is final. Nothing you earned is taken away.",
      confirm: "Yes, retire",
      cancel: "Not yet",
      goodbyeTitle: (name: string) => `${name} retires`,
      careerLine: (from: number, to: number, seasons: number, series: number, won: number) => `Ages ${from} to ${to}, ${seasons} ${seasons === 1 ? "season" : "seasons"}, ${series} series played and ${won} won.`,
      peak: "Peak overall",
      orgs: "Orgs",
      titles: "Titles",
      awards: "Awards",
      none: "None",
      nickname: (nick: string, why: string) => `Known as ${nick}: ${why}`,
      retiredTitle: "Retired",
      retiredBody: "The career is over. The card has your peak, your orgs and your titles.",
      card: "Open your card",
    },
    roles: { starter: "Starter", rotation: "Rotation", bench: "Bench", amateur: "Amateur", none: "No team" } as Record<string, string>,
    live: {
      playGame: (n: number) => `Play game ${n}`,
      yourCall: (call: string, ok: boolean) => (ok ? `${call}: it came off. A small lift to your rating and your team's chances in this game.` : `${call}: it did not come off. A small cost to your rating and your team's chances in this game.`),
      instinctCall: (call: string, ok: boolean) => (ok ? `On instinct you went for ${call}: it came off, a small lift this game.` : `On instinct you went for ${call}: it did not come off, a small cost this game.`),
      simSeries: "Sim the rest of the series",
      simEvent: "Sim the rest of the event",
      simHint: "Simming plays every remaining call on instinct, which on average neither helps nor hurts.",
      benched: "You start this event on the bench. The report comes when it ends.",
    },
    stopped: {
      matchday: (name: string) => `The week stopped for your matchday: ${name}.`,
      event: (name: string) => `The week stopped in the middle of ${name}. Continue it from the career hub.`,
      offer: (n: number) => (n === 1 ? "The week stopped: an offer is waiting for your answer." : `The week stopped: ${n} offers are waiting for your answer.`),
      report: "The week stopped: a match report is ready.",
      seasonEnd: "The week stopped: the season is over.",
      retired: "Your career is over.",
      open: "Open the career hub",
      next: (what: string) => `Next: ${what}`,
    },
    weekStop: {
      title: "Plan this week",
      body: "Pick the week's three blocks before it starts. The coach's plan rests you when you are tired.",
      coach: "Play the coach's plan",
      repeat: "Play last week again",
      own: "Plan it myself",
      continueWithPlan: "Accept the plan and continue",
      auto: "Plan each week for me until something happens",
      autoHint: "Continue then plays your saved plan each week, or the coach's when yours would tire you. It still stops for matchdays, offers, energy, a rank up, a new mechanic and the end of the season, and at least every 4 weeks.",
      autoOff: "Plan week by week",
      autoOn: "The coach's plan plays each week until something happens.",
    },
    lastWeek: {
      title: "Last week",
      line: (growth: string, energy: number) => `Attribute points ${growth}, energy ${energy} of 100.`,
      rank: (to: string) => `New rank: ${to}.`,
      see: "See the week",
    },
    notices: {
      offerExpiring: (name: string, days: number) => (days <= 0 ? `The offer from ${name} expires today.` : `The offer from ${name} expires in ${days} ${days === 1 ? "day" : "days"}.`),
      burnoutWarning: (energy: number) => `Energy ${energy} of 100: another week this low can end in burnout, which puts you out for one or two weeks. Rest this week.`,
      digest: (weeks: number, o1: number, o2: number, m1: number, m2: number, energy: number) => `${weeks} weeks played: overall ${o1} to ${o2}, ${m2 - m1 >= 0 ? "+" : ""}${m2 - m1} MMR, energy ${energy}.`,
      rankUp: (rank: string) => `You ranked up to ${rank}.`,
      mechanic: (name: string) => `New mechanic unlocked: ${name}.`,
      burnedOut: (weeks: number) => `Burnout: you are out for ${weeks} ${weeks === 1 ? "week" : "weeks"}.`,
      contractEnding: (org: string, renewal: boolean) => (renewal ? `Your contract with ${org} ends this season. They offered a renewal.` : `Your contract with ${org} ends this season and they will not renew it.`),
      planFellBack: (energy: number) => `Your plan would have left you tired (energy ${energy}), so this week follows the coach's plan.`,
      rolePromoted: (org: string) => `${org} made you a starter.`,
      roleKept: (org: string) => `${org} keep you in rotation for now.`,
    },
    report: {
      title: "Match report",
      benched: "You did not play: the coach went with the starters.",
      series: (opponent: string) => `vs ${opponent}`,
      game: (n: number) => `Game ${n}`,
      won: "Won",
      lost: "Lost",
      ot: "OT",
      line: (goals: number, assists: number, saves: number) => `${goals} G, ${assists} A, ${saves} SV`,
      rating: "Rating",
      mvp: "MVP",
      nextGame: "Next game",
      showAll: "Show all",
      close: "Close the report",
      placement: { champion: "Champions", final: "Lost the final", playoffs: "Out in the playoffs", out: "Out before the playoffs" } as Record<string, string>,
      avg: (r: string) => `Your average: ${r}`,
      hidden: "Not played yet",
    },
    team: {
      rotationShare: (every: number) => `Rotation: you start about one event in ${every}.`,
      nextRotation: (n: number) => (n <= 1 ? "You start your org's next event." : `Your next start: in ${n} events.`),
      review: (n: number) => `The coach reviews your role in ${n} ${n === 1 ? "series" : "series"}.`,
      title: "Your team",
      none: "You have no team. Accept a call in Offers.",
      starter: "Starter",
      bench: "Bench",
      you: "You",
      trust: "Coach trust",
      trustHint: "Good ratings and honest weeks on the bench raise it. Low ratings and a transfer request lower it. The coach reads it with your overall and form at each split.",
      contract: (salary: string, end: number) => `${salary} a split, until the end of season ${end}`,
      promised: (role: string) => `Promised role: ${role}`,
      requestTransfer: "Ask for a transfer",
      requestHint: "Only from the bench. It costs coach trust and opens you to offers in the next window.",
      requested: "You asked for a transfer. Offers can come in the next window.",
      sideLevel: (n: number) => `The side plays around ${n}.`,
    },
    offers: {
      rotationMeans: (every: number) => `Rotation means you start about one event in ${every} and sit on the bench for the others. The coach reviews the role after a few series.`,
      starterMeans: "Starter means you are in the lineup, as long as your form and the coach's trust hold.",
      uncertain: "This org's future is uncertain: it may not be in the scene for long.",
      title: "Offers",
      none: "No offers right now. Orgs call in the transfer windows; amateur sides call when you are ready for them.",
      amateur: "Amateur side",
      org: "Org offer",
      renewal: "Renewal",
      role: { starter: "Starter", rotation: "Rotation" } as Record<string, string>,
      salary: (s: string) => `${s} a split`,
      seasons: (n: number) => (n === 1 ? "1 season" : `${n} seasons`),
      level: (n: number) => `Team level ${n}`,
      sideBody: (level: number) => `Two players around ${level}. You would play every cup and the Open Qualifier with them.`,
      expires: (season: number, week: number) => `Open until season ${season}, week ${week}`,
      leavesSide: (side: string) => `Accepting means leaving ${side}.`,
      accept: "Accept",
      counter: "Counter",
      decline: "Decline",
      counterRisk: (pct: number) => `A counter asks for more money. Risk they walk away: ${pct}%`,
      improved: "They improved the offer after your counter.",
      blocked: { matchday: "Finish today's matchday first.", orgGone: "This org is no longer in the scene.", closed: "This offer is closed." } as Record<string, string>,
      reason: {
        form: (p: Record<string, string | number>) => `Average rating ${p.avg} over your last ${p.n} series. Age ${p.age}.`,
        results: (p: Record<string, string | number>) => `Your team won ${p.won} of your last ${p.n} series. Overall ${p.overall} at age ${p.age}.`,
        youth: (p: Record<string, string | number>) => `Overall ${p.overall} at age ${p.age}. They are signing for the years ahead.`,
        level: (p: Record<string, string | number>) => `Overall ${p.overall} at age ${p.age}.`,
        renewal: (p: Record<string, string | number>) => `Coach trust ${p.trust}. Overall ${p.overall} at age ${p.age}.`,
      } as Record<string, (p: Record<string, string | number>) => string>,
      history: "Earlier offers",
      status: { accepted: "Accepted", declined: "Declined", expired: "Expired", withdrawn: "Withdrawn" } as Record<string, string>,
    },
    inbox: {
      when: (season: number, week: number) => `S${season} · wk ${week}`,
      title: "Inbox",
      none: "Nothing yet.",
      scene: "Around the scene",
      champion: (org: string, event: string) => `${org} won ${event}.`,
      transfer: (player: string, to: string) => `${player} joined ${to}.`,
      sceneNone: "No results yet this season.",
    },
    seasonReview: {
      title: (n: number) => `Season ${n} review`,
      open: "Season review",
      roles: { starter: "Starter", rotation: "Rotation", bench: "Bench", amateur: "Amateur side", none: "No team" } as Record<string, string>,
      teamLine: (team: string, role: string) => `${team} · ${role}`,
      line: (series: number, won: number, games: number, avg: string) => `${series} series, ${won} won, ${games} games, average rating ${avg}`,
      noSeries: "No series played this season.",
      best: (r: string) => `Best series rating: ${r}`,
      overall: (a: number, b: number) => `Overall ${a} to ${b}`,
      titles: "Titles",
      growthTitle: "What moved your attributes",
      growthLine: (stat: string, delta: number, why: string) => `${stat} ${delta > 0 ? "+" : ""}${delta.toFixed(2)} (${why})`,
      sources: { training: "training", ranked: "ranked", scrim: "scrims", match: "matches", age: "age" } as Record<string, string>,
      galaTitle: "The gala",
      galaNone: "No award had a winner this season.",
      award: (scope: string, kind: string, names: string) => `${scope} ${kind}: ${names}`,
      youWon: "You won it.",
      youNominee: "You were named a nominee.",
      close: "Continue",
    },
    history: {
      games: (n: number) => `${n} games`,
      title: "Seasons",
      line: (age: number, from: number, to: number) => `Age ${age}: overall ${from} to ${to}`,
      series: (n: number, won: number, avg: string) => n === 0 ? "No series played" : `${n} series, ${won} won, average rating ${avg}`,
    },
    news: {
      rolePromoted: (p: Record<string, string | number>) => `The ${p.org} coach reviewed your role: you are a starter now.`,
      roleKept: (p: Record<string, string | number>) => `The ${p.org} coach reviewed your role: rotation for now. The next review comes after more series.`,
      nicknameEarned: (p: Record<string, string | number>) => `The scene has a name for you now: ${p.name}.`,
      orgLeftScene: (p: Record<string, string | number>) => `${p.org} is not in the scene this season, so your contract ends with it. You are a free agent, and orgs will call in this window.`,
      retiredAge: (p: Record<string, string | number>) => `At ${p.age}, the time has come: you retire. Your card is ready.`,
      retireOffered: () => `A season without a contract. You can retire now with your card, or keep going.`,
      retiredChoice: () => `You retired. Your card is ready.`,
      amateurInvite: (p: Record<string, string | number>) => `${p.side} want you in their lineup.`,
      joinedSide: (p: Record<string, string | number>) => `You joined ${p.side}.`,
      leftSide: (p: Record<string, string | number>) => `You left ${p.side}.`,
      orgOffer: (p: Record<string, string | number>) => `${p.org} made you an offer.`,
      renewalOffer: (p: Record<string, string | number>) => `${p.org} offered you a new contract.`,
      noRenewal: (p: Record<string, string | number>) => `${p.org} will not renew your contract.`,
      counterImproved: (p: Record<string, string | number>) => `${p.org} improved the offer to ${p.salary} a split.`,
      counterWalked: (p: Record<string, string | number>) => `${p.org} withdrew the offer after your counter.`,
      signed: (p: Record<string, string | number>) => `You signed for ${p.org}.`,
      transferred: (p: Record<string, string | number>) => `You moved from ${p.from} to ${p.org}.`,
      displacedBench: (p: Record<string, string | number>) => `${p.player} moves to the ${p.org} bench to make room for you.`,
      displacedFree: (p: Record<string, string | number>) => `${p.player} leaves ${p.org} and becomes a free agent.`,
      lineupStart: (p: Record<string, string | number>) => `The ${p.org} coach starts you this split.`,
      lineupBench: (p: Record<string, string | number>) => `The ${p.org} coach starts this split without you.`,
      rotationStart: (p: Record<string, string | number>) => `You start for ${p.org} this week in place of ${p.player}.`,
      transferRequested: (p: Record<string, string | number>) => `You asked ${p.org} for a transfer.`,
      renewed: (p: Record<string, string | number>) => `You renewed with ${p.org}.`,
      contractEnded: (p: Record<string, string | number>) => `Your contract with ${p.org} ended. You are a free agent.`,
      orgGone: (p: Record<string, string | number>) => `${p.org} left the scene. You are a free agent.`,
      seasonDone: (p: Record<string, string | number>) => Number(p.series) === 0 ? `Season ${p.season} is over with no series played.` : `Season ${p.season} is over: ${p.series} series played, average rating ${p.avg}.`,
      sideTitle: (p: Record<string, string | number>) => `${p.side} won ${p.event}.`,
    } as Record<string, (p: Record<string, string | number>) => string>,
  },
  /** v2.2 ENDLESS: the front's own strings. */
  endless: {
    hosts: ENDLESS_HOSTS_EN as readonly string[],
    legendsNote: "All-time RLCS rosters at their real peak ratings. Prize money and reputation, no Season Points.",
    /** The org sheet's line for a rival project (its kit this season). */
    projectKit: (season: number, kit: string) => `Project, season ${season}: ${kitEn(kit)}.`,
  },
  locker: CAREER_LOCKER_EN, // v2.3 LOCKER
  media: CAREER_MEDIA_EN, // v2.3 MEDIA
};

export type CareerCopy = typeof CAREER_EN;
