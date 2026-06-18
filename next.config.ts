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
