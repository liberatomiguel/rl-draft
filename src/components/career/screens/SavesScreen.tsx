"use client";

/**
 * Road to Worlds — the saves picker (design §11: 3 slots, slot meta rendered
 * from slotMetaFor without hydrating full saves into the UI tree).
 *
 * Occupied slot → crest + org identity + season/week clock + balance/rep +
 * stars (0-5, half steps), with Resume / Delete (confirmed via portal Modal).
 * Empty slot → "Found a new org" CTA into the wizard.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCopy } from "@/content/copy";
import type { CareerSlotMeta } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { TeamStars } from "@/components/career/TeamStars";
import { UserCrest } from "@/components/career/UserCrest";
import { REGION_BADGE } from "@/components/regionStyle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { slotMetaFor, useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";

export function SavesScreen() {
  const copy = useCopy();
  const C = copy.CAREER;
  const router = useRouter();
  const mounted = useMounted();
  const slots = useCareerStore((s) => s.slots);
  const selectSlot = useCareerStore((s) => s.selectSlot);
  const deleteSlot = useCareerStore((s) => s.deleteSlot);

  const metas = useMemo(() => slotMetaFor(slots), [slots]);
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="space-y-6" aria-busy>
          <div className="h-10 w-44 animate-pulse rounded-lg bg-white/5" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  const confirmMeta = confirmSlot !== null ? metas[confirmSlot] : null;
  // Seasons of history at stake: archived seasons + the one in progress.
  const confirmSeasons =
    confirmSlot !== null ? (slots[confirmSlot]?.history.length ?? 0) + 1 : 1;

  const resume = (slot: number) => {
    selectSlot(slot);
    router.push("/career");
  };

  return (
    <div className="rise-in mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <SectionTitle kicker={C.meta.title} title={C.saves.title} className="mb-6" />

      <div className="grid gap-4 md:grid-cols-3">
        {metas.map((meta, slot) =>
          meta ? (
            <SlotCard
              key={slot}
              meta={meta}
              delay={slot * 70}
              onResume={() => resume(slot)}
              onDelete={() => setConfirmSlot(slot)}
            />
          ) : (
            <EmptySlot key={slot} delay={slot * 70} onFound={() => router.push("/career/new")} />
          ),
        )}
      </div>

      <Modal
        open={confirmSlot !== null}
        title={C.saves.delete}
        onClose={() => setConfirmSlot(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmSlot(null)}>
              {C.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmSlot !== null) deleteSlot(confirmSlot);
                setConfirmSlot(null);
              }}
            >
              {C.saves.delete}
            </Button>
          </>
        }
      >
        {confirmMeta ? <p>{C.saves.deleteConfirm(confirmMeta.orgName, confirmSeasons)}</p> : null}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot cards
// ---------------------------------------------------------------------------

function SlotCard({
  meta,
  delay,
  onResume,
  onDelete,
}: {
  meta: CareerSlotMeta;
  delay: number;
  onResume: () => void;
  onDelete: () => void;
}) {
  const copy = useCopy();
  const C = copy.CAREER;
  const champion = meta.champion;
  return (
    <Panel
      className={cx(
        "rise-in relative flex flex-col overflow-hidden p-4 transition-shadow",
        champion && "border-amber-400/40 shadow-[0_0_28px_rgba(251,191,36,0.12)]",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Org-colored glow — each slot card wears its own identity */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-20 blur-2xl"
        style={{ background: `radial-gradient(circle, ${meta.colors.primary}, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full opacity-10 blur-2xl"
        style={{ background: `radial-gradient(circle, ${meta.colors.secondary}, transparent 70%)` }}
      />

      <div className="relative mb-3 flex items-start gap-3">
        <UserCrest crestId={meta.crestId} colors={meta.colors} abbrev={meta.abbrev} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="display truncate text-lg font-bold uppercase tracking-wide text-ink">
            {meta.orgName}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <TeamStars stars={meta.stars} />
            <Badge className={REGION_BADGE[meta.region]}>{meta.region}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-sub">{meta.managerName}</p>
        </div>
      </div>

      {(meta.champion || meta.ended) && (
        <div className="relative mb-3 flex flex-wrap gap-1.5">
          {meta.champion ? <Badge tone="gold">{C.saves.champion}</Badge> : null}
          {meta.ended ? <Badge tone="neutral">{C.saves.archived}</Badge> : null}
        </div>
      )}

      <div className="relative mb-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-line bg-black/20 p-3">
        <MetaRow label={meta.seasonLabel} value={C.hub.week(meta.week)} wide />
        <MetaRow
          label={C.finances.balance}
          value={formatMoney(meta.balance, { compact: true })}
          good={meta.balance >= 0}
          bad={meta.balance < 0}
        />
        <MetaRow label={C.common.rep} value={String(Math.round(meta.reputation))} />
        <MetaRow label={copy.SETUP.difficulty} value={copy.DIFFICULTY_LABELS[meta.difficulty].label} />
        <MetaRow
          label={C.saves.lastPlayed}
          value={meta.lastPlayedAt > 0 ? new Date(meta.lastPlayedAt).toLocaleDateString() : "—"}
        />
      </div>

      <div className="relative mt-auto flex items-center gap-2">
        <Button variant="primary" size="md" className="flex-1" onClick={onResume}>
          {C.saves.resume}
        </Button>
        <Button variant="danger" size="md" onClick={onDelete} aria-label={C.saves.delete}>
          {C.saves.delete}
        </Button>
      </div>
    </Panel>
  );
}

function MetaRow({
  label,
  value,
  wide,
  good,
  bad,
}: {
  label: string;
  value: string;
  wide?: boolean;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div className={cx("min-w-0", wide && "col-span-2")}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
      <p
        className={cx(
          "display truncate text-sm font-bold",
          bad ? "text-bad" : good ? "text-good" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptySlot({ delay, onFound }: { delay: number; onFound: () => void }) {
  const { CAREER: C } = useCopy();
  return (
    <button
      type="button"
      onClick={onFound}
      className={cx(
        "rise-in group flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed",
        "border-line-strong bg-white/[0.02] p-6 text-center transition-all",
        "hover:border-orange/50 hover:bg-orange/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        aria-hidden
        className={cx(
          "flex h-14 w-14 items-center justify-center rounded-full border border-line-strong bg-white/5 text-2xl text-sub",
          "transition-all group-hover:border-orange/50 group-hover:text-orange-bright",
        )}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </span>
      <span className="display text-base font-bold uppercase tracking-wide text-ink">
        {C.saves.empty}
      </span>
      <span className="text-xs text-sub">{C.wizard.title}</span>
    </button>
  );
}
