import type { Metadata } from "next";
import { MissionsView } from "./MissionsView";

// Per-player state only: nothing to index.
export const metadata: Metadata = {
  title: "Missions",
  robots: { index: false, follow: true },
};

export default function MissionsPage() {
  return <MissionsView />;
}
