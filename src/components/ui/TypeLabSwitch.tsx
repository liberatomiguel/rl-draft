"use client";

/**
 * rc9 DS type lab (DESIGN-DECISIONS #213), staging and dev builds only.
 * - `TypeLabEffect` (root layout) applies the remembered face after hydration
 *   and reads `?type=chakra` / `?type=industry` from the address.
 * - `TypeLabSwitch` (Settings) is the control: two options, the chosen one in
 *   the orange hairline like the page's other short choices.
 */

import { useEffect, useState } from "react";
import { cx } from "@/lib/util";
import { useCopy } from "@/content/copy";
import { TYPE_FACES, TYPE_FACE_NAME, applyTypeFace, isTypeFace, readTypeFace, type TypeFace } from "./typeLab";

export function TypeLabEffect() {
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("type");
    if (isTypeFace(fromUrl)) applyTypeFace(fromUrl);
    else document.documentElement.dataset.type = readTypeFace();
  }, []);
  return null;
}

export function TypeLabSwitch({ className }: { className?: string }) {
  const S = useCopy().SETTINGS_UI;
  const [face, setFace] = useState<TypeFace>("industry");
  useEffect(() => {
    const sync = () => setFace(readTypeFace());
    sync();
    window.addEventListener("rd-type-lab", sync);
    return () => window.removeEventListener("rd-type-lab", sync);
  }, []);

  return (
    <div className={cx("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{S.typeLab}</p>
        <p className="mt-0.5 text-xs text-sub">{S.typeLabHint}</p>
      </div>
      <div role="group" aria-label={S.typeLab} className="flex shrink-0 gap-1.5">
        {TYPE_FACES.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={face === f}
            onClick={() => applyTypeFace(f)}
            className={cx(
              "min-h-11 rounded-md border px-4 text-sm transition-colors sm:min-h-9",
              face === f ? "border-orange/60 bg-white/[0.04] text-ink" : "border-line text-sub hover:border-line-strong hover:text-ink",
            )}
            // Each option is set in its own face, so the choice previews itself.
            style={{ fontFamily: f === "chakra" ? "var(--font-chakra)" : "var(--font-industry)", fontWeight: 600 }}
          >
            {TYPE_FACE_NAME[f]}
          </button>
        ))}
      </div>
    </div>
  );
}
