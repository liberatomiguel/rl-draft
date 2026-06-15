import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

/**
 * Static sitemap — the run flow lives behind one `/play` route and the rest
 * are content/hub pages. (Profile is per-device and intentionally omitted.)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/play", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/collection", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/how-to-play", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/achievements", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/changelog", priority: 0.4, changeFrequency: "weekly" as const },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
  ];
  const lastModified = new Date().toISOString();
  return routes.map((r) => ({
    url: `${SITE.url}${r.path === "/" ? "" : r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
