"use client";

/**
 * Locker (v2.0): everything the player owns or can still earn, by kind. Click an
 * owned item to equip it; "Auto" shows the best owned item, "None" hides the
 * slot; badges are a multi-select of up to three. Locked items show how to get
 * them. Shared by the profile page.
 */

import { useState } from "react";
import { RANKS } from "@/config/balance";
import { SEASON } from "@/config/season";
import { COSMETICS, type CosmeticDef, type CosmeticKind, type CosmeticSource } from "@/data/cosmetics";
import { MAX_BADGES, NONE, resolveEquipped } from "@/engine/cosmetics";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { CosmeticPreview } from "./CosmeticViews";

const KINDS: CosmeticKind[] = ["title", "badge", "frame", "banner"];

const rankLabel = (id: string): string => RANKS.find((r) => r.id === id)?.label ?? id;

export function sourceLabel(source: CosmeticSource, C: ReturnType<typeof useCopy>["COSMETICS"]): string {
  switch (source.type) {
    case "legacy-participation":
      return C.sources["legacy-participation"];
    case "legacy-rank":
      return C.sources["legacy-rank"](rankLabel(source.rankId));
    case "legacy-position":
      return C.sources["legacy-position"](source.maxPosition);
    case "grant":
      return C.sources[`grant-${source.grantId}`];
    case "season-rank":
      return C.sources["season-rank"](rankLabel(source.rankId), SEASON.name);
    case "login-streak":
      return C.sources["login-streak"](source.days);
    case "challenge-stars":
      return C.sources["challenge-stars"](source.stars);
    case "quiz-solved":
      return C.sources["quiz-solved"](source.count);
    case "missions-completed":
      return C.sources["missions-completed"](source.count);
  }
}

const TIER_RING: Record<CosmeticDef["tier"], string> = {
  common: "!border-slate-400/35",
  rare: "!border-blue/45",
  epic: "!border-violet-400/50",
  legend: "!border-amber-300/60 shadow-[0_0_18px_rgba(251,191,36,0.16)]",
};

export function CosmeticsLocker() {
  const { COSMETICS: C, PROFILE_UI: P } = useCopy();
  const cosmetics = useProfileStore((s) => s.cosmetics);
  const setEquipped = useProfileStore((s) => s.setEquipped);
  const [kind, setKind] = useState<CosmeticKind>("title");
  // Captured once per mount (render must stay pure); "NEW" = owned under a week.
  const [now] = useState(() => Date.now());
  const resolved = resolveEquipped(cosmetics);
  const items = COSMETICS.filter((c) => c.kind === kind);
  const owned = items.filter((c) => cosmetics.owned[c.id]);
  const locked = items.filter((c) => !cosmetics.owned[c.id]);
  const explicit = kind === "badge" ? null : cosmetics.equipped[kind];
  const shownIds = new Set(
    kind === "badge" ? resolved.badges.map((b) => b.id) : [resolved[kind]?.id].filter(Boolean),
  );
  const isNew = (id: string) => now - Date.parse(cosmetics.owned[id] ?? "") < 7 * 86_400_000;

  const choose = (def: CosmeticDef) => {
    sfx.click();
    if (def.kind === "badge") {
      const current = cosmetics.equipped.badges ?? resolved.badges.map((b) => b.id);
      const next = current.includes(def.id)
        ? current.filter((id) => id !== def.id)
        : [...current, def.id].slice(-MAX_BADGES);
      setEquipped({ badges: next });
    } else {
      setEquipped({ [def.kind]: def.id });
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {KINDS.map((k) => {
          const total = COSMETICS.filter((c) => c.kind === k).length;
          const have = COSMETICS.filter((c) => c.kind === k && cosmetics.owned[c.id]).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                sfx.click();
                setKind(k);
              }}
              className={cx(
                "display rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
                kind === k ? "bg-orange/15 text-orange-bright" : "text-sub hover:text-ink",
              )}
            >
              {C.kindsPlural[k]} <span className="text-faint">{have}/{total}</span>
            </button>
          );
        })}
      </div>

      {kind !== "badge" ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <ChoiceChip active={explicit === null} onClick={() => setEquipped({ [kind]: null })}>
            {C.auto}
          </ChoiceChip>
          <ChoiceChip active={explicit === NONE} onClick={() => setEquipped({ [kind]: NONE })}>
            {C.none}
          </ChoiceChip>
        </div>
      ) : (
        <p className="mb-3 text-xs text-faint">{P.lockerHint}</p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {owned.map((def) => {
          const shown = shownIds.has(def.id);
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => choose(def)}
              className={cx(
                "panel flex items-center gap-2 p-2.5 text-left transition-colors hover:!border-line-strong",
                TIER_RING[def.tier],
                shown && "ring-1 ring-orange/60",
              )}
            >
              <CosmeticPreview id={def.id} className="min-w-0 flex-1" />
              <span className="flex shrink-0 flex-col items-end gap-1">
                {shown ? <Badge tone="orange">{C.equipped}</Badge> : null}
                {isNew(def.id) ? <Badge tone="good">{C.newTag}</Badge> : null}
              </span>
            </button>
          );
        })}
        {locked.map((def) => (
          <div key={def.id} className="panel flex items-center gap-2 p-2.5 opacity-55">
            <CosmeticPreview id={def.id} className="min-w-0 flex-1" />
            <span className="max-w-[9rem] shrink-0 text-right text-[10px] leading-snug text-faint">
              {sourceLabel(def.source, C)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChoiceChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        sfx.click();
        onClick();
      }}
      className={cx(
        "display rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
        active ? "border-orange/50 bg-orange/10 text-orange-bright" : "border-line text-sub hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
