import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { ChangelogView } from "./ChangelogView";

export const metadata: Metadata = pageMetadata({
  title: `Changelog — What's New in ${SITE.name}`,
  description: `What's new in ${SITE.name} — release history and notable changes.`,
  path: "/changelog",
});

export default function ChangelogPage() {
  return <ChangelogView />;
}
