import type { Copy } from "@/content/copy.en";
import type { Challenge, ChallengeStar } from "@/engine/types";

/** Star condition → copy (v2.0). */
export function starLabel(star: ChallengeStar, CH: Copy["CHALLENGES_UI"], draftOnly = false): string {
  const text = draftOnly ? CH.draftStar : CH.star;
  switch (star.kind) {
    case "noSpecials":
      return text.noSpecials;
    case "sweep":
      return text.sweep(star.maxLosses);
    case "maxOverall":
      return text.maxOverall(star.max);
    case "chemistry":
      return text.chemistry(star.tier);
    case "underdog":
      return text.underdog;
    case "maxRerolls":
      return text.maxRerolls(star.max);
    case "goals":
      return text.goals(star.min);
    case "concede":
      return text.concede(star.max);
    case "noLosses":
      return text.noLosses;
    case "sameRegion":
      return text.sameRegion;
    case "minOverall": return text.minOverall(star.min);
    case "differentCountries": return text.differentCountries(star.min);
    case "sameOrg": return text.sameOrg;
    case "sameSeason":
      return text.sameSeason;
  }
}

export function challengeStarLabels(ch: Challenge, CH: Copy["CHALLENGES_UI"]): string[] {
  return [ch.kind === "draft" && ch.objective ? starLabel(ch.objective, CH, true) : ch.kind === "gauntlet" ? CH.starGauntlet1 : CH.star1,
    ...(ch.stars ?? []).map(s => starLabel(s, CH, ch.kind === "draft"))];
}
