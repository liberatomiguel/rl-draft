import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";

// The page itself is a Client Component, so its metadata lives here. Before
// v2.0 it had none and inherited the home's title and canonical.
export const metadata: Metadata = pageMetadata({
  title: `Your Profile — Rank, Season Rating & Stats · ${SITE.name}`,
  description: `Your ${SITE.name} profile: rank and Season Rating, badges, banners and titles, lifetime stats, achievements and run history. Saved on this device; sign in to back it up.`,
  path: "/profile",
});

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
