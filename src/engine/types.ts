/**
 * Core domain types for Rocket Draft.
 *
 * This file is the single source of truth for every entity in the game.
 * It is split in three sections:
 *   1. Data entities  — mirror the JSON files in /src/data
 *   2. Run state      — everything that describes one game (draft → tournament → results)
 *   3. Derived values — ratings, chemistry, results
 *
 * The engine (src/engine) only depends on these types + balance config.
 * No React / UI types are allowed here.
 */

// ---------------------------------------------------------------------------
// 1. Data entities
// ---------------------------------------------------------------------------

export type Region = "NA" | "EU" | "SAM" | "MENA" | "OCE" | "APAC" | "SSA";

export type Difficulty = "easy" | "normal" | "hard" | "legacy";

/**
 * Game modes. classic = full 6-slot draft + Swiss + double elim.
 * quick = players only + straight single-elim bracket.
 * daily = classic structure with a date-seeded modifier set.
 */
export type RunMode = "classic" | "quick" | "daily" | "challenge";

/**
 * Visual rarity of a base card, derived from overall (see balance.RARITY).
 * "common" = no rarity (low overalls, neutral orgs, placeholder cards).
 */
export type BaseRarity = "common" | "silver" | "gold" | "blue";

export type SpecialRarity =
  | "rare"
  | "epic"
  | "mythic"
  | "legendary"
  // The secret Creator card — liberatoRL ONLY (rose/violet, easter-egg).
  | "creator"
  // Wings E-Sports easter-egg cards (orange) — repi/ninja23509, surface only when
  // the Wings line is drawn, like the Creator. Distinct rarity from "creator".
  | "wings"
  // Content-creator cards (v1.4): emerald/teal, for creators who help spread the
  // game. Appear in NORMAL draws (not easter-egg), at the rare tier.
  | "community"
  // National-team cards (v2.0, gold): every card of a FIFAe national lineup.
  // Never rolled — a national lineup is a rare draw of its own and ALL its cards
  // show as their national special (Lineup.national, DRAFT.nationalTeamChance).
  | "national";

export type SpecialCardType =
  | "moment"
  | "major_mvp"
  | "worlds_mvp"
  | "season_mvp"
  | "mythic"
  | "legend"
  | "coach"
  | "national";

/** Org / coach buff notation used across the game. `~` means neutral. */
export type BuffLevel = "~" | "+" | "++" | "+++";

export type StatKey =
  | "offense"
  | "defense"
  | "mechanics"
  | "consistency"
  | "experience"
  | "clutch";

export type Stats = Record<StatKey, number>;

export type HistoricalStrength = "elite" | "strong" | "solid" | "underdog";

/** A real person. Identity only — strength lives on cards. */
export interface Player {
  id: string;
  nickname: string;
  realName?: string;
  /**
   * ISO 3166-1 alpha-2 country code, e.g. "BR", "FR", "US".
   * Optional — the imported dataset doesn't carry nationality for everyone;
   * same-country chemistry only applies when both sides have one.
   */
  country?: string;
  /**
   * Birth date "YYYY-MM-DD" (v2.0 base export, PandaScore) — optional. The
   * career uses its year for the player's real age (deriveBirthYear).
   */
  birthday?: string;
  region: Region;
}

export interface Season {
  id: string;
  /** Display label, e.g. "RLCS Season 6". */
  label: string;
  /** Short label for tight card layouts, e.g. "S6 ’18". */
  shortLabel: string;
  year: string;
  /** Chronological position (1 = RLCS S1) — drives era-logo resolution. */
  order: number;
}

/**
 * A version of a player in a specific lineup/season.
 * The same person can have many cards with different overalls.
 */
export interface PlayerCard {
  id: string;
  playerId: string;
  orgId: string;
  lineupId: string;
  seasonId: string;
  /** Calculated base overall (before manual adjustment). */
  overall: number;
  /** Curator adjustment, normally -3..+3 (exceptional -5..+5). Stored separately. */
  manualAdjustment: number;
  /** Optional internal stats. Missing keys fall back to overall in the engine. */
  stats?: Partial<Stats>;
  imageUrl?: string;
}

