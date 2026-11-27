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

import { lineupById } from "@/data";
import { isLegendRef, LEGEND_REF_PREFIX } from "@/engine/career/endless";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { isLocalRef, localTeamName } from "@/engine/career/localScene";
import type { CareerIdentity, CareerSave } from "@/engine/career/types";
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

/** What the player's own org wears: the crest it was founded with, or the real org's logo (rc.6, UI-A). */
export type UserOrgIdentity = Pick<CareerIdentity, "crestId" | "colors" | "abbrev"> & { realOrgRef?: string };

/**
 * rc.6 (UI-A, the logo bug): the ONE place that decides the player's own mark.
 * An established org (`realOrgRef`, a takeover or an accepted job) wears its
 * real logo; a founded club its crest. `identity.crestId` on a takeover is a
 * procedural crest kept for old readers, so nothing may draw it directly
 * (`userOrgMark.test.ts` lists the call sites).
 */
export function userMarkOf(identity: UserOrgIdentity): { kind: "logo"; orgId: string } | { kind: "crest" } {
  return identity.realOrgRef ? { kind: "logo", orgId: identity.realOrgRef } : { kind: "crest" };
}

export function UserOrgMark({
  identity,
  seasonIndex,
  size = "sm",
  className,
  loading,
}: {
  identity: UserOrgIdentity;
  /** The career season (the era of the logo); omitted = the org's current logo. */
  seasonIndex?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const mark = userMarkOf(identity);
  if (mark.kind === "logo") {
    return (
      <TeamLogo
        orgId={mark.orgId}
        loading={loading}
        seasonId={seasonIndex === undefined ? undefined : seasonIdFor(Math.min(seasonIndex, 5))}
        size={size}
        className={className}
      />
    );
  }
  return <UserCrest crestId={identity.crestId} colors={identity.colors} abbrev={identity.abbrev} size={size} className={className} />;
}

export function OrgMark({
  save,
  orgRef,
  size = "sm",
  className,
  loading,
}: {
  save: CareerSave;
  orgRef: string;
  size?: OrgMarkSize;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  // v2.2 board front: a manager who took over a real org wears its real logo (UserOrgMark decides).
  if (orgRef === "user") {
    return <UserOrgMark identity={save.identity} seasonIndex={save.clock.seasonIndex} size={SIZE_TO_CREST[size]} className={className} loading={loading} />;
  }
  if (orgRef.startsWith("fill:") || isLocalRef(orgRef)) {
    const org = save.world.orgs[orgRef];
    // v2.0 (R23): local amateur sides get a procedural crest from their name.
    const crest = proceduralCrestFor(
      orgRef,
      org?.name ?? (isLocalRef(orgRef) ? localTeamName(orgRef, save.careerSeed, save.world.nameBankVersion) : undefined),
    );
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
  // v2.2 ENDLESS: a Legends side wears its org's crest of that era.
  const legend = isLegendRef(orgRef) ? lineupById.get(orgRef.slice(LEGEND_REF_PREFIX.length)) : undefined;
  if (legend) return <TeamLogo orgId={legend.orgId} loading={loading} seasonId={legend.seasonId} size={size} className={className} />;
  return (
    <TeamLogo
      orgId={orgRef}
      loading={loading}
      seasonId={seasonIdFor(Math.min(save.clock.seasonIndex, 5))}
      size={size}
      className={className}
    />
  );
}
