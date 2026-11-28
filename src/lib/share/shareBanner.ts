/**
 * rc9 SHARE (#259): the equipped profile banner for a share image. The profile
 * shows an explicit, still-owned choice (`resolveEquipped`); the art comes from
 * `bannerArtSrc` (the source SVG in dev, the build's WebP in production), so no
 * URL is built by hand. No banner equipped = null = the plain stock.
 */

import { resolveEquipped, type CosmeticsState } from "@/engine/cosmetics";
import { bannerArtSrc } from "@/lib/assets";

export function shareBannerUrl(cosmetics: CosmeticsState | null | undefined, displayPx = 1200): string | null {
  if (!cosmetics) return null;
  const banner = resolveEquipped(cosmetics).banner;
  return banner && banner.kind === "banner" ? bannerArtSrc(banner.style.art, displayPx) : null;
}
