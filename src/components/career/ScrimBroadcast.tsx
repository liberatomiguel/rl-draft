"use client";

import { useEffect, useState } from "react";
import { CAREER_PLAYBACK } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave, ScrimLogEntry } from "@/engine/career/types";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";
import { useCareerStore } from "@/store/careerStore";
import { OrgMark } from "./OrgMark";

/** Session controller only. Presentation belongs inside the week's practice list. */
export function ScrimBroadcast() {
  const entry = useCareerStore(s => s.scrimPlayback);
  const finish = useCareerStore(s => s.finishScrimPlayback);
  const reduced = useOsReducedMotion();
  useEffect(() => {
    if (!entry) return;
    const duration = reduced ? CAREER_PLAYBACK.scrimReducedMotionMs : Math.max(1, entry.games.length) * CAREER_PLAYBACK.scrimGameMs;
    const timer = setTimeout(() => finish(entry.id), duration);
    return () => clearTimeout(timer);
  }, [entry, finish, reduced]);
  return null;
}

/** Reveal stored game winners; never simulate or grant rewards from the UI. */
export function ScrimSeriesRow({ entry, save, C }: { entry: ScrimLogEntry; save: CareerSave; C: CareerCopy }) {
  const reduced = useOsReducedMotion();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setCount(n => Math.min(entry.games.length, n + 1)), CAREER_PLAYBACK.scrimGameMs);
    return () => clearInterval(timer);
  }, [entry.games.length, reduced]);
  const games = entry.games.slice(0, reduced ? entry.games.length : count).map(g => g.split("-").map(Number));
  const a = games.filter(([x,y]) => x > y).length;
  const b = games.filter(([x,y]) => y > x).length;
  return <li className="flex min-w-0 items-center gap-2 rounded-lg border border-line/60 bg-white/[0.025] px-2.5 py-2 text-xs" aria-label={C.scrim.live}>
    <span className="w-6 shrink-0 text-[10px] text-faint">{C.dates.weekdays[(entry.day - 1) % 7]}</span>
    <OrgMark save={save} orgRef="user" size="sm" />
    <span className="min-w-0 flex-1 truncate text-sub">{save.identity.abbrev}</span>
    <span key={count} className="rounded-md bg-black/20 px-2 py-1 font-mono text-sm font-bold tabular-nums text-sub motion-safe:animate-pulse">{a}–{b}</span>
    <span className="min-w-0 flex-[2] truncate text-sub">{entry.oppName}</span>
    <OrgMark save={save} orgRef={entry.oppRef} size="sm" />
  </li>;
}
