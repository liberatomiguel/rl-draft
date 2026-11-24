import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { ProWizardScreen } from "@/components/career/pro/ProWizardScreen";

/** v2.2 Pro (R148): create a player. It reads `?slot=`, so it sits in a Suspense boundary (static export). */
export default function Page() {
  if (!FEATURES.proCareer) notFound();
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <ProWizardScreen />
    </Suspense>
  );
}
