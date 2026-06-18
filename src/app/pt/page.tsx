import type { Metadata } from "next";
import Link from "next/link";
import { PT } from "@/content/copy.pt";
import { SITE } from "@/config/site";
import { HomeSeoContent } from "@/components/content/HomeSeoContent";
import { SyncLocale } from "@/components/content/SyncLocale";

/**
 * PT-BR landing page (/pt). Brazil is the #1 click source and the competitor is
 * English-only, so this gives the Portuguese audience a crawlable, indexable
 * home in their language. Focused landing (PT hero + CTA + SEO content) that
 * funnels into the shared game at /play — not a second copy of the interactive
 * menu. hreflang ties it to the EN home at "/".
 */
export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — Jogo de Draft da RLCS Grátis` },
  description: PT.APP.description,
  alternates: {
    canonical: "/pt",
    languages: { "en-US": "/", "pt-BR": "/pt", "x-default": "/" },
  },
  openGraph: {
    url: `${SITE.url}/pt`,
    title: `${SITE.name} — Jogo de Draft da RLCS`,
    description: PT.APP.description,
    locale: "pt_BR",
  },
};

const SEO_LINKS = [
  { label: PT.HOME_SEO.links.play, href: "/play" },
  { label: PT.HOME_SEO.links.howToPlay, href: "/how-to-play" },
  { label: PT.HOME_SEO.links.ratings, href: "/pt/overalls" },
  { label: PT.HOME_SEO.links.specialCards, href: "/pt/cartas-especiais" },
  { label: PT.HOME_SEO.links.strategy, href: "/pt/estrategia" },
  { label: PT.HOME_SEO.links.sam, href: "/pt/sam" },
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
          <Link
            href="/play"
            className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.35)] transition-all hover:brightness-110"
          >
            {PT.HOME_SEO.links.play}
          </Link>
        </p>
      </section>

      <HomeSeoContent content={PT.HOME_SEO} links={SEO_LINKS} />
    </div>
  );
}
