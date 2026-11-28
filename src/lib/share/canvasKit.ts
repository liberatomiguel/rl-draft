/**
 * Share kit (v2.2): the drawing primitives every share image is cut from.
 * Browser only (canvas), no React, no dataset. The images follow DESIGN.md:
 * the floor is the cards' night blue, a board is a card's body inside a
 * hairline, the one figure that matters sits on the paper slab with its
 * orange chip, and colour comes from the cards' rarity frames, the trophies
 * and the crests. Glow belongs to rarity and to a title, never to the chrome.
 *
 * Every image is drawn from data the caller resolves (names, overalls,
 * asset URLs from `lib/assets.ts`), so a missing logo, flag or photo just
 * leaves its place empty: the image never waits on a 404 or breaks on one.
 */

export const INK = "#e9eef8";
export const SUB = "#8d9ab3";
export const FAINT = "#7c8aa3";
export const ORANGE = "#ff6a1a";
export const BLUE = "#7aa5ff";
export const GOOD = "#34d399";
export const BAD = "#f87171";
export const PAPER = "#f3efe6";
export const PAPER_INK = "#0b0d12";
export const FLOOR = "#070a11";
export const LINE = "rgba(146, 164, 196, 0.13)";
export const LINE_STRONG = "rgba(146, 164, 196, 0.26)";
export const GOLD = "#f3c969";

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export interface ShareFonts {
  /** The display face as the page resolves it (Industry / Barlow Condensed). */
  display: string;
  /** The text face (Barlow). */
  text: string;
}

/**
 * The families the page actually uses, read from the live CSS (next/font
 * names its families per build), then loaded at the weights the images use.
 * A face that fails to load leaves the canvas on the fallback in the stack.
 */
export async function resolveShareFonts(): Promise<ShareFonts> {
  const probe = document.createElement("span");
  probe.className = "display";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.textContent = "A";
  document.body.appendChild(probe);
  const display = getComputedStyle(probe).fontFamily || '"Arial Narrow", sans-serif';
  probe.remove();
  const text = getComputedStyle(document.body).fontFamily || "sans-serif";
  try {
    await Promise.all([
      document.fonts.load(`700 64px ${display}`),
      document.fonts.load(`600 32px ${display}`),
      document.fonts.load(`500 32px ${display}`),
      document.fonts.load(`400 28px ${text}`),
      document.fonts.load(`600 28px ${text}`),
    ]);
  } catch {
    /* the fallback faces draw instead */
  }
  return { display, text };
}

export function displayFont(fonts: ShareFonts, size: number, weight = 700): string {
  return `${weight} ${Math.round(size)}px ${fonts.display}`;
}

export function textFont(fonts: ShareFonts, size: number, weight = 400): string {
  return `${weight} ${Math.round(size)}px ${fonts.text}`;
}

