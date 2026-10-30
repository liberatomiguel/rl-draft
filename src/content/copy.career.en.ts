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

/** rc.33 review: how long the rescue partner pays (rc.34: the investor, CAREER_LOAN.investor.weeks, passed in) — nothing when unknown. */
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
        ? `Below the floor on a Monday, the Emergency Backer steps in — and a rescue partner adds income${partnerRunEn(partnerWeeks)}.`
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
    return `Below the floor again before it is repaid, the bank adds to the loan — the deadline stays${left > 0 ? ` (it will do that ${left === 1 ? "once more" : `${left} more times`})` : ""}.`;
  }
  const term = Number(p.term) > 0 ? `, to be repaid within ${p.term} weeks` : "";
  const last = Number(p.loansLeft) === 1 ? " — the last one it will open in this career" : "";
  return Number(p.nextPartner)
    ? `Below the floor on a Monday, the bank opens an emergency loan${term}${last} — and an investor adds a little income${partnerRunEn(p.partnerRun)}.`
    : `Below the floor on a Monday, the bank opens an emergency loan${term}${last}.`;
};

/**
 * rc.34 review: the emergency loans the career still gets once this one is
 * repaid (`loansLeft` of nextBreachParamsOf, read while one is owed) — the
 * loan notice's row and the bank's mail. Empty without a cap (-1).
 */
