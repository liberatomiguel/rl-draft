"use client";

import { useEffect, useState } from "react";
import { CAREER_PLAYBACK } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import type { ScrimLogEntry } from "@/engine/career/types";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { OrgMark } from "./OrgMark";
import { ClockDigits } from "./event/GameClock";

/** Reveals an already recorded series. No simulation, rewards or save writes per tick. */
function Playback({ entry }: { entry: ScrimLogEntry }) {
  const C = useCareerCopy();
  const save = useCareerStore(selectActiveSave);
  const finish = useCareerStore((s) => s.finishScrimPlayback);
  const reduced = useOsReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const count = Math.max(1, entry.games.length);
  const duration = reduced ? CAREER_PLAYBACK.scrimReducedMotionMs : count * CAREER_PLAYBACK.scrimGameMs;
  useEffect(() => {
    const start = performance.now();
    const done = setTimeout(() => finish(entry.id), duration);
    const tick = reduced ? null : setInterval(() => setElapsed(Math.min(duration, performance.now() - start)), 100);
    return () => { clearTimeout(done); if (tick) clearInterval(tick); };
  }, [entry.id, duration, finish, reduced]);
  if (!save) return null;
  const completed = reduced ? count : Math.min(count, Math.floor(elapsed / CAREER_PLAYBACK.scrimGameMs));
  const scores = entry.games.slice(0, completed).map((g) => g.split("-").map(Number));
  const a = reduced ? entry.scoreA : scores.filter(([x, y]) => x > y).length;
  const b = reduced ? entry.scoreB : scores.filter(([x, y]) => y > x).length;
  const remaining = Math.ceil(300 * (1 - (elapsed % CAREER_PLAYBACK.scrimGameMs) / CAREER_PLAYBACK.scrimGameMs));
  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <aside className="sticky top-24 z-20 mx-auto max-w-6xl px-3 pt-3 sm:px-4" aria-label={C.scrim.live}>
      <div className="overflow-hidden rounded-xl border border-blue/40 bg-raised">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs text-sub"><span className="h-1.5 w-1.5 rounded-full bg-cyan" aria-hidden /><span className="font-semibold text-ink">{C.scrim.live}</span><span>{C.scrim.game(Math.min(count, completed + 1))}</span></div>
          <div className="flex min-w-0 items-center gap-2.5 text-xs">
            <OrgMark save={save} orgRef="user" size="sm" /><span className="font-semibold text-ink">{save.identity.abbrev}</span>
            <span className="font-mono text-base font-bold tabular-nums text-ink">{a}–{b}</span>
            <span className="max-w-40 truncate text-sub">{entry.oppName}</span><OrgMark save={save} orgRef={entry.oppRef} size="sm" />
          </div>
          {reduced ? <span className="text-xs text-sub">{C.scrim.schedule}</span> : <ClockDigits text={clock} className="font-mono text-xs text-cyan" />}
        </div>
        {!reduced ? <div className="h-0.5 origin-left bg-blue-bright" style={{ transform: `scaleX(${Math.min(1, elapsed / duration)})` }} aria-hidden /> : null}
      </div>
    </aside>
  );
}

export function ScrimBroadcast() {
  const entry = useCareerStore((s) => s.scrimPlayback);
  return entry ? <Playback key={entry.id} entry={entry} /> : null;
}
