"use client";

/**
 * v2.3 LOCKER (wave 1): the answers under a locker-room talk in the inbox
 * reader — the minimum the inbox needed to carry two or three answers (its
 * mail has no actions). Open talk: one button per answer. Answered: the
 * answer given (or the neutral one the staff gave after a week). Wave 2
 * replaces this with the locker-room screen. Not seen in a browser yet.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { MailItem } from "@/engine/career/types";
import { Button } from "@/components/ui/Button";
import { useCareerSave } from "@/components/career/careerUi";
import { useCareerStore } from "@/store/careerStore";
import { CAREER_LOCKER, FEATURES } from "@/config/balance";

export function LockerTalkAnswers({ item, C }: { item: MailItem; C: CareerCopy }) {
  const save = useCareerSave();
  const answer = useCareerStore((s) => s.answerLockerTalk);
  const talkId = item.params?.talkId;
  if (!FEATURES.lockerRoom || typeof talkId !== "string" || item.titleKey === "lockerTalkAuto") return null;
  const talk = save?.lockerRoom?.talks.find((t) => t.id === talkId);
  if (!talk) return null;
  const L = C.locker;
  const params = { need: CAREER_LOCKER.promise.minutesNeed, of: CAREER_LOCKER.promise.minutesOf };
  const label = (a: string) => L.answers[a]?.(params) ?? a;
  if (talk.answer !== undefined) {
    return <p className="mt-5 text-sm text-sub">{talk.auto ? L.answeredAuto(label(talk.answer)) : L.answeredLabel(label(talk.answer))}</p>;
  }
  return (
    <div className="mt-5 space-y-2">
      <div className="flex flex-col items-start gap-2">
        {talk.answers.map((a) => (
          <Button key={a} variant="secondary" onClick={() => answer(talk.id, a)}>
            {label(a)}
          </Button>
        ))}
      </div>
      <p className="text-xs text-sub">{L.talkHint}</p>
    </div>
  );
}
