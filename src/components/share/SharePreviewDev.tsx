"use client";

/**
 * rc9 SHARE: the dev server's share bench (`window.__rdShare`), mounted from
 * the Home's "With friends" section only when `NODE_ENV === "development"`.
 * It renders every share-image variant from the running app (real fonts, real
 * card art, real banner art) and opens the prompts on demand, so the evidence
 * is the game's own output. Nothing here reaches a production build.
 */

import { useEffect, useState } from "react";
import { UserOrgMark } from "@/components/career/OrgMark";
import type { UserOrgIdentity } from "@/components/career/OrgMark";
import { SharePrompts } from "./SharePrompts";

declare global {
  interface Window {
    __rdShare?: Record<string, (...args: never[]) => unknown>;
  }
}

const CREST_HOST = "rd-share-bench-crest";

export function SharePreviewDev() {
  const [force, setForce] = useState<"image" | "invite" | null>(null);
  const [identity, setIdentity] = useState<UserOrgIdentity | null>(null);

  useEffect(() => {
    void import("@/components/career/share/careerPreviewDev").then((m) => setIdentity(m.BENCH_IDENTITY as unknown as UserOrgIdentity));
    window.__rdShare = {
      run: (async (variant: "title" | "placement", format: "post" | "story", locale: "en" | "pt", bannerId: string | null) => {
        const m = await import("@/lib/share/devPreview");
        return m.renderRunBench(variant, format, locale, bannerId);
      }) as never,
      career: (async (variant: "title" | "season", format: "post" | "story", locale: "en" | "pt", bannerId: string | null) => {
        const [c, r] = await Promise.all([import("@/components/career/share/careerPreviewDev"), import("@/lib/share/devPreview")]);
        const svg = document.getElementById(CREST_HOST)?.querySelector("svg") ?? null;
        return c.renderCareerBench(variant, format, locale, r.benchBannerUrl(bannerId), svg);
      }) as never,
      banners: (async () => (await import("@/lib/share/devPreview")).benchBanners()) as never,
      prompt: ((kind: "image" | "invite" | null) => setForce(kind)) as never,
    };
    return () => {
      delete window.__rdShare;
    };
  }, []);

  const preview = async () => {
    const m = await import("@/lib/share/devPreview");
    const { url } = await m.renderRunBench("title", "post", "en", null);
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    return canvas;
  };

  return (
    <>
      {identity ? (
        <div id={CREST_HOST} aria-hidden className="pointer-events-none fixed left-[-9999px] top-0">
          <UserOrgMark identity={identity} size="xl" />
        </div>
      ) : null}
      <SharePrompts gameMode="draft" ready={false} titleKey="bench" invite={null} preview={preview} forceShow={force} onForcedClose={() => setForce(null)} />
    </>
  );
}
