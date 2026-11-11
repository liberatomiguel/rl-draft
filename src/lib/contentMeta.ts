import type { Metadata } from "next";
import { SITE } from "@/config/site";
import type { ContentPageCopy } from "@/components/content/ContentArticle";

/** The share image (src/app/opengraph-image.png, exported at this URL). */
const OG_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "Rocket Draft — draft RLCS history, survive the bracket",
  type: "image/png",
};

/**
 * One page's complete <metadata> (v2.0, WEB-01).
 *
 * Next merges metadata shallowly: a page that sets `openGraph` or `twitter`
 * REPLACES the root layout's object, it does not extend it. Before this helper
 * the content pages set a partial `openGraph` and lost `og:image`,
 * `og:site_name` and `og:type` (a shared link had no preview image), and every
 * page kept the home's `twitter:title` / `twitter:description`; the app pages
 * set none and kept the home's `og:title` and `og:url`. So every page builds
 * the whole block here: a self-referencing canonical, its own Open Graph and
 * Twitter card with the share image, and (for a page with a twin in the other
 * language) the EN ↔ PT hreflang alternates.
 *
 * `title` is used as written (absolute); pass the brand in it where wanted.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  /** Slash-less path of this page ("/" for the home). */
  path: string;
  locale?: "en" | "pt";
  /** EN and PT URL of a page that exists in both languages. */
  twins?: { en: string; pt: string };
  /** false → `noindex, follow` (per-device pages a search result should not show). */
  index?: boolean;
}): Metadata {
  const { title, description, path, locale = "en", twins, index = true } = opts;
  const url = path === "/" ? SITE.url : `${SITE.url}${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: path,
      ...(twins
        ? { languages: { "en-US": twins.en, "pt-BR": twins.pt, "x-default": twins.en } }
        : {}),
    },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      url,
      title,
      description,
      locale: locale === "pt" ? "pt_BR" : "en_US",
      ...(twins ? { alternateLocale: locale === "pt" ? "en_US" : "pt_BR" } : {}),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      creator: "@liberatoRL_",
      title,
      description,
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
    // The staging build's blanket noindex (root layout) is inherited; a page
    // only states its own robots when it opts out of the index.
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}

/** `"<title> · Rocket Draft"`, unless the title already carries the brand. */
export function withBrand(title: string): string {
  return title.includes(SITE.name) ? title : `${title} · ${SITE.name}`;
}

/**
 * A content page's <metadata>: a self-referencing canonical, EN↔PT hreflang
 * alternates (so Google serves the right language and doesn't treat them as
 * duplicates), and an absolute title carrying the brand exactly once.
 */
export function contentMetadata(
  copy: ContentPageCopy,
  opts: { enPath: string; ptPath: string; locale: "en" | "pt" },
): Metadata {
  return pageMetadata({
    title: withBrand(copy.metaTitle),
    description: copy.metaDescription,
    path: opts.locale === "pt" ? opts.ptPath : opts.enPath,
    locale: opts.locale,
    twins: { en: opts.enPath, pt: opts.ptPath },
  });
}
