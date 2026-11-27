# v2.3 wave 1, front LOCKER: handoff

Branch `v23/locker-room` (base `v23/base`, ee41f1a). Flag `FEATURES.lockerRoom`
(staging build or `NEXT_PUBLIC_LOCKER_ROOM=1`); off in production, playtest,
dev and tests. Decisions R190–R194 in `ROAD-TO-WORLDS-DECISIONS.md`.

## What was built

| Part | File |
|---|---|
| Rules (pure, seeded): morale, moods, drivers, talks, promises, the word, the request, the training factor, the match effect (0), L5 hooks | `src/engine/career/lockerRoom.ts` |
| Tunables (`CAREER_LOCKER`) | `src/config/balance.lockerRoom.ts` |
| Store side: facts from the save before/after a write, notes to mail, answering a talk | `src/store/lockerRoomFlow.ts` |
| Talk answers in the inbox reader (minimum component, **not seen in a browser**) | `src/components/career/locker/LockerTalkAnswers.tsx` |
| Strings (EN, PT) | `src/content/copy.career.locker.en.ts`, `.pt.ts` |

Rules in short: neutral 50, moods cut at 20/40/60/80. Bench −3 per event sat
out, talk at 3 in a row (players who expect to start; a reserve stops at 32);
title +6, deep run +3, from the 3rd Swiss exit in a row −2; listed −10; weekly
drift 1 toward 50. Promise `minutes` 3 of 4 events, `stay` to the window's
close; kept +8, broken −20 and −4 for teammates; calm 10 × word multiplier.
Request after 4 weeks under 25. Training × 0.94–1.06. Match effect 0.

## Every line added to a shared file

| File | Line(s) | Purpose |
|---|---|---|
| `src/config/balance.ts` | `lockerRoom:` in FEATURES (+ comment) | the flag |
| `src/config/balance.ts` | `export * from "./balance.lockerRoom";` (last line) | tunables |
| `src/config/stagingFlags.test.ts` | `"lockerRoom"`, `"NEXT_PUBLIC_LOCKER_ROOM"` | staging-only flag list |
| `src/engine/career/types.ts` | `lockerRoom?:` on `CareerSave` (+ comment) | the save field |
| `src/engine/career/development.ts` | import; `lockerRoom?` in `growthCtxOf`'s param; `moraleFactors?` on its return type and on `GrowthCtx`; the spread in `growthCtxOf`'s `ctx`; one factor in `rawGain` | training factor (absent = ×1, same tick) |
| `src/store/careerStore.ts` | 2 imports; `answerLockerTalk` in the interface and the actions; `lockerRoomAfter(...)` in `withSave` and in `withResult` | the hooks |
| `src/content/copy.career.en.ts` / `.pt.ts` | import; `locker: CAREER_LOCKER_EN/PT,` (last key) | strings |
| `src/components/career/news/newsText.ts` | `?? career.locker.mail.tpl/body[...]` in `resolveMail` (2 lines edited) | the inbox reads the locker mail |
| `src/components/career/screens/NewsScreen.tsx` | import; `<LockerTalkAnswers />` in `MailReader` | the answers |

No change to `careerFlow.ts`, `calendar.ts`, `sunday.ts`, `board.ts`,
`mandate.ts`, `boardFlow.ts` or `takeover/*`. Persist contract untouched.

## Tests (all green, run one file at a time)

- `src/engine/career/lockerRoom.test.ts` (20): moods; each driver; the reason on every visible change; drift; promise kept and broken (minutes, stay, by sale, by listing; release drops quietly); the word changing the calm (a liar calms 0); auto-resolution after 7 days; bad answers refused; the transfer request with refuse/sell/cooldown; training factor bounds and that it never lowers a stored overall (via `trainWeek`); match effect 0; determinism and purity; L5 hooks.
- `src/store/lockerRoomFlow.test.ts` (4): flag off, six weeks through the real flows (events played) with and without the hook are byte-identical and carry no `lockerRoom`; flag on, the same walk fills the state deterministically and its mail resolves; listing, sale, release and refused bid derived from saves; a talk answered from the inbox; an unanswered talk closing itself while the clock runs.
- `src/content/copy.career.locker.test.ts` (2): EN/PT key parity; every mood, reason, answer and mail key renders in both.
- `src/config/stagingFlags.test.ts`, `development.test.ts`, `orgCopy.test.ts`, `newsView.test.ts` re-run green.

## Not verified

- No browser: the answer buttons, the mood mail and the talk mail were never seen rendered.
- No full suite, no build, no soft-lock probe, no battery: none of the numbers is measured.
- Writes that bypass the store's `withSave` / `withResult` (bots, probes) do not run the locker room (R192).
- The "series" of the spec is an event (R191); per-series counting would need the bracket.

## For Miguel to decide

1. Is an event the right unit for playing time, or does he want series (R191)?
2. Should reserves be exempt from the bench talk (R191) or should every benched player complain?
3. The starting numbers (R194), before a battery: especially the request threshold (25 for 4 weeks) and the training range (±6 %).
