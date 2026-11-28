/**
 * Share kit (v2.2): a finished run → the data its share image and text are
 * made of. Pure apart from the asset URLs (`lib/assets.ts`), so the rules are
 * tested without a canvas.
 */

import { BUFF_LEVEL_VALUE } from "@/config/balance";
import { rosterSlots } from "@/components/cards/rosterView";
import type { Copy } from "@/content/copy";
import type { ResolvedCard } from "@/engine/cards";
import type { RunState } from "@/engine/types";
import { flagSrc, hasSpecialPhoto, orgLogoSrc, specialPhotoSrc } from "@/lib/assets";
import { stageRefLabel } from "@/lib/runLabels";
import type { FrameKey, RoleKind, ShareCardFace } from "./canvasKit";
import type { RoadStage, RunImageData } from "./runImage";

type ShareCopy = Copy["SHARE_UI"];

/** A drafted card as the share image draws it. */
export function shareFaceOf(card: ResolvedCard, roleLabel: string): ShareCardFace {
  const isOrg = card.kind === "org";
  const special = card.special;
  const national = isOrg && Boolean(card.orgId?.startsWith("national-"));
  let frame: FrameKey;
  if (special) frame = special.rarity as FrameKey;
  else if (national) frame = "national";
  else if (isOrg) {
    const lvl = card.buffLevel ?? "~";
    frame = lvl === "+++" ? "blue" : lvl === "++" ? "gold" : lvl === "+" ? "silver" : "common";
  } else frame = (card.baseRarity ?? "common") as FrameKey;
  const value = isOrg
    ? card.buffLevel && card.buffLevel !== "~"
      ? `+${BUFF_LEVEL_VALUE[card.buffLevel]}`
      : "-"
    : String(card.overall ?? "");
  const orgId = isOrg ? (card.orgId ?? card.refId) : card.orgId;
  const photo = special && hasSpecialPhoto(special.id) ? specialPhotoSrc(special.id, 400) : null;
  const flag = card.country ? flagSrc(card.country) : null;
  return {
    frame,
    value,
    name: card.name,
    line: special ? special.title : isOrg ? null : [card.orgName, card.seasonShort].filter(Boolean).join(" · ") || null,
    lineIsTitle: Boolean(special),
    role: card.kind as RoleKind,
    roleLabel,
    flagUrl: flag,
    flagCode: flag ? null : (card.country ?? (isOrg ? (card.region ?? null) : null)),
    logoUrl: orgId ? orgLogoSrc(orgId, 176) : null,
    photoUrl: photo,
  };
}

/** The drafted roster, players first, as share faces. */
export function runFaces(run: RunState, labels: { player: string; coach: string; sub: string; org: string }): ShareCardFace[] {
  return rosterSlots(run.draft.roster)
    .filter((s) => s.card)
    .map((s) => {
      const c = s.card!;
      const label = c.kind === "player" ? labels.player : c.kind === "coach" ? labels.coach : c.kind === "sub" ? labels.sub : labels.org;
      return shareFaceOf(c, label);
    });
}

/** The user's series in order: the Swiss, then the playoffs. */
export function runRoad(run: RunState, S: Pick<ShareCopy, "roadSwiss" | "roadPlayoffs">): RoadStage[] {
  const t = run.tournament;
  if (!t) return [];
  const mine = (s: { teamAId: string; teamBId: string }) => s.teamAId === "user" || s.teamBId === "user";
  const swiss = t.swiss.rounds.flatMap((r) => r.series).filter((s) => mine(s) && s.winnerTeamId);
  const playoffs = (t.playoffs?.rounds ?? []).flatMap((r) => r.series).filter((s) => mine(s) && s.winnerTeamId);
  return [
    { label: S.roadSwiss, series: swiss.map((s) => s.winnerTeamId === "user") },
    { label: S.roadPlayoffs, series: playoffs.map((s) => s.winnerTeamId === "user") },
  ].filter((st) => st.series.length > 0);
}

