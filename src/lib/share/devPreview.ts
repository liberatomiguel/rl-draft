/**
 * rc9 SHARE: the dev server's share-image bench (never in a production build:
 * `SharePreviewDev` loads it behind `NODE_ENV === "development"`). It draws
 * the run image from real dataset cards so every variant (title, placement,
 * Post, Story, with and without a banner, EN and PT) can be rendered and
 * saved from the running app.
 */

import { cosmeticById } from "@/data/cosmetics";
import { specialCards } from "@/data";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import { resolveCoach, resolveOrg, resolvePlayerCard, resolveSpecial, resolveSub } from "@/engine/cards";
import { bannerArtSrc, hasSpecialPhoto } from "@/lib/assets";
import { resolveShareFonts } from "./canvasKit";
import { renderRunImage, type RenderReport, type RunImageData, type ShareFormat } from "./runImage";
import { shareFaceOf } from "./runShare";

export type BenchLocale = "en" | "pt";

/** A catalog banner's art URL by cosmetic id (null when the id is not a banner). */
export function benchBannerUrl(id: string | null): string | null {
  if (!id) return null;
  const def = cosmeticById.get(id);
  return def && def.kind === "banner" ? bannerArtSrc(def.style.art, 1200) : null;
}

export function benchBanners(): string[] {
  return [...cosmeticById.values()].filter((d) => d.kind === "banner").map((d) => d.id);
}

function runData(variant: "title" | "placement", locale: BenchLocale, bannerId: string | null): RunImageData {
  const C = locale === "pt" ? PT : EN;
  const S = C.SHARE_UI;
  const sp = specialCards.find((s) => hasSpecialPhoto(s.id) && s.rarity === "legendary") ?? specialCards[0];
  const D = C.DRAFT_UI;
  const cards = [
    shareFaceOf(resolveSpecial(sp), D.player),
    shareFaceOf(resolvePlayerCard("zen-team-vitality-2223"), D.player),
    shareFaceOf(resolvePlayerCard("kaydop-dignitas-s5"), D.player),
    shareFaceOf(resolveCoach("gregan-coach-team-vitality-s7"), D.slotCoach),
    shareFaceOf(resolveSub("reepex-sub-dignitas-s5"), D.slotSub),
    shareFaceOf(resolveOrg("team-vitality"), D.slotOrg),
  ];
  const title = variant === "title";
  return {
    placementLabel: title ? S.championTitle : C.RESULTS_UI.runnerUp,
    champion: title,
    meta: [locale === "pt" ? "Draft Clássico" : "Classic draft", locale === "pt" ? "Difícil" : "Hard"].join("  ·  "),
    headline: title ? S.headlineChampion("3-1") : S.headlineOut("Team Vitality", locale === "pt" ? "Grande Final" : "Grand Final", "2-4"),
    road: [
      { label: S.roadSwiss, series: [true, false, true, true] },
      { label: S.roadPlayoffs, series: title ? [true, true, true] : [true, true, false] },
    ],
    figures: [
      { value: "91", label: S.figTeamOvr },
      { value: C.CHEM_TIERS.Great, label: S.figChemistry },
      { value: "3-1", label: S.figSwiss },
    ],
    cards,
    bannerUrl: benchBannerUrl(bannerId),
    site: "rocketdraft.app",
  };
}

export async function renderRunBench(
  variant: "title" | "placement",
  format: ShareFormat,
  locale: BenchLocale,
  bannerId: string | null,
): Promise<{ url: string; report: RenderReport }> {
  const report: RenderReport = { banner: null };
  const canvas = await renderRunImage(runData(variant, locale, bannerId), format, await resolveShareFonts(), report);
  return { url: canvas.toDataURL("image/png"), report };
}
