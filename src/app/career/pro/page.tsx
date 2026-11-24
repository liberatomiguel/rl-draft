import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { ProSavesScreen } from "@/components/career/pro/ProSavesScreen";

/** v2.2 Pro (R150): the Pro careers picker. Off the flag → the 404 page. */
export default function Page() {
  if (!FEATURES.proCareer) notFound();
  return <ProSavesScreen />;
}
