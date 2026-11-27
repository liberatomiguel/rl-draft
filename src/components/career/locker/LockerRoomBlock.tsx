"use client";

/**
 * v2.3 UI (U1, U2): the locker room on the Squad screen. One board:
 *   - the talks waiting for the manager, each as a conversation (U3);
 *   - the squad, one row per player: his face (the overall in its rarity
 *     frame), his name, the last thing that moved him as a sentence, and his
 *     mood; a tap opens the sheet that says why (U1);
 *   - the manager's word (kept and broken, as figures) and the open promises
 *     with their progress and deadline.
 * People first, no meters (Miguel: no second shelf of progress bars).
 * Renders nothing with FEATURES.lockerRoom off.
 */

import { useEffect, useState } from "react";
import { FEATURES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { lockerIssuesOf, moodOf, moraleOf, squadMoodOf, wordStandingOf } from "@/engine/career/lockerRoom";
import type { CareerSave } from "@/engine/career/types";
import { Panel } from "@/components/ui/Panel";
import { squadAge } from "@/components/career/careerUi";
import { LockerTalk } from "./LockerTalk";
import { PlayerMoodSheet, PromiseLines } from "./PlayerMoodSheet";
import { MoodMark, PlayerFace, lockerDateText, reasonSentence, useShownTalks } from "./lockerUi";

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
  const nameOf = (id: string) => save.squad.find((p) => p.id === id)?.name ?? "?";

  return (
    <Panel id="locker-room" className="scroll-mt-40 p-4 sm:p-5">
      <div className="card-head">
        <h2 className="card-title">{L.ui.title}</h2>
        <span className="flex items-center gap-2">
          <span className="text-xs text-sub">{L.ui.room}</span>
          <MoodMark mood={squadMoodOf(st, save.squad.map((p) => p.id))} C={C} />
        </span>
      </div>

      {shown.talks.length > 0 ? (
        <section className="mb-5">
          <h3 className="kicker mb-3">{L.ui.talks}</h3>
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

      {/* The squad's faces. */}
      <ul className="-mx-1 border-t border-line">
        {save.squad.map((p) => {
          const entry = st?.players[p.id];
          const mood = moodOf(moraleOf(st, p.id));
          return (
            <li key={p.id} className="border-b border-line">
              <button
                type="button"
                onClick={() => setOpen(p.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-md px-1 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <PlayerFace overall={p.overall} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-faint">{entry?.last ? reasonSentence(C, entry.last.reason) : `${C.player.age(squadAge(save, p))} · ${C.player.archetype[p.archetype]}`}</span>
                </span>
                <MoodMark mood={mood} C={C} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr] sm:gap-8">
        {/* The manager's word: two figures and what they mean. */}
        <section className="sm:max-w-56">
          <h3 className="kicker">{L.ui.word}</h3>
          <div className="mt-2 flex gap-6">
            <div>
              <p className="display text-2xl font-bold leading-none tabular-nums text-ink">{word.kept}</p>
              <p className="mt-1 text-xs text-sub">{L.ui.kept}</p>
            </div>
            <div>
              <p className={`display text-2xl font-bold leading-none tabular-nums ${word.broken > 0 ? "text-bad" : "text-ink"}`}>{word.broken}</p>
              <p className="mt-1 text-xs text-sub">{L.ui.broken}</p>
            </div>
          </div>
          <p className={`mt-2 text-xs leading-relaxed ${standing === "damaged" ? "font-semibold text-orange-bright" : "text-sub"}`}>{L.ui.wordLine[standing]}</p>
        </section>

        <section className="min-w-0">
          <h3 className="kicker">{L.ui.promises}</h3>
          {issues.promises.length === 0 ? (
            <p className="mt-2 text-sm text-sub">{L.ui.noPromises}</p>
          ) : (
            <div className="mt-2 space-y-3">
              {issues.promises.map((p) => (
                <PromiseLines key={p.id} C={C} promise={p} name={nameOf(p.playerId)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <PlayerMoodSheet save={save} C={C} playerId={open} onClose={() => setOpen(null)} />
    </Panel>
  );
}
