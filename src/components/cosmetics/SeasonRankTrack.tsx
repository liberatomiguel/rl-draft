"use client";

import { useState } from "react";
import { RANKS } from "@/config/balance";
import { SEASON } from "@/config/season";
import { COSMETICS } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { rankForXp } from "@/engine/progression";
import { cx } from "@/lib/util";
import { RankBadge } from "@/components/ui/RankBadge";
import { BannerSurface, TitleTag, useCosmeticCopy } from "./CosmeticViews";

/** Preview reads the actual rank-reward catalog. Selecting a rank grants nothing. */
export function SeasonRankTrack({ xp, peakRankId }: { xp: number; peakRankId: string }) {
  const { PROFILE_UI: P, COSMETICS: C } = useCopy();
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
    <div className="pb-2 sm:overflow-x-auto">
      <div className="relative sm:min-w-[36rem]">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-8 sm:gap-0.5" aria-label={P.seasonTrack}>
          {ranks.map((rank, i) => <li key={rank.id}>
            <button type="button" aria-pressed={selected.id === rank.id} onClick={() => setSelectedId(rank.id)}
              className={cx("flex min-h-16 w-full cursor-pointer flex-col items-center justify-start rounded-lg border py-1 transition-colors", selected.id === rank.id ? "border-orange/60 bg-orange/10" : "border-transparent hover:bg-white/[0.04]")}>
              <RankBadge rank={rank} variant="menu" size="sm" className="!h-9 !w-9" />
              <span className={cx("display flex min-h-7 items-center justify-center text-[10px] font-bold leading-tight", i <= peakIdx ? "text-ink" : "text-sub")}>{rank.label}</span>
              <span className="mt-2 flex w-full flex-col gap-1 px-1 sm:mt-5">{COSMETICS.filter(c => c.source.type === "season-rank" && c.source.seasonId === SEASON.id && c.source.rankId === rank.id).map(c => <span key={c.id} className="flex min-h-6 items-center justify-center" title={copy.name(c.id)}>
                {c.kind === "banner" ? <BannerSurface banner={c} motion={false} displayPx={100} className="cos-banner-thumb h-6 w-full rounded"><span className="sr-only">{copy.name(c.id)}</span></BannerSurface> : <TitleTag title={c} size="xs" motion={false} className="!whitespace-normal !px-0.5 !text-[8px] text-center !leading-tight" />}
              </span>)}</span>
            </button>
          </li>)}
        </ol>
        <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] hidden h-1.5 rounded-full bg-white/8 sm:block" aria-hidden>
          <div className="h-full origin-left rounded-full bg-orange transition-transform duration-700" style={{transform:`scaleX(${Math.min(100,fill) / 100})`}} />
          {ranks.map((rank,i) => <span key={rank.id} className={cx("absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2", i <= peakIdx ? "border-orange-bright bg-orange-bright" : "border-line-strong bg-raised")} style={{left:`${nodeCenter(i)}%`}} />)}
        </div>
      </div>
    </div>
    <section className="mt-3 rounded-xl border border-line-strong bg-bg p-4" aria-live="polite" aria-label={P.rankRewardPreview(selected.label)}>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
        <p className="kicker text-[10px]">{P.rewardPreviewTitle}</p>
        <p className={cx("text-xs font-semibold", reached ? "text-good" : "text-sub")}>{reached ? `✓ ${P.rankRewardReached}` : P.rankRewardRequired(selected.label, selected.minXp)}</p>
      </div>
      <div className={cx("grid items-start gap-4", rewards.some(c => c.kind === "banner") && "sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)]")}>
        {rewards.some(c => c.kind === "banner") ? <div className="min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">{C.kindsPlural.banner}</p>
          <div className="w-full max-w-[480px]">
            {rewards.filter(c => c.kind === "banner").map(c => <BannerSurface key={c.id} banner={c} displayPx={480} className="h-20 w-full rounded-lg"><span className="sr-only">{copy.name(c.id)}</span></BannerSurface>)}
          </div>
        </div> : null}
        <div className="min-h-14 min-w-0">
          {rewards.some(c => c.kind === "title") ? <><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">{C.kindsPlural.title}</p>{rewards.filter(c => c.kind === "title").map(c => <TitleTag key={c.id} title={c} size="sm" />)}</> : null}
        </div>
      </div>
    </section>
  </div>;
}
