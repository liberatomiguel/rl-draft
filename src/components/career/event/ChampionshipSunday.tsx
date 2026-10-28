"use client";

/**
 * Road to Worlds v2.0 (R40) — the CHAMPIONSHIP SUNDAY title card. Opens the
 * playoffs day of a Major / Worlds once per event (`sundayIntroDue`): event
 * name, the day, the eight seeds as the opening bracket — pairings only,
 * never a result (the card exists only while no playoff round has been
 * played) — and the user's opener (or the spectator line).
 *
 *   watch mode     auto hand-off to the playoffs after
 *                  CAREER_PLAYBACK.sundayIntroMs (× the animation-speed
 *                  scale), skippable: the button, a tap / click anywhere on
 *                  the card, or Escape.
 *   instant mode   Sunday re-opens the choice: Play it out / Instant result.
 *   reduced motion no motion and no timer — a static card and a button.
 *
 * Motion is transform / opacity only (DESIGN-DECISIONS #128–#130): one-shot
 * entrances and a scaleX progress bar; no filters, no infinite loops.
 */

import { useEffect, useRef } from "react";
import { CAREER_PLAYBACK, TOURNAMENT } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import type { ActiveEventState, CareerSave } from "@/engine/career/types";
import type { TournamentState } from "@/engine/types";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";
import { cx } from "@/lib/util";
import { ANIM_SCALE, useSettings } from "@/store/settingsStore";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { OrgMark } from "@/components/career/OrgMark";
import { TierChip } from "@/components/career/hub/hubShared";
import { Button, buttonClass } from "@/components/ui/Button";
import { sundayPreviewOf, type SundayPairing } from "./weekendView";

