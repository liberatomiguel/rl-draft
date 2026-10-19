"use client";

/**
 * /challenges (v1.4) — the rank-unlocked puzzle grid. Each card is a fixed
 * historical line you must out-draft under a twist. Locked cards show their
 * unlock; available cards open a briefing (the line + the twist) and start the
 * run; cleared cards wear a gold ring. Re-skins existing primitives (Panel,
 * Badge, Button, Modal, TeamLogo) so it's consistent by construction.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RANKS } from "@/config/balance";
import {
  challenges as ALL_CHALLENGES,
  challengeById,
  lineupById,
  playerById,
  playerCardById,
  seasonById,
} from "@/data";
import { finalOverall, lineupHeader } from "@/engine/cards";
import { challengeStatus, countStars, rosterFromLineup, starsAvailable, totalStars, type ChallengeStatus } from "@/engine/challenges";
import { CHALLENGE } from "@/config/balance";
import type { ChallengeStar } from "@/engine/types";
import { rankForXp } from "@/engine/progression";
import { FieldView } from "@/components/cards/FieldView";
import type { Challenge } from "@/engine/types";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { achievementStyle } from "@/components/achievementStyle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { TeamLogo } from "@/components/ui/TeamLogo";

const rankInfo = (id: string) => RANKS.find((r) => r.id === id) ?? { id, label: id };
const rankLabel = (id: string) => rankInfo(id).label;

function bossOverall(lineupId: string): number {
  const lineup = lineupById.get(lineupId);
  if (!lineup) return 0;
  const sum = lineup.playerCardIds.reduce((s, id) => {
    const c = playerCardById.get(id);
    return s + (c ? finalOverall(c) : 0);
  }, 0);
  return Math.round(sum / Math.max(1, lineup.playerCardIds.length));
}

/** Star condition → copy (v2.0). */
export function starLabel(star: ChallengeStar, CH: ReturnType<typeof useCopy>["CHALLENGES_UI"]): string {
  switch (star.kind) {
    case "noSpecials":
      return CH.star.noSpecials;
    case "sweep":
      return CH.star.sweep(star.maxLosses);
    case "maxOverall":
      return CH.star.maxOverall(star.max);
    case "chemistry":
      return CH.star.chemistry(star.tier);
    case "underdog":
      return CH.star.underdog;
    case "maxRerolls":
      return CH.star.maxRerolls(star.max);
    case "goals":
      return CH.star.goals(star.min);
    case "concede":
      return CH.star.concede(star.max);
    case "noLosses":
      return CH.star.noLosses;
  }
}

