import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { ChangelogView } from "./ChangelogView";

export const metadata: Metadata = {
  title: "Changelog",
  description: `What's new in ${SITE.name} — release history and notable changes.`,
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  return <ChangelogView />;
}
