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
  playClassicDesc: "3 players, coach, sub and org. Swiss into playoffs.",
  quickDraft: "Quick Draft",
  quickDraftDesc: "Players only, short bracket. Built for quick sessions.",
  daily: "Daily Challenge",
  dailyDesc: "One seeded draft per day, same for everyone.",
  comingSoon: "Coming soon",
  collection: "Collection",
  collectionDesc: "Special cards you have unlocked across your runs.",
  profile: "Profile",
  profileDesc: "Rank, XP, achievements and run history.",
  howToPlay: "How to play",
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
  resumeTitle: "Run in progress",
  resumeBody: "You have an unfinished run. Continue where you left off or abandon it.",
  resume: "Continue run",
  abandon: "Abandon run",
  abandonConfirmTitle: "Abandon this run?",
  abandonConfirmBody:
    "Draft picks and tournament progress for this run will be lost. No XP or unlocks are granted.",
  abandonConfirm: "Abandon",
  cancel: "Cancel",
  legacyLocked: "Win a tournament on Hard to unlock Legacy.",
} as const;

export const DRAFT_UI = {
  pickProgress: (filled: number, total: number) => `Pick ${Math.min(filled + 1, total)} of ${total}`,
  roundLabel: (n: number) => `Lineup ${n}`,
  reroll: "Reroll lineup",
  rerollsLeft: (n: number) => (n === 1 ? "1 left" : `${n} left`),
  noRerolls: "No rerolls",
  skip: "Skip lineup",
  skipHint: "Nothing here fits your remaining slots. Skipping is free.",
  confirmPick: "Draft",
  cancelPick: "Cancel",
  yourRoster: "Your Roster",
  slotPlayer: (n: number) => `Player ${n}`,
  slotCoach: "Coach",
  slotSub: "Substitute",
  slotOrg: "Organization",
  empty: "Empty",
  asSubLabel: "Joins as substitute",
  slotFull: "Slots full",
  alreadyDrafted: "Already drafted",
  stillNeeded: "Still needed",
  hiddenOverall: "??",
  specialUncollected: "Uncollected special",
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
  playSeries: "Play series",
  simulating: "Simulating…",
  skipAnimation: "Skip",
  continue: "Continue",
  standings: "Standings",
  yourMatch: "Your match",
  otherMatches: "Other series",
  bestOf: (n: number) => `Best of ${n}`,
  advanced: "Advanced",
  eliminated: "Eliminated",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Grand Final",
  bracket: "Bracket",
  toResults: "View results",
  eliminatedTitle: "The run ends here",
  eliminatedBody:
    "Finish the run to bank your XP and unlock any special cards you drafted.",
  lockedTitle: "Playoff spot secured",
  lockedBody: "The remaining Swiss rounds decide the rest of the bracket.",
  game: (n: number) => `Game ${n}`,
  overtime: "OT",
} as const;

export const RESULTS_UI = {
  title: "Run Complete",
  champion: "Champions",
  championSub: "Your roster takes the title.",
  runnerUp: "Grand Finalists",
  runnerUpSub: "One series short of the trophy.",
  semifinalist: "Semifinalists",
  semifinalistSub: "A deep playoff run.",
  quarterfinalist: "Quarterfinalists",
  quarterfinalistSub: "Made playoffs, fell at the first hurdle.",
  swissExit: "Swiss Exit",
  swissExitSub: "The bracket stays out of reach this time.",
  swissRecord: "Swiss record",
  finalPlacement: "Final placement",
  champion0f: (name: string) => `${name} went on to win it all.`,
  teamReveal: "Team Reveal",
  bestPlayer: "Best player",
  biggestWin: "Biggest win",
  closestSeries: "Closest series",
  worstLoss: "Toughest loss",
  unlocked: "New cards unlocked",
  achievements: "Achievements",
  xpGained: "XP earned",
  rankProgress: "Rank progress",
  playAgain: "Play again",
  backHome: "Back to menu",
  hiddenReveal: "Overalls revealed",
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
};

export const RARITY_LABELS: Record<string, string> = {
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
