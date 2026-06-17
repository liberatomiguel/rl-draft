import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { HowToPlayView } from "./HowToPlayView";

export const metadata: Metadata = {
  title: "How to Play",
  description: `Learn how to play ${SITE.name}: draft a roster from iconic RLCS lineups, build team chemistry, and survive an RLCS-style tournament bracket. Rules, chemistry and difficulty modes explained.`,
  alternates: { canonical: "/how-to-play" },
  robots: { index: true, follow: true },
};

export default function HowToPlayPage() {
  return <HowToPlayView />;
}
