"use client";

/**
 * National-team album (v2.0) — the FIFAe national rosters, one crest per team,
 * grouped by edition (newest first). Drawing a national team in a Classic or
 * Quick draft collects ALL of its cards at once (runStore), so a team reads as
 * found / not found: a found team opens its cards, an unfound one shows the
 * silhouettes still to chase. 32 light tiles instead of 133 cards in the grid.
 */

import { useMemo, useState } from "react";
import { lineups, nationalSpecialIdsByLineupId, seasonById, specialCardById, subById } from "@/data";
import { useCopy } from "@/content/copy";
import { resolveSpecial } from "@/engine/cards";
import type { Lineup, SpecialCard } from "@/engine/types";
import { cx } from "@/lib/util";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { GameCard } from "@/components/cards/GameCard";

/** National lineups per edition (season), newest edition first. */
const EDITIONS: { seasonId: string; teams: Lineup[] }[] = (() => {
  const bySeason = new Map<string, Lineup[]>();
  for (const l of lineups) {
    if (!l.national) continue;
    bySeason.set(l.seasonId, [...(bySeason.get(l.seasonId) ?? []), l]);
  }
  return [...bySeason.entries()]
    .map(([seasonId, teams]) => ({ seasonId, teams }))
    .sort((a, b) => (seasonById.get(b.seasonId)?.order ?? 0) - (seasonById.get(a.seasonId)?.order ?? 0));
})();

const cardsOf = (l: Lineup): SpecialCard[] =>
  (nationalSpecialIdsByLineupId.get(l.id) ?? []).map((id) => specialCardById.get(id)!);

/** Every national card, for the album's header progress. */
export const NATIONAL_CARD_IDS: string[] = EDITIONS.flatMap((e) =>
  e.teams.flatMap((t) => nationalSpecialIdsByLineupId.get(t.id) ?? []),
);

export function NationalAlbum({
  isUnlocked,
  onOpenCard,
}: {
  isUnlocked: (id: string) => boolean;
  onOpenCard: (sp: SpecialCard) => void;
}) {
  const { NATIONAL_UI: N } = useCopy();
  const [open, setOpen] = useState<Lineup | null>(null);
  const editions = useMemo(
    () =>
      EDITIONS.map((e) => ({
        ...e,
        teams: [...e.teams].sort((a, b) =>
          N.teamName(a.orgId, a.name).localeCompare(N.teamName(b.orgId, b.name)),
        ),
      })),
    [N],
  );

  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-sub">{N.albumIntro}</p>

      {editions.map(({ seasonId, teams }) => {
        const ids = teams.flatMap((t) => nationalSpecialIdsByLineupId.get(t.id) ?? []);
        const got = ids.filter(isUnlocked).length;
        const found = teams.filter((t) => cardsOf(t).some((sp) => isUnlocked(sp.id))).length;
        return (
          <section key={seasonId} className="mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {seasonById.get(seasonId)?.label ?? seasonId}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="gold">{N.teamsFound(found, teams.length)}</Badge>
                <Badge tone="neutral">{N.cardsProgress(got, ids.length)}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {teams.map((team) => {
                const cards = cardsOf(team);
                const have = cards.filter((sp) => isUnlocked(sp.id)).length;
                const complete = have === cards.length;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setOpen(team)}
                    className={cx(
                      "panel flex flex-col items-center gap-2 px-3 py-4 text-center transition-all",
                      complete
                        ? "!border-yellow-300/50 shadow-[0_0_22px_rgba(234,179,8,0.14)] hover:!border-yellow-200/70"
                        : "hover:!border-line-strong",
                    )}
                  >
                    <TeamLogo
                      orgId={team.orgId}
                      seasonId={team.seasonId}
                      size="lg"
                      className={cx(have === 0 && "opacity-35 grayscale")}
                    />
                    <span
                      className={cx(
                        "display block w-full truncate text-sm font-bold uppercase tracking-wide",
                        have > 0 ? "text-ink" : "text-faint",
                      )}
                    >
                      {N.teamName(team.orgId, team.name)}
                    </span>
                    <span
                      className={cx(
                        "text-[11px] font-semibold",
                        complete ? "text-yellow-200" : have > 0 ? "text-sub" : "text-faint",
                      )}
                    >
                      {have > 0 ? N.cardsProgress(have, cards.length) : N.notFound}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <Modal
        open={Boolean(open)}
        title={
          open
            ? `${N.teamName(open.orgId, open.name)} · ${seasonById.get(open.seasonId)?.label ?? ""}`
            : ""
        }
        onClose={() => setOpen(null)}
        wide
      >
        {open ? (
          <TeamCards
            team={open}
            isUnlocked={isUnlocked}
            onOpenCard={(sp) => {
              setOpen(null);
              onOpenCard(sp);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function TeamCards({
  team,
  isUnlocked,
  onOpenCard,
}: {
  team: Lineup;
  isUnlocked: (id: string) => boolean;
  onOpenCard: (sp: SpecialCard) => void;
}) {
  const { NATIONAL_UI: N, DRAFT_UI } = useCopy();
  const cards = cardsOf(team);
  const found = cards.some((sp) => isUnlocked(sp.id));
  return (
    <div>
      {!found ? <p className="mb-4 text-sm leading-relaxed text-sub">{N.notFoundHint}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((sp) =>
          isUnlocked(sp.id) ? (
            <div key={sp.id} className="mx-auto w-full max-w-44">
              <GameCard
                card={resolveSpecial(sp)}
                showOverall
                specialCollected
                size="md"
                fluid
                lite
                onClick={() => onOpenCard(sp)}
              />
            </div>
          ) : (
            <div key={sp.id} className="mx-auto w-full max-w-44">
              <div className="card-frame card-hidden flex aspect-[3/4.3] w-full flex-col items-center justify-center gap-2 p-3 opacity-80">
                <span className="display text-3xl font-bold leading-none text-faint">??</span>
                <span className="display text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                  {sp.kind === "coach"
                    ? DRAFT_UI.slotCoach
                    : subById.has(sp.baseCardId)
                      ? DRAFT_UI.slotSub
                      : DRAFT_UI.player}
                </span>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
