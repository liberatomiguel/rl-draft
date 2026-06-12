"use client";

/** Achievements album — discoverable straight from the home screen. */

import Link from "next/link";
import { achievements as achievementDefs } from "@/data";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/Panel";
import { AchievementsGrid } from "@/components/AchievementsGrid";

export default function AchievementsPage() {
  const mounted = useMounted();
  const earned = useProfileStore((s) => s.achievements);
  const count = mounted ? Object.keys(earned).length : 0;

  return (
    <div className="rise-in">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sub transition-colors hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to menu
      </Link>
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
