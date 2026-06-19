import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { ChallengesView } from "./ChallengesView";

export const metadata: Metadata = {
  title: "Challenges",
  description: `Rank-unlocked draft puzzles in ${SITE.name} — out-draft a fixed RLCS line under a twist (overall caps, one-nation rosters, no specials) and win the series. New challenges unlock as you climb the ranks.`,
  alternates: { canonical: "/challenges" },
  robots: { index: true, follow: true },
};

export default function ChallengesPage() {
  return <ChallengesView />;
}
