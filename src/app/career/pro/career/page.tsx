import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { ProCareerScreen } from "@/components/career/pro/spine/ProCareerScreen";

/** v2.2 Pro spine (PROSPINE): the career hub (today, team, offers, inbox). Off the flag: the 404 page. */
export default function Page() {
  if (!FEATURES.proCareer) notFound();
  return <ProCareerScreen />;
}
