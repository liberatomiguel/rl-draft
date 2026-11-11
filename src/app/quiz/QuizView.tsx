"use client";

/**
 * /quiz (v2.0) — "Guess the Player". The puzzle is date-derived (shared by
 * everyone), so the interactive part is mount-gated; the heading and intro are
 * static (crawlable). Five attempts, ONE clue at a time (a miss opens the
 * next), type-ahead over the player nicknames. The rule lives in the engine
 * (`quizState`); this file only draws it. Results live on the profile (`quiz`).
 */

import { useMemo, useState } from "react";
import { QUIZ } from "@/config/balance";
import { orgById, playerById } from "@/data";
import { useCopy } from "@/content/copy";
import { quizForDate, quizSuggestions, resolveGuess } from "@/engine/quiz";
import { quizDayFinished, quizLimit, visibleClues, type QuizClue, type QuizDayResult } from "@/engine/quizState";
import { dailyNumber } from "@/lib/dailyPlan";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useUtcDay } from "@/store/useUtcDay";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { TeamLogo } from "@/components/ui/TeamLogo";

export function QuizView() {
  const { QUIZ_UI: Q } = useCopy();
  return (
    <div className="rise-in mx-auto max-w-2xl">
      <BackToMenu />
      <SectionTitle kicker={Q.kicker} title={Q.title} className="mb-2" />
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-sub">{Q.subtitle}</p>
      <QuizPanel />
    </div>
  );
}

/** The playable card + stats + history — the same thing on /quiz and inside
 *  the home modal (rc.2: the quiz is a minigame, it opens in place). */
