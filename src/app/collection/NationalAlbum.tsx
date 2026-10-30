"use client";

/**
 * National-team album (v2.0; rebuilt rc.33 — COL-01a/b, COL-02c).
 *
 * The FIFAe national rosters as an ALBUM: one page per edition (newest first),
 * one sticker slot per team, with a pip per card. Discovery is separate from
 * ownership: drawing a team in a Classic or Quick draft reveals its page, and
 * each card is collected by drafting it and finishing the run (runStore,
 * engine/collection). A team PAGE shows the roster in formation — the starting
 * three on a pitch, the bench (coach, and the sub for the teams that fielded
 * one) below — every slot either the collected card or a locked silhouette.
 * The org / country card is no slot: it is not a collectible, and the flag is
 * the page's crest.
 *
 * "New": a team found or a card collected and not opened yet carries a NEW
 * tag. Opening the team page is opening that content — it marks them seen (the
 * tab and nav dots clear), and the tags stay readable while the page is open.
 */

import { useMemo, useRef, useState } from "react";
import { nationalSpecialIdsByLineupId, obtainableNationalLineups, seasonById, specialCardById, subById } from "@/data";
import { useCopy } from "@/content/copy";
import { resolveSpecial } from "@/engine/cards";
import { nationalTeamKey, specialKey } from "@/engine/profileNew";
import type { Lineup, SpecialCard } from "@/engine/types";
import { cx, formatDate } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useOpenContent, useProfileNew } from "@/store/useNewItems";
import { Badge } from "@/components/ui/Badge";
import { NewTag } from "@/components/ui/NewDot";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { GameCard } from "@/components/cards/GameCard";
import { REGION_BADGE } from "@/components/regionStyle";

/**
 * National lineups per edition (season), newest edition first. Only teams that
 * can be found today: a closed region's region-only teams (APAC/SSA) stay out
 * of the album until that region opens — no slot the player could never fill.
 */
