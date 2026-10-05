import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

// Required by `output: "export"`: written to out/robots.txt at build time.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // Staging build (staging.rocketdraft.app): keep crawlers out entirely.
  if (process.env.NEXT_PUBLIC_NOINDEX === "1") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
