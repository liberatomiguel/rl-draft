import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { QuizView } from "./QuizView";

export const metadata: Metadata = {
  title: "Daily RLCS Quiz — Guess the Player",
  description: `A free daily Rocket League esports quiz in ${SITE.name}: guess the RLCS player from progressive clues — nationality, era, orgs and teammates. One player per day, three attempts.`,
  alternates: { canonical: "/quiz" },
  robots: { index: true, follow: true },
};

export default function QuizPage() {
  if (FEATURES.playtest) notFound(); // cut from the playtest build (postexport deletes it)
  return <QuizView />;
}
