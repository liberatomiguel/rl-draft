/**
 * Share kit (v2.2): a Road to Worlds save → the data of its share card and
 * the post that goes with it. Pure apart from the asset URLs.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { baseRarityOf } from "@/engine/cards";
import { seasonLabelFor } from "@/engine/career/calendar";
import type { CareerSave, EventTier } from "@/engine/career/types";
import { flagSrc } from "@/lib/assets";
import { formatMoney } from "@/lib/format";
import { CREST_KEY, type CareerImageData } from "@/lib/share/careerImage";
import type { FrameKey, ShareCardFace } from "@/lib/share/canvasKit";

export interface CareerShareBundle {
  image: CareerImageData;
  text: string;
  fileName: string;
}

/**
 * The club's titles. `pending` = a title just won whose event screen is still
 * open: `finishEvent` books it on Continue, so the card counts it already.
 */
export function careerTitles(
  save: CareerSave,
  pending?: EventTier | null,
): { worlds: number; majors: number; regionals: number; other: number; total: number } {
  const s = save.stats;
  const worlds = s.titlesWorlds + (pending === "worlds" ? 1 : 0);
  const majors = s.titlesMajor + (pending === "major" ? 1 : 0);
  const regionals = s.titlesRegional + (pending === "regional" ? 1 : 0);
  const other = s.titlesT2 + s.titlesT3 + (pending === "t2" || pending === "t3" ? 1 : 0);
  return { worlds, majors, regionals, other, total: worlds + majors + regionals + other };
}

/**
 * rc9 SHARE (#258): the result line. A title just won names that title; a
 * club's best title otherwise; a club with none names its season (the series
 * record is a figure beside it).
 */
export function careerHeadline(t: ReturnType<typeof careerTitles>, season: number, T: CareerCopy["share"], pending?: EventTier | null): string {
  if (pending === "worlds") return T.headlineWorlds(t.worlds);
  if (pending === "major") return T.headlineMajors(t.majors);
  if (pending === "regional") return T.headlineRegionals(t.regionals);
  if (t.worlds > 0) return T.headlineWorlds(t.worlds);
  if (t.majors > 0) return T.headlineMajors(t.majors);
  if (t.regionals > 0) return T.headlineRegionals(t.regionals);
  if (t.total > 0) return T.headlineTitles(t.total);
  return T.headlineSeason(season);
}

export function buildCareerShare(
  save: CareerSave,
  C: CareerCopy,
  labels: { player: string; coach: string },
  pending?: EventTier | null,
  bannerUrl: string | null = null,
): CareerShareBundle {
  const T = C.share;
  const t = careerTitles(save, pending);
  const { seriesWins: w, seriesLosses: l } = save.stats;
  const org = save.identity.orgName;
  // The season review has already filed this season in `history`.
  const season = Math.max(1, save.history.length + (save.phase === "seasonReview" ? 0 : 1));

  // rc9 SHARE (#258 revised): the starting three and the coach, as cards wearing the crest.
  const starters: ShareCardFace[] = save.starterIds
    .map((id) => save.squad.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => {
      const ovr = Math.round(p.overall);
      const flag = p.country ? flagSrc(p.country) : null;
      return {
        frame: baseRarityOf(ovr) as FrameKey,
        value: String(ovr),
        name: p.name,
        line: C.player.archetype[p.archetype] ?? null,
        specialTitle: null,
        role: "player" as const,
        roleLabel: labels.player,
        flagUrl: flag,
        flagCode: flag ? null : (p.country ?? null),
        logoUrl: CREST_KEY,
        photoUrl: null,
      };
    });
  if (save.coach) {
    const ovr = Math.round(save.coach.overall);
    starters.push({
      frame: baseRarityOf(ovr) as FrameKey,
      value: String(ovr),
      name: save.coach.name,
      line: null,
      specialTitle: null,
      role: "coach",
      roleLabel: labels.coach,
      flagUrl: null,
      flagCode: null,
      logoUrl: CREST_KEY,
      photoUrl: null,
    });
  }

  const image: CareerImageData = {
    meta: `${T.kicker} · ${T.meta(save.identity.region, seasonLabelFor(save.clock.seasonIndex))}`,
    orgName: org,
    manager: T.manager(save.identity.managerName),
    headline: careerHeadline(t, season, T, pending),
    hasTitle: t.total > 0,
    worldsChampion: t.worlds > 0,
    record: { wins: w, losses: l },
    figures: [
      { value: `${w}-${l}`, label: T.figSeries },
      { value: formatMoney(save.stats.totalPrize, { compact: true }), label: T.figPrize },
    ],
    shelf: [
      { value: String(t.worlds), label: T.shelfWorlds, gold: t.worlds > 0 },
      { value: String(t.majors), label: T.shelfMajors },
      { value: String(t.regionals), label: T.shelfRegionals },
      { value: String(t.other), label: T.shelfOther },
    ],
    cards: starters,
    bannerUrl,
    site: "rocketdraft.app",
  };

  const text = t.worlds > 0 ? T.textWorlds(org, t.worlds) : t.total > 0 ? T.textTitles(org, t.total) : T.textNone(org);
  const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "career";
  return { image, text, fileName: `rocket-draft-${slug}` };
}