/** Caps tracking where the browser supports it (Chrome, Edge, Safari 17+). */
export function setTracking(g: CanvasRenderingContext2D, em: number, size: number): void {
  const ctx = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(em * size).toFixed(2)}px`;
}

export function resetTracking(g: CanvasRenderingContext2D): void {
  const ctx = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** Loads an image; resolves null on any failure (the place stays empty). */
export function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Loads every distinct URL once. */
export async function loadImages(urls: readonly (string | null | undefined)[]): Promise<Map<string, HTMLImageElement>> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  const map = new Map<string, HTMLImageElement>();
  await Promise.all(
    unique.map(async (u) => {
      const img = await loadImage(u);
      if (img) map.set(u, img);
    }),
  );
  return map;
}

const FONT_WAIT_MS = 2500;

function familyName(fontFamily: string): string {
  return (fontFamily.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
}

/** The page's @font-face for `family` at `weight`, inlined as a data URL (null when it cannot be read). */
async function inlineFontFace(family: string, weight: string): Promise<string | null> {
  let src: string | null = null;
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // a cross-origin sheet
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const s = rule.style;
        if (familyName(s.getPropertyValue("font-family")) !== family) continue;
        if ((s.getPropertyValue("font-weight") || "400").trim() !== weight) continue;
        const m = /url\(["']?([^"')]+)["']?\)/.exec(s.getPropertyValue("src"));
        if (m) src = new URL(m[1], sheet.href ?? location.href).href;
      }
    }
    if (!src) return null;
    const blob = await (await fetch(src)).blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    return `@font-face{font-family:"${family}";font-weight:${weight};src:url(${data}) format("woff2");}`;
  } catch {
    return null;
  }
}

/**
 * An inline SVG element (a career crest) as an image the canvas can draw.
 *
 * An SVG drawn as an image is its own document: it cannot see the page's
 * fonts or CSS variables, so the crest's `var(--font-rajdhani)` monogram fell
 * back to the system serif. Each text's face is resolved on the live element,
 * waited for (Rajdhani is not preloaded), and embedded in the clone; if the
 * face cannot be read, the monogram falls back to a sans, never a serif.
 */
export async function svgElementToImage(svg: SVGSVGElement | null, px = 512): Promise<HTMLImageElement | null> {
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(px));
  clone.setAttribute("height", String(px));
  clone.removeAttribute("class");

  const live = Array.from(svg.querySelectorAll("text"));
  const copies = Array.from(clone.querySelectorAll("text"));
  const faces = new Map<string, { family: string; weight: string }>();
  live.forEach((t, i) => {
    const cs = getComputedStyle(t);
    const family = familyName(cs.fontFamily);
    const weight = String(cs.fontWeight || "400");
    const copy = copies[i];
    if (copy && family) copy.style.fontFamily = `"${family}", "Barlow Condensed", sans-serif`;
    if (family) faces.set(`${family}|${weight}`, { family, weight });
  });
  if (faces.size > 0) {
    const css: string[] = [];
    for (const { family, weight } of faces.values()) {
      try {
        await Promise.race([document.fonts.load(`${weight} 32px "${family}"`), new Promise((r) => setTimeout(r, FONT_WAIT_MS))]);
      } catch {
        /* the embed below still tries */
      }
      const rule = await inlineFontFace(family, weight);
      if (rule) css.push(rule);
    }
    if (css.length) {
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = css.join("");
      clone.insertBefore(style, clone.firstChild);
    }
  }
  const markup = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  return loadImage(url);
}

/** Draws `img` inside the box, contained and centred. */
export function drawContained(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1,
): void {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  g.restore();
}

/** Draws `img` covering the box (like `background-size: cover`), focus from the top. */
export function drawCover(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  focusY = 0.18,
): void {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) * focusY, dw, dh);
}

// ---------------------------------------------------------------------------
// Shapes and material
// ---------------------------------------------------------------------------

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** A CSS `linear-gradient(<deg>)` over a box, as a canvas gradient. */
export function cssGradient(
  g: CanvasRenderingContext2D,
  deg: number,
  x: number,
  y: number,
  w: number,
  h: number,
  stops: readonly string[],
  positions?: readonly number[],
): CanvasGradient {
  const a = ((deg - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const half = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
  const grad = g.createLinearGradient(cx - Math.cos(a) * half, cy - Math.sin(a) * half, cx + Math.cos(a) * half, cy + Math.sin(a) * half);
  stops.forEach((c, i) => grad.addColorStop(positions?.[i] ?? (stops.length === 1 ? 0 : i / (stops.length - 1)), c));
  return grad;
}

/** The floor every image stands on. */
export function drawFloor(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = FLOOR;
  g.fillRect(0, 0, w, h);
}

/** The card's diagonal hairlines, clipped to the current path's box. */
export function drawTexture(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 9, alpha = 0.025): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = `rgba(255,255,255,${alpha})`;
  g.lineWidth = Math.max(1, step * 0.22);
  // 125deg lines: from bottom-left to top-right.
  const slope = Math.tan((35 * Math.PI) / 180);
  const span = h / slope;
  for (let sx = x - span; sx < x + w + span; sx += step) {
    g.beginPath();
    g.moveTo(sx, y + h);
    g.lineTo(sx + span, y);
    g.stroke();
  }
  g.restore();
}

/** A board (`.panel`): the common card's body inside a hairline. */
export function drawBoard(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { radius?: number; strong?: boolean; border?: string; texture?: boolean } = {},
): void {
  const r = opts.radius ?? 18;
  roundRect(g, x, y, w, h, r);
  g.fillStyle = cssGradient(
    g,
    168,
    x,
    y,
    w,
    h,
    opts.strong ? ["#121a2c", "#0d1424", "#111a2c"] : ["#0d1322", "#0a0f1b", "#0d1320"],
    [0, 0.58, 1],
  );
  g.fill();
  if (opts.texture) {
    g.save();
    roundRect(g, x, y, w, h, r);
    g.clip();
    drawTexture(g, x, y, w, h, 12, 0.022);
    g.restore();
  }
  roundRect(g, x + 1, y + 1, w - 2, h - 2, r - 1);
  g.lineWidth = 2;
  g.strokeStyle = opts.border ?? LINE_STRONG;
  g.stroke();
}

/**
 * rc9 SHARE (#258): the image's own frame. A board cut from the cards' stock
 * (body gradient, diagonal hairlines, hairline frame); a title gets a gold
 * hairline instead of the grey one, with no light around it (the only glow
 * left on the image is the cards' own rarity finish).
 */
export function drawImageFrame(g: CanvasRenderingContext2D, w: number, h: number, inset: number, gold: boolean): void {
  drawBoard(g, inset, inset, w - inset * 2, h - inset * 2, { radius: 26, strong: true, texture: true });
  if (!gold) return;
  g.save();
  roundRect(g, inset + 1, inset + 1, w - inset * 2 - 2, h - inset * 2 - 2, 25);
  g.lineWidth = 2;
  g.strokeStyle = cssGradient(g, 165, inset, inset, w - inset * 2, h - inset * 2, ["#f3c969", "#8a6224", "#d9a943"]);
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------------------
// The profile banner (rc9 SHARE, #259)
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** WCAG relative luminance of an sRGB colour (0..255 channels). */
export function luminance(r: number, g: number, b: number): number {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

export function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function hexLuminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return luminance((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/** The lowest contrast `fg` would have over any pixel already painted in `rect` (its worst spot). */
export function worstContrast(g: CanvasRenderingContext2D, rect: Rect, fg: string): number {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.max(1, Math.min(g.canvas.width - x, Math.ceil(rect.w)));
  const h = Math.max(1, Math.min(g.canvas.height - y, Math.ceil(rect.h)));
  const data = g.getImageData(x, y, w, h).data;
  const lf = hexLuminance(fg);
  let worst = 21;
  // Every second pixel each way: the banners have no detail finer than that.
  for (let j = 0; j < h; j += 2) {
    for (let i = 0; i < w; i += 2) {
      const k = (j * w + i) * 4;
      const ratio = contrastRatio(lf, luminance(data[k], data[k + 1], data[k + 2]));
      if (ratio < worst) worst = ratio;
    }
  }
  return worst;
}

/**
 * The equipped banner as a quiet band behind the top of the image: the art
 * covers the band, fades into the stock towards the content, and is laid at
 * the highest strength (from `maxAlpha` down) at which every text box that
 * will sit over it keeps `minRatio` against its worst pixel. Text is drawn
 * after, so the measure is of the background alone.
 */
export function drawBannerBand(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  band: Rect & { radius: number },
  textOver: { rect: Rect; color: string }[],
  opts: { maxAlpha?: number; minAlpha?: number; minRatio?: number } = {},
): { alpha: number; worst: number } {
  const maxAlpha = opts.maxAlpha ?? 0.5;
  const minAlpha = opts.minAlpha ?? 0.12;
  const minRatio = opts.minRatio ?? 4.5;
  const bx = Math.floor(band.x);
  const by = Math.floor(band.y);
  const bw = Math.ceil(band.w);
  const bh = Math.ceil(band.h);
  const under = g.getImageData(bx, by, bw, bh);

  // The art, covered into the band and masked: full at the top, gone at the foot.
  const layer = document.createElement("canvas");
  layer.width = bw;
  layer.height = bh;
  const lg = layer.getContext("2d");
  if (!lg) return { alpha: 0, worst: 21 };
  lg.imageSmoothingQuality = "high";
  drawCover(lg, img, 0, 0, bw, bh, 0.5);
  lg.globalCompositeOperation = "destination-in";
  const fade = lg.createLinearGradient(0, 0, 0, bh);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.45, "rgba(0,0,0,0.75)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  lg.fillStyle = fade;
  lg.fillRect(0, 0, bw, bh);

  let alpha = maxAlpha;
  let worst = 21;
  for (; alpha >= minAlpha - 1e-6; alpha -= 0.04) {
    g.putImageData(under, bx, by);
    g.save();
    roundRect(g, band.x, band.y, band.w, band.h + band.radius, band.radius);
    g.clip();
    g.globalAlpha = alpha;
    g.drawImage(layer, bx, by);
    g.restore();
    worst = Math.min(21, ...textOver.map((t) => worstContrast(g, t.rect, t.color)));
    if (worst >= minRatio) return { alpha, worst };
  }
  // Even the faintest band fails somewhere: leave the stock plain.
  g.putImageData(under, bx, by);
  return { alpha: 0, worst: Math.min(21, ...textOver.map((t) => worstContrast(g, t.rect, t.color))) };
}

/** The ROCKET DRAFT wordmark (the header logo: upright, ink and orange). */
export function drawWordmark(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  x: number,
  baseline: number,
  size: number,
  align: "left" | "center" = "left",
): number {
  g.font = displayFont(fonts, size, 700);
  setTracking(g, 0.04, size);
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
  const a = g.measureText("ROCKET").width;
  const gap = size * 0.22;
  const b = g.measureText("DRAFT").width;
  const total = a + gap + b;
  const left = align === "center" ? x - total / 2 : x;
  g.fillStyle = INK;
  g.fillText("ROCKET", left, baseline);
  g.fillStyle = ORANGE;
  g.fillText("DRAFT", left + a + gap, baseline);
  resetTracking(g);
  return left + total;
}

/** Cuts a line to `max` px with an ellipsis. */
export function fitText(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Shrinks the font until `text` fits `max` (down to `min`); returns the size used. */
export function fitFontSize(
  g: CanvasRenderingContext2D,
  text: string,
  max: number,
  size: number,
  min: number,
  font: (s: number) => string,
): number {
  let s = size;
  g.font = font(s);
  while (s > min && g.measureText(text).width > max) {
    s -= 2;
    g.font = font(s);
  }
  return s;
}

/** Word wrap into lines no wider than `max`. */
export function wrapText(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width <= max || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A figure as the game sets it (rc9 ladder): the number in display Demi, the
 * quiet caps label under it in Medium and `--faint`. Bold is kept for the
 * image's one headline. `align` places both on `x`.
 */
export function drawFigure(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  value: string,
  label: string,
  x: number,
  baseline: number,
  size: number,
  opts: { align?: CanvasTextAlign; color?: string; labelSize?: number } = {},
): void {
  g.textAlign = opts.align ?? "left";
  g.textBaseline = "alphabetic";
  g.font = displayFont(fonts, size, 600);
  g.fillStyle = opts.color ?? INK;
  g.fillText(value, x, baseline);
  const ls = opts.labelSize ?? Math.max(15, size * 0.3);
  g.font = displayFont(fonts, ls, 500);
  setTracking(g, 0.08, ls);
  g.fillStyle = FAINT;
  g.fillText(label.toUpperCase(), x, baseline + ls * 1.9);
  resetTracking(g);
  g.textAlign = "left";
}

/**
 * The image's one headline (rc9, #258): display Bold caps at 0.03em in paper
 * white, shrunk to fit `max`. A headline that would shrink under `min` on one
 * line ("2× Major champions" in a 600px column) breaks into two lines instead,
 * growing upwards so the last line stays on `baseline`. Returns the size used.
 */
export function drawHeadline(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  text: string,
  x: number,
  baseline: number,
  size: number,
  max: number,
  opts: { align?: CanvasTextAlign; min?: number; color?: string; twoLineMax?: number } = {},
): number {
  const label = text.toUpperCase();
  const min = opts.min ?? size * 0.5;
  // Two lines are set smaller, so the block keeps the air above it.
  const twoLineMax = opts.twoLineMax ?? size;
  const font = (n: number) => {
    setTracking(g, 0.03, n);
    return displayFont(fonts, n, 700);
  };
  let s = fitFontSize(g, label, max, size, min, font);
  let lines = [label];
  if (g.measureText(label).width > max && label.includes(" ")) {
    for (let n = twoLineMax; n >= min * 0.8; n -= 2) {
      g.font = font(n);
      const wrapped = wrapText(g, label, max);
      if (wrapped.length <= 2 && wrapped.every((l) => g.measureText(l).width <= max)) {
        s = n;
        lines = wrapped;
        break;
      }
    }
  }
  g.font = font(s);
  g.textAlign = opts.align ?? "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = opts.color ?? PAPER;
  lines.forEach((line, i) => g.fillText(fitText(g, line, max), x, baseline - (lines.length - 1 - i) * s * 1.04));
  resetTracking(g);
  g.textAlign = "left";
  return s;
}

/** A caps label (meta line): display Medium at open tracking. Returns its width. */
export function drawLabel(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  text: string,
  x: number,
  baseline: number,
  size: number,
  max: number,
  opts: { align?: CanvasTextAlign; color?: string } = {},
): number {
  g.font = displayFont(fonts, size, 500);
  setTracking(g, 0.08, size);
  g.textAlign = opts.align ?? "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = opts.color ?? SUB;
  const t = fitText(g, text.toUpperCase(), max);
  g.fillText(t, x, baseline);
  const width = g.measureText(t).width;
  resetTracking(g);
  g.textAlign = "left";
  return width;
}

/** Sentences in the text face, wrapped to `max`, at most `lines` lines. Returns the last baseline. */
export function drawSentence(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  text: string,
  x: number,
  baseline: number,
  size: number,
  max: number,
  opts: { align?: CanvasTextAlign; color?: string; lines?: number; lineHeight?: number } = {},
): number {
  g.font = textFont(fonts, size, 400);
  g.textAlign = opts.align ?? "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = opts.color ?? SUB;
  const lh = opts.lineHeight ?? size * 1.38;
  const lines = wrapText(g, text, max).slice(0, opts.lines ?? 2);
  lines.forEach((line, i) => g.fillText(line, x, baseline + i * lh));
  g.textAlign = "left";
  return baseline + (lines.length - 1) * lh;
}

/** The card's height for a width (the game's card proportion). */
export const CARD_RATIO = 4.3 / 3;

/**
 * The team as the game's cards, straight, side by side, none behind another
 * (rc9 SHARE, #258 revised after Miguel's 27/11 review). `perRow` cards to a
 * row, rows stacked; the block is centred in `box` and no card grows past
 * `maxW`. Returns the block's bottom edge.
 */
export function drawCardRows(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  cards: ShareCardFace[],
  images: Map<string, HTMLImageElement>,
  box: Rect,
  opts: { perRow?: number; gap?: number; maxW?: number } = {},
): number {
  if (cards.length === 0) return box.y;
  const perRow = Math.min(opts.perRow ?? cards.length, cards.length);
  const rows = Math.ceil(cards.length / perRow);
  const gap = opts.gap ?? 16;
  let cw = Math.min(opts.maxW ?? Infinity, (box.w - gap * (perRow - 1)) / perRow);
  if (cw * CARD_RATIO * rows + gap * (rows - 1) > box.h) cw = (box.h - gap * (rows - 1)) / rows / CARD_RATIO;
  const ch = cw * CARD_RATIO;
  const blockH = ch * rows + gap * (rows - 1);
  const y0 = box.y + (box.h - blockH) / 2;
  for (let r = 0; r < rows; r++) {
    const row = cards.slice(r * perRow, r * perRow + perRow);
    const rowW = cw * row.length + gap * (row.length - 1);
    const x0 = box.x + (box.w - rowW) / 2;
    row.forEach((face, i) => drawGameCard(g, fonts, face, images, x0 + i * (cw + gap), y0 + r * (ch + gap), cw, ch));
  }
  return y0 + blockH;
}

/**
 * The result as a title-sized line (not a poster): display Demi caps at open
 * tracking, fitted to `max`. Returns the width drawn.
 */
export function drawTitleLine(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  text: string,
  x: number,
  baseline: number,
  size: number,
  max: number,
  opts: { align?: CanvasTextAlign; color?: string; min?: number } = {},
): number {
  const label = text.toUpperCase();
  const font = (n: number) => {
    setTracking(g, 0.05, n);
    return displayFont(fonts, n, 600);
  };
  const s = fitFontSize(g, label, max, size, opts.min ?? size * 0.7, font);
  g.font = font(s);
  g.textAlign = opts.align ?? "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = opts.color ?? INK;
  const t = fitText(g, label, max);
  g.fillText(t, x, baseline);
  const width = g.measureText(t).width;
  resetTracking(g);
  g.textAlign = "left";
  return width;
}

/** One stage of the road: its label, then a square per series (green won, red lost). */
export interface RoadStageMarks {
  label: string;
  series: boolean[];
}

/** The road through the bracket as quiet squares. `align` places the line on `x`. Returns its width. */
export function drawRoad(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  road: RoadStageMarks[],
  x: number,
  y: number,
  size: number,
  align: "left" | "center" | "right" = "left",
): number {
  const stages = road.filter((st) => st.series.length > 0);
  if (stages.length === 0) return 0;
  const gap = size * 0.32;
  const stageGap = size * 1.3;
  const labelSize = Math.max(11, size * 0.7);
  const labelW = (t: string) => {
    g.font = displayFont(fonts, labelSize, 500);
    setTracking(g, 0.08, labelSize);
    const wd = g.measureText(t.toUpperCase()).width;
    resetTracking(g);
    return wd;
  };
  const widths = stages.map((st) => labelW(st.label) + size * 0.55 + st.series.length * (size + gap) - gap);
  const total = widths.reduce((a, b) => a + b, 0) + stageGap * (stages.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  for (const st of stages) {
    g.font = displayFont(fonts, labelSize, 500);
    setTracking(g, 0.08, labelSize);
    g.fillStyle = FAINT;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(st.label.toUpperCase(), cx, y + size / 2 + 1);
    cx += g.measureText(st.label.toUpperCase()).width + size * 0.55;
    resetTracking(g);
    for (const won of st.series) {
      roundRect(g, cx, y, size, size, Math.max(2, size * 0.18));
      g.fillStyle = won ? GOOD : BAD;
      g.globalAlpha = won ? 0.9 : 0.75;
      g.fill();
      g.globalAlpha = 1;
      cx += size + gap;
    }
    cx += stageGap - gap;
  }
  g.textBaseline = "alphabetic";
  return total;
}

/** A hairline, vertical or horizontal. */
export function drawHairline(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, strong = false): void {
  g.strokeStyle = strong ? LINE_STRONG : LINE;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type FrameKey =
  | "common"
  | "silver"
  | "gold"
  | "blue"
  | "hidden"
  | "rare"
  | "epic"
  | "mythic"
  | "legendary"
  | "creator"
  | "community"
  | "national"
  | "wings";

interface FrameSpec {
  body: string[];
  border: string[];
  /** The rarity's halo (specials and blue only). */
  glow?: string;
  /** The overall's colour. */
  ovr: string;
  /** The special title's accent. */
  accent?: string;
}

/** The frames of `globals.css` (`.card-<rarity>`), body then border. */
export const FRAMES: Record<FrameKey, FrameSpec> = {
  common: { body: ["#0d1322", "#0a0f1b", "#0d1320"], border: ["#39435c", "#232b3f", "#39435c"], ovr: INK },
  silver: { body: ["#131c2e", "#0b1322", "#101a2c"], border: ["#aeb9c9", "#5d6b80", "#8d9ab3"], ovr: INK },
  gold: { body: ["#181a26", "#100f1c", "#1a1626"], border: ["#f3c969", "#8a6224", "#d9a943"], ovr: INK },
  blue: { body: ["#0e1a33", "#0a1326", "#0e1c38"], border: ["#67c5fb", "#1d4ed8", "#38bdf8"], glow: "rgba(56,189,248,0.32)", ovr: "#67c5fb" },
  hidden: { body: ["#0a0f1c", "#0c1220", "#0a0f1c"], border: ["#2c3550", "#161c2e", "#2c3550"], ovr: FAINT },
  rare: { body: ["#0b1230", "#06091c", "#0d1338"], border: ["#4c75e6", "#6f63b6", "#28238d"], glow: "rgba(76,117,230,0.3)", ovr: "#8ab9ff", accent: "#a5b4fc" },
  epic: { body: ["#0d1430", "#080a20", "#16103a"], border: ["#3b82f6", "#7c3aed", "#b15cf7"], glow: "rgba(124,58,237,0.42)", ovr: "#d8b4fe", accent: "#5eead4" },
  mythic: { body: ["#250d12", "#1a080c", "#2c0f14"], border: ["#f87171", "#b91c1c", "#ef4444"], glow: "rgba(239,68,68,0.42)", ovr: "#f23d3d", accent: "#fca5a5" },
  legendary: {
    body: ["#20180a", "#140e06", "#261c0a"],
    border: ["#ffffff", "#fde68a", "#ffffff", "#f6c652", "#fffaf0", "#f0b429", "#ffffff"],
    glow: "rgba(255,242,200,0.5)",
    ovr: "#fff3c4",
    accent: "#fde68a",
  },
  creator: { body: ["#2a0d22", "#190813", "#2c1030"], border: ["#fbcfe8", "#ec4899", "#a855f7", "#f472b6"], glow: "rgba(236,72,153,0.42)", ovr: "#f472b6", accent: "#fbcfe8" },
  community: { body: ["#06231b", "#04140f", "#07241f"], border: ["#6ee7b7", "#10b981", "#14b8a6", "#34d399"], glow: "rgba(16,185,129,0.42)", ovr: "#6ee7b7", accent: "#6ee7b7" },
  national: { body: ["#241a05", "#150f03", "#2b2006"], border: ["#fef08a", "#eab308", "#854d0e", "#facc15", "#fef9c3"], glow: "rgba(234,179,8,0.45)", ovr: "#fde047", accent: "#fef08a" },
  wings: { body: ["#2a1606", "#190d04", "#2c1a08"], border: ["#fed7aa", "#fb923c", "#f97316", "#fdba74"], glow: "rgba(249,115,22,0.42)", ovr: "#fdba74", accent: "#fdba74" },
};

export type RoleKind = "player" | "coach" | "sub" | "org";

const ROLE_TAG: Record<RoleKind, { border: string; fill: string; text: string }> = {
  player: { border: "rgba(96,165,250,0.45)", fill: "rgba(96,165,250,0.12)", text: "#bfdbfe" },
  coach: { border: "rgba(251,191,36,0.45)", fill: "rgba(251,191,36,0.12)", text: "#fde68a" },
  sub: { border: "rgba(52,211,153,0.45)", fill: "rgba(52,211,153,0.12)", text: "#a7f3d0" },
  org: { border: LINE_STRONG, fill: "rgba(255,255,255,0.05)", text: SUB },
};

/** A card as the image draws it: everything resolved, nothing looked up. */
export interface ShareCardFace {
  frame: FrameKey;
  /** "87", "+3", "-" or "??". */
  value: string;
  name: string;
  /** Special title (rarity accent) or the org · season line. */
  line: string | null;
  lineIsTitle: boolean;
  role: RoleKind;
  roleLabel: string;
  /** Country flag URL, or a short code drawn as a tag when there is no flag. */
  flagUrl: string | null;
  flagCode: string | null;
  /** The crest at the card's centre (org logo, or the career crest). */
  logoUrl: string | null;
  /** A special's photo, covering the card. */
  photoUrl: string | null;
}

/**
 * One card, drawn the way GameCard shows it: the frame in its rarity, the
 * overall top left over the role tag, the flag top right, the crest on the
 * card's texture (or the special's photo over the whole face) and the name
 * plate at the foot.
 */
export function drawGameCard(
  g: CanvasRenderingContext2D,
  fonts: ShareFonts,
  face: ShareCardFace,
  images: Map<string, HTMLImageElement>,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const s = w / 176;
  const r = 14 * s;
  const spec = FRAMES[face.frame];
  const bw = Math.max(2, 2.2 * s);
  const photo = face.photoUrl ? images.get(face.photoUrl) : undefined;

  // Halo (rarity only).
  if (spec.glow) {
    g.save();
    g.shadowColor = spec.glow;
    g.shadowBlur = 34 * s;
    roundRect(g, x, y, w, h, r);
    g.fillStyle = spec.border[0];
    g.fill();
    g.restore();
  }
  // Border, then the body inside it.
  roundRect(g, x, y, w, h, r);
  g.fillStyle = cssGradient(g, face.frame === "legendary" ? 110 : 165, x, y, w, h, spec.border);
  g.fill();
  const ix = x + bw;
  const iy = y + bw;
  const iw = w - bw * 2;
  const ih = h - bw * 2;
  const ir = r - bw * 0.7;
  g.save();
  roundRect(g, ix, iy, iw, ih, ir);
  g.clip();
  g.fillStyle = cssGradient(g, 168, ix, iy, iw, ih, spec.body, [0, 0.58, 1]);
  g.fillRect(ix, iy, iw, ih);
  if (face.frame === "hidden") drawTexture(g, ix, iy, iw, ih, 14 * s, 0.03);
  if (photo) {
    drawCover(g, photo, ix, iy, iw, ih);
    // The photo's foot darkens under the name plate (`.special-photo::after`).
    const shade = g.createLinearGradient(0, iy + ih * 0.38, 0, iy + ih);
    shade.addColorStop(0, "rgba(5,7,13,0)");
    shade.addColorStop(0.55, "rgba(5,7,13,0.62)");
    shade.addColorStop(1, "rgba(5,7,13,0.94)");
    g.fillStyle = shade;
    g.fillRect(ix, iy, iw, ih);
    const top = g.createLinearGradient(0, iy, 0, iy + ih * 0.3);
    top.addColorStop(0, "rgba(5,7,13,0.55)");
    top.addColorStop(1, "rgba(5,7,13,0)");
    g.fillStyle = top;
    g.fillRect(ix, iy, iw, ih * 0.3);
    // The holo's still: one soft diagonal of the rarity's light.
    const holo = g.createLinearGradient(ix, iy, ix + iw, iy + ih);
    holo.addColorStop(0, "rgba(255,255,255,0)");
    holo.addColorStop(0.42, "rgba(255,255,255,0)");
    holo.addColorStop(0.5, "rgba(255,255,255,0.10)");
    holo.addColorStop(0.58, "rgba(255,255,255,0)");
    holo.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = holo;
    g.fillRect(ix, iy, iw, ih);
  }
  // Top sheen on every card (`.card-frame::before`).
  const sheen = g.createLinearGradient(0, iy, 0, iy + ih * 0.38);
  sheen.addColorStop(0, "rgba(255,255,255,0.07)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sheen;
  g.fillRect(ix, iy, iw, ih * 0.38);
  g.restore();

  const pad = 12 * s;
  // Centre: the crest on the card's texture (base cards only).
  if (!photo) {
    const tx = ix + pad * 0.55;
    const ty = iy + 64 * s;
    const tw = iw - pad * 1.1;
    const th = ih - 64 * s - 60 * s;
    if (th > 20 * s) {
      g.save();
      roundRect(g, tx, ty, tw, th, 8 * s);
      g.clip();
      drawTexture(g, tx, ty, tw, th, 9 * s, 0.035);
      g.restore();
      const logo = face.logoUrl ? images.get(face.logoUrl) : undefined;
      if (logo) {
        const box = Math.min(tw * 0.62, th * 0.78);
        drawContained(g, logo, tx + (tw - box) / 2, ty + (th - box) / 2, box, box);
      } else {
        g.font = displayFont(fonts, 40 * s, 700);
        g.fillStyle = "rgba(255,255,255,0.12)";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("?", tx + tw / 2, ty + th / 2);
        g.textBaseline = "alphabetic";
        g.textAlign = "left";
      }
    }
  }

  // Top row: the overall and the role tag, the flag.
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
  const valueSize = 40 * s;
  g.font = displayFont(fonts, valueSize, 700);
  g.save();
  if (photo) {
    g.shadowColor = "rgba(0,0,0,0.9)";
    g.shadowBlur = 6 * s;
    g.shadowOffsetY = 1 * s;
  }
  if (face.frame === "legendary" || face.frame === "national") {
    g.fillStyle = cssGradient(
      g,
      165,
      ix + pad,
      iy + pad,
      valueSize * 1.2,
      valueSize,
      face.frame === "legendary" ? ["#fffefa", "#fde68a", "#f6c652", "#fffaf0"] : ["#fef9c3", "#fde047", "#eab308", "#fef08a"],
    );
  } else {
    g.fillStyle = face.role === "org" ? (face.value === "-" || face.value === "??" ? FAINT : "#ff8a3d") : spec.ovr;
  }
  g.fillText(face.value, ix + pad, iy + pad + valueSize * 0.82);
  g.restore();

  // Role tag.
  const tagSize = 10.5 * s;
  g.font = displayFont(fonts, tagSize, 600);
  setTracking(g, 0.12, tagSize);
  const tagText = face.roleLabel.toUpperCase();
  const tagW = g.measureText(tagText).width + 9 * s;
  const tagH = tagSize * 1.5;
  const tagY = iy + pad + valueSize * 0.98;
  const tag = ROLE_TAG[face.role];
  roundRect(g, ix + pad, tagY, tagW, tagH, 3 * s);
  g.fillStyle = photo ? "rgba(5,7,13,0.55)" : tag.fill;
  g.fill();
  g.lineWidth = Math.max(1, 1 * s);
  g.strokeStyle = tag.border;
  g.stroke();
  g.fillStyle = tag.text;
  g.fillText(tagText, ix + pad + 4.5 * s, tagY + tagH * 0.74);
  resetTracking(g);

  // Flag (or a region code tag).
  const flag = face.flagUrl ? images.get(face.flagUrl) : undefined;
  if (flag) {
    const fw = 30 * s;
    const fh = 20 * s;
    const fx = ix + iw - pad - fw;
    const fy = iy + pad + 2 * s;
    g.save();
    roundRect(g, fx, fy, fw, fh, 3 * s);
    g.clip();
    drawCover(g, flag, fx, fy, fw, fh, 0.5);
    g.restore();
    roundRect(g, fx, fy, fw, fh, 3 * s);
    g.lineWidth = 1;
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.stroke();
  } else if (face.flagCode) {
    const cs = 12 * s;
    g.font = displayFont(fonts, cs, 700);
    setTracking(g, 0.06, cs);
    const code = face.flagCode.toUpperCase();
    const cw = g.measureText(code).width + 10 * s;
    const ch = cs * 1.6;
    const cx = ix + iw - pad - cw;
    const cy = iy + pad + 2 * s;
    roundRect(g, cx, cy, cw, ch, 3 * s);
    g.fillStyle = "rgba(255,255,255,0.06)";
    g.fill();
    g.strokeStyle = LINE_STRONG;
    g.stroke();
    g.fillStyle = SUB;
    g.fillText(code, cx + 5 * s, cy + ch * 0.74);
    resetTracking(g);
  }

  // Name plate.
  const nameSize = 17 * s;
  // The card's name plate is `font-bold` in GameCard, which the rc9 ladder sets in Demi.
  g.font = displayFont(fonts, nameSize, 600);
  setTracking(g, 0.03, nameSize);
  g.fillStyle = photo ? "#ffffff" : INK;
  const nameY = iy + ih - pad - (face.line ? 17 * s : 4 * s);
  g.fillText(fitText(g, face.name.toUpperCase(), iw - pad * 2), ix + pad, nameY);
  resetTracking(g);
  if (face.line) {
    const ls = 11.5 * s;
    g.font = face.lineIsTitle ? displayFont(fonts, ls, 600) : textFont(fonts, ls, 400);
    if (face.lineIsTitle) setTracking(g, 0.06, ls);
    g.fillStyle = face.lineIsTitle ? (spec.accent ?? "#ff8a3d") : photo ? "rgba(255,255,255,0.65)" : SUB;
    const line = face.lineIsTitle ? face.line.toUpperCase() : face.line;
    g.fillText(fitText(g, line, iw - pad * 2), ix + pad, iy + ih - pad);
    resetTracking(g);
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas 2d unavailable");
  g.imageSmoothingQuality = "high";
  return { canvas, g };
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