export interface Org {
  id: string;
  name: string;
  region: Region;
  buffType: StatKey;
  buffLevel: BuffLevel;
  logoUrl?: string;
  /**
   * Era logos (v0.5.1): seasons with order <= untilOrder use the asset
   * public/orgs/<orgId>@<key>.png — orgs rebrand (NRG classic vs modern)
   * and the card should wear the logo of ITS season. Default logo otherwise.
   */
  logoEras?: { key: string; untilOrder: number }[];
}

export interface CoachCard {
  id: string;
  /** Person identity for "cannot draft twice" rule. Generic staff use the card id. */
  personId: string;
  name: string;
  country?: string;
  region?: Region;
  orgId: string;
  lineupId: string;
  seasonId: string;
  overall: number;
  bonusType: StatKey;
  bonusLevel: BuffLevel;
  /** True for anonymous "Coaching Staff" placeholder cards. */
  generic?: boolean;
}

export interface SubCard {
  id: string;
  personId: string;
  name: string;
  country?: string;
  region: Region;
  orgId: string;
  lineupId: string;
  seasonId: string;
  overall: number;
  stats?: Partial<Stats>;
}

/** A historical roster used both as draft offer and as tournament opponent. */
export interface Lineup {
  id: string;
  /** Display name, e.g. "Gale Force Esports". Usually the org name. */
  name: string;
  seasonId: string;
  orgId: string;
  region: Region;
  playerCardIds: [string, string, string];
  coachId?: string;
  subId?: string;
  /**
   * Org buff strength AS OF this season (orgs grow/shrink era to era).
   * Falls back to the org entity's default level when absent.
   */
  orgBuffLevel?: BuffLevel;
  /**
   * Region-only lineup (v1.2.0; any region since v2.0 — the name is historical):
   * a roster below the international bar. Excluded from the general
   * draft/opponent/daily pools; appears only in its region's Region-only mode.
   * In a region WITHOUT that mode (REGION_LOCK.regions: APAC, SSA) it stays
   * dormant until the region opens (rc.25; see isRegionOnly / isObtainable).
   */
  samOnly?: boolean;
  /**
   * Easter-egg lineup (v1.2.0): excluded from the normal draw AND the opponent
   * pool; instead force-injected into one draft offer at DRAFT.easterEggChance
   * (region-locked mode only). Used by the Wings creator team — when it appears,
   * the creator's card is guaranteed to show as the Creator special.
   */
  rareSpawn?: boolean;
  /**
   * National team (v2.0, a FIFAe season): never in the normal draw, the opponent
   * field, dailies or challenges. Classic/quick drafts inject one at
   * DRAFT.nationalTeamChance per offer, and then every card shows as its national
   * special; seeing the lineup collects all of them (engine/draft nationalUnlocks).
   */
  national?: boolean;
  historicalStrength: HistoricalStrength;
}

export type SpecialEffectType =
  // v3 effect model: direct attribute boosts (simple, no conditions).
  | "attribute_boost" // + value to the card's listed attributes
  | "team_attribute_boost" // + value to the TEAM's listed attributes (coach)
  // Legacy situational types — still supported by the engine.
  | "clutch_boost"
  | "swiss_consistency"
  | "playoff_experience"
  | "upset_boost"
  | "defense_stability"
  | "high_roll";

export interface SpecialEffect {
  type: SpecialEffectType;
  /** Boosted attributes for the attribute_boost family. */
  attributes?: StatKey[];
  value: number;
  /**
   * Flat bonus to the TEAM's final overall (rating.total), independent of the
   * attribute boost above. Used by the Creator card (v1.3.3) to "lift the whole
   * team" on the scoreboard, not just its situational stats. Stacks across cards.
   */
  overallBonus?: number;
  /** Human readable, shown in collection/team review. */
  description: string;
}

