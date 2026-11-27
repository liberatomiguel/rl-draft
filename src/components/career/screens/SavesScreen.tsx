"use client";

/**
 * Road to Worlds — the saves picker (design §11: 3 slots, slot meta rendered
 * from slotMetaFor without hydrating full saves into the UI tree).
 *
 * rc9 CLUB-NEWS: the player picks a career or starts one, so the three slots
 * are rows of one board: org, where it stands (season, week), its two
 * figures, then Resume (filled only on the career played last), Export and
 * Delete. An empty slot is a row with its own way in. Cloud state is one
 * quiet line under the row it belongs to.
 */

import { establishedOf } from "@/engine/career/established";
import type { CareerSave } from "@/engine/career/types";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { FEATURES } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { TeamStars } from "@/components/career/TeamStars";
import { UserOrgMark } from "@/components/career/OrgMark";
import { REGION_BADGE } from "@/components/regionStyle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { CAREER_CLOUD_AUDIENCE } from "@/lib/careerCloudGate";
import { useAccountStore } from "@/store/accountStore";
import { useCareerCloudStore, type SlotCloud } from "@/store/careerCloudStore";
import { importSaveFile, type SaveFileImportError } from "@/store/careerSaveTransfer";
import { CloudStatusLine } from "@/components/career/cloud/CloudStatusLine";
import { downloadSlotFile } from "@/components/career/cloud/downloadSave";
import { ProDoor } from "@/components/career/pro/ProDoor";
import { slotMetaFor, useCareerStore, type CareerSlotView } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";

