import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.sam;

export const metadata = contentMetadata(PAGES_EN.sam, { enPath: R.en, ptPath: R.pt, locale: "en" });

export default function SamPage() {
  return (
    <ContentPage
      en={PAGES_EN.sam}
      pt={PAGES_PT.sam}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
