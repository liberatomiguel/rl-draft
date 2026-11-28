"use client";

/**
 * v2.3 UI (U1, U2): the locker room on the Squad screen. One board in the
 * right column, under the season stats (rc9 DS, #218):
 *   - the talks waiting for the manager, each as a conversation (U3);
 *   - the open promises with their progress and deadline;
 *   - the manager's word (kept and broken) as one line under them.
 * Each player's mood is shown with the player (his tile and contract row on
 * Squad, his mood sheet), not as a second roster here.
 * People first, no meters (Miguel: no second shelf of progress bars).
 * Renders nothing with FEATURES.lockerRoom off.
 */

import { useEffect, useState } from "react";
import { FEATURES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { lockerIssuesOf, squadMoodOf, wordStandingOf } from "@/engine/career/lockerRoom";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { Panel } from "@/components/ui/Panel";
import { LockerTalk } from "./LockerTalk";
import { PlayerMoodSheet, PromiseLines } from "./PlayerMoodSheet";
import { lockerSquadViewOf } from "@/engine/career/lockerRoomView";
import { MoodMark, TrendMark, lockerDateText, useShownTalks } from "./lockerUi";

export function LockerRoomBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = useShownTalks(save);
  // HQ's links land here (#locker-room); the screen renders after the save loads, so the browser's own jump misses it.
  useEffect(() => {
    if (window.location.hash === "#locker-room") document.getElementById("locker-room")?.scrollIntoView({ block: "start" });
  }, []);
  if (!FEATURES.lockerRoom) return null;
  const L = C.locker;
  const st = save.lockerRoom;
  const issues = lockerIssuesOf(save);
  const word = st?.word ?? { kept: 0, broken: 0 };
  const standing = wordStandingOf(word);
  // rc.9 integration: the room's trend is the side more players are moving to (lockerRoomView).
  const views = lockerSquadViewOf(save);
  const ups = views.filter((v) => v.trend === "up").length;
  const downs = views.filter((v) => v.trend === "down").length;
  const roomTrend = ups > downs ? "up" : downs > ups ? "down" : "steady";
  const nameOf = (id: string) => save.squad.find((p) => p.id === id)?.name ?? "?";

  return (
    <Panel id="locker-room" className="scroll-mt-40 p-4 sm:p-5">
      <div className="card-head">
        <h2 className="card-title">{L.ui.title}</h2>
        <span className="flex items-center gap-2">
          <span className="text-xs text-sub">{L.ui.room}</span>
          <MoodMark mood={squadMoodOf(st, save.squad.map((p) => p.id))} C={C} />
          <TrendMark trend={roomTrend} C={C} />
        </span>
      </div>

      {shown.talks.length > 0 ? (
        <section className="mb-6">
          <h3 className="kicker mb-3 text-orange-bright">{L.ui.talks}</h3>
          {/* The first talk in full; the others as rows that open the player's sheet, where they are answered. */}
          <LockerTalk save={save} C={C} talk={shown.talks[0]} linkToSquad={false} onAnswered={shown.keep} />
          {shown.talks.length > 1 ? (
            <ul className="mt-4 border-t border-line">
              {shown.talks.slice(1).map((t) => (
                <li key={t.id} className="border-b border-line">
                  <button type="button" onClick={() => setOpen(t.playerId)} className="flex min-h-11 w-full flex-wrap items-baseline justify-between gap-x-3 py-2.5 text-left">
                    <span className="text-sm font-semibold text-ink">{L.mail.tpl[`lockerTalk_${t.topic}`]?.({ player: nameOf(t.playerId) })}</span>
                    <span className="text-xs text-faint">{L.ui.answerBy(lockerDateText(C, t.deadline))}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* rc9 DS (#218): each player's mood now lives with him (his tile, his contract row,
          his sheet). This block keeps what asks for the manager: the talks and the promises,
          and the standing of his word as one line under them. */}
      <section>
        <h3 className="kicker">{L.ui.promises}</h3>
        {issues.promises.length === 0 ? (
          <p className="mt-2 text-sm text-sub">{L.ui.noPromises}</p>
        ) : (
          <div className="mt-3 space-y-4">
            {issues.promises.map((p) => (
              <PromiseLines key={p.id} C={C} promise={p} name={nameOf(p.playerId)} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 border-t border-line pt-4">
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-sub">
          <span className="kicker">{L.ui.word}</span>
          <span>
            <span className="font-semibold tabular-nums text-ink">{word.kept}</span> {L.ui.kept}
          </span>
          <span>
            <span className={cx("font-semibold tabular-nums", word.broken > 0 ? "text-bad" : "text-ink")}>{word.broken}</span> {L.ui.broken}
          </span>
        </p>
        <p className={cx("mt-1.5 text-xs", standing === "damaged" ? "font-semibold text-orange-bright" : "text-faint")}>{L.ui.wordLine[standing]}</p>
      </div>

      <PlayerMoodSheet save={save} C={C} playerId={open} onClose={() => setOpen(null)} />
    </Panel>
  );
}
