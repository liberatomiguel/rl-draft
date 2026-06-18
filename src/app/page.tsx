import type { Metadata } from "next";
import { SITE } from "@/config/site";
import HomeMenu from "./HomeMenu";

/**
 * Home (server shell). Owns the home-specific metadata + hreflang; the
 * interactive menu AND the crawlable SEO content both live in <HomeMenu/>
 * (client) so they follow the EN/PT toggle in place — SSR ships EN HTML for
 * crawlers, the toggle translates it for the player. The PT landing at /pt
 * renders the same content statically in Portuguese for PT search.
 */
const META_DESCRIPTION =
  "Play Rocket Draft, a free RLCS draft game. Build a Rocket League esports roster from historical RLCS lineups, collect special cards, and survive an RLCS-style tournament bracket.";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE.name} — Free RLCS Draft Game & Rocket League Roster Builder`,
  },
  description: META_DESCRIPTION,
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "pt-BR": "/pt",
      "x-default": "/",
    },
  },
  openGraph: {
    url: SITE.url,
    title: `${SITE.name} — Free RLCS Draft Game`,
    description: META_DESCRIPTION,
  },
};

export default function HomePage() {
  return <HomeMenu />;
}
