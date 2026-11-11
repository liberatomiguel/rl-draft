import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { PrivacyView } from "./PrivacyView";

export const metadata: Metadata = pageMetadata({
  title: `Privacy Policy · ${SITE.name}`,
  description: `How ${SITE.name} handles your data — short version: it stays on your device.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return <PrivacyView />;
}