export interface SpecialCard {
  id: string;
  /** "player" (default) or "coach". */
  kind?: "player" | "coach";
  /** Person identity (player id, or coach person id for coach specials). */
  playerId: string;
  /** Base card replaced in draft offers: a player card or a coach card. */
  baseCardId: string;
  title: string;
  cardType: SpecialCardType;
  rarity: SpecialRarity;
  overall: number;
  stats?: Partial<Stats>;
  effect: SpecialEffect;
  /** Short historical context shown in the collection. */
  flavor: string;
  imageUrl?: string;
  /** Event-exclusive window (v2.0): offered only between these UTC dates
   *  (inclusive). `huntRuns` = runs finished inside the window before the
   *  Special Hunt boost kicks in (SPECIALS.event.defaultHuntRuns when unset). */
  event?: { from: string; to: string; huntRuns?: number };
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  xp: number;
  /** Rarity family in the achievements grid (v1.2.0): common · rare · epic · legend. */
  category: "common" | "rare" | "epic" | "legend";
  /** Thematic grouping bucket on the achievements screen (v1.4). */
  group:
    | "milestone"
    | "mode"
    | "performance"
    | "chemistry"
    | "roster"
    | "collection"
    | "progression";
  /** Hidden until earned (v1.2.0) — shown as a locked mystery in the grid. */
  secret?: boolean;
}

// ---------------------------------------------------------------------------
// 2. Run state (one game from setup to results)
// ---------------------------------------------------------------------------

export type RunPhase = "draft" | "review" | "tournament" | "results" | "challenge";

export type RosterSlotId =
  | "player1"
  | "player2"
  | "player3"
  | "coach"
  | "sub"
  | "org";

export type CardKind = "player" | "coach" | "sub" | "org";

/** One card inside a draft offer, with availability resolved. */
export interface DraftOfferCard {
  kind: CardKind;
  /** PlayerCard.id | CoachCard.id | SubCard.id | Org.id */
  refId: string;
  /** Set when this player card appears as its special version. */
  specialId?: string;
  /** "vacant" = the lineup has no coach/sub — shown but never pickable (v0.5).
   *  "ineligible" = excluded by a challenge constraint (e.g. over the OVR cap or
   *  wrong nationality) — shown dimmed, never pickable (v1.4). */
  availability: "available" | "slot_full" | "already_drafted" | "vacant" | "ineligible";
}

export interface DraftOffer {
  lineupId: string;
  cards: DraftOfferCard[];
  /** False when nothing in the offer can be picked → a free reroll is granted. */
  hasPickableCard: boolean;
}

export interface RosterPick {
  slot: RosterSlotId;
  kind: CardKind;
  refId: string;
  specialId?: string;
  fromLineupId: string;
}

export type Roster = Partial<Record<RosterSlotId, RosterPick>>;

/** One step of a scripted daily draft (one per pick, in order). */
export interface DraftScriptStep {
  /** The exact lineup to offer for this pick. */
  lineupId: string;
  /** Force a player in that lineup to appear as a specific special card. */
  special?: { playerId: string; specialId: string };
}

