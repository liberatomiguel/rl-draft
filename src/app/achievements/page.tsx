"use client";

/** Achievements album — discoverable straight from the home screen. */

import { achievements as achievementDefs } from "@/data";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { SectionTitle } from "@/components/ui/Panel";
import { AchievementsGrid } from "@/components/AchievementsGrid";

export default function AchievementsPage() {
  const mounted = useMounted();
  const earned = useProfileStore((s) => s.achievements);
  const count = mounted ? Object.keys(earned).length : 0;

  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle
        kicker="Feats to chase across every run"
        title="Achievements"
        right={
          <Badge tone="orange" className="!text-sm">
            {count}/{achievementDefs.length}
          </Badge>
        }
        className="mb-6"
      />
      <AchievementsGrid earned={mounted ? earned : {}} />
    </div>
  );
}
