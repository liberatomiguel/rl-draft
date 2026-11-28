/**
 * Share kit: the image of a Road to Worlds career, post and story.
 *
 * The result leads above the club identity. The equipped profile banner
 * sits behind the headline, with the figures and squad on darker stock.
 */

import {
  BAD,
  GOLD,
  GOOD,
  INK,
  PAPER,
  CAPTION,
  displayFont,
  drawBannerBand,
  drawBoard,
  drawCardRows,
  drawContained,
  drawFigure,
  drawFloor,
  drawHairline,
  drawHeadline,
  drawImageFrame,
  drawLabel,
  drawSignature,
  fitFontSize,
  fitText,
  loadImage,
  loadImages,
  loadShareMark,
  makeCanvas,
  roundRect,
  textFont,
  type Rect,
  type ShareCardFace,
  type ShareFonts,
} from "./canvasKit";
import { SHARE_SIZES, drawFigureStrip, type RenderReport, type ShareFigure, type ShareFormat } from "./runImage";

/** The cards' crest: the club's mark, passed in as an image under this key. */
export const CREST_KEY = "career:crest";

export interface CareerImageData {
  /** "Road to Worlds · SAM · RLCS 2027" (drawn in caps). */
  meta: string;
  orgName: string;
  /** "Manager Sam Okoye". */
  manager: string;
  /** The result line: "2× Major champions", or "Season 3". */
  headline: string;
  hasTitle: boolean;
  worldsChampion: boolean;
  record: { wins: number; losses: number };
  /** Series record first (the one figure), then prize money. */
  figures: ShareFigure[];
  /** Worlds, Majors, Regionals, other titles. */
  shelf: { value: string; label: string; gold?: boolean }[];
  /** The starting three, then the coach (their crest is CREST_KEY). */
  cards: ShareCardFace[];
  bannerUrl: string | null;
  site: string;
}

/** The club's name in mixed case, display Demi, fitted to `max`. */
function drawClubName(g: CanvasRenderingContext2D, fonts: ShareFonts, name: string, x: number, baseline: number, size: number, max: number, align: CanvasTextAlign): void {
  const s = fitFontSize(g, name, max, size, size * 0.6, (n) => displayFont(fonts, n, 600));
  g.font = displayFont(fonts, s, 600);
  g.fillStyle = INK;
  g.textAlign = align;
  g.fillText(fitText(g, name, max), x, baseline);
  g.textAlign = "left";
}

function drawManager(g: CanvasRenderingContext2D, fonts: ShareFonts, text: string, x: number, baseline: number, size: number, max: number, align: CanvasTextAlign): void {
  g.font = textFont(fonts, size, 400);
  g.fillStyle = CAPTION;
  g.textAlign = align;
  g.fillText(fitText(g, text, max), x, baseline);
  g.textAlign = "left";
}

/** The trophy shelf: four small figures, hairlines between; a Worlds title in gold. */
function drawShelf(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  shelf: CareerImageData["shelf"],
  x: number,
  baseline: number,
  span: number,
  size: number,
  labelSize: number,
  align: "left" | "center",
): void {
  shelf.forEach((s, i) => {
    const fx = align === "center" ? x + span * i + span / 2 : x + span * i + (i > 0 ? size * 0.5 : 0);
    drawFigure(g, fonts, s.value, s.label, fx, baseline, size, {
      align, color: s.gold ? GOLD : INK, labelSize, maxW: span - size * 0.6,
    });
    if (i > 0) drawHairline(g, x + span * i, baseline - size * 0.9, x + span * i, baseline + size * 0.55);
  });
}

/** The actual share of series won (left) and lost (right). */
function drawRecordBar(g: CanvasRenderingContext2D, record: CareerImageData["record"], x: number, y: number, w: number, h: number): void {
  const total = record.wins + record.losses;
  if (total === 0) return;
  const won = w * record.wins / total;
  g.save();
  roundRect(g, x, y, w, h, h / 2);
  g.clip();
  g.fillStyle = GOOD;
  g.fillRect(x, y, won, h);
  g.fillStyle = BAD;
  g.fillRect(x + won, y, w - won, h);
  g.restore();
}

