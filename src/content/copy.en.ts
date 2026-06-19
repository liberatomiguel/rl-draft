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
    "A free, fan-made Rocket League esports draft game. Build a roster from iconic RLCS lineups, collect legendary special cards, and survive an RLCS-style tournament bracket.",
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
  collectionLocked: "Locked — unlocks at Bronze",
  achievements: "Achievements",
  achievementsDesc: "Feats to chase across every run you play.",
  profile: "Profile",
  profileDesc: "Rank, XP and run history.",
  howToPlay: "How to play",
  joinDiscord: "Join the Discord",
  followTwitter: "Follow on X",
  support: "Buy me a coffee",
  liveBadge: "Live",
  playNow: "Play now →",
  runs: (n: number) => `${n} ${n === 1 ? "run" : "runs"}`,
  titles: (n: number) => `${n} titles`,
};

/**
 * Home long-form SEO content (v1.3). Server-rendered below the menu so crawlers
 * get real, keyword-bearing depth about what Rocket Draft is — an RLCS draft
 * game / Rocket League esports roster builder — without changing the playable
 * menu above it. Presentational: rendered from the active locale's dict.
 */
export const HOME_SEO = {
  heading: "A free RLCS draft game built from Rocket League esports history",
  intro:
    "Rocket Draft is a free, fan-made RLCS draft game — part roster builder, part Rocket League esports history quiz, part tournament simulator. Draft a team from real RLCS lineups spanning 2016 to today, build chemistry, collect special cards from legendary moments, and run an RLCS-style bracket to a championship.",
  sections: [
    {
      id: "how-it-works",
      title: "How the RLCS draft works",
      body: "Every round deals one real historical RLCS lineup. Take a single card — a player, the coach, the substitute or the organization — until you have a full roster of three players, a coach, a sub and an org. Stack the same country, organization or shared lineup and your chemistry climbs, so a coherent team can upset a higher-rated all-star mix. Then a tournament auto-plays: a Swiss stage into double-elimination playoffs, exactly like the real RLCS.",
    },
    {
      id: "modes",
      title: "Three ways to draft",
      body: "Classic Draft is the full experience — six slots, Swiss into double-elim. Quick Draft is players-only and runs a short bracket for a fast session. The Daily Challenge is one seeded draft per day, the same for everyone, with a streak to defend. Four difficulties scale the field, and clearing Hard unlocks Legacy — an all-time gauntlet of championship rosters with overalls hidden.",
    },
    {
      id: "special-cards",
      title: "Special cards from RLCS history",
      body: "Beyond the base roster cards, Rocket Draft hides dozens of special cards tied to unforgettable Rocket League esports moments — Worlds and Major MVP runs, legendary players and iconic plays. Draft one, finish the run win or lose, and it is unlocked in your collection forever. The chase is part of the draft: a single special can swing a series.",
    },
    {
      id: "regions",
      title: "Regional databases — South America & SAM",
      body: "Region-Locked Draft narrows the pool to one scene's full depth — its World Championship teams plus the regional Top 8 that never reached Worlds. South America (SAM) is live now, with a hand-researched roster of Brazilian and South American teams, local heroes and cult underdogs you will not see in the worldwide draft. More regions are on the way.",
    },
    {
      id: "ratings",
      title: "Transparent, hand-reviewed player ratings",
      body: "Every overall is reviewed by hand, not scraped from a single stat line — individual performance, results and historical context all feed the number, and special cards can climb above their base versions. We publish the methodology so the ratings stay honest and the community can push back on them.",
    },
  ],
  /** Descriptive internal links (no \"click here\"). Hrefs live in the component. */
  links: {
    heading: "Explore Rocket Draft",
    howToPlay: "Learn how the RLCS draft works",
    ratings: "Read the player-ratings methodology",
    specialCards: "Browse RLCS special cards",
    strategy: "Read the Rocket Draft strategy guide",
    sam: "Play the SAM Rocket League draft",
    faq: "Rocket Draft FAQ",
    about: "About the project",
    play: "Play the RLCS draft game",
  },
};

