/**
 * Share kit (v2.2): the image of a finished draft run, in two formats — the
 * post (1200 × 630: X, Discord, WhatsApp, Reddit) and the story
 * (1080 × 1920: Instagram, TikTok and WhatsApp status). Same parts in both:
 * the placement on the paper slab, the road through the bracket as squares,
 * three figures and the drafted roster as the game's own cards.
 */

import {
  BAD,
  GOLD,
  GOOD,
  INK,
  LINE_STRONG,
  ORANGE,
  SUB,
  displayFont,
  drawBoard,
  drawFigure,
  drawFloor,
  drawGameCard,
  drawSlab,
  drawWordmark,
  fitText,
  loadImages,
  makeCanvas,
  resetTracking,
  roundRect,
  setTracking,
  textFont,
  wrapText,
  cssGradient,
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
  /** "CLASSIC DRAFT · HARD · 27 NOV 2026". */
  meta: string;
  /** One sentence under the slab ("Undefeated", "Out to Vitality in the Grand Final, 2-4"). */
  headline: string;
  road: RoadStage[];
  figures: { value: string; label: string; color?: string }[];
  /** Players first, then coach, sub and org (3 in Quick, 6 in Classic). */
  cards: ShareCardFace[];
  site: string;
  pitch: string;
}

function imageUrls(data: RunImageData): string[] {
  return data.cards.flatMap((c) => [c.flagUrl, c.logoUrl, c.photoUrl]).filter((u): u is string => Boolean(u));
}

/** The road: a label and a square per series (won in green, lost in red). */
function drawRoad(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  road: RoadStage[],
  x: number,
  y: number,
  size: number,
  align: "left" | "center",
): void {
  const stages = road.filter((st) => st.series.length > 0);
  if (stages.length === 0) return;
  const sq = size;
  const gap = size * 0.3;
  const stageGap = size * 1.2;
  const labelSize = size * 0.62;
  g.font = displayFont(fonts, labelSize, 600);
  setTracking(g, 0.06, labelSize);
  const widths = stages.map((st) => g.measureText(st.label.toUpperCase()).width + size * 0.5 + st.series.length * (sq + gap) - gap);
  const total = widths.reduce((a, b) => a + b, 0) + stageGap * (stages.length - 1);
  let cx = align === "center" ? x - total / 2 : x;
  stages.forEach((st, i) => {
    g.font = displayFont(fonts, labelSize, 600);
    setTracking(g, 0.06, labelSize);
    g.fillStyle = SUB;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const label = st.label.toUpperCase();
    g.fillText(label, cx, y + sq / 2 + 1);
    cx += g.measureText(label).width + size * 0.5;
    for (const won of st.series) {
      roundRect(g, cx, y, sq, sq, Math.max(2, sq * 0.16));
      g.fillStyle = won ? GOOD : BAD;
      g.globalAlpha = won ? 1 : 0.85;
      g.fill();
      g.globalAlpha = 1;
      cx += sq + gap;
    }
    cx += stageGap - gap;
    if (i === stages.length - 1) return;
  });
  resetTracking(g);
  g.textBaseline = "alphabetic";
}

/** The image's own frame: gold with a soft light for a title, the hairline otherwise. */
function drawFrame(g: CanvasRenderingContext2D, w: number, h: number, inset: number, champion: boolean): void {
  drawBoard(g, inset, inset, w - inset * 2, h - inset * 2, { radius: 26, strong: true, texture: true });
  if (!champion) return;
  g.save();
  g.shadowColor = "rgba(243,201,105,0.45)";
  g.shadowBlur = 28;
  roundRect(g, inset + 1, inset + 1, w - inset * 2 - 2, h - inset * 2 - 2, 25);
  g.lineWidth = 3;
  g.strokeStyle = cssGradient(g, 165, inset, inset, w - inset * 2, h - inset * 2, ["#f3c969", "#8a6224", "#d9a943"]);
  g.stroke();
  g.restore();
}

function cardGrid(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  cards: ShareCardFace[],
  images: Map<string, HTMLImageElement>,
  box: { x: number; y: number; w: number; h: number },
  gapRatio = 0.09,
): void {
  if (cards.length === 0) return;
  const rows = cards.length > 3 ? 2 : 1;
  const perRow = Math.min(3, cards.length);
  // The largest card (3 : 4.3) that fits the box.
  const ratio = 4.3 / 3;
  let cw = box.w / (perRow + gapRatio * (perRow - 1));
  let ch = cw * ratio;
  const needH = ch * rows + ch * gapRatio * (rows - 1);
  if (needH > box.h) {
    ch = box.h / (rows + gapRatio * (rows - 1));
    cw = ch / ratio;
  }
  const gap = cw * gapRatio;
  const gridW = cw * perRow + gap * (perRow - 1);
  const gridH = ch * rows + gap * (rows - 1);
  const x0 = box.x + (box.w - gridW) / 2;
  const y0 = box.y + (box.h - gridH) / 2;
  cards.slice(0, 6).forEach((face, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    drawGameCard(g, fonts, face, images, x0 + col * (cw + gap), y0 + row * (ch + gap), cw, ch);
  });
}

