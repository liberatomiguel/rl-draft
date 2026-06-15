"use client";

/** Client view so the prose follows the EN/PT language switch (v1.1.0).
 *  Metadata stays on the server page.tsx for SEO. */

import { SITE } from "@/config/site";
import { useCopy } from "@/content/copy";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";

export function PrivacyView() {
  const { PRIVACY } = useCopy();

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <BackToMenu />
      <header className="mb-8">
        <p className="kicker mb-1">{PRIVACY.kicker}</p>
        <h1 className="display text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">
          {PRIVACY.title}
        </h1>
      </header>

      <div className="space-y-6">
        {PRIVACY.sections.map((s) => (
          <section key={s.title} className="panel p-5">
            <h2 className="display mb-2 text-sm font-bold uppercase tracking-[0.16em] text-ink">
              {s.title}
            </h2>
            <div className="space-y-2">
              {s.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-sub">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}

        <p className="text-xs text-faint">
          {PRIVACY.contactBefore} {SITE.author} {PRIVACY.contactBetween}{" "}
          <a
            href={SITE.authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sub underline-offset-4 hover:text-ink hover:underline"
          >
            X
          </a>
          .
        </p>
      </div>
    </div>
  );
}
