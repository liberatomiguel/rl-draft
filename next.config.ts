import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Inline the (small) Tailwind CSS into the HTML head instead of two
  // render-blocking <link> requests — cuts ~590ms of render-blocking on mobile
  // (PageSpeed) and speeds up FCP/LCP. CSS is tiny (~18KB) so the HTML stays small.
  experimental: {
    inlineCss: true,
  },
  images: {
    // Dev only: serve the raw source files (no optimizer) so that REPLACING a
    // card photo shows up on a normal refresh. The optimizer caches transformed
    // images aggressively (.next/cache/images + browser), which made swapped
    // photos look stale during curation. Production keeps full WebP/AVIF
    // optimization (NODE_ENV === "production").
    unoptimized: process.env.NODE_ENV !== "production",
    // v1.4 edge-request diet. The ONLY next/image usage is the special-card
    // photo in GameCard (display ≤256px; `sizes="(max-width:639px) 50vw, 256px"`),
    // so the widths ever needed are ~256 (1×) and ~640 (2×). The default ladders
    // (8 deviceSizes + 8 imageSizes) let the optimizer mint many variants per
    // photo — each `/_next/image?…&w=…` is a Vercel edge request, and the
    // collection screen alone renders 86 photos. Trimming to the sizes we
    // actually use cuts that fan-out to ~2 variants/photo with no visible change
    // at card size, and a long minimumCacheTTL keeps repeat visits off the
    // optimizer. (Org/rank art uses plain <img> from /public — unaffected.)
    deviceSizes: [640, 1080],
    imageSizes: [128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 31, // 31 days
  },
  // Host canonicalization (www / http / vercel.app → apex) is handled at the
  // Vercel edge — apex `rocketdraft.app` is the primary domain and the other
  // hosts already 308 to it. The code declares the same canonical everywhere
  // (SITE.url → metadataBase, sitemap, robots, canonical tags, hreflang), so no
  // in-app redirect is needed. The multi-origin data in Search Console was the
  // launch-window discovery period (3 days of data); the canonical signals +
  // a GSC Domain property consolidate it onto the apex over time.
};

export default nextConfig;