export function ChampionshipSunday({
  save,
  ev,
  onStart,
}: {
  save: CareerSave;
  ev: ActiveEventState;
  /** Opens the playoffs: true = watch them, false = instant result. */
  onStart: (watch: boolean) => void;
}) {
  const C = useCareerCopy();
  const T = useCopy().TOURNAMENT_UI;
  const reduced = useOsReducedMotion();
  const animSpeed = useSettings((s) => s.animSpeed);
  const startedRef = useRef(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const def = ev.def;
  const t = ev.tournament;
  const preview = sundayPreviewOf(t);
  const choose = !ev.watched;
  const auto = !choose && !reduced;
  const handOffMs = Math.round(CAREER_PLAYBACK.sundayIntroMs * ANIM_SCALE[animSpeed]);
  const bracketDelay = reduced ? 0 : CAREER_PLAYBACK.sundayIntroBracketDelayMs;

  const start = (watch: boolean) => {
    if (startedRef.current) return;
    startedRef.current = true;
    onStart(watch);
  };

  // Keyboard: the primary control takes focus (Enter / Space start), and in
  // watch mode Escape skips the card too.
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!auto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") start(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const nameOf = (id: string) => t.teams[id]?.name ?? id;
  const userLine = preview?.opener
    ? C.event.sundayOpener(nameOf(preview.opener.id), preview.userSeed ?? 0, preview.opener.seed)
    : C.event.sundaySpectating;

  return (
    <div className="mx-auto max-w-4xl px-3 py-5 sm:px-4">
      <section
        aria-labelledby="championship-sunday-title"
        onClick={auto ? () => start(true) : undefined}
        className={cx(
          "panel-strong panel-glow-orange relative overflow-hidden rounded-2xl px-4 py-6 text-center sm:px-10 sm:py-12",
          auto && "cursor-pointer",
        )}
      >
        {/* static stage light — no animated filters */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.24),transparent_62%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[radial-gradient(ellipse_at_bottom,rgba(251,191,36,0.10),transparent_70%)]"
        />

        <div className="relative">
          <div className="rise-in flex flex-wrap items-center justify-center gap-2">
            <p className="kicker !text-[11px]">
              {formatDateShort(C.dates, dateOfDay(save.clock.seasonIndex, save.clock.day))}
            </p>
            <TierChip tier={def.tier} />
          </div>
          <p className="kicker rise-in mt-2 !text-[11px] text-orange-bright" style={{ animationDelay: "60ms" }}>
            {def.name}
          </p>
          <h1
            id="championship-sunday-title"
            className="sunday-title display mx-auto mt-3 max-w-[14ch] text-4xl font-bold uppercase leading-[0.95] tracking-wide text-ink sm:max-w-none sm:text-6xl"
          >
            {C.event.championshipSunday}
          </h1>
          <div
            aria-hidden
            className="rise-in mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-orange/70 to-transparent"
            style={{ animationDelay: "160ms" }}
          />
          <p className="rise-in mt-3 text-sm text-sub" style={{ animationDelay: "200ms" }}>
            {C.event.sundaySub(TOURNAMENT.playoffs.teams, TOURNAMENT.playoffs.bestOf)}
          </p>

          {/* the opening bracket — pairings only (the card only exists before round 1).
              Two columns on phones too: four stacked pairs pushed the controls
              under the bottom nav at 390×844. */}
          {preview ? (
            <div className="mx-auto mt-5 max-w-2xl text-left sm:mt-6">
              <p className="kicker mb-2 text-center !text-[9px] text-cyan">{T.roundNames.ub_quarterfinal}</p>
              <div className="grid grid-cols-2 gap-2">
                {preview.pairs.map((p, i) => (
                  <SundayMatch
                    key={`${p.a.id}-${p.b.id}`}
                    save={save}
                    t={t}
                    pair={p}
                    delayMs={bracketDelay + i * (reduced ? 0 : CAREER_PLAYBACK.sundayIntroStaggerMs)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <p
            className={cx(
              "rise-in mt-5 text-sm font-semibold",
              preview?.opener ? "text-orange-bright" : "text-sub",
            )}
            style={{ animationDelay: `${bracketDelay + 4 * CAREER_PLAYBACK.sundayIntroStaggerMs}ms` }}
          >
            {userLine}
          </p>

          {/* controls */}
          {choose ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
              <button
                ref={primaryRef}
                type="button"
                className={cx(buttonClass("primary", "lg"), "w-full sm:w-auto")}
                onClick={() => start(true)}
              >
                {C.event.watch}
              </button>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => start(false)}>
                {C.event.instant}
              </Button>
            </div>
          ) : (
            <div className="mx-auto mt-6 max-w-xs">
              {auto ? (
                <div className="h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div
                    className="sunday-progress h-full rounded-full bg-gradient-to-r from-orange to-amber-300"
                    style={{ animationDuration: `${handOffMs}ms` }}
                    onAnimationEnd={(e) => {
                      if (e.target === e.currentTarget) start(true);
                    }}
                  />
                </div>
              ) : null}
              <button
                ref={primaryRef}
                type="button"
                className={cx(buttonClass("primary", "lg"), "mt-4 w-full sm:w-auto")}
                onClick={(e) => {
                  e.stopPropagation();
                  start(true);
                }}
              >
                {auto ? C.event.startNow : C.event.startPlayoffs}
              </button>
              {auto ? <p className="mt-2 text-[11px] text-faint">{C.event.tapToSkip}</p> : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SundayMatch({
  save,
  t,
  pair,
  delayMs,
}: {
  save: CareerSave;
  t: TournamentState;
  pair: SundayPairing;
  delayMs: number;
}) {
  return (
    <div
      className={cx(
        "pop-in min-w-0 rounded-lg border bg-white/[0.04] px-2 py-1.5 sm:px-3 sm:py-2",
        pair.userIn ? "border-orange/70 shadow-[0_0_18px_rgba(249,115,22,0.18)]" : "border-line",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {[pair.a, pair.b].map((side) => {
        const name = t.teams[side.id]?.name ?? side.id;
        return (
          <p key={side.id} className="flex items-center gap-1.5 py-0.5 text-xs sm:gap-2">
            <span className="display w-5 shrink-0 text-[10px] font-bold text-faint sm:w-6">#{side.seed}</span>
            <OrgMark save={save} orgRef={side.id} size="xs" className="shrink-0" />
            <span
              title={name}
              className={cx(
                "min-w-0 flex-1 truncate",
                side.id === "user" ? "font-bold text-orange-bright" : "font-semibold text-ink",
              )}
            >
              {name}
            </span>
          </p>
        );
      })}
    </div>
  );
}