export interface DraftState {
  mode: RunMode;
  round: number;
  rerollsLeft: number;
  /** Lineups already shown this run (drawn without replacement). */
  shownLineupIds: string[];
  /** Person ids that can no longer be drafted (players, coaches, subs). */
  takenPersonIds: string[];
  /** Restricted lineup pool (daily challenges). Undefined = full pool. */
  poolLineupIds?: string[];
  /** Challenge constraint (v1.4) — per-card eligibility (OVR cap / nationality). */
  constraint?: ChallengeConstraint;
  /** Multiplier on the special-appearance chance (daily modifier; v1.3 also
   *  carries the rank-scaled chance for classic/quick runs). */
  specialChanceMult?: number;
  /**
   * Rank-gated special rarities that may appear (v1.3). Undefined = no gate (all
   * rarities — used by the daily). An empty array means specials are locked
   * (Unranked). Set from the player's rank in runStore for classic/quick runs.
   */
  specialRarities?: string[];
  /**
   * Daily "scripted" draft (v1.2.1): an exact ordered lineup per pick (index =
   * picks made so far), each optionally forcing a player to appear as a specific
   * special. Lets an authored daily curate the whole draft. A scripted offer that
   * can't fill the remaining slots falls back to a normal draw (see draft.ts).
   * Keyed off picks made (reroll-proof). Undefined = normal random draft.
   */
  scriptedLineups?: DraftScriptStep[];
  /**
   * Event-exclusive specials for this run (v2.0): `active` = inside their window
   * today (offerable, rarity gate bypassed); `boosted` = the Special Hunt ramp
   * applies (the player finished enough runs in the window). Fixed at draft
   * creation so a run stays deterministic across midnight. Undefined = none.
   */
  eventSpecials?: { active: string[]; boosted: string[] };
  /**
   * National-team draws (v2.0): set ONLY for classic/quick runs, so dailies and
   * challenges never see one and keep their seeded RNG sequence. `discovered` =
   * national lineups whose cards the player already owns — undiscovered ones are
   * favoured (DRAFT.nationalUndiscoveredWeight) so the album can be completed.
   */
  nationalTeams?: { discovered: string[] };
  offer: DraftOffer | null;
  roster: Roster;
  complete: boolean;
}

// --- Tournament ---

export interface TeamRatingBreakdown {
  avgPlayerOverall: number;
  coachMod: number;
  subMod: number;
  orgMod: number;
  chemMod: number;
  specialMod: number;
  /** Flat opponent shift from difficulty (0 for the user team). */
  difficultyShift: number;
  total: number;
}

export interface ChemistryBreakdownItem {
  label: string;
  points: number;
}

export interface ChemistryResult {
  raw: number;
  max: number;
  percent: number;
  tier: "Poor" | "Okay" | "Good" | "Great" | "Perfect";
  items: ChemistryBreakdownItem[];
}

/** A resolved tournament participant (the user team or an AI lineup). */
export interface TournamentTeam {
  id: string;
  name: string;
  isUser: boolean;
  region: Region;
  /** Source lineup for AI teams. */
  lineupId?: string;
  rating: TeamRatingBreakdown;
  chemistry: ChemistryResult;
  /** Average internal stats used for situational modifiers. */
  stats: Stats;
  /** Special cards active on this team (user picks or AI upgrades). */
  specialIds: string[];
  /** Player nicknames — used for star-of-the-game narration. */
  playerNames: string[];
  orgId: string;
}

export interface GameResult {
  index: number;
  winnerTeamId: string;
  /** Goals, winner first. Flavor only — series logic uses winners. */
  score: [number, number];
  overtime: boolean;
  deciding: boolean;
  /** Message keys resolved to text by the UI layer. */
  notes: string[];
  /** Star of the game (a player nickname from the winning side). */
  starName?: string;
  /** Goals per player for each side (v1.4) — `a`/`b` map to teamA/teamB players,
   *  in roster order. Drives goal-based achievements (hat-trick, etc.). Derived
   *  deterministically from the game WITHOUT consuming the series RNG, so it
   *  never shifts existing seeds. */
  scorers?: { a: number[]; b: number[] };
}

export interface SeriesResult {
  teamAId: string;
  teamBId: string;
  games: GameResult[];
  /** Series score: [teamA wins, teamB wins]. */
  score: [number, number];
  winnerTeamId: string;
  /** Rating difference (teamA - teamB) at sim time. */
  ratingDiff: number;
  upset: boolean;
  /** The winner trailed by `SIMULATION.comebackDeficit` games at some point (v2.0). */
  comeback?: boolean;
}

export interface SwissRound {
  round: number;
  series: SeriesResult[];
  /** Id of the user series in this round, if the user was still alive. */
  userSeriesIndex: number | null;
}

export interface SwissTeamRecord {
  teamId: string;
  wins: number;
  losses: number;
  gameDiff: number;
  status: "active" | "advanced" | "eliminated";
}