export async function renderRunImage(data: RunImageData, format: ShareFormat, fonts: ShareFonts): Promise<HTMLCanvasElement> {
  const { w, h } = SHARE_SIZES[format];
  const { canvas, g } = makeCanvas(w, h);
  const images = await loadImages(imageUrls(data));
  drawFloor(g, w, h);

  if (format === "post") {
    drawFrame(g, w, h, 22, data.champion);
    const left = 70;
    const colW = 470;
    drawWordmark(g, fonts, left, 96, 30);
    g.font = displayFont(fonts, 17, 600);
    setTracking(g, 0.06, 17);
    g.fillStyle = SUB;
    g.fillText(fitText(g, data.meta.toUpperCase(), colW), left, 128);
    resetTracking(g);

    const slab = drawSlab(g, fonts, data.placementLabel, left, 232, 76, { maxWidth: colW });
    g.font = textFont(fonts, 22, 400);
    g.fillStyle = INK;
    const lines = wrapText(g, data.headline, colW).slice(0, 2);
    lines.forEach((line, i) => g.fillText(line, left, slab.bottom + 40 + i * 30));
    const afterHeadline = slab.bottom + 40 + (lines.length - 1) * 30;
    drawRoad(g, fonts, data.road, left, afterHeadline + 26, 20, "left");

    const figY = 490;
    const figGap = colW / Math.max(1, data.figures.length);
    data.figures.slice(0, 3).forEach((f, i) => {
      drawFigure(g, fonts, f.value, f.label, left + i * figGap, figY, 50, { color: f.color, maxWidth: figGap - 18 });
    });
    if (data.figures.length > 1) {
      g.strokeStyle = LINE_STRONG;
      g.lineWidth = 1.5;
      for (let i = 1; i < Math.min(3, data.figures.length); i++) {
        const lx = left + i * figGap - 14;
        g.beginPath();
        g.moveTo(lx, figY - 44);
        g.lineTo(lx, figY + 22);
        g.stroke();
      }
    }

    g.font = displayFont(fonts, 22, 700);
    setTracking(g, 0.05, 22);
    g.fillStyle = ORANGE;
    g.fillText("ROCKETDRAFT.APP", left, 574);
    const siteW = g.measureText("ROCKETDRAFT.APP").width;
    resetTracking(g);
    g.font = textFont(fonts, 18, 400);
    g.fillStyle = SUB;
    g.fillText(fitText(g, data.pitch, colW - siteW - 16), left + siteW + 16, 574);

    cardGrid(g, fonts, data.cards, images, { x: 572, y: 50, w: 584, h: 530 });
    return canvas;
  }

  // Story.
  drawFrame(g, w, h, 34, data.champion);
  const cx = w / 2;
  drawWordmark(g, fonts, cx, 262, 46, "center");
  g.font = displayFont(fonts, 26, 600);
  setTracking(g, 0.06, 26);
  g.fillStyle = SUB;
  g.textAlign = "center";
  g.fillText(fitText(g, data.meta.toUpperCase(), w - 180), cx, 314);
  resetTracking(g);
  g.textAlign = "left";

  const slab = drawSlab(g, fonts, data.placementLabel, cx, 470, 118, { align: "center", maxWidth: w - 280 });
  g.font = textFont(fonts, 34, 400);
  g.fillStyle = INK;
  g.textAlign = "center";
  const lines = wrapText(g, data.headline, w - 200).slice(0, 2);
  lines.forEach((line, i) => g.fillText(line, cx, slab.bottom + 62 + i * 44));
  g.textAlign = "left";
  const roadY = slab.bottom + 62 + (lines.length - 1) * 44 + 34;
  drawRoad(g, fonts, data.road, cx, roadY, 30, "center");

  const gridTop = roadY + 70;
  cardGrid(g, fonts, data.cards, images, { x: 74, y: gridTop, w: w - 148, h: 1560 - gridTop });

  const figs = data.figures.slice(0, 3);
  const span = (w - 200) / Math.max(1, figs.length);
  figs.forEach((f, i) => {
    drawFigure(g, fonts, f.value, f.label, 100 + span * i + span / 2, 1650, 74, { align: "center", color: f.color, maxWidth: span - 30 });
  });
  g.strokeStyle = LINE_STRONG;
  g.lineWidth = 2;
  for (let i = 1; i < figs.length; i++) {
    const lx = 100 + span * i;
    g.beginPath();
    g.moveTo(lx, 1584);
    g.lineTo(lx, 1690);
    g.stroke();
  }

  g.textAlign = "center";
  g.font = displayFont(fonts, 40, 700);
  setTracking(g, 0.05, 40);
  g.fillStyle = ORANGE;
  g.fillText("ROCKETDRAFT.APP", cx, 1778);
  resetTracking(g);
  g.font = textFont(fonts, 28, 400);
  g.fillStyle = SUB;
  g.fillText(fitText(g, data.pitch, w - 200), cx, 1822);
  g.textAlign = "left";
  return canvas;
}

/** The trophy-gold used for a champion's figures. */
export const CHAMPION_GOLD = GOLD;
