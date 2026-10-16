"use client";

/**
 * /quiz (v2.0) — "Guess the Player". The puzzle is date-derived (shared by
 * everyone), so the interactive part is mount-gated; the heading and intro are
 * static (crawlable). Three attempts, a new clue per miss, type-ahead over the
 * player nicknames. Results live on the profile (`quiz`).
 */

import { useMemo, useState } from "react";
import { QUIZ } from "@/config/balance";
import { orgById, playerById } from "@/data";
import { useCopy } from "@/content/copy";
import { quizForDate, quizSuggestions, resolveGuess, visibleClues, type QuizClue } from "@/engine/quiz";
import { todayKey, dailyNumber } from "@/lib/daily";
import { countryName, cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";

export function QuizView() {
  const { QUIZ_UI: Q } = useCopy();
  const mounted = useMounted();
  const date = todayKey();
  const puzzle = useMemo(() => quizForDate(date), [date]);
  const result = useProfileStore((s) => s.quiz.results[date]);
  const quiz = useProfileStore((s) => s.quiz);
  const guess = useProfileStore((s) => s.guessQuiz);
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<"wrong" | null>(null);

  const attemptsUsed = result?.attempts ?? 0;
  const finished = !!result && (result.solved || result.attempts >= QUIZ.attempts);
  const clues = visibleClues(puzzle, finished ? puzzle.clues.length : attemptsUsed);
  const answer = playerById.get(puzzle.playerId);
  const suggestions = useMemo(() => quizSuggestions(text, 6), [text]);

  const submit = (value: string) => {
    const id = resolveGuess(value);
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
    <div className="rise-in mx-auto max-w-2xl">
      <BackToMenu />
      <SectionTitle kicker={Q.kicker} title={Q.title} className="mb-2" />
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-sub">{Q.subtitle}</p>

      {!mounted ? (
        <div className="h-72 animate-pulse rounded-2xl bg-white/5" aria-busy />
      ) : (
        <>
          <Panel strong glow="blue" className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="display text-lg font-bold uppercase tracking-wide text-ink">{Q.question}</h2>
              <Badge tone="neutral">{Q.dayLabel(dailyNumber(date))}</Badge>
            </div>
            <ol className="space-y-2">
              {clues.map((c, i) => (
                <li key={i} className="rise-in flex items-start gap-2 rounded-lg border border-line/60 px-3 py-2 text-sm text-ink">
                  <Badge tone="blue" className="mt-0.5 shrink-0">
                    {Q.clue(i + 1)}
                  </Badge>
                  <span>{clueText(c, Q)}</span>
                </li>
              ))}
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
                  <span>{Q.attemptsLeft(QUIZ.attempts - attemptsUsed)}</span>
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
                          onClick={() => submit(p.nickname)}
                          className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-sub transition-colors hover:border-orange/50 hover:text-ink"
                        >
                          {p.nickname}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {result?.guesses.length ? (
                  <p className="mt-2 text-[11px] text-faint">
                    {result.guesses.map((g) => playerById.get(g)?.nickname ?? g).join(" · ")}
                  </p>
                ) : null}
              </form>
            )}
          </Panel>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={Q.played} value={String(quiz.played)} />
            <Stat label={Q.solvedCount} value={String(quiz.solved)} />
            <Stat label={Q.streak} value={String(quiz.streak)} />
            <Stat label={Q.best} value={String(quiz.bestStreak)} />
          </div>

          <RecentDays results={quiz.results} today={date} />
        </>
      )}
    </div>
  );
}

function clueText(c: QuizClue, Q: ReturnType<typeof useCopy>["QUIZ_UI"]): string {
  switch (c.kind) {
    case "country":
      return Q.clues.country(countryName(c.country), c.region);
    case "era":
      return Q.clues.era(c.firstYear, c.lastYear, c.lineups);
    case "orgs":
      return Q.clues.orgs(c.orgIds.map((id) => orgById.get(id)?.name ?? id));
    case "teammate":
      return Q.clues.teammate(playerById.get(c.playerId)?.nickname ?? c.playerId);
    case "peak":
      return Q.clues.peak(c.overall, orgById.get(c.orgId)?.name ?? c.orgId, c.year);
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-3 text-center">
      <p className="kicker !text-[10px]">{label}</p>
      <p className="display mt-1 text-xl font-bold text-ink">{value}</p>
    </Panel>
  );
}

function RecentDays({ results, today }: { results: Record<string, { solved: boolean; score: number }>; today: string }) {
  const { QUIZ_UI: Q } = useCopy();
  const days = Object.keys(results)
    .filter((d) => d <= today)
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
