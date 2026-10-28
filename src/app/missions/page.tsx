import type { Metadata } from "next";
import { MissionsView } from "./MissionsView";
import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";

// Per-player state only: nothing to index.
export const metadata: Metadata = {
  title: "Missions",
  robots: { index: false, follow: true },
};

export default function MissionsPage() {
  if (FEATURES.playtest) notFound(); // cut from the playtest build (postexport deletes it)
  return <MissionsView />;
}
