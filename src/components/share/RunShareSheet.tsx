"use client";

/**
 * Share kit (v2.2): the share sheet of a finished draft run (Classic, Quick,
 * the Daily and a duel run). The image is the run's own: the placement on the
 * slab, the road through the bracket, three figures and the drafted cards.
 * The link goes to the game, tagged with the share's campaign; a duel run
 * sends the duel link itself, so the friend plays the same draft.
 */

import { useMemo } from "react";
import { SITE } from "@/config/site";
import { useCopy, useUiLocale } from "@/content/copy";
import { capEntries, duelEntryFromResults, duelPath } from "@/engine/duel";
import type { RunState } from "@/engine/types";
import { resolveShareFonts } from "@/lib/share/canvasKit";
import { renderRunImage, type ShareFormat } from "@/lib/share/runImage";
import { shareLinkOf } from "@/lib/share/links";
import { buildRunShare } from "@/lib/share/runShare";
import { ShareSheet } from "./ShareSheet";

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
      }),
    [run, copy, placementLabel, teamOverall, chemistryTier, modeLabel, difficultyLabel, locale],
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
  return (
    <ShareSheet
      open={open}
      onClose={onClose}
      title={title}
      surface={bundle.campaign}
      gameMode="draft"
      text={bundle.text}
      url={url}
      formats={formats}
      fileName={bundle.fileName}
    />
  );
}
