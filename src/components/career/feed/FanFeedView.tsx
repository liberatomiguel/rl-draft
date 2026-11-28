"use client";

/**
 * v2.3 UI (U4), rebuilt in rc9 STORIES (#292): the Fans view of the desk
 * (News screen). A lead board with the followers as the view's figure and two
 * quiet ones (the manager's posts and the receipts this season), then the
 * feed as one board of rows, newest first: the author's mark, the name, the
 * time, the text, the likes. The manager's own post is a thread: the club's
 * crest, the text in ink, the moment it answers (crests and score), and the
 * fans' replies indented under it. A receipt carries its tag and the old post
 * it quotes. A long feed shows its start and a key for the rest. Derived on
 * every render (`fanFeedFor`), never stored. Nothing with FEATURES.fanFeed off.
 */

import { useState } from "react";
import { FEATURES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { fanFeedFor } from "@/engine/career/fanFeed";
import { feedTextOf } from "@/engine/career/fanFeedText";
import type { FeedManagerPost, FeedPost } from "@/engine/career/fanFeedTypes";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { followersOf } from "@/store/fanFeedFlow";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { FanPostBody, ManagerPostBody, type PostMomentView } from "./FeedPostParts";

const FIRST = 12;

export function compactCount(n: number, lang: "en" | "pt"): string {
  return new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** A manager's post and the fans' replies to it; any other post stands alone. */
interface Thread {
  post: FeedPost;
  replies: FeedPost[];
}

function threadsOf(posts: FeedPost[]): Thread[] {
  const replies = new Map<string, FeedPost[]>();
  for (const p of posts) {
    if (p.kind !== "managerReply") continue;
    const key = `post:${p.id.slice(p.id.indexOf(":") + 1)}`;
    replies.set(key, [...(replies.get(key) ?? []), p]);
  }
  const ids = new Set(posts.map((p) => p.id));
  return posts
    // A reply whose post is out of the window still shows, on its own.
    .filter((p) => p.kind !== "managerReply" || !ids.has(`post:${p.id.slice(p.id.indexOf(":") + 1)}`))
    .map((post) => ({ post, replies: post.kind === "managerPost" ? [...(replies.get(post.id) ?? [])].reverse() : [] }));
}

const momentOf = (stored: FeedManagerPost | undefined): PostMomentView | undefined => {
  const r = stored?.result;
  if (!stored || !r) return undefined;
  return { moment: stored.moment, event: r.event, opponentRef: stored.opponentRef, opponentName: stored.opponentName, us: r.us, them: r.them, won: r.won };
};

export function FanFeedView({ save, C, lang }: { save: CareerSave; C: CareerCopy; lang: "en" | "pt" }) {
  const [all, setAll] = useState(false);
  if (!FEATURES.fanFeed) return null;
  const F = C.feed;
  const U = F.ui;
  const followers = followersOf(save);
  const posts = fanFeedFor(save);
  const threads = threadsOf(posts);
  const shown = all ? threads : threads.slice(0, FIRST);
  const stored = new Map((save.fanFeed?.posts ?? []).map((p) => [`post:${p.seriesN}`, p]));
  const byId = new Map(posts.map((p) => [p.id, p]));
  const season = save.clock.seasonIndex;
  const mine = (save.fanFeed?.posts ?? []).filter((p) => p.seasonIndex === season).length;
  const receipts = (save.fanFeed?.posts ?? []).filter((p) => p.settled?.kind === "receipt" && p.settled.seasonIndex === season).length;

  return (
    <div className="space-y-4">
      {/* The lead block: the followers are the view's figure. */}
      <Panel strong className="p-4 sm:p-5">
        <div className="card-head">
          <h2 className="card-title">{U.tab}</h2>
        </div>
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="display text-[2.5rem] font-bold leading-none tabular-nums text-ink">{followers !== null ? compactCount(followers, lang) : "0"}</p>
            <p className="mt-1.5 text-xs text-faint">{F.followers}</p>
          </div>
          <div className="flex gap-x-8">
            <div>
              <p className="display text-xl font-semibold leading-none tabular-nums text-ink">{mine}</p>
              <p className="mt-1.5 text-xs text-faint">{U.yourPosts}</p>
            </div>
            <div>
              <p className={cx("display text-xl font-semibold leading-none tabular-nums", receipts > 0 ? "text-bad" : "text-ink")}>{receipts}</p>
              <p className="mt-1.5 text-xs text-faint">{U.receipts}</p>
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-prose text-sm text-sub">{U.lead}</p>
      </Panel>

      {threads.length === 0 ? (
        <Panel className="px-4 py-10 text-center sm:px-5">
          <p className="display text-[15px] font-semibold text-ink">{U.empty}</p>
          <p className="mt-1.5 text-sm text-sub">{U.emptyHint}</p>
        </Panel>
      ) : (
        <Panel className="overflow-hidden !p-0">
          <ul className="divide-y divide-line">
            {shown.map(({ post, replies }) => {
              const time = U.week(post.week);
              if (post.author.type === "manager") {
                const s = stored.get(post.id);
                return (
                  // The manager's thread: a raised row (his), the replies indented under it.
                  <li key={post.id} className="bg-white/[0.025] px-4 py-4 sm:px-5">
                    <ManagerPostBody
                      save={save}
                      C={C}
                      text={feedTextOf(post, F)}
                      time={time}
                      toneLabel={s ? F.tones[s.tone].label : undefined}
                      moment={momentOf(s)}
                    >
                      <Meta likes={compactCount(post.likes, lang)} C={C} replies={replies.length} />
                      {replies.length > 0 ? (
                        <ul className="mt-3 space-y-3 border-t border-line pt-3">
                          {replies.map((r) => (
                            <li key={r.id}>
                              <FanPostBody small handle={r.author.type === "fan" ? r.author.handle : ""} time={U.week(r.week)} text={feedTextOf(r, F)}>
                                <Meta likes={compactCount(r.likes, lang)} C={C} />
                              </FanPostBody>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </ManagerPostBody>
                  </li>
                );
              }
              const quoted = post.kind === "receipt" ? byId.get(post.id.replace("receipt:", "post:")) : undefined;
              return (
                <li key={post.id} className="px-4 py-4 sm:px-5">
                  <FanPostBody
                    handle={post.author.handle}
                    time={time}
                    text={feedTextOf(post, F)}
                    tag={post.kind === "receipt" ? <Badge tone="bad">{U.receipt}</Badge> : undefined}
                  >
                    {quoted ? (
                      <div className="mt-2.5 max-w-prose">
                        <p className="text-xs text-faint">{U.quoting(quoted.week)}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-sub">{feedTextOf(quoted, F)}</p>
                      </div>
                    ) : null}
                    <Meta likes={compactCount(post.likes, lang)} C={C} event={post.slots.event} />
                  </FanPostBody>
                </li>
              );
            })}
          </ul>
          {!all && threads.length > FIRST ? (
            <div className="border-t border-line p-4 sm:px-5">
              <Button size="md" variant="secondary" className="min-h-11" onClick={() => setAll(true)}>
                {U.showAll(threads.length)}
              </Button>
            </div>
          ) : null}
        </Panel>
      )}
    </div>
  );
}

function Meta({ C, likes, replies, event }: { C: CareerCopy; likes: string; replies?: number; event?: string }) {
  const U = C.feed.ui;
  return (
    <p className="mt-2 flex min-w-0 flex-wrap gap-x-2 text-xs text-faint">
      {event ? <span className="min-w-0 truncate">{event}</span> : null}
      {event ? <span aria-hidden>·</span> : null}
      <span className="tabular-nums">{U.likes(likes)}</span>
      {replies ? <span aria-hidden>·</span> : null}
      {replies ? <span>{U.replies(replies)}</span> : null}
    </p>
  );
}
