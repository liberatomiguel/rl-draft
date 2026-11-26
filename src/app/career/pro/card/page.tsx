import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { ProCardScreen } from "@/components/career/pro/ProCardScreen";

/**
 * v2.2 Pro (R150): the final card. The payload is in the URL hash and read in
 * the browser, so the export stays static. Off the flag → the 404 page.
 */
export default function Page() {
  if (!FEATURES.proCareer) notFound();
  return <ProCardScreen />;
}
