"use client";

/**
 * Road to Worlds v0.3 — the org sheet (Modal, portal-on-body).
 *
 * Any AI org's card: roster (spoiler-safe player views — name, age, OVR,
 * archetype), coach quality, stars, prestige and current Season Points.
 * Opened from standings rows, event lobbies, the market and the transfer
 * wire. Read-only by design — the world stays the world.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { Modal } from "@/components/ui/Modal";
import { CountryChip } from "@/components/ui/Badge";
import { playerViewById } from "@/engine/career/development";
import type { CareerSave } from "@/engine/career/types";
import { OrgMark } from "./OrgMark";
import { TeamStars } from "./TeamStars";
import { viewCtxOf } from "./careerUi";

export function OrgSheet({
  save,
  orgRef,
  onClose,
}: {
  save: CareerSave;
  /** World org ref; null closes the sheet. */
  orgRef: string | null;
  onClose: () => void;
}) {
  const C = useCareerCopy();
  const org = orgRef ? save.world.orgs[orgRef] : null;
  if (!org) return null;

  const ctx = viewCtxOf(save);
  const players = org.playerIds
    .map((id) => playerViewById(id, ctx))
    .filter((v): v is NonNullable<typeof v> => v !== null);
  const points = save.competition.seasonPoints[org.region]?.[org.ref] ?? 0;

  return (
    <Modal open onClose={onClose} title={org.name}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <OrgMark save={save} orgRef={org.ref} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <TeamStars stars={org.stars} size="sm" />
              <span className="text-xs font-semibold text-sub">{org.region}</span>
            </div>
            <p className="mt-1 text-xs text-faint">
              {C.orgSheet.points}: <span className="font-semibold text-sub">{points}</span>
              {" · "}
              {C.orgSheet.prestige(org.prestige)}
            </p>
          </div>
        </div>

        <div>
          <p className="kicker mb-2 text-[10px]">{C.orgSheet.roster}</p>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                {p.country ? <CountryChip code={p.country} /> : null}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-faint">{C.player.age(p.age)}</span>
                <span className="text-xs text-faint">{C.player.archetype[p.archetype]}</span>
                <span className="w-12 text-right text-sm font-bold text-orange">
                  {Math.round(p.overall)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-faint">
          {C.orgSheet.coach}:{" "}
          <span className="font-semibold text-sub">
            {org.coachOverall !== undefined ? org.coachOverall : C.orgSheet.noCoach}
          </span>
        </p>
      </div>
    </Modal>
  );
}
