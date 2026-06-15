/**
 * English copy — the source dictionary (store-free, server-safe).
 *
 * Tone: broadcast commentary / post-match analysis. Every player-facing UI
 * string lives here; `copy.pt.ts` mirrors this shape for PT-BR. The active
 * dictionary is chosen by `useCopy()` / `getCopy()` in `copy.ts`.
 *
 * NOT translated (content, not chrome): achievement titles/descriptions,
 * special-card titles/flavor, player/org/season names, the engine-generated
 * XP-line labels, and the changelog/privacy long-form pages.
 */

export const APP = {
  name: "Rocket Draft",
  tagline: "Draft history. Survive the bracket.",
  description:
    "A fan-made Rocket League esports history draft game. Build a roster from iconic RLCS lineups and run an RLCS-style tournament.",
  disclaimer:
    "Fan-made, non-commercial project for educational purposes. Not affiliated with Psyonix, Epic Games or any esports organization. Rocket League is a trademark of its respective owners.",
};

export const NAV = {
  home: "Home",
  play: "Play",
  collection: "Collection",
  profile: "Profile",
  settings: "Settings",
};

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
  joinDiscord: "Join the Discord",
  support: "Buy me a coffee",
  liveBadge: "Live",
  playNow: "Play now →",
  runs: (n: number) => `${n} ${n === 1 ? "run" : "runs"}`,
  titles: (n: number) => `${n} titles`,
};

export const NAV_UI = {
  backToMenu: "Back to menu",
  changelog: "Changelog",
  privacy: "Privacy",
  howToPlay: "How to play",
  discord: "Discord",
  support: "Support the project",
  madeBy: "Made by",
  inspiredBy: "Inspired by",
  by: "by",
};

export const RUN_UI = {
  reset: "Reset run",
  resetTitle: "Reset this run?",
  resetBody:
    "Your current draft and tournament progress will be discarded and a fresh draft starts on the same difficulty.",
  resetConfirm: "Reset run",
  resetCancel: "Keep playing",
  phaseDraft: "Draft",
  phaseReview: "Review",
  phaseTournament: "Tournament",
  phaseResults: "Results",
  hiddenOvr: "Hidden OVR",
};

export const SETUP = {
  title: "Game Setup",
  subtitle:
    "Pick a difficulty. The draft pool is always fully random — difficulty changes the tournament, not your luck.",
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
  ovrOptional: "OVR optional",
  ovrHidden: "OVR hidden",
  selected: "Selected",
  legacyBadge: "All-time gauntlet",
};

/** Difficulty names + taglines (the source lives in balance.ts; these mirror
 *  it for display so the engine config stays language-free). */
export const DIFFICULTY_LABELS: Record<
  "easy" | "normal" | "hard" | "legacy",
  { label: string; tagline: string }
> = {
  easy: { label: "Easy", tagline: "Learn the loop. Forgiving variance, friendlier bracket." },
  normal: { label: "Normal", tagline: "The standard RLCS experience. Balanced field." },
  hard: { label: "Hard", tagline: "Hidden overalls. Stronger field. Knowledge wins." },
  legacy: { label: "Legacy", tagline: "An all-time gauntlet of championship rosters." },
};

export const DRAFT_UI = {
  pickProgress: (filled: number, total: number) =>
    `Pick ${Math.min(filled + 1, total)} of ${total}`,
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
  player: "Player",
};

export const ONBOARDING = {
  howToTitle: "How to play",
  howToIntro: "Build a roster from RLCS history, then run the bracket. The basics:",
  howToSteps: [
    "Each round draws a historical RLCS lineup. Tap a card to draft it onto your team.",
    "Fill 3 players, a coach, a sub and an org. Chemistry rewards stacking teammates, countries and orgs.",
    "Then a tournament auto-plays: Swiss into double-elim playoffs. Higher overall + chemistry wins more series.",
    "Finish runs — win or lose — to earn XP, rank up, and unlock special cards for your collection.",
  ],
  howToCta: "Let's draft",
  legacyTitle: "Welcome to Legacy",
  legacyIntro: "You unlocked the all-time gauntlet. It plays differently:",
  legacySteps: [
    "The field is stacked with the greatest championship rosters in RLCS history.",
    "Overalls are hidden and there are no rerolls — you draft on knowledge alone.",
    "Win here and you've beaten the best of the best. Good luck.",
  ],
  legacyCta: "Bring it on",
};

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
  rowPlayers: "Players (avg)",
  rowCoach: "Coach",
  rowSub: "Substitute",
  rowOrg: "Organization",
  rowChemistry: "Chemistry",
  rowSpecials: "Specials",
  statHigh: {
    offense: "Heavy attacking pressure.",
    defense: "Hard to break down.",
    mechanics: "Elite mechanical ceiling.",
    consistency: "Reliable floor, series after series.",
    experience: "Deep big-stage experience.",
    clutch: "Built for deciding games.",
  } as Record<string, string>,
  statLow: {
    offense: "May struggle to create chances.",
    defense: "Defensively exposed at times.",
    mechanics: "Limited mechanical ceiling.",
    consistency: "Prone to volatile results.",
    experience: "Short on big-stage experience.",
    clutch: "Untested in deciding games.",
  } as Record<string, string>,
  chemistryLine: (tier: string) => `${tier} chemistry between the pieces.`,
  orgBrings: (org: string, stat: string, level: string) =>
    `${org} brings ${stat} ${level} to the table.`,
  oneSpecial: "One special card effect is live for this run.",
  manySpecials: (n: number) => `${n} special card effects are live for this run.`,
};

