import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { MissionsView } from "./MissionsView";
import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";

// Per-player state only: nothing to index.
export const metadata: Metadata = pageMetadata({
  title: `Missions · ${SITE.name}`,
  description: `Daily and weekly ${SITE.name} missions: small goals across drafts, challenges and the quiz that pay XP toward your next rank.`,
  path: "/missions",
  index: false,
});

export default function MissionsPage() {
  if (FEATURES.playtest) notFound(); // cut from the playtest build (postexport deletes it)
  return <MissionsView />;
}
