/**
 * Centralized game copy.
 *
 * Tone guide (base doc §38): broadcast commentary / post-match analysis.
 * Clean, confident, no forced memes. Keeping every player-facing string here
 * makes a future PT-BR (or any) localization a single-file job.
 */

export const APP = {
  name: "Rocket Draft",
  tagline: "Draft history. Survive the bracket.",
  description:
    "A fan-made Rocket League esports history draft game. Build a roster from iconic RLCS lineups and run an RLCS-style tournament.",
  disclaimer:
    "Fan-made, non-commercial project for educational purposes. Not affiliated with Psyonix, Epic Games or any esports organization. Rocket League is a trademark of its respective owners.",
} as const;

export const HOME = {
  playClassic: "Classic Draft",
  playClassicDesc: "3 players, coach, sub and org. Swiss into double-elim playoffs.",
  quickDraft: "Quick Draft",
  quickDraftDesc: "Players only, short bracket. Built for quick sessions.",
  daily: "Daily Challenge",
  dailyDesc: "One seeded draft per day, same for everyone.",
  dailyPlay: "Play today's challenge",
  dailyVictory: "Victory",
  dailyDefeat: "Defeat",
  dailyComeBack: "Come back tomorrow for a new challenge.",
  dailyStreak: (n: number) => `${n}-win streak`,
  comingSoon: "Coming soon",
  collection: "Collection",
  collectionDesc: "Special cards you have unlocked across your runs.",
  achievements: "Achievements",
  achievementsDesc: "Feats to chase across every run you play.",
  profile: "Profile",
  profileDesc: "Rank, XP and run history.",
  howToPlay: "How to play",
} as const;

export const NAV_UI = {
  backToMenu: "Back to menu",
} as const;

/** In-run header controls (v0.7.0). Leaving the run now resets it silently;
 *  the explicit Reset button keeps a confirmation since it's destructive. */
export const RUN_UI = {
  reset: "Reset run",
  resetTitle: "Reset this run?",
  resetBody:
    "Your current draft and tournament progress will be discarded and a fresh draft starts on the same difficulty.",
  resetConfirm: "Reset run",
  resetCancel: "Keep playing",
} as const;

export const SETUP = {
  title: "Game Setup",
  subtitle: "Pick a difficulty. The draft pool is always fully random — difficulty changes the tournament, not your luck.",
  difficulty: "Difficulty",
  showOverall: "Show overalls during the draft",
  showOverallHint:
    "Turn off to draft on knowledge alone. Overalls are revealed on the results screen.",
  overallLocked: "Locked hidden on this difficulty",
  rerolls: (n: number) => (n === 1 ? "1 reroll" : `${n} rerolls`),
  start: "Start Draft",
  back: "Back to menu",
  legacyLocked: "Win a tournament on Hard to unlock Legacy.",
  mode: "Game mode",
  modeClassic: "Classic Draft",
  modeClassicHint: "6 slots · Swiss + double-elim playoffs",
  modeQuick: "Quick Draft",
  modeQuickHint: "3 players only · straight 8-team bracket",
} as const;

export const DRAFT_UI = {
  pickProgress: (filled: number, total: number) => `Pick ${Math.min(filled + 1, total)} of ${total}`,
  roundLabel: (n: number) => `Lineup ${n}`,
  reroll: "Reroll",
  rerollsLeft: (n: number) => (n === 1 ? "1 left" : `${n} left`),
  noRerolls: "No rerolls",
  freeReroll: "Free reroll",
  freeRerollHint: "Nothing here fits your remaining slots — this one's on the house.",
  selectHint: "Tap a card to draft it — it lands on the first open slot",
  yourRoster: "Your Team",
  slotPlayer: (n: number) => `Player ${n}`,
  slotCoach: "Coach",
  slotSub: "Sub",
  slotOrg: "Org",
  empty: "Empty",
  slotFull: "Slots full",
  alreadyDrafted: "Already drafted",
  stillNeeded: "Still needed",
  hiddenOverall: "??",
  noCoach: "No Coach",
  noSub: "No Sub",
  notFielded: "Not fielded this season",
} as const;

