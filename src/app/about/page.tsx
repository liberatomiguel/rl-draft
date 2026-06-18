import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.about;

export const metadata = contentMetadata(PAGES_EN.about, { enPath: R.en, ptPath: R.pt, locale: "en" });

export default function AboutPage() {
  return (
    <ContentPage
      en={PAGES_EN.about}
      pt={PAGES_PT.about}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