export interface SwissState {
  rounds: SwissRound[];
  records: SwissTeamRecord[];
  /** Pre-computed pairings for the next round (UI shows the matchup early). */
  nextPairings: [string, string][] | null;
  finished: boolean;
}

/**
 * Playoff rounds in play order. The double-elimination set (classic mode)
 * plus the straight single-elimination set (quick mode).
 */
export type PlayoffRoundName =
  | "ub_quarterfinal"
  | "lb_round1"
  | "ub_semifinal"
  | "lb_round2"
  | "ub_final"
  | "lb_semifinal"
  | "lb_final"
  | "third_place"
  | "grand_final"
  | "quarterfinal"
  | "semifinal"
  | "final";

export interface PlayoffRound {
  name: PlayoffRoundName;
  series: SeriesResult[];
}

export interface PlayoffState {
  format: "double" | "single";
  /** Seeded team ids, best record first. */
  seeds: string[];
  rounds: PlayoffRound[];
  championTeamId: string | null;
  finished: boolean;
}

export type TournamentStage = "swiss" | "playoffs" | "finished";

export interface TournamentState {
  teams: Record<string, TournamentTeam>;
  swiss: SwissState;
  playoffs: PlayoffState | null;
  stage: TournamentStage;
  userEliminated: boolean;
  /**
   * Career v2.0 (R40): a Swiss-ONLY event (the regional qualifier) — the
   * tournament is "finished" the moment the Swiss stage ends, `playoffs`
   * stays null. Absent on every Draft-mode state (their shape is unchanged).
   */
  swissOnly?: true;
}

// --- Results ---

export type Placement =
  | "champion"
  | "runner_up"
  | "third"
  | "fourth"
  | "top4"
  | "top6"
  | "top8"
  | "swiss_exit";

export interface XpLine {
  label: string;
  amount: number;
}

export interface XpSummary {
  lines: XpLine[];
  /** The whole run-line multiplier: difficulty × game mode (e.g. 1.5 for Hard,
   *  0.75 for a Hard Quick Draft). Applied to run lines, not achievement lines. */
  difficultyMultiplier: number;
  /** rc.29: the two factors inside `difficultyMultiplier`, for the results
   *  breakdown. Optional so results saved before rc.29 stay valid. */
  factors?: { difficulty: number; mode: number };
  hiddenOverallBonus: number;
  total: number;
}

/** rc.29: which stage a series was played in, as data — the screens name it in
 *  the active language (`stage` strings are English). */
export type StageRef = { kind: "swiss"; round: number } | { kind: "playoffs"; round: string };

export interface SeriesHighlight {
  opponentName: string;
  score: [number, number];
  /** English stage label ("Swiss Round 2", "Grand Final"); the fallback name. */
  stage: string;
  /** rc.29: the stage as data (absent on results saved before rc.29). */
  stageRef?: StageRef;
}

export interface RunResults {
  placement: Placement;
  swissRecord: { wins: number; losses: number };
  playoffWins: number;
  championName: string | null;
  bestPlayerCardId: string | null;
  biggestWin: SeriesHighlight | null;
  closestSeries: SeriesHighlight | null;
  worstLoss: SeriesHighlight | null;
  /** Total goals conceded across the whole run (0 → "Untouchable"). */
  goalsConceded: number;
  unlockedSpecialIds: string[];
  newAchievementIds: string[];
  /** This run's user totals for the lifetime counters (v1.4). */
  userGoals: number;
  userGameWins: number;
  xp: XpSummary;
  /**
   * The historical lineup that eliminated the user (lost runs only, v0.7.0).
   * Gated by FEATURES.showEliminatorTeam — null when the user is champion or
   * the feature is off. Optional so older persisted runs stay valid.
   */
  eliminatedBy?: EliminatorTeam | null;
}