export const REVIEW = {
  title: "Team Review",
  subtitle: "Final check before the tournament. Picks are locked.",
  teamOverall: "Team Overall",
  chemistry: "Chemistry",
  orgBonus: "Org Bonus",
  specialEffects: "Special Effects",
  noSpecials: "No special cards on this roster.",
  breakdown: "Chemistry links",
  noChemistry: "No chemistry links found. This roster is a pure all-star mix.",
  readout: "Analyst Readout",
  startTournament: "Start Tournament",
  hiddenNote: "Overalls stay hidden until the results screen.",
} as const;

export const TOURNAMENT_UI = {
  title: "RLCS-Style Championship",
  swiss: "Swiss Stage",
  playoffs: "Playoffs",
  round: (n: number) => `Round ${n}`,
  record: (w: number, l: number) => `${w} – ${l}`,
  start: "Start simulation",
  resume: "Resume simulation",
  speed: (x: number) => `${x}×`,
  skipAll: "Skip to end",
  live: "Live",
  standings: "Standings",
  throughRound: (n: number) => `Through Round ${n}`,
  yourPath: "Your Path",
  matchCenter: "Match Center",
  upcoming: "Up next",
  bestOf: (n: number) => `Best of ${n}`,
  advanced: "Advanced",
  eliminated: "Eliminated",
  bracket: "Playoff Bracket",
  upperBracket: "Upper Bracket",
  lowerBracket: "Lower Bracket",
  finals: "Finals",
  tbd: "TBD",
  toResults: "View results",
  reviewHint: "Click any finished series to review it.",
  game: (n: number) => `Game ${n}`,
  overtime: "OT",
  matchPoint: "Match point",
  roundNames: {
    ub_quarterfinal: "UB Quarterfinal",
    lb_round1: "LB Round 1",
    ub_semifinal: "UB Semifinal",
    lb_round2: "LB Round 2",
    ub_final: "UB Final",
    lb_semifinal: "LB Semifinal",
    lb_final: "LB Final",
    third_place: "Third Place",
    grand_final: "Grand Final",
    quarterfinal: "Quarterfinal",
    semifinal: "Semifinal",
    final: "Final",
  } as Record<string, string>,
} as const;

export const RESULTS_UI = {
  title: "Run Complete",
  champion: "Champions",
  championSub: "Your roster takes the title.",
  runnerUp: "Grand Finalists",
  runnerUpSub: "One series short of the trophy.",
  third: "Third Place",
  thirdSub: "On the podium after the bronze decider.",
  fourth: "Fourth Place",
  fourthSub: "Lost the bronze decider — still a deep run.",
  top4: "Top 4",
  top4Sub: "One series short of the final.",
  top6: "Top 6",
  top6Sub: "The lower bracket ended the run.",
  top8: "Top 8",
  top8Sub: "Made playoffs, fell at the first hurdle.",
  swissExit: "Swiss Exit",
  swissExitSub: "The bracket stays out of reach this time.",
  swissRecord: "Swiss record",
  finalPlacement: "Final placement",
  champion0f: (name: string) => `${name} went on to win it all.`,
  untouchableNote: "Not a single goal conceded all run. Historic.",
  teamReveal: "Team Reveal",
  bestPlayer: "Best player",
  biggestWin: "Biggest win",
  closestSeries: "Closest series",
  worstLoss: "Toughest loss",
  unlocked: "New cards unlocked",
  achievements: "Achievements",
  achievementToast: "Achievement unlocked",
  xpGained: "XP earned",
  rankProgress: "Rank progress",
  playAgain: "Play again",
  backHome: "Back to menu",
  hiddenReveal: "Overalls revealed",
  share: "Download share card",
  immaculateBadge: "Flawless run",
  ceremonyKicker: "New card unlocked",
  ceremonyTap: "Tap anywhere to reveal",
  ceremonyContinue: "Continue",
  rankUpKicker: "Rank up",
  rankUpTitle: "Rank up!",
  rankUpHint: "Tap anywhere to continue",
  /** Legacy mode unlock celebration (first Hard tournament win). */
  legacyKicker: "New mode unlocked",
  legacyTitle: "Legacy Unlocked",
  legacySub: "An all-time gauntlet of championship rosters now awaits.",
  legacyHint: "Tap anywhere to continue",
  /** Eliminator reveal on a lost run (v0.7.0). */
  eliminatorKicker: "Who ended your run",
  eliminatedBy: (name: string) => `Eliminated by ${name}`,
  eliminatorScore: (a: number, b: number) => `${a}–${b}`,
} as const;

