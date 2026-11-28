"use client";

/**
 * Share kit (v2.2): the share sheet of a finished draft run (Classic, Quick,
 * the Daily and a duel run). The image is the run's own: the placement on the
 * slab, the road through the bracket, three figures and the drafted cards.
 * The link goes to the game, tagged with the share's campaign; a duel run
 * sends the duel link itself, so the friend plays the same draft.
 */

import { useMemo, useState } from "react";
import { SITE } from "@/config/site";
import { useCopy, useUiLocale } from "@/content/copy";
import { capEntries, duelEntryFromResults, duelPath } from "@/engine/duel";
import type { RunState } from "@/engine/types";
import { resolveShareFonts } from "@/lib/share/canvasKit";
import { renderRunImage, type ShareFormat } from "@/lib/share/runImage";
import { shareLinkOf } from "@/lib/share/links";
import { buildRunShare } from "@/lib/share/runShare";
import { shareBannerUrl } from "@/lib/share/shareBanner";
import { useProfileStore } from "@/store/profileStore";
import { ShareSheet } from "./ShareSheet";
import { SharePrompts } from "./SharePrompts";

export function RunShareSheet({
  run,
  open,
  onClose,
  placementLabel,
  teamOverall,
  chemistryTier,
  modeLabel,
  difficultyLabel,
}: {
  run: RunState;
  open: boolean;
  onClose: () => void;
  placementLabel: string;
  teamOverall: number;
  chemistryTier: string;
  modeLabel: string;
  difficultyLabel: string;
}) {
  const copy = useCopy();
  const locale = useUiLocale();
  const S = copy.SHARE_UI;
  // rc9 SHARE: the equipped banner on the image (#259), the prompts after the run (#256, #257).
  const cosmetics = useProfileStore((s) => s.cosmetics);
  const bannerUrl = useMemo(() => shareBannerUrl(cosmetics), [cosmetics]);
  const activeDays = useProfileStore((s) => s.login.total);
  const runsCompleted = useProfileStore((s) => s.runsCompleted);
  const [promptOpened, setPromptOpened] = useState(false);
  const sheetOpen = open || promptOpened;
  const closeSheet = () => {
    setPromptOpened(false);
    onClose();
  };
  const bundle = useMemo(
    () =>
      buildRunShare({
        run,
        copy,
        placementLabel,
        teamOverall,
        chemistryTier,
        modeLabel,
        difficultyLabel,
        dateLabel: new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-GB", { day: "numeric", month: "short", year: "numeric" })
          .format(new Date())
          .replace(/\./g, ""),
        dailyNumber: run.daily?.n ?? null,
        bannerUrl,
      }),
    [run, copy, placementLabel, teamOverall, chemistryTier, modeLabel, difficultyLabel, locale, bannerUrl],
  );
  const formats = useMemo(() => {
    if (!bundle) return undefined;
    const draw = (format: ShareFormat) => async () => renderRunImage(bundle.image, format, await resolveShareFonts());
    return { post: draw("post"), story: draw("story") };
  }, [bundle]);
  if (!bundle) return null;
  // A duel run sends the duel itself (its seed and the runs so far, this one
  // included), on this site: the friend plays the same draft.
  const url =
    run.duel && run.results && typeof window !== "undefined"
      ? `${window.location.origin}${duelPath({
          setup: run.duel.setup,
          entries: capEntries([...run.duel.entries, duelEntryFromResults(run.results, teamOverall)]),
        })}`
      : shareLinkOf(SITE.url, locale === "pt" ? "/pt" : "/", bundle.campaign);
  const title = bundle.campaign === "daily" ? S.titleDaily : bundle.campaign === "duel" ? S.titleDuel : S.titleRun;
  // rc9 SHARE: a won run (not a duel) may offer the image; a podium may invite, once.
  const placement = run.results?.placement ?? null;
  const titleKey = placement === "champion" && !run.duel ? `run:${run.seed}:${run.startedAt}` : null;
  return (
    <>
      <ShareSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={title}
        surface={bundle.campaign}
        gameMode="draft"
        text={bundle.text}
        url={url}
        formats={formats}
        fileName={bundle.fileName}
      />
      <SharePrompts
        gameMode="draft"
        ready={!sheetOpen}
        titleKey={titleKey}
        invite={{ activeDays, runsCompleted, careerSeasons: 0, moment: "run", placement, ordinaryRun: !run.duel }}
        preview={formats?.post}
        onShareImage={() => setPromptOpened(true)}
      />
    </>
  );
}