/** ★★★ row: earned stars lit (v2.0). */
export function StarRow({ mask, total, size = "sm" }: { mask: number; total: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "text-lg" : "text-sm";
  return (
    <span className={cx("inline-flex items-center gap-0.5 leading-none", cls)} aria-label={`${countStars(mask)}/${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={mask & (1 << i) ? "text-amber-300" : "text-faint/60"} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

/** Human-readable twist lines for a challenge (empty = no twist). */
function twistLabels(ch: Challenge, CH: ReturnType<typeof useCopy>["CHALLENGES_UI"]): string[] {
  const out: string[] = [];
  const c = ch.constraint;
  if (c?.maxPlayerOverall) out.push(CH.twist.maxOverall(c.maxPlayerOverall));
  if (c?.region) out.push(CH.twist.region(c.region));
  if (c?.seasonId) out.push(CH.twist.season(seasonById.get(c.seasonId)?.shortLabel ?? c.seasonId));
  if (c?.country) out.push(CH.twist.country(c.country));
  if (c?.noSpecials) out.push(CH.twist.noSpecials);
  if (ch.fixedPlayerCardId) {
    const nick = playerById.get(playerCardById.get(ch.fixedPlayerCardId)?.playerId ?? "")?.nickname;
    if (nick) out.push(CH.twist.fixed(nick));
  }
  return out;
}

export function ChallengesView() {
  const mounted = useMounted();
  const { CHALLENGES_UI: CH } = useCopy();
  const xp = useProfileStore((s) => s.xp);
  const completed = useProfileStore((s) => s.challengesCompleted);
  const starMasks = useProfileStore((s) => s.challengeStars);

  // Ordered by required rank, then by reward (easier first within a tier).
  const ordered = useMemo(
    () =>
      [...ALL_CHALLENGES].sort(
        (a, b) =>
          RANKS.findIndex((r) => r.id === a.rankRequired) -
            RANKS.findIndex((r) => r.id === b.rankRequired) || a.reward.xp - b.reward.xp,
      ),
    [],
  );

  // Pre-mount: treat as a guest (everything locked) to avoid hydration mismatch.
  const statusOf = (ch: Challenge): ChallengeStatus =>
    mounted ? challengeStatus(ch, xp, completed) : "locked";
  const clearedCount = mounted ? ordered.filter((c) => completed[c.id]).length : 0;
  const starsEarned = mounted ? totalStars(starMasks) : 0;
  const starsMax = ordered.reduce((n, c) => n + starsAvailable(c), 0);

  const [active, setActive] = useState<Challenge | null>(null);

  // Whole mode is rank-gated (Bronze, alongside the Collection) — v1.4.
  const modeLocked = mounted && rankForXp(xp).id === "unranked";

  // Group into rarity sections (common → legend), preserving the rank/reward sort
  // within each tier.
  const TIER_ORDER = ["common", "rare", "epic", "legend"] as const;
  const sections = TIER_ORDER.map((tier) => ({
    tier,
    items: ordered.filter((c) => c.tier === tier),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="rise-in mx-auto max-w-5xl">
      <SectionTitle
        kicker={CH.progress(clearedCount, ordered.length)}
        title={CH.title}
        right={<Badge tone="gold">★ {CH.starsCount(starsEarned, starsMax)}</Badge>}
        className="mb-2"
      />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-sub">{CH.subtitle}</p>

      {modeLocked ? (
        <Panel className="p-8 text-center">
          <p className="display text-lg font-bold uppercase tracking-wide text-ink">{CH.modeLockedTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sub">{CH.modeLockedBody}</p>
        </Panel>
      ) : (
        <div className="space-y-8">
          {sections.map(({ tier, items }) => {
            const cleared = mounted ? items.filter((c) => completed[c.id]).length : 0;
            return (
              <section key={tier}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="display text-sm font-bold uppercase tracking-[0.16em] text-ink">
                    {CH.tier[tier]}
                  </h2>
                  <span className="text-xs font-semibold text-faint">{CH.progress(cleared, items.length)}</span>
                  <span className="h-px flex-1 bg-line/60" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((ch) => (
                    <ChallengeCard
                      key={ch.id}
                      ch={ch}
                      status={statusOf(ch)}
                      starMask={mounted ? starMasks[ch.id] ?? 0 : 0}
                      onOpen={() => {
                        sfx.click();
                        setActive(ch);
                      }}
                      CH={CH}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <BriefingModal challenge={active} onClose={() => setActive(null)} CH={CH} />
    </div>
  );
}

function ChallengeCard({
  ch,
  status,
  starMask,
  onOpen,
  CH,
}: {
  ch: Challenge;
  status: ChallengeStatus;
  starMask: number;
  onOpen: () => void;
  CH: ReturnType<typeof useCopy>["CHALLENGES_UI"];
}) {
  const style = achievementStyle({ id: ch.id, category: ch.tier });
  const cleared = status === "cleared";
  const locked = status === "locked";
  const header = lineupHeader(ch.opponentLineupId);
  const twists = twistLabels(ch, CH);
  const total = starsAvailable(ch);
  const earnedCount = countStars(starMask);
  const perfect = earnedCount >= total;
  const starLabels = [CH.star1, ...(ch.stars ?? []).map((st) => starLabel(st, CH))];
  const starXp = CHALLENGE.starXp[ch.tier] ?? 0;

  // The same layout for every status (rc.2): a locked card shows what it IS,
  // under a dark overlay that says what opens it.
  const inner = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className={cx("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", style.chip)}>{style.label}</span>
          {ch.kind === "gauntlet" ? <Badge tone="blue">{CH.gauntletKicker}</Badge> : null}
        </span>
        {perfect ? (
          <Badge tone="gold">✓ {CH.status.cleared}</Badge>
        ) : cleared ? (
          <StarRow mask={starMask} total={total} />
        ) : (
          <Badge tone="blue">{CH.rewardXp(ch.reward.xp)}</Badge>
        )}
      </div>

      <h3 className="display text-base font-bold uppercase tracking-wide text-ink">{ch.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-sub">{ch.brief}</p>

      <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-3">
        <TeamLogo orgId={lineupById.get(ch.opponentLineupId)!.orgId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-sub">{header.orgName}</p>
          <p className="text-[10px] uppercase tracking-wider text-faint">
            {header.seasonShort}
            {twists.length ? ` · ${twists[0]}` : ""}
            {twists.length > 1 ? ` +${twists.length - 1}` : ""}
          </p>
        </div>
        <span className="display text-sm font-bold text-ink">{bossOverall(ch.opponentLineupId)}</span>
      </div>

      {/* The three stars, what each one asks and what it pays — on the card. */}
      <ul className="mt-3 space-y-1 border-t border-line/60 pt-3">
        {starLabels.map((label, i) => {
          const earned = Boolean(starMask & (1 << i));
          return (
            <li key={i} className={cx("flex items-start gap-1.5 text-[11px] leading-snug", earned ? "text-ink" : "text-sub")}>
              <span className={cx("mt-px text-sm leading-none", earned ? "text-amber-300" : "text-faint/60")} aria-hidden>
                ★
              </span>
              <span className={cx("min-w-0 flex-1", earned && "font-semibold")}>{label}</span>
              <span className="display shrink-0 text-[10px] font-bold text-orange-bright">+{i === 0 ? ch.reward.xp : starXp}</span>
            </li>
          );
        })}
      </ul>
    </>
  );

  if (locked) {
    return (
      <div className="relative" aria-disabled="true">
        <Panel className="p-4">{inner}</Panel>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-bg/85 p-4 text-center backdrop-blur-[2px]">
          <RankBadge rank={rankInfo(ch.rankRequired)} variant="menu" size="md" />
          <p className="display text-sm font-bold uppercase tracking-wide text-ink">{CH.unlocksAt(rankLabel(ch.rankRequired))}</p>
          {ch.prereq ? <p className="text-xs text-sub">{CH.clearPrereq(challengeById.get(ch.prereq)?.title ?? ch.prereq)}</p> : null}
        </div>
      </div>
    );
  }
  // Cleared challenges stay playable for the missing stars (v2.0).
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "panel p-4 text-left transition-all hover:!border-line-strong",
        cleared ? "!border-amber-300/40" : style.glow,
        cleared && style.legend && "ach-legend",
      )}
    >
      {inner}
    </button>
  );
}

function BriefingModal({
  challenge,
  onClose,
  CH,
}: {
  challenge: Challenge | null;
  onClose: () => void;
  CH: ReturnType<typeof useCopy>["CHALLENGES_UI"];
}) {
  const router = useRouter();
  const startChallenge = useRunStore((s) => s.startChallenge);
  const starMask = useProfileStore((s) => (challenge ? s.challengeStars[challenge.id] ?? 0 : 0));
  if (!challenge) return null;

  const header = lineupHeader(challenge.opponentLineupId);
  const twists = twistLabels(challenge, CH);
  const stageIds = challenge.gauntlet?.lineupIds ?? [];
  const starXp = CHALLENGE.starXp[challenge.tier] ?? 0;
  const start = () => {
    sfx.start();
    startChallenge(challenge.id);
    router.push("/play");
  };

  return (
    <Modal
      open={!!challenge}
      title={challenge.title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {CH.backToChallenges}
          </Button>
          <Button variant="primary" onClick={start}>
            {starMask & 1 ? CH.replay : CH.start}
          </Button>
        </>
      }
    >
      <p className="leading-relaxed text-sub">{challenge.brief}</p>

      {/* Stars (v2.0) */}
      <p className="kicker mt-5">{CH.starsKicker}</p>
      <ul className="mt-2 space-y-1.5">
        {[CH.star1, ...(challenge.stars ?? []).map((st) => starLabel(st, CH))].map((label, i) => {
          const earned = Boolean(starMask & (1 << i));
          return (
            <li key={i} className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", earned ? "border-amber-300/40 bg-amber-300/5 text-ink" : "border-line/60 text-sub")}>
              <span className={cx("text-base leading-none", earned ? "text-amber-300" : "text-faint/60")} aria-hidden>
                ★
              </span>
              <span className="flex-1">{label}</span>
              <span className="display shrink-0 text-[10px] font-bold text-orange-bright">
                {i === 0 ? CH.rewardXp(challenge.reward.xp) : `+${starXp} XP`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[11px] text-faint">{CH.starsHint}</p>

      {stageIds.length ? (
        <>
          <p className="kicker mt-5">{CH.gauntletKicker}</p>
          <p className="mt-1 text-[11px] text-faint">{CH.gauntletHint(stageIds.length)}</p>
          <ol className="mt-2 space-y-1.5">
            {stageIds.map((id, i) => {
              const h = lineupHeader(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-line/60 px-3 py-2 text-xs">
                  <Badge tone="neutral">{CH.stage(i + 1)}</Badge>
                  <TeamLogo orgId={lineupById.get(id)!.orgId} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{h.orgName}</span>
                  <span className="text-[10px] uppercase tracking-wider text-faint">{h.seasonShort}</span>
                  <span className="display text-sm font-bold text-ink">{bossOverall(id)}</span>
                  <span className="text-[10px] text-faint">{CH.bestOf(challenge.gauntlet!.bestOf)}</span>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}

      <p className="kicker mt-5">{CH.briefTargetKicker}</p>
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-line/70 bg-white/[0.02] p-3">
        <TeamLogo orgId={lineupById.get(challenge.opponentLineupId)!.orgId} size="md" />
        <div className="min-w-0 flex-1">
          <p className="display truncate text-sm font-bold uppercase tracking-wide text-ink">{header.orgName}</p>
          <p className="text-[11px] uppercase tracking-wider text-faint">
            {header.seasonLabel} · {header.region}
          </p>
        </div>
        <div className="text-right">
          <p className="display text-2xl font-bold leading-none text-ink">{bossOverall(challenge.opponentLineupId)}</p>
          <p className="text-[10px] uppercase tracking-wider text-faint">{CH.bestOf(challenge.sim.bestOf)}</p>
        </div>
      </div>

      {/* The opponent on the pitch — scout the line you'll prepare to face (v1.4). */}
      <FieldView
        roster={rosterFromLineup(challenge.opponentLineupId)}
        showOverall
        showBench
        className="mt-3"
      />

      <p className="kicker mt-5">{CH.briefTwistKicker}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {twists.length === 0 ? (
          <span className="text-xs text-sub">{CH.noTwist}</span>
        ) : (
          twists.map((t) => (
            <Badge key={t} tone="orange">
              {t}
            </Badge>
          ))
        )}
        <Badge tone="blue">{CH.rewardXp(challenge.reward.xp)}</Badge>
      </div>
    </Modal>
  );
}
