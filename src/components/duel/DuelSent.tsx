"use client";

/**
 * rc9 duel-ui: the challenger's own challenge, after the draft. Job: send the
 * link. The team is the game's cards with its overall (or "??" in a hidden
 * duel); the link has Send (the share sheet: the system sheet, WhatsApp, X,
 * Telegram, copy) and Copy. No result yet: the series pips stay empty until
 * the friend answers, and the line says so.
 */

import { useMemo, useState } from "react";
import { DUEL_MATCH } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { duelCodePath, type DuelChallenge } from "@/engine/duelLink";
import { copyTextToClipboard } from "@/lib/share/shareActions";
import { sfx } from "@/lib/sfx";
import { ShareSheet } from "@/components/share/ShareSheet";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { DuelMark, DuelRoster, RulesStrip, SeriesPips, SideName } from "./DuelParts";
import { duelTeamView } from "./duelTeam";
import { clearDuelHash, duelUrlOf } from "./duelNav";

export function DuelSent({ challenge }: { challenge: DuelChallenge }) {
  const { DUEL_MATCH_UI: D } = useCopy();
  const view = useMemo(() => duelTeamView(challenge.challenger.team, challenge.rules.mode), [challenge]);
  const url = useMemo(() => duelUrlOf(duelCodePath(challenge)), [challenge]);
  const [sheet, setSheet] = useState(false);
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const name = challenge.challenger.name || D.sideChallenger;
  const show = challenge.rules.showOverall;

  const copyLink = async () => {
    sfx.click();
    setCopy((await copyTextToClipboard(url)) ? "done" : "failed");
  };

  return (
    <div className="mx-auto max-w-5xl pb-8 rise-in">
      <SectionTitle title={D.sentTitle} kicker={D.sentLine} className="mb-4 sm:mb-6" />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* The team: the object the challenge is about. */}
        <Panel strong className="p-4 sm:p-6">
          <div className="card-head">
            <h2 className="card-title">{D.yourTeam}</h2>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <DuelMark view={view} name={name} />
              <SideName name={name} tone="orange" />
            </div>
            <div className="shrink-0 text-right">
              <p className="display text-5xl font-bold leading-none tabular-nums text-ink">{show ? view.overall : D.hiddenFigure}</p>
              <p className="kicker mt-1.5 text-faint">{D.teamOverall}</p>
            </div>
          </div>
          <DuelRoster view={view} showOverall={show} className="mt-6" />
        </Panel>

        {/* The link and the series still to come. */}
        <div className="space-y-4">
          <Panel strong className="p-4 sm:p-5">
            <div className="card-head">
              <h2 className="card-title">{D.linkLabel}</h2>
            </div>
            <input
              readOnly
              value={url}
              aria-label={D.linkLabel}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 w-full truncate rounded-[7px] border border-line bg-bg px-3 font-mono text-xs text-sub"
            />
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Button variant="primary" size="lg" full onClick={() => setSheet(true)}>
                {D.sendChallenge}
              </Button>
              <Button variant="secondary" full onClick={() => void copyLink()} aria-live="polite">
                {copy === "done" ? (
                  <>
                    <CheckIcon className="h-4 w-4" /> {D.copied}
                  </>
                ) : (
                  D.copyLink
                )}
              </Button>
            </div>
            {copy === "failed" ? (
              <p className="mt-2 text-xs text-bad" role="alert">
                {D.copyFailed}
              </p>
            ) : null}
          </Panel>

          <Panel className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="kicker text-faint">{D.bestOf(DUEL_MATCH.bestOf)}</span>
              <SeriesPips a={0} b={0} toneA="orange" toneB="blue" label={D.waiting} />
            </div>
            <p className="mt-3 text-sm text-sub">{D.waiting}</p>
          </Panel>
        </div>
      </div>

      <RulesStrip rules={challenge.rules} className="mt-6" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-faint">{D.exhibition}</p>
        <Button variant="ghost" size="sm" onClick={clearDuelHash}>
          {D.startOwn}
        </Button>
      </div>

      <ShareSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={D.sendChallenge}
        surface="duel"
        gameMode="draft"
        text={D.challengeText}
        url={url}
      />
    </div>
  );
}
