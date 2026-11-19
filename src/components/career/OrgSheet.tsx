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
import { ageOf, playerViewById } from "@/engine/career/development";
import { isLocalRef, localRegionOf } from "@/engine/career/localScene";
import type { CareerSave } from "@/engine/career/types";
import { Badge } from "@/components/ui/Badge";
import { OrgMark } from "./OrgMark";
import { TeamStars } from "./TeamStars";
import { localSideRatingOf, localSideTeamOf, viewCtxOf } from "./careerUi";

// The roster is a list with hairline rows (no box inside the sheet); the
// overall leads each row, set in the display face.
const ROSTER = "border-t border-line";
const ROSTER_ROW = "flex min-h-11 items-center gap-2.5 border-b border-line py-2";
const ROSTER_OVR = "display w-8 shrink-0 text-lg font-bold leading-none text-ink";

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
  if (orgRef === "user") return <UserSheet save={save} onClose={onClose} />;
  if (orgRef && isLocalRef(orgRef)) return <LocalSheet save={save} orgRef={orgRef} onClose={onClose} />;
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
              <span className="text-sm text-sub">{org.region}</span>
            </div>
            <p className="mt-1 text-xs text-sub">
              {C.orgSheet.points}: <span className="font-semibold text-ink">{points}</span>
              {" · "}
              {C.orgSheet.prestige(org.prestige)}
            </p>
          </div>
        </div>

        <div>
          <p className="kicker mb-1">{C.orgSheet.roster}</p>
          <ul className={ROSTER}>
            {players.map((p) => (
              <li key={p.id} className={ROSTER_ROW}>
                <span className={ROSTER_OVR}>{Math.round(p.overall)}</span>
                {p.country ? <CountryChip code={p.country} /> : null}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.name}</span>
                <span className="shrink-0 text-xs text-sub">
                  {C.player.age(p.age)} · {C.player.archetype[p.archetype]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sub">
          {C.orgSheet.coach}:{" "}
          <span className="font-semibold text-ink">
            {org.coachOverall !== undefined ? org.coachOverall : C.orgSheet.noCoach}
          </span>
        </p>
      </div>
    </Modal>
  );
}

function UserSheet({ save, onClose }: { save: CareerSave; onClose: () => void }) {
  const C = useCareerCopy();
  const players = [...save.squad].sort((a, b) => Number(save.starterIds.includes(b.id)) - Number(save.starterIds.includes(a.id)));
  return (
    <Modal open onClose={onClose} title={save.identity.orgName}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <OrgMark save={save} orgRef="user" size="lg" />
          <p className="text-sm text-sub">{save.identity.region}</p>
        </div>
        <div>
          <p className="kicker mb-1">{C.orgSheet.roster}</p>
          <ul className={ROSTER}>
            {players.map((p) => (
              <li key={p.id} className={ROSTER_ROW}>
                <span className={ROSTER_OVR}>{Math.round(p.overall)}</span>
                {p.country ? <CountryChip code={p.country} /> : null}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.name}</span>
                {!save.starterIds.includes(p.id) ? <Badge tone="neutral">{C.hub.squadSub}</Badge> : null}
                <span className="shrink-0 text-xs text-sub">{C.player.age(ageOf(p.birthYear, save.clock.seasonIndex))}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sub">
          {C.orgSheet.coach}:{" "}
          <span className="font-semibold text-ink">
            {save.coach ? `${save.coach.name} · ${Math.round(save.coach.overall)}` : C.orgSheet.noCoach}
          </span>
        </p>
      </div>
    </Modal>
  );
}

/** rc.2: a local amateur side — the same sheet, built from the procedural
 *  team instead of a world org. R49: its own region (from the ref), its
 *  season rating (the one every event fields it at) and its Season Points. */
function LocalSheet({ save, orgRef, onClose }: { save: CareerSave; orgRef: string; onClose: () => void }) {
  const C = useCareerCopy();
  const team = localSideTeamOf(save, orgRef);
  const region = localRegionOf(orgRef) ?? save.identity.region;
  const points = save.competition.seasonPoints[region]?.[orgRef] ?? 0;
  return (
    <Modal open onClose={onClose} title={team.name}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <OrgMark save={save} orgRef={orgRef} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{C.orgSheet.localSide}</Badge>
              <span className="text-sm text-sub">{region}</span>
            </div>
            <p className="mt-1 text-xs text-sub">
              {C.common.ovrShort(Math.round(localSideRatingOf(save, orgRef)))} · {C.orgSheet.points}:{" "}
              <span className="font-semibold text-ink">{points}</span>
            </p>
            <p className="mt-1 text-xs text-faint">{C.orgSheet.localHint}</p>
          </div>
        </div>
        <div>
          <p className="kicker mb-1">{C.orgSheet.roster}</p>
          <ul className={ROSTER}>
            {team.playerNames.map((name) => (
              <li key={name} className={ROSTER_ROW}>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
