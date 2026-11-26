"use client";

/**
 * v2.2 Pro (PRO-SPEC §5): the week planner. Three blocks, each one activity;
 * the energy the plan leaves, what each block is worth in plain numbers, the
 * coach's plan and "repeat last week", then the ranked panel and the log of
 * why the attributes moved.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CAREER_PRO_WEEK, RANKS } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import { PRO_STAT_KEYS, proOverall } from "@/engine/career/pro/growth";
import { ratingBonusOf } from "@/engine/career/pro/form";
import { nextMechanic } from "@/engine/career/pro/mechanics";
import type { ProActivity, ProPlayer, ProTrainingFocus, ProWeekPlan } from "@/engine/career/pro/types";
import { coachPlanFor, isBurnedOut, previewWeek, repeatPlanFor, type BlockPreview } from "@/engine/career/pro/week";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cx } from "@/lib/util";
import { activeProSave, useProStore } from "@/store/proStore";
import { useMounted } from "@/store/useMounted";
import { ProGrowthLog } from "./ProGrowthLog";
import { ProRankedPanel } from "./ProRankedPanel";

const KINDS = ["train", "ranked", "scrim", "content", "rest"] as const;
const FOCUSES: ProTrainingFocus[] = [...PRO_STAT_KEYS, "balanced"];

function defaultActivity(kind: (typeof KINDS)[number], focus: ProTrainingFocus): ProActivity {
  return kind === "train" ? { kind, focus } : ({ kind } as ProActivity);
}

export function ProWeekScreen() {
  const C = useCareerCopy();
  const W = C.proWeek;
  const router = useRouter();
  const mounted = useMounted();
  const save = useProStore((s) => activeProSave(s));
  const lastWeek = useProStore((s) => s.lastWeek);
  const playWeek = useProStore((s) => s.playWeek);
  const [plan, setPlan] = useState<ProWeekPlan | null>(null);

  useEffect(() => {
    if (mounted && !save) router.replace("/career/pro");
  }, [mounted, save, router]);

  const ctx = useMemo(
    () =>
      save
        ? { seasonIndex: save.clock.seasonIndex, hasTeam: save.team !== null, careerSeed: save.careerSeed, stage: save.stage }
        : null,
    [save],
  );

  if (!mounted || !save || !ctx) return <div className="min-h-[60vh]" aria-busy />;

  const p = save.player;
  const current: ProWeekPlan = plan ?? repeatPlanFor(p, ctx);
  const preview = previewWeek(p, current, ctx);
  const out = isBurnedOut(p);
  const endLine = out
    ? W.warn.burnedOut
    : preview.tired
      ? W.warn.tired(preview.energyEnd)
      : preview.warns
        ? W.warn.warning(preview.energyEnd)
        : W.warn.ok(preview.energyEnd);
  const trace = [Math.round(p.energy), ...preview.blocks.map((b) => b.energyAfter), preview.energyEnd];

  const setBlock = (i: number, a: ProActivity) => {
    const next = [...current] as ProWeekPlan;
    next[i] = a;
    setPlan(next);
  };

  const confidenceWord = W.form.words[Math.round(p.confidence) + 2] ?? W.form.words[2];

  return (
    <div className="rise-in mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <SectionTitle
        title={W.title}
        kicker={W.kicker}
        right={
          <AppLink href="/career/pro/career" className="text-sm font-semibold text-blue-bright hover:underline">
            {p.name}
          </AppLink>
        }
      />

      {/* Energy: the figure, the bar, and where the plan takes it. */}
      <Panel className="mt-5 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="display block text-5xl font-bold leading-none text-ink">{Math.round(p.energy)}</span>
            <span className="mt-1 block text-xs text-sub">{W.energy}</span>
          </div>
          <div className="text-right">
            <span className="display block text-2xl font-bold leading-none text-ink">{Math.floor(proOverall(p.attrs))}</span>
            <span className="mt-1 block text-xs text-sub">{C.pro.player.overall}</span>
          </div>
        </div>
        <ProgressBar
          value={p.energy / CAREER_PRO_WEEK.energyMax}
          tone={p.energy < CAREER_PRO_WEEK.lowEnergy ? "orange" : "blue"}
          className="mt-4"
          label={W.energy}
        />
        <p className="mt-3 text-xs text-sub" aria-label={W.energyTraceLabel}>
          {W.energyTrace(trace)}
        </p>
        <p className={cx("mt-2 text-sm leading-snug", preview.warns || out ? "text-orange-bright" : "text-sub")} role={preview.warns ? "status" : undefined}>
          {endLine}
        </p>
        <p className="mt-3 text-xs text-sub">
          {W.form.confidence}: <span className="text-ink">{confidenceWord}</span>
          {p.confidence !== 0 ? ` (${ratingBonusOf(p.confidence) > 0 ? "+" : ""}${ratingBonusOf(p.confidence)})` : ""} · {W.form.confidenceHint}
        </p>
      </Panel>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPlan(coachPlanFor(p, ctx))} title={W.shortcuts.coachHint}>
          {W.shortcuts.coach}
        </Button>
        <Button variant="secondary" size="sm" disabled={!p.lastPlan} onClick={() => setPlan(p.lastPlan ?? null)}>
          {W.shortcuts.repeat}
        </Button>
      </div>
      <p className="mt-2 max-w-2xl text-xs leading-snug text-sub">{W.shortcuts.coachHint}</p>

      {/* The three blocks. */}
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {current.map((activity, i) => (
          <BlockCard
            key={i}
            index={i}
            activity={activity}
            preview={preview.blocks[i]}
            hasTeam={ctx.hasTeam}
            out={out}
            onPick={(kind) => setBlock(i, defaultActivity(kind, activity.kind === "train" ? activity.focus : "mechanics"))}
            onFocus={(focus) => setBlock(i, { kind: "train", focus })}
          />
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            playWeek(current);
            setPlan(current);
          }}
        >
          {W.play}
        </Button>
      </div>

      {lastWeek ? (
        <Panel className="mt-6 p-5">
          <p className="kicker mb-2">{W.result.title}</p>
          <p className="text-xs text-sub">
            {W.result.energy}: {W.energyTrace(lastWeek.energyTrace)}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-snug text-ink">
            {lastWeek.notes.map((n, i) => (
              <li key={`${n.code}:${i}`}>{W.notes[n.code]?.(n.n, noteRef(n.code, n.ref, C.proMoments.calls)) ?? n.code}</li>
            ))}
            {lastWeek.growth.length === 0 ? <li className="text-sub">{W.result.noGrowth}</li> : null}
          </ul>
        </Panel>
      ) : null}

      <MechanicsLine player={p} />

      <div className="mt-8 grid gap-8 border-t border-line pt-6 lg:grid-cols-2">
        <ProRankedPanel player={p} />
        <ProGrowthLog log={save.growthLog} />
      </div>
    </div>
  );
}

