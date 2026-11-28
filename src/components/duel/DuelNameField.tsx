"use client";

/** rc9 duel-ui: the optional name a side shows, with its visible label (the link carries at most 16 characters). */

import { useId } from "react";
import { DUEL_MATCH } from "@/config/balance";
import { useCopy } from "@/content/copy";

export function DuelNameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { DUEL_MATCH_UI: D } = useCopy();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="kicker mb-2 block text-faint">
        {D.nameLabel}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={DUEL_MATCH.maxNameLength}
        autoComplete="nickname"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
        className="min-h-11 w-full rounded-[7px] border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-faint"
      />
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-faint">
        {D.nameHint}
      </p>
    </div>
  );
}
