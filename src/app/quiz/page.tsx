import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { QuizView } from "./QuizView";

export const metadata: Metadata = pageMetadata({
  title: `Daily RLCS Quiz — Guess the Player · ${SITE.name}`,
  description: `A free daily Rocket League esports quiz in ${SITE.name}: guess the RLCS player from progressive clues — nationality, era, orgs and teammates. One player per day, five attempts.`,
  path: "/quiz",
});

export default function QuizPage() {
  if (FEATURES.playtest) notFound(); // cut from the playtest build (postexport deletes it)
  return <QuizView />;
}
