import type { Metadata } from "next";
import { SITE } from "@/config/site";
import type { ContentPageCopy } from "@/components/content/ContentArticle";

/**
 * Builds a content page's <metadata>: a self-referencing canonical, EN↔PT
 * hreflang alternates (so Google serves the right language and doesn't treat
 * them as duplicates), and an absolute title carrying the brand exactly once.
 */
export function contentMetadata(
  copy: ContentPageCopy,
  opts: { enPath: string; ptPath: string; locale: "en" | "pt" },
): Metadata {
  const title = copy.metaTitle.includes(SITE.name)
    ? copy.metaTitle
    : `${copy.metaTitle} · ${SITE.name}`;
  const canonical = opts.locale === "pt" ? opts.ptPath : opts.enPath;
  const url = canonical === "/" ? SITE.url : `${SITE.url}${canonical}`;
  return {
    title: { absolute: title },
    description: copy.metaDescription,
    alternates: {
      canonical,
      languages: {
        "en-US": opts.enPath,
        "pt-BR": opts.ptPath,
        "x-default": opts.enPath,
      },
    },
    openGraph: {
      url,
      title,
      description: copy.metaDescription,
      locale: opts.locale === "pt" ? "pt_BR" : "en_US",
    },
  };
}
