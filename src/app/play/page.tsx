import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { PlayView } from "./PlayView";

export const metadata: Metadata = {
  title: "Play",
  description: `Start a ${SITE.name} run — draft a roster from RLCS history, spend your budget wisely, and survive the bracket in an RLCS-style tournament.`,
  alternates: { canonical: "/play" },
  robots: { index: true, follow: true },
};

export default function PlayPage() {
  return <PlayView />;
}