export async function renderCareerImage(
  data: CareerImageData,
  crest: HTMLImageElement | null,
  format: ShareFormat,
  fonts: ShareFonts,
  report?: RenderReport,
): Promise<HTMLCanvasElement> {
  const { w, h } = SHARE_SIZES[format];
  const { canvas, g } = makeCanvas(w, h);
  const [images, banner, mark] = await Promise.all([
    loadImages(data.cards.flatMap((c) => [c.flagUrl, c.photoUrl])),
    loadImage(data.bannerUrl),
    loadShareMark(),
  ]);
  if (crest) images.set(CREST_KEY, crest);
  drawFloor(g, w, h);
  const titleColor = data.hasTitle ? GOLD : PAPER;
  const cards = data.cards.slice(0, 4);

  if (format === "post") {
    const inset = 22;
    drawImageFrame(g, w, h, inset, data.worldsChampion);
    const left = 64;
    const col = 552;
    if (banner) {
      const over: { rect: Rect; color: string }[] = [
        { rect: { x: left, y: 54, w: col, h: 24 }, color: CAPTION },
        { rect: { x: left, y: 88, w: col, h: 130 }, color: titleColor },
        { rect: { x: left, y: 244, w: col, h: 70 }, color: CAPTION },
      ];
      const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 332, radius: 24 }, over);
      if (report) report.banner = out;
    }
    drawLabel(g, fonts, data.meta, left, 74, 16, col, { color: CAPTION });
    drawHeadline(g, fonts, data.headline, left, 209, data.hasTitle ? 66 : 60, col, { min: 48, color: titleColor });
    const nameInset = crest ? 76 : 0;
    if (crest) drawContained(g, crest, left, 248, 58, 58);
    drawClubName(g, fonts, data.orgName, left + nameInset, 274, 31, col - nameInset, "left");
    drawManager(g, fonts, data.manager, left + nameInset, 301, 19, col - nameInset, "left");
    drawBoard(g, left, 326, col, 194, { radius: 14 });
    drawFigureStrip(g, fonts, data.figures, left + 24, 378, 250, 33, { labelSize: 13, firstSize: 44 });
    drawRecordBar(g, data.record, left + 24, 410, 174, 5);
    drawHairline(g, left + 24, 437, left + col - 24, 437);
    drawShelf(g, fonts, data.shelf, left + 24, 480, (col - 48) / 4, 29, 13, "left");
    drawCardRows(g, fonts, cards, images, { x: 659, y: 61, w: 477, h: 460 }, { perRow: 2, gap: 16, maxW: 177 });
    drawHairline(g, left, 543, w - left, 543);
    drawSignature(g, fonts, mark, data.site, w - left, 555, 43, "right");
    return canvas;
  }

  // Story: the content stays between 220 and 1700 px (the Instagram bars).
  const inset = 34;
  drawImageFrame(g, w, h, inset, data.worldsChampion);
  const cx = w / 2;
  const left = 96;
  const width = w - left * 2;
  if (banner) {
    const over: { rect: Rect; color: string }[] = [
      { rect: { x: left, y: 259, w: width, h: 34 }, color: CAPTION },
      { rect: { x: left, y: 304, w: width, h: 145 }, color: titleColor },
      { rect: { x: left, y: 565, w: width, h: 81 }, color: CAPTION },
    ];
    const out = drawBannerBand(g, banner, { x: inset + 2, y: 152, w: w - inset * 2 - 4, h: 524, radius: 24 }, over);
    if (report) report.banner = out;
  }
  drawLabel(g, fonts, data.meta, cx, 283, 22, width, { align: "center", color: CAPTION });
  drawHeadline(g, fonts, data.headline, cx, 444, data.hasTitle ? 96 : 87, width, { align: "center", min: 67, twoLineMax: 80, color: titleColor });
  if (crest) drawContained(g, crest, cx - 38, 477, 76, 76);
  drawClubName(g, fonts, data.orgName, cx, 603, 49, width, "center");
  drawManager(g, fonts, data.manager, cx, 641, 26, width, "center");
  drawCardRows(g, fonts, cards, images, { x: left, y: 688, w: width, h: 554 }, { perRow: cards.length > 3 ? 2 : 3, gap: 20, maxW: 240 });
  drawBoard(g, left, 1283, width, 263, { radius: 20 });
  drawFigureStrip(g, fonts, data.figures, left + 18, 1361, (width - 36) / Math.max(1, data.figures.length), 44, {
    align: "center",
    labelSize: 18,
    firstSize: 64,
  });
  drawRecordBar(g, data.record, left + width / 4 - 107, 1402, 214, 7);
  drawHairline(g, left + 32, 1433, w - left - 32, 1433);
  drawShelf(g, fonts, data.shelf, left + 18, 1493, (width - 36) / Math.max(1, data.shelf.length), 36, 17, "center");
  drawSignature(g, fonts, mark, data.site, cx, 1605, 65, "center");
  return canvas;
}
