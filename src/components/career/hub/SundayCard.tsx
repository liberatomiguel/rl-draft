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

import { beginCareerNavigation } from "../careerNavigation";
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
import { advancedSeedsOf, openingOpponentOf, userSeedOf } from "@/components/career/event/weekendView";
import { DECISION_TITLE, TierChip } from "@/components/career/hub/hubShared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ClipboardIcon, HeartPulseIcon, TargetIcon, TrophyIcon, WhistleIcon } from "@/components/ui/icons";

const BRIEFING_ICON: Record<SundayBriefingChoice, typeof ClipboardIcon> = {
  keep: ClipboardIcon,
  recover: HeartPulseIcon,
  prepare: TargetIcon,
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
      {label ? <p className="kicker mb-1.5">{label}</p> : null}
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
                className="display absolute -right-0.5 -top-1 rounded-sm bg-cyan px-1 text-[7px] font-bold leading-[11px] text-[#04121a]"
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
      {/* rc9 HQ: the label line is faint (when, where); one tag, the tier. */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="kicker">
          {ahead.sundayDay === save.clock.day ? C.sunday.today : C.sunday.tomorrow} · {formatDateShort(C.dates, dateOfDay(save.clock.seasonIndex, ahead.sundayDay))}
          {ahead.def.region ? ` · ${ahead.def.region}` : ""}
        </p>
        <TierChip tier={ahead.def.tier} />
      </div>
      <h2 className={cx(DECISION_TITLE, "mt-2")}>{title}</h2>
      {children}
    </div>
  );
}

