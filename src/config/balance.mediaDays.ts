/**
 * v2.3 MEDIA (wave 2, HISTORIAS-WAVE2 M1-M6): media days, the tunables. A
 * brand offers cash for a named player to be away a few days; the manager
 * accepts or declines. Re-exported from `balance.ts` with one line. Read only
 * by `engine/career/mediaDays.ts` and `store/mediaDaysFlow.ts`.
 * FEATURES.mediaDays gates all of it.
 *
 * NONE of these numbers is measured in a battery (M5, R208): the cash is sized
 * from the sponsor tiers' own weekly value, the rest is a first guess.
 */

export const CAREER_MEDIA = {
  /**
   * M1: the chance of an offer on a weekly tick (Monday) is
   * min(max, base + perRep x reputation), times the followers' lift when the
   * fan feed is on. At reputation 0 / 50 / 100: 3 % / 10.5 % / 18 % a week,
   * so a season (32 Mondays, with the cooldown) sees about one to five offers.
   */
  chance: { base: 0.03, perRep: 0.0015, max: 0.2 },
  /** M1: with the fan feed on, the chance x (1 + boost x min(1, followers / ref)). The feed starts a club at 400 followers. */
  followers: { ref: 4_000, boost: 0.5 },
  /** No offer before this week of the season (the first two are the club settling in). */
  firstWeek: 3,
  /** After an offer arrives, none for this many weekly ticks. */
  cooldownWeeks: 2,
  /** M1: the player is away this many days (inclusive), seeded. */
  days: { min: 2, max: 4 },
  /** The first away day is this many days after the Monday the offer arrives (Wed..Sun). The deadline is the day before it. */
  startOffset: { min: 2, max: 6 },
  /** How many (player, dates) draws one roll makes before it gives up (M3 may refuse a date). */
  tries: 6,
  /** The size of the brand bank in `copy.career.media.*` (a test keeps the two equal). */
  brands: 15,
  /** M1: a player is picked weighted by overall to this power (the sought-after name). */
  pickPower: 2,
  /** M5: a media day pays about this many weeks of a typical sponsor's income at the club's reputation. */
  cash: {
    weeks: 1,
    /** By days away: a shorter trip pays a little less, a longer one a little more. */
    byDays: { 2: 0.8, 3: 1, 4: 1.2 } as Record<number, number>,
    /** Seeded +/- spread around it. */
    jitter: 0.15,
  },
  /** M4: sending the same player again within `weeks` weeks of his last trip costs him `morale` points (locker room on only). */
  fatigue: { weeks: 6, morale: 6 },
  /** Answered, lapsed and cancelled offers kept in the save for the inbox to read back. */
  keepAnswered: 6,
  /** Trips remembered for the fatigue rule. */
  keepTrips: 12,
} as const;