/** The lineup that knocked the user out, for the results-screen reveal. */
export interface EliminatorTeam {
  lineupId: string;
  name: string;
  /** Stage label, e.g. "Grand Final" / "Swiss Round 5". */
  stage: string;
  /** rc.29: the stage as data (absent on results saved before rc.29). */
  stageRef?: StageRef;
  /** Final series score, user's wins first. */
  score: [number, number];
  /** The eliminator's team overall (intrinsic — difficulty shift stripped). */
  overall: number;
  /** True when the difficulty inflated this opponent (Legacy / region-lock). */
  buffed: boolean;
  /** Specials the eliminator actually fielded (AI player upgrades). */
  specialIds: string[];
}

/** Daily-challenge metadata attached to a run. */
export interface DailyInfo {
  /** ISO date (UTC), e.g. "2026-06-12" — also drives the shared seed. */
  date: string;
  /** Sequential challenge number since launch (#1, #2, …). */
  n: number;
  label: string;
  description: string;
  /** Optional bonus objective evaluated at results time. */
  objective?: DailyObjective;
}

export interface DailyObjective {
  type:
    | "chemistry_good"
    | "chemistry_great"
    | "concede_under"
    | "win_title"
    | "team_overall_under";
  /** Threshold for concede_under (max goals) / team_overall_under (max OVR). */
  value?: number;
  label: string;
  bonusXp: number;
}

/** The whole state of one run. Persisted so a refresh resumes the game. */
export interface RunState {
  runId: string;
  mode: RunMode;
  /** Region-locked run (v1.2.0): e.g. "SAM". Undefined = worldwide (default). */
  regionLock?: Region;
  seed: number;
  /** Mutable RNG cursor — persisted so reloads stay deterministic. */
  rngState: number;
  difficulty: Difficulty;
  /** Effective visibility (already accounts for Hard/Legacy lock). */
  showOverall: boolean;
  phase: RunPhase;
  startedAt: string;
  /** Profile XP the instant this run was created — the rank-up baseline (v1.4.4).
   *  Lets the results screen fire the rank-up ceremony for the run's WHOLE XP gain,
   *  including mid-run achievement XP that was already applied live (which otherwise
   *  poisons an `xpNow − results.xp.total` estimate). Optional: runs persisted before
   *  v1.4.4 fall back to the estimate. */
  xpAtStart?: number;
  daily?: DailyInfo;
  /** Set on `mode: "challenge"` runs (v1.4) — the puzzle being attempted. */
  challengeId?: string;
  draft: DraftState;
  tournament: TournamentState | null;
  /** The challenge match (single Bo7 vs a fixed boss) — challenge mode only. */
  challenge: ChallengeRunState | null;
  results: RunResults | null;
}

// ---------------------------------------------------------------------------
// Challenges (v1.4) — rank-unlocked authored puzzles: a constrained draft then
// a single Bo7 against a fixed historical lineup. Data shape lives in
// src/data/schemas.ts (Challenge); these are the runtime/engine types.
// ---------------------------------------------------------------------------

/** A hand-authored challenge (data shape; validated by challengeSchema). */
export interface Challenge {
  id: string;
  title: string;
  brief: string;
  rankRequired: string;
  prereq?: string;
  opponentLineupId: string;
  fixedPlayerCardId?: string;
  tier: "common" | "rare" | "epic" | "legend";
  seed: number;
  /** `opponentShift` (v1.4) is a per-challenge boss balance knob: a flat rating
   *  delta added to the boss ON TOP of the difficulty shift (negative = handicap).
   *  It's how a famous superteam stays the headline opponent yet is BEATABLE by a
   *  good draft from a constrained pool — tuned so realistic play wins ~50%
   *  (legend ~30%). Defaults to 0. */
  sim: { difficulty: Difficulty; bestOf: number; opponentShift?: number };
  constraint?: ChallengeConstraint;
  reward: { xp: number; badge?: string; specialId?: string };
  /**
   * v2.0. `kind` defaults to "boss" (one series vs `opponentLineupId`). A
   * "gauntlet" plays `gauntlet.lineupIds` in order (each a Bo`gauntlet.bestOf`,
   * with the same `opponentShift`) and THEN the boss (Bo`sim.bestOf`); one lost
   * series ends the run. `stars` are the two extra objectives (star 1 is always
   * the main clear); each pays star XP the first time it is earned.
   */
  kind?: "boss" | "gauntlet";
  gauntlet?: { lineupIds: string[]; bestOf: number };
  stars?: [ChallengeStar, ChallengeStar];
}