export const COLLECTION_UI = {
  title: "Collection",
  subtitle: "Special cards are unlocked by drafting them and finishing the run — win or lose.",
  progress: (n: number, total: number) => `${n}/${total} unlocked`,
  filters: { all: "All", locked: "Locked", unlocked: "Unlocked" },
  rarity: "Rarity",
  type: "Type",
  lockedCard: "Locked",
  lockedHint: "Draft this card and finish the run to unlock it.",
  unlockedOn: (date: string) => `Unlocked ${date}`,
  effect: "Special effect",
  context: "The moment",
  empty: "Nothing here yet. Finish runs with special cards to grow the album.",
} as const;

export const PROFILE_UI = {
  title: "Profile",
  rank: "Rank",
  xp: "XP",
  toNext: (n: number) => `${n} XP to next rank`,
  maxRank: "Top rank reached",
  runs: "Runs completed",
  titles: "Championships",
  bestClear: "Best difficulty cleared",
  specials: "Specials collected",
  achievements: "Achievements",
  history: "Run history",
  emptyHistory: "No runs yet. Your story starts with the first draft.",
  reset: "Reset all progress",
  resetConfirmTitle: "Reset all progress?",
  resetConfirmBody:
    "XP, rank, collection, achievements and run history will be permanently deleted on this device.",
  resetConfirm: "Delete everything",
  none: "—",
} as const;

// ---------------------------------------------------------------------------
// Simulation narration (broadcast tone). Picked by context in the UI.
// ---------------------------------------------------------------------------

export const NARRATION = {
  seriesWin: [
    "Your team closes it out with room to spare.",
    "Composed series. The gap showed on the scoreboard.",
    "Clean execution from start to finish.",
  ],
  seriesWinClose: [
    "Your team survives a full-length series.",
    "It came down to the smallest of margins.",
    "A deciding game with everything on the line — and your roster delivers.",
  ],
  seriesLoss: [
    "Your team struggled to close out the series.",
    "The opponent dictated the pace throughout.",
    "A rough series. The reset button exists for a reason.",
  ],
  seriesLossClose: [
    "One game short. That one will sting.",
    "A deciding game slips away at the death.",
    "Inches from the win — the series goes the other way.",
  ],
  upsetWin: [
    "The lower-rated roster finds the upset.",
    "Nobody had this one on the board — your team takes down the favorite.",
  ],
  upsetLoss: [
    "An upset on the board — the favorite falls.",
    "Your roster gets caught by a team playing above its rating.",
  ],
  overtimeNote: "Overtime decided it.",
  clutchNote: "Clutch factor tipped the deciding game.",
  specialNote: "A special card effect activated.",
  starLine: (name: string) => `${name} led the charge.`,
  starLineOpponent: (name: string) => `${name} was everywhere for the opposition.`,
  chemistryNote: "Chemistry made the difference in a close matchup.",
  coachNote: "The coach bonus helped stabilize the run.",
} as const;

export const STAT_LABELS: Record<string, string> = {
  offense: "Offense",
  defense: "Defense",
  mechanics: "Mechanics",
  consistency: "Consistency",
  experience: "Experience",
  clutch: "Clutch",
};

export const SPECIAL_TYPE_LABELS: Record<string, string> = {
  moment: "Moment",
  major_mvp: "Major MVP",
  worlds_mvp: "Worlds MVP",
  mythic: "Mythic",
  legend: "Legend",
  coach: "Coach",
  /** Hidden-run mask: the type would identify the card (v0.5.1). */
  masked: "Special",
};

export const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  silver: "Silver",
  gold: "Gold",
  blue: "Blue",
  rare: "Rare",
  epic: "Epic",
  mythic: "Mythic",
  legendary: "Legendary",
};

export const EFFECT_LABELS: Record<string, string> = {
  clutch_boost: "Clutch (deciding games)",
  swiss_consistency: "Consistency (Swiss stage)",
  playoff_experience: "Experience (playoffs)",
  upset_boost: "Upset factor (vs higher-rated teams)",
  defense_stability: "Defensive stability",
  high_roll: "Mechanical ceiling",
};
