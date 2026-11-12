/**
 * Road to Worlds — which screens have a guided-tour chapter (pure, no React).
 *
 * rc.54 (Miguel, "the tutorial is overdone"): only the HQ (the mode's
 * introduction), Squad, Training and Finances keep one. Calendar, Market,
 * Standings, Inbox and Club have NO tour: no chapter opens there and the help
 * button is not shown.
 */

export type CareerTourChapter = "hub" | "squad" | "training" | "finances";

/** Every chapter, in tab order. */
export const CAREER_TOUR_CHAPTERS: readonly CareerTourChapter[] = ["hub", "squad", "training", "finances"];

const CHAPTER_OF_ROUTE = new Map<string, CareerTourChapter>([
  ["/career", "hub"],
  ["/career/squad", "squad"],
  ["/career/training", "training"],
  ["/career/finances", "finances"],
]);

/** The route as the map keys it (no trailing slash). */
export const careerTourRoute = (pathname: string | null | undefined): string =>
  (pathname ?? "").replace(/\/$/, "") || "/";

/** The chapter of a career screen, or null when the screen has no tour. */
export function careerTourChapter(pathname: string | null | undefined): CareerTourChapter | null {
  return CHAPTER_OF_ROUTE.get(careerTourRoute(pathname)) ?? null;
}
