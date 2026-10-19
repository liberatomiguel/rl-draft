"use client";

/**
 * Road to Worlds hub — THE TRAINING BLOCK (rc.2). Where training lives on
 * the hub: today's status, this week's drill (what it sharpens), the scrim
 * block with its one-tap CTA, and the EDGES (coach, gear, psychologist,
 * bootcamp, sponsor perks) as icon chips — the toolbox Finances sells, shown
 * where the player actually lives. One tap opens the Training screen.
 */

import { CAREER_GEAR, CAREER_SPONSOR } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { coachEffectsFor } from "@/engine/career/development";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { activeDrillFor, bootcampTierFor, clockLabel, scrimAvailability } from "@/components/career/careerUi";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

type Edge = { key: string; text: string; tone: "blue" | "orange" | "good" | "neutral"; icon: "coach" | "gear" | "mind" | "sharp" | "sponsor" };

export function TrainingBlock({ save, C, statLabels }: { save: CareerSave; C: CareerCopy; statLabels: Record<string, string> }) {
  const runScrim = useCareerStore((s) => s.runScrim);
  const clock = clockLabel(save);
  const running = save.phase === "running";
  const eventToday = Boolean(save.pendingEventDef && save.pendingEventDef.day === save.clock.day) || Boolean(save.activeEvent);
  const trainingDay = running && !eventToday && clock.dow <= 5;
  const status = eventToday ? C.hub.trainingMatch : trainingDay ? C.hub.trainingToday : C.hub.trainingRest;
  const drill = activeDrillFor(save);
  const scrim = scrimAvailability(save);

  const edges: Edge[] = [];
  if (save.coach) edges.push({ key: "coach", text: C.hub.edgeCoach(save.coach.name, coachEffectsFor(save.coach).trainingPct), tone: "blue", icon: "coach" });
  for (const item of CAREER_GEAR.items) {
    if (save.finances.gear[item.id]) {
      edges.push({
        key: item.id,
        text: C.hub.edgeGear(C.finances.gear[item.id as keyof typeof C.finances.gear], Math.round(item.trainingBonus * 100)),
        tone: "neutral",
        icon: "gear",
      });
    }
  }
  if (save.finances.gear.psychologist) edges.push({ key: "psych", text: C.hub.edgePsych, tone: "good", icon: "mind" });
  if (save.finances.bootcampSharp > 0) edges.push({ key: "sharp", text: C.hub.edgeSharp, tone: "orange", icon: "sharp" });
  if (save.sponsor) {
    const row = CAREER_SPONSOR.tiers[save.sponsor.tier - 1];
    if (row.gearDiscountPct > 0 || row.freeBootcampsPerSeason > 0) edges.push({ key: "sponsor", text: C.hub.edgeSponsor(save.sponsor.tier), tone: "blue", icon: "sponsor" });
  }
  const bootcampReady = bootcampTierFor(save.reputation) > 0 && !save.finances.bootcampUsedThisSplit && running;

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "90ms" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{C.hub.trainingTitle}</p>
        <span className="flex items-center gap-2">
          <Badge tone={trainingDay ? "good" : eventToday ? "orange" : "neutral"}>{status}</Badge>
          <AppLink href="/career/training" className="text-[11px] font-semibold text-blue-bright underline-offset-4 hover:underline">
            {C.hub.trainingOpen} →
          </AppLink>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* this week's drill */}
        <AppLink href="/career/training" className="block">
          <div className={cx("flex h-full flex-col rounded-xl border p-3 transition-colors hover:border-line-strong", drill ? "border-blue/40 bg-blue/[0.06]" : "border-line bg-white/[0.03]")}>
            <div className="flex items-center gap-2">
              <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", drill ? "bg-blue/20 text-blue-bright" : "bg-white/5 text-faint")}>
                <DrillGlyph />
              </span>
              <div className="min-w-0">
                <p className="kicker !text-[9px]">{C.hub.drillNow}</p>
                <p className="display truncate text-sm font-bold uppercase tracking-wide text-ink">{drill ? C.training.drills[drill.id] : C.hub.drillNone}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {drill ? (
                drill.attrs.map((a) => (
                  <Badge key={a} tone="blue">
                    +{statLabels[a] ?? a}
                  </Badge>
                ))
              ) : (
                <span className="text-[11px] text-faint">{C.hub.drillPick} →</span>
              )}
            </div>
          </div>
        </AppLink>

        {/* scrim */}
        <div className={cx("flex h-full flex-col rounded-xl border p-3", scrim.available ? "border-cyan/40 bg-cyan/[0.05]" : "border-line bg-white/[0.03]")}>
          <div className="flex items-center gap-2">
            <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", scrim.available ? "bg-cyan/20 text-cyan" : "bg-white/5 text-faint")}>
              <ScrimGlyph />
            </span>
            <div className="min-w-0">
              <p className="kicker !text-[9px]">{C.hub.scrimTitle}</p>
              <p className="truncate text-xs text-sub">
                {scrim.available && scrim.opponentName
                  ? C.hub.scrimsLeft(scrim.remaining)
                  : scrim.reason === "restDay"
                    ? C.hub.restDay
                    : scrim.reason === "used"
                      ? C.scrim.usedUp
                      : C.hub.scrimUnavailable}
              </p>
            </div>
          </div>
          {scrim.available && scrim.opponentName ? (
            <Button variant="secondary" size="sm" full className="mt-2" onClick={() => runScrim()}>
              {C.hub.scrimCta(scrim.opponentName)}
            </Button>
          ) : null}
        </div>
      </div>

      {/* edges */}
      <div className="mt-3 border-t border-line/60 pt-3">
        <p className="kicker mb-1.5 !text-[9px]">{C.hub.edgesTitle}</p>
        {edges.length === 0 && !bootcampReady ? (
          <p className="text-[11px] text-faint">{C.hub.edgesEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {edges.map((e) => (
              <Badge key={e.key} tone={e.tone} className="gap-1.5 normal-case tracking-normal">
                <EdgeGlyph kind={e.icon} />
                {e.text}
              </Badge>
            ))}
            {bootcampReady ? (
              <AppLink href="/career/finances">
                <Badge tone="orange" className="gap-1.5 normal-case tracking-normal hover:bg-orange/20">
                  <EdgeGlyph kind="sharp" />
                  {C.hub.cards.bootcampReady}
                </Badge>
              </AppLink>
            ) : null}
          </div>
        )}
      </div>
    </Panel>
  );
}

