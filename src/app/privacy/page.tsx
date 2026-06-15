import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { PrivacyView } from "./PrivacyView";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} handles your data — short version: it stays on your device.`,
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
