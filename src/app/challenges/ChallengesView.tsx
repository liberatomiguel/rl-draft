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
import { challengeStatus, rosterFromLineup, type ChallengeStatus } from "@/engine/challenges";
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
      <SectionTitle kicker={CH.progress(clearedCount, ordered.length)} title={CH.title} className="mb-2" />
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
  onOpen,
  CH,
}: {
  ch: Challenge;
  status: ChallengeStatus;
  onOpen: () => void;
  CH: ReturnType<typeof useCopy>["CHALLENGES_UI"];
}) {
  const style = achievementStyle({ id: ch.id, category: ch.tier });
  const cleared = status === "cleared";
  const locked = status === "locked";
  const header = lineupHeader(ch.opponentLineupId);
  const twists = twistLabels(ch, CH);

  const inner = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cx("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", style.chip)}>
          {style.label}
        </span>
        {cleared ? (
          <Badge tone="gold">✓ {CH.status.cleared}</Badge>
        ) : locked ? (
          <Badge tone="neutral">{CH.status.locked}</Badge>
        ) : (
          <Badge tone="orange">{CH.status.available}</Badge>
        )}
      </div>

      <h3 className="display text-base font-bold uppercase tracking-wide text-ink">{ch.title}</h3>

      {locked ? (
        <div className="mt-2 flex items-center gap-2">
          {/* The rank you need — shown as its badge so the gate is unmistakable (v1.4). */}
          <RankBadge rank={rankInfo(ch.rankRequired)} variant="menu" size="sm" className="shrink-0" />
          <p className="text-xs font-semibold text-faint">
            {CH.unlocksAt(rankLabel(ch.rankRequired))}
            {ch.prereq ? ` · ${CH.clearPrereq(challengeById.get(ch.prereq)?.title ?? ch.prereq)}` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-sub">{ch.brief}</p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-3">
        <TeamLogo orgId={lineupById.get(ch.opponentLineupId)!.orgId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-sub">{header.orgName}</p>
          <p className="text-[10px] uppercase tracking-wider text-faint">{header.seasonShort}</p>
        </div>
        <span className="display text-sm font-bold text-ink">{bossOverall(ch.opponentLineupId)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={cleared ? "good" : "blue"}>{CH.rewardXp(ch.reward.xp)}</Badge>
        {twists.slice(0, 1).map((t) => (
          <Badge key={t} tone="neutral">
            {t}
          </Badge>
        ))}
        {twists.length > 1 ? <span className="text-[10px] text-faint">+{twists.length - 1}</span> : null}
      </div>
    </>
  );

  if (status === "available") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cx("panel p-4 text-left transition-all hover:!border-line-strong", style.glow)}
      >
        {inner}
      </button>
    );
  }
  return (
    <Panel
      className={cx(
        "p-4",
        cleared && cx("!border-gold/40", style.legend && "ach-legend"),
        locked && "opacity-55",
      )}
    >
      {inner}
    </Panel>
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
  if (!challenge) return null;

  const header = lineupHeader(challenge.opponentLineupId);
  const twists = twistLabels(challenge, CH);
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
          <Button variant="secondary" onClick={onClose}>
            {CH.status.available}
          </Button>
          <Button variant="primary" onClick={start}>
            {CH.start}
          </Button>
        </>
      }
    >
      <p className="leading-relaxed text-sub">{challenge.brief}</p>

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
