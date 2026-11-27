"use client";

/**
 * Road to Worlds v2.0 (R40) — a Major / Worlds SATURDAY after its Swiss: the
 * event pauses until Championship Sunday. The panel says where the user
 * stands (through with a seed, or out in the Swiss), shows the weekend and
 * the playoff eight, and offers the one way forward — "Continue to
 * Championship Sunday" (the store's continueEventToNextDay: exactly one day)
 * — plus a way back to HQ. Everything is derived from the persisted save, so
 * a reload lands right back here; nothing of Sunday exists yet to spoil.
 * rc.36 (SUN-01, R88): with CAREER_SUNDAY.saturdayStop the way forward is
 * HQ, where Sunday is started (the optional coach briefing).
 */

import { useRouter } from "next/navigation";
import { CAREER_SUNDAY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import type { ActiveEventState, CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { TierChip } from "@/components/career/hub/hubShared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { CareerBracket } from "./CareerBracket";
import { CareerSwissStandings } from "./CareerSwissStandings";
import { SeedList } from "./SeedList";
import { ContinueToSundayLabel, WeekendPlan } from "./WeekendPlan";
import { advancedSeedsOf, userSeedOf, userSundaySideOf } from "./weekendView";

export function SwissCompletePanel({ save, ev }: { save: CareerSave; ev: ActiveEventState }) {
  const C = useCareerCopy();
  const T = useCopy().TOURNAMENT_UI;
  const router = useRouter();
  const continueEventToNextDay = useCareerStore((s) => s.continueEventToNextDay);

  const def = ev.def;
  const t = ev.tournament;
  const seeds = advancedSeedsOf(t);
  const seed = userSeedOf(t);
  const through = seed !== null;
  // v2.2 event formats: a 16-team double elimination has no stage; its Saturday record is the bracket's.
  const bracketRecord = () => {
    let wins = 0;
    let losses = 0;
    for (const r of t.playoffs?.rounds ?? []) {
      for (const x of r.series) {
        if (x.teamAId !== "user" && x.teamBId !== "user") continue;
        if (x.winnerTeamId === "user") wins += 1;
        else losses += 1;
      }
    }
    return { wins, losses };
  };
  const record =
    t.layout?.stage === "none"
      ? bracketRecord()
      : (t.swiss.records.find((r) => r.teamId === "user") ?? { wins: 0, losses: 0 });
  const records = new Map(
    t.swiss.records.map((r) => [r.teamId, { wins: r.wins, losses: r.losses, gameDiff: r.gameDiff }]),
  );
  // v2.2 event formats: the stage's own words, the side the user starts Sunday on.
  const F = C.event.formats;
  const stageKind = t.layout?.stage;
  const side = userSundaySideOf(t);
  const fieldTitle = !t.layout
    ? C.event.playoffEight
    : stageKind === "none"
      ? F.lastEight
      : F.sundayField(seeds.length);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6 sm:px-4">
      <Panel
        strong
        glow={through ? "orange" : "blue"}
        className="rise-in relative overflow-hidden p-5 text-center sm:p-8"
      >
        <div
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-x-0 top-0 h-40",
            through
              ? "bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.18),transparent_70%)]"
              : "bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.16),transparent_70%)]",
          )}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p className="kicker">{def.name}</p>
            <TierChip tier={def.tier} />
          </div>
          <p className="kicker mt-3 text-faint">{stageKind ? F.stageComplete[stageKind] : C.event.swissComplete}</p>

          <div role="status">
            <p
              className={cx(
                "display mt-1.5 text-3xl font-bold uppercase leading-none tracking-wide sm:text-5xl",
                through ? "text-orange-bright" : "text-ink",
              )}
            >
              {through ? C.event.throughToSunday : stageKind ? F.eliminatedIn[stageKind] : C.event.eliminatedInSwiss}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {side ? (
                <Badge tone="orange" className="!text-xs">
                  {F.side[side]}
                </Badge>
              ) : seed !== null ? (
                <Badge tone="orange" className="!text-xs">
                  {C.event.yourSeed(seed)}
                </Badge>
              ) : null}
              <Badge tone={through ? "good" : "bad"} className="!text-xs">
                {C.event.swissRecord} · {T.record(record.wins, record.losses)}
              </Badge>
            </div>
            {!through ? <p className="mt-2 text-sm text-sub">{C.event.sundayWithoutYou}</p> : null}
          </div>

          <WeekendPlan
            save={save}
            def={def}
            bare
            doneRoles={["swissDay"]}
            className="mx-auto mt-6 max-w-lg"
            notes={
              side
                ? { championshipSunday: { text: F.side[side], tone: "orange" } }
                : seed !== null
                  ? { championshipSunday: { text: C.event.yourSeed(seed), tone: "orange" } }
                  : undefined
            }
          />

          {/* rc.36 (SUN-01, R88): back to HQ, where Sunday is started (the briefing). */}
          {CAREER_SUNDAY.saturdayStop ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-2">
              <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => router.push("/career")}>
                {C.event.continueToHq}
              </Button>
              <p className="text-xs text-faint">{C.sunday.fromHqHint}</p>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => continueEventToNextDay()}
                >
                  <ContinueToSundayLabel />
                </Button>
                <Button variant="ghost" className="w-full sm:w-auto" onClick={() => router.push("/career")}>
                  {C.event.continueToHq}
                </Button>
              </div>
              <p className="mt-3 text-xs text-faint">{C.event.pauseHint}</p>
            </>
          )}
        </div>
      </Panel>

      <SeedList
        save={save}
        t={t}
        rows={seeds}
        title={fieldTitle}
        style={{ animationDelay: "60ms" }}
      />

      <div className="rise-in" style={{ animationDelay: "120ms" }}>
        {stageKind === "none" ? (
          <CareerBracket
            save={save}
            t={t}
            revealed={new Set((t.playoffs?.rounds ?? []).flatMap((r, ri) => r.series.map((_, si) => `po:${ri}:${si}`)))}
            liveKey={null}
            showUpcoming
            layout="wide"
          />
        ) : (
          <CareerSwissStandings
            save={save}
            t={t}
            records={records}
            throughRound={t.swiss.rounds.length}
            stage={t.swiss.kind ? t.swiss : undefined}
          />
        )}
      </div>
    </div>
  );
}
