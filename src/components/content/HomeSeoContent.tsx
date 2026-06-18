import Link from "next/link";
import type { Copy } from "@/content/copy.en";

type SeoLink = { label: string; href: string };

/**
 * Crawlable, keyword-bearing home content rendered BELOW the interactive menu.
 * Presentational + server-rendered: it takes the active locale's HOME_SEO dict
 * and a prebuilt link list, so the EN route (/) and the PT route (/pt) each
 * emit static, indexable copy in their own language. Not gated on `mounted`,
 * so it ships in the initial HTML for search engines. Visually low-key — it
 * reads as a footer-of-the-page explainer, not a marketing wall.
 */
export function HomeSeoContent({
  content,
  links,
}: {
  content: Copy["HOME_SEO"];
  links: SeoLink[];
}) {
  return (
    <section
      aria-labelledby="home-about-heading"
      className="mt-16 border-t border-line pt-10 text-left"
    >
      <h2
        id="home-about-heading"
        className="display max-w-3xl text-xl font-bold uppercase tracking-wide text-ink md:text-2xl"
      >
        {content.heading}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-sub md:text-base">
        {content.intro}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-7 md:grid-cols-2">
        {content.sections.map((s) => (
          <article key={s.id}>
            <h3 className="display text-base font-bold uppercase tracking-wide text-orange-bright">
              {s.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-sub">{s.body}</p>
          </article>
        ))}
      </div>

      <nav aria-label={content.links.heading} className="mt-10">
        <h3 className="kicker mb-3">{content.links.heading}</h3>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-blue-bright underline-offset-4 transition-colors hover:text-cyan hover:underline"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
