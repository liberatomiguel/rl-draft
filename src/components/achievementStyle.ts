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
  milestone: {
    label: "Milestone",
    variants: [
      { chip: "bg-blue/15 text-blue-bright", ring: "!border-blue/40", text: "text-blue-bright", glow: "shadow-[0_0_18px_rgba(59,130,246,0.16)]" },
      { chip: "bg-cyan/15 text-cyan", ring: "!border-cyan/40", text: "text-cyan", glow: "shadow-[0_0_18px_rgba(56,189,248,0.16)]" },
      { chip: "bg-indigo-400/15 text-indigo-300", ring: "!border-indigo-400/40", text: "text-indigo-300", glow: "shadow-[0_0_18px_rgba(129,140,248,0.16)]" },
      { chip: "bg-teal-400/15 text-teal-300", ring: "!border-teal-400/40", text: "text-teal-300", glow: "shadow-[0_0_18px_rgba(45,212,191,0.16)]" },
    ],
  },
  skill: {
    label: "Skill",
    variants: [
      { chip: "bg-orange/15 text-orange-bright", ring: "!border-orange/40", text: "text-orange-bright", glow: "shadow-[0_0_18px_rgba(249,115,22,0.18)]" },
      { chip: "bg-rose-500/15 text-rose-300", ring: "!border-rose-500/40", text: "text-rose-300", glow: "shadow-[0_0_18px_rgba(244,63,94,0.16)]" },
      { chip: "bg-amber-400/15 text-amber-300", ring: "!border-amber-400/40", text: "text-amber-300", glow: "shadow-[0_0_18px_rgba(251,191,36,0.16)]" },
      { chip: "bg-red-400/15 text-red-300", ring: "!border-red-400/40", text: "text-red-300", glow: "shadow-[0_0_18px_rgba(248,113,113,0.16)]" },
    ],
  },
  collection: {
    label: "Collection",
    variants: [
      { chip: "bg-amber-400/15 text-amber-300", ring: "!border-amber-400/40", text: "text-amber-300", glow: "shadow-[0_0_18px_rgba(251,191,36,0.18)]" },
      { chip: "bg-yellow-400/15 text-yellow-200", ring: "!border-yellow-400/40", text: "text-yellow-200", glow: "shadow-[0_0_18px_rgba(250,204,21,0.16)]" },
      { chip: "bg-lime-400/15 text-lime-300", ring: "!border-lime-400/40", text: "text-lime-300", glow: "shadow-[0_0_18px_rgba(163,230,53,0.14)]" },
      { chip: "bg-emerald-400/15 text-emerald-300", ring: "!border-emerald-400/40", text: "text-emerald-300", glow: "shadow-[0_0_18px_rgba(52,211,153,0.14)]" },
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
