/**
 * Share kit (v2.2): the invitation's image, post and story. No dataset (the
 * Home is on the shared path): the game's wordmark, the pitch on the slab and
 * the two modes as the Home shows them, the two solids (draft on orange,
 * career on blue) finished like printed card stock.
 */

import {
  INK,
  ORANGE,
  PAPER_INK,
  SUB,
  cssGradient,
  displayFont,
  drawBoard,
  drawFigure,
  drawFloor,
  drawSlab,
  fitFontSize,
  makeCanvas,
  resetTracking,
  roundRect,
  setTracking,
  textFont,
  wrapText,
  type ShareFonts,
} from "./canvasKit";
import { SHARE_SIZES, type ShareFormat } from "./runImage";

export interface InviteImageData {
  headline: string;
  modes: { name: string; desc: string; cta: string; tone: "orange" | "blue" }[];
  free: string;
  /** A figure or two about the game (special cards). */
  figures: { value: string; label: string }[];
}

const SOLIDS = {
  orange: { stops: ["#ff7d33", "#ff6a1a", "#ee590a"], line: "rgba(11,13,18,0.055)", ink: PAPER_INK, sub: "rgba(11,13,18,0.72)" },
  blue: { stops: ["#2a66ff", "#2158ee", "#1a48d2"], line: "rgba(255,255,255,0.045)", ink: "#ffffff", sub: "rgba(255,255,255,0.82)" },
} as const;

