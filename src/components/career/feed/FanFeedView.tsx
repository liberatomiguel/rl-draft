"use client";

/**
 * v2.3 UI (U4): the Fans view of the desk (News screen). The followers as the
 * view's figure, then the posts, newest first: handle, text, the event they
 * react to, the week and the likes. The manager's own posts are boards with
 * the club's mark and the blue hairline of an information state; a receipt
 * carries a red tag and quotes the post it answers. A long feed shows its
 * start and a key for the rest. Derived on every render (`fanFeedFor`), never
 * stored. Nothing with FEATURES.fanFeed off.
 */

import { useState } from "react";
import { FEATURES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { fanFeedFor } from "@/engine/career/fanFeed";
import { feedTextOf } from "@/engine/career/fanFeedText";
import type { FanTone, FeedPost } from "@/engine/career/fanFeedTypes";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { followersOf } from "@/store/fanFeedFlow";
import { OrgMark } from "@/components/career/OrgMark";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

const FIRST = 12;

export function compactCount(n: number, lang: "en" | "pt"): string {
  return new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function FanFeedView({ save, C, lang }: { save: CareerSave; C: CareerCopy; lang: "en" | "pt" }) {
  const [all, setAll] = useState(false);
  if (!FEATURES.fanFeed) return null;
  const F = C.feed;
  const followers = followersOf(save);
  const posts = fanFeedFor(save);
  const shown = all ? posts : posts.slice(0, FIRST);
  const tones = new Map<string, FanTone>((save.fanFeed?.posts ?? []).map((p) => [`post:${p.seriesN}`, p.tone]));
  const byId = new Map(posts.map((p) => [p.id, p]));

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line p-4 sm:p-5">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="card-title">{F.ui.tab}</h2>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-sub">{F.ui.lead}</p>
        </div>
        {followers !== null ? (
          <div className="sm:text-right">
            <p className="display text-3xl font-bold leading-none tabular-nums text-ink">{compactCount(followers, lang)}</p>
            <p className="mt-1 text-xs text-sub">{F.followers}</p>
          </div>
        ) : null}
      </div>

      {posts.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-ink">{F.ui.empty}</p>
          <p className="mt-1 text-xs text-sub">{F.ui.emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((p) => (
            <li key={p.id} className="px-4 py-3.5 sm:px-5">
              {p.author.type === "manager" ? (
                <ManagerPost save={save} C={C} post={p} tone={tones.get(p.id)} lang={lang} />
              ) : (
                <FanPost C={C} post={p} lang={lang} quoted={p.kind === "receipt" ? byId.get(p.id.replace("receipt:", "post:")) : undefined} />
              )}
            </li>
          ))}
        </ul>
      )}

      {!all && posts.length > FIRST ? (
        <div className="border-t border-line p-4 sm:px-5">
          <Button size="sm" variant="secondary" onClick={() => setAll(true)}>
            {F.ui.showAll(posts.length)}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function Meta({ C, post, lang }: { C: CareerCopy; post: FeedPost; lang: "en" | "pt" }) {
  const F = C.feed;
  return (
    <p className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-faint">
      {post.slots.event ? <span className="min-w-0 truncate">{post.slots.event}</span> : null}
      {post.slots.event ? <span aria-hidden>·</span> : null}
      <span className="tabular-nums">{F.ui.likes(compactCount(post.likes, lang))}</span>
    </p>
  );
}

function FanPost({ C, post, lang, quoted }: { C: CareerCopy; post: FeedPost; lang: "en" | "pt"; quoted?: FeedPost }) {
  const F = C.feed;
  const handle = post.author.type === "fan" ? post.author.handle : "";
  return (
    <article className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">@{handle}</span>
          {post.kind === "receipt" ? <Badge tone="bad">{F.ui.receipt}</Badge> : null}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-faint">{F.ui.week(post.week)}</span>
      </div>
      {post.kind === "managerReply" ? <p className="text-[11px] text-faint">{F.ui.replyTo}</p> : null}
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-sub">{feedTextOf(post, F)}</p>
      {quoted ? (
        <div className="mt-2 max-w-prose rounded-md border border-line px-3 py-2">
          <p className="text-[11px] text-faint">{F.ui.quoting(quoted.week)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-sub">{feedTextOf(quoted, F)}</p>
        </div>
      ) : null}
      <Meta C={C} post={post} lang={lang} />
    </article>
  );
}

function ManagerPost({ save, C, post, tone, lang }: { save: CareerSave; C: CareerCopy; post: FeedPost; tone?: FanTone; lang: "en" | "pt" }) {
  const F = C.feed;
  return (
    <article className={cx("min-w-0 rounded-lg border border-blue/40 bg-white/[0.03] px-3 py-3")}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <OrgMark save={save} orgRef="user" size="xs" />
          <span className="truncate text-sm font-semibold text-ink">{save.identity.orgName}</span>
          <span className="shrink-0 text-[11px] text-faint">{F.ui.manager}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {tone ? <Badge tone="blue">{F.tones[tone].label}</Badge> : null}
          <span className="text-[11px] tabular-nums text-faint">{F.ui.week(post.week)}</span>
        </span>
      </div>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink">{feedTextOf(post, F)}</p>
      <Meta C={C} post={post} lang={lang} />
    </article>
  );
}
