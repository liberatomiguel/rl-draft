"use client";

/**
 * v2.2 Pro (R150): the door into the player career, on the manager's saves
 * screen and under the manager wizard's title. Renders nothing while
 * FEATURES.proCareer is off.
 */

import { FEATURES } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { AppLink } from "@/components/ui/AppLink";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

export function ProDoor({ compact = false }: { compact?: boolean }) {
  const C = useCareerCopy();
  if (!FEATURES.proCareer) return null;
  if (compact) {
    return (
      <p className="mt-2 text-sm text-sub">
        {C.pro.door.body}{" "}
        <AppLink href="/career/pro" className="font-semibold text-blue-bright hover:underline">
          {C.pro.door.cta}
        </AppLink>
      </p>
    );
  }
  return (
    <Panel className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="display text-xl font-bold uppercase leading-none text-ink">{C.pro.door.title}</h3>
        <p className="mt-2 max-w-xl text-sm leading-snug text-sub">{C.pro.door.body}</p>
      </div>
      <AppLink href="/career/pro" className={buttonClass("secondary", "md")}>
        {C.pro.door.cta}
      </AppLink>
    </Panel>
  );
}
