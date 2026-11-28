/**
 * Share kit (v2.2): a Road to Worlds save → the data of its share card and
 * the post that goes with it. Pure apart from the asset URLs.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { baseRarityOf } from "@/engine/cards";
import { seasonLabelFor } from "@/engine/career/calendar";
import type { CareerSave, EventTier } from "@/engine/career/types";
import { flagSrc } from "@/lib/assets";
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
 * rc9 SHARE (#258): the one headline. A title just won names that title; a
 * club's best title otherwise; a club with none leads with its series record.
 */
export function careerHeadline(
  t: ReturnType<typeof careerTitles>,
  record: string,
  T: CareerCopy["share"],
  pending?: EventTier | null,
): string {
  if (pending === "worlds") return T.headlineWorlds(t.worlds);
  if (pending === "major") return T.headlineMajors(t.majors);
  if (pending === "regional") return T.headlineRegionals(t.regionals);
  if (t.worlds > 0) return T.headlineWorlds(t.worlds);
  if (t.majors > 0) return T.headlineMajors(t.majors);
  if (t.regionals > 0) return T.headlineRegionals(t.regionals);
  if (t.total > 0) return T.headlineTitles(t.total);
  return record;
}

export function buildCareerShare(
  save: CareerSave,
  C: CareerCopy,
  playerLabel: string,
  pending?: EventTier | null,
  bannerUrl: string | null = null,
): CareerShareBundle {
  const T = C.share;
  const t = careerTitles(save, pending);
  const { seriesWins: w, seriesLosses: l } = save.stats;
  const org = save.identity.orgName;
  const record = `${w}-${l}`;
  const headline = careerHeadline(t, record, T, pending);
  // The season review has already filed this season in `history`.
  const seasons = Math.max(1, save.history.length + (save.phase === "seasonReview" ? 0 : 1));

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
        lineIsTitle: false,
        role: "player" as const,
        roleLabel: playerLabel,
        flagUrl: flag,
        flagCode: flag ? null : (p.country ?? null),
        logoUrl: CREST_KEY,
        photoUrl: null,
      };
    });

  const image: CareerImageData = {
    meta: `${T.kicker} · ${T.meta(save.identity.region, seasonLabelFor(save.clock.seasonIndex))}`,
    orgName: org,
    manager: T.manager(save.identity.managerName),
    headline,
    sentence: t.total > 0 ? T.sentenceTitles(t.total, w, l) : T.sentenceRecord(seasons),
    worldsChampion: t.worlds > 0,
    starters,
    bannerUrl,
    site: "rocketdraft.app",
  };

  const text = t.worlds > 0 ? T.textWorlds(org, t.worlds) : t.total > 0 ? T.textTitles(org, t.total) : T.textNone(org);
  const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "career";
  return { image, text, fileName: `rocket-draft-${slug}` };
}
