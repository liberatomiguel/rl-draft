"use client";

/**
 * next/image custom loader (next.config.ts → images.loaderFile). The site is a
 * static export with no image optimizer, so every width resolves to a file
 * pre-built by scripts/build-images.mjs:
 *   "/cards/specials/<id>.png" → specialPhotoSrc(id, width) (256 / 512 px WebP)
 * Anything else (absolute http(s) URLs, other local paths) passes through.
 *
 * Only used in production builds: in dev `images.unoptimized` is true, so
 * next/image renders the raw src and never calls this.
 */

import type { ImageLoaderProps } from "next/image";
import { specialPhotoSrc } from "./assets";

const SPECIAL_PHOTO = /^\/cards\/specials\/([^/?#]+)\.png$/;

export default function imageLoader({ src, width }: ImageLoaderProps): string {
  const match = SPECIAL_PHOTO.exec(src);
  if (match) return specialPhotoSrc(match[1], width) ?? src;
  return src;
}