const gp = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const DrillGlyph = () => (
  <svg {...gp} className="h-4 w-4">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
  </svg>
);
const ScrimGlyph = () => (
  <svg {...gp} className="h-4 w-4">
    <path d="m4 4 12 12M20 4 8 16M4 20l4-4m12 4-4-4" />
  </svg>
);
function EdgeGlyph({ kind }: { kind: Edge["icon"] }) {
  switch (kind) {
    case "coach":
      return (
        <svg {...gp} className="h-3 w-3">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1-4 3.5-6 7-6s6 2 7 6" />
        </svg>
      );
    case "gear":
      return (
        <svg {...gp} className="h-3 w-3">
          <rect x="4" y="5" width="16" height="11" rx="2" />
          <path d="M9 20h6M12 16v4" />
        </svg>
      );
    case "mind":
      return (
        <svg {...gp} className="h-3 w-3">
          <path d="M12 4a6 6 0 0 1 6 6c0 2.5-1.5 3.5-2 5v2h-8v-2c-.5-1.5-2-2.5-2-5a6 6 0 0 1 6-6Z" />
          <path d="M10 20h4" />
        </svg>
      );
    case "sharp":
      return (
        <svg {...gp} className="h-3 w-3">
          <path d="M13 3 5 13h6l-1 8 8-10h-6Z" />
        </svg>
      );
    case "sponsor":
      return (
        <svg {...gp} className="h-3 w-3">
          <path d="M4 7h16v10H4Z" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}
