"use client";

/**
 * Share kit (v2.2): "Share career" for a Road to Worlds save. Opens the share
 * sheet on the club's card (post or story): the crest and the name, the
 * headline on the slab, the trophy shelf and the starting three wearing the
 * crest. The link goes to the career's landing page, tagged as a share.
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
import { Button } from "@/components/ui/Button";
import { ShareSheet } from "@/components/share/ShareSheet";
import { UserOrgMark, userMarkOf } from "@/components/career/OrgMark";
import { buildCareerShare } from "./careerShare";

export function CareerShareButton({
  save,
  variant = "secondary",
  label,
  className,
  size = "md",
  pendingTitle = null,
}: {
  save: CareerSave;
  /** A title won on the event screen that `finishEvent` has not booked yet. */
  pendingTitle?: EventTier | null;
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const C = useCareerCopy();
  const { DRAFT_UI } = useCopy();
  const locale = useUiLocale();
  const [open, setOpen] = useState(false);
  // The off-screen crest is found by id when the image is drawn (after render).
  const crestHostId = useId();
  const bundle = useMemo(
    () => (open ? buildCareerShare(save, C, DRAFT_UI.player, pendingTitle) : null),
    [open, save, C, DRAFT_UI.player, pendingTitle],
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

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label ?? C.share.button}
      </Button>
      {open ? (
        <>
          {/* The crest drawn off-screen, read back as an image for the card. */}
          {mark.kind === "crest" ? (
            <div id={crestHostId} aria-hidden className="pointer-events-none fixed left-[-9999px] top-0">
              <UserOrgMark identity={save.identity} size="xl" />
            </div>
          ) : null}
          {bundle ? (
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
        </>
      ) : null}
    </>
  );
}