const loansLeftEn = (p: Record<string, string | number | undefined>): string => {
  const left = Number(p.loansLeft);
  if (p.loansLeft === undefined || left < 0) return "";
  return left === 0
    ? "It is the last emergency loan the bank opens in this career: once it is repaid, the next breach of the floor ends the career."
    : `Once it is repaid, the bank opens ${left === 1 ? "one more" : `${left} more`} in this career at most.`;
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
  "On that Monday the bank takes what is owed as long as the books stay at or above the floor after paying it; if they would not, the career ends.";

/**
 * rc.34 review: what closes the gap to the deadline — new money (a sale, a
 * prize: each repays its share and the rest stays in the books) or a lower
 * burn. A partial payment from Finances moves money from the balance to the
 * debt and closes nothing; "Pay it all" settles it the day the books allow.
 */
const gapWaysEn = (p: Record<string, string | number | undefined>): string =>
  `What closes the gap is new money or a lower burn: a good bid for a player (${p.salePct}% of the fee repays the loan, the rest stays in the books), prize money (${p.garnishPct}% of each prize repays it), a lighter wage bill. A partial payment from Finances only moves money from the balance to the debt; "Pay it all" settles the loan the day the books can take it.`;

/** rc.34 review: the projection the bank's deadline mails and notices quote ("on this pace"). */
const onPaceEn = (p: Record<string, string | number | undefined>): string =>
  Number(p.covered)
    ? `On this pace (${p.net} a week) the books cover it on the day — the balance would be ${p.projected} on the deadline Monday. Keep it that way, or settle it now with "Pay it all" in Finances.`
    : `On this pace (${p.net} a week) the books do not cover it: the balance would be ${p.projected} on the deadline Monday, ${p.gap} short of what the bank needs.`;

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

/** rc.33 (ECO-07): the rescue partner's last payday, as the rescue mail quotes it. */
const partnerUntilEn = (p: Record<string, string | number>): string =>
  `the Monday of ${Number(p.partnerNextSeason) ? "next season's " : ""}week ${p.partnerUntilWeek}`;

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

/** rc.34 (ECO-04, decision 4-A): a goal's difficulty word. */
const SPONSOR_WORD_EN: Record<string, string> = { likely: "Likely", even: "Even", stretch: "Stretch" };

/** rc.34: a goal carried in mail params (goalKind, goalCount, goalPlace, goalSplit). */
const goalOfParamsEn = (p: Record<string, string | number>): string =>
  sponsorGoalEn(String(p.goalKind), Number(p.goalCount), Number(p.goalPlace), Number(p.goalSplit));

/** rc.34 (S6): a handover step's Monday, as the mail quotes it. */
const stepWhenEn = (week: string | number | undefined, nextSeason: string | number | undefined): string =>
  `the Monday of ${Number(nextSeason) ? "next season's " : ""}week ${week}`;

export const CAREER_EN = {
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
    title: "Found your organization",
    step: (n: number, total: number) => `Step ${n} of ${total}`,
    quickStart: "Quick start",
    quickStartHint: "Randomize everything — you can re-tint colors later.",
    // Step 1 — identity
    identityTitle: "Identity",
    identityKicker: "Every dynasty starts with a name on a jersey.",
    orgName: "Organization name",
    orgNamePlaceholder: "e.g. Horizon Esports",
    orgNameTaken: "That name belongs to an existing org.",
    orgNameLength: "2-18 characters.",
    abbrev: "Tag",
    abbrevHint: "2-4 letters, shown on tables and the crest.",
    managerName: "Manager name",
    managerNamePlaceholder: "Your name on the desk.",
    country: "Country",
    // Step 2 — crest (v0.2: shapes × symbols × patterns × free colors)
    crestTitle: "Crest & colors",
    crestKicker: "Pick a mark. The scene will learn to fear it.",
    crestLabel: "Shape",
    crestSymbol: "Symbol",
    crestPattern: "Pattern",
    crestNone: "None",
    randomizeCrest: "Randomize",
    kits: "Kits",
    kitsHint: "Curated pairs that always read well on a crest. Tap one, or build your own below.",
    customColors: "Build my own colours",
    customColorsHide: "Hide custom colours",
    contrastHint: "Swatches too close to the primary are greyed out — a crest needs contrast.",
    primaryColor: "Primary color",
    secondaryColor: "Accent",
    identityBuff: "Org identity",
    identityBuffHint: "Your org's specialty — a small team-wide edge.",
    // Step 3 — region
    regionTitle: "Home region",
    regionKicker: "Where you play decides who you face — and how many Worlds seats exist.",
    regionStrength: "Field strength",
    regionSlots: (n: number) => `${n} Worlds slots`,
    regionRivals: "Notable rivals",
    regionNote: "Relocating to another region unlocks later in the career.",
    strengthDeep: "Deep field — the hard road",
    strengthStrong: "Strong field",
    strengthDeveloping: "Developing field — a softer road",
    // Step 4 — roster
    rosterTitle: "First signings",
    rosterKicker: "Three players without an org. One of them says yes to yours.",
    rosterProspects: "Prospects",
    rosterProspectsDesc: "Teenagers with sky-high ceilings. Patience required.",
    rosterJourneymen: "Journeymen",
    rosterJourneymenDesc: "The scene's veterans. Ready now, done growing.",
    rosterBalanced: "Balanced",
    rosterBalancedDesc: "A bit of now, a bit of later.",
    recommended: "Recommended",
    /** rc.35 (front C): the middle roster offer's tag. */
    rosterBalancedTag: "Balanced",
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
    finalKicker: "Your pick stays for the whole career.",
    // rc.32 (BAL-02): the career presets replace the Management Style step.
    presets: {
      easy: { label: "Easy", promise: "A forgiving first career, with room to learn." },
      normal: { label: "Normal", promise: "The career as it's meant to be played." },
      hard: { label: "Hard", promise: "A real test for experienced managers." },
    } as Record<"easy" | "normal" | "hard", { label: string; promise: string }>,
    // The bullets (wizard/PresetEffects.tsx), read live from balance.ts.
    presetMatches: {
      easier: "Matches lean your way.",
      even: "Fair matches.",
      harder: "Tougher rivals.",
    } as Record<"easier" | "even" | "harder", string>,
    // rc.34 review: the preset's whole money rule (economy.moneyRuleFor) — the emergency loans a
    // career gets (null = no cap), the weeks to repay each, or no deadline (the loan never ends it).
    presetMoney: (r: { loans: number | null; deadlineWeeks: number | null }): string => {
      const head = r.loans === null ? "The bank lends it" : r.loans === 1 ? "One bank loan" : `Up to ${countWordEn(r.loans)} bank loans`;
      if (r.deadlineWeeks === null) return `Out of money? ${head} — no deadline: prizes and sales repay ${r.loans === null || r.loans === 1 ? "it" : "them"}.`;
      const repay = r.loans === null ? "repay" : r.loans === 1 ? "repay it" : "repay each";
      return `Out of money? ${head} — ${repay} within ${r.deadlineWeeks} ${r.deadlineWeeks === 1 ? "week" : "weeks"} or the career ends.`;
    },
    // CAREER_LOAN.breachesToEnd 1: the first Monday below the floor ends the career — no loan.
    presetMoneyNoLoan: "Out of money? The career ends.",
    // rc.34 review: the training delegation the preset starts on (difficulty.presetTrainingModeOf,
    // CAREER_PLAN.modeByPreset) and whether cups are entered for you (the preset's prefs).
    presetHelp: (mode: "auto" | "recommend" | "manual", autoCups: boolean): string =>
      `${{ auto: "The best training plan is tagged for you.", recommend: "The best training plan is tagged; you pick.", manual: "You plan training, no hints." }[mode]} ${autoCups ? "Cups are entered for you." : "You pick every cup."}`,
    summaryTitle: "The paperwork",
    found: (org: string) => `Found ${org}`,
    founded: "EST. 2020",
    foundedSplash: "A new name enters the scene.",
  },

  hub: {
    title: "HQ",
    continue: "Continue",
    continueTo: (label: string) => `Advance — ${label}`,
    advanceDay: "Advance one day",
    nowNext: "Next up",
    nowDecision: "Decision required",
    week: (n: number) => `Week ${n}`,
    matchdayIn: (n: number) => (n === 0 ? "MATCHDAY" : n === 1 ? "Matchday tomorrow" : `Matchday in ${n} days`),
    seasonGoal: "Season goal",
    goalStretch: "Stretch",
    rosterForm: "Squad",
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
    budgetNet: (s: string) => `${s} / week`,
    budgetWarning: "Projected negative by Monday's payday",
    news: "The wire",
    newsAll: "Full feed",
    inboxTeaser: "Inbox",
    inboxAll: "Open inbox",
    sponsor: "Sponsor objective",
    trainingWeek: "Training week — squad gets extra reps",
    thisWeek: "This week",
    comingUp: "Coming up",
    quickActions: "Today at the office",
    scrimCta: (opp: string) => `Scrim vs ${opp}`,
    scrimsLeft: (n: number) => (n === 1 ? "1 scrim block left this week" : `${n} scrim blocks left this week`),
    scrimUnavailable: "No scrim block available today",
    restDay: "Rest day — the squad recharges",
    progression: "Next unlock",
    emptyStateTitle: "Welcome to the desk",
    emptyStateBody: "Your first tournament is on the calendar. Press Continue when you're ready.",
    // v0.3 FIFA-style autoplay
    play: "Play",
    pause: "Pause",
    playHint: (label: string) => `Playing — next: ${label}`,
    skipToNext: "Skip ahead",
    // v0.3 transfer wire panel
    transfersTitle: "Transfer window",
    transfersWire: "The transfer wire",
    transfersAll: "All regions",
    transfersEmpty: "No moves logged yet — the wire fills as the window runs.",
    transfersFa: "Free agent",
    transfersUser: "Your move",
    transfersShowAll: (n: number) => `Show all ${n} moves`,
    // v2.0 hub rebuild (R26)
    today: "Today",
    dayOf: (d: number, total: number) => `Day ${d} of ${total}`,
    nextStop: (label: string, s: string) => `Next stop: ${label} · ${s}`,
    needsYou: "Needs you",
    nothingNeeded: "Nothing needs a decision today — advance when you're ready.",
    canDo: "What you can do today",
    inviteTitle: (name: string) => `Invite: ${name}`,
    inviteBody: (day: string) => `Community circuit, plays ${day}. Accept to commit the squad, or pass and keep training.`,
    inviteAccept: "Accept invite",
    invitePass: "Pass",
    // RTW-05 (rc.33): a squad under three — the clock waits for a third player.
    squadShortKicker: "Squad short",
    squadShortTitle: "Sign a player",
    squadShortBody: (n: number, event: string) =>
      `Only ${n} of 3 seats are filled, and no event is played short-handed. The clock waits before ${event} until a third player signs — a free agent can take the empty seat today, window or not.`,
    squadShortMarket: "Go to the Market",
    squadShortSquad: "Squad",
    contractsExpiring: (n: number) => (n === 1 ? "1 contract ends this season — renew or let it run out." : `${n} contracts end this season — renew or let them run out.`),
    cashWarningCard: (weeks: number) => `Cash runs out in about ${weeks} weeks at this burn.`,
    // ECO-02 (R46): the card names the debt Finances shows. rc.34: the bank's emergency loan and its deadline.
    backerOpen: (owed: string) => `Emergency loan open — ${owed} to repay to the bank.`,
    loanDue: (date: string, weeks: number) =>
      weeks <= 0
        ? `Due this Monday (${date}).`
        : weeks === 1
          ? `Due next Monday, ${date}.`
          : `Due ${date} — ${weeks} weeks left. Prizes and sales repay part of it on the way.`,
    loanDueRule: deadlineRuleEn,
    // rc.32 (M4): the HQ line under it — what the next breach means (rc.34: the flow's nextBreachParamsOf).
    backerNextBreach: (p: Record<string, string | number>) => nextBreachEn(p),
    cards: {
      training: "Training",
      trainingOn: "Session today. Mon–Fri develop the squad.",
      trainingOff: "No session today — rest day or match prep.",
      scrim: "Scrim",
      market: "Market",
      marketOpen: (n: number) => (n === 1 ? "Window open — closes tomorrow" : `Window open — closes in ${n} days`),
      marketClosed: (s: string) => `Window closed — opens ${s}`,
      finances: "Finances",
      bootcamp: "Bootcamp",
      bootcampReady: "A bootcamp slot is open this split.",
      squad: "Squad",
      squadLine: (ovr: number, chem: number) => `Avg ${ovr} OVR · chemistry ${chem}%`,
    },
    edges: "Your edges",
    edgesEmpty: "No edges yet — coaches, gear and sponsors unlock with reputation.",
    edgeCoach: (name: string, pct: number) => `${name} · ${pct > 0 ? "+" : ""}${pct}% training`,
    edgeGear: (name: string, pct: number) => `${name} · +${pct}% training`,
    edgePsych: "Psychologist · +1 Clutch, +1 Consistency",
    edgeSharp: "Bootcamp Sharp · armed for the next official",
    edgeSponsor: (tier: number) => `Sponsor tier ${tier} perks`,
    autoplayOn: "Autoplay on — pausing at the next stop",
    // rc.2 hub v3
    skipTo: (label: string) => `Skip to ${label}`,
    plusDay: "+1 day",
    squadTitle: "Squad",
    squadManage: "Manage squad",
    squadSub: "Sub",
    squadCoach: "Coach",
    squadNoCoach: "No coach — hire one in the Market",
    squadNoSub: "No sub signed",
    growthNext: (days: number) => (days === 1 ? "+1 OVR tomorrow" : `+1 OVR in ${days} days`),
    growthStalled: "Growth capped",
    trainingTitle: "Training",
    trainingOpen: "Open training",
    trainingToday: "Session today",
    trainingRest: "Rest day",
    trainingMatch: "Match prep",
    drillNow: "This week's drill",
    drillNone: "No drill set",
    drillPick: "Pick a drill",
    scrimTitle: "Scrim",
    edgesTitle: "Your edges",
    // rc.34 (DEV-03, HQ-CONTRACT H3): the training block — the period's plan at a glance.
    trainingScrims: (done: number, planned: number, level: string) => `Scrims ${done} of ${planned} · ${level}`,
    trainingNoScrims: "No scrims in the plan",
    trainingLast: (avg: string, name: string, gain: string, wear: string) => `Last period ${avg} avg · ${name} ${gain} · ${wear}`,
    trainingLastNone: "No period filed yet",
    trainingCoachNone: "No coach — the base, or your package at half strength",
    trainingRisk: (pts: string) => `+${pts} pts absence risk`,
    financesTitle: "Finances",
    financesOpen: "Open finances",
    // rc.34 (UX-01a, HQ-CONTRACT H1): one decision at a time; 1-B's "Later" for bids and sponsor offers.
    decisionCount: (i: number, n: number) => `${i} of ${n}`,
    later: "Later",
    alsoDue: "Also",
    parked: "Parked",
    dueBy: (date: string) => `by ${date}`,
    dueToday: "last day",
    lastDay: "Last day — the clock waits for your answer.",
    standsUntil: (date: string) => `It stands until ${date}; Later parks it until then.`,
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
      sponsor: "Sponsor offers",
    },
    noticeTitle: "A notice needs you",
    noticeBody: "Read and acknowledge the notice — the clock moves once you have.",
    trainingDecisionTitle: "The coach has a plan",
    trainingDecisionBody: "The coach's training proposal waits for your answer.",
    sponsorDecline: "No deal for now",
    // rc.35 (front S): beside "Decline" on the sponsor decision.
    sponsorLater: "Decide later",
    sponsorDeclineHint: "The brands come back at the next split.",
    // rc.34 (Miguel, 31/10): a short squad can sit a regional out.
    squadShortSkip: "Skip this regional",
    squadShortSkipHint: (event: string) =>
      `${event}: no entry, no points, no prize. Training goes on, and the next regional asks again.`,
    // rc.34 (UX-01b, HQ-CONTRACT H2): the squad as Draft cards.
    cardStarter: "Starter",
    cardReserve: "Reserve",
    cardEmptySeat: "Empty seat",
    cardSignHint: "Sign a player",
    cardUntil: (season: string) => `Until ${season}`,
    cardEndsIn: (weeks: number) => (weeks <= 0 ? "Leaves at the rollover" : weeks === 1 ? "Ends in 1 week" : `Ends in ${weeks} weeks`),
    cardFinalSeason: "Final season",
    cardCoach: (name: string, ovr: number, pct: number) => `${name} · ${ovr} · ${pct > 0 ? "+" : ""}${pct}% training`,
    // rc.35 (front C): the squad block's row title and the coach card's training chip.
    cardStarters: "Starters",
    coachTrainingPct: (pct: number) => `${pct > 0 ? "+" : ""}${pct}% training`,
    // rc.34 (UX-01d, decision 6-A): the week's seeding question.
    nextRegional: (ordinal: number, week: number) => `Next regional (R${ordinal}, week ${week})`,
    seatDirect: "direct seat",
    seatQualifier: "Saturday qualifier",
    seatPreview: "as it stands — set on its Monday",
    // rc.34 (UX-01e, HQ-CONTRACT H5): the money, booked or committed only.
    financePerWeek: (amount: string) => `${amount} a week`,
    financePayroll: "Next payroll",
    financeGuaranteed: "Guaranteed",
    financeGuaranteedParts: (sponsor: string, partner: string, fans: string) =>
      `sponsor ${sponsor} · partner ${partner} · merch & streams ${fans}`,
    financePartnerWeeks: (n: number) => (n === 1 ? "1 more week" : `${n} more weeks`),
    financeDebt: "Debt",
    financeDebtNone: "None",
    financeRunway: "Runway",
    financeWeek: "This week",
    // rc.34 review: the emergency loan (rc.31–rc.33's "Backer" is gone from the product).
    financeDebtBacker: (owed: string) => `Emergency loan ${owed}`,
    financeDebtBank: (owed: string, next: string) => `bank ${owed} · next ${next}`,
    financeProjection: "End of split",
    financeProjectionLine: (date: string, mondays: number, balance: string) =>
      `${date} · ${mondays === 1 ? "1 Monday" : `${mondays} Mondays`}, no prizes counted: ${balance}`,
    financeNoHistory: "The line fills from the Mondays the save records.",
  },

  // v0.2 Inbox — mail addressed to the manager (offers, sponsors, contracts).
  mail: {
    title: "Inbox",
    unread: (n: number) => `${n} unread`,
    markAllRead: "Mark all read",
    empty: "No mail. The desk is quiet — for now.",
    emptyHint: "Transfer offers, sponsorship deals and contract notices land here.",
    open: "Open",
    from: {
      bank: "Northline Bank",
      accountant: "Org accountant",
      board: "The Board",
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
      blockbusterBid: (p: Record<string, string | number>) => `BLOCKBUSTER: ${p.org} want ${p.player}`,
      sponsorOffers: () => `Sponsorship proposals on your desk`,
      objectiveHit: (p: Record<string, string | number>) => `${p.name}: objective delivered`,
      objectiveMissed: (p: Record<string, string | number>) => `${p.name}: objective missed`,
      contractExpiring: (p: Record<string, string | number>) => `${p.player} — contract in its final season`,
      // rc.34 (UX-06b): the reminders before a player can leave.
      contractReminder: (p: Record<string, string | number>) => `Contracts: ${p.weeks} weeks left for ${p.players}`,
      bankLoan: (p: Record<string, string | number>) => `Bank loan approved: ${p.amount}`,
      bankCleared: () => `Bank loan repaid in full`,
      cashWarning: (p: Record<string, string | number>) => `Cash warning: ${p.weeks} weeks of runway`,
      qualifiedRegional: (p: Record<string, string | number>) => `Through the qualifier: ${p.event} is on`,
      missedRegional: (p: Record<string, string | number>) => `Out at the qualifier — ${p.event} goes on without you`,
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
      debtCleared: () => `Emergency loan repaid in full`,
      // DEV-02 (R48): the user's own retiree — which way he went.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} retires — and moves into coaching`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} retires from competition`,
      // rc.32 (ECONOMY-CONTRACT M3 / M4).
      foundingPartner: () => `A founding partner backs the org`,
      foundingPartnerEnds: () => `The founding partner steps back`,
      cashNotice: (p: Record<string, string | number>) => `Cash notice: about ${p.weeks} weeks of runway`,
      // rc.32 history (ECO-08 / ECO-12): nothing sends these since rc.33 — kept so an older save's inbox still reads.
      restructured: () => `The Backer restructured the org`,
      listingOffer: (p: Record<string, string | number>) => `Offer for ${p.player} — your listing`,
      // rc.34 (ECO-04): the deals' mails.
      sponsorLapsed: () => `The sponsorship offers lapsed`,
      sponsorGoalHit: (p: Record<string, string | number>) => `${p.name}: goal reached`,
      sponsorGoalMissed: (p: Record<string, string | number>) => `${p.name}: goal missed`,
      sponsorGoalSet: (p: Record<string, string | number>) => `${p.name}: the Split ${p.goalSplit} goal`,
      sponsorEnded: (p: Record<string, string | number>) => `${p.name}: the deal is complete`,
      foundingHandover: () => `The founding partner hands over`,
    },
    body: {
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} tabled a formal offer of ${p.fee} for ${p.player}. It expires when the window closes — accept or decline it in the Market's deals tab.`,
      // rc.32 (Miguel, 30/10): what a Blockbuster bid is, why it came, its price and the cost of refusing.
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} came in heavy: ${p.fee} for ${p.player}. A Blockbuster bid is one of the season's scripted moments — a big-money org chasing the player it built around in real history — so it pays ${p.mult === undefined ? "well above" : `×${p.mult}`} his market value. Refuse it, or let it expire, and he stays${p.pct === undefined ? " — but his next renewal ask can rise." : `, but his next renewal ask rises ${p.pct}%.`}`,
      foundingPartner: (p: Record<string, string | number>) =>
        `A local partner backs the org's first steps: ${p.base} a split (${p.pct}% of the founding wage bill), paid with every Monday's payroll. Its only ask is entering events, and there is no signing bonus. It runs until your first sponsorship deal — and at least to the end of ${p.through}, alongside a deal signed earlier. Finances lists it as its own line.`,
      foundingPartnerEnds: () =>
        `The founding partner's term is over: the org has its own sponsorship deal and its first seasons behind it. From here the books stand on sponsors, prizes, merch and streams.`,
      cashNotice: (p: Record<string, string | number>) =>
        `A heads-up from the accountant: at ${p.burn} a week of burn the balance covers about ${p.weeks} more Mondays, and the books would close below the floor (${p.floor}) on ${breachWhenEn(p)}. ${nextBreachEn(p)} This is the cheap moment to act: take a good bid for a player, aim the squad at prize money, keep the next renewal in check${Number(p.backer) ? "" : ", or line up a bank loan"}.`,
      // rc.32 history (ECO-08 / ECO-12): nothing sends these since rc.33 — kept so an older save's inbox still reads.
      restructured: (p: Record<string, string | number>) =>
        `The books closed below the floor again (breach ${p.n}), so the Backer restructured the org${p.player ? `: ${p.player} was sold to ${p.org} for ${p.fee}, his market value${positive(p.garnished) ? ` (${p.garnished} of it went to the debt)` : ""}` : ""}. ${Number(p.rep) > 0 ? `Reputation −${p.rep}. ` : ""}${Number(p.granted) > 0 ? `The Backer topped the balance back up to ${p.rescueTo}` : `The balance stands at ${p.balance}`}; ${positive(p.owed) ? `you owe ${p.owed}` : "nothing is owed"}. The squad plays on — the sub steps up; an empty seat needs a free agent before the next event. ${legacyNextBreachEn(p.next)}`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} answered your listing: ${p.fee} for ${p.player}. Accept it in the Market's deals tab before the window closes, or decline to keep him — declining ends the listing.`,
      sponsorOffers: () =>
        `Brands are interested in the org. Review the proposals in Finances — the base payment is guaranteed; the bonus rides on the objective.`,
      objectiveHit: (p: Record<string, string | number>) =>
        `The split objective was delivered. The bonus of ${p.bonus} lands with the payday. Good business.`,
      objectiveMissed: (p: Record<string, string | number>) =>
        `The split objective slipped. No money is clawed back — but repeated misses lower next season's renewal tier. (Misses so far: ${p.misses}.)`,
      // rc.34 (ECO-04): the deals' mails.
      sponsorDecision: (p: Record<string, string | number>) =>
        `Three brands want the org at Tier ${p.tier}: a Steady deal, a Balanced one and a Bold one. On average they are worth about the same — they differ in how sure the money is, how long they run and what they ask. Compare them in Finances and sign one by the Sunday of week ${p.byWeek}, or they lapse.${Number(p.demoted) ? " Three goals slipped on the last Steady deal, so this round comes one tier lower." : ""}`,
      sponsorLapsed: () =>
        `Nobody signed before the deadline, so the brands moved on. The next offers come at the next split boundary.`,
      sponsorGoalHit: (p: Record<string, string | number>) =>
        `${goalOfParamsEn(p)}: done. The bonus of ${p.bonus} lands today${positive(p.milestone) ? `, with the milestone payment of ${p.milestone}` : ""}.`,
      sponsorGoalMissed: (p: Record<string, string | number>) =>
        `${goalOfParamsEn(p)}: ${p.done} of ${p.target}. ${
          positive(p.fine)
            ? `The fine is ${p.fine}, paid as ${p.perMonday} on each of the next ${p.mondays} Mondays — never below the bank's floor.`
            : Number(p.steady)
              ? `No fine on a Steady deal — but the brand's patience drops: ${p.misses} of ${p.patience} misses; at ${p.patience}, the next offer comes a tier lower.`
              : "No fine."
        }`,
      sponsorGoalSet: (p: Record<string, string | number>) =>
        `The new split's goal: ${goalOfParamsEn(p)} — ${SPONSOR_WORD_EN[String(p.word)] ?? p.word}. Reaching it pays ${p.bonus}${positive(p.fine) ? `; a miss costs up to ${p.fine}` : ""}.`,
      sponsorEnded: (p: Record<string, string | number>) =>
        `The deal ran its course: ${p.hits} of ${p.goals} goals reached. New offers are on your desk.${Number(p.demoted) ? " After three misses on a Steady deal, they come one tier lower." : ""}`,
      foundingHandover: (p: Record<string, string | number>) =>
        `With a deal of its own and its first seasons behind it, the org no longer leans on the founding partner. It steps back gradually: ${p.first}% of its pay until ${stepWhenEn(p.stepWeek, p.stepNextSeason)}, then ${p.second}% until ${stepWhenEn(p.endWeek, p.endNextSeason)}, and then it ends.`,
      contractExpiring: (p: Record<string, string | number>) =>
        `${p.player} is in the final season of his deal. You hold an exclusive re-sign window through Split 3 — after that, he walks for free.`,
      contractReminder: (p: Record<string, string | number>) =>
        `${p.players} — still out of contract after this season, with ${p.weeks} weeks to go. Renew in Squad before the rollover, or they leave as free agents (the review before the new season lists them).`,
      bankLoan: (p: Record<string, string | number>) =>
        `The bank wired ${p.amount}. Instalments of ${p.weekly} book every Monday until ${p.total} is repaid. Spend it on something that pays back.`,
      bankCleared: () =>
        `The last instalment cleared. The line of credit is open again if the org ever needs it.`,
      // rc.32 (M4, provisional): every Monday at ≤ 4 weeks — the projected breach and the way out.
      cashWarning: (p: Record<string, string | number>) =>
        p.breachWeek === undefined
          ? `At ${p.net} per week the balance covers about ${p.weeks} more Mondays. Trim wages, win prize money, or arrange a bank loan before the books break the floor.`
          : `At ${p.burn} a week of burn the balance covers about ${p.weeks} more Mondays; on this pace the books close below the floor (${p.floor}) on ${breachWhenEn(p)}. ${nextBreachEn(p)} Ways out: take a good bid for a player, win prize money, trim the wage bill at renewal${Number(p.backer) ? "" : ", or take a bank loan"}.`,
      qualifiedRegional: (p: Record<string, string | number>) =>
        `Saturday's Swiss is done and the org is one of the eight through. ${p.event} is Sunday — the direct eight are waiting.`,
      missedRegional: (p: Record<string, string | number>) =>
        `Three losses in Saturday's Swiss — ${p.event} goes ahead on Sunday without you. Rest up; a new training week starts Monday.`,
      // HISTORY (rc.32–rc.33): the Backer's rescue mail, as it was sent (rc.34 sends emergencyLoan).
      backerIn: (p: Record<string, string | number>) =>
        p.rescueTo === undefined
          ? `The books breached the floor and the Emergency Backer stepped in — once. Repayment is garnished from prize money. A second collapse ends the org.`
          : `The books closed a Monday below the floor${Number(p.n) > 1 ? ` for the ${ordinalEn(Number(p.n))} time` : ""} and the Emergency Backer stepped in: the balance is back at ${p.rescueTo}${Number(p.weeks) > 0 ? ` (about ${p.weeks} weeks of wages)` : ""}. You owe ${p.owed} — ${p.garnishPct}% of every prize and half of any sale go to it until it clears, or pay it down from Finances. While it is owed, transfer fees, gear${Number(p.lock) ? " and new commitments that shorten the runway" : ""} are on hold.${positive(p.partnerWeekly) ? ` A rescue partner, ${p.partnerName}, comes in with it: ${p.partnerWeekly} a week from next Monday for ${p.partnerWeeks} weeks — the last payment on ${partnerUntilEn(p)}. It is income, never garnished; Finances shows it while it runs.` : ""} ${legacyNextBreachEn(p.next, p.nextPartner, p.partnerRun)}`,
      // rc.34 (Miguel, 31/10): the bank's emergency loan — why, how much, how it is repaid, by when,
      // the investor if it came with it, and what ends the career.
      emergencyLoan: (p: Record<string, string | number>) =>
        `The books closed a Monday below the floor (${p.floor}), so the bank stepped in with an emergency loan of ${p.lent}: the balance is back at ${p.rescueTo}${Number(p.weeks) > 0 ? ` (about ${p.weeks} weeks of wages)` : ""}. You owe ${p.owed}, interest included. ${p.garnishPct}% of every prize and ${p.salePct}% of any sale repay it automatically; pay the rest from Finances whenever you like.${p.dlWeek !== undefined ? ` It is due on ${mondayWhenEn(p.dlWeek, p.dlAhead)}. ${deadlineRuleEn}` : ""}${loansLeftEn(p) ? ` ${loansLeftEn(p)}` : ""}${positive(p.partnerWeekly) ? ` An investor, ${p.partnerName}, comes in with this first loan: ${p.partnerWeekly} a week from next Monday for ${p.partnerWeeks} weeks — the last payment on ${partnerUntilEn(p)}. It is income, never garnished.` : ""} ${Number(p.lock) ? "While it is owed, transfer fees, gear and new commitments that shorten the runway are on hold." : "Nothing is locked while you owe: signings, fees and gear stay open."} ${nextBreachEn(p)}`,
      emergencyTopUp: (p: Record<string, string | number>) =>
        `The books closed below the floor again, so the bank lent ${p.lent} more: the balance is back at ${p.rescueTo}, and you now owe ${p.owed} in all.${p.dlWeek !== undefined ? ` The deadline does not move: ${mondayWhenEn(p.dlWeek, p.dlAhead)}. ${deadlineRuleEn}` : ""} ${nextBreachEn(p)}`,
      // rc.34 review: the books projected to the deadline (an older mail without the projection reads today's balance).
      loanDeadline: (p: Record<string, string | number>) =>
        `${Number(p.weeksLeft) === 1 ? "One week" : `${p.weeksLeft} weeks`} to the emergency loan's deadline, ${mondayWhenEn(p.dlWeek, p.dlAhead)}. You owe ${p.owed}; the balance stands at ${p.balance}. ${p.projected === undefined ? (Number(p.covered) ? "Today's balance would cover it." : "Today's balance would not cover it.") : onPaceEn(p)}${Number(p.covered) ? "" : ` ${gapWaysEn(p)}`} ${deadlineRuleEn}`,
      loanCollected: (p: Record<string, string | number>) =>
        `The emergency loan came due and the books could pay it: the bank took ${p.collected}, and the balance stands at ${p.balance}. The loan is closed. ${p.next === undefined ? "Another breach of the floor would open a new one, with a new deadline." : nextBreachEn(p)}`,
      loanSlipped: (p: Record<string, string | number>) =>
        `${Number(p.weeksLeft) === 1 ? "One week" : `${p.weeksLeft} weeks`} before the emergency loan is due, ${mondayWhenEn(p.dlWeek, p.dlAhead)}, the books stopped covering it: on this pace (${p.net} a week) the balance would be ${p.projected} on that Monday, ${p.gap} short of what the bank needs for the ${p.owed} owed. ${gapWaysEn(p)} ${deadlineRuleEn}`,
      loanTakenOver: (p: Record<string, string | number>) =>
        `The Emergency Backer is gone: the bank now holds what you owed it, ${p.owed}, as an emergency loan.${p.dlWeek !== undefined ? ` It is due on ${mondayWhenEn(p.dlWeek, p.dlAhead)} — ${p.dlWeeks} weeks from now. ${deadlineRuleEn}` : ""} ${p.garnishPct}% of every prize and ${p.salePct}% of any sale still repay it automatically, and Finances takes any payment. ${Number(p.lock) ? "" : "Nothing is locked while you owe any more: signings, fees and gear are open. "}${nextBreachEn(p)}`,
      unlock: (p: Record<string, string | number>) =>
        `The org's progress unlocked: ${p.name}. Check the Club's progression track — the toolbox grows with reputation.`,
      windowReport: (p: Record<string, string | number>) =>
        `The window is shut — ${p.n} moves across all regions. Headline fees: ${p.p1} (${p.f1})${p.p2 ? ` · ${p.p2} (${p.f2})` : ""}${p.p3 ? ` · ${p.p3} (${p.f3})` : ""}. The full wire is on the HQ.`,
      unavailable: (p: Record<string, string | number>) =>
        `${p.player} can't play ${p.event} — the sub takes his seat with his chemistry.`,
      // rc.34 review: with what the next breach does (the career's last loan repaid: the end) — an older mail reads as sent.
      debtCleared: (p: Record<string, string | number> = {}) =>
        `The emergency loan is repaid in full, and its deadline is lifted — the org owns its future again. ${p.next === undefined ? "The bank's door stays open." : nextBreachEn(p)}`,
      retiredToCoach: (p: Record<string, string | number>) =>
        `${p.player} played his final season and steps away from competition — straight into coaching. He is in the coach pool now and can turn up on the coach shortlist.`,
      retiredLeaves: (p: Record<string, string | number>) =>
        `${p.player} played his final season and leaves the scene for good. His slot is open — the market is where the next chapter starts.`,
    },
  },

  // v0.2 scrims — weekday blocks between events. v0.3: schedulable, opponent
  // choice, visible results.
  scrim: {
    title: "Scrim block",
    desc: "A best-of-5 behind closed doors: chemistry reps and light development. Two blocks per week.",
    vs: (opp: string) => `vs ${opp}`,
    run: "Run scrim",
    won: (opp: string, a: number, b: number) => `Scrim W ${a}-${b} vs ${opp}`,
    lost: (opp: string, a: number, b: number) => `Scrim L ${a}-${b} vs ${opp}`,
    usedUp: "No scrim blocks left this week",
    restDay: "No scrims on rest days",
    // RTW-05 (rc.33 review): no scrim with fewer than three players.
    squadShort: "No scrims with fewer than three players — sign a third first.",
    // v0.3 scheduling + results
    planTitle: "Sparring partners",
    planDesc: "Pick the opponent and the day — booked scrims run automatically and show on the calendar.",
    chooseOpponent: "Opponent",
    pickDay: "Day",
    bookCta: "Book scrim",
    booked: (date: string, opp: string) => `Booked: ${date} vs ${opp}`,
    upcoming: "Booked scrims",
    cancel: "Cancel",
    benefit: "What you get",
    projGain: (n: string) => `≈ +${n} OVR per starter`,
    projChem: "+ chemistry reps",
    fieldLevel: (n: number) => `Sparring level ${n}`,
    strongerSide: "Stronger sparring develops faster",
    results: "Recent scrims",
    noResults: "No scrims yet this season.",
    gameLine: (scores: string) => `Games: ${scores}`,
    sameDay: "Already scrimmed this team today.",
    // v2.0 (R29): three sparring tiers, then the full list
    tiers: { easier: "Easier", even: "Even", harder: "Harder" } as Record<string, string>,
    tierHint: {
      easier: "Chemistry reps and a likely win — light XP.",
      even: "A real test. Standard XP.",
      harder: "Stronger sparring develops faster — expect to lose.",
    } as Record<string, string>,
    moreOpponents: "More opponents",
    fewerOpponents: "Fewer opponents",
  },

  calendar: {
    title: "Calendar",
    thisWeek: "This week",
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
    spectate: "Watch results",
    done: "Done",
    stakes: "Stakes",
    prizePool: "Prize pool",
    points: "Season Points",
    field: "Field",
    fieldQuality: "Field level",
    enter: "Enter",
    skip: "Pass",
    skipHint: "Passing keeps the week for training (+25% efficiency).",
    offerTitle: "Tournament invite",
    seasonOverview: "Season overview",
    // v0.2 day view
    monthView: "Month",
    agendaView: "Agenda",
    nextForYou: "Next for you",
    matchday: "Matchday",
    payday: "Payday",
    trainingDay: "Training",
    restDay: "Rest",
    scrimDay: "Scrim",
    legend: "Legend",
    advanceDay: "Advance one day",
    advanceToStop: (label: string) => `Continue — ${label}`,
    seasonEnd: "Season close",
    showWorld: "Show other regions",
    hideWorld: "My schedule only",
    worldEvents: "Around the world",
  },

  squad: {
    title: "Squad",
    starters: "Starters",
    bench: "Bench",
    subSlot: "Substitute",
    coachSlot: "Coach",
    staffRow: "Staff & boosts",
    hire: "Hire",
    emptySub: "No sub — nobody is ruled out without one, but a reserve adds depth to the team rating.",
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
        ? "1 contract ends with this season. Renew it in Squad, or let it run out — he leaves at the rollover."
        : `${n} contracts end with this season. Renew them in Squad, or let them run out — they leave at the rollover.`,
    reviewRenew: "Renew in Squad",
    reviewConfirm: (n: number) => (n === 1 ? "Let him go" : `Let all ${n} go`),
    reviewDone: "Reviewed — they leave at the rollover.",
    reviewHeld: "A decision still waits at HQ — answer it before the new season.",
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
    renewalBoundFresh: "Under the cap — he renews at his market ask.",
    renewalBoundCap: (cap: string) => `Capped at ×${cap} his current wage.`,
    renewalBoundFloor: (floorPct: number) => `Held at ${floorPct}% of his market ask.`,
    renewalBoundJump: (jump: string) => `Held at ×${jump} his current wage — the most one renewal moves it.`,
    renewalTitles: (pct: number) => `+${pct}% for the titles he won with you lately.`,
    renewalAmbition: (pct: number) => `+${pct}% ambition: a star at a smaller org asks more.`,
    renewalBlockbuster: (pct: number) => `+${pct}%: you turned down a Blockbuster bid for him.`,
    renewalsTitle: "Contracts up for renewal",
    renewalsEmpty: "No contract ends this season.",
    renewalsGo: "Renew on Squad",
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
    phase: { growing: "Developing", prime: "At his peak", declining: "Declining", unknown: "Phase ?" },
    phaseUnknownHint: "A scouting report reveals whether he is developing, at his peak or declining.",
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
    title: "Training",
    autoTrain: "Delegate to coach",
    manageMyself: "Manage it myself",
    focus: "Focus",
    balanced: "Balanced",
    auto: "Auto",
    coachEffect: (name: string, pct: number) => `Coach ${name}: ${pct > 0 ? "+" : ""}${pct}% efficiency`,
    noCoach: "No coach — development runs below pace.",
    facilityEffect: (pct: number) => `Gear: +${pct}% efficiency`,
    projection: (v: string) => `+${v} OVR this split`,
    matchXpHint: "Playing strong fields develops players faster than any drill.",
    report: (delta: string) => `Training report: squad ${delta} OVR`,
    // v0.2 — distinct focuses, intensity, weekly rhythm
    weeklyPlan: "Weekly plan",
    weeklyPlanHint: "Sessions run Monday to Friday. Weekends are for matches.",
    perWeekOverall: (v: string) => `+${v} OVR / week`,
    perWeekOffset: (v: string, stat: string) => `+${v} ${stat} / week`,
    focusHintBalanced: "Pure overall growth — nothing sharpened.",
    focusHintAttr: "Trades a slice of overall growth to sharpen one attribute.",
    focusHintAuto: "The coach picks each week's emphasis — near-optimal, hands-free.",
    intensity: "Intensity",
    intensityLight: "Light",
    intensityNormal: "Normal",
    intensityHeavy: "Heavy",
    intensityLightHint: "-40% development, zero fatigue risk.",
    intensityNormalHint: "The standard block.",
    intensityHeavyHint: "+35% development — adds a small, telegraphed absence risk before events.",
    fatigueWarning: "Heavy sessions raise the pre-event absence risk",
    sessionToday: "Today's session",
    noSessionToday: "No session today",
    // rc.34 (DEV-03 §4b): the engine trains a committed week at half load (matchPrepShare) — the copy said it paused.
    matchPrepWeek: "Match week — sessions run at half load; the event pays match XP on top",
    // v2.0 training rework (R27–R29)
    drillTitle: "This week's drill",
    drillHint: "One team drill per week: everyone sharpens the drill's attribute on top of their own focus, and sessions run a little hotter.",
    drillNone: "No drill set — sessions run the base plan.",
    drillByCoach: (name: string) => `Picked by coach ${name}`,
    drillEffect: (offset: string, stats: string, pct: number) => `+${offset} ${stats} / week for the whole squad · +${pct}% overall`,
    drillClear: "No drill",
    drills: {
      "mechanics-lab": "Mechanics lab",
      rotations: "Rotations",
      "set-plays": "Set plays",
      "film-room": "Film room",
      "clutch-sets": "Clutch sets",
    } as Record<string, string>,
    drillsDesc: {
      "mechanics-lab": "Aerial car control, flip resets, speed — the high-roll stat.",
      rotations: "Back-post discipline and shadowing — defense.",
      "set-plays": "Kickoffs, passing plays, pressure — offense.",
      "film-room": "VOD review and scenarios — consistency and experience.",
      "clutch-sets": "Game-7 scenarios under pressure — clutch.",
    } as Record<string, string>,
    growth: "Growth",
    nextPoint: (ovr: number) => `Next: ${ovr} OVR`,
    etaDays: (days: number) => (days === 1 ? "≈ 1 training day away" : `≈ ${days} training days away`),
    etaNone: "Not moving — capped or at potential",
    etaAtPotential: "At potential — nothing left to learn here",
    capLine: (split: string, splitMax: number, season: string, seasonMax: number) =>
      `This split +${split} of ${splitMax} · season +${season} of ${seasonMax}`,
    // rc.32 (DEV-01): the growth contract has a season cap only, a peak and a decline.
    capLineSeason: (season: string, seasonMax: number) => `This season +${season} of ${seasonMax}`,
    etaAtPeak: "At his peak — he holds this level for now",
    declineLine: (perWeek: string) => `Past his prime: about −${perWeek} OVR a week`,
    effectsTitle: "What your attributes do",
    effectsHint: "Team stat line → the exact modifiers the match sim applies. Train what your results need.",
    effectWhen: {
      always: "every game",
      deciding: "deciding games",
      playoffs: "playoff games",
      badRolls: "softens bad rolls",
      proc: "high-roll chance",
    } as Record<string, string>,
    effectRating: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} rating`,
    effectPct: (v: number) => `${v}%`,
    // rc.35 (front T, Miguel): the simplified training cycle — objective + intensity + scrims.
    cycle: {
      title: "Training cycle",
      cycleOf: (n: number, count: number) => `Cycle ${n} of ${count}`,
      dayOf: (day: number, len: number) => `Day ${day} of ${len}`,
      daysLeft: (n: number) => (n === 1 ? "1 day left" : `${n} days left`),
      endsOn: (date: string) => `Ends ${date}`,
      running: "Running now",
      by: { coach: "Coach's plan", user: "Your plan", auto: "Auto plan", base: "Base growth" } as Record<string, string>,
      baseLine: "No plan: everyone grows at the base pace. Never a penalty.",
      controllerCoach: (name: string) => `${name} plans and starts every cycle. You can adjust it.`,
      // rc.36 (front T2): a hired coach who no longer plans — he only recommends.
      controllerCoachOff: (name: string) => `You start each cycle. ${name}'s plan is tagged Recommended.`,
      controller: {
        auto: "Easy: the best plan is tagged Recommended. Start it when you like.",
        recommend: "Normal: the most effective option in each step is tagged Recommended.",
        manual: "Hard: you pick everything. No recommendation.",
      } as Record<string, string>,
      steps: { objective: "Objective", focus: "Focus", intensity: "Intensity", scrims: "Scrims" } as Record<string, string>,
      // rc.36 (front T2, Miguel): Evolve / Gel / Recover.
      objectives: { development: "Evolve", preparation: "Gel", recovery: "Recover" } as Record<string, string>,
      objectiveEffect: {
        development: "Faster growth toward each player's peak.",
        preparation: "Scrims build chemistry faster, with a little growth.",
        recovery: "Less wear. Veterans hold their level longer.",
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
      focusBalanced: "Overall growth only. Nothing sharpened.",
      focusEffect: (stats: string, perWeek: string) => `+${perWeek} ${stats} a week, everyone.`,
      focusHint: "One attribute everyone sharpens. It costs no overall growth.",
      scrimsHint: "Practice only: no points, prizes or reputation.",
      intensities: { light: "Light", normal: "Normal", heavy: "Heavy" } as Record<string, string>,
      intensityEffect: {
        light: "Half the boost, 40% less wear.",
        normal: "The standard boost. No added risk.",
        heavy: "1.5× the boost. Raises the absence risk.",
      } as Record<string, string>,
      scrimChoices: { off: "None", easy: "Easy", even: "Even", hard: "Hard" } as Record<string, string>,
      scrimEffect: {
        off: "No scrims, no scrim wear.",
        easy: "Confidence, little wear.",
        even: "The most chemistry.",
        hard: "The most learning. Raises the absence risk.",
      } as Record<string, string>,
      // rc.36 (front T2): nothing runs until a plan is picked and started.
      pickTitle: "Choose this cycle's plan",
      pickHint: "Nothing runs until you start a plan. Meanwhile everyone grows at the base pace.",
      idle: "No plan running",
      idleLine: "Your squad grows at the base pace. Start a plan to speed it up.",
      choosePlan: "Choose a plan",
      start: "Start training",
      applyChanges: "Apply changes",
      pickAll: "Pick one option in each step to start.",
      useRecommended: "Use the recommended plan",
      sameAgain: "Same plan as last cycle",
      runsTo: (date: string, days: number) => `Runs to ${date} · ${days === 1 ? "1 day" : `${days} days`}`,
      fromTomorrow: "Today's session already ran: it starts tomorrow.",
      startsTomorrow: "Starts tomorrow",
      promised: (v: string) => `+${v} OVR promised`,
      promiseTitle: "Cycle gain",
      promiseLine: (paid: string, total: string) => `+${paid} of +${total} OVR`,
      onCompletion: (v: string) => `+${v} lands when the cycle completes`,
      legend: { paid: "Earned", toCome: "To come", completion: "On completion" } as Record<string, string>,
      adjustHint: "Adjusting keeps what is earned. The completion part still lands at the end.",
      coachPlans: (name: string) => `${name} plans each cycle`,
      coachPlansHint: "Off: he only tags his plan Recommended, and you start each cycle.",
      riskLine: (pts: string) => `Absence risk before each event: +${pts} pts`,
      scrimsAWeek: (n: number) => `${n} a week · practice only`,
      recommended: "Recommended",
      expected: "Expected result",
      expectedGain: (v: string) => `+${v} OVR`,
      expectedHint: "Starters' average to the cycle's end. Official series add more.",
      perPlayer: "Per player",
      risk: (pts: string) => `+${pts} pts absence risk`,
      noRisk: "No added absence risk",
      apply: "Apply plan",
      adjust: "Adjust plan",
      useBase: "Use the base",
      cancel: "Cancel",
      keepPlan: "Keep my plan next cycle",
      keepPlanHint: "Off: the next cycle starts on the base.",
      progress: "This cycle so far",
      gained: (v: string) => `+${v} OVR avg`,
      scrimsDone: (done: number, planned: number) => `${done} of ${planned} scrims`,
      record: (w: number, l: number) => `${w}–${l}`,
      lastCycle: "Last cycle",
      lastNone: "No cycle finished yet",
      history: "Past cycles",
      historyEmpty: "Your first report lands when this cycle ends.",
      noCoach: "No coach: a plan lands at half strength",
      hireCoach: "Hire a coach",
      coachBoost: (pct: number) => `+${pct}% from your coach`,
      sessions: "Sessions",
      scrims: "Scrims",
      series: "Series",
      chemistry: "Chemistry",
      wear: "Wear",
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
        planNext: "Plan the next cycle",
        coachNext: (name: string) => `${name} has started the next cycle.`,
        joined: "Joined mid-cycle",
        players: "Player by player",
      },
      coach: {
        quality: "Quality",
        experience: "Experience",
        specialty: "Specialty",
        qualityEffect: (pct: number) => `${pct}% of a plan lands`,
        experienceEffect: (seasons: number) => (seasons === 1 ? "1 season" : `${seasons} seasons`),
        experienceHint: (pct: number, wear: number) => `His own plan lands at ${pct}% · −${wear}% wear`,
        specialtyEffect: (pct: number) => `+${pct}% on this objective`,
        expected: "Per starter, next cycle",
        vsNow: (v: string) => `${v} vs now`,
        same: "Same as now",
        wage: "Wage",
        exPro: "Ex-pro",
        staff: "Staff coach",
      },
    },
    // rc.34 (DEV-03, TRAINING-CONTRACT): one training package per period.
    plan: {
      title: "Training plan",
      periodOf: (n: number, count: number) => `Period ${n} of ${count}`,
      dayOf: (day: number, len: number) => `Day ${day} of ${len}`,
      daysLeft: (n: number) => (n === 1 ? "1 day left" : `${n} days left`),
      runsTo: (date: string, days: number) => `Runs to ${date} · ${days === 1 ? "1 day" : `${days} days`}`,
      base: "Base growth",
      baseHint: "No package: every player grows at the base — his training days plus the series he plays. Never a penalty.",
      by: { coach: "Set by the coach", user: "Set by you", base: "No package" } as Record<string, string>,
      objective: "Objective",
      objectives: { development: "Development", preparation: "Competitive prep", recovery: "Recovery" } as Record<string, string>,
      objectiveHint: {
        development: "Faster growth toward each player's expected peak, and the focus attributes.",
        preparation: "Chemistry and sharper scrims for the period's events — little extra growth.",
        recovery: "Less wear, and players past their peak hold their level longer.",
      } as Record<string, string>,
      focus: "Squad focus",
      balanced: "Balanced",
      focusHint: (offset: string) => `Everyone who follows it grows the focus attributes +${offset} a week. Balanced shapes nothing.`,
      workload: "Workload",
      workloads: { light: "Light", normal: "Normal", heavy: "Heavy" } as Record<string, string>,
      workloadHint: {
        light: "Half the boost, 40% less wear.",
        normal: "The standard load.",
        heavy: "1.5× the boost, +1 wear a week.",
      } as Record<string, string>,
      scrims: "Scrims",
      scrimsPerWeek: (n: number) => (n === 0 ? "None" : n === 1 ? "1 a week" : `${n} a week`),
      scrimDaysHint: "Tuesday, Thursday, Wednesday for a third — never on a matchday. Practice only: no points, prizes or reputation.",
      levels: { easy: "Easy", even: "Even", hard: "Hard", auto: "Coach picks" } as Record<string, string>,
      levelHint: {
        easy: "Confidence (+consistency) and less wear; little growth.",
        even: "Synergy: the most chemistry, a moderate return.",
        hard: "The most learning, more wear and risk.",
        auto: "The level the objective calls for.",
      } as Record<string, string>,
      tweaks: "Player tweaks",
      tweaksHint: "Optional — only players who differ from the squad plan.",
      followSquad: "Follows the squad",
      rest: "Rest",
      restHint: "Trains at the base, no scrims, no wear.",
      tweakFocus: (stat: string) => `Own focus: ${stat}`,
      tweakWorkload: (w: string) => `${w} load`,
      ownFocus: "Own focus",
      ownLoad: "Own load",
      carryHint: "Your old per-player focus and intensity are filled in as tweaks.",
      projection: "What this package does",
      projectionHint: "Read from the engine that runs it — sessions and scrims to the period's end. Official series come on top.",
      perPlayer: (gain: string) => `+${gain}`,
      startersAvg: (gain: string) => `Starters ≈ +${gain} OVR this period`,
      wearLine: (wear: string, pts: string) => `Wear ${wear} · +${pts} pts absence risk before each event`,
      noWear: "No wear — no added absence risk",
      daysLine: (sessions: number, scrims: number) =>
        `${sessions === 1 ? "1 session" : `${sessions} sessions`} · ${scrims === 1 ? "1 scrim" : `${scrims} scrims`}`,
      apply: "Apply",
      applyHint: (date: string) => `Runs from ${date} to the period's end, then repeats if "Repeat" is on.`,
      useProposal: "Load the coach's plan",
      keepBase: "Keep the base",
      edit: "Adjust",
      cancel: "Cancel",
      mode: "Who decides",
      repeat: "Repeat until I change it",
      repeatHint: "The package runs again next period.",
      proposalTitle: (name: string) => `${name}'s plan for this period`,
      proposalReason: {
        default: "Development by default.",
        event: "A Major or Worlds falls in this period — preparation first.",
        wear: "Wear ran high last period — recovery first.",
      } as Record<string, string>,
      approve: "Approve",
      decisionLine: "The clock waits for your answer.",
      coachLine: (name: string, pct: number) => `${name} · +${pct}% on this package`,
      coachless: "No coach: a package lands at half strength.",
      planQuality: (pct: number) => `Running it alone, his plan lands at ${pct}%`,
      progress: "This period so far",
      soFar: (sessions: string, scrims: string, series: string) => `Sessions +${sessions} · scrims +${scrims} · series +${series}`,
      scrimRecord: (w: number, l: number) => `Scrims ${w}–${l}`,
      history: "Period reports",
      historyEmpty: "No period filed yet — the first report lands when the next period starts.",
      summaryTitle: (n: number, season: string) => `Period ${n} · ${season}`,
      summaryAvg: (avg: string) => `Squad ${avg} avg`,
      seriesPlayed: (n: number) => (n === 1 ? "1 series" : `${n} series`),
      coachShare: (gain: string) => `coach +${gain}`,
      wear: (w: string) => `wear ${w}`,
      unavailable: "ruled out once",
      joined: "joined mid-period",
      chemistry: (a: number, b: number) => `Chemistry ${a}% → ${b}%`,
      coachDays: (name: string, days: number, gain: string) => `${name}: ${days === 1 ? "1 day" : `${days} days`}, +${gain}`,
      next: (o: string) => `Next period: ${o}`,
      notes: {
        joined: (p: Record<string, string | number>) => `${p.player} joined the plan`,
        coachHired: (p: Record<string, string | number>) => `${p.coach} took over the plan`,
        coachFired: (p: Record<string, string | number>) => `${p.coach} left — the plan ran on at the coachless rate`,
        objectiveChange: () => "The objective changed mid-period",
        // rc.36 (front T2): a cycle stopped before its end forfeits its held gain.
        cycleStopped: (p: Record<string, string | number>) => `The cycle stopped early: +${p.lost} held was forfeited`,
        coachEvent: () => "The coach planned preparation for the period's big event",
        coachWear: () => "The coach planned recovery after a heavy period",
      } as Record<string, (p: Record<string, string | number>) => string>,
      wearBand: { low: "wear low", mid: "wear moderate", high: "wear high" } as Record<string, string>,
      squadGrowth: "Squad growth",
    },
  },

  market: {
    title: "Market",
    freeAgents: "Free agents",
    contracted: "Under contract",
    myDeals: "My deals",
    windowClosed: "Market closed",
    windowClosedHint: (label: string) => `Transfer window opens ${label}`,
    scoutingOpen: "Scouting stays open between windows.",
    // RTW-05 (rc.33): a squad under three signs a free agent into the empty seat, window or not.
    emptySeatOpen: "Your squad is short of three: a free agent can take the empty seat today, window or not.",
    // RTW-05 (rc.33 review): the free agent the empty seat always takes, whatever the balance (careerFlow.emptySeatPriceFor).
    emptySeatCheapest: (name: string, wage: string) =>
      `Short of money? ${name} (${wage} / week), the cheapest free agent you can sign, always takes the empty seat.`,
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
    lengthLabel: "Contract length",
    seasons: (n: number) => (n === 1 ? "1 season" : `${n} seasons`),
    starter: "Starter",
    sub: "Sub",
    signCta: "Sign",
    offerSent: "Deal registered — resolves on the next advance.",
    signed: (name: string) => `${name} signs for the org`,
    rejected: (name: string) => `${name} declined the terms`,
    recommendedShelf: "Recommended signings",
    recommendedWhy: (reason: string) => `Fits: ${reason}`,
    affordable: "Affordable now",
    incomingBid: "Incoming offer",
    bidFrom: (org: string) => `${org} bid`,
    accept: "Accept",
    decline: "Decline",
    blockbuster: "Blockbuster",
    // rc.33 (UX-07): the Blockbuster explained in one sentence, on a Blockbuster bid only
    // (its refusal cost included — CAREER_SALARY.blockbusterRefusalRenewalMult).
    blockbusterWhat: (org: string, mult: string, pct: number) =>
      `A Blockbuster is one of the season's scripted moments: ${org} pay ×${mult} his market value, and if you refuse it or let it expire he stays, but his next renewal asks ${pct}% more.`,
    consequences: "After this deal",
    balanceAfter: (s: string) => `Balance after: ${s}`,
    // rc.32 (M4, provisional): the runway a signing leaves.
    runwayAfter: (weeks: number | null) =>
      weeks === null
        ? "Runway after: the books stay in the black"
        : `Runway after: ${weeks === 1 ? "1 week" : `${weeks} weeks`} at the new burn`,
    // ECO-02 (R46): a sale while the Backer is owed — its share of the fee.
    saleBackerRepaid: (s: string) => `Emergency loan repaid ${s}`,
    // ECO-03 (R47): the slot is set after the signing and never prices it.
    slotLabel: "Squad slot",
    slotStarter: "Takes an open seat in the starting three.",
    slotReserve: "Joins as the sub. Promote him on the Squad screen at any time — the contract stays the same.",
    samePrice: "Same price as a starter: the slot never changes the contract.",
    // rc.33 (UX-07): a full squad only warns and points to Squad; the signing waits for a free seat.
    squadFullWarn: (cap: number) =>
      `Your squad is full (${cap} of ${cap}). Release or sell a player on the Squad screen, then sign him.`,
    toSquad: "Go to Squad",
    // DEV-02 (R48): a signing whose current season must be his last.
    finalSeasonDeal: "Final season: he retires when this season ends — a 1-season deal only.",
    payrollWeek: (now: string, after: string) => `Wage bill: ${now} → ${after} / week`,
    coachEffects: "What this coach does",
    // rc.34 (DEV-03 T4): his effect lands through the period's package — no package = the base, coach or not.
    coachTraining: (pct: number) => `+${pct}% on a Development package`,
    coachRating: (n: number) => `+${n} team rating in every series`,
    coachNoneEffects: (pct: number) =>
      `No coach: growth runs at the base as always, and a training package lands at half strength (+${pct}% on Development).`,
    // rc.34 (DEV-03 T4): the hire card — three attributes, each with the effect it has.
    coachQuality: (q: number) => `Quality ${q}`,
    coachQualityEffect: (pct: number) => `Focus efficiency ${pct}%: the share of a package's effect that lands`,
    coachExperience: (n: number) => (n === 1 ? "1 season" : `${n} seasons`),
    coachExperienceEffect: (pct: number, wear: number) =>
      `Plan quality ${pct}% when he runs it alone${wear > 0 ? ` · wear −${wear}%` : ""}`,
    coachSpecialty: (o: string) => `Specialty: ${o}`,
    coachSpecialtyEffect: (o: string, pct: number) => `+${pct}% on ${o} packages`,
    coachPackage: (o: string, pct: number) => `Your ${o} package: +${pct}% with him`,
    coachImpact: (gain: string) => `≈ ${gain} OVR per starter over the next period vs your current setup`,
    coachImpactSame: "About the same as your current setup over the next period",
    coachBestCard: (card: number) => `Best card as a player: ${card}`,
    coachGrows: (ceiling: number) => `Grows with each season he coaches (up to ${ceiling})`,
    coachCompare: "Compare",
    shopHim: "Shop him",
    shopHimHint: "Signals availability — expect bids in the next window.",
    quickFlipWarning: "Recently signed — sells at a discount.",
    // v0.2 — coach market + browsing tools
    coaches: "Coaches",
    coachRealTag: "Former pro",
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
    filterSignable: "Signable at my reputation",
    filterSignableCount: (n: number) => `${n} ${n === 1 ? "player" : "players"} within reach`,
    /** rc.35 (front C): an org signed him in this window. */
    justSignedTag: "Just signed",
    viewSheet: "View sheet",
    noResults: "No players match the filters.",
    dealsEmpty: "No active deals. Offers land here when a window is open.",
    // v0.3 rep-gated signings (visible lock)
    lockedAtRep: (rep: number) => `Signs at ${rep} reputation`,
    lockedHint: "Players of this level won't join the org yet — reputation opens the door.",
    coachLockedAt: (rep: number) => `Coach hiring unlocks at ${rep} reputation`,
    exProLockedAt: (rep: number) => `Ex-pro coaches unlock at ${rep} reputation`,
    // rc.33 (ECO-10 + ECO-11): the contract talk — two levers, the zone shown, one answer.
    negotiation: {
      title: "Contract talk",
      // rc.35 (front N): the visual talk — a third lever, the odds meter, the length relief.
      bonus: "Signing bonus",
      bonusAsk: (amount: string) => `Asks ${amount}`,
      bonusDown: "Lower the signing bonus",
      bonusUp: "Raise the signing bonus",
      shareAskNone: "Asks none",
      odds: "Chance he signs",
      oddsSure: "Sure",
      zoneLegend: "Signs for sure",
      riskLegend: "Maybe",
      lengthRelief: (perWeek: string, seasons: number) => `${seasons}-season deal: ${perWeek} / week off his floor`,
      refuses: (wage: string) => `He refuses — he signs at ${wage} / week`,
      upfront: (amount: string) => `+ ${amount} up front`,
      perWeek: "/ week",
      fullAsk: "Pay his ask",
      wage: "Weekly wage",
      share: "Prize share",
      shareHint: "His cut of every podium prize the team wins (top four of a regional, Major or Worlds).",
      shareAsk: (pct: number) => `He asks ${pct}%`,
      // rc.33 review: a share point is priced in weekly money (contract.sharePointWeeklyFor).
      trade: (perWeek: string) => `Each share point you give him is worth ${perWeek} a week of his wage.`,
      // rc.33 review: each stepper names its own lever for screen readers.
      wageDown: "Lower the weekly wage",
      wageUp: "Raise the weekly wage",
      shareDown: "Lower his prize share",
      shareUp: "Raise his prize share",
      zone: (floor: string, top: string) => `At this share he signs from ${floor} to ${top} a week.`,
      zoneFixed: (top: string) => `At this share he signs only at his ask, ${top} a week.`,
      signs: (wage: string, pct: number) => `He signs: ${wage} / week + ${pct}% of podium prizes`,
      // rc.34 (front I): a deal with no prize share (he asks none, or the talk took it to 0 %).
      signsNoShare: (wage: string) => `He signs: ${wage} / week, no prize share`,
      counter: (wage: string, pct: number) => `Under his floor — he counters at ${wage} / week with ${pct}%`,
      counterNoShare: (wage: string) => `Under his floor — he counters at ${wage} / week`,
      // rc.34 (front I): why a lever stops, under the button it closes (contract.TalkLimits).
      why: {
        floor: "His floor",
        minimum: "League minimum",
        ask: "His full ask",
        shareLeast: "The least he takes",
        shareMost: "The most he takes",
        shareMinimum: "Wage at the minimum",
        noShare: "No share",
      },
      takeCounter: "Take his counter",
      saves: (s: string) => `${s} / week under his ask`,
      costs: (s: string) => `${s} / week over his ask, for a smaller share`,
    },
    errors: {
      windowClosed: "The transfer window is closed.",
      alreadySigned: "Already on the squad.",
      squadFull: "Squad is full — release or sell first.",
      unavailable: "Player unavailable.",
      funds: "Not enough money for this deal.",
      loanActive: "No fee transfers while the emergency loan is owed.",
      bankActive: "One bank loan at a time — clear the current one first.",
      bankBacker: "The bank writes no other loan while its emergency loan is open — repay that one first.",
      bankAmount: "Enter a valid amount.",
      bankLimit: "That is above what the bank offers at your reputation.",
      unknown: "That deal is no longer available.",
      locked: "Locked for now.",
      maxed: "Already at the maximum.",
      used: "Already used.",
      restDay: "Not on a rest day.",
      /** RTW-05 (rc.33 review): a scrim with fewer than three players. */
      squadShort: "No scrims with fewer than three players — sign a third first.",
      blocked: "Not right now.",
      none: "Nothing to do.",
      invalid: "Invalid selection.",
      repGate: "The org's reputation is too low for a player of this level.",
      /** rc.35 (front C): an org signed him in this window. */
      justSigned: "He just signed elsewhere in this window — try again in the next one.",
      /** rc.35: an ex-pro coach before his ladder rung. */
      exProGate: "Ex-pro coaches need more reputation — the progression ladder shows when.",
      // rc.33 (ECO-11): an offer under his floor — the sheet shows his counter.
      negotiationCounter: "That is under his floor — take his counter or raise the offer.",
      sameDay: "Already scrimmed this team today.",
      /** rc.30: signing, releasing or selling during an event in progress. */
      rosterLocked: "Roster moves wait until the event ends.",
      /** DEV-02 (R48): the minimum competitive age. */
      tooYoung: "Too young to compete — players sign from age 13.",
      /** rc.32 (M4): the lock on commitments that shorten the runway (off since rc.34 — CAREER_LOAN.lockCommitments). */
      loanRunway: "While the emergency loan is owed, nothing that shortens the runway — repay it or free some wages first.",
    },
  },

  finances: {
    title: "Finances",
    balance: "Balance",
    net: "Net / week",
    projected: "Projected after Monday",
    weeklyStatement: "Weekly statement",
    statementHint: "Every Monday the books move: sponsor, merch and streams in; wages, staff, upkeep and instalments out.",
    runway: (weeks: number) => (weeks === 1 ? "Runway: 1 week at this burn" : `Runway: ${weeks} weeks at this burn`),
    runwayOk: "The books run in the black",
    nextPayday: (s: string) => `Next payday ${s}`,
    // rc.33 (UX-07): the balance chart's expanded view — the Mondays the save recorded.
    chartOpen: "Open the balance chart",
    chartTitle: "Balance history",
    chartRange: (n: number, from: string, to: string) =>
      n === 1 ? `One Monday on record: ${from}.` : `${n} Mondays on record, ${from} to ${to}.`,
    chartEmpty: "The chart fills in from Monday to Monday — come back after the next payday.",
    chartLegendBalance: "Balance after Monday's payroll",
    chartLegendFloor: "The floor (a Monday below it is a breach)",
    chartLegendSeason: "Season start",
    chartHigh: (s: string) => `High ${s}`,
    chartLow: (s: string) => `Low ${s}`,
    chartFloor: (s: string) => `Floor ${s}`,
    chartColSeason: "Season",
    chartColLow: "Low",
    chartColHigh: "High",
    chartColLast: "Last Monday",
    chartSummary: (n: number, first: string, last: string, low: string, high: string) =>
      `Balance over ${n} Mondays: from ${first} to ${last}, low ${low}, high ${high}.`,
    chartClose: "Close",
    line: {
      sponsorBase: "Sponsor base",
      foundingPartner: "Founding partner",
      rescuePartner: "Investor",
      // rc.35 (front N): the reputation-tied income reads as what it models — jerseys, streams, content.
      fanbase: "Merch & streams",
      payroll: "Squad wages",
      coach: "Coach",
      psychologist: "Sports psychologist",
      upkeep: "Facility upkeep",
      bankPayment: "Bank instalment",
      // rc.34 (ECO-04): a missed goal's fine, in Monday instalments.
      sponsorFine: "Sponsor fine",
    },
    loans: "Loans & debt",
    // rc.34: one bank, two loans — the voluntary one and the emergency one.
    loansHint: "One bank, two loans: a voluntary loan on your terms, and an emergency loan when the books break the floor.",
    // The next breach of the floor ends the career — no emergency loan to fall back on.
    loansHintEnd: "One way to borrow: the bank's voluntary loan. No emergency loan is left — the next breach of the floor ends the career.",
    bankTitle: "Bank loan",
    bankNone: "No bank loan open",
    bankHint: (weeks: number, pct: number) =>
      `A line of credit sized by reputation, repaid in ${weeks} weekly instalments with ${pct}% interest. Plan it — the emergency loan is the bank's last resort, and it comes with a deadline.`,
    bankHintEnd: (weeks: number, pct: number) =>
      `A line of credit sized by reputation, repaid in ${weeks} weekly instalments with ${pct}% interest. Plan it — no emergency loan stands behind it: the next breach of the floor ends the career.`,
    bankAvailable: (s: string) => `Available now: up to ${s}`,
    bankTerms: (weekly: string, weeks: number, total: string) =>
      `${weekly} / week for ${weeks} weeks · ${total} total`,
    bankRequest: "Request loan",
    bankAmount: "Principal",
    bankRemaining: (s: string) => `Bank: ${s} to repay`,
    bankWeekly: (s: string) => `${s} / week instalment`,
    bankPayEarly: "Pay the bank early",
    bankBlockedActive: "One bank loan at a time — clear this one first.",
    bankLockedRep: "The bank opens its doors once the org has a little reputation.",
    // ECO-02 (R46): the bank's schedule, as the Monday payroll books it.
    bankNext: (amount: string, date: string) => `Next instalment ${amount} on ${date}`,
    bankLeft: (n: number) => (n === 1 ? "last instalment" : `${n} instalments left`),
    // ECO-02 (R46): a pay-down that leaves the balance below zero warns first. rc.34: the bank's loan.
    payRiskBacker: (floor: string) =>
      `This leaves the books in the red. Below ${floor} on a Monday, the bank's emergency loan steps in — with a deadline.`,
    payRiskEnd: (floor: string) =>
      `This leaves the books in the red. Below ${floor} on a Monday, the career ends — there is no second rescue.`,
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
      fanbase: "Merch & streaming revenue",
      payroll: "Squad wages",
      bankLoan: "Bank loan received",
      bankPayment: "Bank instalment",
      insert: "Side event",
      // rc.34 (ECO-04): a Bold deal's milestone payment and a missed goal's fine instalment.
      sponsorMilestone: "Sponsor milestone",
      sponsorFine: "Sponsor fine",
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
      profileHint: {
        steady: "Most of the money is sure. A small bonus per goal, no fines.",
        balanced: "A solid weekly base, a real bonus per goal, a small fine for a miss.",
        bold: "Less sure money, a big bonus per goal and a payment the day you reach the first. A miss is fined.",
      } as Record<string, string>,
      word: SPONSOR_WORD_EN,
      rowStability: "Stability",
      rowTotal: "Total return",
      rowLength: "Length",
      rowRisk: "Risk",
      rowGoal: "Goal",
      // rc.35 (front S): the visual comparison — one band per row, icons first.
      rowWeekly: "Weekly pay",
      rowUpfront: "Up front",
      rowBonus: "Bonus per goal",
      rowFine: "Fine if missed",
      upfrontSigning: "on signing",
      upfrontMilestone: "at 1st goal",
      upTo: (s: string) => `up to ${s}`,
      noFine: "None",
      lengthShort: (splits: number) =>
        splits === 1 ? "1 split" : splits === 3 ? "1 season" : splits === 6 ? "2 seasons" : `${splits} splits`,
      difficultyMeter: (word: string) => `Goal difficulty: ${word}`,
      profileTag: { steady: "Safest", balanced: "Middle ground", bold: "Biggest pay" } as Record<string, string>,
      compareRule: "More money, harder goal, bigger fine.",
      boldLocked: "Bold deals open as your reputation grows.",
      globalSponsor: "Global",
      nextPay: "Next payment",
      noNextPay: "Last one paid",
      finesNone: "No fines owed",
      finesShort: (mondays: number) => `over ${mondays} Mondays`,
      seasonFineCap: (s: string) => `Fines never pass ${s} a season`,
      dealRun: (paid: number, total: number) => `${paid} of ${total} Mondays paid`,
      weeklySure: (s: string) => `${s} a week, sure`,
      plusSigning: (s: string) => `+ ${s} on signing`,
      plusMilestone: (s: string) => `+ ${s} the day you reach a first goal`,
      total: (sure: string, upTo: string) => `${sure} sure · up to ${upTo}`,
      length: (splits: number, date: string) =>
        `${splits === 1 ? "One split" : splits === 3 ? "One season" : splits === 6 ? "Two seasons" : `${splits} splits`} · ends ${date}`,
      riskSteady: (n: number) => `No fines · ${n} missed goals lower the next offer a tier`,
      riskFine: (s: string, mondays: number) => `A missed goal costs up to ${s}, paid over ${mondays} Mondays`,
      riskNone: "No fines on this difficulty",
      goal: sponsorGoalEn,
      goalBy: (date: string) => `by ${date}`,
      laterGoals: "Then a new goal every split, at the same difficulty",
      sign: "Sign",
      decideBy: (date: string) => `Sign by ${date} — after that the offers lapse.`,
      compareHint:
        "All three are worth about the same on average. They differ in how sure the money is, how long they run and what they ask.",
      // rc.34: a Tier 3 / 4 brand pays a side below its level less (sponsorDeals.levelValueShareOf).
      levelScaled: (tier: number, pct: number) =>
        tier >= 4
          ? `Tier 4 brands pay world contenders in full — at the team's level today, they offer ${pct}% of that.`
          : tier === 3
            ? `Tier 3 brands pay a side that holds its own at a Major in full — at the team's level today, they offer ${pct}% of that.`
            : `Tier 2 brands pay a regional top-8 side in full — at the team's level today, they offer ${pct}% of that.`,
      stabilityBar: (pct: number) => `${pct}% of the most it pays is sure`,
      handover: (first: number, second: number) =>
        `Your founding partner steps back once this deal starts: ${first}%, then ${second}% of its pay, one split each.`,
      // rc.34 review (S6): before season index 2 signing does not start the handover — the partner pays in full through its term.
      handoverLater: (season: string, first: number, second: number) =>
        `Your founding partner pays in full through the end of ${season}, whatever you sign; then it steps back: ${first}%, then ${second}% of its pay, one split each.`,
      handoverNet: (delta: string, date: string) => `Net weekly change at the handover (${date}): ${delta}`,
      activeTitle: "Current deal",
      endsOn: (date: string) => `Ends ${date}`,
      signingPaid: (s: string) => `${s} paid on signing`,
      milestonePending: (s: string) => `${s} the day you reach a first goal`,
      milestonePaid: (s: string) => `Milestone of ${s} paid`,
      thisGoal: "This split's goal",
      nextGoal: (date: string) => `The next goal is set on ${date}`,
      progress: (done: number, target: number) => `${done} of ${target}`,
      goalReached: "Reached",
      goalMissed: "Missed",
      goalOpen: "Open",
      bonusIfHit: (s: string) => `${s} if reached`,
      fineIfMissed: (s: string) => `up to ${s} if missed`,
      record: (hits: number, misses: number) => `Goals so far: ${hits} reached, ${misses} missed`,
      finesOwed: (s: string, mondays: number) => `Fines still to pay: ${s} over the next ${mondays} Mondays`,
      fineFloorNote: "An instalment never takes the books below the bank's floor.",
      otherIncome: "Other income",
      otherIncomeLine: (taken: string, cap: string, n: number, max: number) =>
        `${taken} of ${cap} this season · ${n} of ${max} this split`,
      otherIncomeHint: (pct: number, max: number) =>
        `Showmatches and partner days pay outside the guaranteed income — at most ${pct}% of the season's earnings, ${max} a split.`,
    },
    // rc.34 (Miguel, 31/10): the bank's emergency loan (rc.31–rc.33: the Emergency Backer).
    backer: "Emergency loan",
    backerRemaining: (s: string) => `Emergency loan: ${s} to repay`,
    backerLine: (pct: number) => `Repaid from prize money (${pct}%) and sales — or pay it down below`,
    // v0.3 debt pay-down
    backerSaleLine: (pct: number) => `Player sales repay ${pct}% automatically`,
    payDebt: "Repay the loan",
    payDebtAll: (s: string) => `Pay it all (${s})`,
    payDebtAmount: "Amount",
    payDebtHint: "Repaid in full before the deadline, the loan closes and the deadline is lifted.",
    debtCleared: "Loan repaid — the deadline is lifted.",
    backerWarning: "This deal likely breaks the floor: the bank's emergency loan would step in, with a deadline.",
    // rc.33 review (ECO-08): the same risk where the next breach ends the career.
    endsCareerWarning: "This deal likely ends the career: the next breach of the floor is the last.",
    // rc.34: the rule when nothing is owed — the floor, the loan back to the rescue target, the term (null = none).
    backerIdle: (floor: string, rescueTo: string, term: number | null) =>
      `Not in use. If a Monday closes below ${floor}, the bank lends the balance back to ${rescueTo}${term !== null ? `, to be repaid within ${term} weeks` : ""} — prizes and sales repay part of it automatically.`,
    // CAREER_LOAN.breachesToEnd ends this difficulty's careers at the first breach — no emergency loan.
    backerIdleNone: (floor: string) =>
      `No emergency loan on this difficulty: a Monday that closes below ${floor} ends the career.`,
    backerRescued: "The last emergency loan is repaid.",
    insolvencyWarning: "The books are failing — the next breach of the floor ends the career.",
    // rc.32 (M4): the line in weeks of wages.
    backerWeeksLine: (floorWeeks: number, rescueWeeks: number) =>
      `The line moves with the wage bill: the floor is ${floorWeeks} weeks of wages below zero; the emergency loan tops the balance up to ${rescueWeeks} weeks above.`,
    // rc.34: the whole rule on this difficulty — the term, the investor, the top-ups, the deadline,
    // and CAREER_LOAN.breachesToEnd if it ends careers outright (null = it does not).
    loanRule: (p: { term: number | null; partnerPct: number; partnerWeeks: number; maxTopUps: number | null; endAt: number | null; maxLoans?: number | null }) => {
      if (p.endAt !== null && p.endAt <= 1) return "On this difficulty the first breach of the floor ends the career.";
      const partner = p.partnerPct > 0 ? ` (the first time, an investor adds ${p.partnerPct}% of the wage bill${partnerRunEn(p.partnerWeeks)})` : "";
      const term = p.term !== null ? ` Repay it within ${p.term} weeks: prizes and sales repay part of it automatically, Finances the rest.` : "";
      const topUps = `Below the floor again while it is owed, the bank adds to it${p.maxTopUps !== null ? ` (up to ${p.maxTopUps} times)` : ""} — the deadline stays.`;
      const end = p.term !== null ? ` On the deadline the bank takes what is owed as long as the books stay at or above the floor after it; if not, the career ends.` : "";
      const count = p.endAt !== null ? ` The ${ordinalEn(p.endAt)} breach ends the career.` : "";
      // rc.34 review: the career-wide cap on new loans (CAREER_LOAN.emergency.maxLoans).
      const loans =
        p.maxLoans !== undefined && p.maxLoans !== null
          ? ` The bank opens ${p.maxLoans === 1 ? "one emergency loan" : `${p.maxLoans} emergency loans`} at most in a career: a breach after the last one is repaid ends it.`
          : "";
      return `A breach opens the bank's emergency loan${partner}.${term} ${topUps}${end}${loans}${count}`;
    },
    // History count (rc.33's rule ended careers at a breach count; `end` null = no count does).
    breachCount: (n: number, end: number | null) =>
      end === null
        ? `Breaches so far: ${n}`
        : n + 1 >= end
          ? `Breaches so far: ${n} — the next one ends the career`
          : `Breaches so far: ${n} — the career ends at breach ${end}`,
    backerLock: "While it is owed: no transfer fees, no gear, nothing that shortens the runway.",
    // rc.34: nothing is locked while the loan is owed (CAREER_LOAN.lockCommitments false).
    loanNoLock: "Nothing is locked while you owe: signings, fees and gear stay open.",
    // rc.34: the loan's deadline and state, as Finances and HQ show it.
    loanDeadline: (date: string, weeks: number) =>
      weeks <= 0 ? `Due this Monday (${date})` : weeks === 1 ? `Due next Monday, ${date}` : `Due ${date} — ${weeks} weeks left`,
    loanDeadlineRule: deadlineRuleEn,
    // rc.34 review: the books projected to the deadline Monday (the weekly burn counted), the bank's own test.
    loanCovered: (covered: boolean): string =>
      covered ? "On this pace the books cover it on the day." : "On this pace the books will not cover it on the day.",
    loanLent: (s: string) => `Lent in all: ${s}`,
    loanTopUps: (n: number, max: number | null) =>
      max === null ? `Top-ups so far: ${n}` : n >= max ? `Top-ups: ${n} of ${max} — the next breach ends the career` : `Top-ups: ${n} of ${max}`,
    // rc.33 (ECO-07): the rescue partner card — rc.34: the investor that joins the first emergency loan.
    rescueTitle: "Investor",
    rescueTerms: (weeks: number) => `Came in with the first emergency loan, for ${weeks} weeks · income, never garnished`,
    rescueUntil: (date: string, left: number) =>
      left === 1 ? `Last payment ${date}.` : `${left} payments left — the last on ${date}.`,
    // rc.32 (M3, provisional): the founding partner card.
    foundingTitle: "Founding partner",
    foundingTerms: (pct: number) => `${pct}% of the founding wage bill · objective: enter events · no signing bonus`,
    foundingEnds: (through: string) => `Ends with your first sponsorship deal — not before the end of ${through}.`,
    foundingEnded: "Stepped back once the org signed its own sponsorship deal.",
    // rc.34 (S6): the handover — a share of its pay, one split per step.
    foundingTapering: (pct: number, last: boolean) =>
      last ? `Handing over: ${pct}% of its pay this split — its last.` : `Handing over: ${pct}% of its pay this split, less the next, then it ends.`,
    // rc.32 (M6, provisional): the players' share of podium prizes.
    // rc.33 (ECO-10): each contract carries its own share (Squad and the offer show it).
    playerShareRule:
      "Podium prizes are shared with the players who played: each contract keeps its own share of a top-four prize at a regional, Major or Worlds (Squad shows it) — booked as its own line.",
    boosts: "Boosts & staff",
    psychologist: "Sports Psychologist",
    psychologistDesc: "+1 Clutch, +1 Consistency while retained. The hire that wins deciding games.",
    bootcamp: "Bootcamp",
    bootcampDesc: "Permanent chemistry bump + a sharper next official event.",
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
    gearLadderHint: "Bought in order, unlocked by reputation — a garage org becomes a powerhouse.",
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
    bootcampT1Desc: "A week under one roof. Chemistry bump + a light edge next official.",
    bootcampT2: "Structured bootcamp",
    bootcampT2Desc: "Coaching staff, scrim schedule, VOD review. Bigger chemistry bump + a sharp next official.",
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
    none: "Nothing to buy yet — reputation opens the toolbox.",
    lockedRep: (rep: number) => `Reputation ${rep}`,
    after: (name: string) => `After ${name}`,
    used: "Used this split",
    superseded: "Replaced by the next tier",
    training: (pct: number) => `+${pct}% training`,
    buff: (n: number) => `+${n} buff level`,
    rating: (n: string) => `+${n} team rating`,
    chemistry: "a chemistry boost",
    stats: "+1 Clutch, +1 Consistency",
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
    free: "Free — a sponsor perk",
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
    unlockBody: (name: string) => `${name} is unlocked — ready to buy, not bought yet.`,
    unlockSee: "See it",
    unlockLater: "Later",
    newTag: "New",
    // rc.35: the visual unlock / buy modal.
    unlockKicker: "Unlocked",
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
    seeLess: "See less",
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
      psychologist: "+1 Clutch, +1 Consistency",
      sponsors3: "Global brands: higher pay, better perks",
      perfCenter: "The top training and team buff",
      sponsors4: "The brand on the jersey: the biggest deal",
    },
  },

  standings: {
    title: "Standings",
    splitTab: "Split standings",
    seasonTab: "Road to Worlds",
    majorLine: "Major line",
    worldsLine: "Worlds line",
    clinched: "Clinched",
    contention: "In contention",
    eliminated: "Out of the race",
    ptsShort: "pts",
    remaining: (n: number) => `${n} events left`,
    maxAvailable: (n: number) => `${n} pts still on the board`,
    userChip: "You",
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
    digest: (n: number) => `Around the league: ${n} more moves`,
    // Template keys — params: {player} {org} {from} {to} {fee} {event} {placement} {points} {name} {region} {n}
    tpl: {
      transfer: (p: Record<string, string | number>) => `${p.player} signs with ${p.to}`,
      transferFee: (p: Record<string, string | number>) => `${p.to} lands ${p.player} from ${p.from} (${p.fee})`,
      transferFa: (p: Record<string, string | number>) => `${p.player} finds a home at ${p.to}`,
      userSigned: (p: Record<string, string | number>) => `Official: ${p.player} joins ${p.org}`,
      userSold: (p: Record<string, string | number>) => `${p.player} departs ${p.org} for ${p.to}`,
      userReleased: (p: Record<string, string | number>) => `${p.org} releases ${p.player}`,
      result: (p: Record<string, string | number>) => `${p.org} take ${p.event}`,
      resultUser: (p: Record<string, string | number>) => `${p.event}: you finish ${p.placement}`,
      // v2.0 (R40): a qualifier result reads qualified / eliminated, never a placement.
      resultUserQualified: (p: Record<string, string | number>) => `${p.event}: qualified for Sunday`,
      resultUserEliminated: (p: Record<string, string | number>) => `${p.event}: out in the Swiss`,
      qualifiedRegional: (p: Record<string, string | number>) => `Through the qualifier: ${p.event} is on`,
      missedRegional: (p: Record<string, string | number>) => `Out at the qualifier — ${p.event} goes on without you`,
      qualifiedMajor: () => `You're in. The Major awaits.`,
      missedMajor: () => `The Major happens without you this split.`,
      qualifiedWorlds: () => `WORLDS. The org made it.`,
      missedWorlds: () => `The Worlds race ends here this season.`,
      stability: (p: Record<string, string | number>) => `Roster shake-up costs ${p.points} Season Points`,
      contractExpiring: (p: Record<string, string | number>) => `${p.player}'s contract enters its final window`,
      contractReminder: (p: Record<string, string | number>) => `Contract clock: ${p.players} — ${p.weeks} weeks left`,
      // rc.34 (Miguel, 31/10): a short squad sat a regional out.
      regionalSkipped: (p: Record<string, string | number>) => `${p.org} sit out ${p.event}`,
      playerLeft: (p: Record<string, string | number>) => `${p.player} walks as a free agent`,
      retirementAnnounce: (p: Record<string, string | number>) => `${p.player} announces his final season`,
      retired: (p: Record<string, string | number>) => `${p.player} hangs up the controller`,
      // DEV-02 (R48): the user's own retiree — coaching or out of the game.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} hangs up the controller for a coach's headset`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} hangs up the controller for good`,
      insertResolved: (p: Record<string, string | number>) => `Decision made: ${p.insert}`,
      orgEnters: (p: Record<string, string | number>) => `${p.org} enters the ${p.region} scene`,
      // rc.33 (RTW-03): an org whose history is over gives its seat to an entrant.
      orgLeaves: (p: Record<string, string | number>) => `${p.org} leaves the ${p.region} scene`,
      rookieClass: (p: Record<string, string | number>) => `${p.region} rookie class arrives — ${p.name} headlines`,
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
      windowOpen: () => `Transfer window opens — the phones are on`,
      windowClose: () => `Window shut. Rosters are what they are.`,
      windowReport: (p: Record<string, string | number>) => `Window report: ${p.n} moves across the regions`,
      debtCleared: () => `Emergency loan repaid — the org walks free`,
      sponsorSigned: (p: Record<string, string | number>) => `${p.org} announces ${p.name} partnership`,
      // rc.34 (ECO-04): a deal that ran its course (it ends on a split boundary).
      sponsorEnded: (p: Record<string, string | number>) => `${p.name}: the sponsorship deal is complete`,
      sponsorDropped: (p: Record<string, string | number>) => `${p.name} cools on the partnership`,
      repUp: (p: Record<string, string | number>) => `The scene is talking about ${p.org}`,
      repDown: (p: Record<string, string | number>) => `Pundits pile on after ${p.org}'s stumble`,
      starUp: (p: Record<string, string | number>) => `${p.org} reaches ${p.n}-star status`,
      unlock: (p: Record<string, string | number>) => `Unlocked: ${p.name}`,
      // rc.30 (A4): the one-time cleanup of a career started before rc.29.
      registryRepair: (p: Record<string, string | number>) =>
        `League registry updated: ${p.n} roster and gamertag fixes`,
      unavailable: (p: Record<string, string | number>) => `${p.player} unavailable for ${p.event}`,
      standIn: (p: Record<string, string | number>) => `Emergency stand-in suits up for ${p.event}`,
      bankLoan: (p: Record<string, string | number>) => `The org takes a ${p.amount} bank loan`,
      bankCleared: () => `The org clears its bank loan`,
      cashWarning: (p: Record<string, string | number>) => `Books tighten: ${p.weeks} weeks of runway`,
      // History (rc.31–rc.33); rc.34 files emergencyLoan / emergencyTopUp / loanCollected.
      backerIn: () => `An emergency backer stabilizes the books`,
      emergencyLoan: () => `The bank steps in with an emergency loan`,
      emergencyTopUp: () => `The bank adds to the org's emergency loan`,
      loanCollected: () => `The org settles its emergency loan on the deadline`,
      insolvency: () => `The org's finances collapse`,
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
      listingOffer: (p: Record<string, string | number>) => `${p.org} bid for listed ${p.player}`,
      listed: (p: Record<string, string | number>) => `${p.player} is on the market — the org listed him`,
      flavor1: () => `Desk notes: rotation discipline is the new meta buzzword`,
      flavor2: () => `Scrim servers busy — the whole region is grinding`,
      flavor3: () => `A caster's mic caught a very honest halftime take`,
      flavor4: () => `Ping complaints filed. Ping complaints dismissed.`,
      flavor5: () => `A community montage is doing numbers this week`,
    },
    // v0.2 — body text per template (same params; HQ feed renders these).
    body: {
      transferFee: (p: Record<string, string | number>) =>
        `${p.to} agreed a fee with ${p.from} for ${p.player}. The region's map shifts again.`,
      transferFa: (p: Record<string, string | number>) =>
        `${p.player} had been without an org — ${p.to} moved first. Free-agency value, if the fit works.`,
      userSigned: (p: Record<string, string | number>) =>
        `The paperwork is done: ${p.player} is yours. Chemistry starts at zero — the table only remembers results.`,
      userSold: (p: Record<string, string | number>) =>
        `${p.player} leaves for ${p.to}. The fee lands in the books; the hole in the lineup is yours to solve.`,
      userReleased: (p: Record<string, string | number>) =>
        `${p.org} paid the severance and moved on. ${p.player} joins the free-agent pool.`,
      result: (p: Record<string, string | number>) =>
        `${p.org} closed out ${p.event}. The desk will replay that grand final for weeks.`,
      resultUser: (p: Record<string, string | number>) =>
        `The org's ${p.event} run ends at ${p.placement}. Every placement pays — and the table remembers.`,
      resultUserQualified: (p: Record<string, string | number>) =>
        `Three Swiss wins at ${p.event} and the org has its regional seat. A qualifier pays prize money and standing — the Season Points are played for on Sunday.`,
      resultUserEliminated: (p: Record<string, string | number>) =>
        `Three losses ended the org's ${p.event} in the Swiss. The prize money still lands — and the next regional week is another shot.`,
      qualifiedRegional: (p: Record<string, string | number>) =>
        `Saturday's Swiss is done and the org is one of the eight through. ${p.event} is Sunday — the direct eight are waiting.`,
      missedRegional: (p: Record<string, string | number>) =>
        `Three losses in Saturday's Swiss — ${p.event} goes ahead on Sunday without you. Rest up; a new training week starts Monday.`,
      qualifiedMajor: () =>
        `The split standings locked and your name is above the line. Cross-region field, doubled points — the real test.`,
      missedMajor: () =>
        `Below the line when it locked. The next split resets the race — the Worlds points already banked still count.`,
      qualifiedWorlds: () =>
        `A full season of points did it. The biggest field in the game awaits — one bracket for everything.`,
      missedWorlds: () =>
        `The season's points weren't enough. The org watches Worlds from home — and plans the comeback.`,
      stability: (p: Record<string, string | number>) =>
        `Fielding another new face mid-split cost ${p.points} Season Points. Rebuilds belong in the preseason.`,
      contractExpiring: (p: Record<string, string | number>) =>
        `${p.player}'s deal is running out. You hold the exclusive re-sign window through Split 3.`,
      contractReminder: (p: Record<string, string | number>) =>
        `The season ends in ${p.weeks} weeks and ${p.players} have no deal beyond it. Renew before the rollover, or they walk.`,
      regionalSkipped: (p: Record<string, string | number>) =>
        `Only ${p.n} of 3 seats are filled, so the squad does not enter ${p.event}: no points, no prize. The next regional asks again.`,
      playerLeft: (p: Record<string, string | number>) =>
        `No renewal came, so ${p.player} walked for free. Agents talk — the next negotiation starts from this.`,
      retirementAnnounce: (p: Record<string, string | number>) =>
        `${p.player} will retire at season's end. One more run together — make it count.`,
      retired: (p: Record<string, string | number>) =>
        `${p.player} steps away from the game. The scene is younger — and a little poorer — today.`,
      retiredToCoach: (p: Record<string, string | number>) =>
        `${p.player} retires from competition and moves into coaching. The coach market has a new name — one you know well.`,
      retiredLeaves: (p: Record<string, string | number>) =>
        `${p.player} retires and leaves the scene. The org thanks him for every season in its colours.`,
      orgEnters: (p: Record<string, string | number>) =>
        `A new badge on the ${p.region} circuit: ${p.org} fields a roster this season. History arrives on schedule — and the table gets harder.`,
      orgLeaves: (p: Record<string, string | number>) =>
        `${p.org} fields no roster this season and leaves the ${p.region} circuit. Its seat goes to a new name; its players look for a new home.`,
      rookieClass: (p: Record<string, string | number>) =>
        `Fresh names hit the ${p.region} free-agent pool. ${p.name} is the one scouts underline.`,
      decline: (p: Record<string, string | number>) =>
        `Age comes for the mechanics first. ${p.player} is adapting his game — experience keeps paying.`,
      windowOpen: () =>
        `Agents answering, fees moving, rosters unlocked. Deals resolve as the days advance; the window won't wait.`,
      windowReport: (p: Record<string, string | number>) =>
        `${p.n} moves logged before the window shut. The full wire — fees, free agents, every region — is on the HQ.`,
      debtCleared: () =>
        `The last payment cleared the bank's emergency loan. No deadline hangs over the org any more.`,
      // rc.34 (ECO-04): a deal now runs one split, one season or two, with a goal every split.
      sponsorSigned: (p: Record<string, string | number>) =>
        `${p.org} and ${p.name} signed a partnership: weekly pay, and a bonus for every goal reached. The terms are on the Finances desk.`,
      unlock: (p: Record<string, string | number>) =>
        `Reputation opened a new door: ${p.name}. The progression track shows what's still ahead.`,
      registryRepair: () =>
        `Players listed by two orgs now sit on one roster, and repeated gamertags were renamed. Your squad, contracts and results are unchanged.`,
      unavailable: (p: Record<string, string | number>) =>
        `${p.player} can't play ${p.event} — visas, health, life. The sub steps in with his chemistry.`,
      standIn: (p: Record<string, string | number>) =>
        `A hired stand-in keeps the org in ${p.event}. Full lineup, zero chemistry — it shows.`,
      bankLoan: (p: Record<string, string | number>) =>
        `Fresh credit lands on the balance sheet — ${p.amount}, repaid weekly. Ambition on borrowed money is still ambition.`,
      bankCleared: () =>
        `The final instalment goes through. Whatever the money bought, the org now owns outright.`,
      cashWarning: (p: Record<string, string | number>) =>
        `Weekly costs outrun income and the cushion is ${p.weeks} weeks thin. Managers who ignore this end up at the bank's emergency desk.`,
      backerIn: () =>
        `The floor broke and the Backer's grant landed. Repayment garnishes prize money and sales until it clears — the inbox says what the next breach would mean.`,
      emergencyLoan: () =>
        `The floor broke and the bank wired an emergency loan. Prizes and sales repay part of it — and it has a deadline. The inbox has the terms.`,
      emergencyTopUp: () =>
        `Below the floor again before the loan was repaid: the bank added to it. The deadline has not moved.`,
      loanCollected: () =>
        `Deadline day, and the balance covered the debt: the bank took what it was owed. The org carries on.`,
      insolvency: () =>
        `The final collapse. Wages unpaid, seats empty, servers dark — the org's story ends in the ledger.`,
      seasonChampion: (p: Record<string, string | number>) =>
        `${p.org} lift the trophy at ${p.event}. The bar for everyone else just moved.`,
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} want ${p.player} and put money on the table. The decision — and the consequences — are yours.`,
      gearBought: (p: Record<string, string | number>) =>
        `The ${p.name} upgrade is in. Training efficiency ticks up — the players noticed immediately.`,
      bootcampRun: () =>
        `A week under one roof does what no schedule can: the squad plays like it shares a brain. Sharper next official, permanently closer.`,
      coachHired: (p: Record<string, string | number>) =>
        `${p.coach} takes the ${p.org} whiteboard. Development pace and match prep both answer to the bench now.`,
      scrimWin: (p: Record<string, string | number>) =>
        `A tidy closed-doors set against ${p.opponent}. Reps in, chemistry up, nothing leaked to the wire — almost.`,
      scrimLoss: (p: Record<string, string | number>) =>
        `${p.opponent} took the scrim set. Losses behind closed doors are the cheapest lessons in esports.`,
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} moved with real intent for ${p.player}. History wants this transfer — you decide if it happens.`,
      // rc.32 history (ECO-08 / ECO-12): nothing sends these since rc.33 — kept so an older save's feed still reads.
      restructured: (p: Record<string, string | number>) =>
        `The org closed below the floor again and the Backer forced its hand${p.player ? `: ${p.player} heads to ${p.org}` : ""}. Reputation takes the hit; ${Number(p.granted) > 0 ? "the books are topped back up" : "the sale covers the books"}. ${legacyNextBreachEn(p.next)}`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} answered the listing with a formal offer for ${p.player}. Accept it before the window closes, or keep him.`,
      listed: (p: Record<string, string | number>) =>
        `The org put ${p.player} on the market. An offer from a side that would start him comes within a few window days.`,
      repDown: (p: Record<string, string | number>) =>
        `Expectations were stated and missed; ${p.org}'s standing takes the hit. Reputation is earned back the same way it was built.`,
    },
  },

  achievements: {
    title: "Career achievements",
    hint: "Permanent and yours across every save — a season reset never touches them. Each pays Season XP once; the big ones unlock cosmetics.",
    unlocked: "Achievement unlocked",
    lockedLabel: "Locked",
    unlockedOn: (date: string) => `Unlocked ${date}`,
    xp: (n: number) => `+${n} Season XP`,
    progress: (done: number, total: number) => `${done} of ${total}`,
    tier: { common: "Common", rare: "Rare", epic: "Epic", legend: "Legend" } as Record<string, string>,
    items: {
      "car-first-sponsor": { name: "Open for Business", desc: "Sign your first sponsor." },
      "car-bank-cleared": { name: "Good Credit", desc: "Repay a bank loan in full." },
      "car-first-qualifier": { name: "Through the Door", desc: "Get through a Saturday qualifier into Sunday's regional." },
      "car-rep-50": { name: "A Name in the Scene", desc: "Reach 50 reputation." },
      "car-three-seasons": { name: "Road Warrior", desc: "Reach your third season with one org." },
      "car-major-qualified": { name: "International", desc: "Qualify for a Major." },
      "car-first-regional": { name: "Regional Champion", desc: "Win a regional." },
      "car-worlds-qualified": { name: "On the Big Stage", desc: "Qualify for the World Championship." },
      "car-rep-100": { name: "Household Name", desc: "Reach 100 reputation." },
      "car-first-major": { name: "Major Winner", desc: "Win an international Major." },
      "car-first-worlds": { name: "World Champion", desc: "Win the World Championship." },
      "car-worlds-underdog": { name: "Underdog", desc: "Win a regional, Major or Worlds as the underdog: a team overall 3+ below the field's average." },
      "car-worlds-homegrown": { name: "Homegrown", desc: "Win Worlds with the roster you founded the org with — no signings, ever." },
      "car-three-worlds": { name: "Dynasty", desc: "Win three World Championships with one org." },
      "car-all-difficulties": { name: "Every Road", desc: "Win Worlds on Easy, Normal and Hard (across saves)." },
    } as Record<string, { name: string; desc: string }>,
  },

  inserts: {
    kinds: { random: "Side quest", sponsor: "Sponsor ask", training: "Training call" } as Record<string, string>,
    expires: "Decide today — the moment passes with the day.",
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
      "ins-showmatch": { title: "A streamer wants a showmatch", body: "A big creator offers the squad a paid showmatch this week. Fun money, good chemistry, one session gone.", a: "Play it", b: "Pass" },
      "ins-charity-cup": { title: "Charity cup appearance", body: "A local charity cup wants your org on the poster. It costs a little and buys goodwill.", a: "Show up", b: "Decline" },
      "ins-pc-dies": { title: "A PC dies mid-week", body: "One of the tournament rigs gave out. Replace it now, or borrow a spare and lose practice time.", a: "Replace it", b: "Borrow a spare" },
      "ins-fan-meetup": { title: "Fans ask for a meetup", body: "The fanbase wants a meetup after practice. A small cost, a little standing.", a: "Host it", b: "Not this week" },
      "ins-media-day": { title: "Media day request", body: "Press wants a full media day with the roster. Good for the brand, one session shorter.", a: "Full media day", b: "Keep it minimal" },
      "ins-sponsor-content": { title: "Your sponsor wants a content day", body: "The sponsor asks for a day of content with the players. It pays — and practice pays for it.", a: "Shoot the content", b: "Decline politely" },
      "ins-sponsor-jersey": { title: "Jersey reveal photo op", body: "The sponsor wants the new jersey revealed at the next event with a photo op. Quick money and a little standing.", a: "Do the reveal", b: "Skip it" },
      "ins-rest-request": { title: "A starter asks for a lighter week", body: "The squad is tired. Lighter sessions keep the mood up; pushing on keeps the pace.", a: "Lighten the week", b: "Push on" },
      "ins-lan-bootcamp": { title: "A LAN café offers a cheap bootcamp", body: "A local LAN café offers the squad a weekend under one roof for a flat fee.", a: "Book it", b: "Pass" },
      "ins-coach-clinic": { title: "Coach proposes a clinic", body: "The coach wants to run a focused clinic this week — a small cost, a real step forward.", a: "Run the clinic", b: "Not now" },
    } as Record<string, { title: string; body: string; a: string; b: string }>,
  },

  club: {
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
    trophyEmpty: "The shelf is waiting.",
    worldsPedestal: "The Worlds pedestal",
    records: "Records",
    recordPrize: "Total prize money",
    recordSeries: "Series record",
    recordBiggestFee: "Biggest signing",
    recordTitles: "Titles",
    seasonHistory: "Season history",
    editColors: "Re-tint colors",
    progression: "Progression",
    progressionDesc: "Everything still ahead of this org.",
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
    editCrest: "Edit crest",
    settings: "Career settings",
    abandonCareer: "Abandon career",
    abandonConfirm: "This deletes the save permanently. The trophies go with it.",
  },

  event: {
    lobbyTitle: "Event lobby",
    format: "Format",
    formatSwiss: "16-team Swiss → top-8 double elimination",
    formatSingle: "8-team knockout",
    yourSeed: (n: number) => `Seed #${n}`,
    watch: "Play it out",
    instant: "Instant result",
    simToEnd: "Sim to end",
    skipSeries: "Skip series",
    lockIn: "Lock in",
    lineupLocked: "Lineup locked for the event",
    roundLabel: (n: number) => `Round ${n}`,
    swissStage: "Swiss stage",
    playoffs: "Playoffs",
    grandFinal: "Grand Final",
    thirdPlace: "Third place",
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
    eliminated: "Your run ends here",
    advancing: "Through to the next round",
    champion: (name: string) => `${name} — CHAMPIONS`,
    yourResult: (placement: string) => `Final placement: ${placement}`,
    earned: "Earned",
    unavailableNotice: (player: string) => `${player} can't play this one — next man up.`,
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
    seedLabel: "Seed",
    // v2.0 (R40) — the weekend: qualifier Saturday → regional Sunday;
    // Major / Worlds: Swiss stage Saturday → Championship Sunday.
    formatQualifier: (teams: number, slots: number, wins: number, regional: string) =>
      `${teams}-team Swiss · the ${slots} that reach ${wins} wins qualify for Sunday's ${regional}`,
    formatTwoDay: (teams: number, playoffTeams: number) =>
      `Saturday: ${teams}-team Swiss · Sunday: top-${playoffTeams} double elimination`,
    championshipSunday: "Championship Sunday",
    weekendTitle: "The weekend",
    roleQualifierSub: (teams: number, slots: number) => `${teams}-team Swiss · top ${slots} go through`,
    roleRegionalSub: (direct: number, qualified: number) => `${direct} direct + ${qualified} from Saturday`,
    roleSwissSub: (teams: number, wins: number) => `${teams}-team Swiss · ${wins} wins to advance`,
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
    pauseHint: "Nothing on Sunday is played until you continue.",
    continueToSunday: "Continue to Championship Sunday",
    continueToSundayShort: "Continue to Sunday",
    sundaySub: (playoffTeams: number, bestOf: number) =>
      `Top ${playoffTeams} · double elimination · best of ${bestOf}`,
    sundayOpener: (opp: string, seed: number, oppSeed: number) =>
      `Seed #${seed} — you open against ${opp} (#${oppSeed})`,
    sundaySpectating: "Out in the Swiss — the crown is decided without you today",
    startNow: "Start now",
    startPlayoffs: "Start the playoffs",
    tapToSkip: "Tap anywhere to skip",
    swissRecord: "Record",
    qualifiedEight: "Qualified for Sunday",
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

  spectate: {
    title: "From the couch",
    watchParty: "Watch party",
    digestTitle: "Results digest",
    meaning: "What it means for you",
    followedResult: (org: string, placement: string) => `${org} finish ${placement}`,
  },

  ceremonies: {
    splitRecap: "Split recap",
    saveAndRest: "Save & rest",
    keepGoing: "Continue to the window",
    seasonReview: "Season review",
    seasonGrade: (g: string) => `Season grade: ${g}`,
    expected: (label: string) => `Expected: ${label}`,
    delivered: (label: string) => `Delivered: ${label}`,
    devRecap: "Development",
    bizRecap: "Business",
    rolloverTitle: (label: string) => `${label} begins`,
    rolloverCta: "Start the season",
    worldsChampion: (name: string) => `${name} — WORLD CHAMPIONS`,
    yourTitle: "WORLD CHAMPIONS",
    creditsJourney: "The road so far",
    creditsRoster: "The roster that did it",
    finalWhistle: "Final whistle",
    finalWhistleBody: "The 2026 season closes the book — but not the org's story.",
    insolvencyTitle: "Insolvency",
    // A breach that ended it (rc.33's count; rc.34: the top-up cap or CAREER_LOAN.breachesToEnd).
    insolvencyBody: "The books closed below the floor one time too many. The org's story ends here.",
    // rc.34 (end.moneyCause "deadline"): the emergency loan unpaid on its deadline.
    insolvencyBodyDeadline:
      "The emergency loan came due and the balance could not cover it. The bank called it in — the org's story ends here.",
    legacyTitle: "Career legacy",
    legacyGrade: { legend: "Legend", contender: "Contender", challenger: "Challenger", journeyman: "Journeyman" },
    retire: "Retire",
    retireDesc: "The career is archived — trophies and history stay browsable.",
    infinite: "Endless era",
    infiniteDesc: "The timeline is yours now. No more script — just the sim.",
    infiniteExplainer:
      "From 2027 the world is fully procedural: rookies are generated, veterans retire, history is whatever you make.",
    defendTitle: "Defend the title",
  },

  saves: {
    title: "Careers",
    empty: "Found a new org",
    resume: "Resume",
    archived: "Archived",
    champion: "CHAMPIONS",
    endedInsolvent: "Insolvent",
    endedRetired: "Retired",
    delete: "Delete",
    deleteConfirm: (org: string, n: number) =>
      `Delete ${org}? ${n} season${n === 1 ? "" : "s"} of history disappears. Permanent and local.`,
    lastPlayed: "Last played",
    newCareer: "New career",
    slotsFull: "All three slots are taken.",
  },

  goals: {
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
  },

  explainers: {
    skipAll: "Skip all tips",
    gotIt: "Got it",
    hub: {
      title: "This is HQ",
      body: "The day card runs your career: advance one day at a time, or skip to the next stop. Cards marked Needs you want a decision; everything else is optional depth.",
    },
    calendar: {
      title: "The season at a glance",
      body: "Three splits, three regional weekends each — qualifier Saturday, regional Sunday — and a Major to close every split: Swiss stage Saturday, playoffs on Championship Sunday. Season Points decide who makes the Major — and Worlds.",
    },
    squad: {
      title: "Your squad",
      body: "Three starters and a sub. Keep a core together and chemistry pays; churn it and the table remembers.",
    },
    training: {
      title: "Training",
      body: "Players grow toward their potential every week. The coach can run this for you — take over any time.",
    },
    market: {
      title: "The market",
      body: "Sign free agents or buy out contracts — only while a window is open. Every price shows its math.",
    },
    window: {
      title: "Transfer window",
      body: "Windows sit between splits (plus one final call before Worlds). Deals resolve when you advance the week.",
    },
    finances: {
      title: "The books",
      // rc.34 (ECO-13/15): the bank's emergency loan and its deadline.
      body: "Prizes and sponsors in, wages and upkeep out, every Monday. Below the floor, the bank lends you an emergency loan — repay it by its deadline (longer on easier difficulties) or the career ends.",
    },
    standings: {
      title: "The cut-line",
      body: "The dashed line is the qualification cut. Everything the org fights for is measured against it.",
    },
    sponsor: {
      title: "Sponsors",
      body: "Guaranteed money each split, a bonus if you hit the objective. Missing never costs cash — repeated misses cost the renewal tier.",
    },
    randomEvent: {
      title: "Next man up",
      body: "Sometimes a starter can't play — visas, health, life. A sub steps in with his chemistry; without one nobody is ruled out. No event is ever played with fewer than three.",
    },
    worldsRace: {
      title: "The Worlds race",
      body: "Season Points from every regional and Major stack all year. Finish above your region's line and the biggest stage opens.",
    },
    rollover: {
      title: "Season rollover",
      body: "Ages tick, contracts count down, the world re-shuffles toward its history — unless you already changed it.",
    },
  },

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
      "An amateur team from the regional scene — they play the community cups and the Saturday qualifiers, and their regional points count in the Major and Worlds races.",
  },

  // rc.34 (Miguel, 31/10: "communicate it better with a modal that says what is happening"): the
  // money notice, one per event that changes the stakes (careerFlow.moneyNoticeOf). The modal
  // passes the notice's params with money formatted and `dlDate` (the deadline's date) added.
  moneyNotice: {
    ok: "Understood",
    toFinances: "Open Finances",
    loanOpened: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The bank stepped in",
      lead: `This Monday the books closed below the floor (${p.floor}), so the bank lent ${p.lent} and the balance is back at ${p.rescueTo}.`,
      rows: noticeRows(
        ["Owed", `${p.owed}, ${p.repayPct}% interest included`],
        p.dlDate !== undefined && ["Repay by", `${p.dlDate} — ${p.dlWeeks} weeks`],
        ["How it is repaid", `${p.garnishPct}% of every prize and ${p.salePct}% of every sale go to it automatically; pay the rest from Finances whenever you like.`],
        positive(p.partnerWeekly) && [
          "Investor",
          `${p.partnerName} comes in with this first loan: ${p.partnerWeekly} a week for ${p.partnerWeeks} weeks (${p.partnerPct}% of the wage bill) — income, never garnished.`,
        ],
        ["Below the floor again", nextBreachEn(p)],
        loansLeftEn(p) !== "" && ["After this loan", loansLeftEn(p)],
        p.dlDate !== undefined && ["What ends the career", `On ${p.dlDate} the bank takes what is owed. If paying it would close the books below the floor, the career ends.`],
      ),
      foot: Number(p.lock)
        ? "While it is owed: no transfer fees, no gear, nothing that shortens the runway."
        : "Nothing is locked while you owe: signings, fees and gear stay open.",
    }),
    loanTopUp: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The bank added to your loan",
      lead: `The books closed below the floor again before the loan was repaid, so the bank lent ${p.lent} more. The balance is back at ${p.rescueTo}.`,
      rows: noticeRows(
        ["Owed", `${p.owed} in all`],
        p.dlDate !== undefined && ["Repay by", `${p.dlDate} — the deadline does not move`],
        ["Below the floor again", nextBreachEn(p)],
        p.dlDate !== undefined && ["What ends the career", `On ${p.dlDate} the bank takes what is owed. If paying it would close the books below the floor, the career ends.`],
      ),
    }),
    deadlineWarning: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: Number(p.weeksLeft) === 1 ? "One week to repay the bank" : `${p.weeksLeft} weeks to repay the bank`,
      lead: `The emergency loan is due on ${p.dlDate}. You owe ${p.owed}; the balance is ${p.balance}.`,
      rows: noticeRows(
        // rc.34 review: the books projected to the deadline (the weekly burn counted), not today's balance.
        ["On this pace", onPaceEn(p)],
        !Number(p.covered) && ["Ways to close the gap", gapWaysEn(p)],
        ["What ends the career", `On ${p.dlDate} the bank takes what is owed. If paying it would close the books below the floor, the career ends.`],
      ),
    }),
    // rc.34 review: inside the last weeks the projection stopped covering the debt (a fee, a purchase, a lost prize).
    deadlineSlipped: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The loan is no longer covered",
      lead: `${Number(p.weeksLeft) === 1 ? "One week" : `${p.weeksLeft} weeks`} before the emergency loan is due (${p.dlDate}), the books stopped covering it: on this pace the balance would be ${p.projected} on that Monday, ${p.gap} short of what the bank needs for the ${p.owed} owed.`,
      rows: noticeRows(
        ["Ways to close the gap", gapWaysEn(p)],
        ["What ends the career", `On ${p.dlDate} the bank takes what is owed. If paying it would close the books below the floor, the career ends.`],
      ),
    }),
    deadlineCollected: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "Loan settled",
      lead: `The deadline arrived and the books could pay it: the bank took ${p.collected}. The balance is now ${p.balance}.`,
      rows: noticeRows([
        "What comes next",
        `The emergency loan is closed. ${p.next === undefined ? "Another breach of the floor would open a new one, with a new deadline." : nextBreachEn(p)}`,
      ]),
    }),
    careerEnded: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The career ends here",
      lead:
        p.cause === "deadline"
          ? `The emergency loan came due with ${p.owed} owed and ${p.balance} in the bank. Paying it would have closed the books below the floor, so the bank called the loan in and the org closed.`
          : !positive(p.owed) && Number(p.maxLoans) >= 0 && Number(p.loans) >= Number(p.maxLoans)
            ? `The books closed below the floor again and the bank would not open another emergency loan after ${Number(p.loans) === 1 ? "the one it lent" : `the ${p.loans} it lent`}. The org closed.`
            : `The books closed below the floor again and the bank would not lend any more${Number(p.topUps) > 0 ? ` after ${p.topUps} top-ups` : ""}. The org closed.`,
      rows: noticeRows(["What stays", "The season review, the archive and the trophies stay open."]),
    }),
    loanTakenOver: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "The bank took over your debt",
      lead: `Rescues work differently now: the Emergency Backer is gone, and the ${p.owed} you owed it sits with the bank as an emergency loan.`,
      rows: noticeRows(
        p.dlDate !== undefined && ["Repay by", `${p.dlDate} — ${p.dlWeeks} weeks from now`],
        ["How it is repaid", `${p.garnishPct}% of every prize and ${p.salePct}% of every sale go to it automatically; pay the rest from Finances whenever you like.`],
        ["Below the floor again", nextBreachEn(p)],
        p.dlDate !== undefined && ["What ends the career", `On ${p.dlDate} the bank takes what is owed. If paying it would close the books below the floor, the career ends.`],
      ),
      foot: Number(p.lock) ? undefined : "Nothing is locked while you owe any more: signings, fees and gear are open.",
    }),
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
  },
};

export type CareerCopy = typeof CAREER_EN;
