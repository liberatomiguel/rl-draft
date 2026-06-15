import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} handles your data — short version: it stays on your device.`,
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

interface Section {
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    title: "The short version",
    body: [
      `${SITE.name} is a free, fan-made game. It does not require an account, and it does not sell or share your personal data. Your game progress is stored on your own device.`,
    ],
  },
  {
    title: "What's stored on your device",
    body: [
      "Your XP, rank, collection, achievements, run history, daily-challenge results and settings are saved in your browser's local storage. This data never leaves your device unless you explicitly export it.",
      "Clearing your browser data, or playing in a different browser or in private mode, will reset this progress.",
    ],
  },
  {
    title: "Analytics",
    body: [
      "We use privacy-friendly, aggregate web analytics to understand how many people visit and which pages are popular. It does not use advertising cookies and does not identify you personally.",
      "Search-engine statistics (how often the site appears in results) come from Google Search Console, which only reports aggregate, anonymous data.",
    ],
  },
  {
    title: "Accounts (coming later)",
    body: [
      "A future update will add optional Discord sign-in so your progress can sync across devices and power leaderboards. It will be entirely opt-in; until you choose to sign in, nothing is sent to a server. When it ships, this policy will be updated to describe exactly what is stored.",
    ],
  },
  {
    title: "Third-party links",
    body: [
      "The site links to external services (Discord, X, a support page). Those services have their own privacy policies, which apply once you leave this site.",
    ],
  },
  {
    title: "Not affiliated",
    body: [
      "Rocket Draft is an unofficial, non-commercial fan project. It is not affiliated with Psyonix, Epic Games, or any esports organization. Rocket League is a trademark of its respective owners.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="rise-in mx-auto max-w-3xl">
      <BackToMenu />
      <header className="mb-8">
        <p className="kicker mb-1">Legal</p>
        <h1 className="display text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">
          Privacy Policy
        </h1>
      </header>

      <div className="space-y-6">
        {SECTIONS.map((s) => (
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
          Questions? Reach out to {SITE.author} on{" "}
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
