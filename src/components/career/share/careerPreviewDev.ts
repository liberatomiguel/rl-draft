/**
 * rc9 SHARE: the dev server's career share-image bench (never in a
 * production build: `SharePreviewDev` loads it behind
 * `NODE_ENV === "development"`). A stand-in save (a founded SAM club in its
 * third season) through the real `buildCareerShare`, so the bench draws what a
 * player would get.
 */

import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { resolveShareFonts, svgElementToImage } from "@/lib/share/canvasKit";
import { renderCareerImage } from "@/lib/share/careerImage";
import type { RenderReport, ShareFormat } from "@/lib/share/runImage";
import { buildCareerShare } from "./careerShare";

export const BENCH_IDENTITY = {
  orgName: "Ipanema Rockets",
  abbrev: "IPR",
  managerName: "Rafa Monteiro",
  country: "br",
  region: "SAM",
  crestId: "shield",
  colors: { primary: "#f97316", secondary: "#0b1d3a", tertiary: "#ffffff" },
  buffType: "offense",
} as const;

function benchSave(variant: "title" | "season"): CareerSave {
  const title = variant === "title";
  const squad = [
    { id: "p1", name: "Caio Ferraz", overall: 88.4, country: "br", archetype: "mechanical" },
    { id: "p2", name: "Nico Vidal", overall: 84.2, country: "ar", archetype: "playmaker" },
    { id: "p3", name: "Tomás Reis", overall: 81.7, country: "br", archetype: "anchor" },
  ];
  return {
    identity: BENCH_IDENTITY,
    starterIds: squad.map((p) => p.id),
    squad,
    coach: null,
    clock: { seasonIndex: 2, day: 180 },
    phase: "seasonReview",
    history: [{}, {}, {}],
    stats: {
      titlesWorlds: 0,
      titlesMajor: title ? 1 : 0,
      titlesRegional: title ? 2 : 0,
      titlesT2: 0,
      titlesT3: title ? 1 : 0,
      seriesWins: title ? 41 : 27,
      seriesLosses: title ? 15 : 22,
      totalPrize: 412000,
    },
    careerSeed: 7,
  } as unknown as CareerSave;
}

export async function renderCareerBench(
  variant: "title" | "season",
  format: ShareFormat,
  locale: "en" | "pt",
  bannerUrl: string | null,
  crestSvg: SVGSVGElement | null,
): Promise<{ url: string; report: RenderReport }> {
  const C = (locale === "pt" ? CAREER_PT : CAREER_EN) as unknown as CareerCopy;
  const bundle = buildCareerShare(benchSave(variant), C, variant === "title" ? "major" : null, bannerUrl);
  const report: RenderReport = { banner: null };
  const [fonts, crest] = await Promise.all([resolveShareFonts(), svgElementToImage(crestSvg, 512)]);
  const canvas = await renderCareerImage(bundle.image, crest, format, fonts, report);
  return { url: canvas.toDataURL("image/png"), report };
}
