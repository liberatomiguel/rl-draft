/**
 * Image URL helpers for the static art in public/ (org logos, special-card
 * photos, rank emblems, flags).
 *
 * PRODUCTION (`next build`, NODE_ENV === "production"): URLs point at the WebP
 * variants made by scripts/build-images.mjs (runs as `prebuild`) —
 * `/img/<kind>/<name>.<hash>[.<w>].webp`, served with a 1-year immutable cache.
 * The hash covers the source PNG bytes plus that category's encoder settings,
 * so a replaced PNG or a re-tuned encode gets a new URL.
 * Only assets listed in src/generated/asset-manifest.json exist; anything else
 * returns `null` so the caller renders its fallback WITHOUT a network request
 * (a static host answers a miss with the whole 404 page). The generated widths
 * also come from the manifest (single source of truth: build-images.mjs), and
 * scripts/postexport.mjs fails the build if any URL built here — every
 * manifest entry × width — is missing from out/img/. Keep the URL formats
 * below and checkGeneratedImages() in postexport.mjs in sync.
 *
 * DEV / TEST (anything else): the raw source PNG paths, and every asset is
 * treated as present — drop a PNG into public/, refresh, it shows (the
 * component's onError fallback still covers files that don't exist).
 */

import manifestJson from "@/generated/asset-manifest.json";

type AssetManifest = {
  /** Generated widths per category — ascending, unique (build-images.mjs checks). */
  widths: { orgs: readonly number[]; specials: readonly number[] };
  /** Lowercase ISO codes with a /flags/<code>.png file. */
  flags: string[];
  /** "<orgId>" or "<orgId>@<era>" → source hash. */
  orgs: Record<string, string>;
  /** Special-card id → source hash. */
  specials: Record<string, string>;
  /** "menu/<rankId>" | "profile/<rankId>" → source hash. */
  ranks: Record<string, string>;
};

const manifest = manifestJson as AssetManifest;
const IS_PROD = process.env.NODE_ENV === "production";
const FLAGS = new Set(manifest.flags);

/** Widths generated per org logo (fit inside a w×w box), ascending — from the
 *  manifest (currently 96, 264). Change them in scripts/build-images.mjs only. */
export const ORG_LOGO_WIDTHS: readonly number[] = manifest.widths.orgs;
/** Widths generated per special-card photo, ascending — from the manifest
 *  (currently 256, 512). Change them in scripts/build-images.mjs only. */
export const SPECIAL_PHOTO_WIDTHS: readonly number[] = manifest.widths.specials;

/** Logos are picked for 3× density: a variant serves CSS sizes up to width / 3
 *  (96 → ≤ 32 CSS px; 264 → the xl logo at 88 CSS px). Not a gameplay value. */
const ORG_LOGO_DENSITY = 3;

export type RankVariant = "menu" | "profile";

const hashFor = (table: Record<string, string>, key: string): string | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

/** Smallest generated width ≥ `needPx`, else the largest one (`widths` ascending). */
function pickWidth(widths: readonly number[], needPx: number): number {
  for (const w of widths) if (w >= needPx) return w;
  return widths[widths.length - 1];
}

/** Path-segment encoding for generated URLs. Era keys contain "@", and
 *  Cloudflare's asset server answers a raw "@" with a 307 to the "%40" form —
 *  requesting the encoded form directly saves that extra round trip. */
const seg = encodeURIComponent;

/**
 * Flag image for a country code (case-insensitive), or `null` when there is no
 * file — e.g. region codes (NA, EU, …) → caller renders the text chip.
 */
export function flagSrc(code: string): string | null {
  const cc = code.toLowerCase();
  if (!IS_PROD) return `/flags/${cc}.png`;
  return FLAGS.has(cc) ? `/flags/${cc}.png` : null;
}

/**
 * Org logo for `key` ("<orgId>" or the era variant "<orgId>@<era>") rendered at
 * `displayPx` CSS px (the larger side of its box). Picks the smallest variant
 * that covers it at 3× density — with widths 96 / 264: the 96 px variant up to
 * 32 CSS px, the 264 px one above (xl = 88 CSS px at 3×; larger sizes also get
 * the biggest variant). `null` = no logo file →
 * try the next source in the chain / render the monogram.
 */
export function orgLogoSrc(key: string, displayPx: number): string | null {
  if (!IS_PROD) return `/orgs/${key}.png`;
  const hash = hashFor(manifest.orgs, key);
  if (!hash) return null;
  const w = pickWidth(ORG_LOGO_WIDTHS, displayPx * ORG_LOGO_DENSITY);
  return `/img/orgs/${seg(key)}.${hash}.${w}.webp`;
}

/** True when special card `id` has a photo (always true outside production). */
export function hasSpecialPhoto(id: string): boolean {
  return !IS_PROD || hashFor(manifest.specials, id) !== undefined;
}

/**
 * Special-card photo for `id` at a requested pixel `width`: the smallest
 * generated variant ≥ width, else the largest — with widths 256 / 512: the
 * 256 px variant when width ≤ 256, otherwise the 512 px one. `null` = no photo.
 */
export function specialPhotoSrc(id: string, width: number): string | null {
  if (!IS_PROD) return `/cards/specials/${id}.png`;
  const hash = hashFor(manifest.specials, id);
  if (!hash) return null;
  const w = pickWidth(SPECIAL_PHOTO_WIDTHS, width);
  return `/img/specials/${seg(id)}.${hash}.${w}.webp`;
}

/** Rank emblem art for one of the two art sets, or `null` when missing. */
export function rankSrc(variant: RankVariant, rankId: string): string | null {
  if (!IS_PROD) return `/ranks/${variant}/${rankId}.png`;
  const hash = hashFor(manifest.ranks, `${variant}/${rankId}`);
  return hash ? `/img/ranks/${variant}/${seg(rankId)}.${hash}.webp` : null;
}
