"use client";

import { useMemo } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { weekOfDay } from "@/engine/career/calendar";
import { newerSide } from "@/lib/careerCloud";
import { cx } from "@/lib/util";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useCareerCloudStore } from "@/store/careerCloudStore";
import { seasonLabelFor, slotMetaFor, useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import { useCloudNoticeUi } from "./cloudNoticeUi";
import { downloadSlotFile } from "./downloadSave";

const stamp = (ms: number): string => {
  if (!(ms > 0)) return "-";
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

function CopyCard({
  title,
  org,
  line,
  played,
  recent,
}: {
  title: string;
  org: string;
  line: string;
  played: string;
  recent: string | null;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-black/20 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{title}</p>
        {recent ? (
          <span className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 text-[10px] font-semibold text-sub">
            {recent}
          </span>
        ) : null}
      </div>
      <p className="display truncate text-base font-bold uppercase tracking-wide text-ink">{org}</p>
      <p className="mt-0.5 truncate text-sm text-sub">{line}</p>
      <p className="mt-0.5 truncate text-xs text-faint">{played}</p>
    </div>
  );
}

/** The notice about two copies of one career. Put away with "Decide later"; the saves screen brings it back. */
export function CareerCloudConflict() {
  const C = useCareerCopy();
  const mounted = useMounted();
  const cloudSlots = useCareerCloudStore((s) => s.slots);
  const syncing = useCareerCloudStore((s) => s.syncing);
  const resolve = useCareerCloudStore((s) => s.resolveConflict);
  const careers = useCareerStore((s) => s.slots);
  const dismissedKey = useCloudNoticeUi((s) => s.dismissedKey);
  const dismiss = useCloudNoticeUi((s) => s.dismiss);
  const metas = useMemo(() => {
    try {
      return slotMetaFor(careers);
    } catch {
      return [];
    }
  }, [careers]);

  const conflict = cloudSlots.find((s) => s.conflict)?.conflict ?? null;
  if (!mounted || !conflict) return null;

  const { kind, slot, cloud } = conflict;
  const key = `${slot}:${kind}:${cloud?.revision ?? "-"}`;
  const N = C.cloud.notice;
  const local = metas[slot] ?? null;
  const side = local && cloud ? newerSide(local.lastPlayedAt, cloud.savedAt) : null;
  const deleted = kind === "cloud-deleted";
  const title = kind === "diverged" ? N.titleDiverged : kind === "different-career" ? N.titleDifferent : N.titleDeleted;
  const body = kind === "diverged" ? N.bodyDiverged : kind === "different-career" ? N.bodyDifferent : N.bodyDeleted;
  const localPrimary = deleted || side !== "cloud";
  const summary = cloud?.summary;

  return (
    <Modal
      open={key !== dismissedKey}
      title={title}
      wide
      onClose={() => dismiss(key)}
      actions={
        <Button variant="ghost" onClick={() => dismiss(key)}>
          {N.decideLater}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-sub">{body}</p>
        <div className={cx("grid gap-3", !deleted && "sm:grid-cols-2")}>
          {local ? (
            <CopyCard
              title={N.thisDevice}
              org={local.orgName}
              line={N.seasonWeek(local.seasonLabel, C.hub.week(local.week))}
              played={`${C.saves.lastPlayed}: ${stamp(local.lastPlayedAt)}`}
              recent={side === "local" ? N.mostRecent : null}
            />
          ) : null}
          {!deleted && cloud ? (
            <CopyCard
              title={N.account}
              org={summary?.orgName ?? "-"}
              line={
                typeof summary?.seasonIndex === "number" && typeof summary?.day === "number"
                  ? N.seasonWeek(seasonLabelFor(summary.seasonIndex), C.hub.week(weekOfDay(summary.day)))
                  : "-"
              }
              played={`${C.saves.lastPlayed}: ${stamp(cloud.savedAt)}`}
              recent={side === "cloud" ? N.mostRecent : null}
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant={localPrimary ? "primary" : "secondary"}
            className="sm:flex-1"
            disabled={syncing}
            onClick={() => void resolve(slot, "local")}
          >
            {deleted ? N.keepHere : N.keepDevice}
          </Button>
          <Button
            variant={deleted ? "danger" : localPrimary ? "secondary" : "primary"}
            className="sm:flex-1"
            disabled={syncing}
            onClick={() => void resolve(slot, "cloud")}
          >
            {deleted ? N.deleteHere : N.useAccount}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => downloadSlotFile(slot)}
          className="min-h-11 text-xs font-semibold text-blue-bright underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60 sm:min-h-8"
        >
          {N.exportFirst}
        </button>
      </div>
    </Modal>
  );
}
