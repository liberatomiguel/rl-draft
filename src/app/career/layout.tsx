/**
 * Road to Worlds — /career route group layout (SERVER component).
 *
 * - Career mode is an alpha: never indexed, whatever the flag says.
 * - FEATURES.careerMode off (the production default — see balance.ts) →
 *   notFound(): every /career/* route renders the 404 boundary with a noindex
 *   tag instead of the career UI. A static export still writes those files
 *   (with HTTP 200), so `scripts/postexport.mjs` deletes `out/career*` and the
 *   host serves the real 404 page.
 * - Flag on → the client shell (save-slot guards, top bar, autopilot, toasts).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { CareerShell } from "./CareerShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CareerLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.careerMode) notFound();
  return <CareerShell>{children}</CareerShell>;
}
