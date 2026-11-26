"use client";

/**
 * v2.2 Pro (PRO-SPEC §4, R150): the player's card. Slice 1 shows who he is,
 * his six attributes and overall (no ceiling: there is none to show), and
 * the meters the week will move. No active Pro save → the Pro picker.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CAREER_PRO } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { PRO_STAT_KEYS, proAgeOf, proOverall } from "@/engine/career/pro/growth";
import { cardFromSave, encodeCard } from "@/engine/career/pro/card";
import { rankOf } from "@/engine/career/pro/ranked";
import { buttonClass } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";
import { REGION_BADGE } from "@/components/regionStyle";
import { AppLink } from "@/components/ui/AppLink";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { activeProSave, useProStore } from "@/store/proStore";
import { useMounted } from "@/store/useMounted";

export function ProPlayerScreen() {
  const C = useCareerCopy();
  const copy = useCopy();
  const router = useRouter();
  const mounted = useMounted();
  const save = useProStore((s) => activeProSave(s));

  useEffect(() => {
    if (mounted && !save) router.replace("/career/pro");
  }, [mounted, save, router]);

  if (!mounted || !save) return <div className="min-h-[60vh]" aria-busy />;

  const p = save.player;
  const rank = rankOf(p.mmr);
  const overall = proOverall(p.attrs);
  const span = CAREER_PRO.attrMax - CAREER_PRO.attrMin;

  return (
    <div className="rise-in mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <SectionTitle
        title={p.name}
        kicker={`${C.player.archetype[p.archetype]} · ${C.pro.player.age(proAgeOf(p, save.clock.seasonIndex))}`}
        right={
          <AppLink href="/career/pro" className="text-sm font-semibold text-blue-bright hover:underline">
            {C.pro.player.allCareers}
          </AppLink>
        }
      />

      {/* The one board that is one object: the player card. */}
      <Panel className="mt-5 grid lg:grid-cols-[minmax(14rem,18rem)_1fr]">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-sub">
            <CountryChip code={p.country} />
            <Badge className={REGION_BADGE[p.region]}>{copy.SETUP.regionNames[p.region]}</Badge>
            <Badge>{C.pro.player.stage[save.stage]}</Badge>
          </div>
          <div>
            <span className="display block text-6xl font-bold leading-none text-ink">{Math.floor(overall)}</span>
            <span className="mt-1 block text-xs text-sub">{C.pro.player.overall}</span>
          </div>
          <p className="text-sm leading-snug text-sub">{C.pro.player.noCeiling}</p>
        </div>

        <div className="border-t border-line p-5 lg:border-l lg:border-t-0">
          <p className="kicker mb-3">{C.pro.player.attributes}</p>
          <div className="space-y-2.5">
            {PRO_STAT_KEYS.map((k) => {
              const v = Math.floor(p.attrs[k]);
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs uppercase tracking-wider text-sub">{copy.STAT_LABELS[k]}</span>
                  <ProgressBar value={(p.attrs[k] - CAREER_PRO.attrMin) / span} tone={v >= 90 ? "orange" : "blue"} className="flex-1" label={copy.STAT_LABELS[k]} />
                  <span className="display w-8 text-right text-sm font-bold text-ink">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* The meters the week moves (slice 2): a strip of figures, not boxes. */}
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
        <Figure value={`${Math.round(p.energy)}`} label={C.pro.player.energy} />
        <Figure value={`${p.fame}`} label={C.pro.player.fans} />
        <Figure value={formatMoney(p.money)} label={C.pro.player.money} />
        <Figure value={`${p.mmr}`} label={C.pro.player.mmr} />
        <span className="flex items-center gap-2">
          <RankBadge rank={rank} variant="menu" size="sm" />
          <span className="text-xs text-sub">{C.proWeek.ranked.division(rank.label, rank.division)}</span>
        </span>
      </div>

      <div className="mt-8 border-t border-line pt-5">
        <h3 className="display text-lg font-bold uppercase leading-none text-ink">{C.pro.player.nextTitle}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-snug text-sub">{C.pro.player.nextBody}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <AppLink href="/career/pro/career" className={buttonClass("primary", "md")}>
            {C.pro.player.openCareer}
          </AppLink>
          <AppLink href="/career/pro/week" className={buttonClass("secondary", "md")}>
            {C.proWeek.openWeek}
          </AppLink>
          <AppLink
            href={`/career/pro/card#${encodeCard(cardFromSave(save))}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-bright hover:underline"
          >
            {C.proCard.own}
          </AppLink>
        </div>
      </div>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <span className="block min-w-0">
      <span className="display block whitespace-nowrap text-2xl font-bold leading-none text-ink">{value}</span>
      <span className="mt-1 block text-xs text-sub">{label}</span>
    </span>
  );
}
