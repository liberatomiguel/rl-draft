import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.sam;

export const metadata = contentMetadata(PAGES_PT.sam, { enPath: R.en, ptPath: R.pt, locale: "pt" });

export default function PtSamPage() {
  return (
    <ContentPage
      en={PAGES_EN.sam}
      pt={PAGES_PT.sam}
      initialLocale="pt"
      path={R.pt}
      backHref="/pt"
      ctaHref="/play"
    />
  );
}
