import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { LeaderboardsView } from "./LeaderboardsView";

export const metadata: Metadata = {
  title: "Leaderboards",
  description: `Track your best ${SITE.name} rosters — peak team overall per difficulty, worldwide and SAM — championships, daily streaks and challenges cleared. Sign in with Discord to back up your progress and climb the global boards.`,
  alternates: { canonical: "/leaderboards" },
  robots: { index: true, follow: true },
};

export default function LeaderboardsPage() {
  return <LeaderboardsView />;
}
