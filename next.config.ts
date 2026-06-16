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
};

export default nextConfig;
