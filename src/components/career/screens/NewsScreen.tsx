"use client";

/**
 * Road to Worlds — the INBOX (v0.2): an email client over `save.mail` only.
 * The world's news wire moved to the HQ; this screen is what lands on YOUR
 * desk — transfer bids, sponsor deals, contract notices, finance alerts and
 * unlock letters. Rows expand in place (accordion), expanding marks read,
 * and mail with a deep link carries an Open action.
 *
 * File name + /career/news route are stable; only the content changed.
 */

import { useRouter } from "next/navigation";
import { LoanSummary } from "../finances/LoanSummary";
import { useState } from "react";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import type { MailItem, MailKind } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { dateOfDay, seasonLabelFor, useCareerSave } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { resolveMail } from "@/components/career/news/newsText";
import { withMoneyParams } from "@/components/career/hub/hubShared";

type DatesCopy = CareerCopy["dates"];

// ---------------------------------------------------------------------------
// Filters — All + the six mail kinds
// ---------------------------------------------------------------------------

const KINDS: MailKind[] = ["offer", "sponsor", "contract", "finance", "unlock", "club"];
type FilterKey = "all" | MailKind;

const KIND_CHIP_TONE: Record<MailKind, "blue" | "gold" | "neutral" | "good" | "orange"> = {
  offer: "blue",
  sponsor: "gold",
  contract: "neutral",
  finance: "good",
  unlock: "orange",
  club: "neutral",
};

// ---------------------------------------------------------------------------
// Kind icons — hand-drawn 24×24 currentColor (house icon style)
// ---------------------------------------------------------------------------

import { ICON_TONE, MailKindIcon } from "../news/MailKindIcon";

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function NewsScreen() {
  const C = useCareerCopy();
  const mounted = useMounted();
  const save = useCareerSave();
  const markMailRead = useCareerStore((s) => s.markMailRead);
  const markAllMailRead = useCareerStore((s) => s.markAllMailRead);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4">
        <div className="space-y-4" aria-busy>
          <div className="h-12 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-8 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }
  if (!save) return null;

  const unread = save.mail.filter((m) => !m.read).length;
  const items = filter === "all" ? save.mail : save.mail.filter((m) => m.kind === filter);

  const onToggle = (item: MailItem) => {
    const opening = expandedId !== item.id;
    setExpandedId(opening ? item.id : null);
    if (opening && !item.read) markMailRead(item.id);
  };

  return (
    <div className="rise-in mx-auto max-w-3xl px-3 py-6 sm:px-4">
      <SectionTitle
        kicker={C.meta.title}
        title={C.mail.title}
        className="mb-5"
        right={
          <div className="flex items-center gap-3">
            {unread > 0 ? (
              <Badge tone="orange" className="hidden sm:inline-flex">
                {C.mail.unread(unread)}
              </Badge>
            ) : null}
            <Button size="sm" variant="ghost" onClick={markAllMailRead} disabled={unread === 0}>
              {C.mail.markAllRead}
            </Button>
          </div>
        }
      />
      {unread > 0 ? (
        <p className="mb-4 text-xs font-semibold text-orange-bright sm:hidden">
          {C.mail.unread(unread)}
        </p>
      ) : null}

      {/* Filter chips: All + the six kinds */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(["all", ...KINDS] as FilterKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={cx(
              "display inline-flex min-h-9 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
              filter === key
                ? "border-blue/50 bg-blue/15 text-blue-bright"
                : "border-line-strong bg-white/5 text-sub hover:text-ink",
            )}
          >
            {key === "all" ? C.news.filter.all : C.mail.kinds[key]}
          </button>
        ))}
      </div>

      {/* The mail list — one panel, divided rows, accordion expand */}
      {items.length === 0 ? (
        <Panel className="rise-in p-10 text-center" style={{ animationDelay: "40ms" }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 h-10 w-10 text-faint"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          <p className="text-sm font-semibold text-ink">{C.mail.empty}</p>
          <p className="mt-1 text-xs text-sub">{C.mail.emptyHint}</p>
        </Panel>
      ) : (
        <Panel className="rise-in overflow-hidden" style={{ animationDelay: "40ms" }}>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <MailRow
                key={item.id}
                item={item}
                C={C}
                D={C.dates}
                currentSeason={save.clock.seasonIndex}
                expanded={expandedId === item.id}
                onToggle={() => onToggle(item)}
              />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mail row — collapsed: dot · icon · sender/subject · date. Expanded: body
// paragraph + deep-link action. Unread = bold subject + orange dot.
// ---------------------------------------------------------------------------

function MailRow({
  item,
  C,
  D,
  currentSeason,
  expanded,
  onToggle,
}: {
  item: MailItem;
  C: CareerCopy;
  D: DatesCopy;
  currentSeason: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const resolved = resolveMail(withMoneyParams(item), C);
  const stamp = formatDateTiny(D, dateOfDay(item.seasonIndex, item.day));
  const dated =
    item.seasonIndex === currentSeason ? stamp : `${seasonLabelFor(item.seasonIndex)} · ${stamp}`;

  return (
    <li className={cx(expanded && "bg-white/[0.03]")}>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.04] sm:px-4"
      >
        <span
          className={cx(
            "mt-[7px] h-2 w-2 shrink-0 rounded-full",
            item.read ? "bg-white/10" : "bg-orange",
          )}
          aria-label={item.read ? undefined : C.mail.unread(1)}
        />
        <span className={cx("mt-0.5 shrink-0", ICON_TONE[item.kind])}>
          <MailKindIcon kind={item.kind} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cx(
                "truncate text-xs",
                item.read ? "text-faint" : "font-semibold text-sub",
              )}
            >
              {resolved.from}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-faint">{dated}</span>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={cx(
                "min-w-0 flex-1 text-sm leading-snug",
                item.read ? "text-sub" : "font-semibold text-ink",
                !expanded && "truncate",
              )}
            >
              {resolved.title}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Badge tone={KIND_CHIP_TONE[item.kind]} className="hidden sm:inline-flex">
                {resolved.kindLabel}
              </Badge>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cx(
                  "h-3.5 w-3.5 text-faint transition-transform",
                  expanded && "rotate-180",
                )}
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="rise-in px-3.5 pb-4 pl-[46px] sm:px-4 sm:pl-[50px]">
          <Badge tone={KIND_CHIP_TONE[item.kind]} className="mb-2 sm:hidden">
            {resolved.kindLabel}
          </Badge>
          {item.titleKey === "creditOffer" && Number(item.params?.principal) > 0 ? <LoanSummary C={C} received={Number(item.params?.principal)} total={Number(item.params?.loanTotal)} weekly={Number(item.params?.loanWeekly)} weeks={Number(item.params?.loanTerm)} /> : null}
          {resolved.body && !(item.titleKey === "creditOffer" && Number(item.params?.principal) > 0) ? (
            <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-sub">{resolved.body}</p>
          ) : null}
          {item.linkTo ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => router.push(item.linkTo!)}
            >
              {C.mail.open}
              <span aria-hidden>→</span>
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
