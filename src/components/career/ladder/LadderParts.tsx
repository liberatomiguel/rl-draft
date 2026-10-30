"use client";

/**
 * rc.35 — the progression ladder, drawn (Miguel, rc.34: "visual, with icons;
 * compact + See more"). `RungIcon` maps a rung to its glyph; `LadderStrip`
 * is the compact icon track (a window around the next rung); `LadderGrid`
 * is the whole ladder as an icon list (rc.36: HQ's "See more" opens it in a
 * modal, so the card never grows). Data comes from
 * engine/career/ladder.ladderOf — this file only draws.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { LadderRungId, LadderRungState } from "@/engine/career/ladder";
import { cx } from "@/lib/util";
import {
  CheckIcon,
  CoachIcon,
  HandshakeIcon,
  HqIcon,
  LockIcon,
  MindIcon,
  MonitorIcon,
  PcIcon,
  PeripheralsIcon,
  StarCoachIcon,
  TentIcon,
} from "@/components/ui/icons";

export function RungIcon({ id, className }: { id: LadderRungId; className?: string }) {
  switch (id) {
    case "peripherals":
      return <PeripheralsIcon className={className} />;
    case "monitors":
      return <MonitorIcon className={className} />;
    case "pcs":
      return <PcIcon className={className} />;
    case "perfCenter":
      return <HqIcon className={className} />;
    case "coach":
      return <CoachIcon className={className} />;
    case "exProCoach":
      return <StarCoachIcon className={className} />;
    case "bootcamp1":
    case "bootcamp2":
      return <TentIcon className={className} />;
    case "psychologist":
      return <MindIcon className={className} />;
    default:
      return <HandshakeIcon className={className} />;
  }
}

/** The round icon badge of one rung, its ring coloured by status (rc.36: "sm" for Finances' arsenal list). */
export function RungBadge({
  rung,
  size = "md",
  highlight,
}: {
  rung: Pick<LadderRungState, "id" | "status">;
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
}) {
  const box = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={cx(
        "relative flex shrink-0 items-center justify-center rounded-full border-2",
        box,
        rung.status === "owned" && "border-orange bg-orange/20 text-orange-bright",
        rung.status === "open" && "border-blue-bright bg-blue/15 text-blue-bright",
        rung.status === "locked" && "border-line-strong bg-white/5 text-faint",
        highlight && "shadow-[0_0_18px_-4px_rgba(249,115,22,0.7)] ring-2 ring-orange/50 ring-offset-2 ring-offset-transparent",
      )}
    >
      <RungIcon id={rung.id} className={icon} />
      {rung.status === "owned" ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange text-[#1a0d02]">
          <CheckIcon className="h-3 w-3" />
        </span>
      ) : rung.status === "locked" ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-raised text-faint">
          <LockIcon className="h-3 w-3" />
        </span>
      ) : null}
    </span>
  );
}

/** Index of the window's first rung: one rung behind the next locked one, `size` wide. */
function windowStart(rungs: LadderRungState[], size: number): number {
  const next = rungs.findIndex((r) => r.status === "locked");
  const focus = next === -1 ? rungs.length - 1 : next;
  return Math.max(0, Math.min(focus - 1, rungs.length - size));
}

/**
 * The compact track: `size` rungs (icon + short name + gate) joined by a line,
 * the next locked rung highlighted. rc.36: the track only — the caller opens
 * the whole ladder (`LadderGrid`).
 */
export function LadderStrip({ rungs, C, size = 5 }: { rungs: LadderRungState[]; C: CareerCopy; size?: number }) {
  const L = C.ladder;
  const nextId = rungs.find((r) => r.status === "locked")?.id ?? null;
  const start = windowStart(rungs, size);
  const shown = rungs.slice(start, start + size);

  return (
    <ol className="relative flex items-start justify-between gap-1">
      <span aria-hidden className="absolute left-5 right-5 top-5 h-0.5 rounded bg-line" />
      {shown.map((r) => (
        <li key={r.id} className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
          <RungBadge rung={r} highlight={r.id === nextId} />
          <span
            className={cx(
              "line-clamp-2 max-w-full text-[10px] font-semibold leading-tight hyphens-auto [overflow-wrap:anywhere]",
              r.status === "locked" ? "text-faint" : "text-ink",
            )}
          >
            {L.rung[r.id]}
          </span>
          {r.status === "locked" ? <span className="text-[9px] text-faint">{L.gate(r.gate)}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** Every rung as an icon list: badge, name, what it opens, its gate or state; the next locked rung outlined. */
export function LadderGrid({ rungs, C }: { rungs: LadderRungState[]; C: CareerCopy }) {
  const L = C.ladder;
  const nextId = rungs.find((r) => r.status === "locked")?.id ?? null;
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {rungs.map((r) => (
        <li
          key={r.id}
          className={cx(
            "flex items-center gap-2.5 rounded-lg border px-2.5 py-2",
            r.status === "owned" && "border-orange/40 bg-orange/[0.05]",
            r.status === "open" && "border-blue/40 bg-blue/[0.06]",
            r.status === "locked" && "border-line bg-white/[0.02]",
            r.id === nextId && "border-orange/60",
          )}
        >
          <RungBadge rung={r} />
          <span className="min-w-0 flex-1">
            <span className={cx("block truncate text-xs font-semibold", r.status === "locked" ? "text-sub" : "text-ink")}>{L.rung[r.id]}</span>
            <span className="block truncate text-[10px] text-faint">{L.hint[r.id]}</span>
          </span>
          <span className="shrink-0 text-[10px] font-semibold text-faint">
            {r.status === "locked" ? L.gate(r.gate) : r.status === "owned" ? L.owned : L.open}
          </span>
        </li>
      ))}
    </ul>
  );
}
