/**
 * Share kit: the image of a finished draft run, in two formats, the post
 * (1200 × 630: X, Discord, WhatsApp, Reddit) and the story (1080 × 1920:
 * Instagram, TikTok and WhatsApp status).
 *
 * rc9 (#258): one thing first. The placement is the headline, in Bold paper
 * white; one sentence says how it went; the team is the second thing (the
 * three drafted players as a hand of the game's cards, and the team rating as
 * one figure). The meta line, the wordmark and the link are small. Orange
 * appears once, in the wordmark. The player's equipped banner, when there is
 * one, is a quiet band behind the top (#259).
 */

import {
  FAINT,
  INK,
  SUB,
  drawBannerBand,
  drawCardHand,
  drawFigure,
  drawFloor,
  drawHeadline,
  drawImageFrame,
  drawLabel,
  drawSentence,
  drawWordmark,
  loadImage,
  loadImages,
  makeCanvas,
  textFont,
  type Rect,
  type ShareCardFace,
  type ShareFonts,
} from "./canvasKit";

export type ShareFormat = "post" | "story";

export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  post: { w: 1200, h: 630 },
  story: { w: 1080, h: 1920 },
};

export interface RoadStage {
  label: string;
  /** One entry per series, in order: true = won. */
  series: boolean[];
}

export interface RunImageData {
  /** Placement in the player's language ("Champion", "Top 8"). */
  placementLabel: string;
  champion: boolean;
  /** "Classic draft · Hard" (drawn in caps). */
  meta: string;
  /** One sentence under the headline ("Undefeated.", "Out to Vitality (2-4) in the Grand Final."). */
  headline: string;
  /** The team rating, the image's second figure. */
  teamFigure: { value: string; label: string };
  /** The three drafted players (the best pick first). */
  cards: ShareCardFace[];
  /** The player's equipped profile banner (an asset URL), or null for the plain stock. */
  bannerUrl: string | null;
  site: string;
}

/** Where the site line sits: the wordmark, then the link in `--faint`. */
export function drawSignature(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  site: string,
  x: number,
  baseline: number,
  size: number,
  align: "left" | "center",
): void {
  if (align === "left") {
    const end = drawWordmark(g, fonts, x, baseline, size, "left");
    g.font = textFont(fonts, size * 0.78, 400);
    g.fillStyle = FAINT;
    g.textAlign = "left";
    g.fillText(site, end + size * 0.7, baseline);
    return;
  }
  drawWordmark(g, fonts, x, baseline, size, "center");
  g.font = textFont(fonts, size * 0.72, 400);
  g.fillStyle = FAINT;
  g.textAlign = "center";
  g.fillText(site, x, baseline + size * 1.25);
  g.textAlign = "left";
}

function imageUrls(data: RunImageData): string[] {
  return data.cards.flatMap((c) => [c.flagUrl, c.logoUrl, c.photoUrl]).filter((u): u is string => Boolean(u));
}

export interface RenderReport {
  /** The banner's strength and the worst text contrast over it (null = no banner). */
  banner: { alpha: number; worst: number } | null;
}

export async function renderRunImage(
  data: RunImageData,
  format: ShareFormat,
  fonts: ShareFonts,
  report?: RenderReport,
): Promise<HTMLCanvasElement> {
  const { w, h } = SHARE_SIZES[format];
  const { canvas, g } = makeCanvas(w, h);
  const [images, banner] = await Promise.all([loadImages(imageUrls(data)), loadImage(data.bannerUrl)]);
  drawFloor(g, w, h);

  if (format === "post") {
    const inset = 22;
    drawImageFrame(g, w, h, inset, data.champion);
    const left = 76;
    const col = 540;
    const metaY = 98;
    if (banner) {
      const over: { rect: Rect; color: string }[] = [{ rect: { x: left, y: metaY - 18, w: col, h: 24 }, color: SUB }];
      const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 196, radius: 24 }, over);
      if (report) report.banner = out;
    }
    drawLabel(g, fonts, data.meta, left, metaY, 17, col);
    drawHeadline(g, fonts, data.placementLabel, left, 262, 112, col, { min: 60 });
    const last = drawSentence(g, fonts, data.headline, left, 326, 26, col, { lines: 2, lineHeight: 36 });
    drawFigure(g, fonts, data.teamFigure.value, data.teamFigure.label, left, Math.max(470, last + 120), 54, { labelSize: 15 });
    drawSignature(g, fonts, data.site, left, 566, 24, "left");
    drawCardHand(g, fonts, data.cards.slice(0, 3), images, 902, 330, 206, { spread: 146, tilt: 7, sideScale: 0.88 });
    return canvas;
  }

  // Story: the content stays between 220 and 1700 px (the Instagram bars).
  const inset = 34;
  drawImageFrame(g, w, h, inset, data.champion);
  const cx = w / 2;
  const metaY = 356;
  if (banner) {
    const over: { rect: Rect; color: string }[] = [
      { rect: { x: cx - 260, y: 262, w: 520, h: 50 }, color: INK },
      { rect: { x: 90, y: metaY - 26, w: w - 180, h: 34 }, color: SUB },
    ];
    const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 380, radius: 24 }, over);
    if (report) report.banner = out;
  }
  drawWordmark(g, fonts, cx, 304, 42, "center");
  drawLabel(g, fonts, data.meta, cx, metaY, 24, w - 180, { align: "center" });
  drawHeadline(g, fonts, data.placementLabel, cx, 600, 168, w - 160, { align: "center", min: 90 });
  drawSentence(g, fonts, data.headline, cx, 684, 38, w - 220, { align: "center", lines: 2, lineHeight: 50 });
  drawCardHand(g, fonts, data.cards.slice(0, 3), images, cx, 1100, 330, { spread: 250, tilt: 6, sideScale: 0.88 });
  drawFigure(g, fonts, data.teamFigure.value, data.teamFigure.label, cx, 1488, 92, { align: "center", labelSize: 24 });
  drawSignature(g, fonts, data.site, cx, 1648, 40, "center");
  return canvas;
}
