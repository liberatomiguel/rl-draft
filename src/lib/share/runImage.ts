/**
 * Share kit: the image of a finished draft run, in two formats, the post
 * (1200 × 630: X, Discord, WhatsApp, Reddit) and the story (1080 × 1920:
 * Instagram, TikTok and WhatsApp status).
 *
 * The result leads, framed by the equipped profile banner. Every drafted card
 * gets its own space, with the run figures and wordmark set below the roster.
 */

import {
  INK,
  GOLD,
  ORANGE,
  PAPER,
  CAPTION,
  drawBannerBand,
  drawBoard,
  drawCardRows,
  drawFigure,
  drawFloor,
  drawHairline,
  drawHeadline,
  drawImageFrame,
  drawLabel,
  drawRoad,
  drawSentence,
  drawSignature,
  loadImage,
  loadImages,
  loadShareMark,
  makeCanvas,
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
      maxW: span - size * 0.75,
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
  const [images, banner, mark] = await Promise.all([
    loadImages(imageUrls(data.cards)),
    loadImage(data.bannerUrl),
    loadShareMark(),
  ]);
  drawFloor(g, w, h);
  const titleColor = data.champion ? GOLD : PAPER;
  const cards = data.cards.slice(0, 6);
  const hasRoad = data.road.some((stage) => stage.series.length > 0);
  const figures = data.figures.slice(0, hasRoad ? 2 : 3);

  if (format === "post") {
    const inset = 22;
    drawImageFrame(g, w, h, inset, data.champion);
    const left = 64;
    const right = w - 64;
    const width = right - left;
    const titleWidth = width - 240;
    if (banner) {
      const over: { rect: Rect; color: string }[] = [
        { rect: { x: left, y: 51, w: titleWidth, h: 24 }, color: CAPTION },
        { rect: { x: left, y: 72, w: titleWidth, h: 94 }, color: titleColor },
        { rect: { x: left, y: 176, w: titleWidth, h: 25 }, color: CAPTION },
        { rect: { x: right - 164, y: 55, w: 164, h: 27 }, color: ORANGE },
        { rect: { x: right - 164, y: 86, w: 164, h: 20 }, color: CAPTION },
      ];
      const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 304, radius: 24 }, over, { fadeLeft: true });
      if (report) report.banner = out;
    }
    drawLabel(g, fonts, data.meta, left, 69, 16, titleWidth, { color: CAPTION });
    drawHeadline(g, fonts, data.placementLabel, left, 159, data.champion ? 98 : 79, titleWidth, { color: titleColor });
    drawSentence(g, fonts, data.headline, left, 196, 23, titleWidth, { lines: 1, color: CAPTION });
    drawSignature(g, fonts, mark, data.site, right, 56, 49, "right");
    drawCardRows(g, fonts, cards, images, { x: left, y: 224, w: width, h: 246 }, { gap: 14, maxW: 170 });
    drawBoard(g, left, 493, width, 96, { radius: 14 });
    const statsWidth = hasRoad ? 400 : width - 48;
    drawFigureStrip(g, fonts, figures, left + 24, 547, statsWidth / Math.max(1, figures.length), 31, {
      align: hasRoad ? "left" : "center",
      labelSize: 13,
      firstSize: 42,
    });
    if (hasRoad) {
      const roadLeft = left + statsWidth + 48;
      const roadWidth = right - roadLeft - 24;
      drawHairline(g, roadLeft - 20, 513, roadLeft - 20, 569);
      drawRoad(g, fonts, data.road, roadLeft + roadWidth / 2, 529, roadWidth, 22);
    }
    return canvas;
  }

  // Story: the content stays between 220 and 1700 px (the Instagram bars).
  const inset = 34;
  drawImageFrame(g, w, h, inset, data.champion);
  const cx = w / 2;
  const left = 96;
  const width = w - left * 2;
  if (banner) {
    const over: { rect: Rect; color: string }[] = [
      { rect: { x: left, y: 252, w: width, h: 34 }, color: CAPTION },
      { rect: { x: left, y: 300, w: width, h: 137 }, color: titleColor },
      { rect: { x: left, y: 451, w: width, h: 74 }, color: CAPTION },
    ];
    const out = drawBannerBand(g, banner, { x: inset + 2, y: 152, w: w - inset * 2 - 4, h: 498, radius: 24 }, over);
    if (report) report.banner = out;
  }
  drawLabel(g, fonts, data.meta, cx, 280, 23, width, { align: "center", color: CAPTION });
  drawHeadline(g, fonts, data.placementLabel, cx, 430, data.champion ? 132 : 101, width, { align: "center", color: titleColor });
  drawSentence(g, fonts, data.headline, cx, 482, 30, width, { align: "center", lines: 2, lineHeight: 36, color: CAPTION });
  drawCardRows(g, fonts, cards, images, { x: left, y: 553, w: width, h: 712 }, { perRow: 3, gap: 24, maxW: 264 });
  drawBoard(g, left, 1304, width, hasRoad ? 246 : 138, { radius: 20 });
  drawFigureStrip(g, fonts, figures, left + 18, 1380, (width - 36) / Math.max(1, figures.length), 43, {
    align: "center",
    labelSize: 18,
    firstSize: 56,
  });
  if (hasRoad) {
    drawHairline(g, left + 32, 1430, w - left - 32, 1430);
    drawRoad(g, fonts, data.road, cx, 1474, width - 72, 28);
  }
  drawSignature(g, fonts, mark, data.site, cx, hasRoad ? 1605 : 1502, 65, "center");
  return canvas;
}
