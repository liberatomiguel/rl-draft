"use client";

/**
 * v2.0.34 (player survey): the one-off HQ card that tells a returning player
 * about several careers and the account copy. Who and how often:
 * `lib/careerSavesNotice.ts`.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMounted } from "@/store/useMounted";
import { useCareerCopy } from "@/content/careerCopy";
import { careerSavesNoticeDue, settleCareerSavesNotice } from "@/lib/careerSavesNotice";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

export function SavesNotice({ clock }: { clock: { seasonIndex: number; day: number } }) {
  const C = useCareerCopy().savesNotice;
  const router = useRouter();
  const [answered, setAnswered] = useState(false);
  // Read on the client only: the server export never knows the device's answer.
  const mounted = useMounted();
  if (!mounted || answered || !careerSavesNoticeDue(clock)) return null;
  const settle = (outcome: "opened" | "dismissed") => {
    settleCareerSavesNotice(outcome);
    setAnswered(true);
    if (outcome === "opened") router.push("/career/saves");
  };
  return (
    <Panel className="rise-in mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <p className="display text-base font-bold text-ink">{C.title}</p>
        <p className="mt-1 text-sm text-sub">{C.body}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {/* Same pair as the research invitation (ResearchInvite): the action filled, the dismiss ghost. */}
        <Button variant="primary" size="sm" onClick={() => settle("opened")}>
          {C.open}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => settle("dismissed")}>
          {C.dismiss}
        </Button>
      </div>
    </Panel>
  );
}
