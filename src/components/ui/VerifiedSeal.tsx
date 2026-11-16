/**
 * v2.0.17: the Verified seal — a blue scalloped rosette with a white check,
 * drawn next to the player's name (profile hero, leaderboard rows, the profile
 * peek) and at ceremony size in the unlock pop-up. Miguel grants it by hand
 * (`profile_grants.grant_id = 'verified'`); it is not a cosmetic, so there is
 * nothing to equip or hide.
 *
 * The outline is built once at module load: an eight-lobe sine rosette sampled
 * six times per lobe and smoothed into cubic curves (Catmull-Rom).
 */

import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";

const LOBES = 8;
const CENTER = 12;
const RADIUS = 10;
const WAVE = 1.05;
const SAMPLES = LOBES * 6;

function sealPath(): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / SAMPLES) * 2 * Math.PI - Math.PI / 2;
    const r = RADIUS + WAVE * Math.cos(LOBES * (t + Math.PI / 2));
    pts.push([CENTER + r * Math.cos(t), CENTER + r * Math.sin(t)]);
  }
  const f = (v: number) => +v.toFixed(2);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < SAMPLES; i++) {
    const p0 = pts[(i - 1 + SAMPLES) % SAMPLES];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % SAMPLES];
    const p3 = pts[(i + 2) % SAMPLES];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

export const VERIFIED_SEAL_PATH = sealPath();

/** The seal's blue (fill) and its lighter top (gradient). */
const SEAL_TOP = "#4aa8ff";
const SEAL_BOTTOM = "#1f6fe0";

export function VerifiedSeal({ size = 20, className }: { size?: number; className?: string }) {
  const { COSMETICS: C } = useCopy();
  // One gradient id per size keeps the defs valid when several seals share a page.
  const gid = `verified-seal-${size}`;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={C.verified.label}
      className={cx("block shrink-0", className)}
    >
      <title>{C.verified.tooltip}</title>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SEAL_TOP} />
          <stop offset="1" stopColor={SEAL_BOTTOM} />
        </linearGradient>
      </defs>
      <path d={VERIFIED_SEAL_PATH} fill={`url(#${gid})`} />
      <path d="M7.6 12.3l3.05 3.05 5.75-6.1" fill="none" stroke="#fff" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
