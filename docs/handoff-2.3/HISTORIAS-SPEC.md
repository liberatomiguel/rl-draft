# v2.3 "Histórias", wave 1: the locker room and the fan feed

Written 27/11/2026 from the competitor study of RL Career Mode (a Windows /
BakkesMod career mod, open beta 13/11, about 233k video views). Its best
management feature is the human layer: visible player mood, a player chat whose
answers become promises the game collects later, a fan feed that reacts to the
save. Road to Worlds has none of it. This wave builds the rules and the text,
behind flags, with no new screens. Screens are wave 2, after Miguel reads this.

Miguel's words that bind this work:
- "Ter os mesmos itens de progressão não faz sentido": a new system must be a
  new mechanic, not a re-skin of an existing one.
- Never take rating away from a player (memory rule): no morale effect lowers a
  stored overall.
- Every new system comes with an automatic default ("deixar com o coach"): the
  game must stay playable by someone who ignores it.
- Narrative only states what the save's data proves.
- No invented sentence is ever attributed to a real pro, org or creator.

## Front LOCKER (`v23/locker-room`): morale and promises

Flag `FEATURES.lockerRoom` (staging build or `NEXT_PUBLIC_LOCKER_ROOM=1`). Off =
today's game, bit for bit, and the save untouched (test it).

**L1. Morale.** Each player under contract at the user's club has a morale
0–100, shown as five moods. A save without the field reads as neutral. AI clubs
have none.

**L2. What moves it** (few rules, each one visible to the player as a reason):
- Playing time: a run of series on the bench lowers it; after N series the
  player says so (a mail), and it keeps falling until he plays.
- Results: a title or a deep run lifts the squad; a long losing run lowers it a
  little.
- The market: being put on the transfer list lowers it; an AI bid for him that
  the user refuses opens a talk.
- Promises kept or broken (L3).

**L3. Talks and promises.** A talk is an inbox decision with two or three
canned answers. An answer may be a promise, stored with its terms and deadline:
`minutes` (starts X of the next Y series) and `stay` (not sold or listed before
the window closes). The game settles each promise on its deadline: kept lifts
the player and the manager's **word**; broken drops the player hard, the squad
a little, and the word. The word (kept against broken) decides how much a new
promise calms anyone: a manager who broke his word cannot talk his way out.
A talk left unanswered resolves itself with the neutral answer.

**L4. Consequences.** Low morale for several weeks: a transfer request (a
decision: sell, promise, or refuse). Morale scales training gain by a small
factor both ways. A match-performance effect exists as a tunable and ships at
**zero**: it is not switched on before a battery measures it.

**L5. Hooks for the takeover mode (do not wire).** Export
`lockerIssuesOf(save)` (unhappy players, open promises) and
`seedInheritedLockerRoom(save, rng)` (an inherited unhappy player, a promise the
previous manager left). The org-mode front wires them later.

## Front FEED (`v23/fan-feed`): the fan feed

Flag `FEATURES.fanFeed` (`NEXT_PUBLIC_FAN_FEED=1`), same contract when off.

**F1.** A pure, seeded `fanFeedFor(save)` derives posts from what the save
already records (series results with opponent, score and streak, signings,
sales, titles, upsets, the title ledger). Posts are derived, not stored.
**F2.** Authors are generated fan handles. Real names appear only as the
subject of a fan's post, never as its author, and never with an invented quote.
**F3. Variety** (the competitor's feed repeated across creators): at least six
variants per event kind, each using two or more data slots, no variant repeated
inside a window. A claim such as "dynasty" needs the data (titles in the ledger).
**F4. The manager's post.** After a series the user may post in one of three
tones (humble, confident, provocative) or skip. Stored: the tone, the opponent,
the week. **The receipt:** provoke and then lose to that opponent, and the fans
quote it back. Followers go up and down with results, tone and receipts. In
this wave followers are a number with no effect on money or morale.

## Shared rules

- Base: `v23/base` (= `release/v2.2` at `dde0acf` plus this file). Commit on
  your own branch. Never push. Never touch `main`, `staging`, `release/v2.2` or
  another worktree.
- Two other sessions are editing the career right now: event formats
  (`calendar.ts`, `sunday.ts`, `careerResults.ts`, `worldSim.ts`, event
  screens) and the takeover mandate (`board.ts`, `mandate.ts`, `boardFlow.ts`,
  `takeover/*`). Both also edit `balance.ts`, `types.ts`, `careerFlow.ts` and
  the two career copy files. So: **new code goes in new files**; in a shared
  file add the smallest hook possible (one import, one call, one optional
  field, one spread), grouped in one place and marked `// v2.3 LOCKER` or
  `// v2.3 FEED`, and list every such line in your handoff.
- Tunables: a new `src/config/balance.<front>.ts`, re-exported from
  `balance.ts` with one line. Strings: new `copy.career.<front>.en.ts` and
  `.pt.ts`, spread into the career copy with one line each; EN and PT keyed
  identically. Broadcast tone for the game's own voice; fans may be looser, no
  forced memes.
- Saves: additive optional fields only; the persist contract test stays as is.
- Engine code is pure and seeded (`src/lib/rng.ts`); the store calls it.
- Decision numbers reserved for this wave: R190–R194 (LOCKER), R195–R199
  (FEED) in `ROAD-TO-WORLDS-DECISIONS.md`. Changelog entry under a
  `v2.3.0-dev` heading.
- **Miguel's PC freezes with two heavy jobs.** Run only the test files you
  wrote or touched (`npx vitest run <file>`), never the full suite, a build, a
  dev server, a probe or a battery. One `npx tsc --noEmit` at the end, under
  the lock directory named in your brief (`mkdir` = take, check it succeeded,
  `rmdir` only a lock you created). The worktree has no `node_modules`: tools
  resolve from the main checkout by walking up. Never run `npm install` and
  never link `node_modules`.
- Handoff: `docs/handoff-2.3/<FRONT>.md` with what changed, every hook in a
  shared file, what the tests cover, and what was **not** verified (no browser,
  no full suite, no soft-lock probe, no battery).
