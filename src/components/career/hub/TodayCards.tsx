"use client";

/**
 * Road to Worlds hub — "What you can do today" + "Your edges" (v2.0 hub
 * rebuild, R26). Compact cards, one per thing the player can act on today,
 * each stating its status in one line; and the strip of active advantages
 * (coach, gear, psychologist, bootcamp Sharp, sponsor perks) so the toolbox
 * the Finances screen sells is visible where the player actually lives.
 */

import { CAREER_GEAR, CAREER_SPONSOR } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { coachEffectsFor } from "@/engine/career/development";
import type { CareerSave } from "@/engine/career/types";
import type { TournamentTeam } from "@/engine/types";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import {
  bootcampTierFor,
  clockLabel,
  daysUntilWindowCloses,
  runwayWeeks,
  scrimAvailability,
  upcomingStops,
  weeklyStatement,
} from "@/components/career/careerUi";
import { formatDaysAway } from "@/components/career/dateText";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

function Card({
  href,
  title,
  line,
  tone = "neutral",
  badge,
  action,
}: {
  href?: string;
  title: string;
  line: string;
  tone?: "neutral" | "blue" | "orange" | "good" | "bad";
  badge?: string;
  action?: React.ReactNode;
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue/40 bg-blue/[0.06]"
      : tone === "orange"
        ? "border-orange/40 bg-orange/[0.06]"
        : tone === "good"
          ? "border-good/40 bg-good/[0.06]"
          : tone === "bad"
            ? "border-bad/40 bg-bad/[0.06]"
            : "border-line bg-white/[0.03]";
  const body = (
    <div className={cx("flex h-full flex-col rounded-lg border p-3 transition-colors", toneClass, href && "hover:border-line-strong")}>
      <div className="flex items-center justify-between gap-2">
        <p className="display text-xs font-bold uppercase tracking-[0.12em] text-ink">{title}</p>
        {badge ? <Badge tone={tone === "neutral" ? "neutral" : tone === "good" ? "good" : tone === "bad" ? "bad" : tone}>{badge}</Badge> : null}
      </div>
      <p className="mt-1 flex-1 text-xs leading-snug text-sub">{line}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
  return href ? (
    <AppLink href={href} className="block h-full">
      {body}
    </AppLink>
  ) : (
    body
  );
}

export function TodayCards({ save, C, team }: { save: CareerSave; C: CareerCopy; team: TournamentTeam }) {
  const D = C.dates;
  const runScrim = useCareerStore((s) => s.runScrim);
  const clock = clockLabel(save);
  const running = save.phase === "running";
  const eventToday = Boolean(save.pendingEventDef && save.pendingEventDef.day === save.clock.day) || Boolean(save.activeEvent);
  const trainingDay = running && !eventToday && clock.dow <= 5;
  const scrim = scrimAvailability(save);
  const windowDaysLeft = daysUntilWindowCloses(save);
  const nextWindow = upcomingStops(save, 6).find((s) => s.kind === "window") ?? null;

  const statement = weeklyStatement({
    squadSalaries: save.squad.map((p) => ({ name: p.name, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    sponsor: save.sponsor,
    rep: save.reputation,
    gear: save.finances.gear,
    bankLoan: save.finances.bankLoan ?? null,
  });
  const runway = runwayWeeks(save.finances.balance, statement.net);
  const finTone = save.finances.balance < 0 ? "bad" : runway !== null && runway <= 4 ? "orange" : "neutral";

  const bootTier = bootcampTierFor(save.reputation);
  const bootcampReady = bootTier > 0 && !save.finances.bootcampUsedThisSplit && running;

  const starters = save.starterIds
    .map((id) => save.squad.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const avgOvr = starters.length ? Math.round(starters.reduce((s, p) => s + p.overall, 0) / starters.length) : 0;

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "60ms" }}>
      <p className="kicker mb-3 text-[10px]">{C.hub.canDo}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          href="/career/training"
          title={C.hub.cards.training}
          line={trainingDay ? C.hub.cards.trainingOn : C.hub.cards.trainingOff}
          tone={trainingDay ? "good" : "neutral"}
        />
        <Card
          title={C.hub.cards.scrim}
          line={
            scrim.available && scrim.opponentName
              ? C.hub.scrimsLeft(scrim.remaining)
              : scrim.reason === "restDay"
                ? C.hub.restDay
                : scrim.reason === "used"
                  ? C.scrim.usedUp
                  : C.hub.scrimUnavailable
          }
          tone={scrim.available ? "blue" : "neutral"}
          action={
            scrim.available && scrim.opponentName ? (
              <Button variant="secondary" size="sm" full onClick={() => runScrim()}>
                {C.hub.scrimCta(scrim.opponentName)}
              </Button>
            ) : null
          }
        />
        <Card
          href="/career/market"
          title={C.hub.cards.market}
          line={
            clock.windowOpen && windowDaysLeft !== null
              ? C.hub.cards.marketOpen(windowDaysLeft)
              : C.hub.cards.marketClosed(nextWindow ? formatDaysAway(D, nextWindow.daysAway) : "—")
          }
          tone={clock.windowOpen ? "blue" : "neutral"}
          badge={clock.windowOpen ? C.calendar.windowOpen : undefined}
        />
        <Card
          href="/career/finances"
          title={C.hub.cards.finances}
          line={`${formatMoney(save.finances.balance, { compact: true })} · ${C.hub.budgetNet(formatMoneyDelta(statement.net, { compact: true }))}${runway !== null ? ` · ${C.finances.runway(runway)}` : ""}`}
          tone={finTone}
          badge={save.finances.loan ? C.finances.backer : save.finances.bankLoan ? C.finances.bankTitle : undefined}
        />
        {bootcampReady ? (
          <Card href="/career/finances" title={C.hub.cards.bootcamp} line={C.hub.cards.bootcampReady} tone="orange" />
        ) : null}
        <Card
          href="/career/squad"
          title={C.hub.cards.squad}
          line={C.hub.cards.squadLine(avgOvr, team.chemistry.percent)}
        />
      </div>
    </Panel>
  );
}

export function EdgesStrip({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const edges: { key: string; text: string; tone: "blue" | "orange" | "good" | "neutral" }[] = [];
  if (save.coach) {
    edges.push({ key: "coach", text: C.hub.edgeCoach(save.coach.name, coachEffectsFor(save.coach).trainingPct), tone: "blue" });
  }
  for (const item of CAREER_GEAR.items) {
    if (save.finances.gear[item.id]) {
      edges.push({
        key: item.id,
        text: C.hub.edgeGear(C.finances.gear[item.id as keyof typeof C.finances.gear], Math.round(item.trainingBonus * 100)),
        tone: "neutral",
      });
    }
  }
  if (save.finances.gear.psychologist) edges.push({ key: "psych", text: C.hub.edgePsych, tone: "good" });
  if (save.finances.bootcampSharp > 0) edges.push({ key: "sharp", text: C.hub.edgeSharp, tone: "orange" });
  if (save.sponsor) {
    const row = CAREER_SPONSOR.tiers[save.sponsor.tier - 1];
    if (row.gearDiscountPct > 0 || row.freeBootcampsPerSeason > 0) {
      edges.push({ key: "sponsor", text: C.hub.edgeSponsor(save.sponsor.tier), tone: "blue" });
    }
  }
  return (
    <AppLink href="/career/finances" className="block">
      <Panel className="rise-in p-4 transition-colors hover:border-line-strong" style={{ animationDelay: "90ms" }}>
        <p className="kicker mb-2 text-[10px]">{C.hub.edges}</p>
        {edges.length === 0 ? (
          <p className="text-xs text-faint">{C.hub.edgesEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {edges.map((e) => (
              <Badge key={e.key} tone={e.tone}>
                {e.text}
              </Badge>
            ))}
          </div>
        )}
      </Panel>
    </AppLink>
  );
}
