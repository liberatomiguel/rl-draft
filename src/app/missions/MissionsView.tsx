"use client";

import { useCopy } from "@/content/copy";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { SectionTitle } from "@/components/ui/Panel";
import { MissionsPanel } from "@/components/MissionsPanel";

export function MissionsView() {
  const { MISSIONS_UI: M } = useCopy();
  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle kicker={M.kicker} title={M.title} className="mb-6" />
      <MissionsPanel />
    </div>
  );
}
