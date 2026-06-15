"use client";

/** Rules explainer. Client component so it follows the EN/PT language switch. */

import Link from "next/link";
import { DIFFICULTY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

export default function HowToPlayPage() {
  const { HOWTO, DIFFICULTY_LABELS } = useCopy();

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <BackToMenu />
      <SectionTitle kicker={HOWTO.kicker} title={HOWTO.title} className="mb-8" />

      <ol className="space-y-4">
        {HOWTO.steps.map((step, i) => (
          <li key={i}>
            <Panel className="flex gap-4 p-5">
              <span className="display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue/15 text-base font-bold text-blue-bright">
                {i + 1}
              </span>
              <div>
                <h2 className="display mb-1 text-lg font-bold uppercase tracking-wide text-ink">
                  {step.title}
                </h2>
                <p className="text-sm leading-relaxed text-sub">{step.body}</p>
              </div>
            </Panel>
          </li>
        ))}
      </ol>

      <SectionTitle title={HOWTO.difficultiesTitle} className="mb-4 mt-10" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]).map((id) => {
          const d = DIFFICULTY[id];
          return (
            <Panel key={id} className="p-4">
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="display text-base font-bold uppercase tracking-wide text-ink">
                  {DIFFICULTY_LABELS[id].label}
                </h3>
                {d.requiresLegacyUnlock ? <Badge tone="gold">{HOWTO.unlockable}</Badge> : null}
              </div>
              <p className="mb-3 text-xs leading-relaxed text-sub">{DIFFICULTY_LABELS[id].tagline}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="blue">{HOWTO.reroll(d.rerolls)}</Badge>
                <Badge tone="neutral">
                  {d.overallLockedHidden ? HOWTO.ovrLockedHidden : HOWTO.ovrOptional}
                </Badge>
                <Badge tone="neutral">{HOWTO.xpMult(d.xpMultiplier)}</Badge>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel className="mt-10 p-5 text-sm leading-relaxed text-sub">
        <h3 className="display mb-2 text-base font-bold uppercase tracking-wide text-ink">
          {HOWTO.raritiesTitle}
        </h3>
        <p>
          {HOWTO.raritiesBefore}
          <span className="font-semibold text-slate-300">{HOWTO.raritySilver}</span>
          {HOWTO.raritiesMid1}
          <span className="font-semibold text-amber-300">{HOWTO.rarityGold}</span>
          {HOWTO.raritiesMid2}
          <span className="font-semibold text-cyan">{HOWTO.rarityBlue}</span>
          {HOWTO.raritiesAfter}
        </p>
      </Panel>

      <p className="mt-10 text-center">
        <Link
          href="/play"
          className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.3)] transition-all hover:brightness-110"
        >
          {HOWTO.startFirst}
        </Link>
      </p>
    </div>
  );
}
