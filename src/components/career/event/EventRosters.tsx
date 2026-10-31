"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { cx } from "@/lib/util";
import { useCareerSave } from "@/components/career/careerUi";
import { OrgSheet } from "@/components/career/OrgSheet";

const RosterContext = createContext<{ open: boolean; show?: (ref: string) => void }>({ open: false });

/** One roster sheet across the live event, bracket, standings and result digest. */
export function EventRosters({ children }: { children: ReactNode }) {
  const save = useCareerSave();
  const [ref, setRef] = useState<string | null>(null);
  return <RosterContext.Provider value={{ open: ref !== null, show: setRef }}>
    {children}
    {save ? <OrgSheet save={save} orgRef={ref} onClose={() => setRef(null)} /> : null}
  </RosterContext.Provider>;
}

export function useEventRosterOpen(): boolean { return useContext(RosterContext).open; }

export function EventTeamButton({ teamId, name, className, children }: {
  teamId: string; name?: string; className?: string; children: ReactNode;
}) {
  const { show } = useContext(RosterContext);
  const C = useCareerCopy();
  if (!show) return <span className={className}>{children}</span>;
  return <button type="button" data-event-org={teamId} aria-haspopup="dialog"
    aria-label={name ? `${name} · ${C.orgSheet.roster}` : undefined}
    className={cx("inline-flex min-w-0 items-center gap-1.5 text-left hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-blue", className)}
    onClick={(e) => { e.stopPropagation(); show(teamId); }}>{children}</button>;
}