/** A solid (`.solid`): the side's colour finished like a card (sheen, diagonal hairlines). */
function drawSolid(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  mode: InviteImageData["modes"][number],
  x: number,
  y: number,
  w: number,
  h: number,
  titleSize: number,
): void {
  const tone = SOLIDS[mode.tone];
  const r = 14 * (titleSize / 40);
  g.save();
  roundRect(g, x, y, w, h, r);
  g.clip();
  g.fillStyle = cssGradient(g, 168, x, y, w, h, tone.stops, [0, 0.52, 1]);
  g.fillRect(x, y, w, h);
  const sheen = g.createLinearGradient(0, y, 0, y + h * 0.45);
  sheen.addColorStop(0, "rgba(255,255,255,0.17)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sheen;
  g.fillRect(x, y, w, h * 0.45);
  g.strokeStyle = tone.line;
  g.lineWidth = Math.max(1.5, titleSize * 0.05);
  const slope = Math.tan((35 * Math.PI) / 180);
  const span = h / slope;
  for (let sx = x - span; sx < x + w + span; sx += titleSize * 0.24) {
    g.beginPath();
    g.moveTo(sx, y + h);
    g.lineTo(sx + span, y);
    g.stroke();
  }
  g.restore();

  const pad = titleSize * 0.6;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  const name = mode.name.toUpperCase();
  const size = fitFontSize(g, name, w - pad * 2, titleSize, titleSize * 0.6, (s) => displayFont(fonts, s, 700));
  g.font = displayFont(fonts, size, 700);
  setTracking(g, 0.02, size);
  g.fillStyle = tone.ink;
  g.fillText(name, x + pad, y + pad + size * 0.8);
  resetTracking(g);
  const ds = titleSize * 0.42;
  g.font = textFont(fonts, ds, 600);
  g.fillStyle = tone.sub;
  wrapText(g, mode.desc, w - pad * 2)
    .slice(0, 2)
    .forEach((line, i) => g.fillText(line, x + pad, y + pad + size * 0.8 + ds * 1.7 + i * ds * 1.3));

  // The action, inverse on the solid (dark on orange, paper on blue), as on the Home.
  const bs = titleSize * 0.36;
  g.font = displayFont(fonts, bs, 700);
  setTracking(g, 0.04, bs);
  const label = mode.cta.toUpperCase();
  const bw = g.measureText(label).width + bs * 2.4;
  const bh = bs * 2.5;
  const by = y + h - pad - bh;
  roundRect(g, x + pad, by, bw, bh, 7 * (titleSize / 40));
  g.fillStyle = mode.tone === "orange" ? PAPER_INK : "#f3efe6";
  g.fill();
  g.fillStyle = mode.tone === "orange" ? "#f3efe6" : PAPER_INK;
  g.fillText(label, x + pad + bs * 1.2, by + bh * 0.66);
  resetTracking(g);
}

/** The Home wordmark (the one italic in the game), fitted to `max`. Returns its baseline size. */
function drawHomeWordmark(g: CanvasRenderingContext2D, fonts: ShareFonts, x: number, baseline: number, size: number, max: number, align: "left" | "center"): void {
  let s = size;
  const font = (n: number) => `italic 800 ${Math.round(n)}px ${fonts.display}`;
  g.font = font(s);
  const gap = () => s * 0.1;
  const width = () => g.measureText("ROCKET").width + gap() + g.measureText("DRAFT").width;
  while (s > 24 && width() > max) {
    s -= 2;
    g.font = font(s);
  }
  const a = g.measureText("ROCKET").width;
  const left = align === "center" ? x - width() / 2 : x;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = INK;
  g.fillText("ROCKET", left, baseline);
  g.fillStyle = ORANGE;
  g.fillText("DRAFT", left + a + gap(), baseline);
}

export async function renderInviteImage(data: InviteImageData, format: ShareFormat, fonts: ShareFonts): Promise<HTMLCanvasElement> {
  const { w, h } = SHARE_SIZES[format];
  const { canvas, g } = makeCanvas(w, h);
  drawFloor(g, w, h);

  if (format === "post") {
    drawBoard(g, 22, 22, w - 44, h - 44, { radius: 26, strong: true, texture: true });
    const left = 70;
    drawHomeWordmark(g, fonts, left, 158, 84, 500, "left");
    drawSlab(g, fonts, data.headline, left, 262, 48, { maxWidth: 500 });
    data.figures.slice(0, 2).forEach((f, i) => drawFigure(g, fonts, f.value, f.label, left + i * 220, 410, 64));
    g.font = displayFont(fonts, 22, 700);
    setTracking(g, 0.05, 22);
    g.fillStyle = ORANGE;
    g.fillText("ROCKETDRAFT.APP", left, 520);
    resetTracking(g);
    g.font = textFont(fonts, 21, 400);
    g.fillStyle = SUB;
    g.fillText(data.free, left, 556);
    const sx = 650;
    const sw = 1150 - sx;
    drawSolid(g, fonts, data.modes[0], sx, 70, sw, 235, 44);
    drawSolid(g, fonts, data.modes[1], sx, 325, sw, 235, 44);
    return canvas;
  }

  drawBoard(g, 34, 34, w - 68, h - 68, { radius: 26, strong: true, texture: true });
  const cx = w / 2;
  drawHomeWordmark(g, fonts, cx, 400, 132, w - 200, "center");
  drawSlab(g, fonts, data.headline, cx, 540, 72, { align: "center", maxWidth: w - 280 });
  drawSolid(g, fonts, data.modes[0], 90, 640, w - 180, 380, 66);
  drawSolid(g, fonts, data.modes[1], 90, 1050, w - 180, 380, 66);
  const figs = data.figures.slice(0, 2);
  const span = (w - 200) / Math.max(1, figs.length);
  figs.forEach((f, i) => drawFigure(g, fonts, f.value, f.label, 100 + span * i + span / 2, 1560, 84, { align: "center" }));
  g.textAlign = "center";
  g.font = displayFont(fonts, 44, 700);
  setTracking(g, 0.05, 44);
  g.fillStyle = ORANGE;
  g.fillText("ROCKETDRAFT.APP", cx, 1716);
  resetTracking(g);
  g.font = textFont(fonts, 30, 400);
  g.fillStyle = SUB;
  g.fillText(data.free, cx, 1764);
  g.textAlign = "left";
  return canvas;
}