export const TOURNAMENT_UI = {
  title: "RLCS-Style Championship",
  swiss: "Swiss Stage",
  playoffs: "Playoffs",
  round: (n: number) => `Round ${n}`,
  record: (w: number, l: number) => `${w} – ${l}`,
  start: "Start simulation",
  resume: "Resume simulation",
  pause: "Pause",
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
  opponentHidden: "Opponent ratings stay hidden until the results screen.",
  team: "Team",
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
};

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
  untouchableBadge: "Untouchable",
  teamOvrBadge: (n: number) => `Team OVR ${n}`,
  chemistryBadge: (tier: string) => `${tier} chemistry`,
  teamReveal: "Team Reveal",
  bestPlayer: "Best player",
  biggestWin: "Biggest win",
  closestSeries: "Closest series",
  worstLoss: "Toughest loss",
  ovr: (n: number) => `OVR ${n}`,
  unlocked: "New cards unlocked",
  unlockedNote: "added to your collection.",
  achievements: "Achievements",
  achievementToast: "Achievement unlocked",
  xpGained: "XP earned",
  difficultyMultiplier: "Difficulty multiplier",
  hiddenOverallBonus: "Hidden overall bonus",
  total: "Total",
  rankProgress: "Rank progress",
  rankUpBadge: "Rank up!",
  xpToNext: (n: number, label: string) => `${n} XP to ${label}`,
  playAgain: "Play again",
  backHome: "Back to menu",
  hiddenReveal: "Overalls revealed",
  share: "Download share card",
  immaculateBadge: "Flawless run",
  ceremonyKicker: "New card unlocked",
  ceremonyTap: "Tap anywhere to reveal",
  ceremonyContinue: "Continue",
  ceremonyNext: "Next card",
  rankUpKicker: "Rank up",
  rankUpTitle: "Rank up!",
  rankUpHint: "Tap anywhere to continue",
  legacyKicker: "New mode unlocked",
  legacyTitle: "Legacy Unlocked",
  legacySub: "An all-time gauntlet of championship rosters now awaits.",
  legacyHint: "Tap anywhere to continue",
  eliminatorKicker: "Who ended your run",
  eliminatedBy: (name: string) => `Eliminated by ${name}`,
  eliminatorScore: (a: number, b: number) => `${a}–${b}`,
};

export const COLLECTION_UI = {
  title: "Collection",
  subtitle:
    "Special cards are unlocked by drafting them and finishing the run — win or lose.",
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
};

export const SETTINGS_UI = {
  title: "Settings",
  subtitle: "Tune the feel of the game. Saved on this device.",
  soundSection: "Sound",
  soundEnabled: "Sound effects",
  soundEnabledHint: "Subtle cues on drafts, reveals and results.",
  volume: "Volume",
  motionSection: "Motion",
  reducedMotion: "Reduce motion",
  reducedMotionHint: "Minimize animations (also follows your system setting).",
  animSpeed: "Animation speed",
  animSpeedHint: "How fast reveals, the draft reel and the tournament play out.",
  speedSlow: "Slow",
  speedNormal: "Normal",
  speedFast: "Fast",
  languageSection: "Language",
  language: "Language",
  reset: "Reset settings",
};

