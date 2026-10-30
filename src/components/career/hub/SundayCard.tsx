"use client";

/**
 * Road to Worlds rc.36 (SUN-01..03, R88) — HQ's weekend cards.
 *
 *  NowSunday      Saturday evening after the user's Saturday (the qualifier
 *                 won, or a Major / Worlds paused after its Swiss): who is
 *                 waiting on Sunday, the optional coach briefing (keep the
 *                 plan / recover / prepare for the opponent — each effect
 *                 shown upfront, CAREER_SUNDAY.briefing) and the deliberate
 *                 "Start Sunday". Out in the Swiss, the same stop offers
 *                 watch / results / skip instead.
 *  NowFollow      An event the user is out of (never holds the clock): the
 *                 eliminated Saturday's "Sunday without you", or a followed
 *                 event whose results are in — watch / results / skip.
 *
 * Game logic stays in the flow (store/careerSunday); these only render it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAREER_SUNDAY, TOURNAMENT } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import { briefingEffectOf, SUNDAY_BRIEFINGS } from "@/engine/career/sunday";
import type { CareerSave, FollowEventState, SundayBriefingChoice } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import type { SundayAhead, SundayWithoutYou } from "@/store/careerSunday";
import { dateOfDay, eventTeamPreview, nameOfRef } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { OrgMark } from "@/components/career/OrgMark";
import { lobbyFieldRefs } from "@/components/career/event/lobbyField";
import { openingOpponentOf, userSeedOf } from "@/components/career/event/weekendView";
import { TierChip } from "@/components/career/hub/hubShared";
import { REGION_BADGE } from "@/components/regionStyle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckIcon, ClipboardIcon, HeartPulseIcon, TargetIcon, TrophyIcon, WhistleIcon } from "@/components/ui/icons";

const BRIEFING_ICON: Record<SundayBriefingChoice, typeof ClipboardIcon> = {
  keep: ClipboardIcon,
  recover: HeartPulseIcon,
  prepare: TargetIcon,
};
const BRIEFING_TONE: Record<SundayBriefingChoice, string> = {
  keep: "bg-white/10 text-sub",
  recover: "bg-good/15 text-good",
  prepare: "bg-orange/15 text-orange-bright",
};

/** A row of small crests (a field, the qualified eight, the playoff seeds). */
function CrestStrip({
  save,
  refs,
  marked,
  label,
}: {
  save: CareerSave;
  refs: string[];
  /** Refs carrying the "Q" dot (through Saturday's qualifier). */
  marked?: Set<string>;
  label?: string;
}) {
  if (refs.length === 0) return null;
  return (
    <div>
      {label ? <p className="kicker mb-1.5 !text-[9px]">{label}</p> : null}
      <ul className="grid grid-cols-8 gap-1.5">
        {refs.map((ref) => (
          <li key={ref} className="relative flex justify-center" title={nameOfRef(save, ref)}>
            <span
              className={cx(
                "flex h-7 w-7 items-center justify-center rounded-lg border bg-white/[0.04] sm:h-8 sm:w-8",
                ref === "user" ? "border-orange/70" : "border-line",
              )}
            >
              <OrgMark save={save} orgRef={ref} size="xs" />
            </span>
            {marked?.has(ref) ? (
              <span
                aria-hidden
                className="display absolute -right-0.5 -top-1 rounded-full bg-cyan px-1 text-[7px] font-bold leading-[11px] text-[#04121a]"
              >
                Q
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SundayHeader({
  save,
  C,
  ahead,
  title,
  children,
}: {
  save: CareerSave;
  C: CareerCopy;
  ahead: { def: SundayAhead["def"]; sundayDay: number };
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="kicker !text-[10px] text-orange-bright">
          {C.sunday.tomorrow} · {formatDateShort(C.dates, dateOfDay(save.clock.seasonIndex, ahead.sundayDay))}
        </p>
        <TierChip tier={ahead.def.tier} />
        {ahead.def.region ? <Badge className={REGION_BADGE[ahead.def.region]}>{ahead.def.region}</Badge> : null}
      </div>
      <h2 className="display mt-1.5 text-2xl font-bold uppercase leading-tight tracking-wide text-ink sm:text-3xl">{title}</h2>
      {children}
    </div>
  );
}

/** SUN-01: Saturday evening — the Sunday ahead, the optional briefing, "Start Sunday". */
export function NowSunday({ save, C, ahead }: { save: CareerSave; C: CareerCopy; ahead: SundayAhead }) {
  const router = useRouter();
  const startSunday = useCareerStore((s) => s.startSunday);
  const [choice, setChoice] = useState<SundayBriefingChoice>(CAREER_SUNDAY.defaultBriefing);
  const T = useCopy().TOURNAMENT_UI;
  const def = ahead.def;
  const t = save.activeEvent?.def.id === def.id ? save.activeEvent.tournament : null;
  const record = t?.swiss.records.find((r) => r.teamId === "user") ?? null;
  const recordText = record ? T.record(record.wins, record.losses) : "";

  const go = (pick: SundayBriefingChoice | null, mode?: "watch" | "results" | "skip") => {
    startSunday(pick, mode);
    // Watching (or playing) Sunday opens the event; a skipped Sunday stays in HQ.
    if (mode !== "skip") router.push("/career/event");
  };

  // Out in the Swiss: the playoffs go on without the user (SUN-03's Sunday side).
  if (ahead.kind === "championship" && !ahead.playing) {
    const seeds = t?.playoffs?.seeds ?? [];
    return (
      <div>
        <SundayHeader save={save} C={C} ahead={ahead} title={C.sunday.outTitle}>
          <p className="mt-1 text-sm text-sub">{C.sunday.outLine(recordText)}</p>
        </SundayHeader>
        <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-3">
          <CrestStrip save={save} refs={seeds} label={C.event.playoffEight} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="primary" size="lg" className="w-full" onClick={() => go(null, "watch")}>
            {C.sunday.watch}
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => go(null, "results")}>
            {C.sunday.results}
          </Button>
          <Button variant="ghost" size="lg" className="w-full border border-line" onClick={() => go(null, "skip")}>
            {C.sunday.skip}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-faint">{C.sunday.outHint}</p>
      </div>
    );
  }

  const championship = ahead.kind === "championship";
  const seed = t ? userSeedOf(t) : null;
  const openerId = t ? openingOpponentOf(t.playoffs) : null;
  const openerSeed = openerId && t?.playoffs ? t.playoffs.seeds.indexOf(openerId) + 1 : null;
  const openerName = openerId ? (t?.teams[openerId]?.name ?? nameOfRef(save, openerId)) : null;
  const field = championship ? [] : lobbyFieldRefs(save, def, eventTeamPreview(save, def).rating.total);
  const q = def.region ? save.competition.qualifiedRefs?.[def.region] : undefined;
  const qualified = new Set(q && q.eventId === def.id ? q.refs : []);

  const effectOf = (c: SundayBriefingChoice): string => {
    const fx = briefingEffectOf(c);
    if (c === "recover") return C.sunday.effectRecover(fx.everySeries);
    if (c === "prepare") return openerName ? C.sunday.effectPrepareVs(fx.opener, openerName) : C.sunday.effectPrepare(fx.opener);
    return C.sunday.effectKeep;
  };

  return (
    <div>
      <SundayHeader save={save} C={C} ahead={ahead} title={championship ? C.event.championshipSunday : def.name}>
        {championship ? <p className="kicker mt-0.5 !text-[10px] text-sub">{def.name}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {championship && seed !== null ? (
            <Badge tone="orange">{C.sunday.seedLine(seed, recordText)}</Badge>
          ) : (
            <Badge tone="good">{C.sunday.qualifiedLine}</Badge>
          )}
          <span className="text-[11px] text-faint">
            {championship
              ? C.event.sundaySub(TOURNAMENT.playoffs.teams, TOURNAMENT.playoffs.bestOf)
              : C.event.roleRegionalSub(TOURNAMENT.swiss.teams - qualified.size, qualified.size)}
          </span>
        </div>
      </SundayHeader>

      {/* Who waits on Sunday: the opener (a Major / Worlds) or the field (the regional). */}
      <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-3">
        {championship && openerId ? (
          <div>
            <p className="kicker mb-2 !text-[9px]">{C.sunday.openerLabel}</p>
            {/* Phones: the user's side is the crest and the seed, so the opponent's name reads whole. */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="flex shrink-0 items-center gap-2 sm:min-w-0 sm:flex-1 sm:shrink">
                <OrgMark save={save} orgRef="user" size="sm" className="shrink-0" />
                <span className="hidden min-w-0 truncate text-sm font-bold text-orange-bright sm:inline">{save.identity.orgName}</span>
                <span className="display shrink-0 text-[11px] font-bold text-orange-bright">#{seed}</span>
              </span>
              <span className="display shrink-0 text-xs font-bold uppercase tracking-widest text-faint">vs</span>
              <span className="flex min-w-0 flex-1 items-center gap-2 sm:justify-end">
                <span className="display shrink-0 text-[11px] font-bold text-faint sm:order-none">#{openerSeed}</span>
                <OrgMark save={save} orgRef={openerId} size="sm" className="shrink-0 sm:order-last" />
                <span className="min-w-0 truncate text-sm font-semibold text-ink sm:text-right">{openerName}</span>
              </span>
            </div>
          </div>
        ) : (
          <CrestStrip save={save} refs={field} marked={qualified} label={C.sunday.fieldLabel} />
        )}
      </div>

      {/* The coach's briefing: optional, small, shown upfront. */}
      <div className="mt-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
            <WhistleIcon className="h-4 w-4" />
          </span>
          <p className="display text-sm font-bold uppercase tracking-[0.12em] text-ink">{C.sunday.briefingTitle}</p>
        </div>
        <p className="mt-1 text-xs text-sub">{C.sunday.briefingHint}</p>
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={C.sunday.briefingTitle}>
          {SUNDAY_BRIEFINGS.map((c) => {
            const Icon = BRIEFING_ICON[c];
            const active = choice === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChoice(c)}
                className={cx(
                  "flex min-h-14 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active ? "border-orange/70 bg-orange/10" : "border-line bg-white/[0.03] hover:border-line-strong",
                )}
              >
                <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", BRIEFING_TONE[c])}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx("display block text-[13px] font-bold uppercase tracking-wide", active ? "text-orange-bright" : "text-ink")}>
                    {C.sunday.briefing[c]}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-sub">{effectOf(c)}</span>
                </span>
                <span
                  aria-hidden
                  className={cx(
                    "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-orange bg-orange text-white" : "border-line-strong",
                  )}
                >
                  {active ? <CheckIcon className="h-3 w-3" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => go(choice)}>
          {C.sunday.start}
        </Button>
        <span className="text-[11px] text-faint">{C.sunday.startHint}</span>
      </div>
    </div>
  );
}

/** SUN-03: an event the user is out of — before Sunday (the eliminated Saturday) or once its results are in. */
export function NowFollow({
  save,
  C,
  out,
  follow,
}: {
  save: CareerSave;
  C: CareerCopy;
  /** The eliminated Saturday: Sunday's regional tomorrow, without the user. */
  out: SundayWithoutYou | null;
  /** A followed event whose results are in (HQ offers it for CAREER_SUNDAY.followCardDays). */
  follow: FollowEventState | null;
}) {
  const router = useRouter();
  const followSunday = useCareerStore((s) => s.followSunday);
  const openFollow = useCareerStore((s) => s.openFollow);
  const dismissFollow = useCareerStore((s) => s.dismissFollow);

  if (out) {
    const pick = (choice: "watch" | "results" | "skip") => {
      followSunday(choice);
      if (choice !== "skip") router.push("/career/follow");
    };
    return (
      <div className="rounded-xl border border-blue/30 bg-blue/[0.05] p-3.5">
        <SundayHeader save={save} C={C} ahead={{ def: out.def, sundayDay: out.def.day }} title={C.sunday.withoutYouTitle(out.def.name)}>
          <p className="mt-1 text-sm text-sub">{C.sunday.withoutYouLine}</p>
        </SundayHeader>
        <div className="mt-3">
          <CrestStrip save={save} refs={out.qualifiedIds} label={C.sunday.whoQualified} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="md" className="min-h-11" onClick={() => pick("watch")}>
            {C.sunday.watch}
          </Button>
          <Button variant="ghost" size="md" className="min-h-11 border border-line" onClick={() => pick("results")}>
            {C.sunday.results}
          </Button>
          <Button variant="ghost" size="md" className="min-h-11" onClick={() => pick("skip")}>
            {C.sunday.skip}
          </Button>
        </div>
      </div>
    );
  }

  if (!follow) return null;
  const champion = follow.champion;
  const championName = champion ? (follow.teams.find((t) => t.id === champion)?.name ?? nameOfRef(save, champion)) : "";
  const open = (view: "watch" | "results") => {
    openFollow(view);
    router.push("/career/follow");
  };
  return (
    <div className="rounded-xl border border-blue/30 bg-blue/[0.05] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="kicker !text-[10px] text-blue-bright">{C.follow.kicker}</p>
        <TierChip tier={follow.def.tier} />
        {follow.def.region ? <Badge className={REGION_BADGE[follow.def.region]}>{follow.def.region}</Badge> : null}
      </div>
      <h2 className="display mt-1.5 text-xl font-bold uppercase leading-tight tracking-wide text-ink">
        {C.sunday.resultsInTitle(follow.def.name)}
      </h2>
      <p className="mt-1 text-sm text-sub">{C.sunday.resultsInLine}</p>
      {champion ? (
        <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2">
          <TrophyIcon className="h-5 w-5 shrink-0 text-amber-300" />
          <span className="kicker !text-[9px] text-amber-300">{C.follow.champion}</span>
          <OrgMark save={save} orgRef={champion} size="xs" className="shrink-0" />
          <span className="min-w-0 truncate text-sm font-semibold text-ink">{championName}</span>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="md" className="min-h-11" onClick={() => open("watch")}>
          {C.sunday.replay}
        </Button>
        <Button variant="ghost" size="md" className="min-h-11 border border-line" onClick={() => open("results")}>
          {C.sunday.readResults}
        </Button>
        <Button variant="ghost" size="md" className="min-h-11" onClick={() => dismissFollow()}>
          {C.sunday.hide}
        </Button>
      </div>
    </div>
  );
}
