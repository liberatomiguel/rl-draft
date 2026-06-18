/**
 * Site-wide constants for v1.0 launch (rocketdraft.app).
 *
 * Single source of truth for the domain, release version, attribution and the
 * external links used by the footer, home and SEO metadata.
 *
 * TODO(launch): fill in the two placeholders below once they exist —
 *   - `discordUrl`: the community Discord invite (Miguel is creating it)
 *   - `supportUrl`: the "buy me a coffee" / Ko-fi link
 * Buttons/links hide automatically while a URL is left empty.
 */

export const SITE = {
  name: "Rocket Draft",
  /** Bare domain (no protocol) — display + canonical host. */
  domain: "rocketdraft.app",
  url: "https://rocketdraft.app",
  /** Shown in the footer. Keep in sync with package.json. */
  version: "1.2.7",
  versionName: "Regional Champions",

  author: "LiberatoRL",
  authorUrl: "https://x.com/liberatoRL_",

  /** Overall-balancing credit (v1.2.0) — GWR helped tune the ratings. */
  balanceCreditName: "GWR",
  balanceCreditUrl: "https://x.com/zgwr_rl",

  /** Credit — Rocket Draft is inspired by Rams' draftrlcs.app. */
  inspiredByName: "draftrlcs.app",
  inspiredByUrl: "https://draftrlcs.app/",
  inspiredByAuthor: "Rams",

  /** Community + support. Empty string = hidden until set. */
  discordUrl: "https://discord.gg/h4FGWHyPD2", // e.g. "https://discord.gg/xxxxxxx"
  supportUrl: "https://ko-fi.com/liberatomiguel", // e.g. "https://ko-fi.com/liberatorl"
} as const;
