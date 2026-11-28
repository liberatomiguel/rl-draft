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
import { resolvePlayerCard, resolveSpecial } from "@/engine/cards";
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
  const cards = [resolveSpecial(sp), resolvePlayerCard("zen-team-vitality-2223"), resolvePlayerCard("kaydop-dignitas-s5")];
  const title = variant === "title";
  return {
    placementLabel: title ? C.RESULTS_UI.champion : C.RESULTS_UI.runnerUp,
    champion: title,
    meta: [locale === "pt" ? "Draft Clássico" : "Classic draft", "Hard"].join("  ·  "),
    headline: title ? S.headlineChampion("3-1") : S.headlineOut("Team Vitality", locale === "pt" ? "Grande Final" : "Grand Final", "2-4"),
    teamFigure: { value: "91", label: S.figTeamOvr },
    cards: cards.map((c) => shareFaceOf(c, C.DRAFT_UI.player)),
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
