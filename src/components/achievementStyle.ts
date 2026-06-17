/**
 * Achievement visual identity (v0.5) — shared by the achievements grid, the
 * results list and the unlock toast so an achievement looks the SAME
 * everywhere it appears.
 *
 * Categories keep their color family (milestone blue · skill orange ·
 * collection gold · legend prismatic), but each achievement picks a stable
 * hue variation inside the family, so the trophy wall reads varied.
 * Legend achievements get the premium treatment (animated prismatic border —
 * see `.ach-legend` in globals.css).
 */

import type { AchievementDef } from "@/engine/types";

export interface AchievementStyle {
  /** Icon chip (earned): background + icon color. */
  chip: string;
  /** Panel border accent (earned). */
  ring: string;
  /** Accent text color (earned titles, toast kicker). */
  text: string;
  /** Soft glow shadow for earned panels/toasts. */
  glow: string;
  /** Category label shown on the card. */
  label: string;
  /** Premium prismatic treatment (legend tier). */
  legend: boolean;
}

interface Variant {
  chip: string;
  ring: string;
  text: string;
  glow: string;
}

const FAMILIES: Record<AchievementDef["category"], { label: string; variants: Variant[] }> = {
  common: {
    label: "Common",
    variants: [
      { chip: "bg-slate-400/15 text-slate-200", ring: "!border-slate-400/40", text: "text-slate-200", glow: "shadow-[0_0_16px_rgba(148,163,184,0.14)]" },
      { chip: "bg-slate-300/15 text-slate-100", ring: "!border-slate-300/35", text: "text-slate-100", glow: "shadow-[0_0_16px_rgba(203,213,225,0.12)]" },
    ],
  },
  rare: {
    label: "Rare",
    variants: [
      { chip: "bg-blue/15 text-blue-bright", ring: "!border-blue/40", text: "text-blue-bright", glow: "shadow-[0_0_18px_rgba(59,130,246,0.18)]" },
      { chip: "bg-cyan/15 text-cyan", ring: "!border-cyan/40", text: "text-cyan", glow: "shadow-[0_0_18px_rgba(56,189,248,0.18)]" },
      { chip: "bg-sky-400/15 text-sky-300", ring: "!border-sky-400/40", text: "text-sky-300", glow: "shadow-[0_0_18px_rgba(56,189,248,0.16)]" },
    ],
  },
  epic: {
    label: "Epic",
    variants: [
      { chip: "bg-violet-500/15 text-violet-300", ring: "!border-violet-500/45", text: "text-violet-300", glow: "shadow-[0_0_18px_rgba(139,92,246,0.2)]" },
      { chip: "bg-fuchsia-500/15 text-fuchsia-300", ring: "!border-fuchsia-500/40", text: "text-fuchsia-300", glow: "shadow-[0_0_18px_rgba(217,70,239,0.18)]" },
      { chip: "bg-purple-400/15 text-purple-300", ring: "!border-purple-400/40", text: "text-purple-300", glow: "shadow-[0_0_18px_rgba(192,132,252,0.18)]" },
    ],
  },
  legend: {
    label: "Legend",
    variants: [
      {
        chip: "bg-gradient-to-br from-fuchsia-500/25 via-orange/20 to-cyan/25 text-fuchsia-200",
        ring: "!border-fuchsia-400/50",
        text: "text-fuchsia-200",
        glow: "shadow-[0_0_22px_rgba(217,70,239,0.2)]",
      },
    ],
  },
};

/** Stable per-id index so an achievement keeps its hue forever. */
function hueIndex(id: string, count: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % count;
}

export function achievementStyle(def: Pick<AchievementDef, "id" | "category">): AchievementStyle {
  const family = FAMILIES[def.category];
  const variant = family.variants[hueIndex(def.id, family.variants.length)];
  return { ...variant, label: family.label, legend: def.category === "legend" };
}
