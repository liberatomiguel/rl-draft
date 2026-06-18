/**
 * Chemistry system (base doc §22, reworked v1.3.1).
 *
 * Per player pair only the STRONGEST link counts, in weight order:
 *   same lineup (4) > shared org (3) > same country (2) > same region (1).
 * Org now outranks country, because **Perfect chemistry requires real org/lineup
 * overlap** — a pure country (or country+staff) stack tops out at Good, never
 * Perfect (Miguel's rule). Pairs of the same kind are MERGED into one readout
 * line (a 3-player Brazil core is one "Same country" entry, not three +2s).
 * Perfect is only reached when the bar is FULL (raw ≥ maxRaw). Raw → percent of
 * maxRaw → tier; the rating impact of the percent is difficulty-scaled in rating.ts.
 */

import { CHEMISTRY } from "@/config/balance";
import type { ChemistryBreakdownItem, ChemistryResult } from "./types";

export interface ChemPlayerInput {
  name: string;
  lineupId: string;
  orgId: string;
  /** Same-country chemistry only applies when both players have one. */
  country?: string;
  /** Same-region is the weakest pairwise link (the floor for mixed rosters). */
  region?: string;
}

export interface ChemStaffInput {
  name: string;
  lineupId: string;
  orgId: string;
  /** Staff connect by nationality too (v1.3): same country, or region at half. */
  country?: string;
  region?: string;
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

  // --- Player pairs, merged into one readout line per kind+key ---
  // Each pair contributes its strongest link; pairs that share the same kind and
  // key (e.g. all three players from Brazil) collapse to a single grouped entry.
  interface Group {
    kind: string;
    label: string;
    suffix: string;
    names: Set<string>;
    points: number;
  }
  const groups = new Map<string, Group>();
  const addPair = (
    a: ChemPlayerInput,
    b: ChemPlayerInput,
    kind: string,
    key: string,
    label: string,
    suffix: string,
    points: number,
  ) => {
    const gk = `${kind}|${key}`;
    let g = groups.get(gk);
    if (!g) {
      g = { kind, label, suffix, names: new Set(), points: 0 };
      groups.set(gk, g);
    }
    g.names.add(a.name);
    g.names.add(b.name);
    g.points += points;
    raw += points;
  };

  for (let i = 0; i < input.players.length; i++) {
    for (let j = i + 1; j < input.players.length; j++) {
      const a = input.players[i];
      const b = input.players[j];
      // Weight order: lineup > org > country > region (org now outranks country).
      if (a.lineupId === b.lineupId) {
        addPair(a, b, "lineup", a.lineupId, "Same lineup", "", w.sameLineupPair);
      } else if (a.orgId === b.orgId) {
        addPair(a, b, "org", a.orgId, "Shared org", "", w.sameOrgPair);
      } else if (a.country && b.country && a.country === b.country) {
        addPair(a, b, "country", a.country, "Same country", ` (${a.country})`, w.sameCountryPair);
      } else if (a.region && b.region && a.region === b.region) {
        addPair(a, b, "region", a.region, "Same region", ` (${a.region})`, w.sameRegionPair);
      }
    }
  }
  for (const g of groups.values()) {
    items.push({
      label: `${g.label}${g.suffix} — ${[...g.names].join(" · ")}`,
      points: g.points,
    });
  }

  // Players whose drafted card org IS the drafted org — "org loyalty" (one line).
  if (input.orgId) {
    const loyal = input.players.filter((p) => p.orgId === input.orgId);
    if (loyal.length > 0) {
      const points = loyal.length * w.orgLinkPerPlayer;
      raw += points;
      items.push({
        label: `Org loyalty${input.orgName ? ` (${input.orgName})` : ""} — ${loyal
          .map((p) => p.name)
          .join(" · ")}`,
        points,
      });
    }
  }

  // Coach / sub: a clear, named reason (not a vague "connection"). Multiple ways
  // to connect stack up to the role cap; the label states the primary reason.
  const staffLink = (staff: ChemStaffInput, linkW: number, capW: number, role: string) => {
    let points = 0;
    const reasons: string[] = [];
    if (input.players.some((p) => p.lineupId === staff.lineupId)) {
      points += linkW;
      reasons.push("coached this lineup");
    }
    if (
      input.players.some((p) => p.orgId === staff.orgId) ||
      (input.orgId && input.orgId === staff.orgId)
    ) {
      points += linkW;
      reasons.push("same org");
    }
    if (staff.country && input.players.some((p) => p.country === staff.country)) {
      points += linkW;
      reasons.push("same country");
    } else if (staff.region && input.players.some((p) => p.region === staff.region)) {
      points += linkW * w.staffRegionFactor;
      reasons.push("same region");
    }
    points = Math.min(points, capW);
    if (points > 0) {
      raw += points;
      items.push({ label: `${staff.name} (${role}) — ${reasons[0]}`, points });
    }
  };
  if (input.coach) staffLink(input.coach, w.coachLink, w.coachLinkMax, "coach");
  if (input.sub) staffLink(input.sub, w.subLink, w.subLinkMax, "sub");

  const percent = Math.min(100, Math.round((raw / CHEMISTRY.maxRaw) * 100));
  const tier = CHEMISTRY.tiers.find((t) => percent >= t.min)?.tier ?? "Poor";

  return { raw, max: CHEMISTRY.maxRaw, percent, tier, items };
}
