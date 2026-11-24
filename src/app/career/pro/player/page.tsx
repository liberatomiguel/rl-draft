import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { ProPlayerScreen } from "@/components/career/pro/ProPlayerScreen";

/** v2.2 Pro (R150): the active Pro career's player card. Off the flag → the 404 page. */
export default function Page() {
  if (!FEATURES.proCareer) notFound();
  return <ProPlayerScreen />;
}
