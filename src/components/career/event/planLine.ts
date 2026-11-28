/**
 * rc9 MATCHDAY (R243): the one line after a managed series that says what the
 * plan did. Built only from the engine's log of the series (planReport): the
 * style matchup it computed per game, the opponent's switch, the timeout's
 * cut. No fact here is invented.
 */

import type { PlanReport } from "@/engine/career/matchdaySeries";
import type { CareerCopy } from "@/content/careerCopy";

type Desk = CareerCopy["seriesDesk"];

function list(D: Desk, games: number[]): string {
  if (games.length === 1) return String(games[0]);
  return `${games.slice(0, -1).join(", ")} ${D.and} ${games[games.length - 1]}`;
}

export function planLine(D: Desk, r: PlanReport | null): string | null {
  if (!r) return null;
  const parts: string[] = [];
  if (r.style && r.oppStyle) {
    const mine = D.styles[r.style];
    const theirs = D.styles[r.oppStyle];
    if (r.edgeGames.length > 0) {
      const games = D.games(list(D, r.edgeGames));
      if (r.oppSwitchedAt !== null && r.oppSwitchedTo) parts.push(D.lineSwitch(mine, theirs, games, D.styles[r.oppSwitchedTo]));
      else if (r.edgeGames.length === r.games) parts.push(D.lineEdgeAll(mine, theirs, r.edgeWins, r.games));
      else parts.push(D.lineEdge(mine, theirs, games, r.edgeWins));
    } else if (r.againstGames.length > 0) {
      parts.push(D.lineAgainst(theirs, mine, D.games(list(D, r.againstGames))));
    } else {
      parts.push(D.lineNeutral);
    }
  }
  if (r.timeout) parts.push(r.timeout.cut > 0 ? D.lineTimeout(r.timeout.game) : D.lineTimeoutEmpty(r.timeout.game));
  return parts.length > 0 ? parts.join(" ") : null;
}
