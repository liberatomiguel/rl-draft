"use client";

/**
 * v2.3 UI (U2, HQ): the locker room's "Now" card. Shows only when something
 * needs the manager: a talk waiting (a transfer request is one), or a minutes
 * promise one bench away from breaking. The first talk is answerable here;
 * the rest wait in the locker room. Never holds the clock: an unanswered talk
 * answers itself after a week (the talk says so). Nothing with the flag off.
 */

import { CAREER_LOCKER, FEATURES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { lockerAttentionOf } from "@/engine/career/lockerRoom";
import type { CareerSave } from "@/engine/career/types";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { LockerTalk } from "./LockerTalk";
import { PromiseLines } from "./PlayerMoodSheet";
import { PlayerFace, lockerDateText, useShownTalks } from "./lockerUi";

const ANSWER_PARAMS = { need: CAREER_LOCKER.promise.minutesNeed, of: CAREER_LOCKER.promise.minutesOf };

export function NowLocker({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const shown = useShownTalks(save);
  if (!FEATURES.lockerRoom || save.phase === "ended") return null;
  const { atRisk } = lockerAttentionOf(save);
  const talks = shown.talks;
  if (talks.length === 0 && atRisk.length === 0) return null;
  const L = C.locker;
  const [first, ...rest] = talks;
  const waiting = talks.filter((t) => t.answer === undefined).length + atRisk.length;
  const nameOf = (id: string) => save.squad.find((p) => p.id === id)?.name ?? "?";

  return (
    <Panel className="p-4 sm:p-5">
      <div className="card-head">
        <h2 className="card-title">{L.ui.title}</h2>
        {waiting > 1 ? <Badge tone="orange">{waiting}</Badge> : null}
      </div>

      {/* Desktop: the first talk answerable here, the others as links to the locker room.
          Phone (HQ is a summary there, DESIGN.md "Phone"): every talk as one row that opens the locker room. */}
      <div className="max-sm:hidden">
        {first ? <LockerTalk save={save} C={C} talk={first} onAnswered={shown.keep} /> : null}
        {rest.length > 0 ? (
          <ul className="mt-4 border-t border-line">
            {rest.map((t) => (
              <li key={t.id} className="border-b border-line">
                <AppLink href="/career/squad#locker-room" className="flex min-h-11 items-center py-2 text-sm text-ink hover:text-blue-bright">
                  {L.mail.tpl[`lockerTalk_${t.topic}`]?.({ player: nameOf(t.playerId) })}
                </AppLink>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {talks.length > 0 ? (
        <ul className="-mt-1 sm:hidden">
          {talks.map((t) => {
            const p = save.squad.find((x) => x.id === t.playerId);
            return (
              <li key={t.id} className="border-b border-line last:border-b-0">
                <AppLink href="/career/squad#locker-room" className="flex min-h-14 items-center gap-3 py-2">
                  {p ? <PlayerFace overall={p.overall} size="sm" /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug text-ink">{L.mail.tpl[`lockerTalk_${t.topic}`]?.({ player: nameOf(t.playerId) })}</span>
                    <span className="block text-xs text-faint">{t.answer === undefined ? L.ui.answerBy(lockerDateText(C, t.deadline)) : L.answeredLabel(L.answers[t.answer]?.(ANSWER_PARAMS) ?? t.answer)}</span>
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ul>
      ) : null}

      {atRisk.map((p) => (
        <div key={p.id} className={first ? "mt-4 border-t border-line pt-4" : ""}>
          <p className="text-sm font-bold text-ink">{L.ui.nowRisk(nameOf(p.playerId))}</p>
          <div className="mt-1">
            <PromiseLines C={C} promise={p} />
          </div>
          <p className="mt-1 text-xs text-sub">{L.ui.nowRiskHint}</p>
          <AppLink href="/career/squad" className={`${buttonClass("secondary", "sm")} mt-3`}>
            {L.ui.toSquad}
          </AppLink>
        </div>
      ))}
    </Panel>
  );
}
