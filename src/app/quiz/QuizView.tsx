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
import { CrownIcon, FlameIcon, TargetIcon } from "@/components/ui/icons";
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
          <Panel strong className="p-4 sm:p-5">
            {/* The mystery card + the attempt track: the state of the day at a glance. */}
            <div className="flex items-center gap-4">
              <MysteryCard
                label={Q.mystery}
                state={!finished ? "hidden" : result?.solved ? "solved" : "missed"}
                nickname={answer?.nickname ?? puzzle.playerId}
                country={answer?.country}
              />
              <div className="min-w-0 flex-1">
                {compact ? null : (
                  <h2 className="display mb-2 text-base font-bold uppercase tracking-wide text-ink sm:text-lg">{Q.question}</h2>
                )}
                <div className="flex items-baseline justify-between gap-2">
                  <p className="kicker !text-[10px]">{Q.attemptOf(finished ? attemptsUsed : attemptsUsed + 1, limit)}</p>
                  <p className="shrink-0 whitespace-nowrap text-[11px] text-faint">
                    {!finished ? (
                      <span className="display mr-2 font-bold text-orange-bright">{Q.xpFor(QUIZ.xpByAttempt[attemptsUsed + 1] ?? 0)}</span>
                    ) : null}
                    {compact ? null : Q.dayLabel(dailyNumber(date))}
                  </p>
                </div>
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
                          "h-1.5 flex-1 rounded-full",
                          hit ? "bg-good" : miss ? "bg-bad/70" : current ? "bg-orange" : "bg-white/10",
                        )}
                      />
                    );
                  })}
                </ol>
              </div>
            </div>

            <ol className="mt-4 divide-y divide-line/50">
              {clues.map((c, i) => {
                const newest = !finished && i === clues.length - 1 && attemptsUsed > 0;
                return (
                  <li key={i} className="rise-in flex items-center gap-3 py-2.5">
                    <ClueMedal clue={c} />
                    <div className="min-w-0">
                      <p className={cx("kicker !text-[10px]", newest && "!text-blue-bright")}>{Q.clueKinds[c.kind]}</p>
                      <p className="mt-0.5 text-sm leading-snug text-ink">{clueText(c, Q)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {/* What is still closed: one quiet line. */}
            {lockedCount > 0 ? (
              <p className="mt-1 flex items-center gap-2 border-t border-line/50 pt-2.5 text-[11px] text-faint">
                <span className="flex w-11 shrink-0 items-center justify-center gap-0.5" aria-hidden>
                  <LockGlyph />
                </span>
                {Q.nextClueHint}
              </p>
            ) : null}

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
                <p className="min-h-4 text-xs font-semibold text-bad" aria-live="polite">
                  {flash ? Q.wrong : <span className="sr-only">{Q.attemptsLeft(limit - attemptsUsed)}</span>}
                </p>
                <div className="mt-1 flex gap-2">
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
                  <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint" aria-label={Q.yourGuesses}>
                    {result.guesses.map((g, i) => (
                      <li key={i} className="max-w-full truncate line-through decoration-bad/70">
                        {playerById.get(g)?.nickname ?? g}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </form>
            )}
          </Panel>

          <dl className="mt-4 grid grid-cols-4 divide-x divide-line/60 rounded-xl border border-line/70 bg-white/[0.02]">
            <Stat label={Q.played} value={quiz.played} icon={<TargetIcon className="h-4 w-4" />} />
            <Stat label={Q.solvedCount} value={quiz.solved} icon={<CheckGlyph />} />
            <Stat label={Q.streak} value={quiz.streak} icon={<FlameIcon className="h-4 w-4" />} />
            <Stat label={Q.best} value={quiz.bestStreak} icon={<CrownIcon className="h-4 w-4" />} />
          </dl>

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
        "relative flex h-20 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b text-center",
        hidden && "border-line-strong from-white/[0.07] to-white/[0.02]",
        state === "solved" && "pop-in border-good/60 from-good/20 to-good/5",
        state === "missed" && "pop-in border-bad/50 from-bad/15 to-bad/5",
      )}
    >
      {hidden ? (
        <span className="display text-3xl font-bold text-sub" aria-hidden>
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

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-1 py-2.5 text-center">
      <span className="text-faint" aria-hidden>
        {icon}
      </span>
      <dd className="display text-lg font-bold leading-none text-ink">{value}</dd>
      <dt className="w-full text-[10px] leading-tight text-faint">
        {label}
      </dt>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
