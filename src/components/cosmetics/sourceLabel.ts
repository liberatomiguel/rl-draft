/**
 * Where a cosmetic comes from, as the line the player reads ("Reach Gold in
 * Season 1"). Its own module since v2.0: the unlock pop-up in the root layout
 * needs it on every page, and importing it from CosmeticsLocker put the whole
 * locker modal in the shared bundle.
 */
import { RANKS } from "@/config/balance";
import { SEASON } from "@/config/season";
import { challengeById } from "@/data/catalog";
import type { CosmeticSource } from "@/data/cosmetics";
import type { useCopy } from "@/content/copy";

const rankLabel = (id: string): string => RANKS.find((r) => r.id === id)?.label ?? id;

export function sourceLabel(source: CosmeticSource, C: ReturnType<typeof useCopy>["COSMETICS"]): string {
  switch (source.type) {
    case "legacy-participation":
      return C.sources["legacy-participation"];
    case "legacy-rank":
      return C.sources["legacy-rank"](rankLabel(source.rankId));
    case "legacy-position":
      return C.sources["legacy-position"](source.minPosition, source.maxPosition);
    case "grant":
      return C.sources[`grant-${source.grantId}`];
    case "season-rank":
      return C.sources["season-rank"](rankLabel(source.rankId), SEASON.name);
    case "login-streak":
      return C.sources["login-streak"](source.days);
    case "challenge-stars":
      return C.sources["challenge-stars"](source.stars);
    case "quiz-solved":
      return C.sources["quiz-solved"](source.count);
    case "missions-completed":
      return C.sources["missions-completed"](source.count);
    case "runs-won":
      return C.sources["runs-won"](source.count);
    case "runs-won-since-s1":
      return C.sources["runs-won-since-s1"](source.count);
    case "runs-finished-since-s1":
      return C.sources["runs-finished-since-s1"](source.count);
    case "legacy-streak":
      return C.sources["legacy-streak"](source.count);
    case "specials-owned":
      return C.sources["specials-owned"](source.count);
    case "challenge-perfect":
      return C.sources["challenge-perfect"](challengeById.get(source.challengeId)?.title ?? source.challengeId);
    case "career-mark":
      return C.sources.marks[source.markId] ?? C.sources["career-mark"];
    case "run-mark":
      return C.sources.marks[source.markId] ?? source.markId;
    case "run-marks-all":
      return C.sources.marks["run-lock-all"];
    case "career-worlds":
      return C.sources["career-worlds"](source.count);
    case "season-feat":
      return C.sources["season-feat"];
  }
}
