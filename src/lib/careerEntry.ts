/**
 * The one-tap way into Road to Worlds from the search pages (v2.0.33, R136).
 *
 * The career landing page's second hero button ("Start with a random club")
 * links to `/career?start=quick`; its main button founds a club step by step.
 * A player who already has a career lands on it as before; a newcomer is sent
 * to the founding wizard with the flag kept, and the wizard runs its own Quick
 * start: a random club, straight to the last step, where the player picks the
 * difficulty and founds it. Search visitors used to meet a five-step form that
 * opens with three text fields (18/11: 42 % of those who reached it left).
 *
 * No imports on purpose: the content pages (shared path) read the href.
 */
export const CAREER_QUICK_START_HREF = "/career?start=quick";

/** Does this query string (`location.search`) ask for the Quick start? */
export function wantsQuickStart(search: string): boolean {
  return new URLSearchParams(search).get("start") === "quick";
}

/** Where a player with no career goes: the wizard, keeping the Quick start. */
export function newCareerHref(search: string): string {
  return wantsQuickStart(search) ? "/career/new?start=quick" : "/career/new";
}
