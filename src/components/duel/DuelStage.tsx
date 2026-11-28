"use client";

/**
 * rc9 duel-ui: the duel's screens behind /duel's light router (the lazy chunk
 * with the dataset, the run store and the series engine). It checks what the
 * link parser cannot (cards and a region this version knows), clears a run
 * that is not a duel draft in progress, and picks the screen for this browser:
 * its own challenge reads "send it", a stranger's reads "answer it", a reply
 * plays the series.
 */

import { useEffect, useMemo } from "react";
import { REGION_LOCK } from "@/config/balance";
import { encodeDuelCode, makeDuelChallenge, type DuelCode } from "@/engine/duelLink";
import { isKnownDuelTeam } from "@/engine/duelMatch";
import { myDuelSide } from "@/store/duelStore";
import { useRunStore } from "@/store/runStore";
import { DuelLinkError } from "./DuelLinkError";
import { DuelAnswer, DuelAnswered } from "./DuelAnswer";
import { DuelMatch } from "./DuelMatch";
import { DuelSent } from "./DuelSent";
import { DuelStart } from "./DuelStart";

function linkProblem(code: DuelCode): "unknownCards" | "region" | null {
  const { rules } = code;
  if (rules.region && !REGION_LOCK.regions.includes(rules.region)) return "region";
  const teams = code.kind === "reply" ? [code.challenger.team, code.opponent.team] : [code.challenger.team];
  return teams.every((t) => isKnownDuelTeam(t, rules.mode)) ? null : "unknownCards";
}

export function DuelStage({ code }: { code: DuelCode | null }) {
  const run = useRunStore((s) => s.run);
  const clearRun = useRunStore((s) => s.clearRun);

  // /duel keeps only a duel's draft in progress (AppShell leaves it alone here).
  useEffect(() => {
    if (run && (!run.duelMatch || run.duelMatch.done)) clearRun();
  }, [run, clearRun]);

  const problem = useMemo(() => (code ? linkProblem(code) : null), [code]);
  const challengeCode = useMemo(
    () => (code ? encodeDuelCode(code.kind === "challenge" ? code : makeDuelChallenge(code.rules, code.challenger)) : null),
    [code],
  );

  if (problem) return <DuelLinkError reason={problem} />;
  if (!code || !challengeCode) return <DuelStart />;
  const mine = myDuelSide(challengeCode);
  if (code.kind === "challenge") {
    if (mine?.role === "challenger") return <DuelSent challenge={code} />;
    if (mine?.role === "opponent" && mine.reply) return <DuelAnswered challenge={code} reply={mine.reply} />;
    return <DuelAnswer challenge={code} challengeCode={challengeCode} />;
  }
  return <DuelMatch key={encodeDuelCode(code)} reply={code} viewer={mine?.role === "opponent" ? "opponent" : "challenger"} />;
}
