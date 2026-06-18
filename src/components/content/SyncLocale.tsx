"use client";

import { useEffect } from "react";
import { useSettings } from "@/store/settingsStore";

/**
 * Aligns the session language to a page's locale. Rendered on /pt routes so a
 * visitor who lands on a Portuguese URL (from search or a shared link) gets the
 * whole UI — header, footer, game — in PT, matching the content they opened.
 * Renders nothing. EN routes deliberately do NOT force EN: they respect a
 * returning player's saved preference (like the rest of the app).
 */
export function SyncLocale({ locale }: { locale: "en" | "pt" }) {
  useEffect(() => {
    const s = useSettings.getState();
    if (s.lang !== locale) s.set("lang", locale);
  }, [locale]);
  return null;
}
