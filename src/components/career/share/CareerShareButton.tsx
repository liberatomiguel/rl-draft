"use client";

/**
 * Share kit: "Share career" for a Road to Worlds save. Opens the share sheet
 * on the club's image (post or story): the title or the record as the one
 * headline, the club's crest and name, and on the story the starting three
 * wearing the crest. The link goes to the career's landing page, tagged as a
 * share.
 *
 * rc9 SHARE: the equipped profile banner rides on the image (#259); the button
 * on an event's title screen may offer the image once in a while (#257), and
 * the one on the season review may carry the one-time invite (#256).
 */

import { useId, useMemo, useState } from "react";
import { SITE } from "@/config/site";
import { useCareerCopy } from "@/content/careerCopy";
import { useCopy, useUiLocale } from "@/content/copy";
import type { CareerSave, EventTier } from "@/engine/career/types";
import { orgLogoSrc } from "@/lib/assets";
import { loadImage, resolveShareFonts, svgElementToImage } from "@/lib/share/canvasKit";
import { renderCareerImage } from "@/lib/share/careerImage";
import type { ShareFormat } from "@/lib/share/runImage";
import { shareLinkOf } from "@/lib/share/links";
import { shareBannerUrl } from "@/lib/share/shareBanner";
import { careerTitlePrompts } from "@/lib/share/sharePrompts";
import { useProfileStore } from "@/store/profileStore";
import { Button } from "@/components/ui/Button";
import { ShareSheet } from "@/components/share/ShareSheet";
import { SharePrompts } from "@/components/share/SharePrompts";
import { UserOrgMark, userMarkOf } from "@/components/career/OrgMark";
import { buildCareerShare } from "./careerShare";

export function CareerShareButton({
  save,
  variant = "secondary",
  label,
  className,
  size = "md",
  pendingTitle = null,
  promptAt = null,
}: {
  save: CareerSave;
  /** A title won on the event screen that `finishEvent` has not booked yet. */
  pendingTitle?: EventTier | null;
  /** rc9 SHARE: "season" = this button sits on the season review (the invite's moment). */
  promptAt?: "season" | null;
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const C = useCareerCopy();
  const { DRAFT_UI } = useCopy();
  const locale = useUiLocale();
  const [open, setOpen] = useState(false);
  const cosmetics = useProfileStore((s) => s.cosmetics);
  const activeDays = useProfileStore((s) => s.login.total);
  const runsCompleted = useProfileStore((s) => s.runsCompleted);
  const bannerUrl = useMemo(() => shareBannerUrl(cosmetics), [cosmetics]);
  // The off-screen crest is found by id when the image is drawn (after render).
  const crestHostId = useId();
  const titlePrompt = careerTitlePrompts(pendingTitle);
  const prompting = titlePrompt || promptAt === "season";
  const bundle = useMemo(
    () => (open || prompting ? buildCareerShare(save, C, DRAFT_UI.player, pendingTitle, bannerUrl) : null),
    [open, prompting, save, C, DRAFT_UI.player, pendingTitle, bannerUrl],
  );
  const mark = userMarkOf(save.identity);
  const logoOrg = mark.kind === "logo" ? mark.orgId : null;

  const formats = useMemo(() => {
    if (!bundle) return undefined;
    const crest = async () => {
      if (logoOrg) return loadImage(orgLogoSrc(logoOrg, 352));
      return svgElementToImage(document.getElementById(crestHostId)?.querySelector("svg") ?? null, 512);
    };
    const draw = (format: ShareFormat) => async () => {
      const [fonts, img] = await Promise.all([resolveShareFonts(), crest()]);
      return renderCareerImage(bundle.image, img, format, fonts);
    };
    return { post: draw("post"), story: draw("story") };
  }, [bundle, logoOrg, crestHostId]);

  const url = shareLinkOf(SITE.url, locale === "pt" ? "/pt/manager-rocket-league" : "/rocket-league-manager", "career");
  const titleKey = titlePrompt ? `career:${save.careerId ?? save.careerSeed}:${save.clock.seasonIndex}:${save.clock.day}:${pendingTitle}` : null;

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label ?? C.share.button}
      </Button>
      {/* The crest drawn off-screen, read back as an image for the card. */}
      {(open || prompting) && mark.kind === "crest" ? (
        <div id={crestHostId} aria-hidden className="pointer-events-none fixed left-[-9999px] top-0">
          <UserOrgMark identity={save.identity} size="xl" />
        </div>
      ) : null}
      {open && bundle ? (
        <ShareSheet
          open
          onClose={() => setOpen(false)}
          title={C.share.sheetTitle}
          surface="career"
          gameMode="career"
          text={bundle.text}
          url={url}
          formats={formats}
          fileName={bundle.fileName}
          hint={C.share.hint}
        />
      ) : null}
      {prompting ? (
        <SharePrompts
          gameMode="career"
          ready={!open}
          titleKey={titleKey}
          invite={
            promptAt === "season" && save.phase === "seasonReview"
              ? { activeDays, runsCompleted, careerSeasons: save.history.length, moment: "season" }
              : null
          }
          preview={formats?.post}
          onShareImage={() => setOpen(true)}
        />
      ) : null}
    </>
  );
}
