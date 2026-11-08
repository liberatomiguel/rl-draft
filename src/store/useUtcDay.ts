"use client";
import { useEffect, useState } from "react";
import { todayKey } from "@/lib/dailyPlan";

/** Refresh an open daily surface at UTC midnight and after a suspended tab wakes. */
export function useUtcDay(): string {
  const [day, setDay] = useState(() => todayKey());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setDay(todayKey());
      clearTimeout(timer);
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      timer = setTimeout(refresh, next - now.getTime());
    };
    // The first refresh happens in the timer/event callback, outside the effect.
    const now = new Date();
    timer = setTimeout(refresh, Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return day;
}
