"use client";

/**
 * v2.3 UI (U1): why a player feels the way he does. His mood as the sheet's
 * figure, the last few changes with their reasons (newest first, the change
 * set as a number), his open promise with its progress and deadline, and his
 * open talk, answerable here. A modal through the portal (`Modal`).
 */

import type { CareerCopy } from "@/content/careerCopy";
import { playerLockerLogOf, promiseProgressOf, type LockerPromise } from "@/engine/career/lockerRoom";
import { lockerPlayerViewOf } from "@/engine/career/lockerRoomView";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LockerTalk } from "./LockerTalk";
import { MoodMark, PlayerFace, lockerDateText, lockerDateTiny, reasonSentence, signedDelta, useShownTalks } from "./lockerUi";

export function PlayerMoodSheet({ save, C, playerId, onClose }: { save: CareerSave; C: CareerCopy; playerId: string | null; onClose: () => void }) {
  const L = C.locker;
  const player = playerId ? save.squad.find((p) => p.id === playerId) : undefined;
  const st = save.lockerRoom;
  // rc.9 integration: the held mood, its trend and the main reason (lockerRoomView, R218).
  const view = lockerPlayerViewOf(save, playerId ?? "");
  const mood = view.mood;
  const why = view.reason ? L.why[view.reason.key] : undefined;
  const trendLine = [view.trend === "steady" ? null : L.trend[view.trend], why].filter(Boolean).join(" · ");
  const log = playerId ? playerLockerLogOf(st, playerId, 4) : [];
  const promises = (st?.promises ?? []).filter((p) => p.playerId === playerId);
  const shown = useShownTalks(save, (t) => t.playerId === playerId);
  const talk = shown.talks[0];

  return (
    <Modal
      open={Boolean(player)}
      title={player?.name ?? ""}
      onClose={onClose}
      actions={
        <Button variant="ghost" onClick={onClose}>
          {C.common.close}
        </Button>
      }
    >
      {player ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <PlayerFace overall={player.overall} />
            <div className="min-w-0">
              <MoodMark mood={mood} C={C} size="lg" />
              <p className="mt-1 text-xs text-sub">{trendLine || L.ui.whyOf(player.name)}</p>
              <p className="mt-0.5 text-[11px] text-faint">{L.matchLine(view.matchEffect)}</p>
            </div>
          </div>

          <section>
            <h3 className="kicker">{L.ui.recent}</h3>
            {log.length === 0 ? (
              <p className="mt-2 text-sm text-sub">{L.ui.noChanges}</p>
            ) : (
              <ul className="mt-1">
                {log.map((e, i) => (
                  <li key={i} className="flex items-baseline gap-3 border-b border-line py-2 last:border-b-0">
                    <span className="w-16 shrink-0 text-[11px] tabular-nums text-faint">{lockerDateTiny(C, e.on)}</span>
                    <span className="min-w-0 flex-1 text-sm leading-snug text-ink">{reasonSentence(C, e.reason)}</span>
                    <span className={cx("display shrink-0 text-sm font-bold tabular-nums", e.delta > 0 ? "text-good" : "text-bad")}>{signedDelta(e.delta)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {promises.length > 0 ? (
            <section>
              <h3 className="kicker">{L.ui.hisPromise}</h3>
              <div className="mt-2 space-y-3">
                {promises.map((p) => (
                  <PromiseLines key={p.id} C={C} promise={p} />
                ))}
              </div>
            </section>
          ) : null}

          {talk ? (
            <section className="border-t border-line pt-4">
              <LockerTalk save={save} C={C} talk={talk} face={false} onAnswered={shown.keep} />
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

/** A promise in two or three lines: what was promised, where it stands, by when (U1, U2). */
export function PromiseLines({ C, promise, name }: { C: CareerCopy; promise: LockerPromise; name?: string }) {
  const L = C.locker;
  const pr = promiseProgressOf(promise);
  const what = L.ui.promiseOf[pr.kind]?.(pr.need, pr.of) ?? pr.kind;
  return (
    <div className="min-w-0">
      <p className="text-sm text-ink">
        {name ? <span className="font-bold">{name}: </span> : null}
        {what}
      </p>
      <p className="mt-0.5 text-xs text-sub">
        {pr.kind === "minutes" ? (
          <>
            <span className="font-semibold tabular-nums text-ink">{L.ui.progress(pr.started, pr.need, pr.eventsLeft)}</span>
            {" · "}
            {L.ui.lapses(lockerDateText(C, pr.deadline))}
          </>
        ) : (
          L.ui.stayUntil(lockerDateText(C, pr.deadline))
        )}
        {pr.inherited ? ` · ${L.ui.inherited}` : null}
      </p>
      {pr.atRisk ? <p className="mt-0.5 text-xs font-semibold text-orange-bright">{L.ui.atRisk}</p> : null}
    </div>
  );
}
