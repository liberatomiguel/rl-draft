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
        // v2.0.19: "career mode" is the career query with the most searches, and
        // it sat at the end of the description, where Google cuts the snippet.
        // The title keeps "Manager": the home already ranks for it.
        title: `${SITE.name} — Free RLCS Draft Game & Rocket League Manager`,
        description:
          "Rocket Draft is a free RLCS draft game and Rocket League career mode. Draft a roster from real RLCS lineups and win the bracket, or manage a club in Road to Worlds.",
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
