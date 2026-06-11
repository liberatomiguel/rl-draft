/**
 * Chemistry system (base doc §22).
 *
 * Sources: same lineup +++, same country ++, same org +, coach link +, sub link +.
 * Per player pair only the strongest link counts (same lineup implies same org).
 * Raw points → percent of max → tier. The rating impact of the percent is
 * difficulty-scaled in rating.ts.
 */

import { CHEMISTRY } from "@/config/balance";
import type { ChemistryBreakdownItem, ChemistryResult } from "./types";

export interface ChemPlayerInput {
  name: string;
  lineupId: string;
  orgId: string;
  country: string;
}

export interface ChemStaffInput {
  name: string;
  lineupId: string;
  orgId: string;
}

export interface ChemistryInput {
  players: ChemPlayerInput[];
  coach?: ChemStaffInput;
  sub?: ChemStaffInput;
  /** Drafted organization. */
  orgId?: string;
  orgName?: string;
}

export function computeChemistry(input: ChemistryInput): ChemistryResult {
  const w = CHEMISTRY.weights;
  const items: ChemistryBreakdownItem[] = [];
  let raw = 0;

  // Player pairs — strongest link only.
  for (let i = 0; i < input.players.length; i++) {
    for (let j = i + 1; j < input.players.length; j++) {
      const a = input.players[i];
      const b = input.players[j];
      if (a.lineupId === b.lineupId) {
        raw += w.sameLineupPair;
        items.push({ label: `${a.name} + ${b.name} — same lineup`, points: w.sameLineupPair });
      } else if (a.country === b.country) {
        raw += w.sameCountryPair;
        items.push({ label: `${a.name} + ${b.name} — same country`, points: w.sameCountryPair });
      } else if (a.orgId === b.orgId) {
        raw += w.sameOrgPair;
        items.push({ label: `${a.name} + ${b.name} — same org`, points: w.sameOrgPair });
      }
    }
  }

  // Players connected to the drafted org.
  if (input.orgId) {
    for (const p of input.players) {
      if (p.orgId === input.orgId) {
        raw += w.orgLinkPerPlayer;
        items.push({
          label: `${p.name} + ${input.orgName ?? "org"} — org history`,
          points: w.orgLinkPerPlayer,
        });
      }
    }
  }

  // Coach links (capped).
  if (input.coach) {
    let coachPoints = 0;
    if (input.players.some((p) => p.lineupId === input.coach!.lineupId)) {
      coachPoints += w.coachLink;
    }
    if (
      input.players.some((p) => p.orgId === input.coach!.orgId) ||
      (input.orgId && input.orgId === input.coach.orgId)
    ) {
      coachPoints += w.coachLink;
    }
    coachPoints = Math.min(coachPoints, w.coachLinkMax);
    if (coachPoints > 0) {
      raw += coachPoints;
      items.push({ label: `${input.coach.name} — coach connection`, points: coachPoints });
    }
  }

  // Sub links (capped).
  if (input.sub) {
    let subPoints = 0;
    if (input.players.some((p) => p.lineupId === input.sub!.lineupId)) {
      subPoints += w.subLink;
    }
    if (
      input.players.some((p) => p.orgId === input.sub!.orgId) ||
      (input.orgId && input.orgId === input.sub.orgId)
    ) {
      subPoints += w.subLink;
    }
    subPoints = Math.min(subPoints, w.subLinkMax);
    if (subPoints > 0) {
      raw += subPoints;
      items.push({ label: `${input.sub.name} — substitute connection`, points: subPoints });
    }
  }

  const percent = Math.min(100, Math.round((raw / CHEMISTRY.maxRaw) * 100));
  const tier =
    CHEMISTRY.tiers.find((t) => percent >= t.min)?.tier ?? "Poor";

  return { raw, max: CHEMISTRY.maxRaw, percent, tier, items };
}
