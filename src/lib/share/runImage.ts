/**
 * Share kit: the image of a finished draft run, in two formats, the post
 * (1200 × 630: X, Discord, WhatsApp, Reddit) and the story (1080 × 1920:
 * Instagram, TikTok and WhatsApp status).
 *
 * rc9 (#258, revised after Miguel's review of 27/11: "limpas, elegantes ...
 * mostrar bem o time usado"): the team is the centre, every drafted card in a
 * straight row (players, coach, sub, org), none hidden; above it the result
 * as a title-sized line with the mode and the difficulty, the path in one
 * sentence and the road as quiet squares; the three figures of the run (team
 * overall in paper white, chemistry, the Swiss record); the wordmark and the
 * link small. No tilt, no overlap, no glow beyond the cards' rarity. The
 * equipped profile banner is a faded band behind the top (#259).
 */

import {
  INK,
  PAPER,
  SUB,
  FAINT,
  drawBannerBand,
  drawCardRows,
  drawFigure,
  drawFloor,
  drawHairline,
  drawImageFrame,
  drawLabel,
  drawRoad,
  drawSentence,
  drawTitleLine,
  drawWordmark,
  loadImage,
  loadImages,
  makeCanvas,
  textFont,
  type Rect,
  type RoadStageMarks,
  type ShareCardFace,
  type ShareFonts,
} from "./canvasKit";

export type ShareFormat = "post" | "story";

export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  post: { w: 1200, h: 630 },
  story: { w: 1080, h: 1920 },
};

export type RoadStage = RoadStageMarks;

export interface ShareFigure {
  value: string;
  label: string;
}

export interface RunImageData {
  /** Placement in the player's language ("Champion", "Top 8"). */
  placementLabel: string;
  champion: boolean;
  /** "Classic draft · Hard" (drawn in caps). */
  meta: string;
  /** The path in one sentence ("3-1 in the Swiss, then won the playoffs."). */
  headline: string;
  road: RoadStage[];
  /** Team overall first (the one figure in paper white), then chemistry and the record. */
  figures: ShareFigure[];
  /** Every drafted card: players first, then coach, sub and org. */
  cards: ShareCardFace[];
  /** The player's equipped profile banner (an asset URL), or null for the plain stock. */
  bannerUrl: string | null;
  site: string;
}

/** The wordmark, then the link in `--faint`. */
export function drawSignature(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  site: string,
  x: number,
  baseline: number,
  size: number,
  align: "left" | "center",
): void {
  if (align === "center") {
    drawWordmark(g, fonts, x, baseline, size, "center");
    g.font = textFont(fonts, size * 0.72, 400);
    g.fillStyle = FAINT;
    g.textAlign = "center";
    g.fillText(site, x, baseline + size * 1.25);
    g.textAlign = "left";
    return;
  }
  const end = drawWordmark(g, fonts, x, baseline, size, "left");
  g.font = textFont(fonts, size * 0.78, 400);
  g.fillStyle = FAINT;
  g.textAlign = "left";
  g.fillText(site, end + size * 0.7, baseline);
}

/**
 * Figures side by side, hairlines between them: the first in paper white
 * (the one figure), the others in ink. `x` is the left edge, `span` the width
 * of each.
 */
export function drawFigureStrip(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  figures: ShareFigure[],
  x: number,
  baseline: number,
  span: number,
  size: number,
  opts: { align?: "left" | "center"; labelSize?: number; firstSize?: number } = {},
): void {
  figures.forEach((f, i) => {
    const fx = opts.align === "center" ? x + span * i + span / 2 : x + span * i + (i > 0 ? size * 0.5 : 0);
    const first = i === 0;
    drawFigure(g, fonts, f.value, f.label, fx, baseline, first ? (opts.firstSize ?? size) : size, {
      align: opts.align ?? "left",
      color: first ? PAPER : INK,
      labelSize: opts.labelSize,
    });
    if (i > 0) drawHairline(g, x + span * i, baseline - size * 0.9, x + span * i, baseline + size * 0.55, true);
  });
}

function imageUrls(cards: ShareCardFace[]): string[] {
  return cards.flatMap((c) => [c.flagUrl, c.logoUrl, c.photoUrl]).filter((u): u is string => Boolean(u));
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
  const [images, banner] = await Promise.all([loadImages(imageUrls(data.cards)), loadImage(data.bannerUrl)]);
  drawFloor(g, w, h);
  const figures = data.figures.slice(0, 3);

  if (format === "post") {
    const inset = 22;
    drawImageFrame(g, w, h, inset, data.champion);
    const left = 64;
    const right = w - 64;
    const span = 128;
    const figX = right - span * figures.length;
    const colW = figX - left - 32;
    if (banner) {
      const over: { rect: Rect; color: string }[] = [
        { rect: { x: left, y: 64, w: colW, h: 22 }, color: SUB },
        { rect: { x: left, y: 98, w: colW, h: 50 }, color: INK },
        { rect: { x: figX, y: 104, w: right - figX, h: 46 }, color: INK },
      ];
      const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 170, radius: 24 }, over);
      if (report) report.banner = out;
    }
    drawLabel(g, fonts, data.meta, left, 82, 15, colW);
    drawTitleLine(g, fonts, data.placementLabel, left, 142, 52, colW, { min: 36 });
    drawSentence(g, fonts, data.headline, left, 182, 20, colW, { lines: 1 });
    drawRoad(g, fonts, data.road, left, 200, 14, "left");
    drawFigureStrip(g, fonts, figures, figX, 140, span, 30, { labelSize: 12, firstSize: 44 });
    drawCardRows(g, fonts, data.cards.slice(0, 6), images, { x: left, y: 244, w: right - left, h: 266 }, { gap: 16, maxW: 176 });
    drawHairline(g, left, 540, right, 540);
    drawSignature(g, fonts, data.site, left, 578, 20, "left");
    return canvas;
  }

  // Story: the content stays between 220 and 1700 px (the Instagram bars).
  const inset = 34;
  drawImageFrame(g, w, h, inset, data.champion);
  const cx = w / 2;
  if (banner) {
    const over: { rect: Rect; color: string }[] = [
      { rect: { x: 96, y: 278, w: w - 192, h: 30 }, color: SUB },
      { rect: { x: 96, y: 330, w: w - 192, h: 70 }, color: INK },
    ];
    const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 400, radius: 24 }, over);
    if (report) report.banner = out;
  }
  drawLabel(g, fonts, data.meta, cx, 302, 22, w - 192, { align: "center" });
  drawTitleLine(g, fonts, data.placementLabel, cx, 392, 72, w - 192, { align: "center", min: 48 });
  drawSentence(g, fonts, data.headline, cx, 450, 28, w - 192, { align: "center", lines: 1 });
  drawRoad(g, fonts, data.road, cx, 482, 24, "center");
  drawCardRows(g, fonts, data.cards.slice(0, 6), images, { x: 96, y: 560, w: w - 192, h: 840 }, { perRow: 3, gap: 24, maxW: 280 });
  drawFigureStrip(g, fonts, figures, 96, 1520, (w - 192) / Math.max(1, figures.length), 44, {
    align: "center",
    labelSize: 18,
    firstSize: 64,
  });
  drawSignature(g, fonts, data.site, cx, 1640, 34, "center");
  return canvas;
}
