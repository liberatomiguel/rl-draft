/**
 * Which routes are the game itself (v2.0.22). The daily-login calendar and the
 * cosmetic-unlock ceremony open only there: a reader who lands on a content
 * page from a search (the articles, the career landing, the RLCS database,
 * /how-to-play) is not met by a pop-up. The pending pop-up stays in its store
 * and opens on the first game route the player visits in the session.
 */
const GAME_ROUTES = [
  "/play",
  "/career",
  "/challenges",
  "/collection",
  "/profile",
  "/leaderboards",
  "/missions",
  "/achievements",
  "/quiz",
  "/settings",
] as const;

export function isGameRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  // The home menu is the game's front door; /pt is its Portuguese landing page.
  if (path === "/") return true;
  return GAME_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}
