/**
 * Share kit: the image of a Road to Worlds career, post and story.
 *
 * rc9 (#258): one thing first. The headline is the title won (or, for a club
 * with no title yet, its series record) in Bold paper white, one sentence
 * under it; the club is the second thing (its crest large, its name in mixed
 * case, the manager quiet under it). The trophy shelf, the prize money and the
 * coach line are gone, and so is the hand of starters the WIP story drew (each
 * card repeated the crest). A club that has won the Worlds gets the gold
 * frame, and the equipped profile banner is a quiet band behind the top (#259).
 */

import {
  INK,
  PAPER,
  SUB,
  displayFont,
  drawBannerBand,
  drawContained,
  drawFloor,
  drawHeadline,
  drawImageFrame,
  drawLabel,
  drawSentence,
  fitFontSize,
  fitText,
  loadImage,
  makeCanvas,
  textFont,
  type Rect,
  type ShareFonts,
} from "./canvasKit";
import { SHARE_SIZES, drawSignature, type RenderReport, type ShareFormat } from "./runImage";

export interface CareerImageData {
  /** "Road to Worlds · SAM · RLCS 2027" (drawn in caps). */
  meta: string;
  orgName: string;
  /** "Manager Sam Okoye". */
  manager: string;
  /** The one headline: "World champions", or the series record "34-12". */
  headline: string;
  sentence: string;
  worldsChampion: boolean;
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

export async function renderCareerImage(
  data: CareerImageData,
  crest: HTMLImageElement | null,
  format: ShareFormat,
  fonts: ShareFonts,
  report?: RenderReport,
): Promise<HTMLCanvasElement> {
  const { w, h } = SHARE_SIZES[format];
  const { canvas, g } = makeCanvas(w, h);
  const banner = await loadImage(data.bannerUrl);
  drawFloor(g, w, h);

  if (format === "post") {
    const inset = 22;
    drawImageFrame(g, w, h, inset, data.worldsChampion);
    const left = 76;
    const col = 600;
    const metaY = 98;
    if (banner) {
      const over: { rect: Rect; color: string }[] = [
        { rect: { x: left, y: metaY - 18, w: col, h: 24 }, color: SUB },
        // A long headline breaks upwards into the band's foot.
        { rect: { x: left, y: 140, w: col, h: 78 }, color: PAPER },
      ];
      const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 196, radius: 24 }, over);
      if (report) report.banner = out;
    }
    drawLabel(g, fonts, data.meta, left, metaY, 17, col);
    drawHeadline(g, fonts, data.headline, left, 262, 104, col, { min: 56, twoLineMax: 72 });
    drawSentence(g, fonts, data.sentence, left, 326, 26, col, { lines: 2, lineHeight: 36 });
    drawClubName(g, fonts, data.orgName, left, 452, 44, col, "left");
    drawManager(g, fonts, data.manager, left, 490, 20, col, "left");
    drawSignature(g, fonts, data.site, left, 566, 24, "left");
    // The club's crest, large, on the right: the image's object.
    if (crest) drawContained(g, crest, 790, 150, 330, 330);
    return canvas;
  }

  // Story: the content stays between 220 and 1700 px (the Instagram bars).
  const inset = 34;
  drawImageFrame(g, w, h, inset, data.worldsChampion);
  const cx = w / 2;
  // The meta line opens the story; the wordmark signs it once, at the foot.
  const metaY = 330;
  if (banner) {
    const over: { rect: Rect; color: string }[] = [{ rect: { x: 90, y: metaY - 26, w: w - 180, h: 34 }, color: SUB }];
    const out = drawBannerBand(g, banner, { x: inset + 2, y: inset + 2, w: w - inset * 2 - 4, h: 380, radius: 24 }, over);
    if (report) report.banner = out;
  }
  drawLabel(g, fonts, data.meta, cx, metaY, 24, w - 180, { align: "center" });
  drawHeadline(g, fonts, data.headline, cx, 640, 150, w - 160, { align: "center", min: 84, twoLineMax: 128 });
  drawSentence(g, fonts, data.sentence, cx, 724, 36, w - 220, { align: "center", lines: 2, lineHeight: 48 });
  // The club is the second thing: its crest large, its name, the manager quiet.
  // The starting three are left out: each card would repeat the crest.
  if (crest) drawContained(g, crest, cx - 180, 860, 360, 360);
  drawClubName(g, fonts, data.orgName, cx, 1336, 72, w - 180, "center");
  drawManager(g, fonts, data.manager, cx, 1390, 30, w - 180, "center");
  drawSignature(g, fonts, data.site, cx, 1648, 40, "center");
  return canvas;
}
