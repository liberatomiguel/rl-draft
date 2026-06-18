import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { PAGE_ROUTES } from "@/content/pages";

/**
 * Sitemap. The run flow lives behind one `/play` route; the rest are content /
 * hub pages. Localized content pages emit both their EN and PT URLs with
 * hreflang alternates so Google serves the right language and folds the twins.
 * (Profile/settings are per-device and intentionally omitted.)
 */
const LAST_MODIFIED = "2026-06-18"; // v1.3 SEO pass — bump on meaningful content change
const abs = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;

type Freq = "weekly" | "monthly" | "yearly";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const homeLangs = { "en-US": abs("/"), "pt-BR": abs("/pt") };

  // Home (EN) + PT landing — twins via hreflang.
  entries.push({
    url: abs("/"),
    lastModified: LAST_MODIFIED,
    changeFrequency: "weekly",
    priority: 1.0,
    alternates: { languages: homeLangs },
  });
  entries.push({
    url: abs("/pt"),
    lastModified: LAST_MODIFIED,
    changeFrequency: "weekly",
    priority: 0.8,
    alternates: { languages: homeLangs },
  });

  // Single-URL app/hub pages (language follows the in-app toggle).
  const solo: { path: string; priority: number; changeFrequency: Freq }[] = [
    { path: "/play", priority: 0.9, changeFrequency: "weekly" },
    { path: "/how-to-play", priority: 0.7, changeFrequency: "monthly" },
    { path: "/collection", priority: 0.6, changeFrequency: "weekly" },
    { path: "/achievements", priority: 0.4, changeFrequency: "monthly" },
    { path: "/changelog", priority: 0.4, changeFrequency: "weekly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  ];
  for (const r of solo) {
    entries.push({
      url: abs(r.path),
      lastModified: LAST_MODIFIED,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    });
  }

  // Localized content pages — EN + PT twins with hreflang.
  for (const key of Object.keys(PAGE_ROUTES) as (keyof typeof PAGE_ROUTES)[]) {
    const { en, pt } = PAGE_ROUTES[key];
    const languages = { "en-US": abs(en), "pt-BR": abs(pt) };
    entries.push({
      url: abs(en),
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages },
    });
    entries.push({
      url: abs(pt),
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages },
    });
  }

  return entries;
}
