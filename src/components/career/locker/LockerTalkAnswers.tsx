"use client";

/**
 * v2.3 LOCKER: the answers under a locker-room talk in the inbox reader. The
 * mail's subject and body already say who and what, so this renders the
 * talk's answers and outcome only (v2.3 UI, U3: `LockerTalk` without its head).
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { MailItem } from "@/engine/career/types";
import { useCareerSave } from "@/components/career/careerUi";
import { FEATURES } from "@/config/balance";
import { LockerTalk } from "./LockerTalk";

export function LockerTalkAnswers({ item, C }: { item: MailItem; C: CareerCopy }) {
  const save = useCareerSave();
  const talkId = item.params?.talkId;
  if (!FEATURES.lockerRoom || !save || typeof talkId !== "string" || item.titleKey === "lockerTalkAuto") return null;
  const talk = save.lockerRoom?.talks.find((t) => t.id === talkId);
  if (!talk) return null;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <LockerTalk save={save} C={C} talk={talk} head={false} />
    </div>
  );
}
