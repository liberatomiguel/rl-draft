/**
 * rc9 SHARE: the two share prompts (DESIGN-DECISIONS #256 and #257). The rules
 * that read these numbers are pure (`lib/share/sharePrompts.ts`, tested in
 * `sharePrompts.test.ts`); the "seen" record is one plain localStorage key
 * outside the stores, so the frozen persist contract does not move.
 *
 * Both prompts share one budget: at most one of them per session, never while
 * another dialog, a ceremony or a reward pop-up is on screen, and only after
 * the screen has settled for `delayMs`.
 */
export const SHARE_PROMPTS = {
  /** Wait after the results or the season review settle before a prompt opens. */
  delayMs: 1600,

  /** "Send the game to a friend": once per device, ever. */
  invite: {
    /** Distinct days with the game open (`login.total`): never in the first session's day. */
    minActiveDays: 2,
    /** A draft player: completed runs before the prompt may appear. */
    minRuns: 5,
    /** A career player: completed seasons in the career on screen. */
    minCareerSeasons: 1,
    /** The runs that count as "went well" (a podium). */
    goodPlacements: ["champion", "runner_up", "third"] as readonly string[],
  },

  /** "Share this title": the share image offered after a title, sparsely. */
  image: {
    /** Titles won before the first prompt (1 = never the very first title). */
    titlesBeforeFirst: 1,
    /** Titles that must pass after a prompted one: the next win never prompts. */
    titlesBetween: 2,
    /** Days between two prompts. */
    cooldownDays: 7,
    /** Prompts per device, ever; "Don't show again" ends it sooner. */
    maxShows: 5,
    /** Career events whose title may prompt (cups and qualifiers do not). */
    careerTiers: ["regional", "major", "worlds"] as readonly string[],
  },
} as const;
