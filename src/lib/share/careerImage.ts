/**
 * Share kit: the image of a Road to Worlds career, post and story.
 *
 * rc9 (#258, revised after Miguel's review of 27/11): the club and its team
 * are the centre. The crest, the club's name in mixed case and the manager;
 * the result as a title-sized line (the title won, or the season); the series
 * record (paper white, the one figure) and the prize money; the trophy shelf
 * as four quiet figures; the starting three and the coach as the game's cards
 * wearing the crest, straight and side by side. A Worlds-winning club gets the
 * gold hairline; the equipped profile banner is a faded band behind the top
 * (#259).
 */

import {
  GOLD,
  INK,
  SUB,
  displayFont,
  drawBannerBand,
  drawCardRows,
  drawContained,
  drawFigure,
  drawFloor,
  drawHairline,
  drawImageFrame,
  drawLabel,
  drawTitleLine,
  fitFontSize,
  fitText,
  loadImage,
  loadImages,
  makeCanvas,
  textFont,
  type Rect,
  type ShareCardFace,
  type ShareFonts,
} from "./canvasKit";
import { SHARE_SIZES, drawFigureStrip, drawSignature, type RenderReport, type ShareFigure, type ShareFormat } from "./runImage";

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
  worldsChampion: boolean;
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
  g.fillStyle = SUB;
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
    drawFigure(g, fonts, s.value, s.label, fx, baseline, size, { align, color: s.gold ? GOLD : INK, labelSize });
    if (i > 0) drawHairline(g, x + span * i, baseline - size * 0.9, x + span * i, baseline + size * 0.55);
  });
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
  const [images, banner] = await Promise.all([
    loadImages(data.cards.flatMap((c) => [c.flagUrl, c.photoUrl])),
    loadImage(data.bannerUrl),
  ]);
  if (crest) images.set(CREST_KEY, crest);
  drawFloor(g, w, h);

  if (format === "post") {
    const inset = 22;
    drawImageFrame(g, w, h, inset, data.worldsChampion);
    const left = 64;
    const col = 540;
    if (banner) {
      const over: { rect: Rect; color: string }[] = [
        { rect: { x: left, y: 64, w: col, h: 22 }, color: SUB },
        { rect: { x: 160, y: 108, w: col - 96, h: 76 }, color: INK },
      ];
      const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 190, radius: 24 }, over);
      if (report) report.banner = out;
    }
    drawLabel(g, fonts, data.meta, left, 82, 15, col);
    // The club: its crest, its name, the manager.
    if (crest) drawContained(g, crest, left, 106, 80, 80);
    drawClubName(g, fonts, data.orgName, 160, 144, 32, col - 96, "left");
    drawManager(g, fonts, data.manager, 160, 174, 17, col - 96, "left");
    drawTitleLine(g, fonts, data.headline, left, 270, 44, col, { min: 30 });
    drawFigureStrip(g, fonts, data.figures, left, 356, 190, 30, { labelSize: 12, firstSize: 44 });
    drawShelf(g, fonts, data.shelf, left, 460, 128, 26, 12, "left");
    // The team: the starting three and the coach, two to a row.
    drawCardRows(g, fonts, data.cards.slice(0, 4), images, { x: 660, y: 64, w: 476, h: 502 }, { perRow: 2, gap: 16, maxW: 180 });
    drawSignature(g, fonts, data.site, left, 578, 20, "left");
    return canvas;
  }

  // Story: the content stays between 220 and 1700 px (the Instagram bars).
  const inset = 34;
  drawImageFrame(g, w, h, inset, data.worldsChampion);
  const cx = w / 2;
  if (banner) {
    const over: { rect: Rect; color: string }[] = [{ rect: { x: 96, y: 278, w: w - 192, h: 30 }, color: SUB }];
    const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 400, radius: 24 }, over);
    if (report) report.banner = out;
  }
  drawLabel(g, fonts, data.meta, cx, 302, 22, w - 192, { align: "center" });
  if (crest) drawContained(g, crest, cx - 80, 344, 160, 160);
  drawClubName(g, fonts, data.orgName, cx, 584, 56, w - 192, "center");
  drawManager(g, fonts, data.manager, cx, 630, 26, w - 192, "center");
  drawTitleLine(g, fonts, data.headline, cx, 736, 64, w - 192, { align: "center", min: 44 });
  drawCardRows(g, fonts, data.cards.slice(0, 4), images, { x: 96, y: 800, w: w - 192, h: 340 }, { gap: 20, maxW: 210 });
  drawFigureStrip(g, fonts, data.figures, 96, 1272, (w - 192) / Math.max(1, data.figures.length), 44, {
    align: "center",
    labelSize: 18,
    firstSize: 64,
  });
  drawShelf(g, fonts, data.shelf, 96, 1430, (w - 192) / Math.max(1, data.shelf.length), 36, 16, "center");
  drawSignature(g, fonts, data.site, cx, 1640, 34, "center");
  return canvas;
}
