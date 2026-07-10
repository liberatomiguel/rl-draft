"use client";

/**
 * Road to Worlds — Squad (v0.2 rebuild).
 *
 * FM-style squad management: pitch-styled starters panel (two-tap swap with a
 * visible before→after rating/chemistry readout), a chemistry module that
 * EXPLAINS itself (expandable per-pair breakdown from the engine's
 * ChemistryResult.items), bench + coach chips, a roster-stability meter tied
 * to CAREER_STABILITY, and a contracts table with renew (1/2/3-season length
 * picker previewing the exact engine ask) and release (severance from the
 * same formula releasePlayerFlow charges).
 *
 * All money math mirrors the flow layer 1:1 — computeSalaryAsk/quantize are
 * imported READ-ONLY from the engine so the preview can never drift.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { CAREER_CONTRACT, CAREER_STABILITY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { computeSalaryAsk, quantize } from "@/engine/career/economy";
import type { SquadPlayer } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import {
  agePhase,
  clockLabel,
  potBandOfSquad,
  repTierOf,
  seasonLabelFor,
  squadAge,
  statsOfSquad,
  useCareerSave,
  userTeamPreview,
} from "@/components/career/careerUi";
import { ErrorBanner } from "@/components/career/hub/hubShared";
import { PlayerCardTile } from "@/components/career/PlayerCardTile";
import { PlayerSheet, type PlayerSheetData } from "@/components/career/PlayerSheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

const CHEM_TIER_TONE: Record<string, "good" | "blue" | "neutral" | "bad"> = {
  Perfect: "good",
  Great: "good",
  Good: "blue",
  Okay: "neutral",
  Poor: "bad",
};

const RENEW_LENGTHS = [1, 2, 3] as const;

export function SquadScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const t = useCopy();
  const C = t.CAREER;
  const setStarters = useCareerStore((s) => s.setStarters);
  const releasePlayer = useCareerStore((s) => s.releasePlayer);
  const renewPlayer = useCareerStore((s) => s.renewPlayer);

  const [selected, setSelected] = useState<string | null>(null);
  /** Rating/chem snapshot taken right before a swap — powers the after-swap readout. */
  const [swapBefore, setSwapBefore] = useState<{ rating: number; chem: number } | null>(null);
  const [chemOpen, setChemOpen] = useState(false);
  const [sheet, setSheet] = useState<PlayerSheetData | null>(null);
  const [release, setRelease] = useState<SquadPlayer | null>(null);
  const [renew, setRenew] = useState<SquadPlayer | null>(null);
  const [renewLen, setRenewLen] = useState<1 | 2 | 3>(2);

  const team = useMemo(() => (save ? userTeamPreview(save) : null), [save]);

  if (!mounted || !save || !team) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        <div className="h-[60vh] animate-pulse rounded-2xl bg-white/5" aria-busy />
      </div>
    );
  }

  const clock = clockLabel(save);
  const byId = new Map(save.squad.map((p) => [p.id, p]));
  const starters = save.starterIds.map((id) => byId.get(id)).filter(Boolean) as SquadPlayer[];
  const bench = save.squad.filter((p) => !save.starterIds.includes(p.id));
  const wageBill =
    save.squad.reduce((s, p) => s + p.salaryPerSplit, 0) + (save.coach?.salaryPerSplit ?? 0);
  const teamRating = Math.round(team.rating.total);
  const chemTierLabel = t.CHEM_TIERS[team.chemistry.tier] ?? team.chemistry.tier;

  // --- two-tap swap ---------------------------------------------------------
  const onTileClick = (id: string) => {
    if (selected === null) {
      setSelected(id);
      setSwapBefore(null);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }
    const next = [...save.starterIds] as [string, string, string];
    const si = next.indexOf(selected);
    const ti = next.indexOf(id);
    if (si < 0 && ti < 0) {
      // bench ↔ bench: nothing to swap — move the selection instead.
      setSelected(id);
      return;
    }
    if (si >= 0 && ti >= 0) [next[si], next[ti]] = [next[ti], next[si]];
    else if (si >= 0) next[si] = id;
    else next[ti] = selected;
    setSwapBefore({ rating: teamRating, chem: team.chemistry.percent });
    setStarters(next);
    setSelected(null);
  };

  const openSheet = (p: SquadPlayer) =>
    setSheet({
      name: p.name,
      overall: p.overall,
      age: squadAge(save, p),
      archetype: p.archetype,
      country: p.country,
      region: p.region,
      band: potBandOfSquad(save, p),
      stats: statsOfSquad(p),
      wage: p.salaryPerSplit,
      contractLabel: seasonLabelFor(p.contractEndSeason),
      phase: agePhase(save, p),
      focusLabel:
        p.trainingFocus === "auto" || p.trainingFocus === "balanced"
          ? C.training[p.trainingFocus]
          : t.STAT_LABELS[p.trainingFocus],
    });

  // --- renew ask preview (mirrors renewPlayerFlow exactly) ------------------
  const askFor = (p: SquadPlayer, lengthSeasons: 1 | 2 | 3): number =>
    computeSalaryAsk({
      overall: p.overall,
      age: squadAge(save, p),
      potential: p.potential,
      rep: save.reputation,
      role: p.role,
      seasonIndex: save.clock.seasonIndex,
      lengthSeasons,
      difficulty: save.difficulty,
      careerSeed: save.careerSeed,
      playerId: p.id,
      // Same ambition rule renewPlayerFlow applies (careerFlow.ts).
      ambitious: p.overall >= 88 && repTierOf(save.reputation) < 3,
    });

  // --- release severance (same formula + quantize as releasePlayerFlow) -----
  const severanceFor = (p: SquadPlayer): number =>
    quantize(
      p.salaryPerSplit *
        // splits left on the deal — 3 splits per season (mirrors releasePlayerFlow).
        Math.max(1, (p.contractEndSeason - save.clock.seasonIndex) * 3) *
        CAREER_CONTRACT.releaseFeeFactor,
    );

  // --- roster stability -----------------------------------------------------
  const maxFaces = save.starterIds.length;
  const faces = save.competition.newFacesThisSplit.length;
  const nextFaces = faces + 1;
  const nextTier =
    nextFaces <= CAREER_STABILITY.freeNewFaces
      ? 0
      : nextFaces === CAREER_STABILITY.freeNewFaces + 1
        ? CAREER_STABILITY.secondFacePenaltyPct
        : CAREER_STABILITY.thirdFacePenaltyPct;
  const nextFacePct = Math.max(0, nextTier - save.competition.stabilityTierApplied);
  const userSeasonPts = save.competition.seasonPoints[save.identity.region]?.["user"] ?? 0;
  const stabilityExempt = CAREER_STABILITY.preseasonExempt && clock.kind === "preseason";
  const showStabilityWarning = nextFacePct > 0 && !stabilityExempt;

  return (
    <div className="rise-in mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4">
      <SectionTitle
        kicker={C.meta.title}
        title={C.squad.title}
        right={
          <div className="flex items-center gap-2 text-xs">
            <Badge tone="neutral">{save.squad.length}/4</Badge>
            <span className="text-sub">{C.squad.perSplit(formatMoney(wageBill, { compact: true }))}</span>
          </div>
        }
      />

      <ErrorBanner />

      {/* ==================== starters — the pitch ==================== */}
      <Panel strong className="relative overflow-hidden p-4 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, rgba(59,130,246,0.12), transparent 60%), repeating-linear-gradient(90deg, transparent 0 48px, rgba(255,255,255,0.03) 48px 49px)",
          }}
          aria-hidden
        />
        {/* center circle + halfway line */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/[0.05]"
          aria-hidden
        />

        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="kicker text-[11px]">{C.squad.starters}</p>
            <span className="text-xs text-sub">
              {C.club.stars} · <span className="display font-bold text-ink">{teamRating}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {starters.map((p) => (
              <PlayerCardTile
                key={p.id}
                name={p.name}
                overall={p.overall}
                age={squadAge(save, p)}
                band={potBandOfSquad(save, p)}
                archetype={p.archetype}
                country={p.country}
                region={p.region}
                selected={selected === p.id}
                onClick={() => onTileClick(p.id)}
              />
            ))}
          </div>

          {/* swap affordance / feedback line */}
          <div className="mt-2 min-h-[1.25rem] text-center text-[11px]">
            {selected ? (
              <span className="text-orange-bright">
                {C.squad.makeStarter} ↔ {C.squad.makeSub}
              </span>
            ) : swapBefore ? (
              <span className="font-semibold text-cyan">
                {C.squad.swapPreview(swapBefore.rating, teamRating)} ·{" "}
                {C.squad.chemPreview(swapBefore.chem, team.chemistry.percent)}
              </span>
            ) : (
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-faint">
                {C.squad.makeStarter} ↔ {C.squad.makeSub}
              </span>
            )}
          </div>

          {/* chemistry module — bar + tier + expandable "why" */}
          <div className="mt-3 rounded-xl border border-line bg-black/20 p-3">
            <button
              type="button"
              onClick={() => setChemOpen((v) => !v)}
              aria-expanded={chemOpen}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="kicker shrink-0 text-[10px]">{C.hub.chemistry}</span>
              <ProgressBar
                value={team.chemistry.percent / 100}
                tone="good"
                className="flex-1"
                label={C.hub.chemistry}
              />
              <span className="shrink-0 text-xs font-semibold text-emerald-300">
                {team.chemistry.percent}%
              </span>
              <Badge tone={CHEM_TIER_TONE[team.chemistry.tier] ?? "neutral"}>{chemTierLabel}</Badge>
              <svg
                viewBox="0 0 24 24"
                className={cx("h-4 w-4 shrink-0 text-sub transition-transform", chemOpen && "rotate-180")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {chemOpen && team.chemistry.items.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-line/60 pt-2">
                {team.chemistry.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-[11px] text-sub">
                    <span className="min-w-0 truncate">{it.label}</span>
                    <span className="shrink-0 font-semibold text-emerald-300">
                      +{Math.round(it.points * 10) / 10}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Panel>

      {/* ==================== bench + coach ==================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="kicker text-[11px]">{C.squad.bench}</p>
            <Badge tone="neutral">{C.squad.subSlot}</Badge>
          </div>
          {bench.length > 0 ? (
            bench.map((p) => (
              <PlayerCardTile
                key={p.id}
                name={p.name}
                overall={p.overall}
                age={squadAge(save, p)}
                band={potBandOfSquad(save, p)}
                archetype={p.archetype}
                country={p.country}
                region={p.region}
                size="sm"
                selected={selected === p.id}
                onClick={() => onTileClick(p.id)}
                className="mb-2"
                footer={C.squad.perSplit(formatMoney(p.salaryPerSplit, { compact: true }))}
              />
            ))
          ) : (
            <Link href="/career/market" className="block">
              <div className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-faint transition-colors hover:border-orange/50 hover:text-sub">
                {C.squad.emptySub}
              </div>
            </Link>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="kicker text-[11px]">{C.squad.coachSlot}</p>
            <Link
              href="/career/market"
              className="rounded-full bg-blue/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-bright transition-colors hover:bg-blue/20"
            >
              {C.market.coaches}
            </Link>
          </div>
          {save.coach ? (
            <div className="rounded-xl border border-line-strong bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between">
                <span className="display font-bold text-ink">{save.coach.name}</span>
                <span className="display text-xl font-bold text-ink">{save.coach.overall}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-sub">
                <span className="rounded bg-blue/10 px-1.5 py-0.5 font-semibold text-cyan">
                  {C.market.coachBonus(t.STAT_LABELS[save.coach.bonusType])} {save.coach.bonusLevel}
                </span>
                <span>{C.squad.perSplit(formatMoney(save.coach.salaryPerSplit, { compact: true }))}</span>
              </div>
            </div>
          ) : (
            <Link href="/career/market" className="block">
              <div className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-faint transition-colors hover:border-orange/50 hover:text-sub">
                {C.squad.emptyCoach}
              </div>
            </Link>
          )}
          {/* staff & boosts chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link
              href="/career/finances"
              className="rounded bg-white/6 px-2 py-1 text-[10px] font-semibold text-sub transition-colors hover:text-ink"
            >
              {C.finances.gearLadder}
            </Link>
            {save.finances.gear.psychologist ? (
              <span className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                {C.finances.psychologist}
              </span>
            ) : null}
          </div>
        </Panel>
      </div>

      {/* ==================== roster stability ==================== */}
      <Panel glow={showStabilityWarning ? "orange" : undefined} className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="kicker mb-1 text-[11px]">{C.squad.stability}</p>
            <p className="text-sm text-sub">{C.squad.stabilityState(faces, maxFaces)}</p>
          </div>
          <div className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: maxFaces }, (_, i) => (
              <span
                key={i}
                className={cx(
                  "h-2 w-8 rounded-full",
                  i < faces
                    ? i + 1 <= CAREER_STABILITY.freeNewFaces
                      ? "bg-cyan/70"
                      : "bg-orange"
                    : "bg-white/8",
                )}
              />
            ))}
          </div>
        </div>
        {showStabilityWarning ? (
          <p className="mt-2 text-xs font-semibold text-orange-bright">
            {C.squad.stabilityWarning(nextFacePct, userSeasonPts)}
          </p>
        ) : null}
      </Panel>

      {/* ==================== contracts ==================== */}
      <Panel className="p-4">
        <p className="kicker mb-3 text-[11px]">{C.squad.contracts}</p>
        <div className="space-y-2">
          {save.squad.map((p) => {
            const expiring = p.contractEndSeason === save.clock.seasonIndex;
            return (
              <div
                key={p.id}
                className={cx(
                  "flex flex-wrap items-center gap-3 rounded-lg border bg-white/[0.02] p-2.5",
                  expiring ? "border-orange/40" : "border-line",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="display truncate font-bold text-ink">{p.name}</span>
                    {p.role === "sub" ? <Badge tone="neutral">{C.market.sub}</Badge> : null}
                    {expiring ? <Badge tone="orange">{C.squad.expiring}</Badge> : null}
                    {p.finalSeasonAnnounced ? <Badge tone="bad">{C.squad.finalSeason}</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    {Math.round(p.overall)} {C.common.ovr} · {C.player.age(squadAge(save, p))} ·{" "}
                    {C.squad.expires(seasonLabelFor(p.contractEndSeason))}
                  </div>
                </div>
                <span className="text-xs text-sub">
                  {C.squad.perSplit(formatMoney(p.salaryPerSplit, { compact: true }))}
                </span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => openSheet(p)}>
                    {C.market.viewSheet}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRenewLen(2);
                      setRenew(p);
                    }}
                  >
                    {C.squad.renew}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setRelease(p)}>
                    {C.squad.release}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <PlayerSheet data={sheet} onClose={() => setSheet(null)} />

      {/* ==================== release confirm ==================== */}
      <Modal
        open={Boolean(release)}
        onClose={() => setRelease(null)}
        title={release ? C.squad.releaseConfirm(release.name) : ""}
        actions={
          <>
            <Button variant="ghost" onClick={() => setRelease(null)}>
              {C.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (release) releasePlayer(release.id);
                setRelease(null);
              }}
            >
              {C.squad.release}
            </Button>
          </>
        }
      >
        <p className="text-sm text-sub">{C.squad.releaseBody}</p>
        {release ? (
          <p className="mt-2 text-sm font-semibold text-bad">
            {C.squad.releaseFee(formatMoney(severanceFor(release)))}
          </p>
        ) : null}
      </Modal>

      {/* ==================== renew — length picker + ask preview ========== */}
      <Modal
        open={Boolean(renew)}
        onClose={() => setRenew(null)}
        title={renew ? `${C.squad.renew} — ${renew.name}` : ""}
        actions={
          <>
            <Button variant="ghost" onClick={() => setRenew(null)}>
              {C.common.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (renew) renewPlayer(renew.id, renewLen);
                setRenew(null);
              }}
            >
              {C.common.confirm}
            </Button>
          </>
        }
      >
        {renew ? (
          <div className="space-y-4">
            <div>
              <p className="kicker mb-2 text-[10px]">{C.market.lengthLabel}</p>
              <div className="grid grid-cols-3 gap-2">
                {RENEW_LENGTHS.map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setRenewLen(len)}
                    className={cx(
                      "rounded-lg border p-2.5 text-center transition-colors",
                      renewLen === len
                        ? "border-orange bg-orange/10"
                        : "border-line bg-white/[0.02] hover:border-line-strong",
                    )}
                  >
                    <span
                      className={cx(
                        "display block text-sm font-bold",
                        renewLen === len ? "text-orange-bright" : "text-ink",
                      )}
                    >
                      {C.market.seasons(len)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-sub">
                      {C.squad.perSplit(formatMoney(askFor(renew, len), { compact: true }))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-white/[0.02] p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-sub">{C.squad.wage}</span>
                <span className="font-semibold text-ink">
                  {C.squad.perSplit(formatMoney(renew.salaryPerSplit))} →{" "}
                  {C.squad.perSplit(formatMoney(askFor(renew, renewLen)))}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-sub">{C.player.contract}</span>
                <span className="font-semibold text-ink">
                  {C.squad.expires(seasonLabelFor(save.clock.seasonIndex + renewLen))}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
