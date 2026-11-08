"use client";

import { useState } from "react";
import { RANKS } from "@/config/balance";
import { SEASON } from "@/config/season";
import { COSMETICS } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { rankForXp } from "@/engine/progression";
import { cx } from "@/lib/util";
import { RankBadge } from "@/components/ui/RankBadge";
import { BannerSurface, TitleTag, TIER_ACCENT, useCosmeticCopy } from "./CosmeticViews";

/** Preview reads the actual rank-reward catalog. Selecting a rank grants nothing. */
export function SeasonRankTrack({ xp, peakRankId }: { xp: number; peakRankId: string }) {
  const { PROFILE_UI: P } = useCopy();
  const copy = useCosmeticCopy();
  const ranks = RANKS.filter(r => r.id !== "unranked");
  const peakIdx = ranks.findIndex(r => r.id === peakRankId);
  const now = rankForXp(xp);
  const nowIdx = ranks.findIndex(r => r.id === now.id);
  const next = ranks[Math.max(peakIdx, nowIdx) + 1] ?? null;
  const [selectedId, setSelectedId] = useState(next?.id ?? now.id);
  const selected = ranks.find(r => r.id === selectedId) ?? ranks[0];
  const selectedIdx = ranks.indexOf(selected);
  const reached = selectedIdx <= Math.max(peakIdx, nowIdx);
  const rewards = COSMETICS.filter(c => c.source.type === "season-rank" && c.source.seasonId === SEASON.id && c.source.rankId === selected.id);
  const nodeCenter = (i: number) => ((i + 0.5) / ranks.length) * 100;
  const fill = nowIdx < 0 ? Math.max(0, now.progress * nodeCenter(0)) : nowIdx >= ranks.length - 1 ? 100 : nodeCenter(nowIdx) + now.progress * (nodeCenter(nowIdx + 1) - nodeCenter(nowIdx));

  return <div>
    <p className="mb-3 text-xs text-sub">{P.rankRewardSelect}</p>
    <div className="overflow-x-auto pb-2">
      <div className="relative min-w-[36rem]">
        <ol className="grid grid-cols-8 gap-0.5" aria-label={P.seasonTrack}>
          {ranks.map((rank, i) => <li key={rank.id}>
            <button type="button" aria-pressed={selected.id === rank.id} onClick={() => setSelectedId(rank.id)}
              className={cx("flex min-h-16 w-full cursor-pointer flex-col items-center justify-start rounded-lg border py-1 transition-colors", selected.id === rank.id ? "border-orange/60 bg-orange/10" : "border-transparent hover:bg-white/[0.04]")}>
              <RankBadge rank={rank} variant="menu" size="sm" className="!h-9 !w-9" />
              <span className={cx("display flex min-h-7 items-center justify-center text-[10px] font-bold leading-tight", i <= peakIdx ? "text-ink" : "text-sub")}>{rank.label}</span>
              <span className="mt-5 flex w-full flex-col gap-2 px-1">{COSMETICS.filter(c => c.source.type === "season-rank" && c.source.seasonId === SEASON.id && c.source.rankId === rank.id).map(c => <span key={c.id} className="flex min-h-12 flex-col items-center gap-1">
                {c.kind === "banner" ? <BannerSurface banner={c} motion={false} displayPx={100} className="cos-banner-thumb h-6 w-full rounded"><span /></BannerSurface> : <span className="text-[10px] font-bold text-orange-bright">{copy.kind(c.kind)}</span>}
                <span className="text-[10px] leading-tight text-ink">{copy.name(c.id)}</span>
              </span>)}</span>
            </button>
          </li>)}
        </ol>
        <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] h-1.5 rounded-full bg-white/8" aria-hidden>
          <div className="h-full rounded-full bg-orange transition-[width] duration-700" style={{width:`${Math.min(100,fill)}%`}} />
          {ranks.map((rank,i) => <span key={rank.id} className={cx("absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2", i <= peakIdx ? "border-orange-bright bg-orange-bright" : "border-line-strong bg-raised")} style={{left:`${nodeCenter(i)}%`}} />)}
        </div>
      </div>
    </div>
    <section className="mt-3 rounded-xl border border-line-strong bg-bg p-3" aria-live="polite" aria-label={P.rankRewardPreview(selected.label)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="display text-base font-bold text-ink">{selected.label}</p>
        <p className={cx("text-xs font-semibold", reached ? "text-good" : "text-sub")}>{reached ? `✓ ${P.rankRewardReached}` : P.rankRewardRequired(selected.label, selected.minXp)}</p>
      </div>
      <div className="space-y-3">{rewards.map(c => <div key={c.id}>
        {c.kind === "banner" ? <BannerSurface banner={c} displayPx={640} className="aspect-[6.2/1] w-full rounded-lg"><span className="sr-only">{copy.name(c.id)}</span></BannerSurface> : c.kind === "title" ? <div className="py-2"><TitleTag title={c} size="md" /></div> : null}
        <p className="mt-1.5 text-xs font-semibold text-ink">{copy.name(c.id)} <span className="ml-1 text-[11px] font-normal text-sub">{copy.kind(c.kind)} · <span style={{color:TIER_ACCENT[c.tier]}}>{copy.tier(c.tier)}</span></span></p>
      </div>)}</div>
      <p className="mt-3 border-t border-line pt-2 text-xs leading-relaxed text-sub">{P.rankRewardTiming}</p>
    </section>
    <p className="mt-3 text-xs text-sub">{next ? P.seasonTrackNext(next.label) : P.seasonTrackDone}</p>
  </div>;
}
