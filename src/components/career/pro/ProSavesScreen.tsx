"use client";

/**
 * v2.2 Pro (PRO-SPEC §11, R150): the Pro careers picker, three slots beside
 * the manager's. An occupied slot shows the player and resumes; an empty one
 * creates a player in it.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { proAgeOf, proOverall } from "@/engine/career/pro/growth";
import type { ProSave } from "@/engine/career/pro/types";
import { REGION_BADGE } from "@/components/regionStyle";
import { AppLink } from "@/components/ui/AppLink";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { useProStore } from "@/store/proStore";
import { useMounted } from "@/store/useMounted";

export function ProSavesScreen() {
  const C = useCareerCopy();
  const router = useRouter();
  const mounted = useMounted();
  const slots = useProStore((s) => s.slots);
  const selectSlot = useProStore((s) => s.selectSlot);
  const deleteSlot = useProStore((s) => s.deleteSlot);
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);

  if (!mounted) return <div className="min-h-[60vh]" aria-busy />;

  const confirmSave = confirmSlot === null ? null : slots[confirmSlot];

  return (
    <div className="rise-in mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <SectionTitle
        title={C.pro.saves.title}
        kicker={C.pro.saves.kicker}
        className="mb-6"
        right={
          <AppLink href="/career/saves" className="text-sm font-semibold text-blue-bright hover:underline">
            {C.pro.door.managerCareers}
          </AppLink>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {slots.map((save, slot) =>
          save ? (
            <ProSlotCard
              key={slot}
              save={save}
              onResume={() => {
                selectSlot(slot);
                router.push("/career/pro/career");
              }}
              onDelete={() => setConfirmSlot(slot)}
            />
          ) : (
            <button
              key={slot}
              type="button"
              onClick={() => router.push(`/career/pro/new?slot=${slot}`)}
              className="panel flex min-h-48 items-center justify-center p-5 text-center transition-colors hover:!border-line-strong"
            >
              <span className="display text-lg font-bold uppercase leading-none text-sub">{C.pro.saves.empty}</span>
            </button>
          ),
        )}
      </div>

      <Modal
        open={confirmSlot !== null}
        title={C.pro.saves.delete}
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
              {C.pro.saves.delete}
            </Button>
          </>
        }
      >
        {confirmSave ? <p>{C.pro.saves.deleteConfirm(confirmSave.player.name)}</p> : null}
      </Modal>
    </div>
  );
}

function ProSlotCard({ save, onResume, onDelete }: { save: ProSave; onResume: () => void; onDelete: () => void }) {
  const C = useCareerCopy();
  const p = save.player;
  return (
    <Panel className="flex min-h-48 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="display truncate text-2xl font-bold uppercase leading-none text-ink">{p.name}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-sub">
            <CountryChip code={p.country} />
            <Badge className={REGION_BADGE[p.region]}>{p.region}</Badge>
            <span>{C.pro.player.age(proAgeOf(p, save.clock.seasonIndex))}</span>
          </p>
        </div>
        <span className="text-right">
          <span className="display block text-3xl font-bold leading-none text-ink">{Math.floor(proOverall(p.attrs))}</span>
          <span className="mt-1 block text-xs text-sub">{C.pro.player.overall}</span>
        </span>
      </div>
      <p className="mt-3 text-sm text-sub">
        {C.player.archetype[p.archetype]} · {C.pro.player.stage[save.stage]} · {C.pro.saves.season(save.clock.seasonIndex + 1)}
      </p>
      <div className="mt-auto flex gap-2 pt-5">
        <Button variant="secondary" onClick={onResume}>
          {C.pro.saves.resume}
        </Button>
        <Button variant="ghost" onClick={onDelete}>
          {C.pro.saves.delete}
        </Button>
      </div>
    </Panel>
  );
}
