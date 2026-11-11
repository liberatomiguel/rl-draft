import type { Metadata } from "next";
import { FEATURES } from "@/config/balance";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import HomeMenu from "./HomeMenu";

/**
 * Home (server shell). Owns the home-specific metadata + hreflang; the
 * interactive menu AND the crawlable SEO content both live in <HomeMenu/>
 * (client) so they follow the EN/PT toggle in place — SSR ships EN HTML for
 * crawlers, the toggle translates it for the player. The PT landing at /pt
 * renders the same content statically in Portuguese for PT search.
 *
 * v2.0 (WEB-01): a build that ships Road to Worlds names the career mode in
 * the title and the description ("rocket league manager game" and "career
 * simulator" already bring impressions to the home page).
 */
export const metadata: Metadata = pageMetadata(
  FEATURES.careerMode
    ? {
        title: `${SITE.name} — Free RLCS Draft Game & Rocket League Manager`,
        description:
          "Play Rocket Draft, a free RLCS draft game. Build a Rocket League esports roster from real RLCS lineups and win the bracket, or run a club in the Road to Worlds career mode.",
        path: "/",
        twins: { en: "/", pt: "/pt" },
      }
    : {
        title: `${SITE.name} — Free RLCS Draft Game & Rocket League Roster Builder`,
        description:
          "Play Rocket Draft, a free RLCS draft game. Build a Rocket League esports roster from historical RLCS lineups, collect special cards, and survive an RLCS-style tournament bracket.",
        path: "/",
        twins: { en: "/", pt: "/pt" },
      },
);

export default function HomePage() {
  return <HomeMenu />;
}
