"use client";

/**
 * rc9 STORIES (#289): the pieces a post is made of, shared by the Fans view
 * and the post sheet's preview so the preview is the post as the feed shows
 * it. A post is a row: the author's mark, the name in Demi, the handle or the
 * "Manager" tag in faint, the time on the right, the text, and under a
 * manager's post the moment it answers as one strip (both crests, the score,
 * the event, its tag). Fans have no pictures: their mark is the handle's
 * initial in a hairline circle (an honest placeholder, never a face).
 */

import type { CareerCopy } from "@/content/careerCopy";
import { scoreOf } from "@/engine/career/fanFeed";
import type { PostMoment } from "@/engine/career/fanFeedTypes";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { Badge } from "@/components/ui/Badge";

/** What a manager's post refers to: the series and the moment, when known. */
export interface PostMomentView {
  moment?: PostMoment;
  event: string;
  opponentRef?: string;
  opponentName: string;
  us: number;
  them: number;
  won: boolean;
}

/** The fan's mark: the first letter of the handle in a hairline circle. */
export function FanMark({ handle, small }: { handle: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "display flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-strong font-semibold uppercase text-sub",
        small ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs",
      )}
    >
      {handle.replace(/[^a-z]/gi, "").charAt(0) || "#"}
    </span>
  );
}

/** The moment strip under a manager's post: user crest, score, opponent crest, the event and its tag. */
export function MomentStrip({ save, C, m }: { save: CareerSave; C: CareerCopy; m: PostMomentView }) {
  const F = C.feed.ui;
  const tone = m.moment === "title" ? "gold" : m.won ? "good" : "bad";
  return (
    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
      <div className="flex shrink-0 items-center gap-2.5">
        <OrgMark save={save} orgRef="user" size="sm" />
        <span className={cx("display text-2xl font-bold leading-none tabular-nums", m.won ? "text-ink" : "text-sub")}>
          {m.us}
          <span className="px-1 text-faint">-</span>
          <span className={m.won ? "text-sub" : "text-ink"}>{m.them}</span>
        </span>
        {m.opponentRef ? <OrgMark save={save} orgRef={m.opponentRef} size="sm" /> : null}
      </div>
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm text-ink">{m.event}</p>
        <p className="truncate text-xs text-faint">{F.result(m.won, scoreOf(m.us, m.them), m.opponentName)}</p>
      </div>
      {m.moment ? <Badge tone={tone}>{F.tag[m.moment]}</Badge> : null}
    </div>
  );
}

/**
 * The manager's own post: the club's crest and name, the "Manager" tag, the
 * tone, the time, the text in ink, the moment strip, then whatever follows
 * (the likes line, the replies).
 */
export function ManagerPostBody({
  save,
  C,
  text,
  time,
  toneLabel,
  moment,
  children,
}: {
  save: CareerSave;
  C: CareerCopy;
  text: string;
  time: string;
  toneLabel?: string;
  moment?: PostMomentView;
  children?: React.ReactNode;
}) {
  const F = C.feed.ui;
  return (
    <article className="min-w-0">
      <div className="flex items-start gap-3">
        <OrgMark save={save} orgRef="user" size="sm" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="display truncate text-[15px] font-semibold text-ink">{save.identity.orgName}</span>
              <span className="text-xs text-faint">{F.manager}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {toneLabel ? <Badge tone="blue">{toneLabel}</Badge> : null}
              <span className="text-xs tabular-nums text-faint">{time}</span>
            </span>
          </div>
          <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-ink">{text}</p>
          {moment ? <MomentStrip save={save} C={C} m={moment} /> : null}
          {children}
        </div>
      </div>
    </article>
  );
}

/** A fan's post: the mark, the handle, the time, the text, then whatever follows. */
export function FanPostBody({
  handle,
  time,
  text,
  tag,
  small,
  children,
}: {
  handle: string;
  time: string;
  text: string;
  tag?: React.ReactNode;
  small?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article className="min-w-0">
      <div className="flex items-start gap-3">
        <FanMark handle={handle} small={small} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="display truncate text-sm font-semibold text-ink">@{handle}</span>
              {tag}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-faint">{time}</span>
          </div>
          <p className={cx("mt-1 max-w-prose leading-relaxed text-sub", small ? "text-sm" : "text-[15px]")}>{text}</p>
          {children}
        </div>
      </div>
    </article>
  );
}
