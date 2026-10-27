/**
 * D01 (v2.0): Chiefs S6 and Tainted Minds S6 had swapped trios. The fix renames
 * six player cards; saves that still hold the OLD ids (run-history replays, a run
 * in progress, cloud rows from older builds) must keep working.
 */
import { describe, expect, it } from "vitest";
import { cardIdAliases, playerCardById } from "@/data";
import { resolvePick } from "./cards";
import { buildUserTeam } from "./teams";
import type { Roster } from "./types";

describe("retired card ids (D01)", () => {
  it("an old run-history roster still resolves, onto the corrected lineups", () => {
    const roster: Roster = {
      player1: { slot: "player1", kind: "player", refId: "torsos-tainted-minds-s6", fromLineupId: "tainted-minds-s6" },
      player2: { slot: "player2", kind: "player", refId: "drippay-tainted-minds-s6", fromLineupId: "tainted-minds-s6" },
      player3: { slot: "player3", kind: "player", refId: "cjcj-chiefs-esports-club-s6", fromLineupId: "chiefs-esports-club-s6" },
    };
    const torsos = resolvePick(roster.player1!);
    expect(torsos.orgId).toBe("chiefs-esports-club"); // the real Chiefs S6 trio
    expect(resolvePick(roster.player3!).orgId).toBe("tainted-minds");
    const team = buildUserTeam(roster, "normal", { mode: "quick" });
    expect(team.rating.total).toBeGreaterThan(0);
  });

  it("every alias points at a live card", () => {
    for (const [oldId, newId] of Object.entries(cardIdAliases)) {
      expect(playerCardById.get(oldId)?.id, oldId).toBe(newId);
    }
  });
});
