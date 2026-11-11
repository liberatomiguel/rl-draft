import type { MetadataRoute } from "next";
import { FEATURES } from "@/config/balance";
import { SITE } from "@/config/site";
import { CONTENT_DATE, LIVE_PAGE_SLUGS, PAGE_ROUTES } from "@/content/pageRoutes";
import { DB_PLAYERS, DB_SEASONS, DB_TEAMS } from "@/lib/database";

// Required by `output: "export"`: written to out/sitemap.xml at build time.
export const dynamic = "force-static";

const abs = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;

type Freq = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Sitemap. The run flow lives behind one `/play` route; the rest are content /
 * hub pages. Localized content pages emit both their EN and PT URLs with
 * hreflang alternates so Google serves the right language and folds the twins.
 * Every indexable page is listed; `noindex` pages (/settings, /missions) and
 * the career app (/career, never listed — scripts/postexport.mjs enforces it)
 * are not. /profile is per-device and stays out, as before.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const homeLangs = { "en-US": abs("/"), "pt-BR": abs("/pt"), "x-default": abs("/") };

  // Home (EN) + PT landing — twins via hreflang.
  entries.push({
    url: abs("/"),
    lastModified: CONTENT_DATE,
    changeFrequency: "weekly",
    priority: 1.0,
    alternates: { languages: homeLangs },
  });
  entries.push({
    url: abs("/pt"),
    lastModified: CONTENT_DATE,
    changeFrequency: "weekly",
    priority: 0.8,
    alternates: { languages: homeLangs },
  });

  // Single-URL app/hub pages (language follows the in-app toggle).
  const solo: { path: string; priority: number; changeFrequency: Freq }[] = [
    { path: "/play", priority: 0.9, changeFrequency: "weekly" },
    // Cut from the playtest build (the route 404s there).
    ...(FEATURES.playtest ? [] : [{ path: "/quiz", priority: 0.7, changeFrequency: "daily" as const }]),
    { path: "/how-to-play", priority: 0.7, changeFrequency: "monthly" },
    { path: "/challenges", priority: 0.6, changeFrequency: "weekly" },
    { path: "/collection", priority: 0.6, changeFrequency: "weekly" },
    { path: "/leaderboards", priority: 0.5, changeFrequency: "daily" },
    { path: "/achievements", priority: 0.4, changeFrequency: "monthly" },
    { path: "/changelog", priority: 0.4, changeFrequency: "weekly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  ];
  for (const r of solo) {
    entries.push({
      url: abs(r.path),
      lastModified: CONTENT_DATE,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    });
  }

  // Localized content pages — EN + PT twins with hreflang. A page that
  // describes Road to Worlds is listed only by a build that ships the mode.
  for (const key of LIVE_PAGE_SLUGS) {
    const { en, pt } = PAGE_ROUTES[key];
    const languages = { "en-US": abs(en), "pt-BR": abs(pt), "x-default": abs(en) };
    entries.push({
      url: abs(en),
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages },
    });
    entries.push({
      url: abs(pt),
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages },
    });
  }

  // The public RLCS database (one URL per page): the hub, the two indexes and
  // every season, team and player page.
  const database: { path: string; priority: number }[] = [
    { path: "/rlcs", priority: 0.8 },
    { path: "/rlcs/teams", priority: 0.6 },
    { path: "/rlcs/players", priority: 0.6 },
    ...DB_SEASONS.map((s) => ({ path: `/rlcs/${s.slug}`, priority: 0.6 })),
    ...DB_TEAMS.map((t) => ({ path: `/rlcs/teams/${t.id}`, priority: 0.5 })),
    ...DB_PLAYERS.map((p) => ({ path: `/rlcs/players/${p.id}`, priority: 0.5 })),
  ];
  for (const r of database) {
    entries.push({
      url: abs(r.path),
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly",
      priority: r.priority,
    });
  }

  return entries;
}
