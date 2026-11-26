import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { ProWeekScreen } from "@/components/career/pro/ProWeekScreen";

/** v2.2 Pro (R150): the week planner. Off the flag → the 404 page. */
export default function Page() {
  if (!FEATURES.proCareer) notFound();
  return <ProWeekScreen />;
}
