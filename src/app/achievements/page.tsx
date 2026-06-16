import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { AchievementsView } from "./AchievementsView";

export const metadata: Metadata = {
  title: "Achievements",
  description: `Every ${SITE.name} achievement and how to unlock it — challenges spanning drafts, tournament runs and your RLCS special-card collection.`,
  alternates: { canonical: "/achievements" },
  robots: { index: true, follow: true },
};

export default function AchievementsPage() {
  return <AchievementsView />;
}
