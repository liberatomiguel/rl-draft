"use client";

/** Profile: rank, XP, lifetime stats, achievements and run history. */

import { useState } from "react";
import { achievements as achievementDefs, specialCards } from "@/data";
import { DIFFICULTY } from "@/config/balance";
import { PROFILE_UI as P } from "@/content/copy";
import { rankForXp } from "@/engine/progression";
import type { Placement } from "@/engine/types";
import { cx, formatDate } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import {
  selectBestClear,
  selectChampionships,
  useProfileStore,
} from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

const PLACEMENT_SHORT: Record<Placement, string> = {
  champion: "Champion",
  runner_up: "Finalist",
  semifinalist: "Top 4",
  quarterfinalist: "Top 8",
  swiss_exit: "Swiss",
};

export default function ProfilePage() {
  const mounted = useMounted();
  const profile = useProfileStore();
  const titles = useProfileStore(selectChampionships);
  const bestClear = useProfileStore(selectBestClear);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!mounted) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy />;
  }

  const rank = rankForXp(profile.xp);
  const unlockedCount = Object.keys(profile.unlockedSpecials).length;
  const earned = profile.achievements;

  return (
    <div className="rise-in">
      <SectionTitle kicker="Career" title={P.title} className="mb-6" />

      {/* Rank header */}
      <Panel strong glow="blue" className="mb-6 flex flex-col items-center gap-6 p-6 sm:flex-row">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-orange/50 bg-gradient-to-br from-blue/20 to-orange/15 shadow-[0_0_28px_rgba(59,130,246,0.25)]">
          <span className="display text-center text-sm font-bold uppercase leading-tight tracking-wide text-ink">
            {rank.label}
          </span>
        </div>
        <div className="w-full min-w-0 flex-1 text-center sm:text-left">
          <p className="kicker mb-1">{P.rank}</p>
          <p className="display text-3xl font-bold uppercase tracking-wide text-ink">{rank.label}</p>
          <div className="mt-3">
            <ProgressBar value={rank.progress} tone="orange" label={P.rank} />
            <p className="mt-1.5 text-xs text-sub">
              {profile.xp} {P.xp}
              {rank.next ? <span className="text-faint"> · {P.toNext(rank.xpToNext)}</span> : (
                <span className="text-faint"> · {P.maxRank}</span>
              )}
            </p>
          </div>
        </div>
      </Panel>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.runs} value={String(profile.runsCompleted)} />
        <StatTile label={P.titles} value={String(titles)} />
        <StatTile
          label={P.bestClear}
          value={bestClear ? DIFFICULTY[bestClear].label : P.none}
        />
        <StatTile label={P.specials} value={`${unlockedCount}/${specialCards.length}`} />
      </div>

      {/* Achievements */}
      <SectionTitle
        title={P.achievements}
        right={
          <Badge tone="blue">
            {Object.keys(earned).length}/{achievementDefs.length}
          </Badge>
        }
        className="mb-4"
      />
      <div className="mb-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {achievementDefs.map((def) => {
          const date = earned[def.id];
          return (
            <Panel
              key={def.id}
              className={cx("flex items-start gap-3 p-3.5", !date && "opacity-45")}
            >
              <span
                className={cx(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  date ? "bg-orange/15 text-orange-bright" : "bg-white/5 text-faint",
                )}
              >
                <TrophyIcon />
              </span>
              <span className="min-w-0">
                <span className="display block truncate text-sm font-bold uppercase tracking-wide text-ink">
                  {def.title}
                </span>
                <span className="block text-xs leading-snug text-sub">{def.description}</span>
                <span className="mt-0.5 block text-[10px] text-faint">
                  {date ? formatDate(date) : `+${def.xp} XP`}
                </span>
              </span>
            </Panel>
          );
        })}
      </div>

      {/* Run history */}
      <SectionTitle title={P.history} className="mb-4" />
      {profile.runHistory.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-sub">{P.emptyHistory}</Panel>
      ) : (
        <div className="space-y-2">
          {profile.runHistory.map((run) => (
            <Panel key={run.runId} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5 text-sm">
              <Badge tone={run.placement === "champion" ? "gold" : "neutral"} className="w-20 justify-center">
                {PLACEMENT_SHORT[run.placement]}
              </Badge>
              <span className="display font-bold text-ink">
                {run.swissRecord.wins}–{run.swissRecord.losses}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-sub">
                {run.rosterNames.join(" · ")}
              </span>
              <Badge tone="blue">{DIFFICULTY[run.difficulty].label}</Badge>
              {run.hiddenOverall ? <Badge tone="neutral">Hidden</Badge> : null}
              <span className="display text-xs font-bold text-orange-bright">+{run.xpGained} XP</span>
              <span className="text-[11px] text-faint">{formatDate(run.date)}</span>
            </Panel>
          ))}
        </div>
      )}

      {/* Danger zone */}
      <div className="mt-10 flex justify-center">
        <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
          {P.reset}
        </Button>
      </div>

      <Modal
        open={confirmReset}
        title={P.resetConfirmTitle}
        onClose={() => setConfirmReset(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                profile.resetAll();
                setConfirmReset(false);
              }}
            >
              {P.resetConfirm}
            </Button>
          </>
        }
      >
        {P.resetConfirmBody}
      </Modal>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4 text-center">
      <p className="kicker !text-[10px]">{label}</p>
      <p className="display mt-1 truncate text-2xl font-bold text-ink">{value}</p>
    </Panel>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" strokeLinejoin="round" />
      <path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4m-3 3h6m-5-3h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