const EDITIONS: { seasonId: string; teams: Lineup[] }[] = (() => {
  const bySeason = new Map<string, Lineup[]>();
  for (const l of obtainableNationalLineups) {
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

type SlotRole = "player" | "coach" | "sub";
const roleOf = (sp: SpecialCard): SlotRole =>
  sp.kind === "coach" ? "coach" : subById.has(sp.baseCardId) ? "sub" : "player";

interface AlbumProps {
  /** Owned (or the dev preview). */
  isUnlocked: (specialId: string) => boolean;
  /** Page revealed: found in a draft, or a card owned (engine/collection). */
  isDiscovered: (lineupId: string) => boolean;
  /** ISO date the team was found in a draft (null when derived or unknown). */
  foundOn: (lineupId: string) => string | null;
  onOpenCard: (sp: SpecialCard) => void;
}

export function NationalAlbum({ isUnlocked, isDiscovered, foundOn, onOpenCard }: AlbumProps) {
  const { NATIONAL_UI: N, COLLECTION_UI: C } = useCopy();
  const fresh = useProfileNew();
  const openContent = useOpenContent();
  const rootRef = useRef<HTMLDivElement>(null);
  /** The open team page, and which of its keys were new when it opened. */
  const [page, setPage] = useState<{ team: Lineup; fresh: ReadonlySet<string> } | null>(null);
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

  const teamIsNew = (team: Lineup): boolean =>
    fresh.keys.has(nationalTeamKey(team.id)) || cardsOf(team).some((sp) => fresh.keys.has(specialKey(sp.id)));

  const turnTo = (next: { team: Lineup; fresh: ReadonlySet<string> } | null) => {
    sfx.click();
    setPage(next);
    // The page replaces the album in place: bring its top into view.
    rootRef.current?.scrollIntoView({ block: "start" });
  };

  const openTeam = (team: Lineup) => {
    // Opening a revealed page = opening its content: the team and its collected
    // cards stop being new (the snapshot keeps their tags for this visit).
    const keys = [
      nationalTeamKey(team.id),
      ...cardsOf(team)
        .filter((sp) => isUnlocked(sp.id))
        .map((sp) => specialKey(sp.id)),
    ];
    turnTo({ team, fresh: isDiscovered(team.id) ? openContent(keys) : new Set() });
  };

  return (
    <div ref={rootRef} className="scroll-mt-20">
      {page ? (
        <TeamPage
          team={page.team}
          fresh={page.fresh}
          discovered={isDiscovered(page.team.id)}
          foundOn={foundOn(page.team.id)}
          isUnlocked={isUnlocked}
          onOpenCard={onOpenCard}
          onBack={() => turnTo(null)}
        />
      ) : (
        <>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-sub">{N.albumIntro}</p>

          {editions.map(({ seasonId, teams }) => {
            const ids = teams.flatMap((t) => nationalSpecialIdsByLineupId.get(t.id) ?? []);
            const got = ids.filter(isUnlocked).length;
            const found = teams.filter((t) => isDiscovered(t.id)).length;
            return (
              <section key={seasonId} className="album-page mb-8 rounded-2xl border border-line p-3 sm:p-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="kicker !text-[10px]">{N.edition}</p>
                    <h2 className="display text-lg font-bold uppercase tracking-wide text-ink">
                      {seasonById.get(seasonId)?.label ?? seasonId}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="gold">{N.teamsFound(found, teams.length)}</Badge>
                    <Badge tone="neutral">{N.cardsProgress(got, ids.length)}</Badge>
                  </div>
                </div>
                <ProgressBar
                  value={ids.length ? got / ids.length : 0}
                  tone="gold"
                  className="mb-4 !h-1.5"
                  label={N.cardsProgress(got, ids.length)}
                />
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
                  {teams.map((team) => (
                    <TeamSlot
                      key={team.id}
                      team={team}
                      discovered={isDiscovered(team.id)}
                      have={cardsOf(team).filter((sp) => isUnlocked(sp.id)).length}
                      total={cardsOf(team).length}
                      isNew={teamIsNew(team)}
                      newLabel={C.newTag}
                      onOpen={() => openTeam(team)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/** A team's sticker slot on its edition page. */
function TeamSlot({
  team,
  discovered,
  have,
  total,
  isNew,
  newLabel,
  onOpen,
}: {
  team: Lineup;
  discovered: boolean;
  have: number;
  total: number;
  isNew: boolean;
  newLabel: string;
  onOpen: () => void;
}) {
  const { NATIONAL_UI: N } = useCopy();
  const complete = total > 0 && have === total;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        // pt-6 keeps the flag clear of the NEW tag in the corner (no overlap at 360 px).
        "relative flex min-h-11 flex-col items-center gap-2 rounded-xl border px-2 pb-3 pt-6 text-center transition-colors",
        !discovered
          ? "border-dashed border-line-strong/70 bg-black/10 hover:border-line-strong"
          : complete
            ? "border-yellow-300/50 bg-yellow-300/[0.05] shadow-[0_0_22px_rgba(234,179,8,0.14)] hover:border-yellow-200/70"
            : "border-line bg-white/[0.03] hover:border-line-strong",
      )}
    >
      {isNew ? <NewTag className="absolute right-1.5 top-1.5">{newLabel}</NewTag> : null}
      <TeamLogo orgId={team.orgId} seasonId={team.seasonId} size="lg" className={cx(!discovered && "opacity-30 grayscale")} />
      <span
        className={cx(
          "display block w-full truncate text-sm font-bold uppercase tracking-wide",
          discovered ? "text-ink" : "text-faint",
        )}
      >
        {N.teamName(team.orgId, team.name)}
      </span>
      <SlotPips have={have} total={total} muted={!discovered} />
      <span
        className={cx(
          "text-[11px] font-semibold",
          complete ? "text-yellow-200" : discovered ? "text-sub" : "text-faint",
        )}
      >
        {complete ? `✓ ${N.complete}` : discovered ? N.cardsProgress(have, total) : N.notFound}
      </span>
    </button>
  );
}

/** One pip per card slot: gold when collected. The text next to it carries the value. */
function SlotPips({ have, total, muted }: { have: number; total: number; muted: boolean }) {
  return (
    <span className="flex items-center justify-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx(
            "h-1.5 w-3.5 rounded-full",
            i < have ? "bg-yellow-300 shadow-[0_0_6px_rgba(250,204,21,0.5)]" : muted ? "bg-white/5" : "bg-white/15",
          )}
        />
      ))}
    </span>
  );
}

/** A team's page: crest, edition, progress, and the roster in formation. */
function TeamPage({
  team,
  fresh,
  discovered,
  foundOn,
  isUnlocked,
  onOpenCard,
  onBack,
}: {
  team: Lineup;
  fresh: ReadonlySet<string>;
  discovered: boolean;
  foundOn: string | null;
  isUnlocked: (id: string) => boolean;
  onOpenCard: (sp: SpecialCard) => void;
  onBack: () => void;
}) {
  const { NATIONAL_UI: N, COLLECTION_UI: C } = useCopy();
  const cards = cardsOf(team);
  const players = cards.filter((sp) => roleOf(sp) === "player");
  const bench = cards.filter((sp) => roleOf(sp) !== "player");
  const have = cards.filter((sp) => isUnlocked(sp.id)).length;
  const complete = cards.length > 0 && have === cards.length;

  const slot = (sp: SpecialCard) => (
    <FormationSlot
      sp={sp}
      owned={isUnlocked(sp.id)}
      discovered={discovered}
      isNew={fresh.has(specialKey(sp.id))}
      newLabel={C.newTag}
      onOpen={() => onOpenCard(sp)}
    />
  );

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-sub transition-colors hover:bg-white/5 hover:text-ink"
      >
        <span aria-hidden>←</span>
        {N.backToAlbum}
      </button>

      <header
        className={cx(
          "album-page mb-5 flex flex-col items-center gap-4 rounded-2xl border p-4 text-center sm:flex-row sm:p-5 sm:text-left",
          complete ? "border-yellow-300/50 shadow-[0_0_24px_rgba(234,179,8,0.12)]" : "border-line",
        )}
      >
        <TeamLogo
          orgId={team.orgId}
          seasonId={team.seasonId}
          size="xl"
          className={cx(!discovered && "opacity-30 grayscale")}
        />
        <div className="w-full min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink">
              {N.teamName(team.orgId, team.name)}
            </h2>
            {fresh.has(nationalTeamKey(team.id)) ? <NewTag>{C.newTag}</NewTag> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-sm text-sub sm:justify-start">
            <span>{seasonById.get(team.seasonId)?.label ?? team.seasonId}</span>
            <Badge className={REGION_BADGE[team.region]}>{team.region}</Badge>
            <Badge tone="gold">{N.label}</Badge>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar
              value={cards.length ? have / cards.length : 0}
              tone="gold"
              className="flex-1"
              label={N.cardsProgress(have, cards.length)}
            />
            <span className={cx("display shrink-0 text-sm font-bold", complete ? "text-yellow-200" : "text-ink")}>
              {complete ? `✓ ${N.complete}` : N.cardsProgress(have, cards.length)}
            </span>
          </div>
          {discovered ? (
            foundOn ? <p className="mt-2 text-xs text-faint">{N.foundOn(formatDate(foundOn))}</p> : null
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-sub">{N.notFoundHint}</p>
          )}
        </div>
      </header>

      {/* The roster in formation. Mobile keeps the draft's three-across width
          (cards ~100 px at 360 px), so nothing overlaps; the outer two sit lower
          than the middle one — a V, not a grid row. */}
      <div className="album-pitch rounded-2xl border border-yellow-300/20 px-2 pb-4 pt-3 sm:p-5">
        <p className="kicker mb-3 text-center !text-[10px]">{N.startingThree}</p>
        <div className="grid grid-cols-3 items-start gap-2 sm:gap-4">
          {players.map((sp, i) => (
            <div key={sp.id} className={cx("mx-auto w-full max-w-44", i !== 1 && "pt-3 sm:pt-8")}>
              {slot(sp)}
            </div>
          ))}
        </div>
        {bench.length ? (
          <>
            <div className="mb-3 mt-5 h-px bg-yellow-300/15" aria-hidden />
            <p className="kicker mb-3 text-center !text-[10px]">{N.bench}</p>
            <div className="flex justify-center gap-2 sm:gap-4">
              {bench.map((sp) => (
                <div key={sp.id} className="w-[calc((100%-1rem)/3)] max-w-44 sm:w-[calc((100%-2rem)/3)]">
                  {slot(sp)}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      {discovered && !complete ? (
        <p className="mt-3 text-center text-xs leading-relaxed text-sub">{N.lockedSlotHint}</p>
      ) : null}
    </div>
  );
}

/** One slot of the formation: the collected card, or its locked silhouette. */
function FormationSlot({
  sp,
  owned,
  discovered,
  isNew,
  newLabel,
  onOpen,
}: {
  sp: SpecialCard;
  owned: boolean;
  discovered: boolean;
  isNew: boolean;
  newLabel: string;
  onOpen: () => void;
}) {
  const { DRAFT_UI } = useCopy();
  if (owned) {
    return (
      <GameCard
        card={resolveSpecial(sp)}
        showOverall
        specialCollected
        size="md"
        fluid
        newTag={isNew}
        newTagText={newLabel}
        onClick={onOpen}
      />
    );
  }
  const role = roleOf(sp);
  const roleLabel = role === "coach" ? DRAFT_UI.slotCoach : role === "sub" ? DRAFT_UI.slotSub : DRAFT_UI.player;
  return (
    <div className="card-frame card-hidden flex aspect-[3/4.3] w-full flex-col items-center justify-center gap-1.5 p-2 text-center opacity-80">
      <LockGlyph />
      {/* A revealed page names who is missing; a hidden one keeps the roster secret. */}
      <span className="display w-full truncate text-xs font-bold uppercase tracking-wide text-sub">
        {discovered ? resolveSpecial(sp).name : "???"}
      </span>
      <span className="display text-[9px] font-bold uppercase tracking-[0.14em] text-faint">{roleLabel}</span>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
