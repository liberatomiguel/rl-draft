import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { LeaderboardsView } from "./LeaderboardsView";

export const metadata: Metadata = pageMetadata({
  title: `RLCS Draft Leaderboards — Global Rankings · ${SITE.name}`,
  description: `Track your best ${SITE.name} rosters — peak team overall per difficulty, championships, daily streaks and challenges cleared. Sign in with your email to back up your progress and climb the global boards.`,
  path: "/leaderboards",
});

export default function LeaderboardsPage() {
  return <LeaderboardsView />;
}
