# v2.3 "Histórias", wave 2: the screens, and media days

Written 27/11/2026. Wave 1 (`HISTORIAS-SPEC.md`, handoffs `LOCKER.md`,
`FEED.md`, `SKIP.md`) built the rules and the text with no screens. This wave
makes the locker room and the fan feed visible and playable, and adds media
days. Base: `v23/int`.

Not in this wave, on purpose: share cards (another session is building them in
`claude/share-boost`: `src/lib/share/`, `components/career/share/`,
`SeasonScreen`, `ClubScreen`, `EventScreen`, `ResultsScreen`; do not touch
those), scouting with hidden potential (waits for Miguel's review), two-step
negotiation and series formats (other sessions own contracts and event formats).

## Miguel's words that bind UI work

- He rejected the first takeover screens as "feitas de qualquer jeito". What
  fixed it: read `DESIGN.md` first (direction, palette, type, material, the
  "never" list, the "Phone" section), open the game's best existing career
  screens and match them, look at every new surface at 1280, 375 and 320 px.
- "Ter os mesmos itens de progressão não faz sentido": the locker room must
  look like people, not like another progress bar shelf.
- Every system has an automatic default: nothing here may block a player who
  ignores it.

## Front UI (`v23/ui-stories`): the locker room and the feed on screen

Flags as in wave 1. With a flag off, its surfaces do not render and no layout
shifts.

**U1. Mood on the squad.** Each player row or card of the user's club on the
Squad screen shows his mood (one of five, a small glyph and a word, restrained
colour: only the two extremes carry colour). Opening it shows why: the last
few changes with their reasons, and his open promise with its progress and
deadline ("1 of 3 starts, 2 events left").

**U2. The locker-room block.** On the Squad screen: the squad's mood, the
manager's word (promises kept and broken) and the open promises. On HQ, only
when something needs the player: a talk waiting, a promise at risk, a transfer
request (follow the existing "Now" cards pattern in `hub/NowCards.tsx`).

**U3. The talk.** `locker/LockerTalkAnswers.tsx` is a wave-1 minimum that
nobody saw in a browser. Make it read as a conversation: who speaks, what he
says, the two or three answers, and under each answer what it commits the
manager to. After answering: the outcome, and the promise where promises live.

**U4. The fan feed.** A "Fans" view in the News screen beside the existing
news: followers on top, then the posts (handle, text, likes, the event they
react to). The manager's own posts and the receipts are visibly different from
fan posts. Empty state for a save with no recorded series yet.

**U5. The manager's post.** After a series of the user's club, an HQ "Now" card
invites a post: three tones and skip, each tone previewing its text before it
is sent. Wire `postToFeedFlow` into `careerStore` (wave 1 left it unwired). Do
not put the composer on `EventScreen` (another session is editing it).

**U6.** Phone layouts under 640 px for every surface; EN and PT; strings in the
wave-1 copy files (`copy.career.locker.*`, `copy.career.feed.*`); no new colour,
font or material outside `DESIGN.md` (a deviation is recorded in
`DESIGN-DECISIONS.md`, numbers #220 to #229 reserved).

## Front MEDIA (`v23/media-days`): media days

Flag `FEATURES.mediaDays` (`NEXT_PUBLIC_MEDIA_DAYS=1`), staging only; off = no
save field, no behaviour change.

**M1.** Now and then (seeded; likelier with reputation, and with followers when
the fan feed is on) a brand offers a media day for a named player of the user's
club: cash, and the player is away for 2 to 4 days. Brands are fictional
parodies, never real companies.
**M2.** The offer is an inbox item with accept and decline, stating the dates,
the cash and, when an event of the user's falls inside those days, **which
event he would miss**. It never holds the clock: unanswered, it lapses as
declined on its deadline.
**M3.** Accepting uses the existing absence system (the one behind illness and
training wear, with its notice naming the cause and the player): the player is
unavailable for those days. A club that would be left without three players
for an event is never offered that date.
**M4.** Sending the same player again inside a few weeks costs him morale, with
its reason shown, when the locker room is on (call the wave-1 API; no effect
when it is off).
**M5.** Money: modest. One media day is worth about a week of a typical
sponsor's income at that reputation, never a prize. Record that the amounts are
not measured in a battery. Tunables in `balance.mediaDays.ts`.
**M6.** No new screen: the inbox and the existing absence surfaces carry it. If
the existing inbox cannot carry accept / decline for a non-blocking item, add
the minimum and say it was not seen in a browser.

## Shared rules

The wave-1 shared rules apply unchanged (new files, minimal marked hooks
`// v2.3 UI` / `// v2.3 MEDIA`, additive saves, pure seeded engine, commit on
your branch, never push). Additions:
- Decision numbers: R201 to R204 (UI), R205 to R209 (MEDIA).
- `BALANCE_VERSION`: a front that adds an export to `balance.ts` must run
  `src/config/balanceVersion.test.ts` and follow what it prints.
- The disk has 12 GB free and the PC is loaded: no `npm install` / `npm ci`
  anywhere, no build, no full suite, no probe.
- Sessions editing the career right now, files to stay out of: event formats
  (`calendar.ts`, `sunday.ts`, `careerResults.ts`, `worldSim.ts`,
  `EventScreen`, `FollowScreen`, `StandingsScreen`, `hub/hubShared.tsx`), the
  takeover mandate (`board.ts`, `mandate.ts`, `boardFlow.ts`, `takeover/*`,
  `hub/SeasonGoalBlock.tsx`), sharing (listed above).
