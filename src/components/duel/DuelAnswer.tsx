"use client";

/**
 * rc9 duel-ui: a friend's challenge, opened from the link. Job: say who
 * challenged and under which rules, then draft. The challenger's name is the
 * figure; the rules are a strip of figures; their team is the backs of its
 * cards (sealed until the match, so nobody drafts against it); one button.
 * A draft for this challenge left half-way offers Resume and Start over.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCopy } from "@/content/copy";
import type { DuelChallenge } from "@/engine/duelLink";
import { isStaleDuel } from "@/engine/duelRules";
import { sfx } from "@/lib/sfx";
import { lastDuelName, saveDuelName } from "@/store/duelStore";
import { useRunStore } from "@/store/runStore";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { DuelNameField } from "./DuelNameField";
import { RulesStrip, SealedRoster } from "./DuelParts";
import { DuelResume } from "./DuelResume";
import { openDuelCode } from "./duelNav";

export function DuelAnswer({ challenge, challengeCode }: { challenge: DuelChallenge; challengeCode: string }) {
  const { DUEL_MATCH_UI: D } = useCopy();
  const router = useRouter();
  const run = useRunStore((s) => s.run);
  const startDuelMatch = useRunStore((s) => s.startDuelMatch);
  const [name, setName] = useState<string>(() => lastDuelName());
  const [failed, setFailed] = useState(false);
  const challenger = challenge.challenger.name || D.aFriend;
  const cards = challenge.rules.mode === "quick" ? 3 : 6;
  const resumable = run?.duelMatch && !run.duelMatch.done && run.duelMatch.challenge === challengeCode ? run : null;

  const start = () => {
    sfx.start();
    saveDuelName(name.trim());
    if (!startDuelMatch({ rules: challenge.rules, role: "opponent", name, challenge: challengeCode })) {
      setFailed(true);
      return;
    }
    router.push("/play");
  };

  return (
    <div className="mx-auto max-w-3xl pb-8 rise-in">
      <SectionTitle title={D.answerTitle} className="mb-4 sm:mb-6" />

      <Panel strong className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:items-center">
          <div className="min-w-0">
            <p className="display break-words text-4xl font-bold leading-[1.05] text-ink sm:text-5xl">{challenger}</p>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-sub">{D.answerLine}</p>
          </div>
          <div>
            <SealedRoster count={cards} label={`${D.sealedTitle}. ${D.sealedLine}`} />
            <p className="mt-2 text-center text-xs text-faint">
              <span className="text-sub">{D.sealedTitle}</span> · {D.sealedLine}
            </p>
          </div>
        </div>
        <RulesStrip rules={challenge.rules} className="mt-6" />
        {isStaleDuel(challenge.rules) ? <p className="mt-3 text-sm text-sub">{D.staleVersion}</p> : null}
      </Panel>

      {resumable ? (
        <DuelResume run={resumable} className="mt-6" onStartOver={start} />
      ) : (
        <>
          <div className="mt-6 max-w-sm">
            <DuelNameField value={name} onChange={setName} />
          </div>
          {failed ? (
            <p className="mt-4 text-sm text-bad" role="alert">
              {D.startFailed}
            </p>
          ) : null}
          <div className="action-dock mt-6 sm:flex sm:items-center sm:gap-5">
            <Button variant="primary" size="lg" full className="sm:w-auto sm:min-w-64" onClick={start}>
              {D.answerDraft}
            </Button>
            <p className="mt-2 text-xs text-faint max-sm:hidden sm:mt-0">{D.exhibition}</p>
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-faint sm:hidden">{D.exhibition}</p>
    </div>
  );
}

/** The challenge was answered in this browser: the series is ready. */
export function DuelAnswered({ challenge, reply }: { challenge: DuelChallenge; reply: string }) {
  const { DUEL_MATCH_UI: D } = useCopy();
  const challenger = challenge.challenger.name || D.aFriend;
  return (
    <div className="mx-auto max-w-3xl pb-8 rise-in">
      <SectionTitle title={D.answeredTitle} className="mb-4 sm:mb-6" />
      <Panel strong className="p-4 sm:p-6">
        <p className="display break-words text-4xl font-bold leading-[1.05] text-ink">{challenger}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-sub">{D.answeredLine}</p>
        <RulesStrip rules={challenge.rules} className="mt-6" />
        <div className="mt-6">
          <Button variant="primary" size="lg" className="max-sm:w-full" onClick={() => openDuelCode(reply)}>
            {D.watchSeries}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
