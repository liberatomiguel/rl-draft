"use client";

/**
 * v2.3 UI (U5, HQ): after a series of the user's club, a "Now" card invites
 * the manager's post. The series in one line, the three tones (each with its
 * hint), and the post itself once a tone is picked, so it is read before it
 * goes out; then Post, or Skip. Never holds the clock: unanswered, the next
 * series simply replaces it (`pendingFeedPostOf`). Nothing with the flag off.
 */

import { useState } from "react";
import { FEATURES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { managerPostDraftOf, scoreOf } from "@/engine/career/fanFeed";
import { feedTextOf } from "@/engine/career/fanFeedText";
import type { FanTone } from "@/engine/career/fanFeedTypes";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { pendingFeedPostOf } from "@/store/fanFeedFlow";
import { OrgMark } from "@/components/career/OrgMark";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

const TONES: FanTone[] = ["humble", "confident", "provocative"];

export function NowFeedPost({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const post = useCareerStore((s) => s.postToFeed);
  const [tone, setTone] = useState<FanTone | null>(null);
  /** The post just sent, kept on screen with a way to the feed. */
  const [sent, setSent] = useState<string | null>(null);
  if (!FEATURES.fanFeed || save.phase === "ended") return null;
  const series = pendingFeedPostOf(save);
  const F = C.feed;
  if (!series && sent) {
    return (
      <Panel className="p-4 sm:p-5">
        <div className="card-head">
          <h2 className="card-title">{F.ui.nowTitle}</h2>
          <AppLink href="/career/news#fans" className="text-xs font-semibold text-blue-bright underline-offset-4 hover:underline">
            {F.ui.toFeed}
          </AppLink>
        </div>
        <ManagerDraft save={save} text={sent} label={F.ui.posted} />
      </Panel>
    );
  }
  if (!series) return null;
  const draft = tone ? feedTextOf(managerPostDraftOf(save, series.opponentName, tone), F) : null;

  return (
    <Panel className="p-4 sm:p-5">
      <div className="card-head">
        <h2 className="card-title">{F.ui.nowTitle}</h2>
      </div>
      <p className="text-sm text-ink">{F.ui.series(series.won, scoreOf(series.us, series.them), series.opponentName, series.event)}</p>

      <div role="radiogroup" aria-label={F.ui.nowTitle} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TONES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tone === t}
            onClick={() => setTone(t)}
            className={cx(
              "flex min-h-11 flex-col items-start rounded-[7px] border px-3.5 py-2.5 text-left transition-colors",
              tone === t ? "border-blue-bright/70 bg-blue/10" : "border-line bg-white/[0.03] hover:border-line-strong",
            )}
          >
            <span className="display text-sm font-bold uppercase tracking-[0.04em] text-ink">{F.tones[t].label}</span>
            <span className="mt-0.5 text-xs leading-snug text-sub">{F.tones[t].hint}</span>
          </button>
        ))}
      </div>

      {draft ? (
        <div className="mt-3">
          <ManagerDraft save={save} text={draft} label={F.ui.preview} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-faint">{F.ui.pick}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="md" disabled={!tone} onClick={() => {
            if (!tone || !draft) return;
            setSent(draft);
            post(tone);
          }}>
          {F.ui.post}
        </Button>
        <Button variant="ghost" size="md" onClick={() => post("skip")}>
          {F.skip}
        </Button>
      </div>
      <p className="mt-2 text-xs text-faint">{F.ui.skipHint}</p>
    </Panel>
  );
}

/** The manager's post as the feed shows it: the club's mark, its name, the text. */
function ManagerDraft({ save, text, label }: { save: CareerSave; text: string; label: string }) {
  return (
    <div className="rounded-lg border border-blue/40 bg-white/[0.03] px-3 py-3">
      <div className="flex items-center gap-2">
        <OrgMark save={save} orgRef="user" size="xs" />
        <span className="truncate text-sm font-semibold text-ink">{save.identity.orgName}</span>
        <span className="text-[11px] text-faint">{label}</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink">{text}</p>
    </div>
  );
}
