"use client";

/**
 * /challenges (v1.4) — the rank-unlocked puzzle grid. Each card is a fixed
 * historical line you must out-draft under a twist. Locked cards show their
 * unlock; available cards open a briefing (the line + the twist) and start the
 * run; cleared cards wear a gold ring. Re-skins existing primitives (Panel,
 * Badge, Button, Modal, TeamLogo) so it's consistent by construction.
 */

import { challengeStarLabels } from "@/components/challenges/challengeLabels";
export { starLabel, challengeStarLabels } from "@/components/challenges/challengeLabels";

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
import { rankForXp } from "@/engine/progression";
import { challengeUnlockProgress } from "@/engine/challengeStars";
import { FieldView } from "@/components/cards/FieldView";
import type { Challenge } from "@/engine/types";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { useOpenContent, useProfileNew } from "@/store/useNewItems";
import { challengeKey } from "@/engine/profileNew";
import { achievementStyle } from "@/components/achievementStyle";
import { Badge } from "@/components/ui/Badge";
import { NewTag } from "@/components/ui/NewDot";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { COSMETICS, type CosmeticDef } from "@/data/cosmetics";
import { CosmeticIcon, TIER_ACCENT, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";

/** rc.20: the exclusive cosmetics a challenge pays for all three stars. */
function cosmeticRewards(challengeId: string): CosmeticDef[] {
  return COSMETICS.filter((c) => c.source.type === "challenge-perfect" && c.source.challengeId === challengeId);
}

/** The three-star reward strip (card + briefing). */
function CosmeticRewardStrip({ challengeId, perfect, CH, compact }: { challengeId: string; perfect: boolean; CH: ReturnType<typeof useCopy>["CHALLENGES_UI"]; compact?: boolean }) {
  const copy = useCosmeticCopy();
  const rewards = cosmeticRewards(challengeId);
  if (rewards.length === 0) return null;
  return (
    <div className={cx("flex items-center gap-2 rounded-lg border px-2.5 py-2", perfect ? "border-amber-300/40 bg-amber-300/[0.05]" : "border-line/70 bg-white/[0.02]", compact ? "mt-3" : "mt-2")}>
      <span className="flex shrink-0 items-center gap-1.5">
        {rewards.map((r) => (
          <CosmeticIcon key={r.id} def={r} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/90">{CH.cosmeticReward}</span>
        <span className="block truncate text-[11px] text-sub">
          {rewards.map((r, i) => (
            <span key={r.id}>
              {i > 0 ? " · " : ""}
              <span className="font-semibold text-ink">{copy.name(r.id)}</span> <span style={{ color: TIER_ACCENT[r.tier] }}>{copy.tier(r.tier)}</span>
            </span>
          ))}
        </span>
      </span>
      {perfect ? <span className="text-amber-300" aria-hidden>★</span> : null}
    </div>
  );
}

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
  if (ch.draftScript) out.push(CH.scriptedHint);
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
  const careerMarks = useProfileStore((s) => s.careerMarks);
  const quizSolved = useProfileStore((s) => s.quiz.solved);

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
    mounted ? challengeStatus(ch, xp, completed, { challengeStars: starMasks, careerMarks, quizSolved }) : "locked";
  const clearedCount = mounted ? ordered.filter((c) => completed[c.id]).length : 0;
  const starsEarned = mounted ? totalStars(starMasks) : 0;
  const starsMax = ordered.reduce((n, c) => n + starsAvailable(c), 0);

  const [active, setActive] = useState<Challenge | null>(null);
  // rc.33 (COL-02c): NEW = opened to the player, briefing not read yet. Reading
  // the briefing is opening the content; visiting this page marks nothing.
  const fresh = useProfileNew();
  const openContent = useOpenContent();

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
      <p className="mb-5 max-w-2xl text-xs leading-relaxed text-sub">{CH.unlockHint}</p>

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
                    {CH.tier[tier]} <span className="font-normal text-sub">· {CH.difficultyByTier[tier]}</span>
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
                      isNew={fresh.keys.has(challengeKey(ch.id))}
                      onOpen={() => {
                        sfx.click();
                        openContent([challengeKey(ch.id)]);
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
  isNew,
  onOpen,
  CH,
}: {
  ch: Challenge;
  status: ChallengeStatus;
  starMask: number;
  isNew: boolean;
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
  const starLabels = challengeStarLabels(ch, CH);
  const starXp = CHALLENGE.starXp[ch.tier] ?? 0;

  // A locked card is a readable preview, including goals and unlock progress.
  const inner = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cx("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", style.chip)}>{CH.tier[ch.tier]}</span>
          <Badge tone="blue">{CH.formats[ch.kind ?? "boss"]}</Badge>
          {isNew && !locked ? <NewTag>{CH.newTag}</NewTag> : null}
        </span>
        {perfect ? (
          <Badge className="shrink-0 whitespace-nowrap" tone="gold">✓ {CH.status.cleared}</Badge>
        ) : cleared ? (
          <StarRow mask={starMask} total={total} />
        ) : (
          <Badge className="shrink-0 whitespace-nowrap" tone="blue">{CH.rewardXp(ch.reward.xp)}</Badge>
        )}
      </div>

      <h3 className="display text-base font-bold uppercase tracking-wide text-ink">{CH.catalog[ch.id]?.title ?? ch.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-sub">{CH.catalog[ch.id]?.brief ?? ch.brief}</p>

      {ch.kind === "draft" ? <p className="mt-3 border-t border-line/60 pt-3 text-xs text-sub">{CH.draftOnlyHint}</p> : <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-3">
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
      </div>}

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
      <CosmeticRewardStrip challengeId={ch.id} perfect={perfect} CH={CH} compact />
    </>
  );

  // Cleared challenges stay playable for the missing stars (v2.0).
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={locked ? `${CH.catalog[ch.id]?.title ?? ch.title} · ${CH.status.locked} · ${rankLabel(ch.rankRequired)}` : undefined}
      className={cx(
        "panel relative overflow-hidden p-4 text-left transition-colors hover:!border-line-strong",
        cleared ? "!border-amber-300/40" : locked ? "!bg-raised min-h-[23rem]" : style.glow,
        cleared && style.legend && "ach-legend",
      )}
    >
      <div aria-hidden={locked || undefined} className={locked ? "opacity-70" : undefined}>{inner}</div>
      {locked ? <div className="challenge-lock absolute inset-0 flex items-center justify-center p-4"><div className="w-full"><div className="mx-auto mb-2 flex w-fit items-center justify-center gap-3 rounded-xl px-3 py-2"><RankBadge rank={rankInfo(ch.rankRequired)} variant="menu" size="sm" className="!h-11 !w-11" /><div className="text-left"><p className="text-[10px] font-bold uppercase tracking-widest text-orange-bright">{CH.status.locked}</p><p className="display text-lg font-bold text-ink">{rankLabel(ch.rankRequired)}</p></div><svg className="h-5 w-5 text-sub" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg></div><UnlockPath challenge={ch} CH={CH} compact /></div></div> : null}
    </button>
  );
}

function UnlockPath({ challenge: ch, CH, compact }: { challenge: Challenge; CH: ReturnType<typeof useCopy>["CHALLENGES_UI"]; compact?: boolean }) {
  const completed = useProfileStore(s => s.challengesCompleted);
  const challengeStars = useProfileStore(s => s.challengeStars);
  const careerMarks = useProfileStore(s => s.careerMarks);
  const quizSolved = useProfileStore(s => s.quiz.solved);
  if (!ch.prereq && !ch.unlock) return null;
  const row = (text: string, met: boolean, progress?: string) => <span className={cx("flex items-start gap-1.5 text-xs leading-relaxed", met ? "text-good" : "text-sub")}><span aria-hidden>{met ? "✓" : "○"}</span><span className="min-w-0 flex-1">{text}</span>{progress ? <span className="shrink-0 font-mono text-[10px]">{progress}</span> : null}</span>;
  return <div className={cx("mt-3 rounded-lg border border-line-strong bg-bg/80 p-3", !compact && "mb-4")}>
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink">{CH.unlockTitle}</p>
    <div className="space-y-1.5">
      {ch.prereq ? row(CH.clearPrereq(CH.catalog[ch.prereq]?.title ?? challengeById.get(ch.prereq)?.title ?? ch.prereq), !!completed[ch.prereq]) : null}
      {ch.unlock ? <div className={ch.prereq ? "border-t border-line pt-2" : undefined}>
        {ch.unlock.anyOf.length > 1 ? <p className="mb-1.5 text-[11px] text-sub">{CH.unlockAny}</p> : null}
        {ch.unlock.anyOf.map((condition, i) => {
          const p = challengeUnlockProgress(condition, completed, { challengeStars, careerMarks, quizSolved });
          const label = condition.kind === "career" ? CH.unlockMilestone.career[condition.mark] : CH.unlockMilestone[condition.kind](condition.count);
          return <div key={i}>{i > 0 ? <p className="my-1 pl-4 text-[10px] font-semibold uppercase text-sub">{CH.unlockOr}</p> : null}{row(label, p.met, condition.kind === "career" ? undefined : CH.unlockProgress(p.current, p.target))}{condition.kind !== "career" ? <div className="ml-4 mt-1 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden><div className={cx("h-full rounded-full", p.met ? "bg-good" : "bg-orange/70")} style={{width:`${Math.min(100,p.current/p.target*100)}%`}} /></div> : null}</div>;
        })}
      </div> : null}
    </div>
  </div>;
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
  const profile = useProfileStore();
  if (!challenge) return null;
  const locked = challengeStatus(challenge, profile.xp, profile.challengesCompleted, { challengeStars: profile.challengeStars, careerMarks: profile.careerMarks, quizSolved: profile.quiz.solved }) === "locked";

  const header = lineupHeader(challenge.opponentLineupId);
  const twists = twistLabels(challenge, CH);
  const stageIds = challenge.gauntlet?.lineupIds ?? [];
  const starXp = CHALLENGE.starXp[challenge.tier] ?? 0;
  const start = () => {
    if (locked) return;
    sfx.start();
    startChallenge(challenge.id);
    router.push("/play");
  };

  return (
    <Modal
      open={!!challenge}
      title={CH.catalog[challenge.id]?.title ?? challenge.title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {CH.backToChallenges}
          </Button>
          <Button variant="primary" onClick={start} disabled={locked}>
            {locked ? CH.status.locked : starMask & 1 ? CH.replay : CH.start}
          </Button>
        </>
      }
    >
      <p className="leading-relaxed text-sub">{CH.catalog[challenge.id]?.brief ?? challenge.brief}</p>
      {locked ? <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink"><RankBadge rank={rankInfo(challenge.rankRequired)} variant="menu" size="sm" className="!h-7 !w-7" />{rankLabel(challenge.rankRequired)}</div> : null}
      {locked ? <UnlockPath challenge={challenge} CH={CH} /> : null}

      {/* Stars (v2.0) */}
      <p className="kicker mt-5">{CH.starsKicker}</p>
      <ul className="mt-2 space-y-1.5">
        {challengeStarLabels(challenge, CH).map((label, i) => {
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
      <CosmeticRewardStrip challengeId={challenge.id} perfect={(starMask & 7) === 7} CH={CH} />
      {cosmeticRewards(challenge.id).length ? <p className="mt-1.5 text-[11px] text-faint">{CH.cosmeticRewardHint}</p> : null}

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

      {challenge.kind === "draft" ? <p className="mt-5 text-sm text-sub">{CH.draftOnlyHint}</p> : <>
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
      </>}

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
