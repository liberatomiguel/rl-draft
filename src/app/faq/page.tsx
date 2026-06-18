import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.faq;

export const metadata = contentMetadata(PAGES_EN.faq, { enPath: R.en, ptPath: R.pt, locale: "en" });

export default function FaqPage() {
  return (
    <ContentPage
      en={PAGES_EN.faq}
      pt={PAGES_PT.faq}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
