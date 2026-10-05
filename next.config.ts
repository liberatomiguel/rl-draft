import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure static export: `next build` writes the whole site to `out/`, which is
  // served as-is by Cloudflare Workers Static Assets (wrangler.jsonc — assets
  // only, no Worker script). No server runtime exists, so nothing that needs
  // one may be added (route handlers reading the request, rewrites/redirects/
  // headers() here, middleware/proxy, Server Actions, ISR, dynamic routes
  // without generateStaticParams). Cache headers live in public/_headers.
  output: "export",
  reactCompiler: true,

  // trailingSlash stays at its default (false) on purpose: pages export as
  // `play.html` and Cloudflare's `html_handling: "auto-trailing-slash"` serves
  // `/play` from it and redirects `/play/` → `/play`, so the app only ever sees
  // the slash-less pathname. AppShell compares the pathname to "/play" exactly
  // (anything else clears the saved run), and canonical/sitemap/hreflang URLs
  // are slash-less too.

  images: {
    // No runtime optimizer on a static host. The custom loader maps each
    // next/image width onto WebP files pre-built by scripts/build-images.mjs
    // (prebuild); see src/lib/imageLoader.ts + src/lib/assets.ts.
    loader: "custom",
    loaderFile: "./src/lib/imageLoader.ts",
    // Dev only: render the raw source PNG (loader bypassed) so replacing a
    // card photo shows up on a normal refresh during photo curation.
    unoptimized: process.env.NODE_ENV !== "production",
    // The only next/image is the special-card photo (GameCard, `fill`,
    // sizes="(max-width: 639px) 50vw, 256px"). With a vw size Next keeps the
    // widths ≥ deviceSizes[0] × 0.5 = 256, so the srcset is exactly the two
    // generated files: 256w + 512w.
    deviceSizes: [512],
    imageSizes: [256],
  },
};

export default nextConfig;