export function QuizPanel({ compact }: { compact?: boolean }) {
  const { QUIZ_UI: Q } = useCopy();
  const mounted = useMounted();
  const date = useUtcDay();
  const puzzle = useMemo(() => quizForDate(date), [date]);
  const result = useProfileStore((s) => s.quiz.results[date]);
  const quiz = useProfileStore((s) => s.quiz);
  const guess = useProfileStore((s) => s.guessQuiz);
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<"wrong" | null>(null);

  const attemptsUsed = result?.attempts ?? 0;
  const finished = quizDayFinished(result);
  const limit = quizLimit(result);
  const clues = visibleClues(puzzle, finished ? limit : attemptsUsed);
  const lockedCount = puzzle.clues.length - clues.length;
  const answer = playerById.get(puzzle.playerId);
  const suggestions = useMemo(() => quizSuggestions(text, 6), [text]);

  const submit = (value: string, selectedId?: string) => {
    const id = selectedId ?? resolveGuess(value, puzzle.playerId);
    const out = guess(puzzle, id, value);
    setText("");
    if (out.correct) sfx.unlock();
    else {
      sfx.click();
      setFlash("wrong");
      setTimeout(() => setFlash(null), 1500);
    }
  };

  return (
    <div>
      {!mounted ? (
        <div className="h-72 animate-pulse rounded-2xl bg-white/5" aria-busy />
      ) : (
        <>
          <Panel strong glow="blue" className="relative overflow-hidden p-4 sm:p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl" aria-hidden />
            <div className="relative mb-4 flex items-center justify-between gap-2">
              <h2 className="display text-base font-bold uppercase tracking-wide text-ink sm:text-lg">{Q.question}</h2>
              <Badge tone="neutral" className="shrink-0">{Q.dayLabel(dailyNumber(date))}</Badge>
            </div>

            {/* The mystery card + the attempt track: the state of the day at a glance. */}
            <div className="relative mb-4 flex items-center gap-4">
              <MysteryCard
                label={Q.mystery}
                state={!finished ? "hidden" : result?.solved ? "solved" : "missed"}
                nickname={answer?.nickname ?? puzzle.playerId}
                country={answer?.country}
              />
              <div className="min-w-0 flex-1">
                <p className="kicker !text-[10px]">
                  {Q.attemptOf(finished ? attemptsUsed : attemptsUsed + 1, limit)}
                </p>
                <ol className="mt-2 flex gap-1.5">
                  {Array.from({ length: limit }, (_, i) => {
                    const hit = !!result?.solved && i === attemptsUsed - 1;
                    const miss = !hit && i < attemptsUsed;
                    const current = !finished && i === attemptsUsed;
                    return (
                      <li
                        key={i}
                        title={hit ? Q.attemptState.hit : miss ? Q.attemptState.miss : current ? Q.attemptState.current : Q.attemptState.open}
                        className={cx(
                          "display flex h-8 min-w-0 flex-1 items-center justify-center rounded-md border text-xs font-bold",
                          hit && "border-good/60 bg-good/15 text-good",
                          miss && "border-bad/50 bg-bad/10 text-bad",
                          current && "border-orange/70 bg-orange/10 text-orange-bright shadow-[0_0_14px_rgba(249,115,22,0.25)]",
                          !hit && !miss && !current && "border-line text-faint",
                        )}
                      >
                        {hit ? "✓" : miss ? "×" : i + 1}
                      </li>
                    );
                  })}
                </ol>
                {!finished ? (
                  <p className="display mt-2 text-sm font-bold text-orange-bright">
                    {Q.xpFor(QUIZ.xpByAttempt[attemptsUsed + 1] ?? 0)}
                  </p>
                ) : null}
              </div>
            </div>

            <ol className="relative space-y-2">
              {clues.map((c, i) => {
                const newest = !finished && i === clues.length - 1 && attemptsUsed > 0;
                return (
                  <li
                    key={i}
                    className={cx(
                      "rise-in flex items-center gap-3 rounded-xl border px-3 py-2.5",
                      newest ? "border-blue/60 bg-blue/10" : "border-line/70 bg-white/[0.02]",
                    )}
                  >
                    <ClueMedal clue={c} />
                    <div className="min-w-0">
                      <p className="kicker !text-[10px]">
                        {Q.clue(i + 1)} · {Q.clueKinds[c.kind]}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-ink">{clueText(c, Q)}</p>
                    </div>
                  </li>
                );
              })}
              {/* What is still closed, in one compact row: the ladder stays short on a phone. */}
              {lockedCount > 0 ? (
                <li className="flex items-center gap-3 rounded-xl border border-dashed border-line/60 px-3 py-2 text-faint">
                  <span className="flex shrink-0 items-center gap-1" aria-hidden>
                    {Array.from({ length: lockedCount }, (_, k) => (
                      <LockGlyph key={k} />
                    ))}
                  </span>
                  <p className="min-w-0 text-[11px] leading-snug">
                    <span className="kicker !text-[10px] !text-faint">
                      {Q.clue(clues.length + 1)} · {Q.lockedClue}
                    </span>
                    <span className="ml-2">{Q.nextClueHint}</span>
                  </p>
                </li>
              ) : null}
            </ol>

            {finished ? (
              <div className="mt-5 text-center">
                {result?.solved ? (
                  <>
                    <Badge tone="good">{Q.solved(result.attempts)}</Badge>
                    <p className="display mt-2 text-xl font-bold text-orange-bright">{Q.xpFor(QUIZ.xpByAttempt[result.attempts] ?? 0)}</p>
                  </>
                ) : (
                  <Badge tone="bad">{Q.failed}</Badge>
                )}
                <p className="mt-3 flex items-center justify-center gap-2 text-sm text-sub">
                  {Q.answerWas}
                  <span className="display text-lg font-bold uppercase tracking-wide text-ink">{answer?.nickname ?? puzzle.playerId}</span>
                  {answer?.country ? <CountryChip code={answer.country} /> : null}
                </p>
                <p className="mt-2 text-xs text-faint">{Q.comeBack}</p>
              </div>
            ) : (
              <form
                className="mt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) submit(text);
                }}
              >
                <div className="flex items-center justify-between text-xs text-faint">
                  <span>{Q.attemptsLeft(limit - attemptsUsed)}</span>
                  {flash ? <span className="font-semibold text-bad">{Q.wrong}</span> : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={Q.placeholder}
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm text-ink outline-none focus:border-orange/60"
                  />
                  <Button variant="primary" type="submit" disabled={!text.trim()}>
                    {Q.guess}
                  </Button>
                </div>
                {suggestions.length > 0 && resolveGuess(text) === null ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => submit(p.nickname, p.id)}
                          className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-sub transition-colors hover:border-orange/50 hover:text-ink"
                        >
                          {p.nickname}{p.country ? <CountryChip code={p.country} /> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {result?.guesses.length ? (
                  <div className="mt-3">
                    <p className="kicker !text-[10px]">{Q.yourGuesses}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {result.guesses.map((g, i) => (
                        <li
                          key={i}
                          className="inline-flex max-w-full items-center gap-1 rounded-md border border-bad/40 bg-bad/10 px-2 py-1 text-xs font-semibold text-bad"
                        >
                          <span aria-hidden>×</span>
                          <span className="truncate line-through decoration-bad/60">{playerById.get(g)?.nickname ?? g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </form>
            )}
          </Panel>

          <div className={cx("mt-4 grid gap-3", compact ? "grid-cols-4" : "grid-cols-2 md:grid-cols-4")}>
            <Stat label={Q.played} value={String(quiz.played)} compact={compact} />
            <Stat label={Q.solvedCount} value={String(quiz.solved)} compact={compact} />
            <Stat label={Q.streak} value={String(quiz.streak)} compact={compact} />
            <Stat label={Q.best} value={String(quiz.bestStreak)} compact={compact} />
          </div>

          {compact ? null : <RecentDays results={quiz.results} today={date} />}
        </>
      )}
    </div>
  );
}

function clueText(c: QuizClue, Q: ReturnType<typeof useCopy>["QUIZ_UI"]): string {
  switch (c.kind) {
    case "country":
      return Q.clues.country(c.country, c.region);
    case "era":
      return Q.clues.era(c.firstYear, c.lastYear, c.lineups);
    case "orgs":
      return Q.clues.orgs(c.orgIds.map((id) => orgById.get(id)?.name ?? id));
    case "teammate":
      return Q.clues.teammate(playerById.get(c.playerId)?.nickname ?? c.playerId);
    case "peak":
      return Q.clues.peak(c.overall, orgById.get(c.orgId)?.name ?? c.orgId, c.year);
    case "nickname":
      return Q.clues.nickname(c.prefix);
  }
}

/** The player behind the question: a face-down card until the day ends. */
function MysteryCard({
  label,
  state,
  nickname,
  country,
}: {
  label: string;
  state: "hidden" | "solved" | "missed";
  nickname: string;
  country?: string;
}) {
  const hidden = state === "hidden";
  return (
    <div
      role="img"
      aria-label={hidden ? label : nickname}
      className={cx(
        "relative flex h-24 w-[4.5rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 bg-gradient-to-b text-center",
        hidden && "border-violet-400/50 from-violet-500/25 to-blue/10 shadow-[0_0_22px_rgba(167,139,250,0.25)]",
        state === "solved" && "pop-in border-good/60 from-good/25 to-good/5 shadow-[0_0_22px_rgba(52,211,153,0.25)]",
        state === "missed" && "pop-in border-bad/50 from-bad/20 to-bad/5",
      )}
    >
      {hidden ? (
        <span className="display text-4xl font-bold text-violet-200" aria-hidden>
          ?
        </span>
      ) : (
        <>
          {country ? <CountryChip code={country} /> : null}
          <span className="display mt-1.5 w-full truncate px-1 text-[11px] font-bold uppercase tracking-wide text-ink">{nickname}</span>
        </>
      )}
    </div>
  );
}

/** The picture of a clue: the flag, the years, the org logos, the overall. */
function ClueMedal({ clue }: { clue: QuizClue }) {
  const box = "flex h-9 w-11 shrink-0 items-center justify-center";
  switch (clue.kind) {
    case "country":
      return (
        <span className={box} aria-hidden>
          <CountryChip code={clue.country} className="scale-150" />
        </span>
      );
    case "era":
      return (
        <span className={cx(box, "display flex-col text-[11px] font-bold leading-tight text-cyan")} aria-hidden>
          <span>{clue.firstYear}</span>
          {clue.lastYear !== clue.firstYear ? <span>{clue.lastYear}</span> : null}
        </span>
      );
    case "orgs":
      return (
        <span className={cx(box, clue.orgIds.length > 1 && "-space-x-1.5")} aria-hidden>
          {clue.orgIds.map((id) => (
            <TeamLogo key={id} orgId={id} size="sm" />
          ))}
        </span>
      );
    case "teammate":
      return (
        <span className={cx(box, "text-blue-bright")} aria-hidden>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5s4.7 1.5 5.5 4.5" strokeLinecap="round" />
            <circle cx="17" cy="9" r="2.3" />
            <path d="M16.5 14.6c2.1.2 3.5 1.5 4 3.9" strokeLinecap="round" />
          </svg>
        </span>
      );
    case "nickname":
      return (
        <span className={cx(box, "display text-sm font-bold text-violet-200")} aria-hidden>
          {clue.prefix}…
        </span>
      );
    case "peak":
      return (
        <span className={cx(box, "display rounded-md border border-amber-400/50 bg-amber-400/10 text-base font-bold text-amber-300")} aria-hidden>
          {clue.overall}
        </span>
      );
  }
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function Stat({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <Panel className={cx("text-center", compact ? "p-2" : "p-3")}>
      <p className="kicker !text-[10px]">{label}</p>
      <p className={cx("display mt-1 font-bold text-ink", compact ? "text-base" : "text-xl")}>{value}</p>
    </Panel>
  );
}

function RecentDays({ results, today }: { results: Record<string, QuizDayResult>; today: string }) {
  const { QUIZ_UI: Q } = useCopy();
  const days = Object.keys(results)
    // A day still being played is not history yet.
    .filter((d) => d <= today && quizDayFinished(results[d]))
    .sort()
    .slice(-14);
  if (days.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="kicker mb-2">{Q.history}</p>
      <div className="flex flex-wrap gap-1.5">
        {days.map((d) => {
          const r = results[d];
          return (
            <span
              key={d}
              title={`${d} · ${Q.score(r.score)}`}
              className={cx(
                "display flex h-8 w-8 items-center justify-center rounded-md border text-xs font-bold",
                r.solved ? "border-good/50 bg-good/10 text-good" : "border-bad/40 bg-bad/10 text-bad",
              )}
            >
              {r.solved ? r.score : "×"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
