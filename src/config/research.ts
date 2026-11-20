/**
 * The player-research invitation (v2.0.31): a one-off link to Miguel's form,
 * shown only to returning players at a natural pause (a draft run's results,
 * a Road to Worlds season review). Logic: `src/lib/researchInvite.ts`.
 *
 * Not gameplay: these numbers live here, not in balance.ts, so a change never
 * moves BALANCE_VERSION (balanceVersion.test.ts fingerprints balance.ts).
 *
 * To run a new survey later, change `campaign` (and the URL): every device is
 * asked again once, because the stored answer is per campaign.
 */
export const RESEARCH_INVITE = {
  /** Master switch: false hides the invitation everywhere. */
  enabled: true,
  formUrl: "https://forms.gle/FhGfpxcYSMfbrWMGA",
  /** Id of this survey round: the stored answer and the analytics carry it. */
  campaign: "survey-2026-11",
  /**
   * Distinct UTC days the game was opened on this profile (`login.total`).
   * From this day on (the second day, Miguel 18/11) the regular bar applies.
   */
  minActiveDays: 2,
  /** A draft player: completed runs (any mode). */
  minRuns: 10,
  /** A career player: completed seasons in the career on screen. */
  minCareerSeasons: 1,
  /** On the FIRST day only a heavy session qualifies (the second day is preferred). */
  firstDayRuns: 25,
  firstDayCareerSeasons: 2,
  /** Times the card may open without an answer (a tab closed mid-card) before it stops asking. */
  maxShows: 2,
  /** Wait after the screen settles (ceremonies, pop-ups, the XP count-up) before the card opens. */
  delayMs: 2500,
} as const;
