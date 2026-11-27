/**
 * Share kit (v2.2): the image of a Road to Worlds career, post and story.
 * The club leads (its crest and its name), the headline sits on the paper
 * slab, the trophy shelf is a strip of figures with the Worlds in trophy gold,
 * and the starting three stand as the game's cards wearing the club's crest.
 * A club that has won the Worlds gets the gold frame.
 */

import {
  GOLD,
  INK,
  LINE_STRONG,
  ORANGE,
  SUB,
  displayFont,
  drawBoard,
  drawContained,
  drawFigure,
  drawFloor,
  drawGameCard,
  drawSlab,
  drawWordmark,
  fitFontSize,
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
import { SHARE_SIZES, type ShareFormat } from "./runImage";

export const CREST_KEY = "career:crest";

export interface CareerImageData {
  kicker: string;
  orgName: string;
  /** "Manager Sam Okoye". */
  manager: string;
  /** "SAM · RLCS Season X". */
  meta: string;
  headline: string;
  sentence: string;
  worldsChampion: boolean;
  /** Worlds, Majors, Regionals, other titles: the shelf. */
  shelf: { value: string; label: string; gold?: boolean }[];
  /** Series record, prize money. */
  figures: { value: string; label: string }[];
  /** The starting three (their crest is CREST_KEY). */
  starters: ShareCardFace[];
  startersLabel: string;
  coachLine: string | null;
  pitch: string;
}

function drawFrame(g: CanvasRenderingContext2D, w: number, h: number, inset: number, gold: boolean): void {
  drawBoard(g, inset, inset, w - inset * 2, h - inset * 2, { radius: 26, strong: true, texture: true });
  if (!gold) return;
  g.save();
  g.shadowColor = "rgba(243,201,105,0.45)";
  g.shadowBlur = 28;
  roundRect(g, inset + 1, inset + 1, w - inset * 2 - 2, h - inset * 2 - 2, 25);
  g.lineWidth = 3;
  g.strokeStyle = cssGradient(g, 165, inset, inset, w - inset * 2, h - inset * 2, ["#f3c969", "#8a6224", "#d9a943"]);
  g.stroke();
  g.restore();
}

function drawShelf(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  shelf: CareerImageData["shelf"],
  x: number,
  baseline: number,
  width: number,
  size: number,
  align: "left" | "center",
): void {
  const n = Math.max(1, shelf.length);
  const span = width / n;
  shelf.forEach((item, i) => {
    const fx = align === "center" ? x + span * i + span / 2 : x + span * i;
    drawFigure(g, fonts, item.value, item.label, fx, baseline, size, {
      align: align === "center" ? "center" : "left",
      color: item.gold ? GOLD : item.value === "0" ? "rgba(233,238,248,0.35)" : INK,
      maxWidth: span - 16,
    });
    if (i > 0) {
      g.strokeStyle = LINE_STRONG;
      g.lineWidth = 1.5;
      const lx = x + span * i - (align === "center" ? 0 : 14);
      g.beginPath();
      g.moveTo(lx, baseline - size * 0.86);
      g.lineTo(lx, baseline + size * 0.48);
      g.stroke();
    }
  });
}

function drawCardsRow(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  cards: ShareCardFace[],
  images: Map<string, HTMLImageElement>,
  x: number,
  y: number,
  w: number,
  maxH: number,
): { bottom: number } {
  const n = Math.max(1, cards.length);
  const gapRatio = 0.09;
  let cw = w / (n + gapRatio * (n - 1));
  let ch = cw * (4.3 / 3);
  if (ch > maxH) {
    ch = maxH;
    cw = ch / (4.3 / 3);
  }
  const gap = cw * gapRatio;
  const rowW = cw * n + gap * (n - 1);
  const x0 = x + (w - rowW) / 2;
  cards.forEach((face, i) => drawGameCard(g, fonts, face, images, x0 + i * (cw + gap), y, cw, ch));
  return { bottom: y + ch };
}

export async function renderCareerImage(
  data: CareerImageData,
  crest: HTMLImageElement | null,
  format: ShareFormat,
  fonts: ShareFonts,
): Promise<HTMLCanvasElement> {
  const { w, h } = SHARE_SIZES[format];
  const { canvas, g } = makeCanvas(w, h);
  const images = await loadImages(data.starters.flatMap((c) => [c.flagUrl, c.photoUrl]));
  if (crest) images.set(CREST_KEY, crest);
  drawFloor(g, w, h);

  if (format === "post") {
    drawFrame(g, w, h, 22, data.worldsChampion);
    const left = 70;
    const colW = 500;
    const wmEnd = drawWordmark(g, fonts, left, 92, 26);
    g.font = displayFont(fonts, 17, 600);
    setTracking(g, 0.06, 17);
    g.fillStyle = ORANGE;
    g.fillText(data.kicker.toUpperCase(), wmEnd + 18, 91);
    resetTracking(g);

    // Crest and name.
    const crestBox = 118;
    if (crest) drawContained(g, crest, left, 116, crestBox, crestBox);
    const nameX = left + crestBox + 22;
    const nameW = colW - crestBox - 22;
    const nameSize = fitFontSize(g, data.orgName.toUpperCase(), nameW, 54, 30, (s) => displayFont(fonts, s, 700));
    g.font = displayFont(fonts, nameSize, 700);
    g.fillStyle = INK;
    g.fillText(fitText(g, data.orgName.toUpperCase(), nameW), nameX, 172);
    g.font = textFont(fonts, 19, 600);
    g.fillStyle = INK;
    g.fillText(fitText(g, data.manager, nameW), nameX, 206);
    g.font = displayFont(fonts, 16, 600);
    setTracking(g, 0.05, 16);
    g.fillStyle = SUB;
    g.fillText(fitText(g, data.meta.toUpperCase(), nameW), nameX, 232);
    resetTracking(g);

    const slab = drawSlab(g, fonts, data.headline, left, 318, 58, { maxWidth: colW });
    g.font = textFont(fonts, 21, 400);
    g.fillStyle = INK;
    const lines = wrapText(g, data.sentence, colW).slice(0, 2);
    lines.forEach((line, i) => g.fillText(line, left, slab.bottom + 38 + i * 28));

    drawShelf(g, fonts, data.shelf, left, 500, colW, 46, "left");

    g.font = displayFont(fonts, 22, 700);
    setTracking(g, 0.05, 22);
    g.fillStyle = ORANGE;
    g.fillText("ROCKETDRAFT.APP", left, 574);
    const siteW = g.measureText("ROCKETDRAFT.APP").width;
    resetTracking(g);
    g.font = textFont(fonts, 18, 400);
    g.fillStyle = SUB;
    g.fillText(fitText(g, data.pitch, colW - siteW - 16), left + siteW + 16, 574);

    // Right: the crest as a large, faint watermark, the starting three over it.
    const rx = 610;
    const rw = 1150 - rx;
    if (crest) drawContained(g, crest, rx + 40, 60, rw - 80, 520, 0.07);
    g.font = displayFont(fonts, 16, 600);
    setTracking(g, 0.08, 16);
    g.fillStyle = SUB;
    g.textAlign = "center";
    // The block (label, cards, figures, coach) sits in the middle of the frame.
    const top = data.coachLine ? 120 : 140;
    g.fillText(data.startersLabel.toUpperCase(), rx + rw / 2, top);
    resetTracking(g);
    g.textAlign = "left";
    const row = drawCardsRow(g, fonts, data.starters, images, rx, top + 20, rw, 300);
    figuresUnder(g, fonts, data, rx + rw / 2, row.bottom + 62, rw, 34);
    if (data.coachLine) {
      g.font = textFont(fonts, 17, 400);
      g.fillStyle = SUB;
      g.textAlign = "center";
      g.fillText(fitText(g, data.coachLine, rw - 40), rx + rw / 2, row.bottom + 128);
      g.textAlign = "left";
    }
    return canvas;
  }

  // Story.
  drawFrame(g, w, h, 34, data.worldsChampion);
  const cx = w / 2;
  drawWordmark(g, fonts, cx, 250, 42, "center");
  g.font = displayFont(fonts, 26, 600);
  setTracking(g, 0.08, 26);
  g.fillStyle = ORANGE;
  g.textAlign = "center";
  g.fillText(data.kicker.toUpperCase(), cx, 296);
  resetTracking(g);
  if (crest) drawContained(g, crest, cx - 150, 336, 300, 300);
  const nameSize = fitFontSize(g, data.orgName.toUpperCase(), w - 160, 96, 48, (s) => displayFont(fonts, s, 700));
  g.font = displayFont(fonts, nameSize, 700);
  g.fillStyle = INK;
  g.fillText(fitText(g, data.orgName.toUpperCase(), w - 160), cx, 740);
  g.font = displayFont(fonts, 24, 600);
  setTracking(g, 0.05, 24);
  g.fillStyle = SUB;
  g.fillText(fitText(g, `${data.manager} · ${data.meta}`.toUpperCase(), w - 160), cx, 786);
  resetTracking(g);
  g.textAlign = "left";

  const slab = drawSlab(g, fonts, data.headline, cx, 912, 88, { align: "center", maxWidth: w - 280 });
  g.font = textFont(fonts, 32, 400);
  g.fillStyle = INK;
  g.textAlign = "center";
  const lines = wrapText(g, data.sentence, w - 200).slice(0, 2);
  lines.forEach((line, i) => g.fillText(line, cx, slab.bottom + 58 + i * 42));
  g.textAlign = "left";

  const top = slab.bottom + 58 + (lines.length - 1) * 42 + 50;
  g.font = displayFont(fonts, 22, 600);
  setTracking(g, 0.08, 22);
  g.fillStyle = SUB;
  g.textAlign = "center";
  g.fillText(data.startersLabel.toUpperCase(), cx, top + 8);
  resetTracking(g);
  g.textAlign = "left";
  const row = drawCardsRow(g, fonts, data.starters, images, 80, top + 32, w - 160, 430);
  if (data.coachLine) {
    g.font = textFont(fonts, 26, 400);
    g.fillStyle = SUB;
    g.textAlign = "center";
    g.fillText(fitText(g, data.coachLine, w - 200), cx, row.bottom + 46);
    g.textAlign = "left";
  }

  drawShelf(g, fonts, data.shelf, 100, 1640, w - 200, 70, "center");

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

/** The record figures under the starting three (post only). */
function figuresUnder(g: CanvasRenderingContext2D, fonts: ShareFonts, data: CareerImageData, cx: number, baseline: number, width: number, size: number): void {
  const figs = data.figures.slice(0, 3);
  if (figs.length === 0) return;
  const span = Math.min(180, width / figs.length);
  const x0 = cx - (span * figs.length) / 2;
  figs.forEach((f, i) => drawFigure(g, fonts, f.value, f.label, x0 + span * i + span / 2, baseline, size, { align: "center", maxWidth: span - 12 }));
}