/** An extra objective on a challenge (stars 2 and 3), evaluated on a CLEAR. */
export type ChallengeStar =
  | { kind: "noSpecials" }
  | { kind: "sweep"; maxLosses: number }
  | { kind: "maxOverall"; max: number }
  | { kind: "chemistry"; tier: "Good" | "Great" | "Perfect" }
  | { kind: "underdog" }
  | { kind: "maxRerolls"; max: number }
  | { kind: "goals"; min: number }
  | { kind: "concede"; max: number }
  | { kind: "noLosses" }
  /** rc.20: every drafted player from ONE region / ONE RLCS season. */
  | { kind: "sameRegion" }
  | { kind: "sameSeason" };

/** The optional "twist" on a challenge draft. All fields are optional. */
export interface ChallengeConstraint {
  /** Each drafted player must be <= this overall (the Underdog twist). */
  maxPlayerOverall?: number;
  /** Draft pool restricted to one region's lineups (Region Pride). */
  region?: Region;
  /** ...or to a single season/era (Era Lock). */
  seasonId?: string;
  /** ...or every drafted player must be this nationality (One Nation). */
  country?: string;
  /** Base cards only — no specials roll in the draft (Purist). */
  noSpecials?: boolean;
}

/** Live state of a challenge match (the single Bo7 vs the fixed boss). */
export interface ChallengeRunState {
  user: TournamentTeam;
  opponent: TournamentTeam;
  /** Null until the player presses play; then the simulated series (the BOSS
   *  series for a gauntlet — its stages live in `stages`). */
  series: SeriesResult | null;
  /** True once `series.winnerTeamId === user.id` — the puzzle is solved. */
  cleared: boolean;
  /** The player's XP the instant before the clear reward was applied — lets the
   *  cleared screen fire the rank-up celebration if the reward crossed a rank (v1.4). */
  xpBefore?: number;
  /** Gauntlet (v2.0): the opponents before the boss and the series played so far
   *  (in order). `failedAt` = index of the lost stage, if the run ended early. */
  stages?: { opponents: TournamentTeam[]; results: SeriesResult[]; failedAt: number | null };
  /** Stars earned by THIS attempt (bit 0 = clear, 1 = star 2, 2 = star 3) and the
   *  ones that were new for the profile, once the attempt is over (v2.0). */
  starsEarned?: number;
  starsNew?: number;
  /** Rerolls used in the draft (for the "maxRerolls" star). */
  rerollsUsed?: number;
}

// ---------------------------------------------------------------------------
// 3. Profile / persistence
// ---------------------------------------------------------------------------

export interface RunHistoryEntry {
  runId: string;
  date: string;
  difficulty: Difficulty;
  /** Game mode (v1.4) — for leaderboard attribution + run-history detail. */
  mode: RunMode;
  /** Region lock, or null for worldwide (v1.4) — splits the overall records. */
  region: Region | null;
  hiddenOverall: boolean;
  placement: Placement;
  teamOverall: number;
  swissRecord: { wins: number; losses: number };
  rosterNames: string[];
  xpGained: number;
  /** Optional rich recap (v1.4) so the profile can replay "how that run went":
   *  the drafted roster on a field + key outcome facts. Older entries lack it and
   *  degrade to the flat row summary. Kept compact (refs, not resolved cards). */
  recap?: RunRecap;
}

export interface RunRecap {
  roster: Roster;
  chemistryTier: string;
  chemistryPercent: number;
  championName: string | null;
  goalsConceded: number;
}
