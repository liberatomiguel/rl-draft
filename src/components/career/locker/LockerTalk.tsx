"use client";

/**
 * v2.3 UI (U3): a locker-room talk as a conversation. Who it is about (his
 * face, name and mood), what the staff report he said (R201: a squad player
 * may be a real pro, so his words are reported, never put in his mouth),
 * then the two or three answers, each with what it commits the manager to;
 * the neutral one is marked as the answer the staff give after a week.
 * Answered: the answer, his mood now, and where the promise lives.
 *
 * Used by the inbox reader (`LockerTalkAnswers`), the Squad screen's locker
 * room and the HQ card. One tap answers (the talk's own copy says a promise
 * is remembered).
 */

import { CAREER_LOCKER } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { shownMoodOf, type LockerTalk as Talk } from "@/engine/career/lockerRoom";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { MoodMark, PlayerFace, lockerDateText } from "./lockerUi";

const PARAMS = { need: CAREER_LOCKER.promise.minutesNeed, of: CAREER_LOCKER.promise.minutesOf, n: CAREER_LOCKER.benchRunTalk };

export function LockerTalk({
  save,
  C,
  talk,
  head = true,
  face = true,
  linkToSquad = true,
  onAnswered,
}: {
  save: CareerSave;
  C: CareerCopy;
  talk: Talk;
  /** The player's line (face, name, mood) — the inbox reader already titles the mail with him. */
  head?: boolean;
  /** The face and mood in the head (off in his own sheet, which already shows them). */
  face?: boolean;
  /** After a promise: link to the locker room (off on the Squad screen itself). */
  linkToSquad?: boolean;
  /** Lets the parent keep the answered talk on screen, so its outcome is read. */
  onAnswered?: (talkId: string) => void;
}) {
  const answer = useCareerStore((s) => s.answerLockerTalk);
  const L = C.locker;
  const player = save.squad.find((p) => p.id === talk.playerId);
  const name = player?.name ?? "?";
  // rc.9 integration: the held mood the other screens show; the talk's own params (the cup's size) reach the copy.
  const mood = shownMoodOf(save.lockerRoom, talk.playerId);
  const params = { ...PARAMS, ...(talk.params ?? {}) };
  const label = (a: string) => L.answers[a]?.(params) ?? a;
  const report = L.mail.body[`lockerTalk_${talk.topic}_${talk.variant}`]?.({ ...params, player: name });
  const answered = talk.answer !== undefined;
  const promised = talk.answer === "promiseMinutes" || talk.answer === "promiseStay";

  return (
    <div className="min-w-0">
      {head ? (
        <div className="flex items-center gap-3">
          {face && player ? <PlayerFace overall={player.overall} /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-ink">{L.mail.tpl[`lockerTalk_${talk.topic}`]?.({ player: name }) ?? name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {face ? <MoodMark mood={mood} C={C} /> : null}
              {!answered ? <span className="text-xs text-faint">{L.ui.answerBy(lockerDateText(C, talk.deadline))}</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* What he said, as the staff report it. */}
      {head && report ? (
        <blockquote className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{L.ui.fromStaff}</p>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-sub">{report}</p>
        </blockquote>
      ) : null}

      {answered ? (
        <div className="mt-4 space-y-1.5">
          <p className="text-sm text-ink">{talk.auto ? L.answeredAuto(label(talk.answer!)) : L.answeredLabel(label(talk.answer!))}</p>
          {player ? <p className="text-sm text-sub">{L.ui.nowMood(name, L.moods[mood])}</p> : null}
          {promised ? (
            <p className="text-xs text-faint">
              {L.ui.promiseOpened}{" "}
              {linkToSquad ? (
                <AppLink href="/career/squad#locker-room" className="font-semibold text-blue-bright underline-offset-4 hover:underline">
                  {L.ui.toLockerRoom}
                </AppLink>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="mt-4 grid grid-cols-1 gap-2">
            {talk.answers.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => {
                    onAnswered?.(talk.id);
                    answer(talk.id, a);
                  }}
                  className={cx(
                    "flex min-h-11 w-full flex-col items-start rounded-[7px] border border-line bg-white/[0.03] px-3.5 py-3 text-left transition-colors",
                    "hover:border-blue/60 hover:bg-blue/10",
                  )}
                >
                  <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-ink">{label(a)}</span>
                    {a === talk.neutral ? <Badge>{L.ui.defaultTag}</Badge> : null}
                  </span>
                  <span className="mt-1 text-xs leading-relaxed text-sub">{L.ui.commits[a]?.(params)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-faint">{L.talkHint}</p>
        </>
      )}
    </div>
  );
}
