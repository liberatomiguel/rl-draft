import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { ChallengesView } from "./ChallengesView";

export const metadata: Metadata = pageMetadata({
  title: `RLCS Draft Challenges — Rank-Unlocked Puzzles · ${SITE.name}`,
  description: `Rank-unlocked draft puzzles in ${SITE.name} — out-draft a fixed RLCS line under a twist (overall caps, one-nation rosters, no specials) and win the series. New challenges unlock as you climb the ranks.`,
  path: "/challenges",
});

export default function ChallengesPage() {
  return <ChallengesView />;
}
