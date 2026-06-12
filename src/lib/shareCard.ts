/**
 * Share card generator — renders a 1200×630 result image on a canvas
 * (no dependencies) for download / native share.
 */

import type { Placement } from "@/engine/types";

export interface ShareCardData {
  placementLabel: string;
  placement: Placement;
  modeLabel: string;
  difficultyLabel: string;
  hiddenOverall: boolean;
  swissRecord: string | null;
  teamOverall: number;
  chemistryTier: string;
  players: { name: string; overall: number }[];
  staff: string[];
  xp: number;
  date: string;
}

const W = 1200;
const H = 630;

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
  const glow2 = ctx.createRadialGradient(W - 120, H - 60, 0, W - 120, H - 60, 560);
  glow2.addColorStop(0, champion ? "rgba(249,115,22,0.3)" : "rgba(249,115,22,0.16)");
  glow2.addColorStop(1, "transparent");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  const display = (size: number, weight = 700) =>
    `${weight} ${size}px Rajdhani, "Segoe UI", sans-serif`;

  // Wordmark
  ctx.font = display(34);
  ctx.fillStyle = "#e9eef8";
  ctx.fillText("ROCKET", 64, 84);
  const w = ctx.measureText("ROCKET").width;
  ctx.fillStyle = "#f97316";
  ctx.fillText("DRAFT", 64 + w + 6, 84);

  // Meta line
  ctx.font = display(20, 600);
  ctx.fillStyle = "#8d9ab3";
  const meta = [
    data.modeLabel,
    data.difficultyLabel,
    data.hiddenOverall ? "Hidden OVR" : null,
    data.date,
  ]
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillText(meta.toUpperCase(), 64, 122);

  // Placement
  ctx.font = display(96);
  if (champion) {
    const grad = ctx.createLinearGradient(0, 160, 0, 270);
    grad.addColorStop(0, "#fde68a");
    grad.addColorStop(1, "#f97316");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = "#e9eef8";
  }
  ctx.fillText(data.placementLabel.toUpperCase(), 60, 252);

  // Stats chips
  ctx.font = display(24, 600);
  ctx.fillStyle = "#60a5fa";
  const chips = [
    data.swissRecord ? `SWISS ${data.swissRecord}` : null,
    `TEAM OVR ${data.teamOverall}`,
    `${data.chemistryTier.toUpperCase()} CHEMISTRY`,
    `+${data.xp} XP`,
  ].filter(Boolean) as string[];
  ctx.fillText(chips.join("    "), 64, 308);

  // Divider
  ctx.fillStyle = "rgba(146,164,196,0.25)";
  ctx.fillRect(64, 344, W - 128, 2);

  // Roster
  ctx.font = display(18, 600);
  ctx.fillStyle = "#8d9ab3";
  ctx.fillText("ROSTER", 64, 392);

  data.players.forEach((p, i) => {
    const x = 64 + i * 300;
    ctx.font = display(40);
    ctx.fillStyle = p.overall >= 90 ? "#38bdf8" : "#e9eef8";
    ctx.fillText(String(p.overall), x, 458);
    ctx.font = display(26, 600);
    ctx.fillStyle = "#e9eef8";
    ctx.fillText(p.name.toUpperCase().slice(0, 16), x + 70, 452);
  });

  if (data.staff.length > 0) {
    ctx.font = display(20, 600);
    ctx.fillStyle = "#8d9ab3";
    ctx.fillText(data.staff.join("  ·  ").toUpperCase(), 64, 510);
  }

  // Footer
  ctx.font = display(16, 600);
  ctx.fillStyle = "#5b6880";
  ctx.fillText("FAN-MADE RL ESPORTS HISTORY DRAFT — NON-COMMERCIAL", 64, H - 44);

  // Border
  ctx.strokeStyle = champion ? "rgba(249,115,22,0.55)" : "rgba(146,164,196,0.3)";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  return canvas;
}

export async function downloadShareCard(data: ShareCardData): Promise<void> {
  // Ensure the display font is available to the canvas before drawing.
  try {
    await document.fonts.load('700 96px Rajdhani');
  } catch {
    /* fall back to system fonts */
  }
  const canvas = renderShareCard(data);
  const url = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = url;
  link.download = `rocket-draft-${data.placement}-${data.date}.png`;
  link.click();
}
