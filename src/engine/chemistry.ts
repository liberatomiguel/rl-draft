/**
 * Chemistry system (base doc §22; reworked to ADDITIVE in v1.4).
 *
 * Per player pair, raw = CONNECTION + HERITAGE — two INDEPENDENT axes, summed, so
 * EVERY factor the player built around counts (not just the single strongest link):
 *   CONNECTION (strongest form): same lineup (4) > ex-teammates (3) > shared org (2.5)
 *   HERITAGE  (strongest form): same country (2.5) > same region (1.5)
 * Within an axis only the strongest form counts (the alternatives are the SAME
 * relationship — ex-teammates already implies a shared org — so stacking them would
 * double-count it). Across the axes they ADD: a same-country pair who also shared an
 * org scores country + org. A pure country stack still never reaches Perfect (real
 * connection completes the bar). Pairs of the same kind+key MERGE into one readout
 * line (a 3-player Brazil core is one "Same country" entry). Perfect = a FULL bar
 * (raw ≥ maxRaw). Raw → percent of maxRaw → tier; the rating impact is difficulty-
 * scaled in rating.ts. AI lineups are real trios (~19+ raw) → capped 100%, so the
 * field is not inflated.
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
  /** Every lineup this player was EVER on (career) — for "shared past" links. */
  careerLineupIds?: string[];
  /** Every org this player was EVER part of (career). */
  careerOrgIds?: string[];
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

/** First id present in both lists (career overlap), or undefined. */
function firstShared(a?: string[], b?: string[]): string | undefined {
  if (!a || !b || a.length === 0 || b.length === 0) return undefined;
  const set = new Set(a);
  return b.find((id) => set.has(id));
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
      // ADDITIVE (v1.4): a pair scores CONNECTION + HERITAGE — two independent axes.
      // Within each axis only the strongest form counts (the alternatives describe the
      // SAME relationship, so stacking them would double-count it); across axes they sum,
      // so a same-country pair who also shared an org now gets BOTH.

      // CONNECTION axis: same drafted lineup > ex-teammates (shared career lineup) >
      // share an org (current cards same org, or a shared career org).
      const sharedCareerLineup = firstShared(a.careerLineupIds, b.careerLineupIds);
      const sharedOrg =
        a.orgId === b.orgId ? a.orgId : firstShared(a.careerOrgIds, b.careerOrgIds);
      if (a.lineupId === b.lineupId) {
        addPair(a, b, "lineup", a.lineupId, "Same lineup", "", w.connLineup);
      } else if (sharedCareerLineup) {
        addPair(a, b, "career-lineup", sharedCareerLineup, "Ex-teammates", "", w.connTeammates);
      } else if (sharedOrg) {
        addPair(a, b, "org", sharedOrg, "Shared org", "", w.connOrg);
      }

      // HERITAGE axis: same country > same region. ADDS on top of any connection.
      if (a.country && b.country && a.country === b.country) {
        addPair(a, b, "country", a.country, "Same country", ` (${a.country})`, w.herCountry);
      } else if (a.region && b.region && a.region === b.region) {
        addPair(a, b, "region", a.region, "Same region", ` (${a.region})`, w.herRegion);
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
    // Nationality is a SOFT bonus (below a full org/lineup link), so a same-country
    // coach+sub can't complete a country stack into Perfect on their own.
    if (staff.country && input.players.some((p) => p.country === staff.country)) {
      points += w.staffCountryBonus;
      reasons.push("same country");
    } else if (staff.region && input.players.some((p) => p.region === staff.region)) {
      points += w.staffCountryBonus * w.staffRegionFactor;
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