export const NAV_UI = {
  backToMenu: "Back to menu",
  changelog: "Changelog",
  privacy: "Privacy",
  howToPlay: "How to play",
  about: "About",
  faq: "FAQ",
  discord: "Discord",
  support: "Support the project",
  madeBy: "Made by",
  inspiredBy: "Inspired by",
  by: "by",
  balancedBy: "Overalls balanced by",
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
  hardLocked: "Reach Silver to unlock Hard.",
  mode: "Game mode",
  modeClassic: "Classic Draft",
  modeClassicHint: "6 slots · Swiss + double-elim playoffs",
  modeQuick: "Quick Draft",
  modeQuickHint: "3 players only · straight 8-team bracket",
  ovrOptional: "OVR optional",
  ovrHidden: "OVR hidden",
  selected: "Selected",
  legacyBadge: "All-time gauntlet",
  region: "Region",
  regionHint: "Lock your run to one region's full scene — or draft worldwide.",
  regionWorldwide: "Worldwide",
  regionWorldwideHint: "Every RLCS World Championship team",
  regionComingSoon: "Coming soon",
  regionLockedBadge: "Region-locked",
  regionDescWorldwide:
    "Every RLCS World Championship team. Tap a region to lock the draft to its scene — only SAM is live for now, more coming soon.",
  regionDescLocked: (region: string) =>
    `${region} only — a deeper pool that also includes teams that never reached Worlds.`,
  regionNames: {
    NA: "North America", EU: "Europe", SAM: "South America", MENA: "MENA",
    OCE: "Oceania", APAC: "APAC", SSA: "Sub-Saharan Africa",
  } as Record<string, string>,
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
    "Fill 3 players, a coach, a sub and an org. Chemistry is your edge: stack the same country, org or historical lineup and a coherent roster can beat a higher-rated all-star mix — the top overall isn't always the smart pick.",
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
  regionalTitle: "Regional Draft",
  regionalIntro: "This run is locked to one region's scene. Here's what changes:",
  regionalSteps: [
    "The pool is region-only — its Worlds teams PLUS the regional Top 8 that never reached a World Championship.",
    "Deeper benches, local heroes and cult underdogs you'll never see in the worldwide draft.",
    "Everything else is the same: difficulty, chemistry, the full tournament. Win it to fly your region's flag.",
  ],
  regionalCta: "Let's run it",
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

export const TUTORIAL = {
  kicker: "Welcome",
  title: "How Rocket Draft works",
  skip: "Skip",
  next: "Next",
  back: "Back",
  done: "Let's play",
  steps: [
    {
      icon: "draft",
      title: "Draft your team",
      body: "Each round shows one lineup from RLCS history — pick a card to fill a slot. Build three players, a coach, a sub and an org.",
    },
    {
      icon: "field",
      title: "Then simulate",
      body: "Your team plays a full tournament — Swiss, then playoffs. Player overalls plus chemistry decide who lifts the trophy.",
    },
    {
      icon: "collection",
      title: "Build a Collection",
      body: "Special cards you draft are saved forever in your Collection — rare moments from RLCS history to chase and complete.",
    },
    {
      icon: "rank",
      title: "Ranks & rewards",
      body: "Every run earns XP. Ranking up unlocks the Collection, new card rarities, Hard mode, and a higher special-card chance.",
    },
    {
      icon: "difficulty",
      title: "Pick your challenge",
      body: "Normal is winnable with a good team. Hard hides overalls and stiffens the field. Legacy is an all-time gauntlet — for champions only.",
    },
  ] as { icon: string; title: string; body: string }[],
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
  share: "Share run",
  shareTitle: "Share your run",
  shareNative: "Share",
  shareX: "Share on X",
  shareDownload: "Download",
  shareMsgChampion: "I'm a Rocket Draft champion 🏆 — build your own RLCS dream team at",
  shareMsgPlacement: (placement: string) =>
    `I made ${placement} on Rocket Draft — build your own RLCS dream team at`,
  immaculateBadge: "Flawless run",
  ceremonyKicker: "New card unlocked",
  ceremonyTap: "Tap anywhere to reveal",
  ceremonyContinue: "Continue",
  ceremonyNext: "Next card",
  rankUpKicker: "Rank up",
  rankUpTitle: "Rank up!",
  rankUpHint: "Tap anywhere to continue",
  rankUpUnlocked: "Unlocked",
  unlockCollection: "The Collection",
  unlockRarity: (label: string) => `${label} special cards`,
  unlockHard: "Hard mode",
  unlockChance: (pct: number) => `${pct}% special card chance`,
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
  lockedTitle: "Collection locked",
  lockedBody:
    "Reach Bronze to open your collection — just finish one run. Special cards you draft are saved here, and rarer tiers unlock as you climb the ranks.",
  unlocksAt: (rank: string) => `Unlocks at ${rank}`,
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
  secretTitle: "???",
  secretHint: "Hidden — discover it in play",
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
  season_mvp: "Season MVP",
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
  creator: "Creator",
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

// Long-form legal/notes pages — translated since v1.1.1 (the rendered view
// reads these via useCopy(); the route metadata stays EN for SEO). The product
// name "Rocket Draft" and version numbers/dates are intentionally not localized.
export const PRIVACY = {
  kicker: "Legal",
  title: "Privacy Policy",
  sections: [
    {
      title: "The short version",
      body: [
        "Rocket Draft is a free, fan-made game. It does not require an account, and it does not sell or share your personal data. Your game progress is stored on your own device.",
      ],
    },
    {
      title: "What's stored on your device",
      body: [
        "Your XP, rank, collection, achievements, run history, daily-challenge results and settings are saved in your browser's local storage. This data never leaves your device unless you explicitly export it.",
        "Clearing your browser data, or playing in a different browser or in private mode, will reset this progress.",
      ],
    },
    {
      title: "Analytics",
      body: [
        "We use privacy-friendly, aggregate analytics to understand how many people visit, which pages are popular, how the game performs, and how runs play out — for example which difficulties people choose and how often runs are finished. This is measured with Vercel Web Analytics and PostHog, configured to be cookieless and anonymous: it uses no advertising cookies, does not identify you personally, and honours your browser's Do Not Track setting.",
        "Search-engine statistics (how often the site appears in results) come from Google Search Console, which only reports aggregate, anonymous data.",
      ],
    },
    {
      title: "Accounts (coming later)",
      body: [
        "A future update will add optional Discord sign-in so your progress can sync across devices and power leaderboards. It will be entirely opt-in; until you choose to sign in, nothing is sent to a server. When it ships, this policy will be updated to describe exactly what is stored.",
      ],
    },
    {
      title: "Third-party links",
      body: [
        "The site links to external services (Discord, X, a support page). Those services have their own privacy policies, which apply once you leave this site.",
      ],
    },
    {
      title: "Not affiliated",
      body: [
        "Rocket Draft is an unofficial, non-commercial fan project. It is not affiliated with Psyonix, Epic Games, or any esports organization. Rocket League is a trademark of its respective owners.",
      ],
    },
  ],
  contactBefore: "Questions? Reach out to",
  contactBetween: "on",
};

export const CHANGELOG_PAGE = {
  kicker: "Release notes",
  title: "Changelog",
  latest: "Latest",
  releases: [
    {
      version: "1.3.0",
      name: "Season Rewards",
      date: "2026",
      current: true,
      notes: [
        "Season Rewards progression: your rank now unlocks content — special-card rarities, the Collection, and a higher special-card chance as you climb from Bronze to Supersonic Legend.",
        "New chemistry system — build your team around nationality and organization. Three players from the same country reach Great; add a shared org for Perfect.",
        "Legacy mode rebalanced — the all-time gauntlet is still brutal, but the title is finally winnable with a great, coherent draft.",
        "Org-unique tournament fields — you no longer face the same org's different seasons in one bracket.",
        "Reworked simulation: wins and losses split into columns, the whole playoff round reveals at once, and special cards always show their art.",
        "A first-launch tutorial, a share-your-run card with social sharing, and the team-overall breakdown now on the results screen.",
        "Community overall review (69 ratings updated), new SAM teams and special cards, and a new legendary achievement.",
      ],
    },
    {
      version: "1.2.2",
      name: "",
      date: "2026",
      notes: [
        "Org cards are easier to read — instead of cryptic dots and plus signs, they now say it plainly: \"+2 Mechanics\" for a boost, or \"No buff\" when there's none. Coach cards match.",
        "Roster touch-ups: added some missing coaches (Team Liquid, mousesports, Evil Geniuses, Canberra Havoc) and corrected a couple of names.",
      ],
    },
    {
      version: "1.2.1",
      name: "",
      date: "2026",
      current: false,
      notes: [
        "Today's Daily Challenge is a special one — \"Loaded Draft\": two special cards are guaranteed to show up in your draft, against a tougher field. Make the star power count.",
        "Special cards now show their boost at a glance — a little tag like \"+5 MEC\" right on the card. On hidden-overall runs it teases the stat as \"+?? MEC\".",
        "Achievements got more colorful — the trophy wall now reads varied instead of one shade per tier. Legend achievements keep their signature prismatic look.",
        "Cards read better on phones: after the bigger logos, the draft and team-reveal cards no longer cut off any info on mobile.",
        "Easier to reach Perfect team chemistry — a roster that commits to a country, org or shared lineup now pays off at the top tier.",
        "The Creator card finally shows its glow on the field, like every other special.",
        "Results screen polish: the coach, sub and org cards now line up neatly under your three players.",
        "Sharper wording across the site so the right people can find the game.",
      ],
    },
    {
      version: "1.2.0",
      name: "Regional Champions",
      date: "2026",
      current: false,
      notes: [
        "New: Region-Locked Draft. Pick a region on the setup screen and draft from its whole scene — the Worlds teams PLUS the regional Top 8 that never reached a World Championship. South America (SAM) is live now; more regions are coming soon.",
        "A much deeper South American pool — dozens of new SAM teams and players researched from Liquipedia.",
        "Player and coach ratings across the whole game got a hand-reviewed tuning pass.",
        "A new achievement for winning a region-locked run — and a hidden card out there for the curious.",
        "Fixed: switching from Hard back to Normal or Easy now turns overalls back on automatically.",
        "Tutorials got a visual refresh, and the rank-up, new-card and Legacy-unlock moments are now full-screen and wait for you — they only move on when you do.",
        "Every team now wears its real logo, including the new South American orgs — and historic clubs like NRG, Dignitas, Spacestation and Vitality show the logo that matched each season.",
        "Behind the scenes: faster page loads and Google indexing fixes.",
      ],
    },
    {
      version: "1.1.1",
      name: "",
      date: "2026",
      current: false,
      notes: [
        "More special cards to collect — 80+ legendary players, MVP moments and coaches.",
        "The collection reads better on phones: two cards per row instead of one oversized card.",
        "Clearer first-time guides — each tip is now its own card.",
        "Privacy Policy and Changelog are now available in Portuguese.",
        "Groundwork for performance and usage insights that will guide future updates.",
      ],
    },
    {
      version: "1.0.0",
      name: "Kickoff",
      date: "2026",
      current: false,
      notes: [
        "Public launch on rocketdraft.app.",
        "Full Portuguese (PT-BR) translation with a language switcher.",
        "Settings: volume, reduced motion, animation speed and language.",
        "Subtle sound effects throughout the draft and tournament.",
        "Richer daily challenges with a fixed seed and a daily number.",
        "Card polish: rarity-colored overalls, holographic special cards on the field, sharper layouts.",
        "Export / import your progress so it's never lost.",
      ],
    },
    {
      version: "0.6.x",
      name: "Main Stage",
      date: "2026",
      current: false,
      notes: [
        "Reworked special-card rarities (legendary white-gold, mythic red, epic, rare) with effects that ramp by tier.",
        "Rank-up and card-unlock celebrations; first-Hard-win unlocks the Legacy gauntlet.",
        "Smoother mobile play and a one-tap run reset.",
      ],
    },
    {
      version: "0.5.x",
      name: "",
      date: "2026",
      current: false,
      notes: [
        "First live playtest round: balance overhaul and a more readable tournament playback.",
        "Special cards belong to the player; slot-machine lineup reveal in the draft.",
      ],
    },
    {
      version: "0.4.0",
      name: "",
      date: "2026",
      current: false,
      notes: ["Full RLCS finals dataset — 208 lineups, 624 cards, 2016–2026."],
    },
    {
      version: "0.1.0 – 0.3.0",
      name: "",
      date: "2025–2026",
      current: false,
      notes: [
        "Core draft, Swiss + double-elimination tournament, collection, achievements and progression.",
        "Quick Draft and Daily Challenge modes.",
      ],
    },
  ],
};

/** The whole dictionary — `copy.pt.ts` must match this shape exactly. */
export const EN = {
  APP,
  NAV,
  HOME,
  HOME_SEO,
  NAV_UI,
  RUN_UI,
  SETUP,
  DIFFICULTY_LABELS,
  DRAFT_UI,
  ONBOARDING,
  TUTORIAL,
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
  PRIVACY,
  CHANGELOG_PAGE,
};

export type Copy = typeof EN;