/** SUN-01: Saturday evening — the Sunday ahead, the optional briefing, "Start Sunday". */
export function NowSunday({ save, C, ahead }: { save: CareerSave; C: CareerCopy; ahead: SundayAhead }) {
  const router = useRouter();
  const setAutoAdvance = useCareerStore(s => s.setAutoAdvance);
  const startSunday = useCareerStore((s) => s.startSunday);
  const [choice, setChoice] = useState<SundayBriefingChoice>(CAREER_SUNDAY.defaultBriefing);
  const T = useCopy().TOURNAMENT_UI;
  const def = ahead.def;
  const t = save.activeEvent?.def.id === def.id ? save.activeEvent.tournament : null;
  const record = t?.swiss.records.find((r) => r.teamId === "user") ?? null;
  const recordText = record ? T.record(record.wins, record.losses) : "";

  const go = (pick: SundayBriefingChoice | null, mode?: "watch" | "results" | "skip") => {
    if (mode !== "skip") beginCareerNavigation("/career/event");
    startSunday(pick, mode);
    // Watching (or playing) Sunday opens the event; a skipped Sunday stays in HQ.
    if (mode !== "skip") router.push("/career/event");
    else setAutoAdvance(true);
  };

  // Out in the Swiss: the playoffs go on without the user (SUN-03's Sunday side).
  if (ahead.kind === "championship" && !ahead.playing) {
    // v2.2 event formats: Sunday's sides in standing order (a 16-team double elimination keeps eight).
    const seeds = t?.layout ? advancedSeedsOf(t).map((r) => r.id) : (t?.playoffs?.seeds ?? []);
    return (
      <div>
        <SundayHeader save={save} C={C} ahead={ahead} title={C.sunday.outTitle}>
          <p className="mt-1 text-sm text-sub">{C.sunday.outLine(recordText)}</p>
        </SundayHeader>
        <div className="mt-5 border-t border-line pt-4">
          <CrestStrip
            save={save}
            refs={seeds}
            label={t?.layout ? (t.layout.stage === "none" ? C.event.formats.lastEight : C.event.formats.sundayField(seeds.length)) : C.event.playoffEight}
          />
        </div>
        <div className="mt-5"><Button variant="secondary" size="lg" onClick={() => go(null, "watch")}>{C.sunday.watch}</Button></div>
      </div>
    );
  }

  const championship = ahead.kind === "championship";
  const seed = t ? userSeedOf(t) : null;
  const openerId = t ? openingOpponentOf(t.playoffs) : null;
  const openerSeed =
    openerId && t?.playoffs
      ? (t.layout ? advancedSeedsOf(t).map((r) => r.id) : t.playoffs.seeds).indexOf(openerId) + 1
      : null;
  const openerName = openerId ? (t?.teams[openerId]?.name ?? nameOfRef(save, openerId)) : null;
  const field = championship ? [] : lobbyFieldRefs(save, def, eventTeamPreview(save, def).rating.total);
  const q = def.region ? save.competition.qualifiedRefs?.[def.region] : undefined;
  const qualified = new Set(q && q.eventId === def.id ? q.refs : []);

  const effectOf = (c: SundayBriefingChoice): string => {
    const fx = briefingEffectOf(c);
    if (championship) {
      const playoffFx = CAREER_SUNDAY.championshipBriefing[c];
      return C.sunday.effectChampionship(playoffFx.quarters, playoffFx.semis, playoffFx.other, playoffFx.final);
    }
    if (c === "keep") return C.sunday.effectContinuity(fx.swiss);
    return C.sunday.effectTradeoff(fx.swiss, fx.playoffs);
  };

  return (
    <div>
      <SundayHeader save={save} C={C} ahead={ahead} title={championship ? C.event.championshipSunday : def.name}>
        {championship ? <p className="kicker mt-0.5 text-sub">{def.name}</p> : null}
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
      {/* rc9 HQ: ruled off by a hairline, not boxed inside the day card. */}
      <div className="mt-5 border-t border-line pt-4">
        {championship && openerId ? (
          <div>
            <p className="kicker mb-2">{C.sunday.openerLabel}</p>
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

      {/* Only a hired coach can give a briefing. */}
      {/* Only a hired coach can give a briefing. rc9 HQ: a card title, one hint line, three equal outlines
          (the picked one in the orange hairline); the icons name the plan, so they sit plain. */}
      {save.coach ? <div className="mt-5 border-t border-line pt-4">
        <p className="card-title flex items-center gap-2"><WhistleIcon className="h-4 w-4 text-faint" />{C.sunday.briefingTitle}</p>
        <p className="mt-1.5 text-xs text-sub">{championship ? C.sunday.championshipHint : C.sunday.briefingHint}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={C.sunday.briefingTitle}>
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
                  "flex min-h-14 items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active ? "border-orange/60 bg-white/[0.03]" : "border-line hover:border-line-strong",
                )}
              >
                <Icon className={cx("mt-0.5 h-[18px] w-[18px] shrink-0", active ? "text-ink" : "text-faint")} />
                <span className="min-w-0 flex-1">
                  <span className={cx("display block text-[15px] font-bold leading-snug", active ? "text-ink" : "text-sub")}>
                    {championship ? C.sunday.championshipBriefing[c] : C.sunday.briefing[c]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-sub">{effectOf(c)}</span>
                </span>
                <span
                  aria-hidden
                  className={cx(
                    "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-orange" : "border-line-strong",
                  )}
                >
                  {active ? <span className="h-2 w-2 rounded-full bg-orange" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div> : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => go(choice)}>
          {C.sunday.start}
        </Button>
        {/* rc9 HQ: the hint only when the button moves the clock (Saturday evening); on Sunday itself it said nothing new. */}
        {ahead.sundayDay === save.clock.day ? null : <span className="text-xs text-faint">{C.sunday.startHint}</span>}
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

  if (out) {
    const watch = () => {
      beginCareerNavigation("/career/follow");
      followSunday("watch");
      router.push("/career/follow");
    };
    return (
      // rc9 HQ: no tinted blue box inside the day card (the day card rules it off from the clock).
      <div>
        <SundayHeader save={save} C={C} ahead={{ def: out.def, sundayDay: out.def.day }} title={C.sunday.withoutYouTitle(out.def.name)}>
          <p className="mt-1.5 text-sm text-sub">{C.sunday.withoutYouLine}</p>
        </SundayHeader>
        <div className="mt-4">
          <CrestStrip save={save} refs={out.qualifiedIds} label={C.sunday.whoQualified} />
        </div>
        <div className="mt-4"><Button variant="secondary" size="md" className="min-h-11" onClick={watch}>{C.sunday.watch}</Button></div>
      </div>
    );
  }

  if (!follow) return null;
  const champion = follow.champion;
  const championName = champion ? (follow.teams.find((t) => t.id === champion)?.name ?? nameOfRef(save, champion)) : "";
  const open = () => {
    beginCareerNavigation("/career/follow");
    openFollow("watch");
    router.push("/career/follow");
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="kicker">{C.follow.kicker}{follow.def.region ? ` · ${follow.def.region}` : ""}</p>
        <TierChip tier={follow.def.tier} />
      </div>
      <h2 className="display mt-2 text-xl font-bold uppercase leading-tight text-ink">
        {C.sunday.resultsInTitle(follow.def.name)}
      </h2>
      <p className="mt-1.5 text-sm text-sub">{C.sunday.resultsInLine}</p>
      {champion ? (
        // The champion is a title, so the trophy keeps its gold; the line is not boxed.
        <div className="mt-4 flex items-center gap-2.5">
          <TrophyIcon className="h-5 w-5 shrink-0 text-amber-300" />
          <span className="kicker">{C.follow.champion}</span>
          <OrgMark save={save} orgRef={champion} size="xs" className="shrink-0" />
          <span className="display min-w-0 truncate text-[15px] font-bold text-ink">{championName}</span>
        </div>
      ) : null}
      <div className="mt-4"><Button variant="secondary" size="md" className="min-h-11" onClick={open}>{C.sunday.watch}</Button></div>
    </div>
  );
}