/** The name a note quotes: a mechanic's name, or a rank's. */
function noteRef(code: string, ref: string | undefined, calls: Record<string, string>): string | undefined {
  if (!ref) return ref;
  if (code === "mechanicUnlocked") return calls[ref] ?? ref;
  if (code === "rankUp" || code === "rankDown") return RANKS.find((r) => r.id === ref)?.label ?? ref;
  return ref;
}

/** The mechanics he has and the one he is chasing. */
function MechanicsLine({ player }: { player: ProPlayer }) {
  const M = useCareerCopy().proMoments;
  const next = nextMechanic(player);
  return (
    <section className="mt-6" aria-label={M.mechanics.title}>
      <p className="kicker mb-2">{M.mechanics.title}</p>
      {player.mechanics.length > 0 ? (
        <p className="text-sm text-ink">{player.mechanics.map((id) => M.calls[id] ?? id).join(" · ")}</p>
      ) : null}
      <p className="mt-1 text-sm text-sub">
        {next ? M.mechanics.next(M.calls[next.id] ?? next.id, next.blocksLeft, next.mechanicsLeft) : M.mechanics.all}
      </p>
    </section>
  );
}

function BlockCard({
  index,
  activity,
  preview,
  hasTeam,
  out,
  onPick,
  onFocus,
}: {
  index: number;
  activity: ProActivity;
  preview: BlockPreview;
  hasTeam: boolean;
  out: boolean;
  onPick: (kind: (typeof KINDS)[number]) => void;
  onFocus: (focus: ProTrainingFocus) => void;
}) {
  const W = useCareerCopy().proWeek;
  const copy = useCopy();
  const gains = Object.entries(preview.gains).filter(([, v]) => (v ?? 0) > 0) as [string, number][];
  const effects: string[] = [
    ...gains.map(([k, v]) => W.projected.gain(copy.STAT_LABELS[k], v)),
    ...(preview.mmr !== undefined ? [W.projected.mmr(preview.mmr)] : []),
    ...(preview.money ? [W.projected.money(preview.money)] : []),
    ...(preview.fame ? [W.projected.fame(preview.fame)] : []),
    ...(preview.chemistry ? [W.projected.chemistry(preview.chemistry)] : []),
  ];
  if (effects.length === 0 && activity.kind !== "rest") effects.push(W.projected.none);
  return (
    <Panel className="p-4">
      <p className="kicker mb-2">{W.blockNames[index]}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={W.blockNames[index]}>
        {KINDS.map((k) => {
          const disabled = out || (k === "scrim" && !hasTeam);
          const on = activity.kind === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onPick(k)}
              className={cx(
                "min-h-11 rounded-lg border px-3 text-xs font-semibold transition-colors sm:min-h-9",
                on ? "border-orange bg-orange/10 text-ink" : "border-line-strong text-sub hover:border-blue/60",
                disabled && "cursor-not-allowed opacity-40",
              )}
            >
              {W.activity[k]}
            </button>
          );
        })}
      </div>
      {activity.kind === "train" && !out ? (
        <label className="mt-3 block text-xs text-sub">
          {W.focus}
          <select
            value={activity.focus}
            onChange={(e) => onFocus(e.target.value as ProTrainingFocus)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-line-strong bg-transparent px-2 text-sm text-ink sm:min-h-9"
          >
            {FOCUSES.map((f) => (
              <option key={f} value={f} className="bg-paper text-ink">
                {f === "balanced" ? W.focusBalanced : copy.STAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="mt-3 text-xs leading-snug text-sub">{out ? W.burnedOutBlock : (W.activityHint[activity.kind] ?? "")}</p>
      {preview.blocked === "needsTeam" ? <p className="mt-1 text-xs text-bad">{W.needsTeam}</p> : null}
      <ul className="mt-3 space-y-0.5 text-sm text-ink">
        {effects.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">{W.projected.energy(preview.energyAfter)}</p>
    </Panel>
  );
}
