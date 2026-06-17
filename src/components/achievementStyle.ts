/**
 * Achievement visual identity (v0.5) — shared by the achievements grid, the
 * results list and the unlock toast so an achievement looks the SAME
 * everywhere it appears.
 *
 * Each tier (common · rare · epic) carries a SPREAD of distinct hues so the
 * trophy wall reads varied rather than monochrome-per-tier; vividness still
 * rises with rarity (common cool/muted → epic jewel-bright) so the tier is
 * legible at a glance, and each achievement keeps a stable hue forever
 * (hueIndex). Legend stays STANDARDIZED — one premium prismatic look for every
 * legend (animated border, see `.ach-legend` in globals.css) — v1.2.1.
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
  // Common — cool, lower-chroma hues. Varied, but clearly the humble tier.
  common: {
    label: "Common",
    variants: [
      { chip: "bg-slate-400/15 text-slate-200", ring: "!border-slate-400/40", text: "text-slate-200", glow: "shadow-[0_0_15px_rgba(148,163,184,0.14)]" },
      { chip: "bg-sky-400/12 text-sky-200", ring: "!border-sky-400/35", text: "text-sky-200", glow: "shadow-[0_0_15px_rgba(56,189,248,0.12)]" },
      { chip: "bg-emerald-400/12 text-emerald-200", ring: "!border-emerald-400/35", text: "text-emerald-200", glow: "shadow-[0_0_15px_rgba(52,211,153,0.12)]" },
      { chip: "bg-indigo-400/12 text-indigo-200", ring: "!border-indigo-400/35", text: "text-indigo-200", glow: "shadow-[0_0_15px_rgba(129,140,248,0.12)]" },
    ],
  },
  // Rare — saturated cool brights across the spectrum.
  rare: {
    label: "Rare",
    variants: [
      { chip: "bg-blue/15 text-blue-bright", ring: "!border-blue/45", text: "text-blue-bright", glow: "shadow-[0_0_18px_rgba(59,130,246,0.2)]" },
      { chip: "bg-cyan/15 text-cyan", ring: "!border-cyan/45", text: "text-cyan", glow: "shadow-[0_0_18px_rgba(56,189,248,0.2)]" },
      { chip: "bg-teal-400/15 text-teal-300", ring: "!border-teal-400/45", text: "text-teal-300", glow: "shadow-[0_0_18px_rgba(45,212,191,0.18)]" },
      { chip: "bg-emerald-500/15 text-emerald-300", ring: "!border-emerald-500/45", text: "text-emerald-300", glow: "shadow-[0_0_18px_rgba(16,185,129,0.18)]" },
      { chip: "bg-indigo-500/15 text-indigo-300", ring: "!border-indigo-500/45", text: "text-indigo-300", glow: "shadow-[0_0_18px_rgba(99,102,241,0.18)]" },
      { chip: "bg-sky-400/15 text-sky-300", ring: "!border-sky-400/45", text: "text-sky-300", glow: "shadow-[0_0_18px_rgba(56,189,248,0.18)]" },
    ],
  },
  // Epic — vivid jewel tones, the loudest glows below Legend.
  epic: {
    label: "Epic",
    variants: [
      { chip: "bg-violet-500/18 text-violet-300", ring: "!border-violet-500/50", text: "text-violet-300", glow: "shadow-[0_0_20px_rgba(139,92,246,0.24)]" },
      { chip: "bg-fuchsia-500/18 text-fuchsia-300", ring: "!border-fuchsia-500/50", text: "text-fuchsia-300", glow: "shadow-[0_0_20px_rgba(217,70,239,0.22)]" },
      { chip: "bg-purple-500/18 text-purple-300", ring: "!border-purple-500/50", text: "text-purple-300", glow: "shadow-[0_0_20px_rgba(168,85,247,0.22)]" },
      { chip: "bg-rose-500/18 text-rose-300", ring: "!border-rose-500/50", text: "text-rose-300", glow: "shadow-[0_0_20px_rgba(244,63,94,0.22)]" },
      { chip: "bg-amber-500/18 text-amber-300", ring: "!border-amber-500/50", text: "text-amber-300", glow: "shadow-[0_0_20px_rgba(245,158,11,0.22)]" },
      { chip: "bg-pink-500/18 text-pink-300", ring: "!border-pink-500/50", text: "text-pink-300", glow: "shadow-[0_0_20px_rgba(236,72,153,0.22)]" },
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
