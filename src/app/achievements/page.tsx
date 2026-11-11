import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { AchievementsView } from "./AchievementsView";

export const metadata: Metadata = pageMetadata({
  title: `${SITE.name} Achievements — Full List & How to Unlock`,
  description: `Every ${SITE.name} achievement and how to unlock it — challenges spanning drafts, tournament runs and your RLCS special-card collection.`,
  path: "/achievements",
});

export default function AchievementsPage() {
  return <AchievementsView />;
}
