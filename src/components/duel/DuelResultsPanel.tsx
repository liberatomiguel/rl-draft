"use client";

/**
 * Friend duel (v2.1): the duel's board on the results screen, in place of the
 * XP panel (a duel pays nothing). The verdict, the standings with this run
 * added, and the way out: share the link (Web Share API where the browser has
 * it, copy otherwise), or run the same duel again.
 */

import { useMemo, useRef, useState } from "react";
import { useCopy } from "@/content/copy";
import { capEntries, duelEntryFromResults, duelPath, duelVerdict } from "@/engine/duel";
import { displayTeamOverall } from "@/engine/rating";
import type { RunState } from "@/engine/types";
import { trackDuelShared } from "@/store/duelStore";
import { useRunStore } from "@/store/runStore";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { DuelStandings, usePlacementLabel } from "./DuelStandings";

type CopyState = "idle" | "copied" | "failed";

export function DuelResultsPanel({ run }: { run: RunState }) {
  const { DUEL_UI: D } = useCopy();
  const placementLabel = usePlacementLabel();
  const restartRun = useRunStore((s) => s.restartRun);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const linkField = useRef<HTMLInputElement>(null);

  const team = run.tournament?.teams["user"];
  const duel = run.duel;
  const results = run.results;
  const data = useMemo(() => {
    if (!duel || !results) return null;
    const mine = duelEntryFromResults(results, team ? displayTeamOverall(team.rating) : 0);
    // The link that goes out: this run joins the ones before it (the first run
    // and the latest replies are kept once the link is full).
    const entries = capEntries([...duel.entries, mine]);
    return { mine, entries, verdict: duelVerdict(mine, duel.entries), path: duelPath({ setup: duel.setup, entries }) };
  }, [duel, results, team]);
  if (!duel || !results || !data) return null;

  const url = typeof window === "undefined" ? data.path : `${window.location.origin}${data.path}`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const first = duel.entries.length === 0;
  const { beat, lost } = data.verdict;
  const verdict = first
    ? D.verdictFirst
    : lost > 0
      ? D.verdictLose(lost)
      : beat === duel.entries.length
        ? D.verdictWin
        : D.verdictLevel;
  const shareText = D.shareText(placementLabel(results.placement));
  // Where this run sits in the standings (the last entry of the outgoing link).
  const youIndex = data.entries.length - 1;

  const onNativeShare = async () => {
    try {
      await navigator.share({ title: D.kicker, text: shareText, url });
      trackDuelShared(run, data.entries.length, "native");
    } catch {
      // Cancelled, or the share sheet refused: the copy button stays.
    }
  };

  const onCopy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // The async clipboard is refused in some browsers and webviews: copy the
      // selected link field the old way.
      try {
        linkField.current?.select();
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    setCopyState(ok ? "copied" : "failed");
    if (ok) trackDuelShared(run, data.entries.length, "copy");
  };

  return (
    <Panel strong glow="orange" className="mb-8 p-5">
      <p className="kicker mb-1">{D.resultTitle}</p>
      <p className="display text-2xl font-bold uppercase leading-tight text-ink">{verdict}</p>
      <p className="mt-1 text-xs text-faint">{D.exhibition}</p>

      <div className="mt-4">
        <DuelStandings entries={data.entries} mode={duel.setup.mode} youIndex={youIndex} />
      </div>

      <div className="mt-5">
        <p className="kicker mb-1">{D.shareTitle}</p>
        <p className="text-sm text-sub">{first ? D.shareHintFirst : D.shareHintReply}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canNativeShare ? (
            <Button variant="secondary" onClick={() => void onNativeShare()}>
              {D.shareNative}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => void onCopy()}>
            {copyState === "copied" ? D.copied : D.copyLink}
          </Button>
          <Button variant="ghost" onClick={restartRun}>
            {D.runItBack}
          </Button>
        </div>
        {copyState === "failed" ? <p className="mt-2 text-xs text-bad">{D.copyFailed}</p> : null}
        <input
          ref={linkField}
          readOnly
          value={url}
          aria-label={D.shareTitle}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full min-w-0 truncate rounded-sm border border-line bg-white/[0.03] px-3 py-2 text-xs text-sub"
        />
      </div>
    </Panel>
  );
}