export const PROFILE_UI = {
  title: "Profile",
  career: "Career",
  rank: "Rank",
  xp: "XP",
  toNext: (n: number) => `${n} XP to next rank`,
  maxRank: "Top rank reached",
  runs: "Runs completed",
  titles: "Championships",
  bestClear: "Best difficulty cleared",
  specials: "Specials collected",
  titleRate: "Title rate",
  playoffRate: "Playoff rate",
  podiums: "Podiums",
  swissWins: "Swiss wins",
  achievements: "Achievements",
  viewAll: (n: number, total: number) => `${n}/${total} — view all`,
  history: "Run history",
  emptyHistory: "No runs yet. Your story starts with the first draft.",
  hidden: "Hidden",
  reset: "Reset all progress",
  resetConfirmTitle: "Reset all progress?",
  resetConfirmBody:
    "XP, rank, collection, achievements and run history will be permanently deleted on this device.",
  resetConfirm: "Delete everything",
  cancel: "Cancel",
  none: "—",
  placement: {
    champion: "Champion",
    runner_up: "Finalist",
    third: "3rd Place",
    fourth: "4th Place",
    top4: "Top 4",
    top6: "Top 6",
    top8: "Top 8",
    swiss_exit: "Swiss",
    semifinalist: "Top 4",
    quarterfinalist: "Top 8",
  } as Record<string, string>,
};

export const ACH_UI = {
  kicker: "Feats to chase across every run",
  title: "Achievements",
};

export const HOWTO = {
  kicker: "Rules of the game",
  title: "How to Play",
  steps: [
    {
      title: "Draft your roster",
      body: "Each round shows one real historical RLCS lineup. Take exactly one card — a player, the coach, the substitute or the organization. The lineup pool is always fully random, on every difficulty.",
    },
    {
      title: "Free choice, six slots",
      body: "You need 3 players, 1 coach, 1 substitute and 1 org. Pick in any order. Once a person is on your roster, their other versions can't be drafted again this run. If nothing in a lineup fits your remaining slots, the reroll is free.",
    },
    {
      title: "Build chemistry",
      body: "Same historical lineup is the strongest link, same country is strong, same organization counts too. Coaches and subs connected to your players add a little more. Chemistry adds rating — more on higher difficulties.",
    },
    {
      title: "Survive the bracket",
      body: "16 teams. Swiss stage in best-of-5: 3 wins to advance, 3 losses and you're out. Top 8 seed into a double-elimination best-of-7 bracket — an upper-bracket loss drops you to the lower bracket, not out of the event. Your team rating is driven mostly by player overalls — chemistry, org buffs, coach and special effects add the edge.",
    },
    {
      title: "Collect special cards",
      body: "Rare special versions of cards can appear in any draft: iconic moments, MVP runs, legends. Draft one and finish the run — win or lose — and it's unlocked in your collection forever.",
    },
  ],
  difficultiesTitle: "Difficulties",
  unlockable: "Unlockable",
  reroll: (n: number) => `${n} reroll${n === 1 ? "" : "s"}`,
  ovrLockedHidden: "OVR locked hidden",
  ovrOptional: "OVR optional",
  xpMult: (x: number) => `XP ×${x}`,
  raritiesTitle: "Card rarities",
  raritySilver: "Silver",
  rarityGold: "Gold",
  rarityBlue: "Blue",
  raritiesBefore: "Base cards are ",
  raritiesMid1: " (79 or below), ",
  raritiesMid2: " (80–89) and ",
  raritiesAfter:
    " (90+). With overalls hidden, base cards turn black and show ?? — special cards keep their look, but the number stays hidden until the results screen.",
  startFirst: "Start your first draft",
};

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
};

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

/** Engine chemistry tiers → display (the engine emits the English key). */
export const CHEM_TIERS: Record<string, string> = {
  Poor: "Poor",
  Okay: "Okay",
  Good: "Good",
  Great: "Great",
  Perfect: "Perfect",
};

/** The whole dictionary — `copy.pt.ts` must match this shape exactly. */
export const EN = {
  APP,
  NAV,
  HOME,
  NAV_UI,
  RUN_UI,
  SETUP,
  DIFFICULTY_LABELS,
  DRAFT_UI,
  ONBOARDING,
  REVIEW,
  TOURNAMENT_UI,
  RESULTS_UI,
  COLLECTION_UI,
  SETTINGS_UI,
  PROFILE_UI,
  ACH_UI,
  HOWTO,
  NARRATION,
  STAT_LABELS,
  SPECIAL_TYPE_LABELS,
  RARITY_LABELS,
  EFFECT_LABELS,
  CHEM_TIERS,
};

export type Copy = typeof EN;
