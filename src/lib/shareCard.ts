/**
 * Share card generator — renders a 1200×630 result image on a canvas
 * (no dependencies) for preview / download / native share. v1.3.1 adds the
 * drafted cards as a row of rarity-framed mini-cards, and helpers for the
 * preview modal (data URL, blob, social message).
 */

import type { Placement } from "@/engine/types";

export interface ShareMiniCard {
  name: string;
  /** Overall as a string, or the org buff ("++") for the org card. */
  value: string;
  /** Frame colour (rarity). */
  color: string;
  isSpecial: boolean;
  /** Short role tag shown under the card (P1 / COACH / ORG …). */
  role: string;
}

export interface ShareCardData {
  placementLabel: string;
  placement: Placement;
  modeLabel: string;
  difficultyLabel: string;
  hiddenOverall: boolean;
  swissRecord: string | null;
  teamOverall: number;
  chemistryTier: string;
  /** The full drafted roster as mini-cards (players, coach, sub, org). */
  cards: ShareMiniCard[];
  xp: number;
  date: string;
}

const W = 1200;
const H = 630;

/** Rarity → frame colour (mirrors the in-game palette). */
export function shareCardColor(opts: {
  isSpecial: boolean;
  specialRarity?: string;
  overall?: number;
  isOrg?: boolean;
  buffLevel?: string;
}): string {
  if (opts.isSpecial) {
    switch (opts.specialRarity) {
      case "legendary":
        return "#fde68a";
      case "mythic":
        return "#f87171";
      case "epic":
        return "#a78bfa";
      case "creator":
        return "#f472b6";
      default:
        return "#60a5fa"; // rare
    }
  }
  if (opts.isOrg) {
    return opts.buffLevel === "+++"
      ? "#67e8f9"
      : opts.buffLevel === "++"
        ? "#fcd34d"
        : opts.buffLevel === "+"
          ? "#cbd5e1"
          : "#5b6880";
  }
  const o = opts.overall ?? 0;
  if (o >= 90) return "#38bdf8";
  if (o >= 80) return "#fcd34d";
  if (o >= 70) return "#cbd5e1";
  return "#5b6880";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderShareCard(data: ShareCardData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const champion = data.placement === "champion";

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#070b15");
  bg.addColorStop(1, "#0a101d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glows
  const glow1 = ctx.createRadialGradient(140, 40, 0, 140, 40, 620);
  glow1.addColorStop(0, "rgba(59,130,246,0.22)");
  glow1.addColorStop(1, "transparent");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(W - 120, 80, 0, W - 120, 80, 560);
  glow2.addColorStop(0, champion ? "rgba(249,115,22,0.3)" : "rgba(249,115,22,0.16)");
  glow2.addColorStop(1, "transparent");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  const display = (size: number, weight = 700) =>
    `${weight} ${size}px Rajdhani, "Segoe UI", sans-serif`;

  // Wordmark
  ctx.textBaseline = "alphabetic";
  ctx.font = display(32);
  ctx.fillStyle = "#e9eef8";
  ctx.fillText("ROCKET", 64, 76);
  const wm = ctx.measureText("ROCKET").width;
  ctx.fillStyle = "#f97316";
  ctx.fillText("DRAFT", 64 + wm + 6, 76);

  // Meta line
  ctx.font = display(19, 600);
  ctx.fillStyle = "#8d9ab3";
  const meta = [data.modeLabel, data.difficultyLabel, data.hiddenOverall ? "Hidden OVR" : null, data.date]
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillText(meta.toUpperCase(), 64, 110);

  // Placement
  ctx.font = display(88);
  if (champion) {
    const grad = ctx.createLinearGradient(0, 140, 0, 240);
    grad.addColorStop(0, "#fde68a");
    grad.addColorStop(1, "#f97316");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = "#e9eef8";
  }
  ctx.fillText(data.placementLabel.toUpperCase(), 60, 222);

  // Stats chips
  ctx.font = display(23, 600);
  ctx.fillStyle = "#60a5fa";
  const chips = [
    data.swissRecord ? `SWISS ${data.swissRecord}` : null,
    `TEAM OVR ${data.teamOverall}`,
    `${data.chemistryTier.toUpperCase()} CHEMISTRY`,
    `+${data.xp} XP`,
  ].filter(Boolean) as string[];
  ctx.fillText(chips.join("    "), 64, 272);

  // --- Drafted cards: a row of rarity-framed mini-cards (v1.3.1) ---
  const cards = data.cards.slice(0, 6);
  const gap = 18;
  const cw = Math.min(168, (W - 128 - gap * (cards.length - 1)) / Math.max(1, cards.length));
  const ch = 196;
  const top = 320;
  const totalW = cw * cards.length + gap * (cards.length - 1);
  let x = (W - totalW) / 2;
  for (const c of cards) {
    // Card body
    const cg = ctx.createLinearGradient(x, top, x, top + ch);
    cg.addColorStop(0, "rgba(255,255,255,0.05)");
    cg.addColorStop(1, "rgba(255,255,255,0.015)");
    ctx.fillStyle = cg;
    roundRect(ctx, x, top, cw, ch, 14);
    ctx.fill();
    // Frame
    ctx.strokeStyle = c.color;
    ctx.lineWidth = c.isSpecial ? 3 : 2;
    roundRect(ctx, x, top, cw, ch, 14);
    ctx.stroke();
    if (c.isSpecial) {
      ctx.save();
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();
    }
    // Value (overall / buff)
    ctx.font = display(46);
    ctx.fillStyle = c.color;
    ctx.textAlign = "left";
    ctx.fillText(c.value, x + 16, top + 56);
    // Star for specials
    if (c.isSpecial) {
      ctx.font = display(22);
      ctx.fillStyle = "#f59e0b";
      ctx.fillText("★", x + cw - 30, top + 34);
    }
    // Name (centered, may wrap to fit)
    ctx.font = display(22, 700);
    ctx.fillStyle = "#e9eef8";
    ctx.textAlign = "center";
    let name = c.name.toUpperCase();
    while (ctx.measureText(name).width > cw - 20 && name.length > 4) name = name.slice(0, -1);
    ctx.fillText(name, x + cw / 2, top + ch - 42);
    // Role tag
    ctx.font = display(13, 600);
    ctx.fillStyle = "#8d9ab3";
    ctx.fillText(c.role.toUpperCase(), x + cw / 2, top + ch - 18);
    ctx.textAlign = "left";
    x += cw + gap;
  }
  ctx.textAlign = "left";

  // Footer
  ctx.font = display(15, 600);
  ctx.fillStyle = "#5b6880";
  ctx.fillText("ROCKETDRAFT.APP — FAN-MADE RL ESPORTS HISTORY DRAFT", 64, H - 34);

  // Border
  ctx.strokeStyle = champion ? "rgba(249,115,22,0.55)" : "rgba(146,164,196,0.3)";
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, W - 36, H - 36, 16);
  ctx.stroke();

  return canvas;
}

async function ensureFont(): Promise<void> {
  try {
    await document.fonts.load('700 88px Rajdhani');
  } catch {
    /* fall back to system fonts */
  }
}

/** Render to a data URL (for the preview <img>). */
export async function shareCardDataUrl(data: ShareCardData): Promise<string> {
  await ensureFont();
  return renderShareCard(data).toDataURL("image/png");
}

/** Render to a PNG Blob (for native share / download). */
export async function shareCardBlob(data: ShareCardData): Promise<Blob> {
  await ensureFont();
  const canvas = renderShareCard(data);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
}

export async function downloadShareCard(data: ShareCardData): Promise<void> {
  const blob = await shareCardBlob(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rocket-draft-${data.placement}-${data.date}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