export function SavesScreen() {
  const C = useCareerCopy();
  const router = useRouter();
  const mounted = useMounted();
  const slots = useCareerStore((s) => s.slots);
  const selectSlot = useCareerStore((s) => s.selectSlot);
  const deleteSlot = useCareerStore((s) => s.deleteSlot);

  const metas = useMemo(() => slotMetaFor(slots), [slots]);
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);
  const cloudActive = useCareerCloudStore((s) => s.active);
  const cloudSlots = useCareerCloudStore((s) => s.slots);
  const signedIn = useAccountStore((s) => s.status === "signedIn");

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="space-y-6" aria-busy>
          <div className="h-10 w-44 animate-pulse rounded-lg bg-white/5" />
          <div className="h-80 animate-pulse rounded-xl bg-white/5" />
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

  // The career played last carries the screen's one filled button.
  let lastSlot = -1;
  metas.forEach((m, i) => {
    if (m && (lastSlot < 0 || m.lastPlayedAt > (metas[lastSlot]?.lastPlayedAt ?? 0))) lastSlot = i;
  });

  return (
    <div className="rise-in mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <SectionTitle title={C.saves.title} className="mb-6" />

      <Panel className="overflow-hidden">
        <ul className="divide-y divide-line">
          {metas.map((meta, slot) =>
            meta ? (
              <SlotRow
                key={slot}
                meta={meta}
                latest={slot === lastSlot}
                onResume={() => resume(slot)}
                onDelete={() => setConfirmSlot(slot)}
                onExport={() => downloadSlotFile(slot)}
                cloud={cloudActive ? cloudSlots[slot] : undefined}
              />
            ) : (
              <EmptyRow
                key={slot}
                slot={slot}
                onFound={() => router.push("/career/new")}
                cloud={cloudActive ? cloudSlots[slot] : undefined}
              />
            ),
          )}
        </ul>
      </Panel>

      <p className="mt-4 text-xs leading-relaxed text-faint">
        {cloudActive
          ? C.cloud.helpActive
          : CAREER_CLOUD_AUDIENCE === "all" && !signedIn
            ? `${C.cloud.helpLocal}. ${C.cloud.helpSignIn}`
            : C.cloud.helpLocal}
      </p>

      {/* v2.2 Pro (R150): the door into the player career (staging only). */}
      <ProDoor />

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
        {confirmMeta ? (
          <p>
            {C.saves.deleteConfirm(confirmMeta.orgName, confirmSeasons)}
            {cloudActive ? ` ${C.cloud.deleteAlso}` : ""}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot rows
// ---------------------------------------------------------------------------

const quietAction =
  "inline-flex min-h-11 items-center rounded px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue sm:min-h-8";

function SlotRow({
  meta,
  latest,
  onResume,
  onDelete,
  onExport,
  cloud,
}: {
  meta: CareerSlotView;
  latest: boolean;
  onResume: () => void;
  onDelete: () => void;
  onExport: () => void;
  cloud?: SlotCloud;
}) {
  const copy = useCopy();
  const C = useCareerCopy();
  const established = establishedOf({ identity: { realOrgRef: meta.realOrgRef } as CareerSave["identity"] });
  return (
    <li className="px-4 py-5 sm:px-6">
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        {/* Who and where: the org, then the season and week it is at, then who runs it. */}
        <div className="flex min-w-0 items-center gap-4">
          <UserOrgMark identity={meta} seasonIndex={meta.seasonIndex} size="lg" className="shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="display truncate text-lg font-bold leading-tight text-ink">{meta.orgName}</p>
              {meta.champion ? <Badge tone="gold">{C.saves.champion}</Badge> : null}
              {meta.ended ? <Badge tone="neutral">{C.saves.archived}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-sub">
              {meta.seasonLabel} · {C.hub.week(meta.week)}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
              <span className="truncate">{meta.managerName}</span>
              <Badge className={REGION_BADGE[meta.region]}>{meta.region}</Badge>
              <span>{copy.DIFFICULTY_LABELS[meta.difficulty].label}</span>
              <TeamStars stars={meta.stars} />
            </p>
          </div>
        </div>

        {/* Where it stands: the two figures, the label under each. */}
        <dl className="grid grid-cols-2 gap-x-8 lg:text-right">
          <div className="flex flex-col-reverse">
            <dt className="kicker mt-1.5">{C.finances.balance}</dt>
            <dd className={cx("display text-xl font-bold leading-none tabular-nums", meta.balance < 0 ? "text-bad" : "text-ink")}>
              {formatMoney(meta.balance, { compact: true })}
            </dd>
          </div>
          <div className="flex flex-col-reverse">
            {/* rc.6 (ORGMODE UI-C): an established org's number is its Standing. */}
            <dt className="kicker mt-1.5">{established ? C.orgmode.standing : C.common.rep}</dt>
            <dd className="display text-xl font-bold leading-none tabular-nums text-ink">{String(Math.round(meta.reputation))}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 lg:justify-end">
          <Button variant={latest ? "primary" : "secondary"} size="md" className="max-lg:w-full lg:min-w-28" onClick={onResume}>
            {C.saves.resume}
          </Button>
          <button type="button" onClick={onExport} className={cx(quietAction, "text-sub hover:text-ink")}>
            {C.cloud.exportSave}
          </button>
          <button type="button" onClick={onDelete} aria-label={`${C.saves.delete}: ${meta.orgName}`} className={cx(quietAction, "text-bad/90 hover:text-bad")}>
            {C.saves.delete}
          </button>
        </div>
      </div>
      {cloud ? <CloudStatusLine cloud={cloud} occupied className="mt-3" /> : null}
    </li>
  );
}

function EmptyRow({
  slot,
  onFound,
  cloud,
}: {
  slot: number;
  onFound: () => void;
  cloud?: SlotCloud;
}) {
  const C = useCareerCopy();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<SaveFileImportError | null>(null);

  const onFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("unreadable");
      input.value = "";
      return;
    }
    setError(importSaveFile(slot, text));
    input.value = "";
  };

  return (
    <li className="px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="display text-lg font-bold leading-tight text-sub">{C.saves.emptySlot}</p>
          {/* rc.6 (UI-A): with the takeover on, the slot opens the door (two ways in). */}
          {FEATURES.realOrgStart ? <p className="mt-1 text-sm text-faint">{C.takeover.door.savesHint}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 max-lg:w-full">
          <Button variant="secondary" size="md" className="max-lg:w-full lg:min-w-28" onClick={onFound}>
            {FEATURES.realOrgStart ? C.saves.newCareer : C.saves.empty}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            tabIndex={-1}
            onChange={(e) => void onFile(e.currentTarget)}
          />
          <button
            type="button"
            onClick={() => {
              setError(null);
              fileRef.current?.click();
            }}
            className={cx(quietAction, "text-sub hover:text-ink")}
          >
            {C.cloud.importSave}
          </button>
        </div>
      </div>
      {cloud ? <CloudStatusLine cloud={cloud} occupied={false} className="mt-3" /> : null}
      {error ? (
        <p role="alert" className="mt-3 text-xs text-bad">
          {C.cloud.importErrors[error]}
        </p>
      ) : null}
    </li>
  );
}
