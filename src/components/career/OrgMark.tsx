"use client";

/**
 * Road to Worlds — the ONE org-logo dispatcher (v0.2).
 *
 * "user"   → the player's UserCrest.
 * "fill:*" → a deterministic PROCEDURAL crest (every generic org has a logo —
 *            shape/symbol/colors hashed from the org ref, stable forever).
 * real org → TeamLogo (era-aware PNG chain with monogram fallback).
 *
 * Replaces the three copy-pasted monogram fallbacks (hubShared / Standings /
 * TeamLogo) as the single seam for career org marks.
 */

import { TeamLogo } from "@/components/ui/TeamLogo";
import type { CareerSave } from "@/engine/career/types";
import { seasonIdFor } from "@/engine/career/calendar";
import {
  UserCrest,
  CREST_IDS,
  SYMBOL_IDS,
  PATTERN_IDS,
  CREST_PALETTE,
  composeCrestId,
  contrastingSecondaryIndex,
} from "./UserCrest";

export type OrgMarkSize = "xs" | "sm" | "md" | "lg";

const SIZE_TO_CREST: Record<OrgMarkSize, "xs" | "sm" | "md" | "lg"> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
};

/** FNV-1a over the ref — cheap, stable, dependency-free. */
function hashRef(ref: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < ref.length; i++) {
    h ^= ref.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic crest config for a filler org ref (crest v2).
 *
 * Distinct FNV bit windows drive each layer independently — shape, center
 * symbol, an optional pattern (~half the orgs), and two CREST_PALETTE swatches
 * kept legible via contrastingSecondaryIndex — so every "fill:*" org gets a
 * full composite crest ("shape:symbol[:pattern]"), stable forever per ref.
 */
export function proceduralCrestFor(ref: string, name?: string): {
  crestId: string;
  colors: { primary: string; secondary: string };
  abbrev: string;
} {
  const h = hashRef(ref);
  const shape = CREST_IDS[h % CREST_IDS.length];
  const symbol = SYMBOL_IDS[(h >>> 4) % SYMBOL_IDS.length];
  const pattern = (h >>> 9) & 1 ? PATTERN_IDS[(h >>> 11) % PATTERN_IDS.length] : undefined;
  const primaryIdx = (h >>> 14) % CREST_PALETTE.length;
  const secondaryIdx = contrastingSecondaryIndex(primaryIdx, (h >>> 20) % CREST_PALETTE.length);
  const abbrev = (name ?? ref.replace(/^fill:/, ""))
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return {
    crestId: composeCrestId({ shape, symbol, pattern }),
    colors: {
      primary: CREST_PALETTE[primaryIdx].hex,
      secondary: CREST_PALETTE[secondaryIdx].hex,
    },
    abbrev,
  };
}

export function OrgMark({
  save,
  orgRef,
  size = "sm",
  className,
}: {
  save: CareerSave;
  orgRef: string;
  size?: OrgMarkSize;
  className?: string;
}) {
  if (orgRef === "user") {
    return (
      <UserCrest
        crestId={save.identity.crestId}
        colors={save.identity.colors}
        abbrev={save.identity.abbrev}
        size={SIZE_TO_CREST[size]}
        className={className}
      />
    );
  }
  if (orgRef.startsWith("fill:")) {
    const org = save.world.orgs[orgRef];
    const crest = proceduralCrestFor(orgRef, org?.name);
    return (
      <UserCrest
        crestId={crest.crestId}
        colors={crest.colors}
        abbrev={crest.abbrev}
        size={SIZE_TO_CREST[size]}
        className={className}
      />
    );
  }
  return (
    <TeamLogo
      orgId={orgRef}
      seasonId={seasonIdFor(Math.min(save.clock.seasonIndex, 5))}
      size={size}
      className={className}
    />
  );
}