/** The road as a line of squares for a text post (the Daily's grid). */
export function roadGrid(road: RoadStage[]): string {
  return road.map((st) => st.series.map((won) => (won ? "🟩" : "🟥")).join("")).filter(Boolean).join(" ");
}

export function noSeriesLost(road: RoadStage[]): boolean {
  const all = road.flatMap((st) => st.series);
  return all.length > 0 && all.every(Boolean);
}

export interface RunShareInput {
  run: RunState;
  copy: Copy;
  placementLabel: string;
  teamOverall: number;
  chemistryTier: string;
  modeLabel: string;
  difficultyLabel: string;
  dateLabel: string;
  /** Today's Daily number, when the run is the Daily. */
  dailyNumber?: number | null;
  /** rc9 SHARE: the equipped profile banner's art URL (null = the plain stock). */
  bannerUrl?: string | null;
}

export interface RunShareBundle {
  image: RunImageData;
  text: string;
  campaign: "run" | "daily" | "duel";
  fileName: string;
}

export function buildRunShare(input: RunShareInput): RunShareBundle | null {
  const { run, copy } = input;
  const results = run.results;
  if (!results) return null;
  const S = copy.SHARE_UI;
  const T = copy.TOURNAMENT_UI;
  const road = runRoad(run, S);
  const champion = results.placement === "champion";
  const quick = run.mode === "quick";
  const record = `${results.swissRecord.wins}-${results.swissRecord.losses}`;
  const chem = copy.CHEM_TIERS[input.chemistryTier] ?? input.chemistryTier;

  let headline: string;
  if (champion) headline = noSeriesLost(road) ? S.headlineUndefeated : quick ? S.headlineChampionQuick : S.headlineChampion(record);
  else if (results.eliminatedBy) {
    const e = results.eliminatedBy;
    const stage = e.stageRef ? stageRefLabel(e.stageRef, T) : e.stage;
    headline = S.headlineOut(e.name, stage, `${e.score[0]}-${e.score[1]}`);
  } else headline = S.headlineFallback;

  // rc9 SHARE (#258): the meta is the mode and the difficulty.
  const meta = [
    input.dailyNumber ? S.dailyTag(input.dailyNumber) : input.modeLabel,
    run.duel ? copy.DUEL_UI.stepperTag : null,
    input.difficultyLabel,
    run.showOverall ? null : copy.RESULTS_UI.shareHiddenOvr,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const image: RunImageData = {
    placementLabel: input.placementLabel,
    champion,
    meta,
    headline,
    road,
    // rc9 SHARE (#258 revised): the run's three figures and every drafted card are back.
    figures: [
      { value: String(input.teamOverall), label: S.figTeamOvr },
      { value: chem, label: S.figChemistry },
      quick ? { value: String(results.playoffWins), label: S.figPlayoffWins } : { value: record, label: S.figSwiss },
    ],
    cards: runFaces(run, {
      player: copy.DRAFT_UI.player,
      coach: copy.DRAFT_UI.slotCoach,
      sub: copy.DRAFT_UI.slotSub,
      org: copy.DRAFT_UI.slotOrg,
    }),
    bannerUrl: input.bannerUrl ?? null,
    site: "rocketdraft.app",
  };

  let text: string;
  let campaign: RunShareBundle["campaign"];
  if (run.duel) {
    text = S.textDuel(input.placementLabel);
    campaign = "duel";
  } else if (input.dailyNumber) {
    text = S.textDaily(input.dailyNumber, input.placementLabel, roadGrid(road));
    campaign = "daily";
  } else {
    text = champion ? S.textChampion(input.teamOverall, chem) : S.textPlacement(input.placementLabel, input.teamOverall);
    campaign = "run";
  }

  return {
    image,
    text,
    campaign,
    fileName: `rocket-draft-${input.dailyNumber ? `daily-${input.dailyNumber}` : results.placement}`,
  };
}
