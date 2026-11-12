import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { PT } from "@/content/copy.pt";
import { FEATURES } from "@/config/balance";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { PAGE_ROUTES, isPageLive } from "@/content/pageRoutes";
import { HomeSeoContent } from "@/components/content/HomeSeoContent";
import { SyncLocale } from "@/components/content/SyncLocale";

/**
 * PT-BR landing page (/pt). The competitor is English-only, so this gives the
 * Portuguese audience a crawlable, indexable home in their language. Focused landing (PT hero + CTA + SEO content) that
 * funnels into the shared game at /play — not a second copy of the interactive
 * menu. hreflang ties it to the EN home at "/".
 */
export const metadata: Metadata = pageMetadata({
  // v2.0 (WEB-01): a build that ships Road to Worlds names the career mode.
  title: FEATURES.careerMode
    ? `${SITE.name} — Jogo de Draft da RLCS e Manager de Rocket League`
    : `${SITE.name} — Jogo de Draft da RLCS Grátis`,
  description: FEATURES.careerMode
    ? "Jogue o Rocket Draft, um jogo de draft da RLCS gratuito. Monte um elenco com lineups reais do Rocket League esports e vença o torneio, ou comande um clube no modo carreira Road to Worlds."
    : PT.APP.description,
  path: "/pt",
  locale: "pt",
  twins: { en: "/", pt: "/pt" },
});

const SEO_LINKS = [
  { label: PT.HOME_SEO.links.play, href: "/play" },
  { label: PT.HOME_SEO.links.howToPlay, href: "/how-to-play" },
  // The quiz page's only crawlable links (see HomeMenu). Cut with the route.
  ...(FEATURES.playtest ? [] : [{ label: PT.QUIZ_UI.kicker, href: "/quiz" }]),
  { label: PT.HOME_SEO.links.ratings, href: "/pt/overalls" },
  { label: PT.HOME_SEO.links.specialCards, href: "/pt/cartas-especiais" },
  { label: PT.HOME_SEO.links.strategy, href: "/pt/estrategia" },
  { label: PT.HOME_SEO.links.sam, href: "/pt/sam" },
  { label: PT.HOME_SEO.links.simulator, href: PAGE_ROUTES.simulator.pt },
  { label: PT.HOME_SEO.links.fantasy, href: PAGE_ROUTES.fantasy.pt },
  { label: PT.HOME_SEO.links.database, href: "/rlcs" },
  ...(isPageLive("manager") ? [{ label: PT.HOME_SEO.links.manager, href: PAGE_ROUTES.manager.pt }] : []),
  { label: PT.HOME_SEO.links.faq, href: "/pt/faq" },
  { label: PT.HOME_SEO.links.about, href: "/pt/sobre" },
];

export default function PtHomePage() {
  return (
    <div className="rise-in">
      <SyncLocale locale="pt" />
      <section className="px-2 py-10 text-center md:py-14">
        <p className="kicker mb-4">{PT.APP.tagline}</p>
        <h1 className="display mx-auto max-w-3xl text-5xl font-bold uppercase leading-[0.95] tracking-[0.08em] md:text-7xl">
          <span className="text-ink">Rocket</span>
          <span className="bg-gradient-to-r from-orange to-orange-bright bg-clip-text text-transparent">
            Draft
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-sub md:text-base">
          {PT.APP.description}
        </p>
        <p className="mt-8">
          <AppLink
            href="/play"
            className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.35)] transition-all hover:brightness-110"
          >
            {PT.HOME_SEO.links.play}
          </AppLink>
        </p>
      </section>

      <HomeSeoContent content={PT.HOME_SEO} links={SEO_LINKS} />
    </div>
  );
}
