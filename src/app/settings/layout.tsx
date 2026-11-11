import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";

// The page itself is a Client Component, so its metadata lives here. Before
// v2.0 it had none and inherited the home's title and canonical. Per-device
// preferences: nothing for a search result to show.
export const metadata: Metadata = pageMetadata({
  title: `Settings · ${SITE.name}`,
  description: `${SITE.name} settings: language, sound, animation speed and visual effects, saved on this device.`,
  path: "/settings",
  index: false,
});

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
