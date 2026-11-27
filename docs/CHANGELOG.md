# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/) ·
versioning: [SemVer](https://semver.org/) (0.x while the MVP is being
validated).

Sections per release: **Added · Changed · Balance · Fixed**.
Bugs found after a release get an entry under **Fixed** in the next release,
with the root cause — that section doubles as the project's bugfix log.

---

## rc.9 (unreleased)

### Fixed
- **BUGS front: no live defect found among the five survey reports.** The sponsor goal that read as reset or out of reach was fixed in v2.0.34 (root cause there: `rolloverToNextSeason` emptied the results a contract goal counts). New regression over every signing week (`sponsorDeals.test.ts`). Challenge resets replaying the same teams is intended (fixed seed).

## [2.2.0-rc.8] — 2026-11-27 · Everything from the 27/11 chats on one staging build (staging)

Integration of the two lines that were not on staging yet, on top of rc.7 + the share kit's server count (`71eded8`). No new gameplay of its own: each part keeps its flag, and every flag is on in the staging build only.

### Added
- **v2.3 (`v23/int`, chat "Análise competitiva modo carreira"):** the locker room (`lockerRoom`: morale, talks, promises), media days (`mediaDays`), the fan feed (`fanFeed`) and their screens; the Skip and the autoplay stop once as a transfer window enters its last week (R200). Decisions R190 to R200; what is not verified and Miguel's eight decisions: `docs/V2.3-STATUS.md`.
- **Majors and Worlds in their season's format (`v22/event-formats`, chat "Formatos Worlds/Majors Road to Worlds"):** behind `eventFormats`. Decision R210 (it was R-FMT on its branch). The work had been left uncommitted in its worktree; it was committed as it was (`8cbef58`) and merged.

### Balance
- BALANCE_VERSION 57: 56 (v2.3, its tables joined the export) plus the formats' points and prize split (53 on its branch). No number moves beyond what each branch had.

### Fixed
- A playoff state with no `format` (an older save, a partial state) crashed the Sunday briefing (`roundOrderFor` returned nothing). Root cause: the formats branch's `isLayoutFormat` was a negative test ("neither double nor single"), so a missing format counted as a career-only bracket. Now it checks the layout table itself and a missing format is the classic double elimination again (`careerSunday.test.ts`).
- Test-only: the flag-off base hashes (`endlessFlagOff`, `careerBoard.flagOff`) refreshed for R200, whose "window closes in 6 days" news items are in every build (the saves were diffed: nothing else moves; the merged tree hashes exactly like `v23/int`, so the formats are neutral with their flag off). The "no app file imports test support" rule now covers every `*ForTests.ts` file (the formats' `careerMajorLobbyForTests` builds on the clock helper).

## [2.3.0-dev]

### Fixed

- A batched Skip or the autoplay sailed past the close of a transfer window with no stop and no notice. Root cause: `isStopState` and `CareerAutopilot` only knew the Monday a window OPENS; nothing marked the Monday its last week begins, and the only warning was the passive "closes in N days" on two screens. Now both stop once on that Monday (`isWindowLastWeekStart`, never a clock hold) and a "Transfer window closes in 6 days" news item with a body says what lapses (R200).

## [2.3.0-dev, front UI] — 2026-11-27 · The locker room and the fan feed on screen (branch v23/ui-stories)

### Added
- The locker room on the Squad screen (R202, `FEATURES.lockerRoom`): each starter card shows his mood (a face and a word); a "Locker room" board with the first open talk, one row per player (his framed overall, name, the last thing that moved him, his mood), the manager's word as two figures, and the open promises with progress and deadline ("1 of 3 starts, 2 events left"). A tap on a player opens why: his last changes with reasons, his promise, his talk.
- The talk as a conversation (R201, `locker/LockerTalk.tsx`, replaces the wave-1 buttons in the inbox too): who, the staff's report, two or three answers with what each commits the manager to, the default marked; after the tap, the answer, his mood and where the promise lives.
- HQ: a "Locker room" card under the decision block only when a talk waits or a promise is one bench from breaking; a "Post after the series" card (R203) with three tones, the post previewed before it goes out, Post and Skip. Neither holds the clock.
- The desk's fourth view, Fans (R203, `FEATURES.fanFeed`): followers, then the posts; the manager's posts and the receipts stand out (DESIGN-DECISIONS #222); empty state for a save with no series yet.
- Read-only selectors in `lockerRoom.ts` (`promiseProgressOf`, `playerLockerLogOf`, `squadMoodOf`, `wordStandingOf`, `lockerAttentionOf`, `lockerDaysBetween`) and `managerPostDraftOf` in `fanFeed.ts`, tested in `lockerRoom.view.test.ts`. No rule or number changed.
- `careerStore.postToFeed` wires `postToFeedFlow` (wave 1 left it unwired). Copy: `locker.ui.*` and `feed.ui.*`, EN and PT.

### Changed
- The desk's tab strip scrolls sideways on a phone when the fan feed is on (DESIGN-DECISIONS #223).

## [2.3.0-dev, front FEED] — 2026-11-27 · The fan feed: rules and text, no screen yet (branch v23/fan-feed)

### Added
- Fan feed (R195-R199, `FEATURES.fanFeed`, staging only): `engine/career/fanFeed.ts` (`fanFeedFor`, pure and seeded) derives recent posts from the save: series won and lost, upsets, win and loss streaks, signings, sales, titles, lost finals, the fans' answer to the manager's post and the receipt. Posts are data, never stored.
- 13 event kinds, 6 to 9 variants each (`fanFeedVariants.ts`), every variant naming two or more slots; no variant repeats inside the last 5 posts of its kind. "Dynasty", "best team in the region" and "first title" appear only when the save's ledger supports them.
- Generated fan handles from a bank of our own (`fanHandles.ts`), checked in a test against every dataset and career-catalogue player and org name.
- The manager's post (`store/fanFeedFlow.ts`): `postToFeedFlow(save, tone | "skip")` stores tone, opponent and week; a provocative post followed by a loss to that opponent becomes a receipt the fans quote back. Followers move with results, tone and receipts and have no other effect.
- Copy: `copy.career.feed.en.ts` / `.pt.ts` (88 texts each, the Portuguese written as a Brazilian fan would post).

### Changed
- `finishEvent` calls `recordFeedSeries` (one line, a no-op with the flag off) to keep the user's last 40 series in the new optional `save.fanFeed`; recording of results is untouched. `stagingFlags.test.ts` lists the new flag.

### Balance
- BALANCE_VERSION 54: the new `CAREER_FEED` group only (feed tunables); no gameplay number moves.

---

## [v2.3.0-dev, front MEDIA] — 2026-11-27 · Media days: a brand pays for a named player to be away a few days (branch v23/media-days, FEATURES.mediaDays, staging only)

### Added
- Media days (R205–R209, `engine/career/mediaDays.ts`, tunables in `config/balance.mediaDays.ts` as `CAREER_MEDIA`, store side `store/mediaDaysFlow.ts`). On a weekly tick a seeded roll may bring an offer: a fictional brand, a named player, 2 to 4 days, cash. One optional save field, `mediaDays`.
- The offer is inbox mail stating the dates, the cash and the event(s) he would miss. It never holds the clock and lapses as declined the day before the first away day. `MediaOfferAnswers` (accept, decline) is the minimum the reader needs; **not mounted and not seen in a browser** (the one line to mount it is in `docs/handoff-2.3/MEDIA.md`).
- Accepting books the cash once, on the ledger line "Media day" (new ledger kind `mediaDay`, brand as the reference) on the first away day, and rules the player out of a committed event inside the days through the existing absence system (`pendingUnavailability`, new reason `media`).
- A club is never offered a date that leaves it without three players for one of its events (a starter's seat needs a registered reserve).
- With the locker room on, sending the same player again inside six weeks costs him 6 morale (new reason `mediaFatigue`, shown in the mood mail and his last change; the offer warns about it).
- A bank of 15 fictional brands (parodies) in `copy.career.media.en.ts` / `.pt.ts`, spread into the career copy as `media`; a test checks it against the real names it plays on.

### Changed
- `FEATURES.mediaDays` (staging build or `NEXT_PUBLIC_MEDIA_DAYS=1`). Off: nothing runs and nothing is written; a six-week walk is byte-identical with and without the hook.
- `lockerRoom.ts` gains `nudgeMorale` and the reason `mediaFatigue`; `absenceReasons` and the ledger labels gain `media` / `mediaDay`.

### Balance
- BALANCE_VERSION 55: the new `CAREER_MEDIA` group only; no existing gameplay number moves. The cash is one week of the sponsor tier the reputation reaches (`tierValuePerWeek`) x 0.8 / 1 / 1.2 for 2 / 3 / 4 days, +/- 15 %. **Not measured in a battery.**

---

## [v2.3.0-dev, front LOCKER] — 2026-11-27 · The locker room: player morale, talks and promises (branch v23/locker-room, FEATURES.lockerRoom, staging only)

### Added
- Morale 0–100 per contracted player of the user's club, read as five moods (R190–R194, `engine/career/lockerRoom.ts`, tunables in `config/balance.lockerRoom.ts` as `CAREER_LOCKER`). One optional save field, `lockerRoom`; a save without it reads as neutral; AI clubs have none.
- Drivers: events sat out (a talk after three in a row for a player who expects to start), playing again, a title or a deep run, a losing run, being listed, a refused AI bid (a talk), promises kept or broken. Every change is logged with its reason; a change of mood is a mail that names it.
- Talks in the inbox with two or three answers (`LockerTalkAnswers`, the minimum the reader needed; not seen in a browser). Unanswered for a week, a talk closes itself with the neutral answer; talks never hold the clock.
- Promises `minutes` (starts 3 of the next 4 events) and `stay` (not sold or listed before the window closes), settled by the game; the manager's word scales how much a new promise calms.
- Transfer request after four weeks of low morale (sell, promise, refuse); an agreed sale lists him at his value.
- Training gain × 0.94–1.06 from morale (raw gain only, never a decline); a match-performance effect exists at 0 and is not wired.
- Takeover hooks `lockerIssuesOf` and `seedInheritedLockerRoom` (exported and tested, not wired).
- Strings in `copy.career.locker.en.ts` / `.pt.ts`, spread into the career copy as `locker`.

### Changed
- `FEATURES.lockerRoom` (staging build or `NEXT_PUBLIC_LOCKER_ROOM=1`). Off: nothing runs and nothing is written; a six-week walk is byte-identical with and without the hook.

## [Unreleased, front ERA] — 2026-11-27 · A career can start at any era; the takeover starts in RLCS 2027 (branch v22/era-2027)

## [2.2.0-rc.7] — 2026-11-27 · Take over an organisation in RLCS 2027, under the board's mandate (staging)

Miguel on rc.6 (27/11): the takeover started in 2020 with few orgs and not the ones people want, it reused the founded club's progression, and it let the player choose his goals. This rc is the second pass, stages 1 and 2 of `docs/handoff-2.2/ORGMODE-2027-SPEC.md`: the two fronts below (ERA, MANDATE), merged with the share kit, plus what the integration's browser pass found. Founding a club is unchanged. BALANCE_VERSION 55. Decisions R173 to R180.

### Changed (integration)
- **A real player's decline never starts before 24 to 27 in a 2027 world** (R180, `lateArcPeakOf`, `CAREER_ERA.longCareers.declineFromAgeWeights`).
- **The mandate asks for a signing only when it would improve the three.** With every starter at or over the tier's capped bar the board asks to keep the core.
- **A takeover adds no generic team where the region stays at its floor without the org** (EU and NA in RLCS 2027).
- **The sponsor's deal is a house problem only 56 days from its end** (`issues.sponsorEndingDays`).
- The pick screen names the season ("as they stand in RLCS 2027") and no longer promises three plans under the mandate.

### Fixed
- **Stars of 21 to 23 began RLCS 2027 "in decline".** Root cause: a real player's arc dates his peak by his best dataset card; with the dataset ending at the start, that is only his latest card, and R175 took every real player off his cards. 19 of the 36 real players rated 88+ started past their plateau.
- **Gentle Mates (96 / 95 / 94) was asked to "sign a starter of 93 or better".** Root cause: at high demand the default squad goal was a signing, and the bar's cap per tier sat under the weakest starter.
- **A takeover in Europe put a generic team in the taken org's seat** although the region has 24 real orgs. Root cause: `takeOrgSeat` always refilled the seat, a rule written for regions of exactly 16.
- **The sponsor signed on day one showed as "the sponsorship is ending".** Root cause: the issue compared seasons only, and a one-season deal ends in the season it is signed.
- **The owner's welcome said "played 1 seasons, the first in RLCS 2027".** Root cause: one sentence for every count; an org with one season now reads "new to the RLCS".

### Measured
- Suite green; `P1_SOFT` 0 findings (a 2027 takeover in NA, EU, SAM and MENA, autopilot and tuned, 7 seasons; founded SAM and NA, 7 seasons); `BOARD_SOFT` 2 / 2 at 2020 and at 2027.
- The fronts' own numbers (below and in their handoffs) predate the integration changes.

### Not verified
- The R175 shares (active after 3, 6, 8 seasons; real players in the top 30) and the mandate's met rates were not re-measured after R180 and the signing-goal change.
- The economy of a 2027 takeover (elite and contender end season 3 near $2M; money reads the era, R174) and the takeover's title chances in the stronger 2027 world.
- `?era=N` exists only in the staging build (not seen on the dev server); the review and the season-2 pop-up in a played game; a physical phone, Safari.

## [2.2.0-rc.7 · front MANDATE] — 2026-11-27 · The board's mandate

Miguel's brief of 27/11: taking over an org, the player does not choose his goals; he is told the demand level and receives one pop-up with his goals and what he gains or loses, money, signings and classification, by mail too, with a welcome mail. Spec: `docs/handoff-2.2/ORGMODE-2027-SPEC.md` (stage 2). Handoff: `ORGMODE-2027-MANDATE.md`. Decisions R177 to R179. BALANCE_VERSION 54.

### Added
- **The board's mandate** (R177). An established org's season opens with three goals the board sets: classification (the tier's Expected objective, aimed by the demand level), money and squad (read from the org's problems). Each states what meeting it gives and what missing it costs (confidence, next season's budget, a bonus); the review settles all three. The founded club keeps its three plans.
- **The house's problems** (R178). `orgIssuesOf` reads the org as it is (a starter's deal ending, wages at the ceiling, short cash, a weak link, an old core, chemistry, no coach, no reserve, a costly bench, a benched prospect, the sponsor) and the dossier shows them with the demand level (low, medium, high) before the takeover.
- **The pop-up.** After the arrival screen and at every new season: the org, the demand as a figure, the three goals with their terms, last season's verdicts and the board's brief, one action. Portal on `<body>`, no close; the sponsor desk opens after it.
- **Mail.** The owner's welcome (the org's own RLCS history), the mandate, a report on the three goals at weeks 11 and 21, the verdict on the three at the review.
- **Screens.** `/career/board`: the classification object, the money and squad goals with today's figures, what needs fixing now. HQ's season-goal block: the money and squad goals under the classification rows. The season review's verdict: the three goals, the count met.

### Changed
- An established org's season has one package (the mandate's classification goal) and no secondary or legacy ask. `chooseBoardPackageFlow` with any id reads the mandate there.
- The competent bot (`tuned`) works the mandate (R179); every bot reads it, so none stops on it.
- After the merge with the 2027 start (front ERA): the board's dates read the career season or the year ("Season 3", "S1 · W3", "RLCS 2027"), not the era index; the signing bar is capped per tier; "no sponsor" is not a problem in the board's first week.

### Balance
- `CAREER_BOARD.mandate` (demand, terms, issue thresholds, the money and squad goals' figures). BALANCE_VERSION 53 → 54.

## [2.2.0-rc.7 · front ERA] — 2026-11-27 · A career can start at any era; the takeover starts in RLCS 2027

### Added
- Start era (R173): `startSeasonIndex` on the save (optional), `eraStart` on the world, `engine/career/era.ts` (`careerSeasonOf`, `clampStartEra`, `retirementTableOf`, `takeoverStartEraFor`).
- The world at an era (R174): `buildWorldAtCreation(seed, era)` from that season's lineups, returning orgs before fillers (`returningFrom`), free agents from the three seasons before (club cards and subs).
- Real players past the dataset (R175, last era only): projected potential for players of 21 or younger, every real player developing off his cards, retirement 26 to 32.
- The takeover pick builds the 2027 world; `?era=N` on the staging build; a returning org says so in the dossier (EN, PT).
- Probes: `P1_SOFT_ERA` / `P1_SOFT_PICK` (soft-lock probe from a takeover), `BOARD_SOFT_ERA`.

### Changed
- Progress rules read the career season, not the index: the founding day, the first bid-free window, the novice unavailability guard and the no-reserve grace, the debut grade grace, the early regional ramp (R143), the saves notice, the delete confirm. A founded career is bit-identical.
- The board and the manager start at the clock's season (was a literal 0).

### Balance
- BALANCE_VERSION 53: new `CAREER_ERA` group only; founded numbers unchanged.

## [2.2.0-dev] — 2026-11-27 · Share kit: share a run, a career, invite friends (staging)

Miguel's brief of 27/11: more ways to spread the game (share a run, share a Road to Worlds career, invite friends, play with a friend) and share images and texts that look better and make people want to post them. Spec in code: `src/lib/share/`, `src/components/share/`, `src/components/career/share/`.

### Added
- **One share sheet for every surface** (`ShareSheet`): the image in two formats, **Post** (1200 × 630, for X, Discord, WhatsApp, Reddit) and **Story** (1080 × 1920, for Instagram, TikTok and WhatsApp status), drawn on open; the system share sheet with the image attached (phones), WhatsApp, X, Reddit and Telegram links, copy image (paste into Discord), copy text and link, download. The text that goes with the post is shown before it leaves.
- **New run image.** Drawn in the game's own material (DESIGN.md): the placement on the paper slab, one sentence on how the run went ("Undefeated", "Out to Vitality (2-4) in the Grand Final"), the road through the bracket as a square per series, three figures (team OVR, chemistry, Swiss record) and the drafted roster as the game's cards (rarity frames, special photos, flags, org crests). A title run gets the gold frame. Works for Classic, Quick, the Daily (its number on the image, a square grid in the post) and a duel run (the post carries the duel link, so the friend plays the same draft).
- **Share a Road to Worlds career.** "Share career" on the Club screen and at the season review, "Share the title" on the event screen after a title. The card: the crest and the club's name, the manager, region and season, the headline on the slab (World champions, Major champions...), the trophy shelf (Worlds in trophy gold) and the starting three as cards wearing the club's crest. A club that has won the Worlds gets the gold frame. The link opens the career landing page.
- **"With friends" on the Home**: a friend duel in one click (Classic, the last difficulty and overall setting, a fresh seed; the link goes out from the results) and "Invite friends" (the game's pitch and link, no account needed).
- **Ambassador**, a new title (uncommon): earned the first time something leaves the game through a share sheet, any channel. Stored as the profile mark `share-first` (the run marks' list, synced with the account), so no new save field. Proposal for a "Party Leader" banner (5 friends brought to play) waits on Miguel's art (PENDING-COSMETICS.md).
- **Friends brought to play, counted on the server** (Miguel's choice, 27/11). A signed-in player's share links carry a code (`?ref=`); a browser that lands with it, had never played there, and finishes its first draft run (a duel too) or career event sends one claim; the server keeps one claim per browser, never the code's own account, at most five a day per code (`docs/sql/v2.2-referrals.sql`: two tables, three functions, Miguel applies it in production). The Home's "Bring your friends" shows the count; at 5 the profile gets the mark `share-friends-5`, which the Party Leader banner will read once its art is in. A signed-out player sees "Sign in and every friend who plays through your links counts for you" in the share sheet. New event `referral_claimed`; the privacy page has an "Invite links" section. Nothing of it runs on staging (accounts off there).
- Analytics: `content_shared` (critical) with `surface` (run, daily, duel, career, invite), `channel` and `format`. Share links go to rocketdraft.app with `utm_medium=share` and `utm_campaign=<surface>`.

### Changed
- The old share preview (Rajdhani canvas, X and download only) is gone with `lib/shareCard.ts`; the run's Share button opens the new sheet.
- Share posts rewritten (EN and PT): they say what happened and end on a challenge ("Think you can beat it?", "Your turn:").

---

## [2.2.0-dev] — 2026-11-27 · Majors and Worlds in their season's format (branch `v22/event-formats`, on staging with the 27/11 integration)

Miguel's document of 27/11 ("Formatos dos Majors e Worlds no Road to Worlds"): each season's three Majors share a format and the Worlds has its own, as in the RLCS of that season. Spec: `docs/handoff-2.2/FORMATS-SPEC.md`. Decision R210. Behind `FEATURES.eventFormats` (staging build only; `NEXT_PUBLIC_EVENT_FORMATS=1` for probes); off, every official event is the classic Swiss into the 8-team double elimination, byte for byte.

### Added
- **Six season rows** (`CAREER_EVENT_LAYOUTS`): Season X Majors Swiss → top-8 knockout; 2021-22 Majors 16-team double elimination, Worlds 2 double-elimination groups of 8 → top-8 knockout; 2022-23 Majors 4 groups of 4 → 12-team knockout (group winners to the quarterfinals), Worlds as 2021-22; 2024 Majors Swiss → top-8 knockout, Worlds Swiss → 8-team hybrid; 2025 Majors Swiss → 8-team hybrid, Worlds 2 groups of 8 → 8-team hybrid; 2026 Majors 4 groups of 4 → 8-team hybrid, Worlds 4 groups of 4 → 12-team hybrid. Season X's Worlds stays cancelled. From 2027 the seasons rotate through the six rows (2027 = Season X's row, its Worlds played).
- **Engine** (`engine/eventLayouts.ts`, new branches in `playoffs.ts` / `tournament.ts`): group stages kept in the Swiss state (`kind`, `groups`; the draw is by rating pots, regions apart where possible), five career-only brackets with their pairings, eliminations and placements, the new placement `top12` (9th-12th). The Draft paths are untouched (golden master bit-exact). An event keeps the shape it started with; no save version change.
- **Screens**: the lobby's format line and two rule lines (Saturday, Sunday), the weekend strip named by stage, group tables in the standings, the brackets drawn per shape (upper / lower rows, the hybrid quarterfinal under the lower bracket), the Saturday panel with the side the user starts Sunday on ("Upper bracket", "Bye to the quarterfinals") and, for the 16-team double elimination, Saturday's bracket and the last eight with their bracket records; "Group stage exit" where a Swiss exit was; follow mode records the groups. EN and PT.

### Balance
- **Same total per event** (FORMATS-SPEC §4): a bracket redistributes the classic event's points and prize pool over its own placements (the mean of the ranks each covers; 9th-12th get 1/6 above, 13th-16th 1/6 below the classic 9th-16th value). A Major's points: 3rd-4th 470 when they are shared, 5th-8th 280, 9th-12th 140, 13th-16th 100. BALANCE_VERSION 53 on its branch, 57 after the integration with v2.3. Title odds per shape are not measured yet.

---

## [2.2.0-rc.6] — 2026-11-27 · The established organisation: its own rules, its own screens (staging)

Miguel's brief of 27/11: taking over a real organisation has to read as a consolidated org, with its own goals, budget, progression and screens, not as the founded club's ladder. Spec and handoffs: `docs/handoff-2.2/ORGMODE-*.md`. What to play and what Miguel decides: `docs/V2.2-STATUS.md`. Decisions R163 to R172, DESIGN-DECISIONS #187 to #201.

### Added
- **The way in.** `/career/new` opens on two cards side by side, "Found a club" and "Take over an organization", each with its art, three facts and its action. The pick is a list of the region's orgs by tier with a dossier of the selected one: the three starters as the game's own cards, the coach, what you inherit (cash, season budget, wages against the ceiling, installations, retained staff) and what the board expects. An arrival screen follows the takeover. The Pro door is off this screen (`/career/pro/new` stays reachable by address on staging).
- **Standing** (R163, R167). In an established org the reputation number is the org's Standing on four tiers (Underdog, Mid-table, Contender, Elite). Nothing is locked behind it. The tier sets the signing pull (players up to 86 / 90 / 95 / 99) and can change at the season review: a promotion needs the standing above the tier's line (35 / 50 / 85) and the season's objective met; a tier is lost under its floor (18 / 28 / 40). A change moves the budget base and the wage ceiling (up 20 %, down 10 %), with a board mail and a news line.
- **Operations** (R164). Installations, staff and bootcamps are all on the shelf from day one, by department. The org arrives with what its tier owns (elite: three installations, analyst and psychologist; contender: two and the analyst; mid: one and the assistant; underdog: none). The board signs off capital projects: an installation needs confidence 50, the performance centre 65, none during a hiring freeze. Finances and the HQ show operations in place of the unlock ladder.
- **The season budget as a plan** (R165, R169, R170). Finances opens on the board's budget: one bar of the season's money split into spent, committed and free, the lines by department, income received and contracted, the projection for the season's end, the wage bill against the ceiling. `seasonBudgetOf` and `operationsOf` are pure views (`engine/career/budget.ts`, `established.ts`).
- **The board's screens.** The season plan is three cards with the board's proposal marked, each with its objective as a sentence ("top 4 at 2 of the 3 Majors"), its band in words, budget, bonus and confidence at stake, under the board's brief (why it asks this, from last season). `/career/board` is rebuilt around the season's objective, with confidence and its log, the standing track, the manager and the season's money. The season review shows the verdict, a tier change, a dismissal with its offers as org rows, an approach.
- **A sponsor from day one** (R168): an established org's sponsor desk opens when the season plan is accepted, at its own sponsor level.

### Changed
- **The budget is the org's** (R165): fixed at the takeover and moved by the tier and the board's confidence; it no longer follows the current wage bill, so cutting wages does not cut next season's budget.
- **Objectives by tier** (R166): a tier is asked for its own competitions (elite: Majors and Worlds; contender: Major qualification and finishes; mid: Major qualification and regional finishes; underdog: regional finishes). An established org is never asked for a Community Cup or for more than 5 regionals, and the three plans are always three different goals in order of difficulty.
- **Permanent career achievements belong to the founded road** (R171, Miguel decides the final rule): a career in an established org earns none of them (taking over an elite org gave "reach 50 reputation" at once). A manager dismissed into a founded club earns them there, counted from the founding. Titles, the trophy room and Season XP from results are untouched.
- Wording: in an established org every screen says Standing (PT "Prestígio") where the founded club says reputation; the manager's own reputation keeps its name.

### Balance
- **BALANCE_VERSION 52.** The board's stated chances refitted on the new rules (90 competent careers × 6 seasons, seeds 9000, 12000, 12101; each season keyed by the tier the board held in it). Held out (seeds 30000 and 30101, 120 careers), Expected, stated → measured: Normal elite 56 → 43, contender 53 → 72, mid 58 → 58, underdog 63 → 65, founded 69 → 81; Hard 44 → 57, 55 → 41, 58 → 73, 62 → 27, 59 → 58. Bands over the three plans: same band 69 %, a neighbouring band 29 %, two or more away 3 % (rc.5: 65 / 34 / 1). Competent dismissals 0 in 60; careless 11 in 60, in seasons 4 to 6.
- Tier changes, competent bot, 6 careers a cell: contender to elite 6/6 Normal and 5/6 Hard (seasons 2 to 4); mid to contender 5/6 and 5/6; underdog to mid 6/6 and 3/6. No relegation in 120 careers.
- **Held out again on the shipped rules** (after the day-one sponsor and the budget change; same seeds 30000 and 30101, 120 careers, no soft lock), Expected, stated → measured: Normal elite 55 → 51, contender 53 → 63, mid 59 → 44, underdog 65 → 92 (N 12: an underdog leaves its tier by season 2), founded 69 → 81; Hard 44 → 52, 55 → 48, 57 → 57, 62 → 45, 59 → 58. Bands: same 73 %, neighbouring 27 %, two or more away 1 % (N 1080). Competent dismissals 3 in 60 (mid Normal in season 6, elite Hard in season 4, contender Hard in season 6); careless 15 in 60, seasons 4 to 6. Tier: contender to elite 6/6 and 5/6 (seasons 2 to 3), mid promoted in 4/6 and 4/6, underdog in 6/6 and 4/6 (two of six Normal underdogs end season 6 as elite); no relegation. Season-6 cash, competent, median Normal / Hard: elite $627k / $509k, contender $398k / $131k, mid $520k / $79k, underdog $83k / $47k, founded $69k / $34k.
- **Elite budget 16 → 22 weeks**, and every tier's weeks now multiply the whole running bill (staff and upkeep included): with the Expected plan the budget and the starting cash cover the season's committed costs for every org of NA, EU and SAM before any sponsor income (smallest margin: elite $13k, contender $5k, mid $6k, underdog $2k). Before, an elite org opened its first day $47k to $264k short.

### Fixed
- **A takeover's squad cards showed a procedural crest** instead of the org's logo. Root cause: a takeover stores a procedural crest in `identity.crestId`, and four screens (HQ squad cards, Club, the top bar, Saves) drew it directly instead of going through `OrgMark`. One component (`UserOrgMark`) now draws the player's mark everywhere; a test fails if a screen draws the crest directly.
- **"Win 2 Majors" read "Win a Major"** on the HQ's stretch goal (EN and PT, founded clubs too). Root cause: `C.goals.season` returned from its first-place branch before reading the count.
- `/career/new?start=quick` stayed on the door when the takeover was on.
- The board's brief never showed: the first helper read `brief.kind`, the engine writes `brief.reason`.

### Not verified
- The competent bot is dismissed 3 times in 60 careers on the shipped rules, against 0 in 60 before round 2, all three in SAM. Three cases do not say whether round 2 caused it, nor whether SAM is an effect or chance; not investigated.
- Season-6 cash is lower than in the run before round 2 in all 8 established cells (contender Normal $782k → $398k, mid Normal $710k → $520k), although the elite budget grew. The cause is not established (candidates: fines from the day-one sponsor deal, the cap on non-earned income, the bot spending more); a ledger probe on one elite and one mid career would settle it.
- Three cells are 15 points or more off on the shipped rules: underdog Normal (easier: 92 % against 65 %, N 12), underdog Hard (harder: 45 % against 62 %, N 22) and mid Normal (harder: 44 % against 59 %, N 32). The calibration was fitted before round 2 and not refitted after it. Easy has no cells.
- No relegation has happened in any probe (unit and flow tests only). The sponsor desk after a job-offer move and the achievement baseline after a dismissal are covered by code paths and pure tests, not by a played career.
- Browser: the hiring-freeze state, the season review in PT, a relegation, an accepted job offer, the board flag off. No physical phone, no Safari.
- The established economy ends season 6 with cash to spare on Normal (median: elite $627k, mid $520k, contender $398k, mostly prizes) and much less on Hard (mid $79k, underdog $47k): whether that leaves the budget a real constraint is Miguel's call at the gate.

---

## [2.2.0-rc.5] — 2026-11-26 · The gate candidate: board objectives in bands that hold, the final browser pass, decisions R151 to R162 (staging)

What to play, the numbers and what Miguel decides: `docs/V2.2-STATUS.md`.

### Changed
- **A board objective shows a band in words, not a percentage** (R154): Likely (65 % or more), Within reach (45 to 65 %), A stretch (25 to 45 %), A long shot (under 25 %), on the package choice, the Board page and the checkpoint and ultimatum mail, EN and PT.
- **The stated chance of a board objective is that goal's measured record** for clubs of its stature and difficulty, blended toward the calibrated model (`CAREER_BOARD.goalRates`, `goalRatesK` 8). The raw model misjudged by stature and a single shift did not hold on new seeds.
- Pro: the prologue line shows the overall with one decimal (the call threshold is 50.8); the season review's Continue is docked on a phone; the hub's tabs fit at 320 px.

### Balance
- **BALANCE_VERSION 51.** Board objectives, held out (seeds not used in the fit; 120 careers, competent bot on the expected package; N 35 to 36 career-seasons a cell), stated → measured: Normal elite 52 → 61, contender 52 → 44, mid-table 60 → 61, underdog 63 → 92, founded 70 → 61; Hard 52 → 43, 55 → 69, 58 → 61, 62 → 50, 65 → 58. Eight of ten cells within 12 points; over 1077 objectives the measured rate is in the stated band 65 % of the time, in a neighbouring band 34 %, two or more away 1 %. Cautious is easier than Ambitious in every cell (61 to 100 % against 28 to 64 %).
- Dismissals in six seasons (30 careers a row): competent 1 on Normal and 1 on Hard; careless 7 and 9, in seasons 4 to 6. No soft lock in the 120 careers.

### Added
- Decisions R151 to R162 (`ROAD-TO-WORLDS-DECISIONS.md`), #186 (`DESIGN-DECISIONS.md`), `docs/V2.2-STATUS.md`, `PRO-SPEC.md` §15, the career status and its system map.
- `proRegion.test.ts`: two Pros on one seed, NA and EU, each in his own region's scene (the probe's matching NA and EU lines were one seed's 99-rated talent winning every regional in both regions, not a region bug; the probe's seeds now differ by region).

### Not verified
- Out of band and left for the gate: an underdog on Normal meets its expected objective 92 % of the time against 63 % stated; careless managers are dismissed late and seldom at mid-table and underdog clubs; Easy has no calibration cells; season 1 alone has N 6 a cell.
- Pro pacing by hand (375 px, PT): first amateur invite at week 9 after 6 taps, first match at 8 taps, but about 68 taps for the first season and about 154 to the first organisation offer (season 3, age 15, a rotation role). There is no "play the whole season on the coach's plan".
- Known, not fixed: the Pro card lists amateur sides among his organisations; the hub shows the energy twice under a burnout warning; on an event page at 375 px a long event name hides the date in the top bar (shared screen); the top-bar "Start Sunday" does nothing on the HQ.
- Not opened in a browser: the rotation-to-starter moment, an unsolicited approach, the checkpoint and ultimatum mails as rendered, signing a player in the manager regression walk (the market was closed), the new filler names. No physical phone, no Safari.
- The Pro items of rc.4 (Worlds reached by 92 % of average careers, the high-talent plateau).

---

## [2.2.0-rc.4] — 2026-11-26 · The Pro calibrated on the real flow, and the polish from the browser pass (staging)

### Changed
- **Pro: Continue plays the coach's plan by itself** once the first week's plan has been confirmed. It stops for every real event (an offer or invite, an offer about to expire, the burnout warning, his matchday, a contract ending, the season's end, a rank up, a new mechanic) and at least every four weeks with a one-line digest. Planning week by week is a choice remembered per save.
- **Pro: the prologue says what brings the first call** (the rank or overall an amateur side looks for, and where he stands); a rank up is a notice on Today.
- **Pro: a season-end screen** (his season line, why each attribute moved, the gala with its winners and his place), shown once at the rollover and reachable from the history; **a goodbye screen** at retirement, a confirm for retiring by choice, a warning in his last season.
- **Pro card**: titles ordered Worlds, Majors, regionals, the rest, then recency, repeats collapsed; the career keeps 120 titles (40 dropped early Worlds).
- Numbers say what they are (attribute points, confidence on match ratings, what burnout costs).
- **Filler organisations** created with the endless front on take a second word instead of a number ("Team Carnaval United"); flag off, nothing changes.
- Real-organisation wizard: its own title; the squad rank counts what the list shows.
- A sponsor offer no longer opens over the board's package decision; the new-mail toast hides while a dialog is open.

### Balance
- **BALANCE_VERSION 50.** Pro on the real flow (bots, 13 to 29, NA/EU/SAM, talent fixed at 0.82 / 1.0 / 1.2; N 12 for the average managed profile on Normal and on Hard, 6 for the others):

  | Profile | Peak (median, range) | Peak age | Worlds played / won |
  |---|---|---|---|
  | average, managed | 92.1 (90.6 to 93.7) | 22.5 | 92 % / 8 % |
  | average, managed, Hard | 92.0 | 24 | 83 % / 0 % |
  | high, managed | 97.2 (96.1 to 99) | 24 | 100 % / 33 % |
  | low, managed | 85.3 | 21 | 33 % / 0 % |
  | average, careless | 82.2 | 25 | 67 % / 0 % |

  First organisation at 15 (14 to 15 for a high talent); rotation to starter in 83 % of average managed careers; first amateur invite in weeks 6 to 10 of the first season (it was week 26); a new amateur side wins 43 % of its first-season cups (about 31 %).
- Cause of the earlier drift from the pure-module calibration: a starter plays 60 to 100 official series a season on the real calendar, so match XP was 64 to 71 % of all growth. A season's series now teach at the full rate up to `matchXpFullSeries` × talent², then less with each one. Values: `CAREER_PRO.growth.afterPeak` 0.03 → 0.01; `CAREER_PRO_TEAM.inviteOverall` 54 → 50.8, `firstInviteWeek` 3 → 6, new `matchXpFullSeries` 25, `matchXpTalentExp` 2, `inviteAfterWeeks` 20, `localAnchorEdge` 1.5; new `CAREER_PRO_ORG.byDifficulty` (starter margin 0 / 1 / 3, rotation one event in 2 / 3 / 4); new `CAREER_PRO_PLAN.digestWeeks` 4.

### Fixed
- `endless.projects` kept last season's record beside this season's for an organisation that continued its project. One record per organisation.
- The organisation on the Pro's seat keeps its coach, and its Majors and Worlds go back under its own name when it leaves the seat (the world's champion record read "user").

### Verified
- Full suite: 3203 passed, 0 failed (62 opt-in probes skipped). Typecheck clean.
- With every staging flag on together (world life, the three Matchday flags, endless variety, board, real-organisation start, Pro), each run alone: the Pro whole-career probe (NA, EU, SAM Normal and NA Hard, 13 to retirement at 30 to 31: no throw, no stuck day, every season closed, the card round-trips); the manager soft-lock probe in full (14 careers, 7 regions, 7 seasons, 0 findings); the board's takeover, dismissal and job-offer check (2 of 2).
- To look at: the probe's NA and EU Normal runs returned the same career line (same seed, peak 99.0 at 25, 10 Worlds, 32 titles), so the region may not reach the Pro in that probe; if the battery shares it, its EU cells repeat NA.

### Not verified
- **Out of band, left as is for Miguel to judge:** 92 % of average managed Pro careers play a Worlds at least once (the spec said about 40 %; a 90+ player lifts any side into the field, and how much one player moves a team is engine-wide); a high talent holds 98 to 99 until 25 to 28 instead of declining from 24; regional titles run about 13 a career for the average managed profile.
- The battery ran without the board and real-organisation flags; the all-flags run (NA, EU, SAM, Normal, 13 to retirement: no throw, no stuck day) used the numbers before the last low-talent adjustment.
- Whether rival projects answer a dynasty of the Pro's own organisation: not observed.
- Emptiest stretches of a Pro career, by the battery: rotation seasons at 15 to 17 (31 series a season, mostly from the bench), amateur seasons (63 series of the same cups), a starter from 22 on (74 series a season, most seasons without a title).
- The new screens at 320 px, desktop width and in PT; retire-by-choice; the sponsor / board ordering in a browser; a card download after the title change.
- The board's stated chances, as in rc.2.

---

## [2.2.0-rc.3] — 2026-11-26 · Hotfix: the Pro career did not advance on rc.2, plus the browser pass on the new screens (staging)

### Fixed
- **On rc.2 a Pro career did not advance a single day**: every Continue or "play the coach's plan" tap did nothing. Root cause: the Pro's world runs on a hidden manager save (the host); with `FEATURES.board` on, that host received the board's season package decision, which holds the clock, and `settleHost` did not answer it. The Pro tests ran without the board flag and the integration ran the manager's soft-lock probe only, so nothing caught it after the fronts were merged. The board is now fully inert on the host (`CareerSave.proHost`, set at creation: no board, no manager record, no package, checkpoint, ultimatum, dismissal or offers), a rival project can never bid for the host's players, `settleHost` strips a board from a host made on rc.2 and parks any decision kind it does not know. Regression: `proAllFlags.test.ts`, with every staging flag on.
- Board page: the confidence figure wrapped onto two lines at 375 px and the log's reasons were cut.
- The season review now shows the board's verdict in a panel (objective met or missed, confidence, a link to the board); it only arrived as a mail.
- Pro match: the series screen is the series alone, with a docked bar (on instinct, sim the rest of the series), a legend on the decision card, locked options that say why, and a result line that says what the choice gave or cost.
- Pro card image: the legend line ran into the footer and lists were cut mid-row.

### Verified
- A browser pass (desktop browser at 375 px, partly 320 px and desktop width, PT and partly EN) of the real-organisation wizard, the board's package choice and page, a full first season at an underdog, and by generated saves an ultimatum, a dismissal with offers, accepting one and arriving, an endless season 8 with rival projects and a Legends Invitational played to a title; and of the Pro from creation to retirement and the card. No physical phone, no Safari.
- Integration now runs the manager soft-lock probe and the Pro whole-career probe with every staging flag on together.

### Not verified
- Known and in progress: the first amateur invite comes around week 26 of the Pro's first season (about 25 identical weekly taps); gala and retirement have no screen of their own; the card keeps the first ten titles in date order; filler organisations in the endless seasons carry a number in their name; a sponsor offer can open over the board's decision on arrival at a club; the top-bar "Start Sunday" button does nothing on the HQ itself.
- Not opened in a browser: an unsolicited approach, the takeover wizard in EN and at 320 px, the board-funded upgrade, Hard.
- The board's stated chances and the Pro calibration, as in rc.2.

---

## [2.2.0-rc.2] — 2026-11-26 · The big update, complete in function: real organisations and the board, endless round 2, the Pro career (staging)

Branch `release/v2.2`: rc.1 plus the board front, the second endless round and one Matchday fix. Everything new sits behind its flag, on in the staging build only. Handoffs with every tunable, measurement and decision (to be numbered at the final integration): `docs/handoff-2.2/` (BOARD, endless, PROSPINE, proengine, proqa).

### Added
- **Start at a real organisation** (`FEATURES.realOrgStart`): the wizard's second door. Region, organisation, difficulty, manager name. Each organisation shows its stature (elite, contender, mid-table, underdog), squad rank, cash, season budget beside the wage bill, expected finish and its grace season. The user takes the organisation's seat; its place in the world goes to a filler side, and the players the dataset later sends there stay where they are.
- **The board** (`FEATURES.board`), for real organisations and for founded clubs (the owners): three packages each season (cautious, expected, ambitious; expected preselected, the offer fixed once shown), a sporting objective that becomes the season goal, a secondary objective, legacy objectives after a title; a confidence meter with every change logged and its reason, checkpoints at weeks 11 and 21; budget rises, a contract extension and one board-funded upgrade at high confidence; a budget cut, a one-window hiring freeze, a warning, an ultimatum and then dismissal at low confidence. No ultimatum in a real organisation's first board season or an owners' board's first two.
- **Manager reputation and job offers**: dismissal never ends the save: up to three offers (one always in the home region) plus founding a new club; a strong record brings an approach from a bigger organisation; the club left behind lives on in the world with the squad the user built.
- **Endless, round 2** (`FEATURES.endlessVariety`): rival projects now use the user's own toolbox (facilities, the region's best coach, a bench sub, a bootcamp, a psychologist), each item named in the news and on the organisation's sheet; the answer scales with consecutive Worlds titles and resets when the dynasty is broken; new elite promotions arrive a little stronger during a long dynasty; a project may bid for one of the user's starters (refusable, one a window).

### Balance
- **BALANCE_VERSION 49**: `CAREER_BOARD` (with a calibration layer for board objectives by stature and difficulty), `CAREER_ENDLESS` round 2.
- Endless, measured (bots, Normal, NA/EU/SAM × 2 seeds, a squad floored at 97 to 99 overall): Worlds won by a 100+ team 91 % → 64 % pooled; Major and Worlds series won 96 % → 87 to 88 %; AI sides within 3 points 0.8 to 1.2 → 2.2 to 2.7 (the target of 3 is missed). The ordinary bot's seasons 1 to 6 are unchanged apart from cup results.

### Fixed
- **A sold founder stopped resolving after the next season rollover**, and his buyer fielded a stand-in. Root cause: `agePassAndIntake` rebuilt the world without `formerSquad`. Fixed in every build; the two flag-off digest tests were refreshed for it.
- **Matchday in custom mode could stop an event from advancing** in a double-elimination round where the user's side has no series (on staging since rc.3). Root cause: `userHasPendingSeries` stays true while the user's bracket waits, so `userSeriesGate` opened a series that `openUserSeriesOn` could not pair. The gate now plays the round on when there is no pairing; regression test `careerMatchdayIdleRound.test.ts`.
- The two flag-off digest tests hashed the save's `createdAtAppVersion`, so a version bump failed them. They now pin that one field.

### Verified
- Full suite on the merged branch: 3192 passed, 0 failed (59 opt-in probes skipped). Typecheck clean.
- Soft-lock probe in full, run alone, every staging flag on (world life, the three Matchday flags, endless variety, board, real-organisation start, Pro): 14 careers (7 regions × autopilot and tuned, Normal, 7 seasons each, founded clubs), 0 findings. The takeover, dismissal and job-offer paths are covered by the board's own opt-in check (`BOARD_SOFT=1`), not by this probe.
- With every new flag off a fixed-seed career is byte-identical to the base plus the `formerSquad` fix (two digest tests).

### Not verified
- **Board objectives' stated chances are not yet honest enough.** On a held-out seed (15 careers): Expected stated 63 % and hit 47 % on Normal (N 42), stated 59 % and hit 70 % on Hard (N 30); founded clubs N 6. Cautious is clearly easier than Ambitious (77 % against 33 %). Dismissals on the final config: competent 0 of 15 careers, careless 1 of 13; the larger round-1 sample (older config) had careless 9 of 12 dismissed in seasons 3 to 6. A serial multi-seed battery is still owed.
- **Pro is not calibrated on the real flow** (peaks of 94 to 99 at 27 to 28 and 10 to 22 titles on Normal in four bot runs). The battery is written and not run.
- No board, real-organisation or endless screen has been opened in a browser; the Pro's match decisions, gala, retirement and card with honours neither. No physical phone, no Safari. PT copy unread by a native speaker.
- Endless: the fifth title defence is unmeasured (dynasties now break earlier, N 4 at three or more titles); the final config with the project bid ran on 3 of 6 careers.

---

## [2.2.0-rc.1] — 2026-11-26 · First staging cut of the big update: the Pro player career, playable to retirement, and the endless seasons' variety (staging)

Branch `release/v2.2`, cut from staging rc.6. Partial on purpose (Miguel asked to play what is ready): the board and real-organisation start, the second endless round and the Pro calibration are still on their branches. Handoffs with every tunable and decision (to be numbered at the final integration): `docs/handoff-2.2/`.

### Added
- **Pro, the player career, slices 2 to 7** (behind `FEATURES.proCareer`, staging only; spec `docs/PRO-SPEC.md`): the week in three blocks with energy, burnout and a coach's plan; ranked with the Draft's ranks; the Pro in the real world and calendar on an amateur side, then offers from real organisations with a role, a reason and one counter-offer; a starting spot decided by the coach, a rotation role that plays one event in three and is reviewed after six series; his side's series played game by game with one decision a game, signature mechanics opening options; match XP; aging with a reason for every change, retirement by age or by choice, the end-of-season gala, nicknames, and a final card on its own page (`/career/pro/card`, payload in the URL hash).
- **Endless variety, round 1** (behind `FEATURES.endlessVariety`, staging only, from the seventh season): rival projects that gather talent when one side pulls away, each announced in the news; Invitationals with a drawn field and bracket; a Legends Invitational against all-time rosters for squads at 93+; an Intercontinental Invitational; host cities announced each season.

### Balance
- **BALANCE_VERSION 48**: the Pro blocks (`CAREER_PRO_*`), the Pro growth recalibration on the pure modules, `CAREER_ENDLESS`.

### Not verified
- Pro on the real flow peaks too high and wins too much on Normal (four whole-career bot runs: peaks 94 to 99 at 27 to 28, 10 to 22 titles; the spec asks 90 to 93 at 20 to 24 for an average talent): the calibration battery is running.
- A 100+ manager team still wins 75 to 88 % of its Worlds with the endless round 1 on (6 careers an arm); round 2 is running.
- Pro screens: played seven seasons in a desktop browser at 320 px, 375 px and desktop width before the playable series existed; the match decisions, the gala, retirement and the card with honours have not been opened in a browser. No physical phone, no Safari. PT copy unread by a native speaker.
- Known on staging since rc.3, fix in progress: with Matchday in custom mode, a double-elimination round where the user's side has no series can stop the event from advancing.
- The full suite was last run on the Pro branch that this cut equals except for this entry and the version (3170 passed); the soft-lock probe was run narrowed (NA and SAM, four seasons, 0 findings), not in full.

---

## [2.1.0-rc.6] — 2026-11-24 · Everything on the staging line together: the phone redesign, the Etapa 1 gate, the Daily's best draft, the friend duel, Pro slice 1 (staging)

Branch `claude/staging-integration`, cut from `origin/staging` rc.5 (`3914518`, the phone redesign, kept whole) with five lines merged in: `main` v2.0.36, the Etapa 1 gate close, `claude/daily-optimal`, `claude/friend-challenge`, `claude/pro-etapa2`. Published to `staging` only; production stays on v2.0.36.

### Changed
- **The Etapa 1 gate closes** (R149, Miguel 24/11): approved after playing rc.4; the four Etapa 1 flags stay on in staging only; Hard EU without a regional final by S5 is accepted; the staging line accumulates stages and `main` moves only when Miguel decides; Etapa 2 = Pro; Draft fronts = friend duel and the Daily's best draft.
- **v2.0.36's career landing** is in the staging build (EN and PT).
- Numbering after the merge: the phone redesign keeps #178–#182 and R148; the Daily is #183, the duel #184, Pro #185 and R150, the gate R149.

### Balance
- **BALANCE_VERSION 47**: the duel's `DUEL` block and Pro's `CAREER_PRO` block, each bumped to 46 on its own branch, together.

### Not verified
- The duel and Daily panels were built on the rc.4 look and now sit under the phone redesign: to check at 375 px. No physical phone, no Safari.

---

## [2.2.0-dev.1] — 2026-11-24 · Pro slice 1: the player and the save (behind `FEATURES.proCareer`, staging only)

Branch `claude/pro-etapa2`, cut from `origin/staging` (`2.1.0-rc.4`). Etapa 2 "Pro", the player career: spec `docs/PRO-SPEC.md`, decisions R150 and DESIGN-DECISIONS #185. Not published; production is unchanged (the flag is off outside the staging build).

### Added
- **Create a player** (`/career/pro/new`): nickname, country and region, start age 13 or 14 (the RLCS minimum since 2024), style (the six archetypes, each leaning to two attributes) and difficulty. The **player card** (`/career/pro/player`): the six attributes, the overall (their mean), no ceiling shown (there is none), and the meters the week will move (energy, fans, money, MMR). The **Pro careers picker** (`/career/pro`), three slots of its own.
- **Engine** `src/engine/career/pro/` (`types`, `create`, `growth`, `attrs`, `world`): a Pro save shares the manager's world, clock and competition types; the player enters the world as `pro:self` (`world.proSelf`, read by `playerViewById`). Training growth: perBlock × hidden talent (×0.85–1.15) × age × distance to 99 × coach × energy, 99 reachable, every change logged (`growthLog`). Numbers in `CAREER_PRO`; `BALANCE_VERSION` 45 → 46.
- **Save** `rocket-draft:pro:v1` (version 1, additive migrate), `store/proStore.ts`; `persistContract.test.ts` gains the line on purpose (#185).
- **Flag** `FEATURES.proCareer` (`STAGING_BUILD || NEXT_PUBLIC_PRO_CAREER=1`), in `stagingFlags.test.ts`. The door: a block on the manager's saves screen and a line under the manager wizard's title.
- Career strings `pro.*`, EN and PT.

### Changed
- `emptyCompetition` moved to `engine/career/competition.ts` (careerFlow keeps exporting it, unchanged).
- `/career/pro` is a bare route in `CareerShell` (no manager guards, no manager top bar).

### Balance
- Training alone (two blocks a week, the weakest attribute first, no match XP yet) from 13 to a peak at 22: talent 0.85 → 84.2, 1.0 → 87.7, 1.15 with a coach of 90 → 93.4. Match XP (slice 3) carries the rest of PRO-SPEC §4.1's targets.

## [Unreleased] — 2026-11-24 · Friend duel: the same draft by link (staging)

Branch `claude/friend-challenge`, cut from `2.1.0-rc.4` (`4ca1c4a`). O2 of PLANO-PROXIMO-NIVEL-2026-11-19 (the social loop; the answer to the rival's multiplayer). No server: everything is resolved in the browser.

### Added
- **Friend duel** (`engine/duel.ts`, DESIGN-DECISIONS #184). A Classic or Quick draft played from a seed carried in a link (`/duel#c=…`): whoever opens it drafts from the same offers and meets the same bracket field, then sees the runs side by side and can send the link back with their result added (up to 6 runs: the first and the latest replies). Entry points: "Challenge a friend" on the setup screen (this setup as a duel) and under a finished Classic / Quick run (the same settings, a new seed). The link holds the draft settings, the balance version and anonymous score lines (placement, Swiss record, playoff wins, games, goals, team OVR), nothing personal; it sits in the URL hash, which never reaches the server.
- **`/duel`**: the landing page of a link (settings, standings, Accept), `noindex`, with its own static share image (`public/landing/duel-share.jpg`, `scripts/build-og-duel.mjs`). A missing, cut, edited (check value), newer-format or undraftable-region link never breaks: it falls back to `/play`'s normal setup with a notice that says why. A link made on another BALANCE_VERSION opens with a warning that the offers may differ.
- **Duel results**: the standings with your run marked, the verdict, Share link (Web Share API) and Copy link (with the link in a field as the last resort), Run it back. A "Duel" tag in the run header.
- **Analytics `friend_duel`** (standard, under the budget guard): `action` opened / invalid / completed / shared, runs in the link, placement, runs beaten / lost to, share method. Never the seed or the link.
- Copy `DUEL_UI`, EN and PT; PT tab title for `/duel`.

### Balance
- **BALANCE_VERSION 46**: new `DUEL` block (the duel's special-card table: the Diamond rarities without national teams, baseline odds; 6 runs per link). No existing value changed.

## [Unreleased] — 2026-11-24 · The Daily reveals its best draft and a percentile (staging)

Branch `claude/daily-optimal`, cut from `2.1.0-rc.4` (`4ca1c4a`). Plan: `docs/PLANO-PROXIMO-NIVEL-2026-11-19.md` §5 (the daily habit). DESIGN-DECISIONS #183.

### Added
- **"Today's best draft" under a finished Daily** (`components/screens/DailyOptimalPanel.tsx`, on the results screen only, so it never spoils a day being drafted). Your roster and the strongest roster the day allowed side by side (OVR, chemistry, team rating, the cards that differ in bold), the gap in rating points, the steps that reach it (picks, rerolls, free rerolls), a percentile, and a share line (native share or copy; numbers only, no roster, so it spoils nothing for friends).
- **`engine/dailyOptimal.ts`**: an exact branch-and-bound over every legal pick, paid reroll and free reroll of the day's seeded draft, scored by the game's own team rating (`buildUserTeam` → `rating.total`); on an Underdog day the best draft is the strongest one at or under the cap. The offer stream is memoised (outside the staff-only end of a draft, the next offer does not depend on the card picked) and the search runs in 10 ms slices on the client. Whole reviewed calendar (365 days, desktop): every day exhaustive, 1.5k-30k states, 105 ms average, 402 ms worst; node budget 400k (`DAILY_INSIGHT` in the engine module: analysis bounds, not gameplay values, so BALANCE_VERSION stays 45).
- **Percentile against 200 simulated drafts** of the day's seed (bots with seeded tastes for overall, chemistry by lineup / country / season / region, rerolls and loose drafting; their choices come from a separate RNG). The copy says "simulated drafts, not real players" next to every number, EN and PT. `ScoreDistribution.source` is `"simulated"` today; a real board plugs in as `"players"` with the same shape and its own copy.
- Event `daily_insight` (standard): `shown` once per Daily, `shared` on the share button; percentile, its source, gap, matched, both overalls, compute time.
- Copy group `DAILY_INSIGHT_UI`, EN and PT.

### Changed
- `startDailyRun` opens the day through `createDailyDraft` (engine), the same calls in the same order, so the solver starts from exactly the state the player sees. What a Daily generates is unchanged: the 365-day replay through the real store (`dailyCalendar.replay.test.ts`) and the challenge replays pass as before.

## [2.1.0-rc.5] — 2026-11-24 · The phone redesign: every screen under 640px (staging)

Branch `design/mobile-redesign` (cut from staging rc.4), merged into `staging`.
Six stages; the five entries under this one are stages 1 to 5 as they were
first drawn. This entry is stage 6 and Miguel's review of stages 3 to 5
(24/11). Rules: `DESIGN.md`, "Phone". Decisions: DESIGN-DECISIONS #178 to
#182, R148. Measurements: `docs/redesign/MOBILE-PLAN.md`. Phone only: from
640px up nothing changes. No engine, store or save change.

### Added
- Career, phone: a way back to the main menu in the career's top bar, always
  on screen.
- HQ, phone: a glance board (`hub/HubGlance`): squad, training, race and
  finances as one figure each, two to a row, and the progression as a line.
  Each cell opens its tab.
- Club, phone: the 22 career achievements show six and a "Show all 22" key
  (`achievements.showAll` / `showLess`, EN and PT).

### Changed
- **HQ on a phone shows only what matters today** (the day, the inbox, the
  glance board, the season goal, the headline and two stories): 2,524px at
  375 x 812, from 6,100px with every block open. The full squad, training,
  race, finance and progression blocks, the transfer wire and the honours are
  read in their tabs. Stage 3's folded sections are gone (Miguel: the closed
  cards do not work; focus on each tab).
- **No folded sections in the career.** Club, Finances, Training and Standings
  show every board open again. Finances puts sponsors, the ledger and the
  loans ahead of the progression ladder; the Club puts the reputation ahead
  of the achievements.
- **Challenges are a grid on a phone**, two compact tiles to a row (stage 5
  drew rows; Miguel asked for the grid). 4,588px, from 14,132px.
- **The Collection opens every rarity** (stage 5 closed the empty ones):
  three cards to a row, 5,820px on a new album, from 11,376px.
- Matchday card and event lobby, phone: prize, season points and field
  strength are three rows, not three boxes.
- HQ's wire, phone: the masthead is the desk's name alone; "Full feed" closes
  the board.
- The global 44px / 11px rule is kept and documented as the phone floor
  (#182).

### Fixed
- HQ's wire showed four stories on a phone where stage 3 meant two.
  Root cause: the rule counted `article:nth-of-type` inside a wrapper that
  holds one article each, so it never matched. The rows have a class now
  (`.wire-rows`).
- Matchday card: "Pontos da temporada" wrapped to three lines. Root cause:
  three boxes a third of a phone wide, each with a wide-tracked label.

### Removed
- `lib/usePhone` (its one user, the Collection's closed rarities, is gone);
  the fold styles for HQ; dead phone CSS (`.mobile-action-bar`,
  `.mobile-action-space`, `.mobile-results-space`).

### Not verified
- A physical phone and Safari. A signed-in profile; an album or a challenge
  list with progress; the Follow screen. Content pages were measured (no
  sideways scroll on 18 of them at 375px) and not redesigned.

## [2.1.0-rc.5] · stage 5 of the phone redesign (as first drawn; the entry above says what Miguel changed)

Branch `design/mobile-redesign`. Plan and measurements:
`docs/redesign/MOBILE-PLAN.md`. Everything here applies under 640px; the
desktop layout is unchanged. No engine or store change.

### Added
- `lib/usePhone`: true under 640px, followed live, for a phone-only default
  state.

### Changed
- Challenges: a tier is one board of rows; the row opens the briefing
  (14,132px to 3,862px).
- Collection: a rarity with nothing collected starts closed, three cards to a
  row, the filters on two rows (11,376px to 1,354px on a new album).
- Achievements: each group opens on demand (11,116px to 1,250px). The Profile,
  which embeds the list, went from 14,910px to 4,370px with the season track
  folded too.
- Leaderboards: the nine boards are one row that scrolls sideways.
- Quiz: the answer field sits in the puzzle's card (`.plan-dock`).

### Fixed
- Leaderboards (PT): the line under the title was the Challenges' intro.
  Root cause: `LEADERBOARDS_UI.subtitle` in `copy.pt.ts` held a pasted copy of
  `CHALLENGES_UI.subtitle`. It now translates the English line.
- Challenges: goal lines ran up to 27px past the screen at 375px. Root cause:
  a card's three star goals did not wrap inside the single phone column. The
  phone shows the row instead of the card, so the goals are in the briefing.
- Quiz: the answer field covered the stats strip. Root cause: it was
  `position: fixed` (`.mobile-action-bar`) over whatever followed the puzzle.

### Not verified
- The full suite, `npm run build`, a physical phone, Safari; a signed-in
  profile and an album or challenge list with progress.

## [2.1.0-rc.5] · stage 4 of the phone redesign (as first drawn; the entry above says what Miguel changed)

Branch `design/mobile-redesign`. Plan and measurements:
`docs/redesign/MOBILE-PLAN.md`. Everything here applies under 640px; the
desktop layout is unchanged. No engine or store change.

### Added
- `components/ui/PhoneFold` (stage 3's `HqFold`, now shared), `.phone-tabs`
  and `.plan-dock` in `globals.css`.
- Career copy `market.tabsShort` (EN and PT): the four market tabs in a
  quarter of the screen each.

### Changed
- Market: one row of four underlined tabs, search without its board, players
  as rows of one list.
- Club: achievements, reputation / progression and the season history open on
  demand (4,815px to 1,903px).
- Finances: the gear ladder and the two loans open on demand; the ledger's
  filters are a tab strip; the phone-only jump links are removed (4,509px to
  2,015px).
- Training: objective and intensity are rows, the attribute reference opens
  on demand (4,505px to 3,238px).
- Standings: two underlined tabs and seven region keys on one row; the title
  race opens on demand.
- Inbox: filters on one row; no empty reader board.
- Event lobby: Play across the screen, the other two actions on one row.
- The career player tile is tighter on a phone (Squad, Market, Training).

### Fixed
- Finances was 8px wider than the screen at 375px, which shrank the whole
  page. Root cause: the ledger's three filter buttons sat beside its title in
  a `.card-head` that does not wrap. They are a strip under the title now.
- Training: Start floated over the squad's growth and every board under the
  plan. Root cause: `.mobile-action-bar` is `position: fixed`, so it stayed
  on screen after the plan had scrolled away, and the plan was padded 190px
  to make room for it. It is `sticky` inside the plan's board now (the board
  clips its overflow instead of hiding it, or it would be the scroll box).
- Wizard, season review: the same floating card over the form; both use
  `.action-dock`.
- Market: a gated player was dimmed by a wrapper around the tile, which the
  row list would have ruled instead of the tile. The tile is dimmed itself.

### Not verified
- The full suite, the soft-lock probe, `npm run build`, a physical phone,
  Safari; the season review and Follow (not opened); event playback beyond a
  first look.

## [2.1.0-rc.5] · stage 3 of the phone redesign (as first drawn; the entry above says what Miguel changed)

Branch `design/mobile-redesign`. Plan and measurements:
`docs/redesign/MOBILE-PLAN.md`. Everything here applies under 640px; the
desktop layout is unchanged. No engine or store change.

### Added
- `CareerTabBar`: the career's own bottom bar on a phone (HQ, Squad, Market,
  Training, More). "More" is a sheet with the other six destinations and the
  way back to the game's menu.
- `PhoneFold`: an HQ section that opens on demand. Closed, it is the block's own
  head.

### Changed
- Career chrome on a phone: 219px fixed to 110px. The site header is not
  pinned inside the career and the site's bottom nav gives way to the
  career's tabs (`html[data-career]`).
- HQ on a phone: 7.5 screens to 3.3. Day card, then inbox, then two boards of
  rows (team; race, finances, progression, season goal), the wire's headline
  and two rows, the title race and the transfer wire folded.
- Day card on a phone: no second date, "skip to" and "+1 day" on one row.
- Finances and race heads carry their figure (balance, rank and points) while
  folded.
- Career toasts open under the top bars.

### Fixed
- Career navigation on a phone was a `<select>` under the top bar. Root cause:
  rc.50 swapped a scrolling tab strip for a native select to save width; a
  closed select hides the destinations and cost 53px of every career screen,
  on top of the site's own bottom nav. The tabs are now the bottom bar.
- Career bar at 320px: the season wrapped to two lines and the date was cut
  ("SEG, 5 O…"). Root cause: the play button's label took 38vw. Under 360px
  the button is its glyph (with an `aria-label`), and the season line
  truncates instead of wrapping.

### Not verified
- The full suite, the soft-lock probe, `npm run build`, a physical phone,
  Safari; the event weekend, Follow and the season review under the new shell.

## [2.1.0-rc.5] · stage 2 of the phone redesign (as first drawn; the entry above says what Miguel changed)

Branch `design/mobile-redesign`. Plan and measurements:
`docs/redesign/MOBILE-PLAN.md`. Everything here applies under 640px; the
desktop layout is unchanged.

### Added
- Three phone primitives in `globals.css`: `.phone-rows` (a list is one board
  of rows), `.action-dock` (the screen's one action on ground, `sticky`) and
  `.team-dock` (the draft's slots on the bottom edge).
- Draft: the team dock. The six slots (three in Quick) stay in view while the
  player picks. New copy keys `DRAFT_UI.dockPlayer / dockCoach / dockSub`
  (EN and PT).

### Changed
- Setup is one screen: difficulties as rows (the chosen one spells out its
  tagline), regions as eight 44px keys, section intros on desktop only.
- Draft is one screen: reroll shares the region badge's row; the pitch is
  desktop only while picking.
- Review: pitch and team overall first, then chemistry, specials and the
  readout; the six-card strip is desktop only.
- Tournament: playback controls on the bottom edge, skip as a 44px key, the
  head reduced to the series itself, the W-L record on the Swiss path.
- Results: one 65px action row (play again, share), highlights as rows.
- Achievement and reward toasts open under the header on a phone.
- The site footer and the play strip are off while a run is in play.

### Fixed
- Review, Results: the pinned action floated over the page. Root cause:
  `.mobile-action-bar` is `position: fixed` with a guessed bottom padding, so
  text ran under and around it, and on Results it was a 124px block of three
  wrapped buttons. The run screens now use `.action-dock` (`sticky`, a direct
  child of the screen root), which needs no padding and cannot overlap.
- Tournament: team names cut at 375px ("SEU TI…"). Root cause: logo, name and
  score shared one row of 311px, leaving the name about 68px. On a phone each
  side is now the crest over a two-line name.
- Tournament: a game's score broke onto two lines beside a long label. Root
  cause: the score span could shrink; it is now `shrink-0 whitespace-nowrap`.
- Results: a toast covered Play again. Root cause: the toast stacks were
  anchored to the bottom of the phone screen, where the action is.

### Not verified
- The full suite, `npm run build`, a physical phone, Safari.

## [2.1.0-rc.5] · stage 1 of the phone redesign (as first drawn; the entry above says what Miguel changed)

Audit of every screen at 375px, the proposed phone rules and the six stages: `docs/redesign/MOBILE-PLAN.md`.

### Changed
- **Phone header**: logo, language (one 44px button that flips EN / PT), rankings, settings, account. Discord is off the phone header (it is on the Home and in the footer). Desktop is unchanged.
- **Bottom nav**: a solid bar (it was the last frosted bar, against DESIGN.md) with the header's orange rule on the current destination. It is hidden during draft, review and tournament: every destination on it leaves `/play`, which resets the run.
- **Home on a phone**: both mode buttons are inside the first screen (hero 433px to 246px, modes 567px to 444px). The pitch is two lines, the community links sit at the end of the menu, BETA is a mark beside the career title. TODAY is a list of rows with a chevron (820px to 439px); the button that repeated each row's title is desktop-only.
- **Run stepper on a phone**: one 44px row with the current step and its place ("1/4"); it wrapped onto two lines (86px).

### Fixed
- **The rank name was cut on the Home scorebug ("BRON")** at 375px and under. Root cause: the rating label ("RATING DA TEMPORADA") set the paper cell's width on one line and the 80px rank art took the rest. The label now takes two lines on a phone and the art steps down to 56px under 360px.
- **The Home wordmark ran 25px past a 320px screen** (known since rc.1). Root cause: a fixed 48px size. It is fluid under 375px now (`clamp`).

### Not verified
- The full suite, `npm run build`, a physical phone, Safari. Checked in the dev build at 375, 320 and 1024px.

## [2.1.0-rc.4] — 2026-11-21 · Etapa 1 closes: the Worlds spread by region, the Matchday screens (staging)

Branch `claude/etapa1-final-1692be`, cut from `2.1.0-rc.3` (`c9187fa`). Published to `staging` only; production is unchanged (every Etapa 1 flag stays off outside the staging build).

### Added
- **Matchday slice 5, the screens** (custom mode, `FEATURES.matchdayDecisions` / `matchdayBoxScore`). `SeriesDesk` takes the Match Center's place when the event holds at the user's series: the **series plan** (the coach's plan already filled in, tagged "Coach", or "Captain" without one; style with its fit and what it beats, kickoffs, the player marked; the scouting line and the starters' traits; every call optional), the **break** between games (the games so far, both momentum meters, one timeout, the adjustment, one sub) and the end of the series (Continue). "Leave it to the coach" plays the rest out at any point. A series played at the desk lands straight on its banner (no replay), and the playback parks once on it so its box score can be read.
- **Box score in the Match Center** (`SeriesBoxScoreView`, R137 option B): under every finished series, open by default on the user's. Series totals and one sheet per game: goals, assists, saves, shots, score, the 0-10 rating, the MVP and the key moments (`momentText`). No play-by-play and no live momentum bar.
- **Season stats on the roster** (`RosterSeasonStats`, Squad screen): `save.boxStats` of the current season, per player (games, goals, assists, saves, shots, score, average rating).
- **Matchday mode in Career settings** (`MatchdayModeSetting`, Club screen): Quick (default) or Custom, and where Custom stops (playoffs and LAN events, or every series).
- Career strings `seriesDesk.*`, `boxScore.*` and the mode hints, EN and PT.

### Changed
- **An instant result never stops** (`userSeriesStopsAt` reads `ev.watched`): "Instant result" in custom mode used to stop at the user's series and leave the screen on its loading state.
- **Back to quick mid-series**: `setMatchdayModeFlow` lets the coach play the open series out first; the games already played stand (it used to replay the whole series from scratch).
- `careerWorldTop.probe` measures from season index 0 (`WORLDTOP_FROM`), prints every season and the player-facing windows (seasons 1–8 and 10+), applies the Worlds' per-region shift in its AI-only replay, and takes `WORLDTOP_WSHIFT` / `WORLDTOP_WFADE` for sweeps.
- Version 2.1.0-rc.4 in `package.json` and `SITE.version`.

### Balance
- **BALANCE_VERSION 45. R146, the regional spread of Worlds champions** (`CAREER_REGION_FIELD.worldsRegionShift`, `worldLife` only): each AI side at a Worlds gets NA +1, EU −0.5, SAM +1.5, MENA +1, OCE/APAC/SSA +0.5, full through season index 5 and gone at 8. Carried in `difficultyShift`: the players, the seeding, the Majors, the climb and the user's side never move. Measured on 10 careers (5 regions × 2 seeds, Normal, every flag on; AI-only Worlds, 100 a season):

| AI Worlds champions | EU | NA | SAM | MENA | others |
|---|--:|--:|--:|--:|--:|
| Seasons 1–8, before | 79 | 16 | 0.4 | 5 | 0 |
| Seasons 1–8, after | 57 | 30 | 3 | 10 | 0 |
| Seasons 10+ (unchanged) | 49 | 36 | 7 | 7 | 0.1 |

  A 97 user side's early Worlds title odds stay put (14.2 → 14.4%); EU −1.25 alone gave the same spread but doubled them. The world's players are identical season by season; the match engine, the Draft, the +2/+5/+6 anchors and the series digest are untouched. Softlock probe (7 regions × Normal/Hard × 2 policies, 10 seasons): 0 of 28. The rc.3 "NA 55% from S10" was 5-career noise: 10 careers give NA 36%.

### Fixed
- Instant result in custom mode hung on the event's loading state. Root cause: the custom stop did not check whether the event was watched, so the instant sim stopped at the user's series with no screen to play it.

## [2.1.0-rc.3] — 2026-11-21 · Matchday slices 3 and 4, Mundo vivo M2.1 and M3, every Etapa 1 flag on in staging only (staging candidate, not published)

Branch `claude/etapa1-integration-3eae43`. Not pushed, not deployed. Handoff for the next chat: `docs/ETAPA-1-STATUS.md`.

### Changed
- Merged, in order: Matchday slice 4 with slice 3 (`claude/matchday-f4-4b2a5c`, `dev.5` and `dev.9`), Mundo vivo M2.1 (`claude/m2-spec-d7907f`, `dev.7`), M3 (`claude/m3-diagnosis-b95889`, `dev.8`) and slice 3's AI planning and coachless floor (`claude/matchday-f3-a2b530`, `dev.6` and `dev.10`). The new career strings M2.1 brings lose their em dashes.
- **`FEATURES.matchdayDecisions` and `FEATURES.matchdayBoxScore` join `STAGING_BUILD`**: all four Etapa 1 flags are on in the staging build only (M2.1 and M3 ride on `worldLife`). `stagingFlags.test.ts` covers all four (off in production, playtest, dev and tests).
- **Decision numbers:** the branches had reused R139 to R141. In merge order: fatia 3 R140, fatia 4 R141, M2.1 R142, M3 R143, the AI plans with its coach R144, the coachless floor R145 (M1 stays R139). Code comments and docs follow.
- Version 2.1.0-rc.3 in `package.json` and `SITE.version`.

### Balance
- **BALANCE_VERSION 44.** Each merge brought a different `balance.ts`, so the fingerprint test asked for 41, 42, 43 and 44 in turn. No value changed in a merge.
- **Combined battery, every Etapa 1 flag on together** (dumps and summaries: notes folder `rc3-battery-dumps/`; bots, not players). Off = v2.0.35 baseline; "alone" = each branch's own measurement.

| | Off | Alone | All on |
|---|--:|--:|--:|
| Engine favourite +2 / +5 / +6 | 75.2 / 96.0 / 98.2% | f2 74.9 / 95.9 / 98.2; f3 75.4 / 96.2 / 98.4 | 74.9 / 95.9 / 98.2% |
| Career series ±2, Normal / Hard | 59.4 / 56.2% | f2 59.1 / 57.3; f3 58.3 / 58.1 | 60.9 / 58.1% |
| Career +2 to +6 lost, Normal / Hard | 7.8 / 6.9% | | 5.9 / 6.4% |
| Career ≥ +6, Normal / Hard | 99.8 / 99.5% | f2 99.9 / 100 | 99.9 / 100% |
| Career ≤ −6 won, Normal / Hard | 0.3 / 0.2% | | 2.7 / 0.2% |
| Endgame series lost, Major N / H | 45 / 64% | f3 58 / 71 | 57 / 69% |
| Soft locks | 0 | 0 | 0 (pacing, endgame, soft-lock probe, world probes) |
| Insolvent, Normal / Hard (of 42) | 0 / 4 | f2 1 / 5; f3 1 / 6 | 1 / 6 |
| Target 1: Normal regional final by T5, EU / NA / SAM (strong bot) | 3 / 23 / 57% | M3 23 / 43 / 57 | 40 / 40 / 63% |
| Target 2: Easy EU by T5 | 10% | M3 50 (+27) | 67% (+27 over Normal) |
| Hard by T5, EU / NA | | | 0 / 31% |
| Target 5: Worlds title, user at 97 / 99, S10–S15 replay | 39 / 74% | M2.1 19 / 55 | 16.7 / 55.5% |
| AI Worlds champions, EU / rest | | M2.1 59 / 41 | S6–S15 46 / 54 (NA 40.5); S10–S15 27 / 73 |
| Time per simulated season | 6.1 s (loaded machine) | f3 3.4 s | 3.2 s |

- Hard guards hold: the Draft golden test, the balance anchors (overall dominant) and the series-steps digest pass with every flag on; +2 ≥ 73%, +6 ≥ 98%, a +5 favourite loses 4.1% (engine) and 5.9–6.4% in careers (+2 to +6); zero soft locks; the world's S0–S5 (top-4, median, local anchor) is identical flags on and off: only the user's own results move, and the M3 ramp reads only in the match.
- Targets 1, 2 and 5 are met by the bots; target 4 holds (Hard below Normal in every measure: ±2 series, region curve, M1 replay). NA sits exactly at target 1's 40%.
- Report-only: target 3 (93+ titles) cannot be read, because no bot reaches 93+ at a regional; endgame bots won 1 of 64 Majors and 0 of 26 Worlds. Target 6 (T13+ Worlds share) cannot be read, because the world-probe bots never reach a Worlds.
- Worth a look at the gate: a big underdog (≤ −6) wins 2.7% of Normal career series (0.3% before; momentum and coach decisions); the endgame bots reach twice as many Worlds (26 against 12) at a lower median rating (93.3 against 94); Hard EU reaches no regional final by T5 (0 of 16).

## [2.1.0-rc.2] — 2026-11-20 · Matchday slice 2, Mundo vivo M1 and the Etapa 1 analytics, both flags on in staging only (staging candidate, not published)

Branch `claude/etapa1-integration-3eae43`. Miguel approved rc.2 on 20/11. Not pushed, not deployed: publishing waits for his go-ahead (steps at the top of `docs/ETAPA-1-STATUS.md`).

### Changed
- Merged, in order: Matchday slice 2 (`claude/matchday-f2-5bf162`, `2.1.0-dev.3` below), the Mundo vivo M1 implementation (`claude/recursing-chatelet-8a8b84`, `2.1.0-dev.2`) and the Etapa 1 analytics (`claude/analytics-etapa1-6a7f03`, `2.1.0-dev.4`). The new strings M1 brings to the career copy lose their em dashes as rc.1's did.
- **`FEATURES.matchdayStyles` and `FEATURES.worldLife` are ON in the staging build only.** A new `STAGING_BUILD` in `balance.ts` reads the marker the staging Worker already builds with (`next build` plus `NEXT_PUBLIC_NOINDEX=1`, minus the playtest Worker, which also sets NOINDEX). It is the same rule as `analyticsEnvironment() === "staging"`, so nothing new has to be set in the Cloudflare dashboard. Production, playtest, dev and tests keep both off; `NEXT_PUBLIC_MATCHDAY_STYLES=1` / `NEXT_PUBLIC_WORLD_LIFE=1` still turn them on for the probes. `stagingFlags.test.ts` holds it. `postexport.mjs` mirrors neither flag.
- **Decision number:** the M1 branch had written its decision as R137, which is Miguel's approval of 20/11 (and R138 is slice 2). M1 is now **R139**, with its code comments, `MUNDO-VIVO-M1.md` and the RTW status pointing to it.
- Version 2.1.0-rc.2 in `package.json` and `SITE.version`.

### Balance
- **BALANCE_VERSION 39.** Slice 2 (`CAREER_MATCHDAY`) and M1 (`CAREER_WORLD_LIFE`) each bumped 37 → 38 on their own branch, from the same base, with different tables. Together `balance.ts` is a third set of values, so the fingerprint test wants a number neither branch used: 39 (hash `604165a4`). No value changed in the merge. `STAGING_BUILD` is left out of the fingerprint, like `FEATURES`: it is a build switch, not a tuning value.
- With both flags off a career plays as v2.0.35 (both branches' own proofs, the golden and balance tests pass untouched). On staging both are on together, which neither branch measured: see Not verified.

### Not verified
- Not on staging and not played by Miguel. The two flags were never run together before this rc. Only a short M1 probe with both on (EU, 9 seasons) and the browser check below cover the combination; no baseline battery was run with both on.

## [2.1.0-rc.1] — 2026-11-20 · Integration of the new identity + v2.0.35 + Etapa 1 slice 1, M1 diagnosis (staging candidate, not published)

Branch `claude/etapa1-integration-3eae43`, cut from `design/broadcast-pilot` (`ca05144`, fourth pass) plus the fifth pass `4b4ecd6`, which is on `staging` (v2.0.33-design.1) but **not** on `design/broadcast-pilot`. Miguel (20/11): Etapa 1 is tested on staging on the new identity. Not pushed, not deployed: it waits for the Etapa 1 gate. How to bring the rest in and publish: top of `docs/ETAPA-1-STATUS.md`.

### Changed
- **The new identity at its fifth pass (the broadcast pilot entry below) merged with `main` v2.0.15 to v2.0.35.** Where they met, the redesign keeps its visuals and layout and main keeps its behaviour, copy and data. Main's search titles and copy (career landing, team and player titles, the three guides) are taken with their em dashes rewritten as colons or brackets (DESIGN.md: no em dash).
- **The Collection's quiet next-reward line (v2.0.35)** is set as a quiet label of the new identity (display Medium caps, faint, tabular figures). The database link at the end of the page stays a faint sentence.
- **Decision numbers:** the redesign's DESIGN-DECISIONS are #173 to #177 (the first four were #164 to #167 on the design branch; main had used #164 to #172). DESIGN.md and the redesign handoff point to the new numbers.
- Merged, unchanged: Matchday slice 1 (`2.1.0-dev.1` below: series in steps, R137), the balance baseline for v2.0.35, the PostHog analysis of 20/11 and the Mundo vivo M1 diagnosis (docs only).
- The event lobby's qualifier list (fifth-pass layout) reads team names from the career's name bank, as main v2.0.34 does (`EventScreen`).
- Version 2.1.0-rc.1 in `package.json` and `SITE.version`.

### Fixed
- **`runLabels.test` failed on the design branch:** the redesign removed three em dashes from the daily templates' English copy (`copy.en.ts`) but not from the plan's own text (`lib/dailyPlan.ts`), which the test requires to read the same. Root cause: a copy pass that edited one of two copies of the same strings. The plan text now matches the copy.

### Not verified
- Not on staging and not played by Miguel. Browser look in a local export (career on, accounts and analytics off): the Home, the quick-start wizard, the career HQ and a Garage Series event (lobby and instant result) on desktop, then the same three pages at 320 px. No console errors.
- **Known at 320 px, same as staging (the fifth pass left mobile for later):** the Home wordmark is 25 px too wide (page 345 px, the scorebug's rank label hidden), and the HQ and event stat boxes run their labels together ("PREMIAÇÃOPONTOS"). Not fixed here: it belongs to the mobile pass and Miguel's A7.
- Four career/engine tests timed out at 5 s while other sessions loaded the machine. They pass alone with a longer timeout; the run before the fifth-pass merge was fully green.

## [2.1.0-dev.10] — 2026-11-21 · Matchday slice 3: a planning floor for coachless teams (behind a flag, not released)

Decision of 20/11 (ROAD-TO-WORLDS-DECISIONS R145). Still behind `FEATURES.matchdayDecisions`, off; flag off unchanged.

### Changed
- **A planning floor**, `CAREER_MATCHDAY.coachlessQuality` = 0.3 (`planningQuality`): a side with no coach, or a coach rated below the floor, makes its plan and break calls at this quality instead of the bare default plan. Root cause of the dev.6 gap: once the AI planned, a coachless user kept the default plan and fell to 45.9% in an even series and 71.8% as a +2 favourite (under the 73% guard).
- The sub's XP stays as it is (`fieldedIds` unchanged): open for the Etapa 1 gate.

### Balance (both flags on; bots; BALANCE_VERSION 41)
- Quick without a coach, even series: 49.2–49.3% (old engine 49.7–50.5%); +2 without a coach 74.8–75.5%. Average coach 49.9–50.1%, coach 0.7 51.5–52.0%, good manual 52.7–53.2%.
- Engine: +2 75.4% (worst cell 74.9%), +5 96.2% (upset 3.8%), +6 98.4% (worst 98.1%).
- Career series at ±2: Normal 58.3%, Hard 58.1%, Easy 76.2% (v2.0.35: 59.4 / 56.2 / 76.1). 0 soft locks in 210 bot careers. Insolvency Normal 1, Hard 6 of 42.
- Endgame series lost at Majors: Normal 58%, Hard 71% (v2.0.35: 45% / 64%).

## [2.1.0-dev.6] — 2026-11-20 · Matchday slice 3: the AI plans with its coach (behind a flag, not released)

Miguel's decisions of 20/11 (ROAD-TO-WORLDS-DECISIONS R144): the no-coach cost is accepted, and deciding must not make the game easier than today. Still behind `FEATURES.matchdayDecisions`, off; flag off unchanged.

### Changed
- **The AI plans and calls its breaks exactly like the user's "leave it to the coach"**, at its own coach's quality (0.4 when the builder knows no coach), in every career series: AI against AI (`simulateSeries`) and AI against the user. The plan comes from `coachPlanFor`, the breaks from the shared `coachBreakOn`; the decisions hash the series' starting RNG cursor, so no extra number is drawn. Slice 3's AI-only adjustment rule (`aiAdjustBase` / `aiAdjustPerQuality`) is gone.
- The pacing and endgame probes take `PACING_BUDGET_MS` / `ENDGAME_BUDGET_MS` (the wall-clock stop per career; a loaded machine turned 30 slow careers into "budget" soft locks at the 300 s default).

### Balance (both flags on vs v2.0.35; bots; BALANCE_VERSION 40)
- Even series, quick with an average coach against an AI with an average coach: 50.1% (dev.5: 53.3%). Good manual 53.2% (+3 pp); quick without a coach 45.9%.
- Engine: +2 favourite 75.4%, +5 96.2% (upset 3.8%), +6 98.4%.
- Career series at ±2: Normal 57.7%, Hard 56.0%, Easy 75.2% (v2.0.35: 59.4 / 56.2 / 76.1). Soft locks 0 (210 bot careers and the probe). Insolvency Normal 2, Hard 6 of 42.
- Endgame (professional bot): series lost at Majors Normal 59%, Hard 74% (v2.0.35: 45% / 64%), at Worlds Normal 57% (45%).
- Engine cost: ~87 → ~140 µs per series with the layer; seasons did not get slower (3.4 s per season against dev.5's 4.4 under the same parallel load).

## [2.1.0-dev.9] — 2026-11-20 · Matchday slice 4: box score, ratings and key moments (engine and store only, behind a flag, not released)

Fourth slice of Etapa 1 (docs/MATCHDAY-SPEC.md §3 C and §8, R137 option B). Everything sits behind the new `FEATURES.matchdayBoxScore`, **off by default** (`NEXT_PUBLIC_MATCHDAY_BOXSCORE=1` for probes). No screens yet (slice 5). No play-by-play and no momentum bar, as Miguel chose.

### Added
- **`engine/career/boxScore.ts`**, an extension of `matchTimeline.ts` on a local RNG seeded from the persisted result (`boxScoreSeed`): per player per game goals, assists, shots, saves, demos, in-game score and a 0–10 rating (the base of the Pro career, Etapa 2). Goals are the engine's own `scorers` counts (a legacy game without them spreads the goals at random), so a side's goals sum to its score exactly; assists ≤ goals and never on the scorer's own goal; shots ≥ goals; one side's saves are the rival's shots on target minus its goals.
- **Series box score** (`buildSeriesBoxScore`): every game, per-player totals with the average rating, and the **series MVP from the winner's top score** (instead of the `starName` draw).
- **Style flavour** (with `matchdayStyles` on): Pressure +2 demos, Possession cuts the shots its rival gets by 2.
- **Key moments**: structured events (type, side, player, period, clock, variant, n) read off the goal timeline and the numbers: overtime winner, comeback from 2+ down, hat-trick, clean sheet in a deciding game, late goal, save marathon, demo blitz, and the deciding goal as a filler. 2–4 when something notable happens (the filler tops up to two), 0–1 in a quiet game, capped at 4. Three text variants per type; a series never reuses one. Text: `copy.career.en/pt.ts` `moments` plus `content/momentText.ts`.
- **Season stats on the roster**: `CareerSave.boxStats` (optional, additive: persist version and `saveVersion` stay), per-player totals and rating sum for the current and the last season, 12 players each. Folded in when an event ends (`careerFlow.accumulateBoxStats`), from the same round keys the Match Center uses.
- Tests: `boxScore.test.ts` (determinism, goal sums, assists/shots/saves bounds, MVP, input never written so winner and score cannot move, moments, style flavour, season fold) and `momentText.test.ts`.

### Balance
- None. Presentation only: no result changes, and the world simulation never calls the box score (nothing in `worldSim.ts` imports it). `BALANCE_VERSION` 39 → 40 only because the new `CAREER_BOXSCORE` constants change the balance.ts fingerprint.

## [2.1.0-dev.8] — 2026-11-20 · Mundo vivo M3: an early regional ramp for EU and NA (flag off, BALANCE_VERSION 39)

Behind `FEATURES.worldLife` (`NEXT_PUBLIC_WORLD_LIFE=1`), off in every build: with the flag off a career plays exactly as v2.0.35 (R143, docs/MUNDO-VIVO-M3.md).

### Added
- `worldSim.earlyRegionShift`: the AI sides of EU's and NA's qualifiers and regionals play a little weaker early in a career. The effect is full through T5 and fades out by T10. Easy and Normal only; Hard, Major and Worlds are untouched, and so are every player's rating and the seeding.
- Opt-in probe `careerRegionCurve.probe.test.ts` (`REGIONCURVE=1`): regional finals and titles per season, the user's rating against the regional top 4, money and squad, with `RC_*` experiment overrides. Tables come from `scripts/region-curve-summary.mjs`.
- The arc bot's `strong` policy, recalibrated against real players (Prospects, a market that reads upside, the core renewed, support only with ten weeks of runway, nothing optional while the Backer is owed). New opt-in knobs: `market: "value"`, `renew: "core"`, `supportRunwayWeeks`, `prudent`, `policyOverride`.

### Balance
- `CAREER_REGION_FIELD.earlyShift` EU −5 / NA −1.5 (others 0), `earlyShiftScaleByDifficulty` easy 1 / normal 1 / hard 0, `earlyShiftFade` full through seasonIndex 4, gone at 9. Measured (calibrated bot, 30 seeds), regional final by T5 on Normal: EU 3 → 23 %, NA 23 → 43 %, SAM 57 % unchanged. Easy EU 10 → 50 %. Soft lock 0. BALANCE_VERSION 38 → 39.

### Fixed
- EU (and NA) Normal careers almost never reached a regional final by T5: 1 % and 35 % of real careers, against 67–69 % elsewhere. Root cause: every region starts with the same budget and founders, but the real EU field sits at 95–96 from the first season. A new club is 15 points short at T3 and never earns the first prize money and reputation that pay for its growth. Easy's 1-point rival shift could not close that gap.

## [2.1.0-dev.7] — 2026-11-20 · Mundo vivo M2.1: elite renewal, champions from other regions (flag off, BALANCE_VERSION 39)

Behind `FEATURES.worldLife` (`NEXT_PUBLIC_WORLD_LIFE=1`), off in every build: with the flag off nothing changes. Infinite seasons only (R142, docs/MUNDO-VIVO-M2-SPEC.md).

### Added
- Elite renewal: each region keeps its S6 count of active AI elite. A region under it promotes up to 2 young AI players a season to a potential of 94–98 (peak age fixed at the promotion); the news reports "X breaks out as a prodigy". Optional save fields `world.eliteBaseline` and `world.potentialLift`.
- The opt-in probe `careerWorldTop.probe.test.ts` (`WORLDTOP=1`): the world's top 30, the elite pipeline, Worlds replays at fixed ratings and the AI Worlds champion's region.

### Balance
- `CAREER_WORLD_LIFE.eliteRenewal` (new). With the flag on, in S10–S15 the Worlds field's best side holds at 97.2–97.3 (95.3–97.0 off); a 97 team wins the Worlds 19 % of the time (39 % off), a 99 team 55 % (74 %), a 101 team 84 % (92 %). AI champions: EU 59 %, the rest 41 % (history 38 %). BALANCE_VERSION 38 → 39.

### Fixed
- The top of the AI field decayed ~3 points over the infinite seasons. Root cause: the dataset-era rookies are capped at potential 88 (`CAREER_WORLD.datasetEraPotentialCeiling`), so the 2027 stars had no successors of their level until the infinite-era rookies matured after S12.

## [2.1.0-dev.5] — 2026-11-20 · Matchday slice 3: plan, breaks, momentum, quick and custom modes (engine and store only, behind a flag, not released)

Third slice of Etapa 1 (docs/MATCHDAY-SPEC.md §6, §7, §9). Everything sits behind the new `FEATURES.matchdayDecisions`, **off by default** (`NEXT_PUBLIC_MATCHDAY_DECISIONS=1`). With it off no result moves: a pacing slice is identical, career for career, to the v2.0.35 baseline dumps (14 of 14), and `regression.golden.test.ts`, `balance.test.ts`, `match.steps.test.ts` and the persist contract pass untouched; with `matchdayStyles` on and this flag off, behaviour equals slice 2. `persist` version 3 and `saveVersion` 5 stay. No screen (slice 5). Decisions: ROAD-TO-WORLDS-DECISIONS R140.

### Added
- **The series plan** (`engine/career/matchday.ts`, `SeriesPlan`): the style played (the natural one or another; the matchup scales with fit, an off-style costs 0.5 × the fit lost), the kickoff (safe / standard / aggressive: ×0.85 / ×1 / ×1.15 on both sides' per-game roll) and a marked player (the side's playmaker makes 60% fewer special plays; marking anyone else costs 0.15). Plan ±0.4, plan + matchup + traits + Sunday briefing ±1.2 per game.
- **The momentum meter** (−2..+2 per side, 0.75 rating per point, ±1.5): replaces `SIMULATION.momentumBounce` in career series. A plain loss leaves the loser the old bounce; an overtime loss or a rout shakes it; rout, overtime and comeback wins carry the winner; Leader, Hot-headed and Ice-cold move it (they leave the bounce).
- **Breaks** (`engine/career/matchdaySeries.ts`): one timeout per series (clears up to 0.75 of the opponent's momentum), one sub (the reserve in, team rebuilt), an adjustment of style or kickoff. The AI keeps its natural style and the default plan and, in the user's series, re-picks its style after a loss with a chance that grows with its coach.
- **"Leave it to the coach"**: every call right with chance = coach quality (overall 60 → 0, 90 → 1), hashed from the series seed, no RNG drawn; no coach = the default plan and no breaks.
- **The user's series on its own seed** (`seriesSeed`, wired for events started with the flag on, `activeEvent.matchday`): the rest of the round never depends on the user's choices. `playNextRound` / the rounds take an optional `UserSeriesResolver`. `tournament.upcomingUserPairing`.
- **Modes**: `prefs.matchdayMode` ("quick" when absent: every existing career) and `prefs.matchdayStopAt` (custom default "playoffs" = playoff series and every LAN series; "every" opt-in). Quick never stops. Custom holds the round at `activeEvent.userSeries` (plain JSON with the series RNG cursor): a reload resumes at the same game with the same result. Store actions `setMatchdayMode`, `setSeriesPlan`, `playSeriesGame`, `seriesTimeout`, `seriesAdjust`, `seriesSub`, `delegateSeries`; the setting's label in `copy.career.en.ts` / `.pt.ts`.
- `match.modes.probe.test.ts` (`GAP_MODES=1`): series win rate by policy; `match.gap.probe.test.ts` gains `GAP_DECISIONS=1`.

### Balance (both flags on vs v2.0.35; bots, not players; BALANCE_VERSION 39, no value changed with the flags off)
- Engine: +2 favourite 75.5% → 75.6%, +5 96.1% → 96.1% (upset 3.9%, still under the 5–8% band), +6 98.4% → 98.4%.
- Career series at ±2: Normal 59.4% → 59.7%, Hard 56.2% → 58.6%, Easy 76.1% → 77.0%. ≥ +6: 99.8% / 99.5% → 99.8% / 99.9%.
- Soft locks 0 (probe and 210 bot careers). Insolvency Normal 0 → 1 of 42, Hard 4 → 5 of 42 (as slice 2). Regional final by S5 still 0/6 in NA, EU and SAM.
- Quick vs custom, even series: good manual 55.7%, quick with an average coach (overall 72) 53.3%, quick without a coach 49.4%.

## [2.1.0-dev.4] — 2026-11-20 · Analytics: critical career events skip the cap, Etapa 1 properties

Not deployed. Production analytics only (`rocketdraft.app`); no gameplay change.

### Added
- **`career_event_completed`**: `seriesWon`, `seriesLost`, `upsetWins`,
  `upsetLosses` (a series won as the underdog / lost as the favourite by 5+
  average player overall), `oppOverallAvg`; `liveSeries` and `decisions`
  reserved (null) for Matchday fatia 3. `finishEvent` notes the user's series
  before the bracket is discarded (`careerAnalytics.noteFinishedTournament`).
- **`career_season_completed`**: `realOrgsTop8` (real dataset orgs in the
  region's final top 8) and `formatId` (reserved, null).
- **`career_transfer`**: `kind = trade` with `tradeSide` (out / in) for a
  player-for-player trade (it used to read as sell + sign).
- **`session_started`**: `lastCareerTab`, the last career screen seen.
- **`career_action_refused`** (`reason`, `screen`): the career refused what
  the player asked for (ended career, a failed action, a flow's error key).
  Once per session and reason.
- A third priority, **essential**: never sampled or capped and past the
  circuit breaker, with its own ceiling (1,500 a device a day). The career's
  spine (one per tournament, split, season, milestone, end, creation), refused
  actions, accounts and health.
- **Career sampling** for the growth levels (`careerRate`): whole careers in or
  out, by a hash of the careerId, for the per-tournament and decision events.

### Changed
- **Budget re-sized on the launch week** (free plan, 1M events a month, target
  ≤ 70%): measured ~795k a month (79%) before; ~675–695k (68–70%) after.
  `public/analytics-budget.json` 120 → **360** devices a day (level 1). The
  ladder now starts at 300 devices (cap 20 standard events a day, then 1 in 8)
  and steps at 370 / 490 / 670 / 950 / 1,400.
- No `$pageview` for the career's inner screens (tabs, event, follow): the tab
  counters and `lastCareerTab` carry them (~2k events a day).
- The breaker still counts every event; past 400 a day only essential events go
  out (critical events used to stop there too).

### Fixed
- **The longest careers lost their data.** 129 devices hit the 400-a-day
  breaker in the launch week; careers that came back had skipped a median of 3
  seasons of events. Root cause: the breaker treated the career's per-tournament
  line like any other event, and `career_event_completed` was "standard"
  (capped on the levels above 0). It is now essential.


## [2.1.0-dev.3] — 2026-11-20 · Matchday slice 2: styles and traits (engine only, behind a flag, not released)

Second slice of Etapa 1 (docs/MATCHDAY-SPEC.md §4, §5, §7). Everything sits behind `FEATURES.matchdayStyles`, **off by default** (`NEXT_PUBLIC_MATCHDAY_STYLES=1` turns it on). Off, no result moves: a pacing slice with the flag off is identical, career for career, to the v2.0.35 baseline dumps, and `regression.golden.test.ts`, `balance.test.ts` and `match.steps.test.ts` pass untouched. No save, copy or screen change. Decisions: ROAD-TO-WORLDS-DECISIONS R138.

### Added
- **Play styles** (`engine/career/styles.ts`): Pressure > Possession > Counter > Individual > Team play > Pressure. A side's natural style and its fit (0–1) in each style come from its three starters' attributes, read against each player's own mean so overall never picks the style (an optional archetype lean exists for callers that have it). Weights are tuned so each career archetype's offsets lead to one style; over real-looking lineups every style is the natural one of about 13–30% of sides.
- **Style matchup in every career series**, AI against AI included (a table lookup in `match.ts`): the side whose style beats the other's gets `CAREER_MATCHDAY.matchupCap` (0.6) × its fit per game. A full-fit matchup takes an even series to about 56%.
- **Traits** (`engine/career/traits.ts`): 0–2 per player from a hash of the player's key, weighted by archetype and overall, never stored. Form traits act per game: Decisive (deciding game and overtime), Streaky / Consistent (wider / narrower roll, no extra RNG draw), Slow starter (game 1 worse, game 3 on better), LAN player (needs `TournamentTeam.lanEvent`, which nothing sets yet). Leader, Hot-headed and Ice-cold bend the existing bounce (`SIMULATION.momentumBounce`, ±0.5); fatia 3 moves them onto the momentum meter.
- Optional `TournamentTeam.style` / `traits` / `lanEvent`, filled only by `assembleTournamentTeam` for career sides (the `rollRange` gate) with the flag on. Caps: traits ±0.6, matchup + traits ±1.2 per game (§7). An event in progress at an update keeps the teams it was built with.
- `match.gap.probe.test.ts` (from the baseline branch) gains a +5 gap and `GAP_STYLES=1`.

### Balance (flag on vs off; bots, not players; BALANCE_VERSION 38, no value changed with the flag off)
- Engine: +2 favourite 75.2% → 74.9%, +5 96.0% → 95.9%, +6 98.2% → 98.2%.
- Career series at ±2: Normal 59.4% → 59.1%, Hard 56.2% → 57.3%, Easy 76.1% → 76.1%. ≥ +6: 99.8% / 99.5% → 99.9% / 100%.
- Soft locks 0. Insolvency Normal 0 → 1 of 42, Hard 4 → 5 of 42 (noise level).
- Regional final by S5 stays 0/6 in NA and EU on every difficulty: the matchup is not the lever for targets 1 and 2.

## [2.1.0-dev.2] — 2026-11-20 · Mundo vivo M1: orgs renew, coaches retire (flag off, BALANCE_VERSION 38)

Behind `FEATURES.worldLife` (`NEXT_PUBLIC_WORLD_LIFE=1`), off in every build: with the flag off a career plays exactly as v2.0.35. Infinite seasons only (R139, docs/MUNDO-VIVO-M1.md).

### Added
- AI scouting: an org of prestige 1+ signs a near-ready prospect (≤ 21, potential 85+, overall within 5 of its weakest starter) as its reserve. He starts only once he passes the weakest starter, who keeps a bench seat. Measured: the top-4 overall is never lower than with the flag off.
- A Local side that played a Major or Worlds is signed at the rollover ("stack X signs with Y"); a small org stuck outside its region's top 12 for two seasons gives its seat to a new org.
- The local scene's ceiling: its region's median org rating − 2, set each season.
- Coaches age and retire. An AI org outside its top 10 may change coach after two seasons; retired ex-pros take the jobs first. The user's coach announces his last season in the Inbox and leaves only at the next rollover, never mid-season; he is not offered again.
- The `strong` arc-bot policy and the opt-in probe `careerWorldLife.probe.test.ts` (`WORLDLIFE=1`, with a Worlds replay at fixed ratings).

### Balance
- `CAREER_WORLD_LIFE` (new). BALANCE_VERSION 37 → 38 (the fingerprint test asks for it on any balance.ts change; no value read with the flag off changed).

### Fixed
- Real orgs lost Worlds seats to Local sides in the infinite seasons. Root cause: AI orgs signed free agents by current overall only once the anchor pass ended (the best young players stayed unsigned), and the local scene's ceiling grew 1.5 a season with no tie to the world. Flag on: Local sides at Worlds 0.4–1.4 → 0.0–0.1 a season (S6–S12).


## [2.1.0-dev.1] — 2026-11-20 · Matchday slice 1: the series in steps (engine only, not released)

First slice of Etapa 1 (docs/MATCHDAY-SPEC.md §3 B, §10). No result, seed, save, balance number, string or screen changes; `package.json` and `SITE.version` stay 2.0.35 until v2.1 ships. Miguel's decisions of 20/11: ROAD-TO-WORLDS-DECISIONS R137.

### Changed
- **`simulateSeries` is a loop over three steps** (`engine/match.ts`): `startSeries` (draws both series-form rolls), `playNextGame` (one game, returns a new state, never mutates the old one) and `finishSeries` (the result, with the comeback note; draws nothing), plus `isSeriesOver`. The series in progress is a plain-JSON `SeriesState` (team ids, options, forms, wins, last winner, deficits, games), so the career can persist it between games in slice 3. The RNG is consumed byte for byte as before: `match.steps.test.ts` folds 6,000 varied series (every best-of, stage, difficulty, special effect, roll range and scoreline curve) and the cursor after each into a digest taken on the v2.0.35 engine, for both `simulateSeries` and a hand-driven loop with a JSON save-and-reload between games. `regression.golden.test.ts` and `balance.test.ts` pass untouched.

### Added
- **`seriesSeed(careerSeed, eventStream, roundKey, teamAId, teamBId)`** and the stream id `ser:{eventStream}:{roundKey}:{teamAId}:{teamBId}` (`engine/career/seeds.ts`, the `matchTimeline` pattern): the user's own series RNG, so it can stop between games while the rest of the round plays at once. Tested, not wired in: taking the user's series off the round's RNG would reshuffle every other series of that round, so it lands with the slice that moves results.

## [Unreleased] — broadcast package pilot (branch `design/broadcast-pilot` plus its fifth pass `4b4ecd6`, not approved; integrated in 2.1.0-rc.1)

Source: Miguel's request of 17/11 to remove the generated look from the game, audited against the anti-slop rulebook (github.com/miqdadbadjuber/anti-slop). Direction chosen by Miguel: RLCS broadcast package. Scope of this pilot: the shared primitives, the Home and the Classic Draft flow. Career screens only inherit the primitives.

### Fifth pass (18/11, the deep review: "a identidade geral ficou boa", now every screen, the career first). Published to staging.
Current state (decision #177). Where it disagrees with the passes below, this one wins. The branch now carries v2.0.33 (main was merged in; the pilot's decisions were renumbered #173 to #176).
- **Career shell.** The top bar shows the club's name, the date, balance and reputation as figures in the display face. The tabs are set in display caps, grouped by subject (clock, team, books and table, desk) with a hairline between groups, Careers apart on the right; the current tab is marked by weight and the orange rule.
- **Career HQ.** The day card is the stage: the date is the largest thing on the screen and holds the only filled button. The squad and training share one board with real titles and the team rating as its figure. The side rail is flat: race, finances, progression, season goal, inbox and transfers are sections on the floor with a hairline between them (they were boards inside boards). Progression rungs, the bootcamp and the week's scrims are hairline rows.
- **No box inside a box, no icon in a tile.** Tinted tiles around list icons are gone (goals, training options, coach card, toolbox, weekend plan). The news lead story and two notices lost their coloured left bar.
- **Market.** The reputation gate reads inside the card it locks, as its last line (it used to hang under the card as a chip).
- **Training.** "Recommended" is a flat tag inside the option, not a badge riding the border.
- **Founding wizard.** The recap figures no longer truncate ("QUARTER PI...").
- **Shape and type.** No pill is left on a tag or counter (radius 3); career labels have an 11px floor (10px for the two tightest); figures are set in the text or display face with tabular numerals (mono stays for seeds, codes and hex values).
- **Copy.** No em dash in any player-facing string, EN and PT (463 lines: career, base, pages, daily plans, components). Scores read `3-1`. Decorative arrows are off links and buttons; an arrow stays where it shows a direction (a transfer, a before and after).
- The repeated "Road to Worlds" line under every career title is gone (it said what the tab bar already says).

Second round the same day, on Miguel's review of the preview (not published yet):
- **HQ rail: the boards are back.** A flat rail read as one undivided list. Each rail section is a board again with its title ruled off in a head row (`RAIL_SECTION`, `RAIL_HEAD`); nothing inside a board is boxed.
- **News desk.** The feed has a masthead (the desk's mark and name, ruled off), the headline is a band across the feed in the display face with the crests large beside it and a button for its action, and the stories are ruled rows.
- **Training rebuilt to the standard of the other tabs.** Two columns: the plan and the squad's growth on the left; coach, the week's scrims and the report switch in a rail. The plan's head is a large title, the steps are ruled rows with their number as a figure, the picked option is the orange hairline (it used to take one of three tones), "Recommended" sits under the option's text, the promise and Start close the board instead of sitting in a box. The attribute reference is a ruled table at the foot, not six boxes.
- **Squad redistributed.** Starters, stability and contracts in the main column; bench and coach in a rail. The pitch decoration behind the starters (radial tint, stripes, centre circle) is gone; contracts are ruled rows.
- **Home.** TODAY's rows share the height of the missions board. Challenges left the TODAY list for a board of their own at mode scale, with the count of cleared challenges as its figure. Road to Worlds reads like the draft card (title, one line, the action); BETA moved to the foot with its note. The scorebug leads with the season rating on paper, then the rank; "Presented by" with the 50/50 mark sits over it.

Third round (19/11, Miguel's second review of the preview; where it disagrees with the second round, this one wins):
- **One board standard.** `.card-title` is the title of every board in the career (same face, size and weight in a main column and in a rail), `.card-head` its ruled head, boards pad 16px (20px from `sm`), and columns and boards share one 16px gap (the HQ's columns stood 32px apart over boards 16px apart). Small labels lost their per-place sizes (10 and 11px overrides on `.kicker`).
- **The desk.** The Inbox tab is as wide as the other tabs, with its title in the same place, and has three views: the inbox (list on the left, the open message on the right with sender, date, subject as a title, body and action), the News desk and the Transfer wire. The HQ's "Full feed" and "See all moves" open those views (`/career/news#news`, `#transfers`) instead of growing the HQ.
- **News.** The partner's credit sits under its mark in the masthead; the open story is a blue band between two blue rules. A news flash (toast) is a small front page (blue masthead, headline in the display face, crests), unlike a notification; the full-screen breaking story has a blue masthead, a paper "Breaking" tag and a larger headline.
- **Squad.** Bench and coach are back inside the starters' board; contracts moved to the right column.
- **Training.** The attribute reference moved to the right column.
- **Finances.** Loans and debt moved to the right column, above the ledger; the progression board's title lines up with its top.
- **Home.** Challenges are a row of TODAY again (the board of the second round is gone); Road to Worlds has its title on one line, BETA under the text and its button on the draft card's line; the 50/50 mark is a step larger.
- **Profile.** The season rating stands on the banner again, under the rank's name (no paper box).
- **Header logo.** Two weights (a medium "Rocket", a bold "Draft"), set a little open.

Fourth round (19/11, Miguel's third review; published to staging with it):
- **Capitals sit in the middle of their line.** Industry's own metrics set its capitals 0.075em low, so titles in paper slabs, tags and buttons looked dropped. The font is declared with `ascent-override` 100.5% and `descent-override` 30.5% (same line height, caps centred); the title slab's padding is symmetric again.
- **Every board in the career rules its title off** (`.card-head`): the HQ's squad and training, Squad, Training, Finances, Market, Calendar's season overview, Club, the honours table. A script listed each board title and converted the ones that open a padded board; the rest were done by hand.
- **Loans are two boards** (bank loan, emergency loan), each with its own head. They were two boxes inside a board whose title repeated theirs.
- **News.** A story's mark sits in a fixed column (rows) or a fixed square (headline), centred, so marks and text line up down the feed; rows are ruled with the strong hairline.
- **Home.** The scorebug has the rank on the left and the rating on the right; a long rank name wraps to two lines and a rating of five digits or more steps down a size. Challenges are the first row of TODAY. Road to Worlds: lighter pitch text (Medium, which matches the draft card's weight on a light-on-blue field), BETA as a framed strip under the pitch. A partner card for 50/50 sits beside the Discord card: it is not a link until `SITE.partnerUrl` is set and says "Link soon" until then.
- **Header logo.** Bold "Rocket", black "Draft", one size smaller.
- **Profile.** The last rating change reads before the total.

Not done in this pass: mobile (its own session), the event weekend and season review screens beyond the shared changes, the rhythm pass on career copy (staccato lines, aphorisms), the first-visit flow (tour, What's New and login calendar stacking). Calendar, Market, Standings, Club and Saves kept their distribution.

### Fourth pass (17/11, after Miguel's review: "too light now; bring back the solids and the title highlight, heavier weights, on to the career")
Superseded where the fifth pass says otherwise (decision #176).
- **Home modes are solids again**, with a card finish: `.solid` (14px corner, the card's top sheen and diagonal texture, a slow tone shift) in `.solid-orange` (Classic Draft) and `.solid-blue` (Road to Worlds). Upright Bold titles; the action on each is inverted (dark on orange, paper on blue).
- **Title highlight is back**: `.title-slab`, dark upright Bold on a paper slab with a slanted end and the orange chip. `SectionTitle` uses it, so every screen gets it.
- **Weights up one step**: Bold for titles, buttons and key figures (`font-bold` resolves to Bold again), Demi for labels, tags and nav, text 400 / 600. Black and Ultra are still not loaded; synthetic bold is still off.
- **Home**: about 40px less air above the wordmark; the season rating sits on a paper cell beside the rank; the header logo is upright.
- **Career**: 7 blurred colour orbs removed (Club, Saves, Standings, crest step, founding splash); glow removed from states (bracket cells, Swiss verdict, weekend plan, ladder highlight, player tiles, finance and wizard selections, the announcement dot); the two leftover gradient-plus-halo buttons (Calendar, match centre) are the flat primary; the career tab bar is solid and marks the current tab with ink text and an orange rule; wide-tracked labels tightened. Gold glow stays on trophies, the S grade, champion saves and Championship Sunday (reward). No career layout was changed.
- Checked in a desktop browser at 1366 px on this pass: Home, career HQ, career Finances. Not checked: mobile, PT, the other career screens, tournament, results.

### Third pass (17/11, after Miguel's review: "on the right road, overdone; more minimal and premium")
Current state. Where it disagrees with the two passes below, this one wins (decision #175, `DESIGN.md` rewritten).
- **The card is the reference object.** Floor and boards went back to the cards' night blue (`--bg #070a11`, boards in the two tones of a common card's body); `.panel` is that body inside a hairline with a 12px corner. The radius scale steps up to the card: tag 3, button 7, board 12, card 14.
- **Weight**: nothing heavier than Demi, text never heavier than Medium. Enforced in the font files (display 500 / 600, text 400 / 500, no heavier upright file) plus `font-synthesis-weight: none`, so every `font-bold` in the app resolves down with no code change.
- **Italic** only on the wordmark (header logo, Home title). The global italic rule for headings is gone.
- **Removed from the second pass**: paper title slabs (`.slab`), the slanted primary button (`.btn-cut`), stripe fills (`.stripes`), the solid orange and blue mode fields, the paper and orange scorebug, the paper active tab.
- **Top bar on panels removed.** `panel-glow-blue` / `panel-glow-orange` and the `glow` prop now only colour the panel's hairline.
- **Section titles**: the small slanted orange tick, then the title in upright Demi (`.title-tick`); the kicker still reads under the title as a sentence.
- **Buttons**: primary is flat orange with dark text; sizes back one step. **Badge**: Medium, 11px. **Header**: the current section is ink text over a 2px orange rule.
- **Home**: italic wordmark at a calmer size; rank art, rating and season on one quiet board; the two modes use the gold and blue card frames with the card texture (they are the two largest cards in the game); TODAY list and YOUR PROGRESS strip kept, in lighter type.
- Checked in a desktop browser at 1366 px: Home, draft (cards beside the team board), review. Not checked in this pass: mobile, PT, tournament, results, career.

### Second pass (17/11, after Miguel's review: "not close, bolder")
The first pass below only removed things and left dark boxes with thin lines, the "sterile default" the rulebook warns about. This pass adds the direction, written first in `DESIGN.md` (decision #174). Where the two passes disagree, this one is current.
- **Direction file**: `DESIGN.md` at the repo root (design read, palette, type, the motif, composition, motion, copy, a "never" list).
- **Type**: Rajdhani and Geist Sans are out of the interface. Text is Barlow (400, 600). The display face Miguel chose is **Industry**; the only files in hand are the trial set (personal-use licence, 66 characters), so it is wired for LOCAL PREVIEW ONLY from the git-ignored `public/fonts-trial/`, in a marked block of `globals.css` that must go before anything ships. Barlow Condensed (600, 700, 800 italic; OFL, committed) is the live stand-in and the fallback for every character the trial files lack.
- **Palette**: floor `#0b0d12` (neutral ink, was navy `#05080f`; theme colour, manifest and error screen follow), orange `#ff6a1a`, blue `#2463ff`, paper `#f3efe6`. Cyan became the lightest blue. Text greys re-solved for contrast.
- **The cut**: one 12 degree slant in three places. Section titles are a paper slab with an orange chip (`.slab`, used by `SectionTitle`, whose kicker now reads under the title as a sentence); the primary button is an orange slab cut on both ends (`.btn-cut`); the active nav item is a paper slab. Plus `.stripes` as texture for an empty field.
- **Headings** in the display face are heavy italic everywhere (one CSS rule on `h1`-`h3.display`).
- **Panels** are fills with no outline (transparent border kept for callers' state colours); a panel inside a panel steps up one fill.
- **Header**: solid bar, no blur.
- **Home recomposed**: wordmark as a title card with a three-cell scorebug (rank art, season rating on paper, rank on orange); the two modes as solid orange and blue fields facing each other; TODAY as a rundown list beside the missions board; YOUR PROGRESS as one four-cell stat strip.
- **Base**: `cursor: pointer` on every enabled control, `not-allowed` on disabled ones (in `@layer base`).

### Changed
- **Surfaces are solid.** `.panel` and `.panel-strong` lost the gradient and the backdrop blur and use two flat fills (`--surface`, `--surface-strong`). The lite-effects fallback for panels is gone: there is nothing left to fall back from.
- **Corners are hard.** The Tailwind radius scale is cut in `@theme` (sm 2, md 3, lg 4, xl 6, 2xl 8, 3xl 10 px), so every `rounded-*` in the app follows. Trading cards keep their own 14 px (`.card-frame`).
- **No ambient glow.** The three radial glows behind every page (`body::before`) were removed; the canvas is flat `--bg`.
- **The `glow` of a panel is a team bar.** `panel-glow-blue` / `panel-glow-orange` (and the `glow` prop of `<Panel>`) draw a 3 px bar on the panel's top edge instead of a halo. Class names unchanged, the 34 call sites untouched.
- **Primary button**: flat orange, no gradient, no halo. **Secondary button**: neutral outline with ink text; blue only on hover.
- **Badge**: a flat tinted tag with no outline, tighter tracking.
- **`.kicker`**: letter-spacing 0.22em → 0.06em, so it reads as a scoreboard column head.
- **Header**: the current section is marked by an orange bar on the header's bottom edge, not by a tinted pill.
- **Home**: the centred hero (season eyebrow, tagline, gradient wordmark, rank chips) became a left-aligned wordmark and pitch with the player's line (season, rank, rating, runs, titles) set as a scorebug on the right. The two mode blocks lost their blurred orbs. The "Live" tags on Classic Draft, Daily Challenge and Daily Quiz are gone (nothing was live; a streak still shows). Road to Worlds keeps one tag (Beta); "New" stays on the nav item only. Its button now says "Play career" and the slogan became a line of text. The arrows left "Play now" and "Quick Draft" (EN and PT).
- **Tournament**: finished bracket cells no longer glow (the green / red border already says win or loss); bracket labels use the tight tracking.

### Not changed, on purpose
- Card rarity frames, sheens and halos, cosmetics, rank art, the rank-up and reward ceremonies: glow and motion stay where they mean rarity or reward.
- The colour values. The audit named the stock hues; the pilot fixes how colour is used and leaves the hexes, which appear as literals in over a hundred places.

### Not verified
- Mobile widths, PT screens, lite-effects mode, and every career screen except the HQ. Checked in a desktop browser at 1366 px: Home, setup, draft, review, tournament, results, career HQ.

---
## [2.0.36] — 2026-11-22 · The career landing answers the mod searchers

Source: Search Console comparison 14–18/11 vs 19–21/11 and the live SERP of 22/11. A PC career mod (released ~13/11) took over "rocket league career mode": the AI Overview, two video blocks and Reddit. The landing fell from position 3.0 to 6.4 and its CTR from 26 % to 11 %, while clicks per day held (173 → 167) and impressions grew 49 %.

### Changed
- **The career landing's search description leads with what a mod cannot offer:** no PC mod, no download, plays on phones. The title stays "Rocket League Career Mode & Manager Game — Free": "manager" is a search the landing wins (position 1.6–3.3), and nobody searches "no mod", so that angle lives in the description and the body.
- **The first section sorts fan-made career modes into in-game PC mods and browser career simulators**, the split the AI Overview uses, and names Road to Worlds as the second kind. A new section, "A career mode without a mod", says what the mods need (PC, a hub or plugin, bots) and that console and phone players can run a career here.

## [2.0.35] — 2026-11-19 · The Collection's two survey additions go quiet

### Changed
- **The next collection reward is a small faint line under the unlock count** ("Next: Collector · 12/15", specials album only, nothing once every milestone is reached). v2.0.34 had put it, with the XP, in a full-width row between the title and the album tabs, which broke the page's original layout (Miguel's review).
- **The RLCS database link is a small centred line at the end of the page** (it shared that row, in bold blue).

## [2.0.34] — 2026-11-19 · We heard you: fixes from the player survey (BALANCE_VERSION 37)

Source: Miguel's player survey of 18/11 (28 answers). Plan and competitor study: docs/PLANO-PROXIMO-NIVEL-2026-11-19.md, docs/CONCORRENTES-2026-11-19.md. The mobile career tab bar (A7) is Miguel's, separately.

### Fixed
- **A sponsor goal signed mid-season no longer resets at the rollover.** Root cause: a contract goal (v2.0, C1) counts every event from its signing day to the deal's end, but it read its progress off `save.eventResults`, which `rolloverToNextSeason` empties every season. A deal signed in split 2 that ran into the next season lost its first season's results, so its count (sized for the whole deal) read as reset and could become out of reach ("win 8 regionals"). The user's own results now go with the deal at the rollover (`SponsorTerms.carriedResults`, additive, without their placement tables; `careerFlow.carrySponsorResults`). Test: careerSponsors.test.ts.
- **A mismatch in the career no longer reads 7-0 every game.** Root cause: the scoreline (narrative only) grows linearly with the game's margin up to the 7-goal cap, and a career's wide gaps (a 100+ side against a 75 one) sat on the cap. Road to Worlds sides (`careerScoreline`, set by `assembleTournamentTeam` with the career's own form roll) read `SIMULATION.goals.career`, whose margin effect levels off: close games score as before, a mismatch reads 4-0, 5-1, 6-2 or 5-0. Same draws per game, so no result, seed or battery moves. The Draft keeps its curve: 7 challenge stars are tuned on its goals. Test: match.scoreline.test.ts.
- **No more "Kimchi II".** Root cause: a long career runs past a region's name bank (about 100 to 170 names) and the next fillers and rookies reused it with a Roman numeral; the five names that clash with a real pro carried " II" from the start, cross-region homonyms a region tag. A new career reads **name bank 4** (`CAREER_NAMES`, `world.nameBankVersion` 4): a wrapped name or a clash is a gamertag variant ("Kimchi7"), the first region keeps a homonym plain, and a seeded share of the approved org names takes a real-scene shape from its first word ("Team Waffle", "Waffle Gaming", "Waffle Esports", "Waffle"). Every change maps a name one-to-one in place, so no bank slice shifts; a career started before keeps bank 3 and every name it has. Tests: careerNames.test.ts.

### Added
- **The Collection shows the next collection reward** ("Next reward: Collector at 15 specials (12/15) · +250 XP"), read from the same milestones the achievements use (`SPECIALS_MILESTONES`), and links to the RLCS database (`/rlcs`), which only the footer linked before (players asked for "an index of every team").
- **A one-off HQ card about several careers and the account copy** (`SavesNotice`, `lib/careerSavesNotice.ts`): players asked for both, which exist since v2.0.26 and v2.0.30. It shows once per device, after a career's opening weeks, and lives in its own localStorage key (not in the save, so the account copy never differs over it).

### Not changed (reported to Miguel)
- **Org-less stacks** (the current Ikkaku) still ask a buyout like an org: the dataset has no "stack" marker, so this needs a field in `teams.md` and Miguel's list of stacks.
- **"Mate y Tapa has no Worlds bonus"** is not a bug: the org bonus is the curated prestige per lineup (`org: Mate y Tapa ~`), not a result; 23 of 44 2026 lineups have `~`.

## [2.0.33] — 2026-11-18 · The career landing answers "career mode" searches, with a one-tap start beside the usual one

Search pass from Miguel's Search Console export (17/08–16/11) and PostHog (12–18/11): `/rocket-league-manager` became the first organic landing page on 17–18/11 (145 search visitors in two days, the home 96); of its visitors 51 % opened the career and 30 % founded one, and 42 % of those who reached the founding wizard left it. Google showed the guide, not the landing, for "rocket league career mode". DESIGN-DECISIONS #172, ROAD-TO-WORLDS-DECISIONS R136.

#### Added
- **Two buttons on the career landing (EN/PT):** "Found your club" / "Fundar o seu clube" opens the founding wizard as before, and beside it "Start with a random club" / "Começar com clube sorteado" opens **`/career?start=quick`** (`lib/careerEntry.ts`, `LandingConfig.secondaryCta`, copy `ctaAltLabel`). With the flag, a player who has a career lands on it as before; a newcomer goes to the founding wizard with the flag kept (`CareerShell`), and the wizard runs its own Quick start (a random club, straight to the last step: pick the difficulty, found it). Which start works better is measurable in PostHog: the `$pageview` of `/career/new` carries `?start=quick` or not.
- **An active team's page names its current roster:** "Gentle Mates Rocket League Roster — RLCS 2027 & Past Seasons" (title and H1, `currentSeasonOf` in `lib/database`), for a team with a roster in the newest season; the others keep "… Roster by Season". The roster searches in Search Console carry the year ("… rocket league roster 2027", positions 5–11).
- **`public/llms.txt`**: a short map of the site for answer engines (the two modes, the career landing and guides, the draft guides, the RLCS database). robots.txt already allows every crawler.
- **Career landing (EN/PT):** a first section answering "Does Rocket League have a career mode?" (not in the game; fan-made mods on PC, downloadable manager games and browser games; Road to Worlds is the browser club-manager kind) and two FAQs, "Do I need a mod, a download or a PC?" and "Do I play as a player or as the manager?". The section captures shift by one (`ContentPage`).
- **The landing's own share image**, Open Graph and X card, EN and PT (`public/landing/career-share-{en,pt}.jpg`, 66 KB, `careerShareSrc`), passed to the page metadata through `pageMetadata`'s new `image` option with the H1 as its alt text. `scripts/build-og-career.mjs` renders them with Chrome's headless screenshot, the site font and the HQ capture, and fails when a title overflows. Before, every page shared the site image. Not the `opengraph-image` file convention: Next ignores a route's image file when the page's metadata sets `images` (every content page does), and Turbopack drops its `.alt.txt` in a nested route (both checked on the export).
- **A `VideoGame` node for Road to Worlds** on the landing (`careerGameJsonLd`: free, browser, part of Rocket Draft, the five landing screenshots); its Article node points at the page's own image.

#### Changed
- **Titles and the H1.** Landing: "Rocket League Career Mode & Manager Game — Free" (was "… — Free RLCS Manager Game"), H1 "Rocket League Career Mode & Manager Game — Road to Worlds" (also the anchor text every content page uses for it), description "…in your browser, no mod or download…". Guide: "Road to Worlds Guide: Rocket League Career Tips" / "Road to Worlds: Guia da Carreira de Rocket League", so it stops competing with the landing for the head query.
- `CONTENT_DATE` 2026-11-18 (sitemap `lastmod`, Article `dateModified`).
- `scripts/link-audit.mjs` drops a link's query and hash before matching it.

#### Fixed
- **The eight Road to Worlds guide pages sent "Start a Road to Worlds career" to the home page.** Root cause: the guides (v2.0.19–2.0.20) copied the route shell of the plain content pages, whose button ("Play Rocket Draft now") goes to `/`; only the landing pointed at `/career`. Their visitors who pressed it met the main menu and had to find the career again. They now open `/career`.

## [2.0.32] — 2026-11-18 · A page whose build files failed to load repairs itself

#### Fixed
- **A player's Road to Worlds stayed on the loading placeholder in one browser, reloads included** (reported on Discord 18/11). His save was intact and opens normally in the current code; another browser played an older copy. Root cause: version skew during the v2.0.31 deploy (new sessions switched between 17:45 and 17:50 UTC; his last career action was at 17:49:02). A page from the new version asked a Cloudflare location still on the old one for a new career chunk and got a 404. `public/_headers` gives `/_next/static/*` `public, max-age=31536000, immutable`, and Cloudflare sends that header on the 404 too (checked with curl on production), so Chrome kept the 404 for a year and served it on every load, a normal reload included (checked: `only-if-cached` returns it). Turbopack's runtime, for a chunk whose `<script>` tag is already in the HTML, only listens for that tag's `error` event; a tag that failed before it looked never settles the chunk's promise, so hydration waits forever: the server-rendered skeleton, no error screen, no analytics event (PostHog has nothing from him). When the race goes the other way the same 404 shows "Something went wrong", and its reload brought the cached 404 straight back. Only career chunks were hit, so the other modes played. A player stuck before this release fixes it with Ctrl+Shift+R on the career page; the save is not touched.
- **The repair (DESIGN-DECISIONS #171):** an inline script in the root layout (`lib/assetHeal.ts`, production builds only) watches the page's resource entries. A `/_next/static/` script, or a stylesheet the page applies, answered 400+ is fetched again with `cache: "reload"`, which replaces the cached copy, and the tab reloads once. Browsers without `responseStatus` (Safari) get a watchdog instead: the app not mounted 20 s after `load`. One repair per tab per minute, none without sessionStorage, none for a network failure or a prefetch. A browser that already holds such a 404 heals on its next visit, with nothing for the player to do. The error screen's reload (automatic and the button) now fetches the failed chunk again first (`errorRecovery.chunkUrlOf`, `assetHeal.refetchThenReload`).
- Analytics: the load after a repair sends one `quality_error` with source `heal`, name `AssetHeal` (`AssetHealReport`, `analytics.reportAssetHeal`).
- Checked: unit tests (`assetHeal.test.ts`, `errorRecovery.test.ts`, full suite); in Chromium against a local server that answers a chunk with a one-year immutable 404 first (without the script the 404 is reused on reload; with it the page heals, also when the 404 was cached before the script existed); and on a local production export served by `wrangler dev` (it answers a missing chunk exactly like production) with the player's own save: career chunk `0sym80-l3ozyx.js` cached as a 404, the career broken; once served again, the repair refetched it, reloaded once and the career opened intact. Not checked: the watchdog in a real Safari, the zone rule (Miguel's dashboard step).

#### Changed
- `docs/DEPLOY-CLOUDFLARE.md` §9: a zone Response Header Transform Rule sets `Cache-Control: no-store` on a 404 under `/_next/static/`; §10 checks it after each deploy. `public/_headers` explains why.

## [2.0.31] — 2026-11-18 · An invitation to the player-research form

#### Added
- **An invitation to Miguel's player-research form, for returning players only.** It never opens when the game loads: it waits for a natural pause, the draft results screen (after the ceremonies, the login calendar, the unlock pop-ups and the XP count-up, plus 2.5 s) or the Road to Worlds season review (not on an insolvency). From the **second distinct day** with the game open (`login.total`), a player qualifies with **10 completed runs** or **1 completed season** in the career on screen; on the first day only a heavy session does (**25 runs** or **2 seasons**). Miguel, 18/11: a one-day heavy player may see it, the second day is preferred. Thresholds, the form URL and a campaign id live in `src/config/research.ts` (not gameplay, so BALANCE_VERSION does not move); logic in `src/lib/researchInvite.ts`; the card is `components/ResearchInvite.tsx` on the portal Modal, the link opens in a new tab (`noopener noreferrer`).
- Once per device and campaign: a click on the link or a dismiss ends it for good; a card left unanswered (tab closed) may open once more (`maxShows` 2), never twice in one page load. Stored in its own key `rocket-draft:research-invite:v1` (plain localStorage, not a persisted store: the persist contract is unchanged). Per device rather than per account owner: since 2.0.29 a sign-out leaves a fresh guest who does not qualify, and two accounts on one device are not asked twice. A new `campaign` id asks everyone again.
- Analytics: `research_invite` (critical, shared mode) with `action` = `shown` / `opened` / `dismissed`, `surface`, `campaign`, `activeDays`, `runsCompleted`, `careerSeasons`. A few per device ever, so no budget pressure.
- Copy in EN/PT (`RESEARCH_UI`; career `research` in `copy.career.*`).

## [2.0.30] — 2026-11-18 · A way back to the career picker

#### Fixed
- **Road to Worlds had no way back to the career picker once a career was active** (Miguel, 18/11: "ao clicar na carreira já entra direto no save"). Root cause: `/career/saves` was reached only when no slot was active, after retiring, or from the wizard; the top bar had no link to it, so a second or third career (or one the account brought from another device) could not be opened. The top bar (desktop tabs and the mobile menu) now ends with **Careers / Carreiras**, using the `nav.saves` label that already existed in both languages.
- **A profile row could not be emptied by hand** (Miguel, cleaning the account mixed by the 2.0.29 bug: `durable` is NOT NULL, so `set durable = null` fails). A row whose `durable` is `{}` now reads as "no saved profile": the next sign-in pushes the device's profile over it, name, grants and frozen pre-season columns untouched.

## [2.0.29] — 2026-11-18 · Signing out leaves a fresh guest; one account's progress and careers never reach another

#### Fixed
- **Signing out kept the whole profile on the device, and the next account to sign in received it, exclusive grants included** (Miguel, 18/11, on mobile: signed out of his main account, the progress stayed; signed into a second account, all of the first one's progress and grants went into it). Root cause: the local profile had no owner. There is one per device, signing out never touched it, and every sign-in merged it into the account that signed in as if it were a guest's progress (the guest → account migration). Now the device's saves belong to one account at a time (`rocket-draft:profile-owner:v1`, `lib/localOwner.ts`):
  - a guest's progress is still claimed by the first sign-in;
  - signing out (here, in another tab, or an expired session) pushes unsynced progress once (up to 4 s), stashes the profile under that account (`rocket-draft:account-stash:v1:<id>`) and resets the device to a fresh guest;
  - a sign-in as another account than the owner stashes the owner's saves and starts clean; the account's next sign-in folds its stash back in;
  - a sync whose account signed out while its cloud read was in flight aborts instead of merging into the guest.
- **The Road to Worlds slots had the same hole since the career cloud save (2.0.26–2.0.28).** The three slots are the device's, so the second account's first sync uploaded the first account's careers into its own account (an empty account slot + a local career = "a new career, upload"). The slots now go with their owner: signing out moves them aside (`rocket-draft:career-stash:v1:<id>`, a move, not a copy, since three slots can pass 1 MB) and the device shows no careers; that account's next sign-in puts them back, a guest's careers keep their slots and the account's fill the empty ones. The career cloud store ignores the slot change a switch causes, so moving a career aside is never read as the player deleting it (it would have deleted the account copy at the next sign-in). The account's three cloud slots download to any device as before.
- Deleting the account still keeps the local progress and careers, as its dialog says, now as the guest's.
- Accounts already mixed by this bug are not separated by the fix: the second account's row has to be restored by hand (the merged progress is in its blob; career rows in `career_saves` for that account, if any went up).

## [2.0.28] — 2026-11-18 · Career cloud save for every account; sell and trade reach production

#### Changed
- **The career save in the account is open to every signed-in player** (`CAREER_CLOUD_AUDIENCE` "staff" → "all", `lib/careerCloudGate.ts`; Miguel's call on 18/11). v2.0.26 had it for the `creator` grant only. Setting the constant back to "staff" or "off" and deploying is the way back; localStorage stays the copy the game plays from either way.
- **Sell and trade (v2.0.27) goes to main with this release**, on Miguel's go-ahead after seeing the screens. Not verified before release: a physical phone, a full battery, the account path on two devices and on mobile Safari.

## [2.0.27] — 2026-11-17 · Road to Worlds: sell and trade on your own initiative

Players asked for it (ROADMAP-RTW-2026-11-17, Etapa 1): until now a sale needed an AI bid to arrive. Closes ECO-06; decision R135 (reopens R63). Ships without waiting for the Etapa 1 gate.

#### Added
- **The transfer list.** Market → My Deals → *List a player* (also from the Squad screen): pick an asking fee between 70 % and 160 % of his market value, two players at most. An org of his region answers in 1 to 3 days: it pays a fair ask in full, counters a high one, or does not answer one that is far too high. The answer is an ordinary offer to accept or decline. `engine/career/transferList.ts`, `listPlayerFlow`, `delistPlayerFlow`.
- **Player-for-player trades.** From the offer sheet of a player under contract: *Propose a trade* with one of your squad and optional cash. The org answers in 1 to 3 days: yes, a counter in cash, or no (the gap is too large, or your player is more than 8 overall below theirs). A yes waits for your confirmation and holds the clock like a bid. The arrival passes every signing gate and signs at his ask; no fee, no severance. `proposeTradeFlow`, `acceptTradeFlow`.
- HQ shows an agreed or countered trade as a decision card; the inbox and the feed report every answer.

#### Balance
- BALANCE_VERSION 36. `CAREER_TRANSFER.listing` and `.trade` (all provisional). A buyer's ceiling is market value × 0.85–1.15 plus half the youth premium, below what a poach pays (1.0–1.35 with the full premium). A trade credits your player at × 0.85–1.05 against the fee a plain buy would cost; the org never pays a difference.
- **Short tenure:** a player who signed under a season ago is worth 60 % to a buyer and in a trade. A free agent costs no fee, so signing one to sell him on would otherwise be a repeatable profit. Founders are not discounted.
- **No buying back:** a player you sold or traded away does not sign for you again for one season (`buyBackLockSeasons`), an ordinary bid's sale included. Selling at a buyer's ceiling and buying back on a cheap day would otherwise pay the difference every time.
- Both work in a transfer window only, never in the career's first window, never under the resale lock. One draw per player and window: re-pricing does not re-roll the buyer.

#### Changed
- Saves gain three optional fields (`transferList`, `tradeProposals`, `soldOn`) and two optional offer fields (`listed`, `ask`). Persist keys and versions are unchanged; new RNG streams only, so a career that never lists or trades draws the same numbers as before (the one difference: it can no longer re-sign a player it sold within the season). No new analytics event.

#### Not verified
- Measured in a short probe only (2 careers, 4 seasons: no soft lock, world rosters intact), not in a battery. Checked in a desktop browser and at 320 px in emulation; no physical device.

---
## [2.0.26] — 2026-11-17 · Road to Worlds: the career save in your account, and save files

Roadmap Etapa 1 (ROADMAP-RTW-2026-11-17), shipped ahead of the stage gate because players are asking. Decisions: DESIGN-DECISIONS #165–#169. SQL: `docs/sql/v2026-career-saves.sql` (applied by Miguel on 17/11).

#### Added
- **A copy of each career slot in the account** (`store/careerCloudStore.ts`, rule in `lib/careerCloud.ts`). The save in the browser stays the one the game plays from. Progress goes up 30 seconds after the last action, at once at the end of an event or a season and when the tab is hidden. A device that is behind takes the account copy when the career opens, with a one-line message. **First release: the creator grant only, which is Miguel's account** (`CAREER_CLOUD_AUDIENCE`).
- **A notice when two copies differ**: the career was played on two devices, the slot holds another career in the account, or the account copy was deleted elsewhere. Both copies are described (club, season and week, date), the newer one is marked, and the player chooses; the device's career can be exported first. Nothing is replaced without that choice.
- **Save files** on the saves screen, for everyone, guests included: export a career to a file, import one into an empty slot. The import runs the game's own migrations and refuses a damaged file, a file from a newer version and a file the game cannot load.
- Analytics: `career_cloud_failed` (stage, reason) and `career_cloud_conflict` (kind, choice).

#### Changed
- Deleting a career slot while signed in deletes its account copy too; the confirmation says so.
- `careerStore.adoptSave`: the one way a save from outside the play loop enters a slot (account copy or file), through the same migrations and repairs as a save loaded from storage.
- `lastPlayedAt` is strictly increasing (the clock, but always past the previous stamp): the cloud rule compares it for equality.
- Found by the persistence review before release and fixed: on a shared browser a second account's career could be written over the first account's copy without a question (a slot with a different career now goes up only after the player's own delete or replace); an answer in the notice could be applied to a situation that had changed while it waited (it is now checked against what the player saw); a delete could remove a copy another device had just played (it now names the revision).
- BALANCE_VERSION 35: `CLOUD_SYNC.careerPushDebounceMs` and `careerRecheckAfterMs`. No gameplay value changed. The persist contract is unchanged (key `rocket-draft:career:v1`, version 3, saveVersion 5); the sync's bookkeeping is a new plain key, `rocket-draft:career-cloud:v1`.
- Not verified: the account path against the production database (staging runs with accounts off; the store is tested against a simulated Supabase and the SQL was reviewed, not executed by the tests). Two real devices, mobile Safari, and a browser without `CompressionStream` are not checked.

## [2.0.25] — 2026-11-17 · Account sync: failures are named, tried again, and an expired token no longer reads as a new account

First step of the Road to Worlds cloud save (ROADMAP-RTW-2026-11-17, Etapa 1): the profile sync it will ride on. POSTLAUNCH-2.0-REPORT item 6 counted failures on 12% of signed-in players. PostHog, 12–17/11: 47 sessions with a failed sync, 35 of them on a phone, 26 on the read and 24 on the push, on every release from 2.0.1 to 2.0.24. Almost all happen in the middle of a session (four in the first 20 seconds) and the session goes on afterwards, so it is neither a regression nor a tab being closed. The event carried only the stage, so the share of each cause below is not known yet.

#### Fixed
- **A sync with an expired token ran as nobody.** Root cause: when the access token has expired and its refresh fails (a phone waking a tab after an hour), supabase-js sends the request with the public anon key (`_getAccessToken` falls back to it). Row-level security then hides the player's row, `fetchCloudRow` answered "no row", and the sync treated an existing account as a new one: it pushed without merging the cloud copy and the push was refused. Nothing was lost (the refused push wrote nothing), but it was counted as a push failure and the session stayed unsynced. `fetchCloudRow` and `pushCloudProfile` now check that the session belongs to the user they are called for and report `auth` otherwise.
- **A failed sync was not tried again.** Root cause: one attempt per read and per push, and a sync that failed was repeated only by the next profile change (or, for the first sync of a page load, by a later sign-in event; until then no progress was pushed at all). A failed read that may pass (dropped connection, server error) is now tried again inside the sync (`CLOUD_SYNC.retryDelaysMs`). A sync that still failed is owed, per user: the whole read, merge and push runs again after a pause (`CLOUD_SYNC.resyncDelaysMs`, the last one repeating), when the connection comes back, when the tab returns, or with the next progress. A failed push is never repeated on its own, because the cloud may have changed since the read.
- **The request carries the checked token itself** (`setHeader`), so it cannot go out with the anon key even if the session disappears between the check and the request.
- **A new account could get a name with four digits because the network failed.** Root cause: any failed first push of a new account took the fallback name (email prefix plus four digits), not only a refused name. Only a constraint refusal (the unique name) takes it now.

#### Changed
- `account_sync_failed` carries `reason` (offline, network, auth, denied, conflict, server, rate, unavailable, other; `lib/syncErrors.ts`) and the database code when there is one. It is sent once per session, stage and reason.
- BALANCE_VERSION 34: `CLOUD_SYNC` gained the retry pauses (it lives in `balance.ts`, so the fingerprint moves). No gameplay value changed.
- Not verified: against the production database (staging runs with accounts off; the store is covered by tests with a simulated Supabase). The share of each reason is only known once this release has run in production for a few days.

## [2.0.24] — 2026-11-17 · A newcomer reaches the game sooner

Launch data, 12–16/11: 519 of 903 new players left without playing anything; on mobile 36% left after one page. A new player had to close three full-screen pop-ups before the home page (welcome tour, the 2.0 announcement, the login calendar), and the home page was always English.

#### Changed
- **The game starts in Portuguese when the browser asks for Portuguese** (`initialLang`, first language of `navigator.languages`). Only the initial value on a device with no saved settings: a saved choice wins and the /pt pages still set PT. About 140 new players with a Portuguese browser had seen the English game (119 from Brazil); the ones who got Portuguese played in 77% of cases against 46%.
- **The 2.0 announcement is shown only to a player with a pre-season** (`legacy.preseason`). It announces a new version and pre-season rewards to someone who never played 1.x. A veteran on a new device sees it once the account syncs.
- **A newcomer's first login pays its XP without opening the calendar.** It opens from the second day on, and at once for anyone who has already played.
- The welcome tour is unchanged, so its own effect can be measured next.

## [2.0.23] — 2026-11-16 · The new-player flag counts new players; Hard pays the title and the final

#### Balance
- **Hard pays Season Rating for the title and the final only** (third / fourth 2 → 0; BALANCE_VERSION 33). On the current table Hard was the best climb per run: +3.1 on 744 worldwide runs against Normal +1.7 and Legacy +1.1; the same results now net about +2.4. Future runs only.

#### Fixed
- **`session_started.existingPlayer` was true for almost every new player** (16 "new" in 1,061 first sessions, 12–16/11). Root cause: `profileHistory` treated any XP as history, and the day's login reward (25 XP) is paid when the app opens, before the device's first session is counted. XP now counts as history only above what a first login pays; achievements count too. The flag is decided once per device, so devices first seen before this release keep the wrong value: for 12–16/11 a new player is a first session (`sessionNumber` 1) with `runsCompleted` 0, `xp` ≤ 50 and `achievements` 0, which gives 903 new players (116 / 285 / 162 / 137 / 203 a day).

## [2.0.22] — 2026-11-16 · Reward pop-ups stay off the content pages

#### Changed
- **The daily-login calendar and the cosmetic-unlock ceremony open only on the game's own routes**: the home menu, /play, /career, /challenges, /collection, /profile, /leaderboards, /missions, /achievements, /quiz and /settings (`isGameRoute`, `src/lib/gameRoutes.ts`). On the articles, the career landing, the RLCS database, /how-to-play, /pt and the reference pages nothing opens. The XP is credited as before; the pending pop-up stays in its store and opens on the first game route of the session.

#### Fixed
- A first visit from a search result was met by the Daily Login calendar on top of the page it came for, the new career landing included. Root cause: `AppShell` mounted `LoginStreakModal` and `CosmeticUnlockModal` on every route.

## [2.0.21] — 2026-11-16 · The career landing page shows the game

#### Changed
- **`/rocket-league-manager` and `/pt/manager-rocket-league` are a landing page**: the "Start a Road to Worlds career" button sits under the intro, beside four selling points (free, no download, no account, desktop and mobile), above a capture of HQ. Four sections carry a capture of their screen (Calendar, Market, Finances, Standings), and the four guides are cards. The copy, the H1, the section headings and the FAQ are unchanged, so the page keeps what it ranks for. `ContentArticle` takes an optional `landing` config; every other content page renders as before.
- The button opens `/career` (it opened the home page, two clicks from the mode).
- Captures: `public/landing/career-<screen>.webp` at 1600 px and 900 px, taken at 2x from the static export with a save from `careerPerfFixtures.probe.test.ts`; `careerShotSrc` in `src/lib/assets.ts`; a `/landing/*` cache rule in `_headers`.

#### Fixed
- The landing said training "targets individual attributes". Root cause: copy written before the rc.35 training cycle. It now says training runs in two-week cycles with one plan for the squad.

## [2.0.20] — 2026-11-16 · Three Road to Worlds guides: transfer market, finances, training

#### Added
- **Transfer market guide** (`/rocket-league-manager-transfer-market`, `/pt/manager-rocket-league-mercado`): windows, free agents and buyouts, the reputation gate, the contract talk, rival bids, the reserve and the coach market.
- **Finances guide** (`/rocket-league-manager-finances`, `/pt/manager-rocket-league-financas`): the Monday statement, prize money and the players' share, sponsor profiles and goals, the two loans and the floor, the progression ladder, getting out of the red.
- **Training guide** (`/rocket-league-manager-training`, `/pt/manager-rocket-league-treino`): the 14-day cycle, the three objectives, focus / intensity / scrims, the coach, potential / peak / decline, the reserve and the gear.
- All three are career-only pages (`CAREER_ONLY_PAGES`, `CAREER_LANDING`), written from the in-game tour and explainer copy, with no balance numbers except the 14-day cycle. Every content page links to them.

#### Fixed
- The Road to Worlds guide (v2.0.19) said training "targets individual attributes". Root cause: the sentence was taken from the landing page, which predates the rc.35 training cycle. It now describes the cycle: objective, one squad focus, intensity, scrims.

## [2.0.19] — 2026-11-16 · Search pass: career mode in the titles, a Road to Worlds guide

Source: Search Console, 15 Aug – 14 Nov 2026 (2,426 clicks, 57 % of them on the brand name).

#### Added
- **Road to Worlds guide** at `/road-to-worlds-guide` and `/pt/guia-road-to-worlds`: region and difficulty, a first roster, training, the calendar, the finances, renewing the squad. A career-only page like the landing (`CAREER_ONLY_PAGES`, `CAREER_LANDING` in `postexport.mjs`), linked from both home pages and from every content page.
- Landing FAQ: "Does Rocket League have a career mode?" (EN and PT).

#### Changed
- **Career landing** title and H1 lead with "Rocket League Career Mode": it is the career query with the most searches (83 impressions; "manager game" 51, "career simulator" 25) and the title did not contain it. "Manager Game" stays in both.
- **Home description** (EN and `/pt`) names the career mode in its first sentence; it sat at the end, past the point where the snippet is cut. The home title is unchanged.
- **Team pages**: "{team} Rocket League Roster by Season" (was "{team} RLCS Rosters by Season"). The searches are "g2 rocket league roster", "vitality rocket league roster". **Player pages** carry "Rocket League" after the nickname for the same reason.
- Home section and link text for Road to Worlds say "career mode". `CONTENT_DATE` is 2026-11-16.

## [2.0.18] — 2026-11-16 · Rank emblem in the pre-season rank titles, smaller Verified seal

#### Changed
- **Pre-season rank titles** carry the rank emblem between the prefix and the rank: "PRE-SEASON (emblem) CHAMPION", from Bronze to Supersonic Legend. Wherever the title shows (leaderboards, profile, peek, locker, unlock pop-up); colours, glow and rarity unchanged.
- **Verified seal** on the profile is smaller (17 px, 20 px on wide screens; was 22 / 26), still centred on the capitals.
- Staging preview board: the fictional players' season XP spreads over every rank (it stopped at Silver).

## [2.0.17] — 2026-11-16 · Verified seal

#### Added
- **Verified**: a blue scalloped seal with a white check, drawn right after the player's name on the profile, on every leaderboard row and in the profile peek. Miguel grants it by hand: a `profile_grants` row with `grant_id = 'verified'` (`docs/sql/v2017-verified-grant.sql` widens the check constraint and has the grant and check queries). The public `leaderboard` view already carries every grant, so the boards need no schema change.
- It is not a cosmetic: no locker slot, no toggle, nothing to equip or hide. It shows wherever the account's grants carry it.
- A newly verified player gets the unlock pop-up once (same ceremony as a title or badge, the seal as the art, no "wear it"). Dismissing it records `verified` in the synced `cosmetics.announced` list, so it never replays on any device. Until it is dismissed, it is offered again on the next load or sync.
- Staging preview board: the fictional pros carry the seal.

## [2.0.16] — 2026-11-16 · Overall review: PCS Stride, M80, BS+COMPETITION and Bigodes

#### Balance
- **PCS Stride 2027** (shown as Project Conquerors): droppz 84 (was 85), coach STL 84 (was 81). sucoo stays 85.
- **M80 2027**: coach Nick 85 (was 76).
- **BS+COMPETITION 2027**: klaus 83 (was 81), LeoDkn 81 (was 80), pan 82 (was 81), and Kaoshi joins as coach (80). The lineup moves from the underdog tier to solid.
- **Bigodes 2026**: coach Kaoshi 81 (was 79).

#### Changed
- Daily calendar: the new overalls moved two recorded replays off their paths, so 2027-04-11 and 2027-07-20 get new seeds. Every other date, today and tomorrow included, keeps its seed. Challenges keep every star reachable.

## [2.0.15] — 2026-11-16 · RLCS 2027 Kick-Off rosters and logos

#### Added
- **25 new RLCS 2027 region-only lineups** from the Kick-Off package of 16/11 (EU 11, NA 5, MENA 6, SAM 3): BLG Doran, CKA, Detect Esports, Frites Esports Club, "Hey, its me, its joshyv.", joseadores, OGC FC, Oxalys Bunch, Radosin Corp, Rotation Station, WLT Gaming; arancini, Gulp, Legion of Boom, lsf, WASSUP; 1v1, b3den nsme, Room Mate London, shmn8a mr7, Team X, The white horse; Arrogantchi, Dynasty, T18 Esports. RLCS 2027 now has 71 lineups (26 worldwide, 45 regional). 60 new players; returning ones keep their ids (AztraL, Radosin, ejby, GiuK, sosa, Aqua, Speed, misery, UmBroken, Suspect, T7LM, Twiz, SQQP, B2seL, Wozyen).
- **9 org logos**: Detect Esports, Frites Esports Club, Legion of Boom, lsf, OGC FC, Oxalys Bunch, T18 Esports, WASSUP, WLT Gaming. The Detect logo is black only, so it ships as a white silhouette (the game draws logos on a dark background with no plate). Team X's logo is still under identity review and was not applied; the other new orgs show the styled fallback.

#### Changed
- **PCS Stride (shown as Project Conquerors) and NOT join the worldwide draft** (they were region-only).
- Overall refreshes: M80 89/88/86, Project Conquerors 85/85/87, NOT 86/86/84, Tubby Troubles 82/84/84, Novadrift 84/82/82.
- Overall check of the package: every value stays within a few points of the player's own history, except T18's misery (82 against a career best of 77), set to 80.
- Not applied from the package: its 20 new "archive" lineups (the five archive lineups already in the game stay, since removing cards would break saves), and its nick spellings Aztrø / sad / Matt / del1very. (the existing ids and display names stay).
- `data-sources/rlcs-2027-audit.json` and `season2027.test.ts` pin the new 71-lineup snapshot.
- Challenges are capped at RLCS 2026, so their pools do not change: every challenge still earns all three stars on its fixed seed (CH-02) and stays in its win-rate band, with no re-authoring.
- **Daily calendar refreshed** (`DAILY_REFRESH`): the daily pools include the 2027 region-only lineups, so the new teams moved the fixed-seed drafts (316 of 365 replays failed). Every date keeps its seed when a title + bonus path still exists on it. Today and tomorrow (16–17/11) keep theirs. 108 dates from 19/11 on and two past dates (09/11, 13/11; seeds are read only for today's run) got new seeds. The refresh tool takes `DAILY_POLICIES` to search harder on dates that cannot be reseeded.

#### Known gaps
- The 60 new players have no country yet (no flag, no same-country chemistry) because the package carries none.

## [2.0.14] — 2026-11-14 · Page translation no longer crashes the game; the black error screen is gone

Source: the first PostHog review after the launch (12–14/11, `docs/POSTLAUNCH-2.0-REPORT.md`).

#### Fixed
- **Career screens (and Draft results, the profile) crashed for players whose browser was translating the page; "Try again" showed the error again, and some landed on a black screen.** Root cause: page translation (Chrome, Edge, Firefox) and some extensions wrap React's text nodes in their own `<font>` element. React still holds the old parent, so its next `removeChild` / `insertBefore` on that node throws `NotFoundError` in the middle of a commit. The route boundary then has to clear the same broken subtree, throws again, and the page falls to Next's built-in global fallback: one grey line on black. Evidence: 44 of the 95 `quality_error` events and 16 of the 28 affected players; 10 % of the career players with a French browser (and Spanish, German, Japanese, Vietnamese ones) against 0.6 % of the English ones; routes `/career`, `/career/event`, `/career/training`, `/play`. Six of the sixteen never played again.
  - `src/lib/domGuard.ts` (imported by `LocaleRoot`, so it is installed before React commits): the two DOM calls no longer throw. When the node React names is no longer a direct child, the guard acts on the wrapper standing in its place; when the node is gone, the removal is a no-op and the insertion goes to the end. Checked against the real DOM in a browser: the native calls throw `NotFoundError` on a translated node, the guarded ones leave the right tree. Known limit: a label React later updates inside a translated wrapper can stay stale until the next navigation.
  - `src/app/global-error.tsx` (new): the last-resort screen is now the game's own panel with "Reload the page" and a link to the menu, in EN or PT, with inline styles only. It reports to `quality_error` like the route boundary.
  - `src/app/error.tsx`: an error a re-render cannot fix (DOM mismatch, failed chunk) offers "Reload the page" first and explains the translation cause; other errors keep "Try again" and gain "Reload the page". Its strings moved to `NAV_UI` (EN and PT; they were fixed English).
- **A chunk that failed to load left the player on the error screen** (two phones on launch day, seven reports, the same file on `/career`). Root cause: a tab opened before a deploy asks for a file the new deploy no longer serves, and re-rendering asks for the same file again. The route boundary now reloads the page by itself, once per minute at most (`errorRecovery.shouldAutoReload`, a timestamp in `sessionStorage`).
- **The Draft results screen crashed on a result saved before v1.3.3** (`k.specialIds is not iterable`, `/play`). Root cause: `EliminatorReveal` iterated `eliminator.specialIds`, a field older saved results do not have. It now reads an empty list.

#### Changed
- **`quality_error` keeps the code names the browser quotes** (`reading specialIds`, `Failed to execute insertBefore on Node`, Safari's `evaluating k.squad`). The message filter removed every quoted text, so ten `TypeError` reports on six routes read "reading <text>" and could not be traced. Quoted text that is not a plain identifier is still removed (`sanitizeErrorMessage`, `CODE_QUOTES`).

#### Not changed (findings for Miguel's decision)
- No career flow threw in production: zero `quality_save_error` and zero `quality_slow_advance` since the launch. PostHog shows no soft-lock cluster by week or tier; a refused action (a hold, a blocked lobby) sends no event, so one that the screen fails to explain would be invisible. Suggested next: one event for a refused advance.
- The event budget: about 28–33 thousand events a day (near one million a month); 49 devices hit the 400-a-day circuit breaker, which also drops their error reports. `analytics-budget.json` says 120 players a day against 230–420 measured.
=
## [2.0.13] — 2026-11-14 · Insomniac, a Legendary title granted by hand

#### Added
- **Insomniac**, a one-of-a-kind Legendary title for the first player to reach Supersonic Legend in Season 1 (Arc, 14/11/2026). It is a manual grant (`grant_id` `insomniac`, hidden until owned) with Legendary rarity: white gold, the sheen and the pointer tilt come from the rarity, so it is drawn exactly like Rocket Demigod. It does not take a reserved grant colour (`GRANT_COLORS` covers the coloured grants only). 45 titles in the catalogue.
- `docs/sql/v2013-insomniac-and-supporter-grants.sql`: accepts the new grant id and grants Insomniac + Special Supporter to Arc and Special Supporter to Mystic and RSphinx. **Not applied by the agent.**

## [2.0.12] — 2026-11-13 · Legacy pays for winning (BALANCE_VERSION 32)

#### Balance
- **Legacy Season Rating: lost final 35 → 20, third / fourth 17 → 6, Swiss exit -5 → -3; the title stays 70.** Feedback (Arc first on the board from below 400; a player with 11 titles above one with 288). Measured on the ten biggest Legacy climbers of 12–13/11 (PostHog): titles were 20% of the points gained, lost finals 26%, third / fourth places 53%. Recomputed on those players' own results: a strong one (146 runs, 6 titles) +8.5 → +5.0 a run; the MENA top-4 farm (112 runs, 2 titles) +16 → +7.3; an ordinary one (237 runs, 3 titles) +1.1 → +0.7; one with no title in 141 runs +2.3 → -0.3. Without the MENA farm the title is now the largest single source (45% of the points, finals 22%, third / fourth 33%).
- The launch-day table Miguel suggested (36 / 18 / 8, Swiss exit -7) was measured too and not taken: it puts the ordinary Legacy player at about -2 a run and the Normal volume (+2 a run) above every Legacy player.
- Future runs only: nothing already earned changes (the history re-price keeps the frozen 2.0.6 rows) and the soft ceiling of 2.0.9 / 2.0.10 stays.

## [2.0.11] — 2026-11-13 · An old tab can no longer reset a Season 1 profile

#### Fixed
- **A Season 1 profile was reset to zero on the player's own device (the season leader, twice in one morning).** Root cause: a tab opened before the 2.0 deploy keeps running the pre-2.0 code and shares the browser's storage. When it wakes up it writes the profile back in its own format and persist version (11). The 2.0 migrate treats every pre-v12 save as a pre-season save "by definition", so the next 2.0 load ran the Season 1 reset over a Season 1 profile: rating, XP and season counters back to the start, the lost values folded (MAX) into the pre-season snapshot, the lifetime XP dropped. The same old tab also saved its old-shape blob to the cloud, so no copy was left. Evidence for the account: its phone shows a pre-2.0 page view at 11:52:41 and 12:06:51 UTC, each followed within seconds by a 2.0 load that reported a save migration; the stored season started again at 12:06:52.
  - **Client:** the profile save is also written to a second key the old code never touches (`rocket-draft:profile:v1:backup`, `downgradeGuardedStorage`). A read takes the main key whenever it holds a save of the current version or newer; when the main key was downgraded, is missing or unreadable, the second copy is hydrated and no migrate runs. A real pre-season save has no second copy and migrates as before. The frozen key and version are unchanged.
  - **Server:** the 2.0.10 trigger (`reject_stale_client_write`) is applied in production since 13/11. An old client's write over a Season blob is ignored.
- A device whose save was already downgraded before it first loads 2.0.11 has no second copy yet: it still resets locally once, and the next sync brings the season back from the cloud copy the trigger now protects.

#### Data repair (production, 13/11)
- Restore point: `archive.profiles_backup_20261113` (every profile row before the repair).
- Mystic: season restored to the last state its own events show (06:29 UTC: Season Rating 2103, 873 runs, 273 titles) with the XP of the 24 runs played after the first reset (508,022); the pre-season snapshot back to the frozen values (184,307 XP, rating 1381, 40 titles, 407 runs). Not recoverable: the rating history graph and the Season 1 challenge stars.
- Two more accounts show a second season start with small losses (about 21 and 5 runs); not repaired yet.

## [2.0.10] — 2026-11-13 · Legacy ceiling, MENA fields, stale-client guard (BALANCE_VERSION 31)

#### Balance
- **Legacy has a soft ceiling too:** title 70 → 53 from a rating of 1500 and → 35 from 2500 (finals and semi-finals scale the same way, never below 1). The table itself and the Swiss exit of -5 stay. Miguel asked for lower points and a Swiss exit of -7 or -8; on the launch day's shares (764 Legacy runs without the MENA farm: Swiss exit 49.7%, top-8 / top-6 exit 32.9%, third / fourth 13.4%, final 1.7%, title 1.0%) the average Legacy run already nets +1.7 against Normal's +2.1, and a Swiss exit of -7 / -8 takes it to +0.7 / +0.2 while a strong player (9% Swiss exits in the sim) hardly notices. The top is what is high, so the trim sits at the top.
- **MENA Normal and Hard get the field depth of MENA Legacy (0.5), with lower boosts** (Normal 1.45 → 0.95, Hard 2.9 → 2.4). Sim, title / final / top 4 / Swiss exit: Normal 31.4 / 63.9 / 93.9 / 0.7 → 30.4 / 54.6 / 79.4 / 8.8 (worldwide 28.3 / 52.8 / 76.3 / 5.8); Hard 19.8 / 53.5 / 88.5 / 2.6 → 20.5 / 40.0 / 67.7 / 16.2 (worldwide 19.1 / 37.2 / 64.2 / 11.9). Simulator evidence only (14 live runs).

#### Fixed
- **A copy of the game opened before the Season 1 deploy could save over a Season 1 profile.** Root cause: an old tab or cached app keeps running the pre-2.0 code; its sync writes the profile blob in the old shape (no season, cosmetics, missions or lifetime blocks) and nothing on the server refused it. One account was hit on 13/11 02:00 UTC; three more pre-season accounts synced from old copies after the deploy. A v2 device repairs the cloud copy from its own on the next sync, so the loss is real only for a player whose Season 1 copy exists in the cloud alone. Guard: `docs/sql/v2010-reject-stale-client-write.sql`, a trigger that ignores a client write whose blob has no `season` block once the stored one has it. **Not applied yet**: it needs Miguel to run it (or allow it) on the production database.

#### Measured, not changed
- **Worldwide Hard and Legacy are on the model; the low title rates come from the teams players bring.** Per team overall the live results match the sim: Hard 94–95 wins 33% live (sim 34%), Legacy 96–97 wins 6% live (sim 11%). But 31% of live Hard runs and 41% of live Legacy runs start below 90–92 overall, where nobody won (0 titles in 43 and 231 runs); players reset 0.6 times a run, not the 2 the October calibration saw. Easing Legacy by 1.0 would give a 94–95 team 3% and take a player who resets 8–20 times from 12% to well above the 12% ceiling of #140, so the shift stays.
- **Every other region is within 3 points of worldwide on titles** for Easy, Normal and Hard (sim, live reset profile). SAM and OCE Legacy differ in shape but have no live evidence yet.

## [2.0.9] — 2026-11-13 · Launch-day rating package (BALANCE_VERSION 30)

Source: PostHog and Supabase, 12/11 14:00 UTC to 13/11 00:30 (99 Season 1
accounts, 2,559 runs). No rating already earned is changed by this release.

#### Balance
- **Soft ceiling on Season Rating gains** (`SEASON_RATING.softCeiling`, DESIGN-DECISIONS #157), in steps, and a gain never drops below 1. Easy: title 2 → 1 from 500. Normal: title 4 → 3 from 800, → 2 from 1500. Hard: title 10 → 8 from 1300, → 5 from 2200. Losses are unchanged and Legacy has no ceiling. Reason: two accounts reached about 1,630 on 511 and 720 Normal runs (+2.3 a run).
- **Legacy pays a little less at the top: title 80 → 70, final 40 → 35, semi-finals 18 → 17, Swiss exit -6 → -5** (Miguel). On the first day's shares the average Legacy run nets the same (+2.2 → +2.3, still above Normal's +2.1); a strong, reset-heavy player (sim: title 12%, final 26%, top 4 57%) nets about +21 a run instead of +23.5.
- **The 2.0.5 / 2.0.6 history re-price is frozen at the 2.0.6 table** (`SEASON_RATING.retuneTable`). Root cause of what it prevents: `retuneRatingHistory` re-priced with the live table, so a profile loading for the first time after this release would have had its last Legacy results cut to the new values.
- **MENA Legacy: field depth 0.5** (`REGION_LOCK.fieldDepth`, #156). Each opponent is lifted by half of its gap to the strongest team drawn; the best team is unchanged. Live, one player reached the top 4 in 46 of 55 MENA Legacy runs with 1 title (about +25 rating a run, 2,094 on 98 runs). Sim with the live reset profile (2,560 tournaments): top 4 62.7% → 25.8%, Swiss exit 9.1% → 45.3%, title 2.9% → 2.4%; worldwide reads 18.7 / 47.4 / 1.9. With 8–20 resets MENA reads 64 / 7 / 8.6 against 57 / 9 / 12.2 worldwide.
- **EU Normal: opponent boost 0.45 → 0.85.** Live EU Normal won 41–43% against 32.5% worldwide (EU drafts average 94.5, worldwide 92.9). Sim: EU 33.9% → 28.4%, worldwide 28.4%.

#### Changed
- `generateOpponents` and `initTournament` take an optional field depth (0 = the field as drawn; building a team draws no random numbers, so seeds do not move). `difficulty.matrix.test.ts` reports top-4 reach and Swiss exits and accepts `SIM_DEPTH`.

#### Not changed, with the numbers
- Hard (13.1% on 107 runs, target 22.3%) and Legacy worldwide (0.7% on 558 runs, target 4.1%): players reset about 0.6 times a run against the 2 the calibration assumed. The fix is the shared difficulty shift, which moves every region and the fixed-seed challenges; wait for more days.
- SAM Legacy reads easier in the sim (final 15.7%) but live it is 0 titles in 40 runs: no change.

## [2.0.8] — 2026-11-12 · Unlock pop-ups on a new browser, provider buttons

#### Fixed
- **Signing in on a new browser replayed every cosmetic unlock pop-up.** Root cause: a sync announces what arrives and was never opened in the locker (`cosmetics.seen`), and nothing recorded that a pop-up had already been shown; on an empty device everything arrives. The profile's durable form now carries `cosmetics.announced` (what a device owns has had its pop-up queued there); the merge takes the union and a sync only announces what is in no list, such as a grant added in the cloud. Nothing is written at hydration (persist contract). A device that last synced before 2.0.8 has no list in the cloud yet, so the first new-browser sign-in after it can still replay once.

#### Changed
- The Google and Discord sign-in buttons take a full row each, carry the provider's logo and colours (white Google button, Discord blurple) and are 40 px tall.

## [2.0.7] — 2026-11-12 · Sign in with Google or Discord

#### Added
- **"Continue with Google" and "Continue with Discord"** above the email field (sign-in dialog and the profile's sign-in panel). Reason: every email sign-in sends one message and the mail provider's free quota reached 80 % on launch day; these two send none. An email that already has an account opens that same account (Supabase links identities by verified email; 80 % of the 543 accounts are Gmail). The email code stays.
- **"Connect Google / Discord"** next to Sign out on the profile, for an account whose Google or Discord email differs. Needs "manual linking" enabled in the Supabase project.
- A new account made this way goes through the same display-name step as before.

Not changed: signing in to a different account on a device that holds progress still uploads that progress to the new account (same as with a second email).

## [2.0.6] — 2026-11-12 · Legacy bracket exit, card and star XP (BALANCE_VERSION 29)

#### Balance
- **Legacy: a top 8 / top 6 exit pays 0 Season Rating again** (2.0.5 had made it +5; Miguel: only the top 4 pays). Title 80, final 40, semi-finals 18 and the Swiss exit of -6 stay. On the first day's results the average Legacy run nets about +2.3, still above Normal's +2.1.
- **Histories are re-priced once more** (`flags.ratingRetune2`): the +6 a 2.0.5 profile got for each Legacy bracket exit in its last 40 runs comes off. The pass is the same idempotent `retuneRatingHistory`.
- **Unlocking a special card pays real XP.** `XP.specialUnlock` was 10 / 20 / 40 / 75 / 100 (rare / epic / mythic / legendary / creator) against about 500 XP a run, and community, wings and national cards had no entry (0 XP). Now rare 100, community 100, national 50, epic 250, wings 250, mythic 400, legendary 750, creator 1000.
- **Challenge stars 2 and 3** pay 150 / 250 / 400 / 600 each by tier (were 40 / 70 / 110 / 160). The clear (star 1) is unchanged.

## [2.0.5] — 2026-11-12 · Legacy rating, Lostt, base export

#### Added
- **Special card `sp-lostt-the-club-breakout`** (The Club Breakout, 90 Rare, +3 mechanics and clutch) with its photo.
- **Coach pxress on team 1 (2027)**, overall 77 (the roster's average of 82.3 minus 5; no country on file, so chemistry skips him).

#### Changed
- Base export of 12/11 (1,386 decisions): Lostt 88 -> 91 on Brasil FIFAe 2025 and 87 -> 89 on FaZe Clan 2027, crn 85 -> 86 on FaZe Clan 2027, `sp-lostt-vitality-slayer` 93 -> 94, 16 birthdays, and the nickname DudsMelow shown as "Duds Melow" (the id stays `dudsmelow`, through `PERSON_ALIAS`). No id was lost.
- Fixed-seed content re-authored for the catalogue (see the entry's replay note below).

#### Balance (BALANCE_VERSION 28)
- **Season Rating, Hard and Legacy.** Live data of the first day, Classic, net rating per run: Easy +1.7, Normal +2.1, Hard +1.0, Legacy -1.0 (Legacy: 351 runs, 52 % Swiss exits, 2 % titles). The top of the board went to Normal volume and Legacy-only players sank. Legacy: title 36 -> 80, final 18 -> 40, semi-finals 8 -> 18, making the bracket 0 -> 5, Swiss exit -7 -> -6. Hard: 7 / 3 / 1 / 1 -> 10 / 5 / 2 / 2, Swiss exit -5 -> -4. On the same results the average Legacy run now nets about +4, about twice Normal's; it still loses rating on a Swiss exit. Easy and Normal are unchanged.
- **Runs already played are re-priced once** (`retuneRatingHistory`, `flags.ratingRetune1`): the Hard and Legacy runs still in a profile's rating history (the last 40 runs) take the new values. A loss the placement runs had protected stays 0.

## [2.0.4] — 2026-11-12 · Sign-in: name only for a new account
- The sign-in dialog is email, then code. When the sign-in created the account, one more step asks for the display name (prefilled with the automatic one; closing keeps it). 2.0.3 had put a name field in front of the email.

## [2.0.3] — 2026-11-12 · Display name at sign-in
- **Fixed:** a new account whose automatic name was already taken was left without a cloud row. Root cause: names are unique in the database and the first push used the email prefix with no fallback. It now falls back to the prefix plus four digits.

## [2.0.2] — 2026-11-12 · Career XP (BALANCE_VERSION 27)
- Live data: one account reached Champion (150k XP) in an hour, almost only through Road to Worlds. Skip simulates a season in about seven minutes and a dominant squad takes every title, about 27k XP a season. Simulated results now pay a tenth of their series / event / title XP (`CAREER_XP.simulatedShare`); titles pay about a third (Worlds 5,000 -> 1,500, Major 2,000 -> 600, regional 800 -> 250); the season review 1,500 -> 500.

## [2.0.1] — 2026-11-12 · Unlock pop-ups for grants, shorter board names
- **Fixed:** manual grants and cosmetics a migrated save already owned never raised the unlock pop-up. Root cause: hydration and the cloud merge were silent by design (rc.20). What a sync brings that the device did not own and the player never saw is announced; one pass per profile covers what was owned before (`flags.unlocksCaughtUp`). Nothing is equipped automatically.
- Regional boards are named "SAM Wins", "NA Wins", "EU Wins", "OCE Wins", "MENA Wins".
- Share image (Open Graph) replaced with the Season 1 art.

All of 2.0.1 to 2.0.6 were deployed from Miguel's machine with his go-ahead (the Workers Builds queue ran about 30 minutes behind on launch day); the same commits are on `main`.

## [2.0.0] — 2026-11-12 · "Season 1"

**Released to production on 12/11/2026.** The pre-season was frozen at 13:05 UTC
(439 accounts placed; `docs/handoff-2.0/CUTOVER.md`). What players get, in short
(the public notes are `CHANGELOG_PAGE` in `src/content/copy.en.ts` / `copy.pt.ts`):

- **Road to Worlds (beta):** a full career mode, from open qualifiers to Worlds.
- **Season 1:** XP and rank restart on a longer ladder, Season Rating from 400,
  collection / history / stats kept, pre-season rewards for the peak rank and for
  the top 50 of the frozen Rating, Titles and Legacy Titles boards.
- **Draft:** five Regional Drafts, Challenges 2.0 (45 challenges, 135 stars),
  Daily Quiz, missions, login streak, a guided tour.
- **Profile:** titles, badges, animated banners; 114 achievements; nine season
  leaderboards.
- **Data:** a bigger database, new special cards with photos, national-team cards.
- **Web:** a page per team and player, faster pages, reworked mobile layout,
  inline sign-in.

The entries below are the release candidates, newest first, as they were built.

### 2.0.0 (2026-11-12), the release

#### Added
- **Launch announcement** (`LaunchNotice`, home, once per player via the synced
  `flags.seenLaunchNotice`): four captures of the live game (Road to Worlds,
  Season 1, Challenges, Collection), six highlights, primary action opens the
  inline sign-in for a guest, secondary goes to the changelog. It opens before the
  pre-season recap, and the recap waits for a sign-in started from it, so a
  veteran who logs in there sees the recap with the board places already synced.
- Public changelog page: the v2.0.0 entry in English and Portuguese.
- **Beta notice in Road to Worlds:** a short dialog right after the HQ tour closes
  for the first time (once per player, `profile.tours["career.beta"]`): the mode
  is in beta, feedback goes to Discord, with the home page's Discord button.
- **"Season 1" above the tagline on the home page**, between two hairlines.
- **Manual grants inserted in production** (`profile_grants`, 35 rows for 14
  accounts: creator, pro, contributor, supporter, early supporter, 50/50 staff).

#### Changed
- **Pre-season board rewards come from three boards: Rating, Titles and Legacy
  Titles** (Miguel, 12/11). The two "highest overall" boards are out: dozens of
  accounts shared their top value. `PRESEASON_BOARDS` and the freeze store these
  three only. Result of the freeze: 77 accounts hold a board reward (2 champions,
  2 runners-up, 3 thirds, 16 elite, 73 finalists; one account can hold several).
- **The Pre-season Hall of Fame tab is gone** from the leaderboards (nine season
  boards remain). The frozen places live on as rewards and in the recap.
- **Road to Worlds is ON by default** (`FEATURES.careerMode`:
  `NEXT_PUBLIC_CAREER_MODE !== "0"`, mirrored in `postexport.mjs`). It used to
  need `NEXT_PUBLIC_CAREER_MODE=1` in the build; the production deploy no longer
  depends on a dashboard variable. `=0` is the kill switch.
- Merged production `main` (v1.4.7 announcement, v1.4.8 inline sign-in): the
  sign-in dialog now exists in the 2.0 line; the 1.4.7 teaser became the launch
  announcement.
- Recap reward grid: a title stacks its chip above its name (long board titles
  were cut).
- **The Supporter grant is named "Special Supporter"** (title, badge and unlock
  line, EN and PT).
- **The pre-season recap opens only for a player with something to show** (a
  finished pre-season run). XP without a finished run, 4 real accounts, earned
  nothing and used to get the recap with an empty reward page.

#### Not done / not verified
- The staging-only tools (Unlock every cosmetic, the fictional leaderboard) are
  gated by `FEATURES.previewTools`, which is false in a production build without
  `NEXT_PUBLIC_NOINDEX`; checked by reading the flag, not by a production-format
  build on this machine.
- Request budget (`scripts/request-budget.mjs`) not measured: Playwright is not
  installed here.


> **Playtest build (deploy):** `NEXT_PUBLIC_PLAYTEST=1` (`FEATURES.playtest`)
> + `wrangler.jsonc` `env.playtest` → `playtest.rocketdraft.app` for external
> testers: Classic / Quick Draft, Challenges and Road to Worlds only (Daily
> Challenge, Daily Quiz, missions, login streak, cosmetics and season extras
> hidden; `/quiz` and `/missions` 404). Runbook: DEPLOY-CLOUDFLARE.md.

> The biggest release in the project's history. Plan of record: **`docs/ROADMAP.md`**
> (the completion plan's Etapas and approval gates, since rc.26).
> `docs/V2-IMPLEMENTATION-PLAN.md` is the history of Phases 0–3 (rc.1) and Phase 4
> (rc.2–rc.26) plus three live lists: Miguel's Supabase/Cloudflare steps (§6), the
> regression checklist (§7) and the open decisions (§8). This entry grows with every
> rc. Never deployed to `main` before the full review.

### rc.55 (2026-11-12), rc.54 merged with the special-cards and polish branch

The merge of `codex/rc53-final-polish` (commit `v2.0.0-rc.53-polish.1`, written in parallel by another session; its notes: `docs/handoff-rc53-polish.md`) into rc.54. Its entry, as written there:

- Added: 16 curated specials and 36 supplied photos; historical bases for Mawkzy (Lille 2021) and Gibbs (iBUYPOWER S1 substitute). Package fixes for Royales, STL, Duds and removal of Gian’s community card.
- Changed: collection rarity accordions/counts, home CTA/stickers, fixed season-reward preview, direct badge equip/remove/replacement, compact honors filters, calendar hierarchy, headline and unlock dialogs.
- Fixed: tab dots previously read item-open state, so they stayed after visiting; separate tab acknowledgements now leave item NEW tags intact. Weekly-only chart data hid settled prize changes; a display-only current-cash point updates both charts immediately.
- Fixed: Pure Talent’s advertised no-specials rule was not enforced; it now is, and a reroll-budget bonus replaces the redundant star. All 135 stars replay with the final catalogue; four seeds refreshed, earned progress preserved.
- Validation content: refreshed the staged 365-day replay calendar after the catalogue change; 98 authored seeds changed (including expired staging 2026-11-09), with no rewrite of saved player results.
- Scope: codex/rc53-final-polish only; no staging/main deployment. Validation, integration notes and catalogue limitations: handoff-rc53-polish.md.

Then `v2.0.0-rc.53-polish.2` (Miguel's visual review of 12/11, same branch, interface only), as written there:

**Changed (polish.2)**
- Restore the rc.53 Home career CTA layout and continuous sentence.
- Collection groups: Legendary, Mythic, Epic, Rare, Community, Special. Community replaces Content Creator; Special combines discovered Wings and Creator cards without changing their stored rarities, visuals or hidden-until-owned rule.
- Progression announcements are compact, orange-led, with Explore left and Close right.
- News masthead combines brand, date and dismiss; blue side rule and quieter broadcast label retain the large headline and crests.

**Fixed (polish.2)**
- Blank crest area on first announcement capture: logos used the shared lazy loading default inside an entering dialog. Announcement crests now request eager loading; the new capture waits for decoded images and verifies a visible 72px Vitality logo.

**Validation (polish.2)**
- Typecheck and targeted ESLint passed; browser checks cover desktop and 390px mobile. HQ positive cash feedback confirmed with +$12k beside Balance. All 60 targeted tests, the 736-page static export and postexport image/noindex checks passed.

Then `v2.0.0-rc.53-polish.3 — announcement visual refinement (2026-11-12)`, as written there:

**Changed (polish.3)**
- Progression dialog uses a compact inset progression card, a larger milestone glyph with a completion marker, a restrained warm background and clearer title hierarchy. Explore stays left; Close stays right.
- Headline org crests grow from 72 to 88 CSS pixels. Breaking News and its indicator are orange; the blue rule now runs beside the headline/body only, without framing the whole dialog. Brand, date and dismiss remain on one row.

**Validation (polish.3)**
- Typecheck, targeted ESLint, 736-page static export and postexport checks passed; desktop and 390px mobile dialog captures use isolated test saves.

#### Changed
- **`sp-gian-community` is gone with the final card package. 31 real accounts held it** and lose it from their Collection on the next load. The cutover guard now lists what was retired on purpose (`preseason-held-ids.json`, `retired`) and fails for any other held id that disappears.
- The pre-season recap's reward grid gives a title the full row (several board titles overflowed their cards).

#### Balance
- **Difficulty matrix repeated on the final catalogue, no retune** (`docs/rc55-difficulty-matrix.json`; same harness, sessions and reset weights as the C3 calibration, which the analysis reproduces to the decimal). 20 of 24 cells within 3 pp of both the target and C3 final at 240 sessions; OCE, whose pool did not change, came out identical. The four cells above 3 pp were re-measured with 480 sessions and sit within about 2 pp of C3 final: WW Easy 72.5 % (C3 70.2, target 68.5), NA Normal 38.6 % (36.3 / 35.9), MENA Easy 71.0 % (69.0 / 68.5), MENA Hard 21.6 % (20.4 / 20.3). Below the C3 tuning threshold, and a retune would invalidate the challenge and daily seeds re-authored for this catalogue. WW Easy is the one to watch on live data.

#### Verified on the merged tree
- Full suite 2,445 passed (run with 30 s per test: under CPU load the 5 s default times out career sims, no assertion fails), lint, typecheck, the staging-format build, and the soft-lock probe (14 careers, 7 seasons, 0 findings).
- In a browser, on the rc.54 export (before the merge; the reward-grid fix above and the polish branch's screens were not seen by the coordinator), with Miguel's real pre-season save: the migrate keeps 78 specials and 25 runs of history, rating 400, Supersonic Legend archived; the recap lists every board place and pays one band per board; the achievements page shows 114 with the secrets hidden.

### rc.54 (2026-11-12), the Season 1 cutover: rewards, boards, tour, saves

Source: Miguel's launch-day brief of 12/11. Runbook for the cutover itself: `docs/handoff-2.0/CUTOVER.md`. SEO audit and the PostHog build list: `docs/handoff-2.0/S1-seo-analytics.md`.

#### Added
- **Season 1 leaderboards:** Season Rating, Titles, Legacy Titles, SAM / NA / EU / OCE / MENA Titles and RTW · World Titles, plus the frozen pre-season Hall of Fame. Every board counts the current season only. A regional title is a title won with that region lock. New profile fields `regionTitles` (lifetime) and `season.regionTitles`; new cloud columns `season_legacy_titles`, `season_titles_sam|na|eu|oce|mena`, `season_worlds`.
- **One frozen place per pre-season board** (`legacy.preseason.positions`, cloud column `preseason_positions`): rating, titles, Legacy titles, Legacy overall and regional overall. The recap lists every place.
- **Cutover rehearsal tests:** `preseasonRehearsal.test.ts` (saves in the exact shape of the 455 production accounts through the persist migrate, a clean-device sign-in and a re-merge; a real export can be passed with `PRESEASON_SAVES`), `careerRealSave.probe.test.ts` (`CAREER_SAVE`: a real career save loads through the store and plays on), and a guard that fails when an achievement or special card id held by a real account leaves the build (`__fixtures__/preseason-held-ids.json`).

- **30 new achievements** (E1 review, `docs/handoff-2.0/E1-achievements.md`): run feats (double hat-trick, a comeback in the final, a title from the lower bracket all the way, a low-overall title, a blind title), lifetime counters, region play (a title on every region lock, 25 in one region), Legacy streaks, and the Season 1 systems (challenge stars 45 / 90 / all, quiz and login streaks, missions). Seven are secret (nine secrets in total). **Road to Worlds: 7 new** (seven seasons, a second Worlds, five regionals, three Majors, Worlds with an unchanged roster, a perfect season). The lifetime counters are pre-marked silently for veterans; nothing else is.
- **Rocket Street news desk for South American careers (R133):** cup preview and recap, regional recaps, Major and Worlds berths, a wrap of each transfer window, the SAM rookie class. Departing SAM organisations are signed by Rocket Street. Probe (`RS_PROBE=1`, 24 seasons): 14 to 20 Rocket Street stories a season, 21 to 25 % of the feed. Knobs in `CAREER_ROCKET_STREET` (BALANCE_VERSION 26).

#### Changed
- **Achievements review:** 15 retired as participation trophies (held by 49 to 435 of the 455 accounts: hat-trick, blowout, four goals, 100 and 250 goals, 50 games, solo show, giant slayer, flawless Swiss, open-era title and the five regional rosters that a region lock now completes by itself). Players who held them lose them on their next load. Ten others moved down a tier; nobody loses those. Catalogue 77 to 92.
- **Rocket Street LATAM Championship is on a SAM career's calendar twice every season from season 1** (weeks 7 and 27; Community Cup below the reputation gate, Invitational above it).
- **Pre-season rank reward = the peak rank only** (Miguel, 12/11; was cumulative since rc.20). A Supersonic Legend gets the Supersonic Legend badge and title, not the eight below.
- **Pre-season board reward = one per board.** A place in a band on any of the five boards pays that band, so #10 on one board and #3 on another pays Elite and Third. The same band on two boards is one reward.
- **Guided tour** (Miguel's playtest): no tour on the career's Calendar, Market, Standings, Inbox and Club tabs; no entry animation; Done and Skip return to the top of the page; the draft tour runs over a fixed example lineup before the first draw; every tour shows once after the season reset, to veterans too (`profile.tours`, synced across devices). A tour in front now holds the reward pop-ups until it closes.
- **Season 1 starts on 12/11/2026.** Its length is not decided; the end date is a placeholder that no screen shows.
- `/quiz` is linked from the home page (it was reachable only through a modal); its description says five attempts; `CONTENT_DATE` 2026-11-12.

#### Fixed
- **A returning player's first v2.0 session carried no profile in analytics.** Root cause: the persist migrate reported `quality_migration` while the profile store was still being created, before the store had registered what a session carries, and the first event of a visit opens the session. The report now follows the store's load (a microtask). Covered by `migrationSession.test.ts`.
- **A South American career never saw the Rocket Street championship and almost none of its news.** Root cause: the championship was only a renamed invitational, and invitationals need reputation 30, which a new SAM org reaches during season 3 (probe before: on the calendar in 0 of 8 first and second seasons); the news desk signed one fixed story and the rookie class of the first region in the list, never SAM.
- **Partner logo missing while a partner cup is being played.** Root cause: the live bracket header (`EventPlayback`) rendered no partner art for any partner; the lobby and the result screen did. Not reproduced for the 50/50 lobby from code, where the mark resolves (it is a wide wordmark shown at about 56 by 28 px).
- **Tour entry looked broken.** Root cause: the spotlight and the card were first rendered at an unmeasured placeholder (a zero-size box at the screen centre, the card at the top-left corner) and a 300 ms transition animated them to the target one frame later.
- **Supabase (production, fixed on 12/11):** the public `leaderboard` view carried the schema's default INSERT / UPDATE / DELETE grants for the anonymous role. As a plain view owned by `postgres` it let anyone holding the public key change or delete profile rows. Both public views are SELECT-only now.

#### Not done / not verified
- Sign-in on a v2.0 build against the production database was not exercised end to end (no staging Supabase project exists); the queries were checked through the public API and the row logic as the `authenticated` role in rolled-back transactions.
- The full export of the 455 production saves was not run through the rehearsal: Miguel's own pre-season save and the surveyed shape were.
- Not seen in a browser: the achievements grid with the new and secret entries, the Rocket Street stories and the partner logo in the live bracket header. 30 draft and 7 career achievements have no art (tier fallback).
- Browser checks done on a desktop pane only: the ten board tabs (also at 375 px), the draft tour end to end, the career tour on HQ, Squad and Calendar. The recap with several board places and the tour holding a reward pop-up were not seen in a browser.

### rc.53 (2026-11-12), Supernova at 90 stars

#### Changed
- **Supernova needs 90 challenge stars** (was 75), Miguel's decision: the star ladder is 25 / 50 / 90 / 120 of 135. A staging profile that held it with 75 to 89 stars loses it until it reaches 90.

### rc.52 (2026-11-12), Miguel's first look at rc.51: legendary badges, title weights, Creator colour

#### Changed
- **Legendary badges are 8 % larger than the others** (was 16 %: they read too big).
- **Legendary glow rebuilt.** It was a tight, near-opaque rim of the silhouette (blur 2.2 px at full strength) over a faint halo, which read as a hard outline. It is now three blurs of the silhouette (4, 12 and 26 px at 0.30, 0.45 and 0.58) composed into one bloom in a warmer white gold: no rim, brightest at the art's edge, fading evenly. Still one static image per badge, opacity only (`BADGE_GLOW` in `build-images.mjs`; every `*.glow.webp` regenerated).
- **Five epic titles are a step quieter:** Daily Driver, Rocketeer, Day One, Globetrotter and Titanbreaker keep their colours and the holo band, with a weaker rim and glow (`soft` in the catalog, `.cos-title-soft`). The gold epics, the Grand Champion red and the manual grants keep the full treatment, so they now read stronger.
- **Creator title colour:** orchid magenta (`#e23cff` to `#f6b3ff`, glow `#b312e6`) instead of the hot pink of rc.51.

#### Not done / not verified
- Not checked by Miguel yet. The soft-lock probe was not required for this change (no career code); it had been started for rc.51's career bookkeeping (Day One, Major berth and Regional Dynasty flags in `careerFlow.ts`) and its result is not part of this entry.

### rc.51 (2026-11-12), Miguel's cosmetics review: revised badges, 9 banners, 16 new rewards, banner animation rebuilt

Source: Miguel's review file of 11/11 (the catalogue checked item by item), the revised badge design file and the banner catalogue file, both now in `data-sources/`. Reference: `docs/COSMETICS-CATALOG.md` (regenerated, 108 items: 37 badges, 44 titles, 27 banners).

#### Added
- **Badges:** Hypernova (Legendary, 120 challenge stars), Creator (manual grant `creator`) and the art of the 50/50 Staff badge (drawn as `5050` in the design file; the id stays `50-50-staff`).
- **Three-star challenge rewards:** Titanbreaker (title) and Against All Odds (banner) on Topple the Titans; Eye of the Storm (banner) on Perfect Storm; Crown Taker (title) on European Crown; Masterclass (banner) on Draft Masterclass; Globetrotter (title) and World Class (Legendary banner) on World Tour.
- **Classic feats** (`src/engine/runMarks.ts`, Classic only: Daily, Quick and Challenges never count): Technician (title; a worldwide title with three players, coach and substitute of one country), Clean Sweep (banner; six slots filled, no series lost), Trade Minister (title; a title on each of the NA, EU, SAM, MENA and OCE region locks).
- **Road to Worlds milestones:** Roster Architect (title; first main regional reached through the qualifier), Regional Laurels (banner; first main regional title), Passport Stamped (banner; first Major berth, the day the field is announced), Major Statement (banner; first Major title), Day One (title; Worlds won by the three starters registered as split 1 opened, never changed since), Regional Dynasty (banner; every main regional and Worlds in one season).
- **Creator title** (manual grant, fuchsia / magenta, a reserved colour). SQL for the grant id, NOT executed: `docs/sql/rc51-creator-grant.sql`.
- The "how to get it" line of a Road to Worlds or Classic reward now states the exact milestone (`COSMETICS.sources.marks`, EN + PT) instead of "Road to Worlds achievement".

#### Changed
- **Every badge re-exported** from the revised design file (20 arts changed, Underdog's unused file is gone).
- **On Target** is 50 missions (was 25; the Target Practice banner keeps 25). **Rocketeer** is the Grand Champion title (was Champion). The **50/50 Staff title** is removed (the badge stays); a saved choice of it resolves to an empty slot.
- **Banner animation, frame pipeline** (Wildfire, Heatwave, Cosmic Ascension and the nine new banners): the build evaluates the design file's own animation at three moments and bakes each into a complete image, filters, masks and blend modes included; the UI cross-fades them (opacity only). Shapes that travel (embers, stardust, rain, confetti) are transparent planes moved along the design's own vector. Weight of the live layers at the widest size: Cosmic Ascension 150 KB (was about 180 KB), Wildfire 75 KB, Heatwave 118 KB; the heaviest new banner is Clean Sweep, 280 KB. The other 13 animated banners keep the rc.23 plane split unchanged.

#### Fixed
- **Wildfire's flames looked bent.** Root cause: the game skewed and stretched one flattened raster of all the flames about the banner's centre, so the stepped (pixel) edges tilted with it; the design sways each flame a degree or two about its own base, inside a mask whose steps stay upright. The frames are rendered from that original animation.
- **Cosmic Ascension did not look like the design and barely moved.** Root cause: its animated shapes were lifted onto separate planes with their filters stripped, their blend modes lost (a `screen` layer over transparency is not a `screen` layer over the nebula) and drawn above the scrim and the star, so rings and rays turned hard and bright; the motion left was a 140 s rotation and an opacity pulse. The frames keep the original paint order and effects; the aurora, the iridescent ring and the sparkles now change between frames and the stardust rises on two planes.
- **Heatwave only moved four thin lines.** Root cause: its main animation is a heat-haze filter (an animated turbulence), which cannot run in the browser and was simply dropped. Three frames of that haze now cross-fade over the whole scene.
- **`npm run build:badges` always failed after writing the files** (since rc.21). Root cause: its catalogue check collected every `art: "..."` literal in `cosmetics.ts`, which since rc.21 are the banner arts, and looked for them among the badges; the README step after it never ran. It now checks the badge ids only.
- **Analytics would read a Classic feat as a career.** The career funnel steps looked at whether the profile had any mark; run marks share that list, so only `car-` marks count now (found while adding them, never shipped).

#### Not done / not verified
- Not played by Miguel. The animations were checked in a desktop browser against the static export; no phone, no Safari.
- Supernova stays at 75 stars (the review file and the rc.38 decision); the revised badge file's caption says 90. Hypernova's 120 comes from that file. Miguel to confirm both.
- A career already past the start of split 1 when it loads rc.51 can only earn Day One from its next season on (the starters are registered as split 1 opens).
- The Creator and Staff grants need their SQL applied before anyone can receive them; neither was run.

### rc.50 (2026-11-12), wave 2 integrated: mobile, copy and tutorial, analytics, performance (R130–R132)

Per-front notes, numbers and validation lists: `docs/handoff-2.0/` (M1 mobile, T1 copy and tutorial, A1 analytics, P1 performance). M1's before/after captures stay on the `v2/M1` branch.

#### Added
- Guided tour (T1): the first visit to the career walks the real HQ (tabs, clock, day card, cash, progression, inbox) with Next, Back and Skip; each other tab shows its own short chapter on the first visit; a floating help button reopens the current chapter. The first draft opens the same tour and replaces the "How to play" modal, on its own additive flag (`seenDraftTour`): Season 1 shows it once to veterans too. Works at 360 px and with reduced motion.
- Achievements in Portuguese: all 77, read by the achievements page, the unlock toast and the results screen. Tab titles in Portuguese on the single-URL pages.
- Analytics catalogue 2.0 as code (A1, `src/lib/analyticsCatalog.ts`): 28 typed events. One event per draft run (resets as a counter, picked cards, specials, result, XP, rating), one per career tournament, split and season summaries, progression, collection, quiz, missions, accounts and health events. A test fails on an event or property outside the catalogue.
- Event budget guard (`src/lib/analyticsBudget.ts`, `public/analytics-budget.json`): a per-device daily cap and sampling that switch on only above 700 players a day; a fixed breaker at 400 events per device per day.

#### Changed
- Mobile (M1): the career navigates by a selector under the header; HQ starters as horizontal cards; Market filters collapse and its tabs sit in two columns; Standings and the Club's season history become cards; brackets stack their rounds; the event lobby's actions sit by its header; modals keep their close button on short screens; toasts stay above the bottom navigation, one per layer; the home hero and Draft card are compact (the main card ends at 666 px at 360 px wide, was 889). Controls are at least 44 px, interface text 11 px, inputs 16 px.
- Career copy (T1): 66 strings in EN and PT rewritten to say what the player decides or gets, not how the engine computes it. The share card follows the player's language. The privacy page names PostHog only.
- `$pageview` is sent by our layer once per route per session; SDK autocapture is off. `run_started`, `tournament_started` and `special_used` stop (their data rides `run_completed`); `run_abandoned` is sent for a real exit only.
- The HQ explainer modal is gone (the tour replaces it).

#### Fixed
- **Every career stopped at the first qualifier of 2022-23 (season 3, day 26), on rc.47 to rc.49.** Root cause: an organization that moves region (R123: FURIA and Elevate leave SAM that season) is not replaced, SAM had 14 organizations, its Saturday qualifier built 14 teams and `fieldForEvent` threw; the AI qualifier of every region resolves on the day's arrival, so Advance, Skip and autoplay did nothing in every region. A short region now fills its qualifier and regional with local sides past the pool of 8 (R130). A save already stuck moves again on load.
- A starter ruled out with no reserve left two dead buttons in the event lobby. Root cause: the lobby read the roster count, the start also refuses an uncovered absence; both read `eventStartBlockOf` now (R131).
- A career action that threw failed silently. Root cause: the store ran the flow in the click handler with nothing around it; the save is left untouched, the screen says so and `quality_save_error` (kind `action`) is reported (R132).
- Advancing a day ran about 40 layouts. Root cause: three progress bars and the HQ day marker animated `width` and `left`; they animate `transform`.
- HQ deep-copied the whole save four to six times per render. Root cause: the purchase-refusal check ran the purchase flow on a copy; the refusal rules are read directly.
- A refused action rewrote every save slot. Root cause: a new slots array was built even when the flow returned the same save.
- The first sound of a visit blocked its own click. Root cause: the AudioContext was created inside the click handler; it is created in idle time after the first gesture.
- Mobile: the career navigation could sit under the header (two sticky bars at `top: 0`); the Market lock badge covered the overall; small controls and 8–10 px labels reused from desktop.

### rc.49 (2026-11-11), Miguel's review of the launch wave

#### Changed
- Road to Worlds: the headline pop-up is a broadcast card built on the news toast (desk masthead, date, breaking tag, the clubs' crests, title, body); closing it only closes it. The unlock pop-up is a minimal card with the progression badge. The HQ progression card lists what can be bought now first.
- Partner events (50/50, Duds, Rocket Street): one logo per card and smaller; on the tournament page the logo sits on the right and the tier chip moves beside the date; on the result it is a small mark beside the event name. Rewards by placement are a podium list with medal chips and a bar on the champion's prize.
- My deals: the offers card wears the renewals card's title and empty line ("Offers received"). The contracted tab no longer shows the reputation-20 notice (the rows already show the lock).
- Calendar: no "Plan your season" heading or month selector; the arrows and the region filter remain.
- Navbar: the NEW tag sits beside CAREER, in orange. Home: BETA beside the Road to Worlds title, NEW as a tilted corner sticker.
- Daily Quiz: the "active from X to Y" clue is gone (the database may be incomplete); its slot is a second "played alongside" clue. The answer of every day is unchanged and the ladder lengths are the same (256 answers with five clues, 3 with six).

#### Fixed
- A Major or Worlds the user only watches did not show on the calendar during a transfer window. Root cause: the window's fill was chosen before the event's, in the month grid and in the HQ week strip; the event's tier now wins and the window keeps its bottom line.
- Autoplay ran past the Sunday of a watched Major. Root cause: only the batched Advance stopped on the day the followed event resolved; the autoplay loop had no such stop, so the watch / results / skip card appeared on Monday.
- The Discord icon was distorted (a hand-drawn path); it is the standard mark on a square box now.
- "Play the RLCS draft game" appeared under game screens. Root cause: the strip was added to every page without a play button of its own, which meant the game's own screens; it now renders on `/changelog` and `/privacy` only (articles end with their own button).

### Balance — rc.48 (2026-11-11), elite talent signs at his overall again (R129, BALANCE_VERSION 25)
- Miguel's read of rc.46: the reputation asked for an elite prospect was too much (an 87 with potential 97 needed reputation 50, was 40). `CAREER_TALENT.elite.gateShare` 0.4 to 0: the Market's lock, its "signable" filter and the signing read the overall alone, as in rc.45. The price side of rc.46 stays (fee and wage up to x2.2 from a reachable top of 93). Not measured in a battery.

### rc.47 (2026-11-11), the launch wave: six parallel fronts integrated (R122–R128, BALANCE_VERSION 24)

Full per-front notes, numbers and validation lists: `docs/handoff-2.0/` (C1 career engine, C2 progression, C3 draft difficulty, C4 web, G1 career screens, G2 draft and menu).

#### Added
- Road to Worlds: sponsor goals count over the whole contract from the signature (one goal, one bonus, one fine); Worlds of Season X is cancelled with its own headline; headline news and non-purchasable unlocks open as a pop-up once; contracted players are listed below reputation 20, locked; the sponsor-funded bootcamp starts by itself; coaches have dated contracts, renewal on the players' rule, slow growth of quality and wage, and an edge for professionals and former pros; a coach rated 65 or below now trains better than no coach (DEV-03).
- Road to Worlds screens: ordered progression with a full "see more", training attribute icons, offers above renewals, lineup swaps from HQ, the coach market by type, a single sponsor contract view, a visual season review with season and career titles, a planned calendar, a six-entry title race with clearer filters, and milestone moments for a Major title, a Worlds title and reaching Championship Sunday. Rocket Street LATAM Championship joins the SAM invitationals.
- Road to Worlds pays profile XP (series, events, titles, season); Season Rating stays draft-only.
- 21 new achievements; veterans keep the rank achievements of their pre-season rank.
- Daily Quiz: one clue at a time, five guesses, a more visual modal. Challenges use the career scoreboard with the running clock. BETA tag on Road to Worlds and a reviewed main menu; the national albums get their own cover in the Collection.
- Web: six search-intent pages (EN and PT), the public RLCS database and regional pages, one metadata helper, structured data and internal links; the PT chrome links to PT pages (WEB-01).

#### Changed
- The coach card and the season's contract review show the coach's contract and renew it (1 to 3 seasons); the sponsor card shows a contract goal once, "during the deal", instead of one entry per split.
- Footer always below the first screen; security headers in `public/_headers`.

#### Balance
- Season ranks: Bronze 200, Silver 5k, Gold 15k, Platinum 35k, Diamond 75k, Champion 150k, Grand Champion 320k, Supersonic Legend 675k (was 60k). Read from 423 profiles: 39 % had reached SSL on the old curve.
- Season Rating: only the top 4 scores, a Swiss exit costs points (Easy 2/1/0/-2, Normal 4/2/1/-4, Hard 7/3/1/-5, Legacy 36/18/8/-7). XP by difficulty: Easy x0.75, Legacy x2.5.
- Rank unlocks: Bronze opens Collection and Challenges; special cards start at Silver (rare), Gold (epic and the FIFAe national teams), Platinum (mythic), Diamond (legendary).
- Draft difficulty recalibrated against production on the enlarged dataset (289 to 484 lineups): worldwide Easy eased, regional boosts compensated, SAM Normal and EU Hard brought to the worldwide curve. All 135 challenge stars and 365 dailies still solve; two three-star paths renewed on the same seeds.
- `CAREER_XP` on C2's recalibration (events, titles, season), with the per-series values at half of the proposal (25 + 15 on a win) because Skip can simulate a season in minutes: about 6–7k XP a season before titles.
- Sponsor fine cap x3 for a contract goal (still under the season cap); elite pricing of rc.46 kept in the contracted-market lock.

#### Fixed
- Elevate brought its Asian players to SAM. Root cause: a region move always carried the org's current lineup; it now carries the roster only when at least two of its players are in the new region's lineup of the database.
- Eight pages (`/play`, `/collection`, ...) exported `index, follow` on the staging build. Root cause: pages that declared their own `robots` overrode the NOINDEX build's blanket rule; no page sets `robots` now and the postexport step fails the build otherwise.
- CLS 0.14–0.35 on phones. Root cause: the footer sat in view while profile-driven pages changed height on hydration.
- Integration: the season's contract review held the rollover for a coach alone but rendered nothing (no way forward); the review now lists him with his renewal. The audit bot renews its coach like the arc bot.

### Balance — rc.46 (2026-11-11), elite talent (R121, BALANCE_VERSION 23)
- Miguel's playtest (SAM, Normal): signed nass very early and won Worlds in 2025. The rc.45 runs agree on the cause: the only two bot careers that held nass paid a $145k fee and $41k a split for an 87 with potential 97, he reached 95 in one season and kept that wage for three (a ready 93 cost $530k and $160k). Root cause: the fee and the wage read today's overall; the upside factor topped at x1.20 for a gap of ten, whatever the top he could reach.
- A young player who can still reach 93 or more costs more: value and wage ask x(1 + 0.2 a point of his reachable top above 92), in full from a reach gap of five, at most x2.2. Players under that line are priced as before.
- He signs later: the reputation gate reads his overall plus 40 % of the gap to his potential while he is still growing (an 87 with potential 97 needs reputation 50, was 40). The Market's lock, its "signable" filter and the signing itself read the same rule.
- Measured (Normal, 63 paired careers, NA/EU/SAM, rc.45 against rc.46): nass now costs $293-328k and about twice the wage; title by 2026 2 to 2, by 2027 3 to 4, by season 10 14 to 9; early endings 7 to 8. The early titles did not move in the bots (they rarely find him); the late ones fell with the dearer youth path. Hard and Easy not measured.

### Added — rc.45 (2026-11-10), support staff (R120, BALANCE_VERSION 22)
- Four support-staff retainers in Finances and on the progression ladder, each a weekly fee, unlocked by reputation, hired and released at will (the psychologist's rules, including the loan lock):
  - Assistant coach (reputation 16, $1.5k a split): reserves bank 80 % of the team's series XP instead of 60 %.
  - Opponent analyst (30, $3k): +0.75 team rating in every playoff round.
  - Physical trainer (36, $3k): the chance of a player missing an event from training wear x0.75, on top of the coach's cut.
  - Brand manager (50, $2.5k): a sponsor decision quoted while he is retained is worth 15 % more.
- The brand manager is not "one more offer": a decision already holds one offer per risk profile (Steady, Balanced, Bold), so a fourth would repeat one of them. He raises the value of the three instead.
- Save: `finances.gear.staff` is optional and additive (absent = nobody retained); no migration.
- Measurement: Normal only (63 paired careers, NA/EU/SAM, rc.44 against rc.45, the audit bots hiring every role as soon as its rung opens): title by 2027 3 to 3, by season 10 11 to 14, early endings 4 to 7, emergency loans in season 5 10 % to 21 %. Hiring all four the moment they unlock costs about $10k a split and hurts a club that cannot carry it: the retainers are a choice, not free strength. The dose-level check on Hard and Easy is left for the next playtest round (Miguel, 10/11: test calmly later).

### Added — rc.44 (2026-11-10), real coaches (R118)
- The dataset's real coaches (144 people from coaches.json) are on the coach market, two a window, tagged "Pro coach". A coach appears once he has coached a season at or before the current one and is not playing it; his quality is his best coach card so far, his experience the seasons he coached, his buff the one on that card. Reputation decides who answers (quality at most 80 + 0.15 x reputation), the first seat comes from the best third of those, the second prefers the club's region. Hired from the ex-pros' rung (reputation 23), paid 1.15 x a generic. The shortlist grows from five to six.

### Balance — rc.44 (R118-R119, BALANCE_VERSION 21)
- Ex-pro coaches: quality base 66 to 70 (a 90 peak coaches near 82, a 99 near 89).
- A registered reserve banks 60 % of the team's series XP from the bench (was none). In the rc.43 runs a reserve of 17 or younger with 15 points of room grew 2.0 a season against a starter's 3.9.
- The user's squad declines slower after its plateau (dampen 0.7 to 0.55): starters lost 0.85 a season at 24-25 and 1.4 from 26. The world's decline is unchanged.
- Measured (63 paired careers a difficulty, NA/EU/SAM, rc.43 against rc.44): no difficulty moved. Normal: title by 2027 3 to 3, by season 10 12 to 11, early endings 4 to 4, Mondays in the red in season 5 2.1 to 2.1. Hard: title by season 10 8 to 11, early endings 12 to 12. Easy: title by season 10 29 to 31. The audit bots rarely field a reserve and gain little from a coach, so these read "not easier", not the size of the benefit to a player.
- Checked, not changed: starters do reach their potential (mean gap 1.7 at 20-21, 43 % within a point); growth already follows the distance to the peak and each player has his own window (peak age 17-26). The report of an 18-year-old in 2030 is the inferred age of a 2027-wave player without a birth date in the dataset (debut at 15 in 2027), not a stuck clock.

### Balance — rc.43 (2026-11-10), mid-career money and progression (R113–R117, BALANCE_VERSION 20)
- Miguel's playtest (SAM, Normal): finances too hard to hold, no room to buy or grow, the middle seasons stall. Paired careers (same 24, NA/EU/SAM Normal, staging rc.38.3 against rc.39) agree: weeks in the red in seasons 3–7 rose 1.9–3.0 to 2.8–4.0, the top quartile's rating in season 7 fell 96.0 to 89.9, prize money in season 7 fell $193k to $94k with no prize table changed (fewer careers reached Majors and Worlds).
- Renewals on Normal return to Hard's ladder: first jump ×2.5, at most ×3.125 (rc.39: ×4.0 / ×5.0). Easy keeps ×4.0.
- Regional pool $40k to $50k and qualifier $6k to $8k, tables unchanged: every regional place pays +25 %, the champion still most. Major and Worlds stay.
- The bank writes an ordinary loan in a shallow red (the hole within half the reputation limit); the offer still arrives by mail. Deeper than that, only the emergency loan, still a pop-up and still counted.
- Chemistry: the bond for a split together doubles (0.10 to 0.20), so a trio with no shared history is Perfect a little past two seasons.
- AI bids for the user's players add a premium for youth (+20 % up to age 21) and reachable potential (+4 % a point), capped at +60 %. His own ask, renewals and the fees the user pays are untouched.
- Measured on the committed doses (63 paired careers a difficulty, NA/EU/SAM, rc.41 against rc.43). Normal: Mondays in the red in season 5 4.0 to 2.1 and in season 7 3.6 to 1.7; reached Worlds by 2027 4 to 11 careers; title by 2027 1 to 3; title by season 10 12 to 12; top-quartile rating in season 7 87.4 to 90.3; early endings 3 to 4. SAM alone (21): reached Worlds by 2027 1 to 5, title by season 10 3 to 5. Hard: title by season 10 6 to 8, early endings 11 to 12, Mondays in the red in season 5 3.8 to 2.6. Easy: title by season 10 23 to 29. Easy regions on Normal were measured on a near-final arm (84 careers): title by season 10 24 to 30.

### Fixed — rc.43
- The audit bot took no bank offer since rc.40. Root cause: rc.40 moved the credit offer to the inbox and `moneyNoticeOf` stopped returning it; the bot only read `moneyNoticeOf`. It now reads the queued offer, as a player opening the mail does. Test tooling only.
- Finances told the player "in the red the bank writes no ordinary loan"; the refusal now says the balance is too deep in the red (EN and PT).

### Changed — rc.42 (2026-11-10), career card layout
- Chasing History adopts the standard card kicker, restrained rows and independent Organization/Player and Major/Worlds filters. HQ shows three entries and the user's club; the complete title table lives in Standings, linked directly from HQ. Empty competitions have an explicit empty state.
- Club identity sits inside the left column, above Trophy Room and Records. Reputation starts at the top of the right column; Records and Progression stretch to the same baseline. Event field/rewards columns share a baseline; reward rows add placement marks, trophy/prize/points icons and a restrained champion highlight.
- Partner event art is a compact 40px mark above the event/invitation title, shared by 50/50 and Duds. Finance tiles separate cash history/runway/debt, weekly breakdown/net/payday and Monday/split forecasts with income/outgoings. Keep their heights equal, cap the small chart and fit its range to recorded balances. Loans & Debt moves beneath left-column Progression, at that column's width.

### Fixed — rc.42
- Root causes: History used oversized counts and a separate heading style; its full list crowded HQ. Club's full-width identity pushed the right column down. Independent column heights left unequal card endings. The finance statement duplicated its net total and overloaded one tile; the chart's zero baseline flattened changes in a positive balance. Partner art had a larger shared canvas and the invitation image sat inside the heading.

### Changed — rc.41 (2026-11-10), career revision
- Remove club presets; retain editable shape/pattern/colour combinations only. Two-colour kits preserve the selected third colour (white initially), one red/black kit, purple/gold restored. Third-colour emblems and Maltese cross; remove symbol outlines/shadows, harmonize/inset patterns, regular stripes, curved fifth field and reversed sash.
- Region difficulty bars; Records in a card and reputation above right-column progression. Combine net/week with Weekly Statement, enlarge balance chart and restore the separate projection card. Cycle growth replaces weekly growth; title standings move below HQ Inbox with rank/count emphasis. Reorganize pre-event reward tables and next-season financial readout.
- Every open week has an optional cup/invitational, visible in future calendar/Skip previews; declined cups stay declined. Spectated Majors/Worlds keep their calendar colours and stop Skip on Sunday, with Worlds follow options also visible at season review. Duds Melow showmatch invitation copy corrected.
- Coach reduces training-wear absence risk by 20% (base illness risk unchanged), reflected in the plan preview. Store the absence reason and explain who misses which tournament in No substitute; outside-window signing sheets explicitly state the transfer restriction. BALANCE_VERSION 19, optional reason field only, frozen save versions unchanged.

### Fixed — rc.41
- Root causes: ready-made club combinations contradicted the intended builder; emblem strokes/shadows polluted small negative spaces; stripe trim broke regular spacing. Calendar previously previewed only already offered cups and intentionally filtered spectators out of next stops; rating/entry caps could leave open weekends empty. No-substitute copy omitted the actual cause; disabled signing buttons conveyed the window only through a tooltip.

### Added — rc.40 (2026-11-10), Road to Worlds feedback
- Eight editable club-inspired crest combinations, third field colour and primary/secondary emblem colour; a career-long Major/Worlds title ledger with pre-X real champions and frozen winning lineups, plus Organization/Player tables in Club. Historical source audit: CAREER-HONORS-SOURCES.md.
- Duds Cup Invitational, supplied DudsMelow avatar, 50/50 tournament art and complete pre-event prize/points tables from the settlement engine. Weekly squad growth/chemistry recap beside HQ scrims; individual career achievement glyphs shared with Profile.

### Changed — rc.40
- Harmonized crest patterns, corrected ring/sash fields and clearer emblem/letter layouts; revised kits and defaults. HQ progression now shows direct purchases only, with a novelty dot; coach unlock mail opens Coaches and its unread marker. HQ uses Inbox glyphs; compact transfer wire sits below Inbox.
- Green/blue/orange selected training options; explicit selected None. Attribute panels show value bars and effect context. Club's trophy room sits above Records in the larger left column, with shared Profile achievement cards.
- Weekly Statement replaces the standalone Monday projection card and keeps its forecast/runway. Loans stay expanded below Movements in the narrow column. Credit offers arrive as email with numeric terms; emergency dialogs prioritize amounts, deadline and repayment, with secondary conditions expandable.
- Bids and sponsorships require accept/decline before advancing; no Later, including old parked decisions. Community Pass sits next to Continue. My Deals shows the player's overall and weekly salary. Full request mapping: CAREER-FEEDBACK-rc40.md.

### Balance — rc.40
- Contracted players unlock at reputation 20 in both the market listing and signing flow. The existing overall cap still applies. BALANCE_VERSION 17 → 18; frozen save contracts unchanged.

### Fixed — rc.40
- Direct regional qualifiers now receive coach pre-match briefings, including an old save already on Sunday. Root cause: the old selector required the Saturday winner's weekend record. Same-day recovery records the briefing without moving the date.
- Routine credit/spend warnings no longer trigger the emergency popup or hold autoplay. Root cause: ordinary proposals shared the blocking emergency notice selector. Legacy quotes remain usable; only emergency notices can interrupt.
- Contrasting initials remain readable on striped crests. Root cause: text ink was chosen from the primary field even when the letters fell over the secondary stripe.
- Simulated titles retain winners and roster snapshots across transfers/season resets. Previously only short-lived event results and user totals existed; no player-level title history survived rollover. Existing saves explicitly disclose incomplete past player records.

### Changed — rc.39.1 (2026-11-10), the 2027 wave moves to the first infinite season
- `CAREER_WORLD.lateIntake.atSeasonIndex` 8 → **6** (R109 corrected): the RLCS 2027 lineups arrive in
  the season the game already calls "RLCS 2027", the first of the infinite era. Root cause: rc.39 read
  Miguel's "s9" as the ninth career season; he meant the first endless season. Seasons one to six are
  bit-identical to rc.39; the wave now lands two seasons earlier and was **not** re-measured there (at
  season nine it was neutral). The retirement protection is now covered by the existing anchor rule.
- No other change. BALANCE_VERSION 16 → **17** (rc.39 was published as 16).

### Added — rc.39 (2026-11-10), the RLCS 2027 wave in the infinite era
- **rc.39 publishes the whole F6 package to staging** (the two sections below, R100–R108,
  BALANCE_VERSION 16) plus this entry. Staging had nothing the branch lacked (rc.38.3 was merged in).
- **The RLCS 2027 lineups arrive at season nine** (R109, Miguel 10/11): the career timeline still ends
  in 2026 (season six), and the dataset's 46 lineups of 2027 (25 orgs never seen before, 31 new
  players) used to stay out of the career for good, because the infinite era ran no dataset intake.
  At the rollover into `CAREER_WORLD.lateIntake.atSeasonIndex` (8) their orgs enter like any dataset
  season's (weakest filler first, then the weakest org outside the wave), and that preseason's anchor
  pass brings the rosters in with the usual fidelity (a probe seats 69 % of the wave after the window;
  the timeline's seasons seat 73–83 %). A player with a 2027 club card does not retire before that
  season. One wave: season ten on is the rc.38 infinite era again. `enabled: false` turns it off.
- Engine: `calendar.intakeSeasonIdFor` is the one answer to "which dataset season does this career
  season bring in" (`worldSim.realOrgIntake`, `market.aiWindowMoves`' anchor pass, `orgHistoryOverAt`).
  Seasons one to seven are bit-identical to the F6 validation; season eight differs only by the
  retirement rolls the protected players no longer take.
- Tests: `worldSim.test.ts` (no intake in seasons seven and eight, every org of the wave in at nine, no
  wave org gives its seat, one wave only; the anchor pass seats the rosters at that preseason only).
- Gates: typecheck and lint clean, full suite 2129 passed / 31 skipped (170 files), career static
  export built. Measured after publish (63 paired careers a cell, NA / EU / SAM, seed 17019): the
  wave is neutral — Worlds titles by season ten 16 % → 16 % on Normal and 16 % → 14 % on Hard,
  insolvency 10 % → 10 % and 29 % → 25 % (F6-EXPERIMENTOS.md 7.11, with the main-regions pace).

### Balance — rc.39 (rc.37 F6), the approved package (published to staging in rc.39; BALANCE_VERSION 16)
- **Renewals climb in larger steps** (R100): `CAREER_SALARY.renewalMaxJump` 2.5 → **4.0**,
  `CAREER_RENEWAL_TENURE.jumpMax` 3.0 → **5.0**. A developed prospect renewed at 2–5 % of his
  market ask; the youth path won 52 % of Normal careers against 0–5 % for any other style.
- **Flatter ask curve** (R100): `CAREER_SALARY.growthPerPoint` 1.20 → **1.17** (an 85 asks −31 %,
  a 90 −40 %, a 65 +13 %; values and fees follow, coaches keep their curve). Signed deals do not change.
- **Easy regions start slower** (R101): `CAREER_REGION_FIELD.starterOvrOffset` SSA −4 / APAC −3 /
  OCE −2 (new careers only) and `.shift` SSA +2.0 / APAC +1.5 / OCE +0.5 on qualifier and regional
  AI sides (from the next regional event of a save there). EU, NA, SAM and MENA unchanged.
- Measured paired with the 06/11 battery (Normal, 147 careers, arms P1 + P2): youth 52 % → 38 %
  Worlds titles, buying 0 % → 24 %, overall title 16 % → 15 %, Major 20 % → 24 %, bankruptcies
  3 % → 2 %; first Worlds of SSA and APAC S2 → S3.
- Tests re-pinned on purpose: the renewal ladder (`rc37F1.test.ts`), the Prospects headliner reads the
  region offset (`rc35FrontC.test.ts`), contract e2's snowball brake is now ≤ 2 × three 85s' wages
  (was 1.5 ×: an 85 is 31 % cheaper), and the emergency-sale share tolerates one rounding step
  (`careerRc37Integration.test.ts`; the offer is priced before the day's growth, the test after).

### Added / Changed / Fixed — rc.39 (rc.37 F6), round of 09–10/11 (published to staging in rc.39; BALANCE_VERSION 16)
- **Chemistry by time together** (R102): past the two-split fast phase a pair keeps bonding
  (`CAREER_CHEMISTRY.bondPerSplitTogether` 0.10) until heritage + connection fills it, and every official
  series the fielded players play counts as time together (`officialSeriesCredit` 0.02). A trio from three
  regions is no longer stuck at 67 %: Perfect about four seasons in. A newcomer inherits the fast phase
  only, so swapping a starter of an old core costs 100 % → 78 %.
- **A three-player squad is ruled out too; a reserve only signs in a transfer window** (R103): with a
  starter out and nobody on the bench the team does not enter that event (hold card "Sit this event out",
  the Market only while a window is open). First season exempt for a squad without a reserve; the rate is
  4 % an official event (`unavailabilityEventMult` 4 → 2). EN/PT: the Squad screen's reserve slot, the help
  entry, a club mail at the start of season two, the absence mail, the missed-event mail.
- **Reputation in proportion to the org** (R104): `CAREER_REP.proportional` replaces the flat soft cap. A
  contender (50–74) earns titles, Majors and the Worlds whole; an elite org (75+) stops earning from
  qualifiers and regional places; a title never pays zero; the season's Worlds champion keeps his
  reputation at a missed season goal.
- **Psychologist** +3/+3 → +5/+5 for 4,500 a split (was 4,000); **championship briefing** "recover" final
  0.4 → 0.6 (R105). Stale "+1 Clutch, +1 Consistency" strings corrected.
- **Hard reads the package through its own scales** (R108): `jumpScaleByDifficulty.hard` 0.625 (rc.37's
  renewal ladder) and `shiftScaleByDifficulty.hard` 0 (no stronger scene in the easy regions).
- **Levers added, off**: `CAREER_DYNASTY` (the three strongest AI sides of the user's Major / Worlds rise
  per recent Worlds title, R106) and `CAREER_REGION_FIELD.tierShift` (measured and rejected as the
  chemistry counterpart).
- Fixed (R107): the bank offered its ordinary loan with the balance already below $0, every cooldown, so a
  structural deficit chained loans and never reached the counted emergency loan. Root cause: rc.37 F2's
  offer read only the runway ("also when already negative") and `bankLoanRefusal` had no balance rule. Now
  no voluntary loan — offer or request — while the balance is below $0 (`CAREER_BANK.blockedWhileNegative`).
- Fixed (audit bots): no reserve ever signed and a Major slot held the clock (23 of 63 careers of the
  first arm). Root cause: the cover routine filtered free agents by `cost === 0`, but a candidate's cost
  includes his signing bonus. Candidates now carry `free`.
- Tests: `rc39F6.test.ts` (chemistry, reputation, Hard scales), `careerRtw05.test.ts` (the reserve rule),
  `careerRc37Finance.test.ts` and `economy.test.ts` re-pinned on purpose. Probe: the championship briefing
  as a title chance (`f6Probes.test.ts`).
- Measured (paired with the 06/11 battery; arms and tables in `docs/battery-rc37/F6-EXPERIMENTOS.md` Part 7).

### Added / Fixed — rc.37 F6, balance experiments (branch `claude/rc37-balance`, no gameplay change yet)
- **Experiment runner** `auditHumanExperiment.test.ts` (opt-in `HUMAN_EXPERIMENT=1`): plays chosen
  battery cells under a balance patch applied in memory (strict deep merge: an unknown key fails),
  battery-format JSONL, sharded and resumable. The integrated code reproduces the 06/11 battery
  exactly (4 + 2 cells checked), so the battery's 4,914 controls are every experiment's paired control.
- **Comparator** `auditHumanSummaryF6.mjs` (arm × battery control, by profile / family / region) and
  **probes** `f6Probes.test.ts` (`F6_PROBE=1`, the psychologist priced in rating points by match.ts
  Monte Carlo: +0.13–0.31).
- **Levers, all off by default** (rc.37 values exactly; BALANCE_VERSION stays 15, fingerprint hash
  only): `CAREER_RENEWAL_TENURE.valueFloorByRenewal` (a renewal floor the jump never caps),
  `CAREER_REGION_FIELD` (`shift` on a region's qualifier/regional AI sides, carried in
  difficultyShift; `starterOvrOffset` on its three founding offers), `CAREER_TITLE_DEFENSE`
  (Worlds opponents per Worlds title the user holds).
- Fixed (battery telemetry): qualifier rows all read "swiss_exit". Root cause: the audit placed
  events with `tournament.userPlacement`, which only reads playoff runs; the game books a Swiss-only
  qualifier with `careerResults.placementOf` ("top8" = through). Rows now carry `advanced`.
- Fixed (battery telemetry): `season.training.prompts` read 0 everywhere. Root cause: since rc.36
  (front T2) no proposal waits for approval; the bot now counts the manager's plan pick at a cycle
  start. `unavailable` = 0 is correct: bot squads carry no reserve, and nobody is ruled out without one.
- Results and the provisional package: `docs/battery-rc37/F6-EXPERIMENTOS.md`.
### Changed — rc.38.3 (2026-11-09), restore special photos

- Miguel reverses rc.38's photo mask: special cards show their photos again
  in offers and review, even when the run hides overall. Restore the original
  SpecialArt rendering and its missing-art fallback. Overall numbers and the
  existing rarity/collection masks remain unchanged, as do the final reveal,
  the revised header, cosmetics and rank-up layout. No art, data or saves changed.
- Update the existing mode/region/daily/restart matrix to require photos in
  hidden and visible runs, and explicitly assert hidden overall stays `??`.
- **Validation:** 19 card visibility/frame tests, typecheck, lint and staging
  export passed (data and persist-contract prechecks included). No captures.

### Changed — rc.38.2 (2026-11-09), draft header

- Season edition now sits next to the team name in the draft offer header,
  at 14px on mobile / 16px on desktop, retaining its edition colour, year
  deduplication and 2027 NEW marker. Region moves to the secondary row where
  the season used to appear; national-team identification stays on that row.
- The shared offer header covers Classic, Quick, Daily and authored Challenges.
  Keep season/region hidden during the spinning reel as before; no game rules,
  data, cosmetic grants or persistence contracts changed. No new captures.
- **Validation:** existing season badge tests (3), typecheck, lint and staging
  export passed, including the data and persist-contract prebuild checks.

### Changed / Fixed — rc.38.1 (2026-11-09), visual review follow-up

- **Fixed (root cause):** rc.38 selected a new title CSS class for Exclusive,
  unintentionally replacing the original manual titles' stroke, gradient,
  glow and sweep. Exclusive is rarity metadata; its titles now reuse their
  original Epic art treatment and their existing individual colours/effects.
- **Changed:** Exclusive rarity labels/list rings/ceremony accents use cyan,
  distinct from Epic violet. This does not recolour the titles themselves.
  50/50 Staff title and pending-art text fallback are white.
- **Changed:** rank-up emblem and rank transition sit directly on the dark
  backdrop; only the lower unlock list / Continue area has a card. Existing
  unlock text and the later individual cosmetic ceremony are preserved.
- **Validation:** full suite 2117 passed / 28 skipped; typecheck and lint clean.
- **Docs:** durable checklist in `PENDING-COSMETICS.md`, linked from STATUS:
  unapplied staging Supabase grant SQL, future Staff art, missing special-card
  photos, unlock-copy decisions and suggestions awaiting selection. No new
  reward proposals implemented. No screenshots requested or generated.

### Added / Changed / Fixed — rc.38 (2026-11-09), cosmetic review

- **Added:** manual `50-50-staff` grant → 50/50 Staff badge + title. Badge has
  a text fallback until Miguel supplies art. Additive staging-only SQL in
  `docs/sql/rc38-staff-grant.sql`; no grants or account permissions changed.
- **Changed:** manual cosmetics use **Exclusive**, between Epic and Legendary,
  consistently in locker ordering, labels, rings, title treatment and ceremonies.
  This rarity is separate from the existing `exclusive` ownership-visibility flag.
- **Changed:** Supernova needs 75 challenge stars; pre-season Champion rank
  badge is Rare; Platinum / Diamond / Champion pre-season titles are grey;
  Leaderboard Finalist title is now Contender (stable saved ID).
- **Changed:** Road Warrior requires reaching season four with one org. The
  achievement keeps its persisted ID and XP history, now checks index 3. A
  cosmetic-only four-season fact is derived on load/actions; the old three-season
  mark alone no longer grants the badge, and no duplicate XP/toast is generated.
- **Changed:** Underdog **cosmetic** retired from catalog/grants/equipment;
  existing refresh/sanitization removes it safely. Its unrelated career
  achievement and history remain. Save versions/keys unchanged.
- **Fixed (root cause):** shared GameCard mounted SpecialArt unconditionally.
  Hidden-overall offers and review now mount a team crest instead, requesting
  no special image. The final results/collection and visible-overall drafts
  still render art, regardless of collection ownership.
- **Fixed (root cause):** the rank-up screen previewed rank-track cosmetics
  before their queued individual ceremony. Remove only that preview, preserve
  all other unlock copy, and restyle the rank emblem/transition panel.
- **Fixed (root cause):** titles used the same 6px corner radius at tiny sizes;
  XS now uses 3px and SM 4px, including the profile season track. Login badges
  now use a 52px box and stronger gold milestone framing.
- **Audits:** `SPECIAL-CARDS-MISSING-rc38.md` (21/111 lack art) and
  `UNLOCK-COPY-AUDIT-rc38.md` (exact EN/PT copy, every cosmetic and rank).
  `COSMETIC-SUGGESTIONS-rc38.md` is proposals only; none were registered.

### Added — rc.37, round-2 career build (integrated onto staging rc.36.21)
- **Staging integration (09/11):** `claude/rc37-integration` (`89a063b`) and the
  battery report (`claude/rc37-battery-report`, `70c506f`, docs only) merged
  onto `staging` rc.36.21 (`63470d3`), so rc.36.16–21 (challenge catalog,
  Draft Labs, dailies, reward UI, badges) stay. Code merged without textual
  conflicts (`balance.ts`: rc.36.16's `DAILY_CHALLENGE` and the rc.37 career
  blocks are disjoint; `types.ts` likewise). Conflicts were only version
  strings, STATUS, this file and the balance fingerprint: both sides had
  bumped `BALANCE_VERSION` 13 → 14 on different tunings, so the merged balance
  is **15**. Gates: typecheck and lint clean, full
  suite **2095 passed / 28 skipped** (165 files), static export with the staging
  flags (career on, noindex) OK.
- Built on `origin/staging` rc.36.15 (`c680a89`), so rc.36.11–15 stay. Merged,
  all textually clean: F1 market `e0cda5a` → F2 finance `13d4fa7` → F3
  matchday `63bedf5` → F4a battery tooling (`claude/rc37-battery@3a94ccd`).
  The F5 replay contract (`23a8c9f`, `RTW-REPLAY-CONTRACT.md`) is docs only,
  awaiting Miguel's approval. Handoffs: `HANDOFF-rc37-*.md`. Gates: typecheck
  and lint clean, full suite 1630 passed / 24 skipped (154 files); no build.
  Battery running; report pending.
- **Credit before the floor (F2):** when the Monday runway falls to ≤ 4 weeks,
  the bank offers its voluntary loan sized to keep $0 for 8 Mondays, instalments
  counted (minimum…reputation limit): a `creditOffer` notice and mail with
  "Take $X", once per 8 weeks, never while a loan runs; Finances pre-fills the
  sum. The −8-week floor is unchanged.
- **Emergency sale (F2):** with cash below $0, one extra AI offer at 65–80 % of
  market value, inside a transfer window only (Miguel, 05/11), never on the
  user's event days; one pending, 14-day cooldown, 7 days to answer, never past
  the window's close. Market/HQ badge it (BELOW MARKET VALUE · fee %;
  Blockbuster bids read ABOVE MARKET VALUE · 150%); `SaleConsequences` shows
  who leaves, the net after the bank's share and the wages freed.
- **Spend alert and season outlook (F2):** a one-off spend that brings the
  projected breach within 4 Mondays raises `spendRisk` at once, with the bank's
  offer when it lends (checked after every player action). The season review
  shows the wage bill now → after the review, debt and deadline, cash to next
  season's first regional (no prize counted) and retirements now / likely /
  possible (decision 8).
- **Matchday (F3):** the Sunday briefing needs a hired coach (without one:
  options hidden, choices ignored, no bonus, old saves included; starting
  Sunday stays available). Championship Sunday applies it by bracket round,
  not by series played (LB R1 = quarterfinal; LB R2/LB SF = semifinal; bracket
  finals and third place = other; only the grand final is the final), named in
  EN/PT. Bootcamp stays a separate bonus under the shared +2 cap and cannot be
  bought during an active event (no charge, nothing consumed).
- **Human battery (F4a + integration; test support, never imported by the app;
  `src/store/auditHuman*`, usage in `auditHumanREADME.md`):** the bot plays the
  real flows with per-profile F2/F3 options: bank credit (take / lastResort /
  never), emergency offers (accept / whenTight / decline; a planned sale never
  takes the discount), the adaptive briefing (Championship: favourite → peak,
  else early rounds; Regional: top 4 by shown rating → Recover, else Study;
  none without a coach), the store's spend alert after every action, F1's band
  and growth models in its market reads. Its memory survives the per-day
  policy copies.
- Battery runner: resumable `ArcRun`; Worlds pairs (+0.5/+1 opponent rating at
  Worlds only, by spy, no patch) fork on the morning of the first Worlds;
  titled tier-A controls extend to S20 from their own S10 (no S1–S10 replay).
  Plan: 7 regions × 3 difficulties × 3 rosters × 39 distinct profiles
  (style-consistency and briefing-adaptive alias coachUpgrades) × 2 seeds =
  4,914 controls (A/B: 14 base profiles with pairs, A also S20; C/D: one-factor
  cohorts), replacing F4a's flat 30,996-career plan. JSONL per shard and
  `done-N.txt`; resume refuses a changed simulation (source hash, line endings
  normalized). New probes: chemistry/heritage per season, renewal vs market
  ask, reputation and prize per event, market wage levels, red depth in weeks
  of payroll.
- Exploit probes on the integrated game: resale is blocked in the signing
  window and the next; going red brings no emergency offer for a locked
  signing (the first legal one, from window 2, at ~68 % of value); a developed
  90/98 renews at 1.3 % of his market ask (2,500 vs 191,750 per split; 1.4 % /
  1.2 % at the 2nd/3rd renewal).

### Changed — rc.37
- **One valuation (F1):** `economy.talentFactorsFor` feeds `marketValueFor`,
  `computeSalaryAsk` and the ask readout; `market.valueInputOf` builds every
  input. It prices the reach gap: the potential his arc still lets him close
  (view `peakAge` + profile `plateauYears`, never the hidden peakOffset).
- **Resale lock (F1):** no AI bid, Blockbuster bid or emergency offer for a
  player the user signed, in his signing window or the next (Worlds window →
  next preseason; `CAREER_VALUATION.resaleLockWindows` 1, 0 = rc.35's rule).
- **Market (F1):** `listingFor` keeps the top 120 contracted (stars included)
  and tops up until 24 are signable, as the free agents do; prices, windows
  and rules unchanged. AI bid weight adds the reach gap (8–30) at any age
  (70/98 at 17: 9 → 29); the daily chance counts only players a bid may target.
- **DEV-04 (F1, decision 7):** new careers stamp `bandModel` 3: the true
  potential sits at a uniform place in the band (L0/L1 uniform, L2 50/50
  against earlier bands), and the age cap applies only once the age clock
  binds. rc.36-and-older careers keep their band.
- Saves additive only (`renewalCount`, `userTitlesBySeason`, `bandModel` 3,
  `TransferOffer.emergency`, `FinanceState.creditOfferAt`/`emergencySaleAt`,
  notices `creditOffer`/`spendRisk`, the event's optional
  `rating.temporaryMod` freezing a bootcamp); persist keys/versions frozen.
  Version 2.0.0-rc.37 (package, lock, site).

### Balance — rc.37 (BALANCE_VERSION 13 → 14, fingerprint `a7db5347`; provisional until the battery)
- **Talent price (F1):** reach-gap tiers ×1.20 at 10 (= rc.36), ×1.40 at 15,
  ×1.70 at 20, ×2.34 at 28 (rc.36 stopped at ×1.30): a 70/98 costs 1.67× a
  70/85, the same talent costs the same at 17 and 21 (an u18 talent loses the
  0.9 discount), and a gap past the plateau is no longer paid. 19+ with gap
  ≤ 10 is bit-identical; founding deals keep rc.36's factors; growth-model-1
  careers price profile-free.
- **Renewals (F1):** the first renewal at the club and tenure ≤ 2 stay rc.36;
  then the jump climbs ×2.75 / ×3.0. The floor stays 0.6 (a rising floor, 0.9
  or even 0.7, sent the median hands-off career to the Backer). Premiums capped
  at ×1.45 and ×2.2 ÷ repPremium (worst single renewal ×4.35, rc.36 ×4.47).
- **Late revenue (F2, decision 5: no wage budget):** from S4, Major pools ×1.15
  and Worlds ×1.25 (every placement, the lobbies and `prizeFor` together); new
  tier 3–4 sponsor quotes ×1.10. S1–S3, other tiers and signed deals unchanged.
  Contract e2's 1.5× brake reads the base economy, so an S4+ dominant season
  keeps 1.56× three 85s' wages at the lowest share.
- **Briefings (F3):** Regional: Continuity +0.10 / +0.10; Recover −0.15 Swiss /
  +0.40 playoffs; Study the Swiss field +0.40 over the whole Swiss / −0.15
  playoffs (rc.36.7: ±0.35). Championship: Balanced preparation +0.10 every
  round; Win the early rounds +0.40 QF / +0.25 SF / 0 other / −0.15 final; Peak
  for the grand final −0.15 QF/SF / 0 other / +0.40 final. +0.40 is worth
  4.79–5.48 pp per cup series at margins −2/−1/0 (a reference curve, not a
  career validation).
- **F1 bot A/B** (7 regions, seed 9100, 7 seasons, vs an rc.36 approximation):
  autopilot Normal 0 Backer, end balance p50 $186k (rc.36 $190k); Hard 1 Backer
  (= rc.36), p50 $21k ($63k); hands-off prospects 0 Backer / 0 insolvent on
  both; youth bot Hard p50 $421k → $205k, for the battery to watch.

### Fixed — rc.37
- Bank-loan mails showed raw numbers. Root cause: R21's `amount`, `weekly` and
  `total` were never added to `newsText.MONEY_PARAM_KEYS` (F2).
- The renewal title premium saw only the current season, and a mid-season
  signing counted that whole season's titles. Root cause: `renewalTitlesOf`
  read `eventResults`, which every rollover clears. `CareerSave.
  userTitlesBySeason` (per season, with days) survives the rollover; older
  saves backfill from the season's results (F1).
- Integration: an emergency offer could target a player signed in the previous
  window and price him outside F1's valuation. Root cause: F2 was built in
  parallel on rc.35's same-window lock (`signedInWindow`) and its own value
  input. `careerFlow.rollEmergencySale` now passes `market.resaleLocked(p,
  seasonIndex, day)`, and `emergencySale.ts` prices on `valueInputOf` + the
  career's growth model (R99; `careerRc37Integration.test.ts`, 3 cases).

### Fixed / Changed — rc.36.21, bounded badge gallery and quieter login
- Challenges use a darker translucent black lock overlay and no rectangle
  behind the rank crest. Rank/milestone conditions and start guards stay intact.
- Badge collection ends at the rating-history column's bottom on desktop;
  smaller 52px art fits complete rows. Capacity follows the available size,
  with View more / Ver mais opening the full badge locker. Mobile uses a compact
  three-column preview. Root cause of the oversized panel: all owned items
  determined the shared grid row's height, stretching past the rating history.
- Login XP uses a fine neutral outline with no coin, fill or orange halo;
  XP-only amounts are quieter. Badge rewards grow 24→40px with a restrained
  warm cell accent; the final-day banner/title still fit the compact calendar.
- No banner-animation, gameplay, reward, unlock, persistence or career changes.
  Visual/validation evidence: UI-REVIEW-rc36-21.md.

### Fixed / Changed — rc.36.20, compact rewards and restored banner motion
- Login uses smaller calendar cells and previews, visual XP tokens, actual
  titles and collected checks. Remove cosmetic-name captions and the oversized
  final-day row; keep the current day in view and XP credited today pinned.
- Remove the Challenges format selector/fixed-seed toolbar. Make lock overlays
  translucent; rank stays on the crest and briefing, while Unlock Path lists
  only prerequisites and milestones. Preserve deterministic seeds and guards.
- Remove rank-preview instructions, repeated reward names/rarities and timing
  prose. Show actual titles both on the progression line and selected preview.
  Compact the selected reward panel; rating history grows from 44px to 80px.
- Restore reusable flame/orbit geometry in banner motion extraction. Root cause:
  reference traversal followed url(#id), but omitted href="#id" dependencies.
  Regression tests cover transitive references and each painted shape appearing
  exactly once across exported motion planes.
- Slipstream streaks and Wildfire embers have independent phases; Singularity
  separates gravitational pulse, tilt and dust; Heatwave separates wave rhythms;
  Cosmic Ascension separates opposite orbits, sparks and radiance. Production
  remains raster WebP plus composited transform/opacity, with offscreen pausing
  and reduced-effects fallbacks. Overdrive still has one deduplicated ring train.
- UI/art only: no gameplay, rewards, unlock conditions, persistence, balance or
  career changes. Validation: UI-REVIEW-rc36-20.md.

### Changed — rc.36.19, visual reward hierarchy
- Locked Challenges show a rank crest, lock, status and numeric milestone bars
  on a distinct dark surface; overlay space accommodates advanced conditions.
- Epic/legendary banners gain restrained static-painted glints with composited
  opacity only. Existing artwork/motion stays intact; offscreen and reduced
  effects disable the accents, and dense leaderboard rows stay still.
- Login reward art grows from 20px badges / 32px banners to 36px / 64px and
  real title tags. Day 30 has a full-width prize row with larger previews.
  XP/progress remain pinned; the current day scrolls into view on opening.
- Featured badges grow 50→56px with aligned centres; collection badges grow
  52→64px with 3/4 columns instead of 4/5. All owned items remain visible.
- COSMETICS-CATALOG-UNIFIED.md joins 89 existing items and 17 proposals in one
  106-row table. Proposals stay explicitly unimplemented. No unlock rules,
  gameplay, seeds, persistence or career code change.

### Fixed / Changed — rc.36.18, visual review after playtest
- Daily login: one calendar, in-cell reward art/names and XP, collected checks,
  current-day highlight and a streak progress meter. Removes the duplicate
  selected-day panel; past ownership never marks future streak days collected.
- Restores locked Challenge overlays with rank, prerequisites and milestone
  alternatives. The briefing remains readable and cannot start a locked run.
- Overdrive has one ring train, scaling along its original focal point.
  Root cause: two copies of the entire ring texture and two frozen SMIL
  phases painted the same rings repeatedly. Deduplicates the ten ring poses.
  Cosmic Ascension separates its original slow 140s orbital groups from the
  nebula and stars; the previous whole-image rotation distorted the composition.
- Rank-up shows earned cosmetic previews, rank transition and readable unlock
  rows; special-card chance now shows the resulting total instead of a delta
  mislabeled as the total. Skipped ranks' cosmetics are included.
- Profile badge slots share a vertical centre, 4px spacing and a smaller
  featured-size difference. The collection renders all owned badges, removing
  the hard-coded 15-item cap. Season rewards are visible at every track node.
- Cosmetic inventory and proposed additions are documented separately; no
  reward rules, gameplay seeds, persistence or career code change here.

### Added / Changed / Balance / Fixed — rc.36.17, daily calendar, unlock paths and cosmetics
- UI-01: redesigned daily-login calendar with credited XP, daily/milestone
  breakdown, XP on every date, selectable reward details and real reward art.
  Desktop shows the calendar and rewards together; mobile keeps close/continue
  reachable. Days after 30 show the correct flat daily XP. Root cause: milestone
  cells deliberately rendered an empty XP label, tiny swatches had no names,
  and most detail existed only in hover tooltips.
- UI-01a: every rank can be selected on the Season Tracker to preview its
  actual banners/titles, art, XP requirement and grant timing. Corrects stale
  turnover wording: #131/rc.20 already restored in-season rank-up rewards;
  no reward grant timing changes in this release.
- Accessibility: calendar buttons derive their accessible names from content;
  the secondary text token has readable contrast and footer links are always
  underlined. Root causes: custom labels differed from concatenated visible XP,
  the faint token fell below 4.5:1, and inline links relied on colour alone.
- UI-02: badge slots have consistent geometry and align-middle; the opaque
  useful silhouette replaces glow-weighted centroids, and art/mask/glow move
  together. Reviews all 35 badges at 28/44/64px, including First Chapter.
- Banner extraction retains painted children of animated groups and animated
  paint-server references. A separate rasterised live background omits moving
  shapes, preventing Overdrive's doubled static/moving rings. Profile, picker
  and previews share motion and crop positions; Cosmic Ascension recovers its
  rings, particles and gradients. Moving art is a static transparent WebP,
  composited with CSS transform/opacity; live SVG/SMIL is authoring-only after
  the production probe caught its repaint cost. Overdrive has staggered pulses;
  legendaries have stronger orbit/sheen. Offscreen loops pause; reduced effects
  use the complete still art. Adds 320px rasters for small previews. Root causes:
  pruned group geometry, hero-only overlays, mismatched thumbnail/mobile crops
  and moving geometry also baked into the background. Motion stays beneath
  the text veil; content and frames have explicit stacking. The performance probe
  now selects current catalog items and asserts its worst-case setup.
- The 45 challenges retain all seeds, goals, solutions and earned progress.
  Adds 17 progression gates on the expanded content: previous challenges,
  clears, stars, perfects, quiz solves and existing RTW Regional/Major/Worlds
  marks. Rank/prerequisite still apply; career milestones have Draft alternatives.
  Locked previews show progress. The run store enforces the same rules as UI
  and New dots; completed challenges remain replayable.
- Future daily rotation covers all 11 templates every 11 days, separating
  Hard/Legacy dates. One reviewed year (09/11/2026–08/11/2027 UTC) has 365 unique
  pinned seeds and legal title+bonus replays through the real store, with reload
  and reward idempotence. Dates before the cutover retain their seeds and rules.
- BALANCE_VERSION 14: daily-only field shifts Normal -2, Hard -4, Legacy -8,
  Underdog -6. Existing global/career tunables are unchanged. Root cause: the
  fixed hand and once-only daily result were never calibrated for title/bonus
  reachability; sampled Legacy and underdog paths had no demonstrated wins.
  Future concede-total bonuses become reach-playoffs objectives (short losses
  must not be advantageous); the 88 OVR objective copy now matches its <= rule.
- Quiz has 259 eligible answers in a seeded deck: each appears before a repeat.
  Before the last guess, ambiguous career/peak ladders gain a minimal nickname
  prefix. Root cause: Espeon/Pluto and Burn/mikan could share all emitted clues;
  independent random dates also repeated answers on consecutive days. Historical
  dates retain their selected answer. No new persistence fields or versions.
- Authorized by Miguel on 07–08/11 while career Gate 3b remains open. Career
  engine/store, main and account configuration are preserved. Evidence and
  remaining acceptance: UI-DAILY-AUDIT-rc36-17.md.

### Added / Changed / Balance / Fixed — rc.36.16, playable challenge catalog and dailies
- Expands the catalog from 27 to 45 fixed-seed challenges (135 stars): 32
  showdowns, six gauntlets and seven Draft Labs. Keeps all existing challenge
  IDs and earned progress/cosmetic references. Adds regional routes, fixed
  captains, club/era/international composition goals and authored offer puzzles.
- Draft Labs check visible roster objectives without simulating a match.
  Format filtering, EN/PT challenge text and goals throughout draft/review
  explain the rules. Paid rerolls are disabled on authored offer scripts;
  dead-offer free rerolls remain legal. Changes to existing seeds, boss shifts
  and two overall caps are recorded in CHALLENGE-AUDIT-rc36-16.md.
- Replaces the false reachability guarantee: the old tests sampled unrelated
  match RNG states after a greedy draft and skipped composition-star proofs.
  Every challenge now has a checked-in legal action trace earning all three
  stars through the real post-draft RNG, engine AND run store, with reload and
  repeat-reward checks. Topple the Titans, Perfect Storm and Time Capsule are
  covered explicitly. Human-readable spoilers: CHALLENGE-SOLUTIONS-rc36-16.md.
- Quiz: exposes the full clue ladder before the last guess, refreshes the UTC
  date on open tabs, rejects stale-date submissions and emits the completion
  mission event once. Root causes: only the first three clues were usable;
  the no-op finished guess still emitted a mission event outside the updater.
- Quiz homonyms: a typed answer can resolve its own nickname even when another
  player shares it (zen/ZeN). Selected suggestions retain their actual person id
  and show country. Root cause: the first normalized nickname always won, making
  OCE's ZeN unanswerable by nickname. All eligible answers now have this check.
- Daily Challenge: enforces one official result/reward per UTC date at start,
  profile grant and stale-run finish. Root cause: only the home tile guarded
  repeat attempts; restoring a run could replay XP/rating/mission rewards.
- Scope: CH-01/02/03 only, authorized by Miguel on 07/11. No career rc.37 code,
  balance.ts exports/fingerprint, persist key/version, accounts or production
  settings change. Gate 3b and the rest of Gate 4 remain open.
- Validation details and playtest checklist: CHALLENGE-AUDIT-rc36-16.md.

### Added / Fixed — rc.36.15, organization art coverage and historical logos
- Audits all 47 organizations missing art: imports 19 verified Liquipedia
  logos and uses a shared transparent light-gray Octane for the remaining 28.
  Sources, exact files and generation provenance: `data-sources/org-logo-audit.json`.
- Adds/corrects season logo boundaries for 11 major orgs, including the original,
  2019 and 2025 Complexity marks; Dignitas, Vitality, SSG, G2, MOUZ, Liquid,
  BDS, Cloud9 and FaZe retain the mark applicable to each historical season.
  NRG keeps its existing era sequence and verified current art.
- Root cause: the fetcher ranked every image embedded on a team page, which
  includes opponents and transfers. It now rejects foreign-name files and
  short ambiguous searches; exact curated files take precedence.
- No lineup/card/player ids, ratings, balance values or save contracts change.
- Validation: 1532 tests pass in the full run; four 5-second resource timeouts
  pass when their two files run alone (20 tests, original limits). Targeted
  logo/data checks (33), lint, typecheck and static export pass. Prebuild: 98
  data tests and 35 persist-contract tests. Logo browser QA: 10 historical/
  new/fallback roster cases, desktop and 320px mobile, no missing images or
  browser exceptions; accounts and analytics stay off in the isolated QA build.

### Changed — rc.36.14, floating NEW marker
- Positions NEW in green at the upper-right with a slight tilt, outside the
  layout flow so it adds no spacing below the lineup name. 2027 uses a modest
  13px label versus the standard 12px.

### Changed — rc.36.13, new-edition marker
- Uses the same season-tag font, padding and border treatment for 2027 as all
  other editions; keeps its gold color and adds a small NEW tag above it.

### Changed — rc.36.12, compact season tags
- Moves the competitive region beside the drawn organization name.
- Removes the season kicker and reduces the edition to a compact colored tag.
  Every edition has a stable color; 2027 uses a slightly larger gold tag and
  a restrained border to distinguish the exclusive expansion. Full edition
  names and years remain readable without relying on color.

### Added / Changed — rc.36.11, RLCS 2027 and draft edition identity
- Adds RLCS 2027 (order 16) and the 46 reviewed preseason rosters: 24
  worldwide and 22 region-only. Ratings, rumor status, identity mappings and
  source links are recorded in `data-sources/rlcs-2027-audit.json`.
- Keeps rebranded people on their existing ids (justin./jstn., Ghaazi/Ghaazi0,
  sucoo/suco, wistyy/wisty) and organization history across regions (including
  FaZe in SAM and NiP in EU). Archive-only ps ids are mapped to game ids.
- The draft offer now highlights the full lineup edition in a high-contrast
  labeled badge, including the year for early seasons. It wraps on mobile and
  remains hidden, including from assistive technology, until the reel lands.
- Existing rosters/cards, special cards, achievements and persist contracts
  are preserved. APAC region-only projects stay dormant. The career calendar
  and rc.37 workstreams are unchanged.
- Fixed: adding a new edition changed the offers behind calibrated challenge
  seeds, taking 11 puzzles out of their difficulty bands. The 27 authored
  puzzles now name their historical ceiling (`maxSeasonId: rlcs-2026`); pool
  selection and the reel honor it without changing seeds, boss shifts,
  weighting or rewards (DESIGN-DECISIONS #156).
- Fixed: the run progress labels could overflow a 320px viewport in Portuguese
  because the row could not wrap. Labels now wrap while the back button keeps
  its size.
- Validation: 1531 tests pass (18 optional skipped), typecheck/lint and static
  export pass. Browser checks cover desktop, mobile 390/320px, EN/PT, both
  2016 editions, team 1, pick/reroll/reload and normal/reduced-motion reveals,
  with no browser exceptions. All 438 previous lineups, 1314 starter cards,
  289 coaches, 147 subs, 17 seasons, 111 specials and 56 achievements verified
  identical; every old player/org id stays valid (only reviewed current
  spellings changed).

### Changed — rc.36.10, spectator card and normal clock controls (R98)
- Non-participant cards contain Watch only; Results and the internal Advance
  action are removed. The standard day strip and Play/Skip/+1 controls return
  below the card, including after elimination in a Major/Worlds Swiss.
- Those controls settle the skipped Championship Sunday with the existing
  flow, then perform their normal day/skip/autoplay action; watching remains
  an explicit choice. Calendar routing and game rewards are unchanged.
- Root cause: a spectator offer was rendered as an exclusive decision, hiding
  the normal clock controls. Targeted Sunday/queue/practice regressions,
  types/lint and static export checked. No balance or save changes.

### Fixed / Changed — rc.36.9, decision priority and presentation (R97)
- Tournament placement/rewards now precede the knockout bracket. Community
  playback uses the formerly empty rail for roster-inspectable participants.
- One article stays expanded: selecting a row closes the previous lead or
  article, while both keep their list positions and no scroll is requested.
- Inserts soft-pause autoplay without clearing Play intent; answering resumes
  naturally if it was running, while a manually paused career stays paused.
- Unparked sponsor offers precede every decision, including a focused card.
  Their popup is owned by the career shell on all routes; financial/training
  popups wait. Later still parks the sponsor prompt when permitted.
- Root causes: bracket placement before the ceremony, knockout rail left
  empty after the prior move, independent lead/row expansion, destructive
  autoplay pause at inserts, and sponsor priority scoped to the HQ card.
- Validation: 167 affected tests pass (including prior Play/Pause insert
  state and sponsor/deferral ordering), typecheck and changed-file lint clean;
  static export/postexport pass. No balance/persist contract changes.
  Browser preview still times out; visual acceptance remains on staging.

### Added / Changed — rc.36.8, follow-up interaction fixes (R96)
- Practice reveals use 100ms game steps (150ms reduced motion). Closed news
  rows use a smaller partner image; opening an article expands it at its
  existing list position without scrolling or replacing the lead story.
- News notices resolve scripted-beat org references before choosing crests.
  Email popup rails have padding to preserve their outside border/ring.
- The orange Advance action dismisses the spectator offer and resumes the
  natural daily autoplay in HQ, rather than routing to Calendar. Watching
  remains available; spectator playback gains 1x/2x/4x controls.
- Community 1v1/2v2 participants are visual player cards on the HQ invitation
  and matchday decision, before Play. Selection persists on an unaccepted
  offer and survives acceptance; the lobby uses the same cards.
- Knockout-only cups display a wide playoff bracket in the main playback
  area and a fully revealed bracket in the digest.
- Departure guards hide an old route before save mutations expose its empty
  or intermediate state; settled routes release the guard. A timeout allows
  recovery from failed navigation. Invitation field previews now show the
  offered event instead of the empty-event message.
- Root causes: explicit news scrollIntoView, clipped overflow around toast
  rings, lost resolved org refs, small single-elimination sidebar/digest
  omission, and synchronous save mutations preceding asynchronous route
  commits. BALANCE_VERSION 13; persist contracts unchanged.
- Validation: 141 targeted tests pass, with the 10-test practice/community
  file rerun after adding pre-acceptance lineup coverage; types/lint/static
  export and postexport pass. Browser preview connection timed out in this
  session, so visual confirmation remains an acceptance check on staging.

### Added / Changed — rc.36.7, discreet feedback and weekend hierarchy (R95)
- Newsroom / Central de notícias accompanies 50/50's logo. Selecting a row
  replaces the lead story with its full text, including in the expanded feed.
  News notifications carry the partner logo; stories without an attributed
  org use it as their image. Real org stories retain their crests.
- Practice reveals scores within This week's scrims, in quick 320ms game
  steps, without a clock or top-of-page broadcast. Skip crosses practice
  days normally and clears playback; daily/autoplay steps retain the detail.
- Transfer-window dates use a blue inset underline and background instead
  of an extra dot. Event icons remain singular; weekday event precedence
  prevents a simultaneous scrim marker.
- Watch/replay and Continue to calendar share secondary-button emphasis on
  opposite sides of the follow card. Results is subordinate to watch.
- Qualifier lobby: participant cards left, smaller direct-eight list right,
  reading the engine's committed weekly seeding. Weekend cards have distinct
  qualifier/regional icons and more breathing room, stacking on narrow screens.
- Briefing is phase-based: Recover −0.15 Swiss / +0.35 playoffs; Prepare
  +0.35 Swiss / −0.15 playoffs; Continuity +0.10 throughout. Sunday briefings
  after a Major/Worlds Swiss affect remaining playoffs only, explicitly shown.
  Completed rounds and frozen ratings are untouched. BALANCE_VERSION 12.
- Root causes: a global practice banner/Skip stop overwhelmed a small weekly
  detail; window markers competed with tournament icons; ghost calendar
  controls obscured the alternative to watching; opener-only briefing effects
  did not express the requested Swiss/playoff trade-off. Gate 3b stays open.
- Validation: 160 targeted tests pass; changed-file lint/typecheck clean;
  career/noindex static export and postexport pass. No unrelated modes or
  long economic matrices rerun. UI checked in the disposable local career.

### Added / Changed — rc.36.6, career interaction and 50/50 (R94, 2026-11-03)
- Tuesday/Wednesday practice broadcasts: a short game clock and series
  score reveal keep the day on screen, then autoplay resumes. Skip stops at
  recorded practice; reload never re-simulates a result. Legacy Thursday
  bookings move forward to a legal weekday. Planned practices show on the agenda.
- 50/50 presents the public news feed using Miguel's supplied logo. Private
  bids, contracts, finance and qualification notices belong in the inbox;
  technical maintenance, routine practice and generic filler digests are silent.
  Qualifier outcomes send one league email rather than duplicate notices.
  EN/PT articles use reporting language; mail has a greeting, paragraphs and
  sender signature. Existing messages are reclassified additively on load.
- Showmatch invitations from 50/50 and duds; the 50/50 Community Cup joins
  the rotation. No weekly random events before the first career regional.
  Occasional community 1v1/2v2 cups allow a roster selection, deterministic
  eight-side brackets, real participant attributes and normal community rewards.
- Shared regional name catalog imported from the supplied workbook: 834
  player names, 280 org names, four Excluir rows respected. All sources draw
  from the same approved catalogs through seeded non-overlapping allocations.
  Five collisions with real players get II; three cross-region homonyms get
  region labels. Legacy careers retain their stored identities and versioned banks.
- HQ highlights newly available upgrades; locked camps have no purchase
  action or price. Camp purpose/duration are clearer. Training's attribute
  guide sits above the coach and growth section with one explanation per stat.
- Roadmap reconciled in ROADMAP-NEXT-2026-11-03.md: three remaining work
  sessions plus cutover, conditional on playtest acceptance and external setup.

### Fixed — rc.36.6
- Calendar controls previously called day advancement while a private
  decision held the clock, producing a silent no-op. They now route to the
  decision, Sunday start, event or season screen using the clock's own state.
- Hidden training reports still stopped autoplay, and repeating the plan
  depended on an invisible Continue button. Opt-out now consumes/continues
  each report, repeating the plan exactly once while preserving cycle payout.
- Non-participant event cards exposed three follow actions plus three clock
  controls. They now expose watch, results and continue-to-calendar only.
  Follow suggestions no longer appear as "Also — Without You" on a bid.
- A failed qualifier removed the regional from the agenda. It now stays
  visible and reads not qualified/spectating; it never becomes a user lobby.
- Transfer-window dots previously appeared only on the first Monday; every
  open-window day now has its own blue marker on both calendars.
- Legacy world repair must preserve nameBankVersion 3 rather than downgrading
  a new catalog to the rc.29 bank. Persist keys/versions remain unchanged.
- BALANCE_VERSION 10 → 11. Static assets-only hosting and production remain unchanged.

### Added / Changed — rc.36.5, playtest corrections and local progression (R93)
- Restore the game's fonts/colours in news notices, keeping their distinct
  editorial header/date/subject. Career match presentation lasts about 25%
  longer at 1×. HQ Skip is secondary blue; +1 day tertiary. Instant result
  is secondary blue. Weekly scrims prefer fresh opponents with legal rematches.
- Cycle results: primary Continue repeats the reported package even with a
  planning coach; secondary Change opens the editor. Persisted opt-out of
  automatic results, re-enabled in Training; history stays available.
- Spectator Swiss games left, standings right; team names/crests open rosters
  in live events, standings, brackets and results. Inspection pauses playback.
- Locked coaches visibly grey/locked; purchased progression items and used
  camps have no Buy action. Full evidence: CAREER-FEEDBACK-rc36-5.md.

### Balance / Fixed — rc.36.5
- Local strength rebased to the user's current squad each season, erasing
  relative progress. Persist a career-long local origin and cap its yearly
  growth at 1.5; preserve the current season's frozen field on existing saves.
  63 paired three-season starts, plus four paired six-season SAM/Normal/
  prospect careers. Gate 3b remains open; no end-to-end title pacing claim.
- Steady's total exceeded Balanced partly because the contracts lasted
  6/3/1 splits. New profiles all last 3 splits; signed/legacy terms remain.
- Compounded prizes produced irregular amounts and rounding plateaus.
  Round annual pools/payouts by tier, increase each season and reconcile all
  placements to the exact displayed pool. Legacy rollback modes preserved.
- Cycle repeat was disabled by an already-started coach plan; Continue now
  acknowledges/repeats atomically, without duplicate XP or completion pay.
- Scrim exclusion covered only today; automatic picks now check the week.
  Buy was rendered unconditionally for unlocked owned items; omit it.
- BALANCE_VERSION 9 → 10; no save-key/version reset or production deployment.

### Added / Changed — rc.36.4, paid endgame coverage and late benefits (R92)
- Complete paired 3 difficulties × 3 founding rosters × 7 regions matrix,
  plus 14 paired Normal/prospect careers; actual purchases, maintenance,
  salaries, transfers and prizes. Controlled qualified-Worlds-field replays
  isolate the new flat rating edge without granting rosters or qualification.
  Coverage, limits and remaining pacing/economy issues: CAREER-ENDGAME-rc36-4.md.
- Calendar scrims use larger vertically stacked score rows, both club marks,
  weekday and opponent. News notices have a newspaper masthead/date/subject,
  serif headline and summary; mail has envelope/sender and an opaque surface.
- Follow-up roadmap packages and realistic completion estimate documented;
  the review starts no Etapa 4–6 work and does not close Gate 3b.

### Balance — rc.36.4
- Existing Performance Centre adds 1.5 competitive team rating independently
  of the org-buff channel. Structured camp preparation 1.0 → 1.75; psychologist
  Clutch/Consistency +1 → +3 while retained. Details show actual configured
  benefits. Prices, gates, upkeep and temporary-effect cap preserved.
- No historical Worlds titles in the 77 candidate careers: end-to-end timing
  remains unproven. The Normal/prospect qualified-field replay yields 0 → 21
  titles in 768 draws per variant; conditional evidence, not a per-start rate.
  BALANCE_VERSION 8 → 9; earned overall and signed contracts preserved.

### Added / Changed — rc.36.3, career timing and weekly feedback (R91)
- Paired split/season milestone probe and report: 98 before / 98 after,
  7 additional academy careers and 28 mixed-strategy careers across 4 seeds;
  63 instrumented eight-season finance careers. Six historical seasons are
  explicitly separated from the infinite era. The timing goal stays open.
- Weekly real scrim results below Advance, inside the HQ calendar card,
  with a localized weekly empty state; no extra simulation, reward or XP.
- Progression unlocks use notification/inbox and link to HQ progression;
  purchases open only on request. No automatic unlock purchase modal.
- Attached rc.29 plan reconciled against staging in the roadmap review.
  No Etapa 4–6 feature work or production cutover started.

### Balance — rc.36.3
- Local scene −7…+1 → −1…+4; growth unit 50.25 → 60; one Community Cup
  rep award per split; no extra rep for a regional Swiss exit; soft cap 60.
  One underdog qualifier series win can pay once per split below rep 25.
- New-signing cap 71 + 0.4×rep; first sponsor gate 10. New founding deals
  fit 32 Normal / 18 Hard weeks (44 Easy), with the same start budgets.
- Potential, earned overall, signed contracts and match difficulty preserved;
  no new calendar locks or forced losses. BALANCE_VERSION 7 → 8.

### Fixed — rc.36.3
- Founding payroll could slightly exceed its coverage budget: scaling already
  rounded weekly wages crossed a new rounding boundary. Fit now checks the
  actual weekly bill; signed contracts are not repriced.
- Weekly-insert reputation skipped unlock announcements because it changed
  reputation directly. It now emits the same notification as event rewards,
  once on that decision, without purchasing anything.
- Negative HQ cash did not explain the emergency-loan trigger. Show the
  actual credit floor and Monday rule; all three difficulties and reload
  passed. No missing valid rescue was reproduced without Miguel's save.

### Added / Changed — rc.36.2, Gate 3b playtest corrections (R90)
- Selective color restored to HQ finances/progression/news, training and talks;
  blue links, orange progression, compact coaches and clear salary hierarchy.
  Squad content sits below OVR/crest; team OVR joins stars, cards use actual
  OVR rarity frames. Bootcamps can be bought beside the HQ squad.
- Ordered strong/light crest colors with real black; new subtle club-inspired
  shapes/patterns/mascots and short playstyle help. Saved IDs and procedural
  org generation preserved. Region examples sort RLCS X rosters by OVR,
  explicitly labelled as the starting era, as Miguel requested.
- One-day advance is secondary, skip-to tertiary beside it; remove empty decision
  text and typed-name abandonment. Available is a checkbox by Market sort.
  Arsenal checkmarks stay on the rail, item icons move inside horizontal rows.
- Training identifies the running plan while editing, integrates attribute help,
  compacts scrims/coaches, distinguishes prime and aligns restart/plan/close left.
  Weekly scrim recaps reuse actual records; no new sessions, matches or XP.
- Window-day cards are blue; spectator playback has explicit Swiss standings
  before the bracket, a stronger champion, one flow and quiet skip controls.
  Standings region/table filters share a row and the profile banner wraps safely.
- Sponsor comparison leads with maximum return per payment week and shows total
  and duration beneath. Active deal separates pay, goal and contract run.

### Balance — rc.36.2
- Approved playtest: +1 reputation for the target, +2 for the stretch,
  independently and once at season review; normal cap/unlocks, no back payment.
- Sunday: continuity +0.10 throughout; recovery −0.15 opener/+0.35 later;
  preparation +0.60 opener/−0.15 later. Every option now has a useful role.
- One economy candidate: common season index 1.12 → 1.15, renewal current-wage
  multiplier 1.50 → 1.75 and market floor 50% → 60%, core jump guard 2.5 kept;
  coach quality wage curve 1.12 → 1.14. Signed amounts stay frozen.
  Focused six-career comparison and limits: ECONOMY-RC36-2-PLAYTEST.md.

### Fixed — rc.36.2
- Raw “beat” toast: the queue discarded beatId and used a generic template
  lookup. It now resolves the real bilingual headline, with source/icon/excerpt
  and a destination in news or mail.
- Missing Community/Invitational days: agenda lookup only covered official,
  active and committed events. Current invitations and played cup days appear;
  legacy cups played before their re-timed Saturday never become future stops.
- Premature spectator bracket: an empty playoff object rendered during Swiss;
  the whole bracket now waits until Swiss is revealed.
- Negative Sunday opener was ignored by a positive-only check; both signs now
  apply. Existing stable/long sponsor totals no longer masquerade as better
  weekly value; sponsor prices themselves are unchanged.

### Changed — rc.36.1, Gate 3b playtest corrections
- Restored restrained career styling: compact HQ finances with a larger balance
  and chart, taller starter cards, shorter Major/Worlds tabs, simple goal rows,
  three vertical progression items with purchase actions and next unlock below.
- News returns to thin rows with one lead story, type icons and selective crests.
  Training, its picker and report use neutral surfaces; Recommended is yellow.
- Calendar shows one month with previous/next controls. All transfer-window
  day cards in HQ carry a blue top strip, including days with an event.
- Crest creation uses predefined palettes only; removed arbitrary color inputs
  and the contrast meter. Existing saved colors remain readable.
- A completed training package can start again directly from its report/picker;
  past-cycle history is no longer shown on the training screen.

### Fixed — rc.36.1
- Training gain appeared full before earning it and its animation jumped.
  Root cause: future gain occupied the remaining bar and flex widths animated
  against instant sibling updates; early paid gain also rounded away. Only
  earned gain now fills the track, with finer selector precision, a stable
  transform and reduced-motion support. Growth and payouts are unchanged.
- Removing bonus/share could leave acceptance unchanged because the sheet
  silently increased wages. Reductions now preserve the chosen wage; engine
  and flow regressions cover the effect on offer worth and acceptance.
- Sponsor offers open directly when active; no preliminary HQ decision card.
  Existing deferral, deadline holds and reload persistence are retained.
- Spectating used bespoke result lists instead of the career tournament boards.
  Recorded rounds now feed the shared Swiss and bracket components, with
  future scores and playoff qualification kept hidden until revealed.

### Added / Changed — rc.36, Etapa 3 complete (R83–R88)
- Selected 28-day training cycles, focus and Evolve/Gel/Recover, completion
  payouts, coach planning, modest Heavy/Hard wear and new signings in the plan.
- Compact HQ/squad/progression/finances, stacked arsenal, Close-only unlock;
  sponsor cards in a modal; a sent-offer contract talk with refusal history.
- Fixed season-wide goals with deadline/progress and review, visual archive-
  aware news, career achievements in the general mode-filtered collection.
- Custom crests/colours/contrast guard, visual calendar; Saturday HQ, optional
  briefing, explicit Sunday start, once-only accessible intro and following
  an event after elimination. Reduced-motion/keyboard behaviour verified.
- Economy probe checkpoints completed careers, matching the ARC instrument,
  so long runs remain inspectable. Optional ECON_ARC_OUT retains the exact full
  ArcCareer result from each measured career for ARC_REPORT, avoiding a duplicate
  sweep; every cell checks the bot softlock and merged outputs check uniqueness.
  No gameplay or persist contract changes.

### Changed / Balance — rc.36, POL-04 (R86)
- Every founding roster now receives the same budget for its difficulty.
  Founding wages fit that budget, including the veterans; existing deals and
  balances remain as signed. Removed the Merch & streams income.
- Free-agent prospects replenish in every region at each seasonal intake and
  appear in the market alongside its best-overall and signable selections.
- Generated players reach the same potential later: a one-year peak shift,
  a gentler base growth curve and an 8.5-point season ceiling. Growth room
  spreads over the remaining weeks to preserve the no-flat-weeks fix.

- POL-04 calibration slows user training/match XP through the existing
  training-week denominator; procedural opposition and match difficulty stay
  fixed. Heavy package boost is 1.3× the normal package boost to retain the
  training contract band without changing normal packages or their wear.

- Final Normal measurement: 349 Majors and 131 Worlds in 765 season rows
  across 98 careers: 0.4562 / 17.12%, no softlock. The 0.44 / 16% target is
  close, not exactly met; its residual is explicit for the Gate 3b playtest.

### Fixed — rc.36, POL-04
- Young free agents could disappear from the market despite being available:
  the shared overall-only listing cap crowded them out behind veterans.
  Prospect listings now bypass that cap without removing signable options.
- Founding wage fitting is an engine money rule used by both creation and the
  wizard, rather than a separate formula in the save flow. The interrupted
  empty-seat test now picks the seat's actual cheapest eligible player;
  lowest overall alone did not imply the cheapest salary ask.

### Fixed — rc.36 integration
- Growth regressions now isolate the actual contract: a player already at the
  legacy split ceiling must keep growing, and peak comparison follows the real
  weekday calendar through the full plateau. Root cause: one fixture assumed
  three points in ten weeks, another observed only four truncated calendar
  years. The original one-tenth peak-equality assertion is retained.
- Calendar Advance no longer deep-copies the whole save twice per day. Root
  cause: it cloned before passing the result to day arrival, which already
  owns the deep-clone boundary. The new clock is copied first; day arrival
  still isolates all nested data. A frozen-input Monday regression and the
  complete pre-change eight-season deterministic trace both pass.
- Starting a training package after the daily session no longer runs an early
  scrim outside its displayed window. Root cause: sessions respected
  `packageFromDay`, but package scrims did not. Tuesday/Thursday starts and
  repeated same-day choices are covered; the base session is never paid twice.
- Removed the HQ finance view's unused guaranteed-income and debt fields after
  the compact finance block replaced them; the committed cash projection stays.

### Added — Phase 0 (technical base)
- **Season model** (`src/config/season.ts`): the current season is a build-time constant
  (`SEASON.id = 1`, pre-season = 0). `profile.season` tags the season-scoped fields
  (`xp`, `mmr` keep their names so every reader keeps working), plus `peakMmr`,
  `peakRankId`, `runs`, `titles` and a 40-entry `ratingHistory`. `lifetime.xp` accumulates
  across seasons. `src/engine/season.ts` holds the pure helpers (snapshot / normalise / merge).
- **Profile persist v12 — the Season 1 reset** (DESIGN-DECISIONS #110). The migrate archives
  the pre-season (`xp`, `mmr`, rank, runs, titles, challenges cleared) into
  `legacy.preseason`, then resets `xp → 0`, `mmr → 400`, `challengesCompleted → {}` and
  starts a fresh `season`. Collection, achievements, lifetime counters, run history and
  records are untouched. `mergeProfiles` normalises BOTH sides first, so a cloud row written
  by an older build can never re-inflate a Season 1 profile. `persistContract.test.ts`
  frozen at v12 with the new sacred fields (`season`, `lifetime`, `legacy`, `grants`,
  `cosmetics`, `missions`, `login`, `events`).
- **Season Rating** (`SEASON_RATING`, #111): replaces the title-only MMR for live play. Signed
  placement × difficulty deltas (Legacy title +26 … Normal Swiss exit −3), floor 0, the first
  5 runs of a season protected from losses, Daily ×1.25 / Quick ×0.5, hidden overalls +15 %
  on gains. `lastMmrGain` is signed now. The old `MMR` table stays for pre-season backfills.
- **Cosmetics** (`src/data/cosmetics.ts`, `src/engine/cosmetics.ts`): titles, badges, profile
  frames and banners, all CSS/SVG (no assets, no requests). Ownership is DERIVED from the
  profile's facts (legacy snapshot, cloud grants, season peak rank, login streak, challenge
  stars, quiz solves, missions) and cached with unlock dates; `equipped` holds explicit
  choices (null = auto best, `none` = hidden). Catalog: pre-season legacy rewards ("Day One"
  title + "First Chapter" badge, peak-rank frames Bronze→SSL, "Pre-season Legend", board
  position banners/titles Challenger→Champion), manual grants (Early Supporter, Founding
  Contributor, Pro Player), the Season 1 rank track, login-streak, challenge-star, quiz and
  mission rewards. Copy `COSMETICS` EN + PT; `cosmetics.test.ts` enforces catalog ↔ copy.
- **Supabase v2 client** (`lib/supabase.ts`): the push writes the `season_*`, `lifetime_xp` and
  `equipped_*` columns and NEVER `xp` / `mmr` again (they are the frozen pre-season archive);
  the read embeds `profile_grants` and `preseason_position`; `fetchLeaderboard` returns the
  cosmetics per row and filters season columns by `season_id`; `fetchHallOfFame` reads the
  frozen pre-season board. SQL (idempotent) + freeze step in the plan §6.
- **Missions** (`src/engine/missions.ts`, #112): 31 daily + 25 weekly templates, one per tier
  (easy / medium / hard) picked deterministically from the date among what the player can do
  (rank / Legacy / career gated). Typed progress events from the stores (`run_completed`,
  `special_selected`, `challenge_cleared`, `quiz_played`, `career_*`). Rewards auto-grant
  (`MISSIONS` in balance: 40/80/150 daily + 120 all-three; 150/300/500 weekly + 400). Copy
  `MISSIONS_UI` EN + PT. `profileStore.applyMissionEvent` / `rollMissions`.
- **Login streak** (`LOGIN_STREAK`): first open of a UTC day counts; 25 XP growing +5/day to
  75, milestone bonuses at 3 / 7 / 14 / 30 with cosmetics; a gap resets to 1, `best` is kept.
- **Event-exclusive special cards + Special Hunt** (#113): a special card may carry
  `event: { from, to, huntRuns? }`. Inside the window it joins the eligible pool at its
  rarity's rate and bypasses the rank rarity gate; outside it is never offered. After
  `huntRuns` finished runs in the window (`profile.events`) its chance is ×3
  (`SPECIALS.event`). Fixed per run at draft creation (`draft.eventSpecials`); the shared
  Daily applies the window but not the per-player boost. Schema + `eventCards.test.ts`.
- `profileStore.grantXp` (missions / quiz / career milestones), `setEquipped`,
  `refreshCosmetics`, `recordLogin`, `recordEventRuns`; `selectCollectionUnlocked` keeps the
  Collection open for anyone who already owns a card (veterans after the reset).

### Added — Phase 1 (player-facing surfaces)
- **Season recap "Your Legacy Lives On"** (`SeasonRecap.tsx`): three steps (final numbers →
  legacy rewards → what the reset means + what is new), shown once to every pre-season
  profile (flag `seenSeasonRecap`), replayable from the profile. Upgrades with the board
  position when the cloud sync brings it.
- **Profile v2**: identity card (banner, framed rank emblem, name + title + badges, Season
  Rating with the last delta), season panel (week / days left, peak, runs, titles, rating
  sparkline, the Season track), lifetime stats, the **Locker** (equip titles / badges /
  frames / banners; locked items say how to get them), achievements, run history.
- **Leaderboard v2**: Season Rating (headline), Pre-season Hall of Fame, Titles, Legacy
  overall, Regional overall. Every row shows the player's frame, title, badges and banner;
  tapping a row opens a profile peek.
- **Missions UI**: home widget (today's three + the streak) and `/missions` (daily, weekly,
  login streak card with milestones). Reward toasts (`RewardToaster`) for completions, the
  all-three bonus, login XP and quiz solves.
- **Daily Quiz** `/quiz` — "Guess the Player" (`src/engine/quiz.ts`): one player per UTC day
  among those with ≥2 lineups, clues from the dataset (nationality → era → orgs → teammate →
  peak card), three attempts, type-ahead over nicknames, XP 120 / 80 / 50 by attempt,
  history + streak on the profile. Indexable page (new sitemap entry).
- **Home v2**: hero + SEO content untouched; new season strip (framed rank, title, badges,
  rating, week, streak), featured Classic Draft + Road to Worlds, "More ways to play" (Quick,
  Daily, Challenges, Quiz), "Your progress" (missions + Collection / Achievements / Profile /
  Leaderboards). The v1.4.6 Season 1 announcement pop-up is removed.
- Cosmetic renderers (`src/components/cosmetics/CosmeticViews.tsx` + CSS): frames (gradient
  rings, sheen / holo loops off under `lite-fx`), banners (gradient + pattern), title tags,
  badge glyphs.

### Added — Phase 2 (Challenges 2.0, DESIGN-DECISIONS #116)
- **Three stars per challenge.** Star 1 = the clear (`reward.xp`, once); stars 2 and 3 are
  authored conditions (`noSpecials`, `sweep`, `maxOverall`, `chemistry`, `underdog`,
  `maxRerolls`, `goals`, `concede`, `noLosses`) paying `CHALLENGE.starXp[tier]` the first
  time each is earned. Cleared challenges stay playable for the missing stars; nothing
  re-pays. `profile.challengeStars` (bit masks, cloud merge = OR); the Season 1 reset
  clears both the stars and the cleared map (the old count lives in the snapshot).
- **Gauntlets** (`kind: "gauntlet"`): stages (Bo5) before the boss (Bo7), one loss ends the
  run. Four shipped: Rookie Road (Silver), North American Dynasty (Platinum), European Crown
  (Champion), World Tour (SSL). The set is now **24 challenges**, every one with two stars.
- **Sim validation extended**: `challenges.test.ts` plays the whole attempt (stages + boss)
  on the fixed seed with the competent auto-draft, keeps the win-rate bands (floor
  legend ≥15 % / others ≥30 %, ceiling 85 %) and asserts the outcome-based stars (sweep /
  goals / concede) are reachable. Rates on 2026-10-16: commons 38–75 %, rares 33–63 %,
  epics 46–69 %, legends 17–34 %.
- Star track (10 / 25 / 45 stars → cosmetics) on `/challenges`; stars on cards, in the
  briefing (with their XP) and on the result hero ("new star" + XP); gauntlet stage list on
  the match screen.

### Added — Phase 3 (Road to Worlds 2.0, sub-phase A · ROAD-TO-WORLDS-DECISIONS R20–R25)
- **Weekly payroll.** Money moves every Monday: sponsor base and fanbase in;
  one aggregated squad-wages line, coach, psychologist, upkeep and the bank
  instalment out; then the Backer floor check. Contracts are still negotiated
  per split (save schema unchanged) but every wage label reads "/ week". The
  hub tile, the Finances tiles, the new "Weekly statement" panel and the ledger
  all read one `weeklyStatement`. Runway line ("N weeks at this burn") and a
  one-time cash-warning mail at 4 weeks.
- **Bank loan.** Request a loan sized by reputation (6k → 90k), 12% flat, 16
  weekly instalments, pay it early any time; blocked while the Backer debt is
  open. Finances groups bank + Backer under "Loans & debt".
- **Coach effects spelled out** on every coach card and the squad slot
  (training speed vs. no coach, team-rating add, stat buff); better coaches
  visibly pay more (`coachMult` 0.85–1.3).
- **Community Cups field the local scene**: at most two orgs stronger than you
  plus procedurally generated local amateur teams rated around your roster —
  early cups are winnable, regionals untouched.
- Starter roster offers rebalanced (no dead start); `src/store/careerV2.test.ts`.
- **HQ rebuilt around the clock** (ROAD-TO-WORLDS-DECISIONS R26): a Day Card
  with the seven-day strip (the today ring glides on every advance, the strip
  slides in when a week turns), **Advance one day** as the primary control
  next to skip-to-next-stop and autoplay; a **Needs you** rail with one card
  per decision (new Community Cup invite card, bids, sponsor offers, expiring
  contracts, cash warning, Backer debt); **What you can do today** status
  cards; **Your edges** (active coach, gear, psychologist, bootcamp Sharp,
  sponsor perks). Calendar marks payday every Monday.
- **Training 2.0** (ROAD-TO-WORLDS-DECISIONS R27–R29): a **weekly team
  drill** (five to pick from; everyone sharpens the drill's attribute, sessions
  run hotter; the coach auto-picks when training is delegated), **growth made
  tangible** on every player card (progress to the next point, ETA in training
  days, split/season caps), **"What your attributes do"** (the fielded team's
  stat line as the exact sim modifiers), scrims in three sparring tiers, and a
  lifted growth curve for 21+ players.
- **Shared sim:** offense and defense now weigh on every game
  (DESIGN-DECISIONS #117); goldens regenerated.
- **Regional qualifier** (ROAD-TO-WORLDS-DECISIONS R30): every regional week
  opens with a Wednesday 16-team Swiss for everyone outside the split's
  direct top 8 — the non-direct orgs, your org when not direct, and local
  amateur sides filling the field. Its top 8 join the direct 8 on Saturday.
  Through it: the regional is booked (news + mail); out: the week is yours to
  train. The hub, calendar and lobby read the same seeding the engine fields.
- **Real orgs enter the world by season** (ROAD-TO-WORLDS-DECISIONS R31):
  rolling into 2021-22, 2022-23, 2024… brings that season's new real orgs
  (they replace the region's weakest filler; the preseason anchor pass fills
  their real lineups). News on arrival.
- **Permanent career achievements** (ROAD-TO-WORLDS-DECISIONS R32): fifteen
  milestones that are yours across every save and never reset with a season
  (first sponsor, bank repaid, through a qualifier, 50/100 reputation, third
  season, Major qualified/won, Worlds qualified/won, Worlds as an underdog or
  homegrown, three Worlds, every difficulty). Each pays Season XP once, pops
  an achievement toast and unlocks career cosmetics (Regional Champion, Major
  Winner, World Champion title + frame, Underdog, Homegrown, Dynasty, Road
  Warrior). Club screen lists them with unlock dates.
- **Weekly inserts** (ROAD-TO-WORLDS-DECISIONS R33): a mid-week decision card
  in roughly a third of the weeks — side quests, sponsor asks, training calls
  — with two options and plain effects (money, reputation, chemistry,
  training time). Unanswered cards expire with the day.
- **Colour kits** in the career wizard (R34): sixteen curated pairs, one tap;
  custom swatches are contrast-guarded.

### Added — rc.36 front B (UX-04, CAL-01, SUN-01..03; R88)
- Creation has more crest shapes, symbols and patterns, three layouts, independent free colours,
  live previews and contrast warnings with suggested fixes. Presets never restrict the choices;
  older saved crests and procedural rivals keep their appearance.
- Saturday returns to HQ before the user's Sunday. Start Sunday records an optional, transparent
  coach briefing and moves exactly one calendar day. Sunday has no extra training or payroll.
- Championship Sunday opens with a skippable full-screen introduction, static under reduced
  motion and shown once. Events without the user can be watched round by round, read as results
  or skipped; their already-settled results are kept compactly for the follow screen.

### Changed — rc.36 front B
- Transfer windows fill the calendar in blue behind event icons; day details show the champion's
  crest. Payroll markers leave the calendar and HQ week, with payroll still recorded in Finances.
- Browser verification tools accept CHROME_PATH for an existing Chrome/Edge installation.

### Fixed — rc.36 front B
- Keyboard focus stays inside the full-screen Sunday introduction and returns on close. Root
  cause: moving the card to a custom portal supplied initial focus and scroll locking, but omitted
  the shared dialog focus trap and restoration used by other modal overlays.

### Added — rc.35 (Miguel's rc.34 playtest, 31/10 · ROAD-TO-WORLDS-DECISIONS R81–R82)

Five parallel fronts, one independent review, the full re-measure and the browser E2E. The owner's rule
for every reworked screen: icon-led, a clear hierarchy, no plain-text cards.

- **Training, simpler (front T):** a 14-day cycle (`CAREER_PLAN.periodDays`); three choices as icon
  tiles — objective (Develop / Compete / Recover), intensity, scrims. No coach at the start: Easy
  applies the best plan for you, Normal tags it "Recommended", Hard shows no tag; a hired coach picks
  and runs each cycle and you can adjust one. The rebuilt Training screen and HQ block (plan, days-left
  ring, expected and last gain), visual coach hire cards, and a results modal at each cycle's end.
- **Sponsors by risk (front S):** Bold pays the most (the highest weekly pay and bonuses) for the
  hardest goal and the biggest fine; Steady the least, safest. A season's fines are capped at two weeks
  of the deal's pay; Bold's goal is never likelier than Balanced's. The season goal uses the same level
  model (never harder than a Balanced goal). One visual comparison, a visual offer modal, "Decide
  later" beside "Decline", the Finances deal panel as tiles. Access by the ladder: two offers without
  Bold until "challenger sponsors", then three, then global sponsors (more money, free bootcamps).
- **The progression ladder (front P):** peripherals → generic coach and local sponsors (rep 10) →
  monitors → tournament PCs → ex-pro coaches → bootcamp → challenger sponsors → structured bootcamp →
  psychologist → global sponsors → performance centre → headline sponsors (the old "title partners"),
  with icons; one HQ Progression card (toolbox + next unlock); the unlock modal with the benefits,
  the price, Buy and Close only; HQ finances reduced to the balance, its trend and three tiles; the
  Finances ladder compact with "See more".
- **Creation, market, squad (front C):** the difficulty step with icons and Normal marked Recommended;
  the Balanced roster in the middle; one prospect at potential 91–93; at least two free agents with
  potential above 80 per region; phase chips on Market cards; the reputation filter as an icon switch;
  HQ's squad as three starters plus the reserve beside the coach, with phases.
- **The talk (front N):** offers below his zone with odds that fall smoothly (seeded per window); the
  share slider for everyone; a negotiable signing bonus; each extra contract season relaxes his floor
  3 %; three sliders with the zone painted and an odds meter. Founders' first deals at 85 % of their
  ask; a flatter coach wage curve; the fanbase line is "Merch & streams".

### Changed — rc.35
- rc.34's training modes ("the coach runs it / proposes") map on load to the preset's mode; a pending
  proposal is dropped. Ex-pro coaches wait for their rung (`exProGate`).

### Balance — rc.35
- `BALANCE_VERSION` 4 → 5. `CAREER_PLAN.periodDays` 14; `CAREER_DEV.seasonCapSpread` 2 and
  `seasonGainHardCap` 13; `CAREER_SPONSOR` ceilings by profile (Steady 0.95 / Balanced 1.2 / Bold 1.5 of
  the tier's value), fines 0 / 0.3 / 0.6 with `fines.seasonCapWeeks` 2, `wordMin.stretch` 0.2,
  `access.levels`; `CAREER_LADDER` (`exProCoachRep` 23, `sponsorRep` 10 / 30 / 50 / 75);
  `CAREER_WORLD.prospectHeadliner`, `creationFaProspects`; `CAREER_NEGOTIATION.oddsFallPct` 0.25,
  `lengthReliefPerSeason` 0.03, the bonus keys; `CAREER_SALARY.foundingWageMult` 0.85;
  `CAREER_COACH_MARKET.wageGrowthPerPoint` 1.12.
- **The re-measure** (294 careers, ECONOMY-CONTRACT §12): insolvent 1 / 6 / 16 → **0 / 5 / 14 %**,
  newcomers 0 / 2 / 12 → 0 / 2 / 17 %, the spender 7 / 21 / 36 → 0 / 14 / 21 %, tight Mondays S3–S5
  11 / 20 / 31 %; 88+ signings by S4 7 / 4 / 3 → 22 / 9 / 3 %. Worse: the snowball p90 14.9 / 8.6 / 6.8 →
  21.1 / 12.0 / 8.0 (Bold pays more, wages are lower); EU on Normal 36 → 29 %.

### Fixed — rc.35
- **No results pop-up at a training cycle's end.** Root cause: rc.34 only filed the report in the
  history and a news line.
- **Players stopped growing for weeks, then resumed.** Root cause: model 2's season cap of 7 was a hard
  stop the package reached before the season turned; the room now spreads over the weeks left.
- **Bold paid less than Steady.** Root cause: weekly pay was priced at equal expected value.
- **The season goal could be harder than the Bold sponsor goal.** Root cause: two goal models.
- **A player at his peak showed a band below his overall (78 → 76–80).** Root cause: the band's floor
  was not clamped to the current overall.
- **A just-signed player drew another bid in the same window, or moved again.** Root cause: nothing
  recorded the signing day (`SquadPlayer.signedDay`).
- **The autopilot ran past a training report.** Root cause: it paused only for money notices.

### Added — rc.34 (Etapa 3: the new Road to Worlds loop — training packages, sponsors, HQ around the next decision, "New" markers — and Miguel's 31/10 answers on rc.33 · 2026-10-30 · ROAD-TO-WORLDS-DECISIONS R71–R80)

Built as five parallel fronts: E training, F sponsors and G HQ, then, after Miguel's first rc.33 run, H the
bank's loan and I the contract talk and the difficulty step. They were merged and wired together
through G's decision queue. Three independent reviews followed, with 21 findings, each fixed against a
test that failed first, and a browser E2E pass (desktop + mobile, EN + PT). Gate 3a approved the three
Etapa 3 contracts as recommended (30/10); the values Miguel left to Claude ship behind their own
`balance.ts` keys, to be tested at the gate.

**HQ around the next decision (front G; UX-01, UX-06; HQ-CONTRACT 1-B, 2–7 A)**
- **One decision queue for every clock path** (`store/careerDecisions.ts`, `pendingDecisionsOf`):
  a matchday, the money notice, the contract review, a short squad, the weekly insert, the training
  proposal, a bid, the sponsor offers — urgent first. `advanceDayFlow`, the batched Advance, the
  autoplay, Championship Sunday and a reload all read it (`clockHoldOf`): the clock never walks past
  a needed decision. "Later" only for bids and sponsor offers, up to their deadline (1-B). A cup's
  matchday holds too (Play or Pass); bids never lapse silently. A fresh invite shows inline above the
  clock controls and stops the batched Advance and the autoplay once, on its Monday (an invite's
  default is "not entered", so it never holds the clock).
- **HQ's one main block** shows that decision (or the clock), with an "Also" line of what waits and
  when; the squad as Draft cards (the rarity frame through `baseRarityOf`, the user's crest, PlayerSheet
  on tap); the race block's seeding line ("Next regional: direct seat / Saturday qualifier"); a
  finance block (balance, next payroll, guaranteed income, debt, the projection — the same numbers as
  Finances — and rc.33's chart opening larger); a toolbox with a confirm sheet (price, effect,
  duration, the balance and runway after).
- **The bootcamp lasts the split** (5-A) and shows its end.
- **"New" markers per career save** (`engine/career/careerNew.ts`, rc.33's seen-state module):
  contracts first, then toolbox items; dots on Squad and Finances; the unlock modal once per novelty.
- **The contract clock:** time left on the squad cards and on Squad, reminders in weeks 28 and 31,
  and an explicit review before the rollover.
- **A short squad can skip a regional** (Miguel 31/10, RTW-06): each regional (or its qualifier)
  offers "Skip this regional" — no points, no prize, training goes on; a free agent can still fill the
  seat outside the window (R67). A Major keeps the hold.

**Training packages (front E; DEV-03; TRAINING-CONTRACT 1–7 A)**
- **A package per 28-day period** (8 a season; "one per split" behind a key): an objective
  (development, competitive preparation, recovery), one squad focus with optional per-player tweaks,
  a workload, scrims (count and level), shown with its projection before (from the functions that run
  it) and a period report filed after (overall before / after, sessions, scrims, series, the coach's
  share, wear).
- **Delegation by preset:** Easy — the coach runs it; Normal — he proposes on the period's first
  Monday (HQ waits: approve, adjust or keep the base); Hard — you set it, with Repeat.
- **Three scrim levels** (easy: confidence, little growth, less wear; even: synergy; hard: more
  learning, more wear), practice only, capped at a quarter of a period's gain; when no org in the
  region fits a level, a local side at the band's centre.
- **Coaches are distinct:** quality (focus efficiency), experience (plan quality, less wear) and a
  specialty (+25 % on its objective), printed on the hire card; senior and standard generics; ex-pros
  from their career-best card (slope 0.8, ×1.15 wage); coaches grow with the seasons they work.
- **The base needs no package and no coach** (7-A): the 0.85 coachless floor is gone; the coach acts
  through the package. Wear feeds the pre-event unavailability roll (at most +4 points).
- The rebuilt Training screen (plan card, builder with projection, mode and repeat, growth cards,
  period reports), the coach hire card, HQ's training block; the bot's training policies (opt-in
  `delegator`, `trainer`) and records; the `CAREER_TRAINING` probe.

**Sponsors (front F; ECO-04, ECO-05; SPONSOR-CONTRACT 1–5 A, 6-B, 7-A, adjusted to ECO-07/08)**
- **Three deals in one comparison:** each sponsor decision offers one deal per profile at the best
  tier the reputation allows, of equal expected value — Steady (six splits, "Likely" goals, a signing
  payment, no fines), Balanced (three splits, "Even", fines) and Bold (one split, "Stretch", a
  milestone payment, the biggest bonuses and fines) — with their sure money, their ceiling, the goal
  and its date (`SponsorOfferCard`; HQ's decision block and the Finances desk read one engine module,
  `engine/career/sponsorDeals.ts`).
- **Dated goals by their word:** only events still ahead in the calendar, worded by the modelled
  chance (a model fitted on the harness: reach, top 8 / 6 / 4, a title, the Major) and priced at it;
  set at a split's start, settled at its boundary.
- **Fines (1-A):** a missed Balanced or Bold goal costs a share of its bonus by the shortfall, at most a
  week of the deal's pay, in four Monday instalments, waived where an instalment would take the books
  under the bank's floor; none on Steady deals or on Easy. Steady keeps the patience meter (7-A):
  three misses in a deal and its renewal comes a tier lower.
- **Money scaled to the team's level:** T2–T4 pay in full against the region's 8th (T2), the Major's
  8th (T3) and the Major's 4th (T4), less below (`levelValue`) — the snowball's brake.
- **ECO-05:** appearance fees and partner actions count against a cap (two a split, 10 % of the
  season's earned income) and never as guaranteed income; the jersey shoot costs agenda time.
- **The decision waits for an answer:** "Later" until the Sunday before the split's first event week
  (1-B), then the clock holds until a deal is signed or the offers declined; the season review waits
  for a Worlds-window renewal, which keeps its one-tier demotion across the rollover.
- **The founding partner's handover** (rc.32 careers still running one): ⅔, then ⅓, then nothing, on
  boundary Mondays, announced with both dates; each offer card shows the net weekly change. Eight new
  brands.

**The rescue is a bank loan (front H; Miguel 31/10: ECO-13, ECO-14, ECO-15, BAL-05)**
- **A breach is the bank's emergency loan, not an investor:** the bank lends the balance back to the
  rescue line and is owed 1.2× it; 10 / 15 / 20 % of prizes and half of any sale repay it, and
  Finances takes any partial payment or "Pay it all".
- **The investor** joins only the career's first loan, on Easy: 20 % of the wage bill for 10 Mondays.
- **The deadline ends a career, not the breach count:** the first loan is due in 64 / 48 / 24 weeks
  (Easy / Normal / Hard). A later breach adds to the loan and the deadline stays; after three top-ups
  the next breach ends the career. A career gets at most 3 / 2 / 1 loans. The bank warns 8, 4 and 1
  weeks before with the projection (the balance plus the weeks left × the weekly net), and sends a
  notice the day the projection stops covering the debt. On the day it collects if the books stay at
  or above its floor after paying, as for "Pay it all"; otherwise the career ends. On Hard the first
  breach no longer ends a career at once.
- **Nothing is locked while owing** (signings, fees, gear).
- **The money modal** on any career screen explains each event once (a loan opened or topped up, each
  warning, a slipped projection, the collection, the end, an old debt moved to the bank); the Advance
  stops on that Monday and the autoplay pauses.
- **Every founding roster carries its first split** (BAL-05): the start budget is at least 44 / 24 / 13
  weeks of the roster's founding wage bill; the wizard shows each roster's "Start budget" and the weeks
  of wages it covers.

**The contract talk and the difficulty step (front I; Miguel 31/10: ECO-16, ECO-17, UX-08)**
- **The talk's levers always move:** the wage zone is at least one press wide, never under the
  league minimum; a share press moves the wage one point the other way (`talkPressFor`); every closed
  lever says why under its button ("His floor", "His full ask", "League minimum"…).
- **Only players above 79 ask a prize share** (0 at 79, +1.2 a point: 85 → 7 %, 90 → 13 %, cap 18 %);
  founding deals carry none (an rc.33 founder's share is zeroed on load); the share lever hides when
  he asks none; other deals already signed keep theirs.
- **The difficulty step** is a promise and three plain bullets per preset (the matches; the money —
  whether the bank lends, how many loans and the deadline, read from the keys; how much the game does
  for you), the selected card framed; no jargon, no rating-point numbers.

### Changed — rc.34
- Bids, sponsor offers and a cup's matchday hold the clock; the season's continue waits for the
  contract review, for any bid and for a pending sponsor decision. The training proposal holds its
  period's first Monday on Normal.
- The weekly drill and the per-card focus / intensity controls retired into the package (old saves
  load on the base: `repairTrainingOnLoad`); the legacy run-now scrim still runs an old booking.
- What ends a career through money is the loan's deadline and its caps (`breachesToEnd` is null
  everywhere; `hard: 1` restores "Hard ends at the first breach"). An rc.32/rc.33 debt to the Emergency
  Backer becomes the bank's emergency loan, due from the update (`repairLoanOnLoad`, announced once).
- Steady alone keeps the patience meter; Balanced and Bold deals carry fines instead. Sponsor offers
  from before rc.34 that are still pending become an rc.34 decision on load; a running deal keeps its
  old figures (`repairSponsorsOnLoad`).
- The boundary Monday books the split's sponsor bonus before the payroll and the loan's deadline (a
  bonus that closes the gap keeps the career); a fine settled that Monday starts the next one.
- The sponsor analytics event carries the deal's profile.

### Balance — rc.34
- `BALANCE_VERSION` 3 → 4.
- HQ: `CAREER_HQ` (Later kinds bid and sponsor; contract warnings from week 23; reminders in weeks
  28 and 31); `CAREER_GEAR.bootcampSpan` "split" with its edge share 1 (the half edge in reserve) and
  today's price, re-measured (a camp every split moved official series won 56.7 → 56.9 %, Major series
  24.4 → 29.5 %, and cost more per rating point than a coach).
- Training: `CAREER_TRAINING.baseRateMult` 0.85 (the measured base unchanged), `CAREER_PLAN` (the
  grid, objectives, workloads, coach efficiency, wear, the scrim cap 25 %, presets), `CAREER_SCRIM`
  levels and package weeks, `CAREER_COACH_MARKET` (senior 72–90, standard 60–84, ex-pros 64–94,
  growth). Measured: a development package takes a 13–19-year-old 1.14–1.31× the base speed (band
  1.10–1.35), the peak unchanged.
- Sponsors: `CAREER_SPONSOR.profiles` — weekly pay a fixed share of the tier's value (Steady 0.76 ≥
  Balanced 0.70 ≥ Bold 0.65 per Monday), fixed part 0.15 signing / 0.15 signing / 0.20 milestone,
  bonus 0.10 / 0.25 / 0.45, fine 0 / 0.15 / 0.50, 6 / 3 / 1 splits; `wordChance` 0.8 / 0.5 / 0.25
  (minimum 0.66 / 0.38 / 0.16); `levelValue` 0.08 a rating point (floors T2 0.7, T3 0.5, T4 0.4); the
  fitted `goalModel`; `fines` (a week at most, 4 Mondays, never below the floor); `otherIncome` (2 a
  split, 10 %); `founding.taper` [⅔, ⅓]. On a slice (20 careers a difficulty, before the review's
  fixes): Normal insolvent 10 → 5 %, Hard 45 → 15 %, Normal's snowball p90 12.9 → 9.9; goals hit at
  their word 72 / 50 / 34 %; Bold-only careers over the season-fines band in 24 % of seasons (≤ 10 %).
- The loan: `CAREER_LOAN.emergency` (deadline 64 / 48 / 24 weeks, warnings 8, 4 and 1, the daily
  watch over the last 4 weeks, top-up cap 3, `maxLoans` 3 / 2 / 1), `investor` (Easy 0.2 for 10
  weeks), `lockCommitments` false; `CAREER_ECONOMY.startingBudgetWeeks` 44 / 24 / 13.
- The talk: `CAREER_NEGOTIATION.minZoneSteps` 1; `CAREER_PRIZE_SHARE.shareThresholdOverall` 79,
  `askPerPoint` 1.2, `minPct` 0 (e2 at the lowest share 1.38, at his ask 1.23, under 1.5).
- **The re-measure** (294 careers, seeds 9100 and 17019, ECONOMY-CONTRACT §11, `ECONOMY-PROBE-rc34.md`
  and `CAREER-ARC-rc34.md`): insolvent careers 0 / 6 / 30 → **1 / 6 / 16 %** on Easy / Normal / Hard,
  newcomers 0 / 2 / 26 → **0 / 2 / 12 %** (Hard inside its band for the first time); 1 / 6 / 14 % of
  careers end on a loan's deadline, every rescue warned about half a season ahead. Money still decides:
  the spender breaks in 7 / 21 / 36 %, tight Mondays S3–S5 16 / 22 / 34 %. The sponsors run as designed
  (a decision's offers within ±0.5 % of one value; goals hit at their word 79 / 57 / 30 %; fines over
  two weeks of payroll in 0 / 5 / 2 % of seasons). Out of band: EU on Normal 36 % (five careers end on
  the 48-week deadline, owing 0.6–1.4 seasons of wages), the snowball p90 (14.9 / 8.6 / 6.8 seasons of
  payroll, flat), the star path (88+ by S4 7 / 4 / 3 %). A 64-week Normal term only moves four of
  EU's five endings 16 weeks later. The veterans roster carries its first split in all 42 measured
  careers. The long-career run: no softlock in 294 careers; at an even rating the user wins
  80 / 65 / 57 % of series.

### Fixed — rc.34
- **+1 day walked past bids (until they expired), invites and cups.** Root cause: those decisions were
  HQ cards outside `advanceDayFlow`'s checks.
- **The bootcamp vanished after one event with no end shown.** Root cause: `startEvent` zeroed the edge
  and no end date was stored.
- **The talk's wage lever froze on most cheap contracts** (85 % of founder renewals). Root cause: the
  zone was (1 − flex) × the ask with its floor rounded up to the $10 grid, so floor = top.
- **Lowering his share left the wage unchanged and made him counter.** Root cause: the sheet kept the
  offered wage while his ask moved a point, and the zone's floor drifted by flex × a point.
- **The talk's disabled levers gave no reason.** Root cause: the sheet only disabled the button.
- **The older founding roster broke in its first split** (Miguel's rc.33 run). Root cause: one flat
  start budget for founding wage bills that differ ×3–5 between rosters.
- **A prize, a sale or a manual payment rebuilt the loan as `{ remaining }`.** Root cause: each path
  recreated the object instead of updating it (it would have dropped the loan's other fields).
- **"Even" package scrims went 0–64 for a new EU squad.** Root cause: the pick compared a stale org
  rating with the squad's plain overall average; it reads live team ratings now.
- **"Match week pauses sessions" was false.** Root cause: the copy predated v0.3's half-load rule.
- **The founding partner stopped at once** (an rc.32 career's guaranteed income fell by more than half
  at the founders' renewal). Root cause: M3 ended the partner on the first real deal.
- **Money inserts were uncapped and never counted.** Root cause: their fees were outside every tally.
- The reviews' findings (each with a test that failed first):
  - **The loan's deadline and "Pay it all" disagreed** (the career could end with the debt payable
    into the overdraft). Root cause: two tests, `balance ≥ owed` and `balance − owed ≥ floor`; one
    `canSettleLoan` now.
  - **A loan paid on its deadline into the overdraft opened a fresh one with a fresh term, without
    limit.** Root cause: nothing counted loans; `maxLoans` 3 / 2 / 1.
  - **A boundary Monday's sponsor bonus came after the deadline check.** Root cause: the payroll ran
    before `runSplitBoundary`.
  - **"Covered" ignored the weekly burn, and nothing spoke after the 4-week warning.** Root cause: it
    compared today's balance with the debt; it projects to the deadline now, with a 1-week warning and
    a notice when the projection slips.
  - **The deadline copy said a partial payment closes the gap.** Root cause: a payment only moves money
    from the balance to the debt.
  - **A fine's instalment could end a career on the deadline Monday.** Root cause: fines booked before
    the deadline check, and the floor guard does not cover the debt.
  - **A fine settled on a boundary Monday booked an instalment the same day.** Root cause: the boundary
    now runs before the payroll; a fine starts from the next Monday (`from`).
  - **Normal's help bullet, the wizard's money bullet and the roster budget were wrong.** Root causes:
    the bullet read `prefs.autoTrain` after delegation moved to the preset; the money bullet read only
    the deadline; the budget showed Normal's before a difficulty was picked.
  - **"Backer" on HQ, in the toolbox's refusals and in the fines' copy.** Root cause: missed in the
    rename.
  - **rc.33 founders kept their founding prize share.** Root cause: ECO-17 changed new careers only.
  - **Skipping a regional on its own day left it unplayed.** Root cause: the day's arrival had already
    passed it over as the user's event; the skip resolves it now.
  - **Switching the training mode kept the old repeat, and HQ's toggle always returned to "approve".**
    Root cause: one repeat flag for every mode; the toggle was hard-coded.
  - **A bootcamp bought in weeks 31–32 blocked the next season's first split.** Root cause: the allowance
    was reset only at split boundaries.
  - **Passing a cup gave a hidden training day.** Root cause: rc.33's Training Week bonus was left in
    `declineUnofficial`.
  - **Coaches grew without working.** Root cause: growth ignored tenure.
  - **Invites held the clock.** Root cause: the decision queue gave them `holds: true`.
  - **A Worlds-window sponsor renewal lost its demotion at the rollover, was replaced unanswered, and
    vanished below the reputation gate.** Root cause: the rollover read a pending decision as "no deal",
    and the sponsor source reported only while running.
  - **Bold's weekly pay could exceed Balanced's or Steady's** (6,370 of 41,664 decisions). Root cause:
    weekly pay scaled with a ceiling that grows as the goal's chance falls.
  - **Loading an rc.33 save dropped its sponsor demotion.** Root cause: `repairSponsorsOnLoad` always
    passed `demote = false`.
  - **HQ's end-of-split projection ignored fine instalments.** Root cause: they were missing from its
    costs.
  - **The offer cards said the founding partner steps back on signing in seasons 0–1.** Root cause: the
    condition skipped `foundingPartnerEnds`' season rule.
  - **An expired sign attempt marked a deal as signed.** Root cause: the flag was set before the
    validation, and the store commits a changed save on error.
- **The probe's s6 read a deal ending on a boundary Monday as a gap.** Root cause: it read the Monday
  projection instead of the booked lines.

### Added — rc.33 (Etapa 2b part 3: Miguel's 30/10 answers on rc.32, and Etapa 4's COL-01/COL-02 pulled forward · 2026-10-30 · ROAD-TO-WORLDS-DECISIONS R61–R70 · DESIGN-DECISIONS #151–#154)

Built as four parallel fronts (A money, B contracts and market, C world and competition, D the
collection), merged and wired together, then two independent reviews (no P1; four P2 and nine P3, all fixed with a failing test first: R70) and a browser
E2E pass (desktop + mobile, EN + PT). Miguel decided ECO-07/08, ECO-12 and the shape of the rest;
the values he left to Claude ship as **tested defaults**, each behind its own `balance.ts` key.

**Career — money (front A; ECO-07, ECO-08, ECO-09, M7, ECO-12, UX-07)**
- **What ends a career through money (ECO-08, decided 30/10):** `CAREER_LOAN.breachesToEnd` Easy 3 /
  Normal 2 / Hard 1. Every breach before the last brings the Emergency Backer (a second rescue adds
  to the debt); the last one ends the career. The restructuring (the forced sale of the highest-paid
  player and its reputation loss) is gone. The warnings stay: a notice at 8 weeks of runway, then a
  mail every Monday at ≤ 4. The wizard, Finances' ladder, the HQ Backer card and the mails all read
  the rule from the key; on Hard the Backer panel says there is none.
- **No day-one founding partner (ECO-07):** `CAREER_SPONSOR.founding.enabled` is off; an rc.32 career
  already holding the deal keeps it to its own end (`honourRunning`), nothing new is granted.
  **Easy's rescue partner:** at Easy's first breach the "Overtime Fund" comes in with the Backer and
  pays 50 % of the rescue Monday's wage bill every Monday for 10 weeks (`CAREER_LOAN.rescuePartner`):
  its own ledger line, never garnished, in the statement and the runway, announced in the rescue
  mail and shown on a Finances card while it runs.
- **The expanded balance chart (UX-07):** the Finances sparkline opens a larger chart (the balance,
  the Backer's floor, $0, season starts, low and high, a crosshair by pointer, touch or arrow keys,
  and a per-season table). It draws a ring of up to 96 Monday balances (`FinanceState.balanceRing`,
  `CAREER_PAYROLL.balanceRingWeeks`), recorded once per Monday whatever moves the clock; an older
  save starts it from the Mondays its ledger really booked (no invented data). `mondayBalancesOf`
  serves Etapa 3's HQ.

**Career — contracts and market (front B; ECO-10, ECO-11, DEV-04, UX-07)**
- **The prize share per contract (ECO-10):** each contract carries the share of podium prize money
  the player keeps (`SquadPlayer.prizeSharePct`), shown and negotiable in the offer and the renewal,
  and shown on Squad's contract rows and the player sheet. His ask grows with his overall (a 70 asks
  3 %, an 85 11 %, a 90 13 %; `CAREER_PRIZE_SHARE`); in the talk a share point is worth 2 % of his
  wage. It is paid only to the players who played, on a 1st–4th at a regional, Major or Worlds, as
  one "players' share" line. A deal signed before rc.33 reads rc.32's rule (20 / 35 / 50 % ÷ 3 seats).
- **The contract talk (ECO-11):** one engine answer (`contract.negotiationAnswerFor`) for signings and
  renewals, with two levers (the weekly wage and the prize share; the length still reprices his
  ask). A visible zone where he signs (his flexibility × his ask up to the ask, seeded per player,
  season and window); below it he counters at the zone's floor, and taking the counter always signs;
  "Sign" stays disabled until he accepts. No hidden reserve, no hardening after a refusal.
- **Honest potential (DEV-04):** model-2 bands at most 5 / 3 / 1 points wide by report level, their
  top 0–2 points above the truth; a player past his plateau shows no potential above what the age
  clock still allows (`reachableOverallOf`); a phase tag (growing / at his peak / declining) reads "?"
  until a scouting report reveals it. A bought report in an rc.32 career only narrows its band.
- **The Market (UX-07):** a "Signable at my reputation" filter (the same rule as the refusal,
  `market.signableAtRep`); with a full squad the offer sheet warns and links to Squad (the who-leaves
  picker is gone); the Blockbuster explanation shows only on a Blockbuster bid, as one sentence with
  the refusal's cost.

**Career — world and competition (front C; RTW-02, RTW-03, RTW-04, RTW-05, BAL-04, UX-07)**
- **Every org enters its history (RTW-03, C-1):** an entrant takes the weakest filler's seat; else the
  weakest org whose history is over (no lineup that season or later) leaves; else the region grows
  (`CAREER_WORLD.orgIntake: "everyOrg"`; rc.32's rule is `"fillersOnly"`). Event fields still take 16
  by the seeding. Karmine Corp and the other later EU, SAM and NA orgs appear in their season; an
  "org leaves" news line in the user's region.
- **A full squad to play (RTW-05):** the clock never enters the user's matchday with fewer than three
  players (Advance, the batched Advance, the autoplay, Championship Sunday, a reload): HQ's card
  offers Market and Squad (and Pass for a cup). A free agent can take an empty seat any day, window
  or not. The unavailability roll needs a reserve (without one nobody is ruled out). No stand-in: an
  empty seat is rated 0 and chemistry counts three pairs.
- **The newcomer's reputation path (RTW-02):** results judged against the seed — a cup semi-final from
  seed 3 or lower (+1, inside the cup's cap) and a qualifier run of two Swiss wins from outside the
  qualifying eight (+1, once a split), paid only below reputation 25 (`CAREER_REPUTATION.newcomer`,
  `engine/career/reputation.ts`). The digest calls it "An underdog's run".
- **The preset step (UX-07):** three lines per preset — matches (easier / even / harder), money (which
  breach ends the career, read from the key), day to day (guided or hands-on).
- **The harness:** series won and lost per season by tier and rating gap, and the first sponsor's
  season; new tables in the arc report (win rate by difficulty × region, at an even gap, by tier and
  by season; the reputation path). Older dumps render "–".

**Collection (front D; Etapa 4's COL-01 and COL-02, pulled forward)**
- **The national album (COL-01a):** each edition is a page with its progress; each team a sticker
  slot (a pip per card, "✓ Complete", NEW, dashed while not found). A team page shows the flag,
  edition, region, progress and the date found, the three players in a V on a pitch and the coach
  and sub on a bench; a locked slot names the missing person once the team is found.
- **Finding is not owning (COL-01b):** finding a national team reveals its page ("New album page")
  and grants nothing; each card is collected by drafting it and finishing the run, won or lost; an
  abandoned run keeps the discovery only. Cards already granted stay, and a team with an owned card
  counts as found. Teams not yet complete stay favoured in the drop (×`nationalUndiscoveredWeight`).
- **NEW in the draft (COL-02a):** decided against the inventory before the offer and stored with it
  (`RunState.offerNew`), only on cards that can be drafted.
- **The national org card (COL-02b):** a static gold frame, the stage light behind the flag and a
  "National team" tag. It is not a collectible: the album counts players, coach and sub (133 cards,
  121 obtainable).
- **"New" markers (COL-02c):** NEW tags on the special-card grid, the album and Challenges; dots on
  the nav, the home tiles and the album tabs. Opening the content clears them (visiting a tab does
  not); persisted per item on the device; an existing profile sees nothing new on its first load. A
  reusable seen-state module (`engine/newItems.ts`, `engine/profileNew.ts`, `store/useNewItems.ts`)
  for Etapa 3's career markers.

### Changed — rc.33
- Signings happen in a window again (the late signing went with ECO-12), except a free agent into an
  empty seat (RTW-05). Random AI bids stay.
- The money warnings read next Monday's statement, not the one just booked.
- The draft engine's `nationalTeams.discovered` is now `complete` (a run saved before rc.33 still reads
  `discovered`, same RNG use); `challengeStatus` moved to the dataset-free `challengeStars.ts`.
- Unowned national cards keep their name in the draft (the header names the team); the draft banner
  shows the album's x / y.
- The arc bot: a short squad signs first; the "selective" renewal signs at the zone's floor.
- **Renewals (2-B's values, Claude's call):** one renewal lifts a wage at most ×2.5 (`renewalMaxJump`;
  the readout names the bound), and a player renews dearer for the titles won with him in the last
  two seasons (+10 % a Major or Worlds title, +5 % a regional title, at most +30 %;
  `titleRenewalPremium`, ECONOMY-CONTRACT M6 lever 3). One price (`renewalTermsOfSave`) for the
  talk, the flow and the readout. R69.
- Old careers (growth model 1) get the honest band's width and top too; scrims refuse a squad of
  fewer than three (a booked scrim is called off with a news line).
- The money warnings, HQ and Finances read the rescue partner's remaining Mondays; the deal warning
  and the loan hints say when the next breach ends the career instead of naming a Backer.

### Balance — rc.33
- **The money scale (ECO-09):** one index at 12 % a season (`indexPerSeason` 1.12, every stream
  ×2.20–2.23 by S7) and a steeper ask for strong players (`starCurveFrom` 80, `starGrowthPerPoint`
  1.03: an 85 asks ×1.16 of rc.32, a 90 ×1.34, a 95 ×1.56; market values follow, coaches do not).
- **Guaranteed income (M7):** sponsor tier bases $5k / $12k / $22k / $45k a split (rc.32 1.5 / 6 / 18 /
  45k), the fanbase $60 a reputation point (was 40). The money goes to the newcomer tiers.
- **The talk:** `CAREER_NEGOTIATION.flexFloor` 0.94 (the zone; the average saving about 3 %, close to
  what rc.32's gamble paid), `wageStepPct` 0.02; rc.32's `reserveFloor`, `hardenPerReject`,
  `maxRejects` and `minOfferFactor` are gone. The share: `CAREER_PRIZE_SHARE` (ask 8 % at 80, ±0.5 a
  point, 2–18 %, −3 / +4 around the ask, 2 % of the wage a point). Scouting: `CAREER_SCOUT`
  (`honestWidthByLevel` 5 / 3 / 1 / 0, `bandMaxAbove` 2, `phaseRevealLevel` 1).
- **Match difficulty (BAL-04):** Easy's AI shift −2 → −1.6, Normal's −1.05 → −0.6. At equal team
  rating the user's series win rate is 81 / 65 / 56 % on Easy / Normal / Hard (rc.32: 85 / 71 / 56 %),
  R59's intent; Hard and the filler cap unchanged (`fillerCapMargin` 0).
- **Known free agents (RTW-04):** the creation pool keeps only careers that ended within one season of
  Season X (`creationFreeAgentRecentSeasons` 1); a real free agent whose history is over leaves at a
  dataset rollover with chance 0.5. EU's real free agents at week 3: 55–56 → 5–8 in S0, 63–64 →
  18–24 in S3.
- **Renewals:** `renewalMaxJump` 2.5 and `titleRenewalPremium` (0.10 / 0.05 / max 0.30 over two
  seasons). Measured on the same careers (EU, NA, APAC, SSA × every difficulty and policy): the
  newcomers' insolvency on Normal 21 → 4 %, Easy 4 → 0 %, Hard 50 → 42 %; the spender still breaks
  (38 % Normal, 63 % Hard); the title raise alone takes the Hard snowball p90 6.1 → 4.0.
- `BALANCE_VERSION` 2 → 3.
- **The re-measure** (294 careers, seeds 9100 and 17019, ECONOMY-CONTRACT §10, `ECONOMY-PROBE-rc33.md`
  and `CAREER-ARC-rc33.md`): insolvent careers (mean of the policies) 0 / 34 / 56 → **0 / 6 / 30 %**
  on Easy / Normal / Hard, newcomers 0 / 33 / 60 → **0 / 2 / 26 %**, every region on Normal at
  ≤ 14 % (EU and NA were 86 %), every newcomer's first two seasons paying their way. Money still
  decides: the spender breaks in 21 % on Normal and 79 % on Hard, tight Mondays S3–S5 23 / 26 / 29 %,
  a 90 costs 1.12× a contender's income. Still out of band: Hard (its first breach ends a career),
  the snowball p90 (15.3 / 8.5 / 6.8 seasons of payroll: hands-off careers in weak regions on T3
  base pay) and the star path. Before the renewal tuning the merged fronts gave 1 / 17 / 39 %.

### Fixed — rc.33
- **The negotiated wage did not move, or moved the wrong way (ECO-11).** Root causes: the stepper
  moved the per-split wage by $50 (about $4.69 a week) under a weekly label rounded to $10, so a press
  often showed the same wage and "save $0"; the stepper's floor (0.85 of the ask) sat below the hidden
  reserve's (0.88), so some offers had 0 % odds and each hardened the player; a refusal raised the
  reserve by 4 %, away from agreement, and the odds shown after it ignored the refusal (37 % for a
  sure refusal). The saving label also said "/ split" over a weekly number.
- **Karmine Corp and the later EU, SAM and NA orgs never entered (RTW-03).** Root cause: an entrant
  could only take a filler's seat; EU had none, so none of its 23 later orgs ever entered (SAM 28 of
  31 and NA 6 of 10 missed too).
- **Retired stars displaced active pros, and known players sat without a team for years (RTW-04).**
  Root cause: the creation pool held 72 real players whose careers had ended before Season X (44
  rated 80+, at their peak); the first window put 33 of them on rosters and pushed 20 active pros out,
  who then stayed free agents.
- **EU reputation stayed at 5 for two seasons (RTW-02).** Root cause: only placements paid reputation,
  and EU/NA cups seat the two closest stronger orgs, so the rating-seeded bracket ended every cup in
  the semi-final (which paid nothing) and every Saturday qualifier in the Swiss.
- **A short squad played with a 60-rated stand-in (RTW-05).** Root cause: `userTeamFor`'s fallback.
- **Potential bands read up to 10 points over the truth, and 99 on players who could never reach it
  (DEV-04).** Root cause: rc.32's model-2 band was 10 wide at level 0 with the truth anywhere inside
  it, and nothing capped it at what the age clock still allows.
- **A podium's players' share booked $50 short on some prizes.** Root cause: the per-seat rounding (a
  $45k Major title paid $15,700 instead of $15,750).
- **The money explainer and the career-end text promised "once" / "one more collapse".** Root cause:
  they predated the per-difficulty rule.
- **The share lever could leave the weekly wage unchanged.** Root cause: the share was priced per split
  in $50 steps, then rounded to the $10 weekly label.
- **The wizard's potential band was 10 wide and centred on the truth.** Root cause: the wizard drew its
  own band instead of the engine's.
- **A short squad could sign any free agent while broke.** Root cause: the empty-seat waiver skipped the
  money checks for every free agent; it now covers only one no dearer than the cheapest signable.
- **With the prize share switched off, the share lever still bought wage.** Root cause: the talk ignored
  `playerShare.enabled`.
- **A two-player squad still scrimmed.** Root cause: scrims had no short-squad check.
- **rc.31 careers kept the 10-wide band.** Root cause: DEV-04 applied only to growth model 2.
- **The rescue mail printed "1540 a week".** Root cause: `partnerWeekly` was not a money param. The
  templates now test amounts with `positive()` (`Number("$1,540")` is NaN), which also fixes rc.32's
  restructure mail always saying "nothing is owed".
- **The warnings projected the breach as if the rescue partner paid forever** (a warning in week 7
  quoted week 32 for a breach in week 23). Root cause: the projection used this week's net, partner
  included.
- **Copy promised the Emergency Backer where the next breach ends the career.** Root cause: the text
  ignored the next breach's outcome (ECO-08).
- **An older save's balance chart counted a Monday purchase as payroll; the chart could stay 280 px
  wide.** Root causes: the seed extended a Monday through any same-day line of those kinds; the width
  was measured only on the first render.
- **The Backer analytics milestone fired only on the first rescue.** Root cause: it keyed on `loanUsed`.
- **rc.33's footer read "2.0.0-rc.32".** Root cause: the version bump missed `src/config/site.ts` (the
  full suite was run before the bump; `analytics.test.ts` ties the two and caught it afterwards).

### Added — rc.32 (Etapa 2b part 2: the economy contract's provisional defaults, the growth contract, renewals, career presets, the 2a leftovers, the Etapa 3 contracts, /pt and the request budget · 2026-10-29 · ROAD-TO-WORLDS-DECISIONS R50–R60 · DESIGN-DECISIONS #145–#150)

Built as five parallel fronts (A economy, B growth / renewals / presets, C the Etapa 2a leftovers,
D the Etapa 3 contracts, E web), merged and wired together, then an independent review (two P2 and
five P3 findings, all fixed: R60) and a browser E2E pass (desktop + mobile, EN + PT). **Every
pending decision ships as a provisional default** (Miguel, 30/10: not approved yet): each sits
behind its own `balance.ts` key, commented `PROVISIONAL (30/10)`, that restores rc.31 when flipped.

**Career — money (front A; ECONOMY-CONTRACT §6 decisions 1-A, 3-A, 4-B, 5-B, 6-B, 7-A, 8-B)**
- **The founding partner (M3, R51):** a day-one tier-0 deal paying 70 % of the founding wage bill
  (`CAREER_SPONSOR.founding`), objective "enter events", no signing bonus, until the first real deal
  and at least through the second season; its own ledger line, a Finances card with its end
  condition, a mail. rc.31 careers still in their first two seasons without a sponsor get it once.
- **Warnings and the safety net (M4, R52):** a notice at 8 weeks of runway and a mail every Monday
  at ≤ 4, each with the projected breach week and a recovery checklist; the Market's offer sheet and
  the renewal readout show the runway a deal leaves. The Emergency Backer is sized in weeks of
  payroll (floor −8, rescue to +6). **What ends a career by difficulty:** Easy never, Normal at the
  third breach, Hard at the second (`CAREER_LOAN.breachesToEnd`); a breach in between
  **restructures** the org (the highest-paid player sold at market value, rep −5, the books topped
  back up, the squad kept playable) with a mail and an HQ line. While the Backer is owed, a signing,
  a coach or the psychologist that shortens the runway is refused, with the reason.
- **"List for sale" (M8, R53):** a player listed in the Market's deals tab draws one offer within a
  few window days at 90–115 % of his value from an org that would field him (never in the career's
  bid-free first window); a seat sold in a window can be refilled with a free agent for 7 days after
  it closes.
- **The players' share of podium prizes (M6, R53):** 20 % of a regional's, 35 % of a Major's, 50 %
  of Worlds' 1st–4th prize, as its own line in the event result and in Finances.
- **The Blockbuster bid explained (R54):** the offer (Market, HQ) and its mail say what it is (a
  scripted moment from the scene's history), the ×1.5 fee and that refusing it raises his next
  renewal ask by 10 %, EN + PT.

**Career — growth, renewals, presets (front B)**
- **Growth model 2, the growth contract (DEV-01, R55–R57), new careers only:** an individual arc per
  player (an early / standard / late peak, a plateau, then a gradual decline, fixed per save);
  potential is the expected peak (±2); real players with special cards take the potential of their
  eligible special; rare 93–98 prospects in every era (0.8 % of 13–15-year-olds); no per-split cap,
  one season cap of 7 on a curve that slows near the peak; exact ages (no jump on a birthday or at
  the rollover); honest scouting bands that never move; base growth = training days + the series a
  player actually played. rc.31 careers keep their development for life (`world.growthModel`).
- **Renewals with a raise cap and a market floor (M2, decision 2-B, R58):** the renewal asks at
  most ×1.5 his wage and never under half his market ask (ambition and a refused Blockbuster on top);
  the readout on Squad and in the Market's new renewals panel shows the rule, both numbers, which
  bound priced it and the runway it leaves.
- **Career difficulty presets (BAL-02, R59):** Easy / Normal / Hard replace the wizard's Management
  Style step, each with one sentence and its real effects (match edge, chemistry, budget, prize /
  ask / sponsor multipliers, what ends a career through money, how much is delegated). The career
  reads its own `CAREER_DIFFICULTY`, so a Draft retune can no longer move it.

**Analytics, audits, docs (fronts C and D)**
- **Analytics 2.0, production only (OBS-01, #145):** the whole `ANALYTICS-EVENTS-2.0.md` catalogue,
  typed, with its common properties (`release`, `balanceVersion`, `schemaVersion`, `environment`,
  `locale`, `gameMode`); career events read off each career-store write (once per action, never on
  a reload); persist quality events. A hard guard sends only from a production build on
  `rocketdraft.app`: staging, playtest, dev and tests never send and never load the SDK, even with a
  key. Built, provisional until Miguel approves the catalogue. `BALANCE_VERSION` (now 2) with a
  fingerprint test that fails until a tuning change bumps it.
- **The module audit (ENG-01, #147):** `docs/MODULE-AUDIT.md`, 258 modules in eight packages with
  findings by severity. **The dataset check (DATA-01):** `docs/DATA-AUDIT-rc32.md` (generated,
  `DATA_AUDIT=1`) and `careerOrgEntry.test.ts` (each org enters in its season, through the real
  rollover); no data edit needed. **The doc pass (ENG-02, #146):** history banners on the old plans,
  runbooks checked against the code.
- **The Etapa 3 contracts, proposals for Gate 3a (front D):** `TRAINING-CONTRACT.md` (DEV-03),
  `SPONSOR-CONTRACT.md` (ECO-04 + ECO-05's caps), `HQ-CONTRACT.md` (UX-01), seven decisions each.
- **Instruments:** the economy probe's C10 (both sides of the guardrail) and restructuring counts;
  `CAREER_GROWTH=1` (`docs/CAREER-GROWTH-rc32.md`); the arc report's region × difficulty tables;
  `scripts/request-budget.mjs` (WEB-02).

**Web (front E)**
- postexport "check page languages" (DRAFT-11) and a flag sprite in `build:images` (WEB-02).

### Changed — rc.32
- **One money index (M1, decision 1-A, R50):** every stream (wages, fees, coaches, prizes, sponsor
  deals, the fanbase, the founding partner, the bank, the minimum fee and salary, the stand-in,
  scouting, gear, the money inserts) grows ×1.08 a season (`CAREER_ECONOMY.indexMode` "single");
  rc.31 had three rates (1.08 / 1.12 / 1.10) and flat amounts. Signed contracts keep their figure.
- **Prize tables that pay the advertised pool (M5, decision 6-B, R50):** Swiss-16 28 / 18 / 12 / 9 /
  6.5 / 5 / 1.25 % and single-elimination 40 / 20 / 10 / 5 % (rc.31's Swiss-16 paid 102 %).
- **A rep comfort cap on wage asks (M6, R53):** `repComfortMax` 86, so a star always carries a
  premium (a 90 at rep 100 asks ×1.16, a 95 ×1.36).
- **The Market always lists a page of free agents the org can sign** (24 under its signing cap):
  rc.31's top-120 list could be entirely above a low-reputation org's cap.
- **The filler cap (BAL-02, provisional):** a filler org is never rated above its region's best real
  lineup (`CAREER_WORLD.fillerCapToBestReal`).
- The harness bot and the money probe read the screens' weekly statement (`weeklyStatementOf`); no
  bot policy changed.
- **Web:** production flags are cells of one sprite; a logo already loaded at 264 px serves the
  smaller sizes of the same org; `AppLink` prefetches on a mouse that moves over a link or keyboard
  focus, not on a link that slides under a resting cursor; `<html>` is rendered by `LocaleRoot`.
- The wizard's final step says once what difficulty shapes.
- Analytics region labels shared by `run_started`, `tournament_started`, `run_completed` and
  `run_abandoned`; history banners on the V2 plan, `CHALLENGES-DESIGN` and `TUNING-HARD-LEGACY`.

### Balance — rc.32
- **Career Hard (BAL-02, R59):** the AI keeps its chemistry (cap 0 → 2) and shifts −0.5 → −0.2: the
  user's Bo5 win rate at equal strength is 81 / 65 / 55 % on Easy / Normal / Hard (rc.31: 81 / 65 /
  81 %). Easy and Normal unchanged.
- **The re-measure** (the economy probe, the same 294 careers as rc.31, seeds 9100 and 17019;
  ECONOMY-CONTRACT §9, `ECONOMY-PROBE-rc32.md`): insolvent careers 68 → 30 % (Easy 44 → 0 %,
  Normal 77 → 34 %, Hard 85 → 56 %); newcomers' first two seasons pay their way 62 / 38 / 26 →
  86 / 86 / 69 %; every rescue warned (was 0–45 %), the first warning 19–32 weeks ahead, rescue
  windows 10–18 weeks (were 1–8); renewal raises p50 ×2.90 → ×1.58 (developed founders). Money
  still decides: the spender breaks in 71 % on Normal and 86 % on Hard, tight Mondays S3–S5 hold
  (37 / 49 / 64 %). Still out of band: EU and NA (86 % on Normal), the snowball p90 (4.2 seasons
  of payroll on Normal), guaranteed income (M7 held), the star path. The long-career run
  (`CAREER-ARC-rc32.md`): first Major by S2 on Normal ≈ 29 %, all of it APAC and SSA (100 %);
  EU, NA, MENA, SAM and OCE 0 %.

### Fixed — rc.32
- **Ages jumped two years at the 2022-23 → 2024 rollover.** Root cause: `seasonYear` read each
  label's first year (2020, 2021, 2022, then 2024). The age clock now reads the year a season ends:
  +1 a season, real ages right from RLCS 2024 on; the retirement rule lost its "calendar gap" case
  (R54). Running careers in seasons 0–2 read one year older once, at load.
- **The cash warning fired only on the Monday the runway read exactly 4 weeks**, so a renewal, a
  signing or a rescue that jumped past 4 left the player unwarned (24 % of Normal rescues were
  warned in rc.31). Root cause: an equality test (`runway === runwayWarnWeeks`). Now a mail every
  Monday at ≤ 4 weeks plus a notice at 8 (`runwayWarnMode` "weekly"; "rc31" restores it).
- **A refused Blockbuster bid never raised the renewal ask.** Root cause: `computeSalaryAsk`'s
  `blockbusterRefused` input was declared since v0.2, but no caller passed it and no refusal was
  recorded. A decline or an expiry now stamps the deal (`blockbusterRefusedUntil`), once.
- **Career Hard played as easy as Easy.** Root cause: the career read the Draft's Hard, whose AI
  chemistry cap 0 stripped career AI orgs (standing rosters at near-full chemistry) of their
  chemistry.
- **Scouting bands moved on a new report or as the overall grew; potentials moved with the
  overall** (model 2). Root causes: independent per-level draws and a floor clamped to the overall;
  fillers at overall + 2 and real players clamped up to their current overall.
- **A restructured org at reputation 0 could never sign.** Root cause: `listingFor` capped the list
  at the top 120 before the reputation gate.
- **The cash-warning mail printed raw numbers ("−860").** Root cause: `net` was not among the money
  params `newsText` formats.
- **The Backer's commitment lock was off in the overdraft** (review, P2). Root cause: measured to $0
  in whole weeks, it read 0 before and after any commitment between $0 and the floor.
- **A founder sold to an AI org vanished, and the buyer fielded a stand-in** (review, P2). Root
  cause: founders' `fic:{region}:starterN` ids come from no world generator; `WorldState.formerSquad`
  now keeps his record on a sale, a release or an expired deal.
- **The restructuring mail misstated the money** (review). Root cause: fixed text ("half to the
  debt", "back at the rescue line") whatever happened.
- **The late signing could be used as an extra out-of-window swap** (review). Root cause: nothing
  checked that the sold seat was still empty.
- **Analytics reported rc.31's potential band for new careers** (review). Root cause: `scoutedBand`
  was called without the growth model.
- **`/pt` pages painted English chrome and `lang="en"` until hydration (DRAFT-11, #148).** Root
  cause: the root layout hard-coded `lang="en"` and `useCopy()` answered EN until mount, while the
  export renders each page's HTML once.
- **A whole Classic run broke the 75-request budget (WEB-02, #149–#150): 65–78 → 56–59.** Root
  cause: one request per flag, a second request per drafted org's logo, and accidental prefetches
  from links sliding under a resting cursor.
- **`run_abandoned` sent region "worldwide" for dailies and region challenges.** Root cause: it read
  only `run.regionLock`, while `run_started` labelled each mode itself.
- **Stale runbooks and `COSMETICS-CATALOG.md`.** Root cause: rc.25's retune, the v12 persist and
  rc.4's `reduceEffects` never reached the docs; the catalog was not regenerated after a gradient
  change.

### Added — rc.31 (Etapa 2b part 1: the money's integrity, the sub contract, longevity, the race tables, the economy contract · 2026-10-29 · ROAD-TO-WORLDS-DECISIONS R46–R49)

Built as three parallel fronts (A: ECO-02/03/03b + DEV-02, B: the ECO-01 contract, C: RTW-01),
merged, then an independent review and a browser E2E pass (desktop + mobile, EN + PT).

**Career**
- **Two race tables, both viewable (RTW-01, R49; UX-01d).** The per-split **Major table** (that
  split's regional points) and the season **Worlds table** (regional + Major points) are tabs on
  Standings and a Major/Worlds toggle on HQ: position, points, the cut at the region's slots, the
  user's status, the events still to play, local sides marked. Both read the field selection's
  own order (`raceTable.ts`), so the line on screen is the line that picks the field. The Major
  field grid sits under the Major table once it is announced.
- **The offer sheet sets the slot after the price (ECO-03, R47).** It says where the player goes
  (an open seat or the sub slot), that the slot never changes the contract, and the weekly wage
  bill before and after. With a full squad (4) it asks who leaves, with each player's severance:
  the leaver goes in the same deal and the new player takes his seat. Renewals show the payroll
  projection.
- **Finances quote what the ledger books (ECO-02, R46).** The bank panel shows its real refusal
  reason, the next instalment (amount and Monday) and the instalments left; HQ names the Backer
  debt and the next bank payment; a pay-down that leaves the books in the red warns first.
- **A retiring player of yours moves into coaching or leaves the scene (DEV-02, R48)**, in the news
  and a mail; real ex-pros who coach join the coach market.

**Docs and instruments**
- **The economy contract (ECO-01), a proposal for Miguel:** `docs/ECONOMY-CONTRACT.md`. Six
  principles (newcomer protection, one season money index, stars a real decision late, every
  path viable, no snowball, no regional trap), relative acceptance bands per difficulty with
  today's values, eight proposed mechanisms with their `balance.ts` keys and ranges (not
  applied), ten decisions (Gate-1 question 2 included) and the order of work. No number moved.
- **The money probe** (`src/store/careerEconomy.probe.test.ts`, opt-in `CAREER_ECON=1`): pure
  curves P0–P8 and the harness careers read through a passthrough tap on the real flow (C1–C9);
  `ECON_OUT` / `ECON_IN` dump and re-render. **The local-sides sweep** (`RTW_LOCALS=1`,
  `careerRace.test.ts`): local sides vs real orgs in the Major/Worlds fields.

### Changed — rc.31
- **No "signed as a sub" discount (ECO-03, R47).** A player signs and renews at his normal value;
  the lineup slot is set afterwards and never changes the contract (`CAREER_SALARY.subRoleFactor`
  removed). Old contracts keep their wage until renewal. The squad cap is explicit (4,
  `CAREER_CONTRACT.squadCap`), and only a release frees a seat in a full squad.
- **The career's first transfer window is bid-free (ECO-03b, decided 29/10):** no incoming bid,
  scripted Blockbusters included, in weeks 1–2 of season 1 (`CAREER_TRANSFER.firstWindowBidFree`,
  `market.userBidsBlocked`); later windows as before.
- **Longevity (DEV-02, decided 29/10, R48):** signable and playable from 13; players retire between
  24 and 29, never before their peak, announced a season ahead (stars linger inside the window);
  a real player keeps every season of his real history. 60 % of retiring real ex-pros become
  coaches, and only they appear in the coach market. The world holds about 15 % more players.
- **Local sides score (RTW-01, decided 29/10, R49; reverses R23/R30's "never in standings"):** they
  bank regional points, race for the direct 8 and can earn Major and Worlds slots (their Major
  points bank at home). One rating per side per season: the user's region is rated around the
  user's squad as it stood on the season's first regional Monday, the other regions around their
  org median; a Major or Worlds never reads the user's squad. When the user's region overflows its
  qualifier a local side drops, never an org. The season review and its grade rank in the
  selection's order, local sides included. In the sweep they took 0.2 % of Major slots and
  0.04 % of Worlds slots; real orgs keep ~84 %.
- The "stars linger" bars are named (`CAREER_AGE.retirementStarOverallSquad` 85,
  `retirementStarOverallWorld` 90: today's values, so a Draft rarity retune can no longer move
  the career's retirements).

### Balance — rc.31
- `CAREER_AGE`: `minCompetitiveAge` 13, `retireMinAge` 24, `retireMaxAge` 29,
  `retirementByAge` {24: 10 %, 25: 20 %, 26: 30 %, 27: 45 %, 28: 60 %, 29: 100 %} (× 0.5 for
  stars, inside the window only); `retireCoachConvertRate` 0.6 (declared since v0.2, now read).
  No economy number moved: ECO-01 waits for Miguel's approval.

### Fixed — rc.31
- **"Pay it all" left an unpayable $2–48 Backer stub** that kept the bank, fee transfers and gear
  locked until a prize or a sale cleared it. Root cause: the pay-down quantized the payment down
  to $50 while Backer debts (the grant × 1.2) and bank debts are off the quantum.
  `economy.debtPaymentFor` settles the exact remainder.
- **An insolvency after a Worlds title or in the endless era could be continued into a new
  season** (it broke again on its first Monday; the harness logged those careers as
  `timeline_complete`, so the rc.30 baseline undercounts insolvency: 64 %, not 59 %). Root cause:
  `endCareer` kept the earlier ending's reason, the season screen offered "continue" for every
  ending but retirement, and the rollover had no guard.
- **A player who retired from your squad could be re-signed by his real org** (GarrettG back at
  NRG). Root cause: the user's retirees never entered the world's retired list.
- **Real players could retire before their last dataset season** (116 cases over 4 seeds). Root
  cause: an off-by-one in the anchor guard (`>` for `>=`).
- **World players retired after a season at 21–23, or played past 29.** Root cause: the world
  rolled on the new season's age (the 2022 → 2024 calendar gap adds two years) and the table had
  no cap.
- **Accepting a bid for a player who had already left reported success and moved nothing.** Root
  cause: `resolveAcceptedBid` returned the save unchanged without an error.
- **Latent until R49:** a local side's Major points would have banked in the user's region, and
  a Major/Worlds field holding a local side would have thrown. Root causes: `regionOfRef` fell back
  to the user's region for any ref that is not an org; every non-user field ref went through
  `orgTeamFor`.
- **The Standings cut line could disagree with the real field on a points tie.** Root cause: the
  table broke ties by name, the selection by the committee float.
- **Every local-side sheet showed the user's region and a rating built from the user's squad**,
  and the Worlds field grid could print a raw `local:` ref. Root causes: `OrgSheet` passed the
  user's identity region and preview rating; names read `world.orgs[ref]?.name ?? ref`.

**From the independent review of the integration (rc.31 part 4)**
- **A player signed at 29 (or at 28 into the 2022 → 2024 gap) played a season past the cap.** Root
  cause: a signing never announced the final season, and the squad only announces at the next
  rollover. He now signs for his final season only (a one-season deal, said on the offer sheet).
- **The local scene's anchor could be lowered by benching a starter on the eve of week 4, or
  raised by an armed bootcamp.** Root cause: the freeze read the fielded trio's rating. It now
  freezes the squad's best trio, without the bootcamp edge (`bestTrioRatingFor`).
- **Sale confirmations promised the whole fee while the Backer was owed.** The ledger sends half
  of it to the Backer. Root cause: both screens added the fee to the balance. They now quote
  `salePreviewFor` (the net, and "Backer repaid $X"), the same rule `applyTransferIncome` books.
- **HQ's sale confirmation mixed a weekly wage bill with a per-split salary** ("Payroll after:
  −$14,390 / split"). Root cause: `wageAfter(wages − salaryPerSplit)`. It now shows the Market's
  weekly wage-bill line.
- **The offer sheet hid the severance exactly when the severance made the deal unaffordable.**
  Root cause: its numbers came from the signing plan, which is null on an error.
- **An ended career could still sign, sell, renew and buy on a window week.** Root cause: only the
  debt flows checked the ending. One guard in the store now refuses every action that changes an
  ended career (retiring and the read marks pass; a Worlds title or the Final Whistle is not an
  ended career, so "Defend the title" and "Endless era" still go through). HQ drops its money
  warnings and action cards once the career has ended.
- **Accepting a bid left the other bids for that player pending** until tapped ("no longer
  available") or expired. Root cause: only the accepted bid was dropped.
- **Before any points, the race tables marked the alphabetical top as "Above the cut-line", and a
  tie on points read "0 pts below the line" in red.** They now read "No points yet" and "Level
  with the line", in a neutral tone.
- **The loans panel collapsed under the cursor right after "Pay it all"** (since v2.0 alpha). Root
  cause: its open state was bound to "a debt exists". It now opens with a debt and then follows
  the user.
- **"Why this price" listed per-split amounts next to a weekly wage, without a unit** (since
  v0.3). They are now labelled "/ split", and the under-contract fee "one-off".
- Copy and accessibility: EN says "sub" everywhere (the offer sheet said "reserve"); the leaver
  prompt reads the squad cap; the coaching mail no longer promises "the next window"; six dead
  keys removed; the − / + steppers have accessible names; the race tabs carry `aria-controls` and
  a `tabpanel`.

### Fixed — rc.30 (Etapa 2a, package A: closing the rc.29 integration · 2026-10-29 · ROAD-TO-WORLDS-DECISIONS R45)

**Career**
- **Near the direct-8 line, an org could play Saturday's qualifier and also take a direct seat on
  Sunday, and a Saturday loser could take a direct seat while a qualified side lost its own.** Root
  cause: Monday's commit (HQ, calendar) rated the user by the starters' plain average, which is not
  on the same scale as the orgs' stored intrinsic team ratings. Saturday and Sunday then re-seeded
  the region with the fielded team's rating, so the two reads could fall on different sides of the
  line. Monday now decides the week once, with the team rating HQ shows (`userSeedRatingFor`), and
  stores the decision (`competition.weekSeeding`). The qualifier, the regional, the lobby, the
  agenda and the calendar all read it; other weeks preview it live with the same rule.
- **Saves from before rc.28: the agenda and the next stop listed an event that had already been
  played** (SEAM-1). A qualifier played midweek came back on Saturday, and a regional played on the
  old Saturday came back on Sunday. Root cause: `userEventDefOnDay` matched played events by their
  re-timed weekend day. A played event now never lands on a day ahead of the clock.
- **Saves from before rc.28: a Major already in its playoffs on Saturday was titled "Championship
  Sunday" and hid its bracket** (SEAM-2). Root cause: the event screen treated every two-day
  playoffs stage as Sunday's. `isLegacySaturdayPlayoffs` marks that case: a plain playoffs day,
  bracket on, "Sim to end", nothing promised for Sunday.
- **Careers started before rc.29 kept their name clashes and Season X players listed by two orgs**
  (Gate 1 decision 10: yes, a one-time repair). Root cause: the rc.29 fixes (R42) applied to new
  worlds only. The saveVersion 5 migration runs `repairLegacyWorld` once:
  - one roster per player: the squad and the first org in dataset order keep their players, and
    each other seat signs the best free agent in its region;
  - one gamertag per player in a region: a filler or a pre-rc.29 rookie that clashes, or wears a
    real nickname, takes the next free bank name (the user's players and real players are never
    renamed; a filler the user signed keeps his squad name for good, unless it is a real
    nickname, which he drops if he returns to the world);
  - the bank without real nicknames.

  IDs, contracts, results and cards are untouched, and one news line says what changed.
- `nextUserStopDay`, dead since R40 (SEAM-3), is removed.

**Draft and shared UI**
- **PT showed the Daily Challenge and the XP breakdown in English** ("Daily · Legacy Day", "Run
  completed"). Root cause: `dailyPlan.ts` and `results.ts` wrote English text into the run and its
  result. Each daily template and XP line now carries a key, and the screens read `DAILY_TEXT` /
  `RESULTS_UI.xpLines` in the player's language. A run saved before rc.30 keeps its stored text,
  except its objective, which is localized from its type.
- **On a phone, achievement toasts covered the rank-up ceremony** (375×667). Root cause: the
  toaster (z-80) ignored the "ceremony" overlay hold. During a ceremony, toasts now stay mounted
  but hidden, with their timer paused, and each one plays its sound once, when it first shows.

**Found by the independent cross-package review of rc.27–rc.29** (the check the rc.29 E2E left
open):
- **The playtest build froze the results XP total at "+0 XP"** for the rest of the tab after any
  unlock (P1, playtest.rocketdraft.app). Root cause: the playtest build mounts no unlock pop-up,
  but the profile store still queued every new cosmetic, and since rc.29 the count-up waits for
  that queue to empty. The playtest build no longer queues.
- **The login calendar and the unlock pop-up could open over a live career event**, which kept
  playing underneath. Root cause: the Road to Worlds playback held nothing back (the Draft
  tournament holds "live"). It now holds "live" until the digest or the Saturday pause panel.
- **Releasing a player during an event changed the squad while the event kept fielding the
  frozen team.** For example, a release between Saturday's Swiss and Sunday's playoffs, and
  "Worlds homegrown" then read the edited squad. Root cause: only the lineup swap was locked.
  Release, signing and accepting a bid now wait until the event ends ("Roster moves wait until
  the event ends"), and the homegrown check also reads the fielded players.

### Added — rc.30 (Etapa 2a, the instruments)
- **The long-career harness (OBS-02).** `src/store/careerArcBot.ts` (test support, never
  imported by the app) plays whole careers through the real flow under seven manager policies.
  `careerArc.test.ts` keeps a smoke test in the suite and two opt-in sweeps: `CAREER_ARC=1`
  (every region × difficulty × policy × seed, sliceable across processes, merged into a
  Markdown report) and `CAREER_CURVES=1` (the development model sampled from the engine).
- **The baseline** (`docs/CAREER-BASELINE-rc30.md`, 294 careers × 8 seasons). 59 % of careers
  go insolvent (63 % on Normal); no policy wins Worlds by 2026 on Normal; EU and NA end
  insolvent every time on Normal. Rookies never reach 93+ in the dataset eras, specials sit
  above their players' potential in 76 % of samples, and squad growth stops at potential by
  18–19. Etapa 2b re-runs the same seeds.
- **The analytics contract for 2.0** (`docs/ANALYTICS-EVENTS-2.0.md`, OBS-01): a proposal for
  Miguel, no capture code yet.

### Changed — rc.30
- Career saves move to saveVersion 5 (additive `migrateSaveToV5`; the persist version stays 3).
- `ROADMAP.md` carries the 28/10 completion plan by ID (DEV-01a–e, DEV-02/03, ECO-01..06,
  BAL-02/03, UX-01..06, CAL-01, SUN-01..03, COL-01/02, UI-01a/02a/02b, EVT-01/02, FORM-01);
  Gate 1 is answered by that plan.
- Session worktrees (`.claude/worktrees/`) are git-ignored and outside the typecheck.

### Fixed — rc.29 (Etapa 1b: the rc.28 E2E pass · 2026-10-28 · DESIGN-DECISIONS #144 · ROAD-TO-WORLDS-DECISIONS R42–R44)
Every item was found by a browser E2E pass on rc.28 (desktop + mobile, EN + PT), fixed,
reviewed independently and re-checked in the browser.

**Draft**
- **The tournament gave away the Swiss before its playback** (DRAFT-01, blocker). The kicker
  switched to the playoffs and "Your path" dropped its placeholders while rounds were still being
  revealed. Root cause: both read the engine's finished Swiss and the user's final record, not the
  rounds on screen. `playoffsOnScreen` / `userSwissOverOnScreen` now read the revealed rounds.
- **A paid reroll was spent on an offer with no pickable card** (DRAFT-12). Root cause: `reroll`
  never checked `hasPickableCard`, so the dead-offer free reroll was skipped. It now takes the free
  path, and the top button reads "Free reroll".
- **Bracket and standings cut team names** (DRAFT-08/15). Root cause: the auto table layout gave the
  spare width to the numeric columns. Fixed-layout standings, a minimum bracket column width.

**Shared UI**
- **The "New unlock" pop-up opened over a live tournament** (DRAFT-02, since rc.20) and gave away
  the results rank-up. Root cause: `CosmeticUnlockModal` showed each unlock as soon as it was queued.
  An overlay hold (`store/overlayHoldStore.ts`) now keeps it, and the login calendar, waiting during
  the tournament, a challenge series, a ceremony, the tour or the season recap (#144).
- **Cold home 33 → 28 requests** (DRAFT-03). Root cause: the login calendar drew every milestone's
  art: four 800-px banners behind ~24-px cells, plus two badges. Art now loads for today and the
  next milestone only; the rest are CSS swatches and gems.
- **The rank-up ceremony had no way out** (DRAFT-04). Root cause: the unlock list replaced the hint,
  and the overlay had no button or keys. It now has Continue and the hint; Escape/Enter continue.
- **The XP count-up ran behind the ceremony** (DRAFT-05). Root cause: it started on mount. It now
  waits for the ceremonies and the pop-ups they held back.
- **Opening a dialog shifted the page** (DRAFT-06). Root cause: `overflow: hidden` removed the
  classic scrollbar, in two separate locks. One ref-counted lock plus `scrollbar-gutter: stable`;
  the reserved gutter is dimmed while a dialog is open (#144).
- **Dialogs leaked focus** (DRAFT-07): Tab reached the cards and Enter drafted one behind "Reset
  this run?". Root cause: Modal handled Escape only. Focus now moves in and is trapped, Escape
  closes the topmost dialog only, and focus returns to the opener.
- **Quick Draft results showed "Swiss record: 0–0" and labelled ×0.5 as difficulty** (DRAFT-09).
  Root cause: the badge was always on, and the engine folded the mode factor into
  `difficultyMultiplier`. Results now carry `xp.factors` (old results fall back to "XP multiplier").
- **PT runs said "Your Team" and English stage names** (DRAFT-10), in the Match Center, bracket,
  standings, results and the challenge screen. Root cause: the screens printed the engine's English
  team name and stage strings, and the Match Center built its labels once. Results carry `stageRef`;
  labels render in the active language (`lib/runLabels.ts`).
- **The welcome tour stacked on the login calendar** (DRAFT-13). Root cause: both mounted together,
  and Escape closed the hidden Modal. The tour opens alone and is skipped once a run is finished.
- Copy: the Daily "Legacy Day" intro (DRAFT-14); the "±0" Season Rating line (DRAFT-16).

**Career**
- **One gamertag on both sides of a fixture** (CAR-01). Local sides, founders, fillers and rookies
  all drew from `PLAYER_NAME_BANK`, and in MENA, APAC and SSA every name in it already belongs to a
  filler pro. `buildWorldAtCreation` also rostered every Season X lineup, so players who changed
  teams mid-season sat on two orgs (EU: Itachi, eekso, Deevo, Godsmilla; SAM: Luk, PJ, Sadness, pan,
  fAsi, BrunoVisquii), and the bank held five real nicknames. Root cause: one shared bank and no
  uniqueness rule. Fix in R42; new careers are clean (0 clashes in 280 fresh fields), and existing
  careers keep their names.
- **A reload or a trip to HQ during a live round counted it as seen** (CAR-02). Root cause:
  `EventPlayback` started with every simulated round revealed, and the spoiler hold lived only while
  the playback was mounted. A per-event reveal cursor fixes both (R43).
- **Reduced motion never showed the deciding series** (CAR-03). Root cause: every simulated round
  counted as revealed, so the digest replaced the last round in the same render. The day now stops
  on its last round with "See results" / "See the Swiss result", only after the click that plays
  it; reopening an event already at its results opens on them.
- **Digest and Swiss standings cut team names** (CAR-04/05). Root cause: the auto table layout gave
  the spare width to the other columns, and the long PT tag "Classificado" took the rest. Fixed
  layouts; on phones the placement moves under the name; PT tag "Avançou".
- **An event lobby could list a team that did not play** (CAR-06): the Community Cup, the
  Invitational, a regional, and the Saturday qualifier near the direct-8 line. Root cause: the lobby
  ranked orgs by stored ratings against a preview rating and seeded the user with the starters'
  plain average; the engine uses intrinsic ratings and the fielded team. The lobby now calls the
  engine's own selections (`qualifierEventRefsFor`, `regionalEventRefsFor`, `t3CupRefsFor`,
  `orgsByPointsFor`); a probe over 291 lobbies found 0 mismatches.
- **The mobile top bar cut its label** (CAR-07). Root cause: one label at every width in a 42vw
  button. Phones get a short label.
- **The qualifier lobby said $6k and paid $5.2k** (CAR-08). Root cause: the 9 % / 3 % shares were
  truncated to $50, and lobbies showed the season-0 base pool with no growth or difficulty (R44).
  Every format's simulated payouts are now tested against the pool the lobby shows.
- **The calendar's day detail opened under the sticky Advance bar** (CAR-09). Root cause: no
  scroll into view, and `sticky bottom-3` sat under the fixed mobile nav.
- **The Championship Sunday header showed Saturday's record unlabelled, and "Tap anywhere to skip"
  on desktop** (CAR-10). It reads "Seed #N" (or "Swiss W – L" when out), and fine pointers see
  "Click or press Esc to skip".

### Changed — rc.29
- Career lobbies, the calendar detail and the HQ cards show the prize that is paid (R44).
- The local-side sheet says local sides also fill the Saturday qualifiers (true since R30).

### Balance — rc.29
- `CAREER_PRIZES.swissOnlyPct` 9 / 3 → 10 / 2.5: a season-0 qualifier pays exactly $6k. Provisional,
  ECO-01.

### Changed — rc.28 (Etapa 1, part 2: the career weekend and the match timeline · 2026-10-28 · ROAD-TO-WORLDS-DECISIONS R40–R41)
- **The weekend calendar (GAME-02/03, R40).** Regional week: the qualifier moves from
  Wednesday to **Saturday** and is a 16-team Swiss only — the 8 teams that reach 3 wins
  qualify and it ends there (no playoffs, no champion). The regional plays **Sunday** with
  the direct 8 + Saturday's 8. **Major and Worlds span the weekend:** the Swiss on Saturday,
  a pause (a reload keeps it), the playoffs on **Championship Sunday**; prize, points, rep and
  XP land once. Events you are not in resolve on their last day (AI qualifiers Saturday, AI
  regionals Sunday, an AI-only Major/Worlds in full on Sunday; an unattended Worlds closes
  the season on day 224). On screen: Saturday/Sunday labels in HQ and the calendar (Rest on
  empty weekend days, a Major you only watch shown muted), a "The weekend" strip in the
  lobbies, a live Swiss verdict strip, the Qualified / Eliminated qualifier results with the
  qualified eight, the Swiss-complete panel with "Continue to Championship Sunday", a
  skippable once-per-event Championship Sunday title card (pairings only, static under
  reduced motion), a spectator Sunday when you are out in the Swiss, and the lineup locked
  while an event runs. Saves: additive `migrateSaveToV4` (saveVersion 4; persist version
  unchanged) re-dates pending events and ends a qualifier in progress at its Swiss.
- **The match timeline (GAME-04, R41).** Each of your games in the Match Center plays on a
  running 5:00 clock: either side can open the scoring and lead (any order the final score
  allows), every goal shows its time, an overtime game ends regulation tied, shows END OF
  REGULATION / OVERTIME, runs an accelerated +M:SS clock (0:30–20:00, mostly short) and
  ends on the winner's GOLDEN GOAL. Presentation only: seeded from each game's saved result,
  never the match RNG — scores, scorers, winners and balance are unchanged. Pacing in
  `CAREER_MATCH_CLOCK`; pause, 1×/2×/4×, skip series and reduced motion stay in sync.
- **Balance:** qualifier rewards are `qualifierAdvance` rep only (`qualifierWin` removed) and a
  flat `CAREER_PRIZES.swissOnlyPct` of 9 % of the pool per qualified team / 3 % per eliminated
  team (provisional until the economy pass, ECO-01); still no Season Points.

### Fixed — rc.28
- **Match Center game chips read backwards when the right-hand team won a game.** Root cause:
  `game.score` is winner-first and the chips printed it as left–right.
- **The side with more goals always scored first** (every scoreline 1-0 … 8-7). Root cause:
  `goalTimeline` spread each side's goals evenly and merged them, which always put the bigger
  side first. **OVERTIME only showed after the golden goal** (gated on the finished game).
- **The chip row gave away the length of your live series** (a sweep dimmed G4/G5 from game
  1). Root cause: placeholder chips read the simulated series length during the reveal.
- **The top bar and the Sim label spoiled a Major's Saturday result.** Root cause: both read the
  engine, which pauses as soon as it has simulated the deciding series, before the replay.
- **With the user seeded direct, one AI org played neither the qualifier nor the regional**
  (since R30). Root cause: that region's AI qualifier was seeded as if the user did not exist.
- **The season review could undercount Majors and titles** (since R30). Root cause: the results
  list keeps 90 rows, oldest first, while a season files about 130 since the qualifiers.
- **Lineup changes during the overnight pause moved match XP and stability credit** to players
  who never played. Root cause: `finishEvent` read the lineup at the end.
- **Local amateur sides shared names** — a pool of 8 sides could use only 4 team names, and one
  gamertag could score for both teams. Root cause: the name stride could share a factor with
  the 16-name bank, and each side drew its players independently.
- **An intermittent test** (`runStore.national.test.ts`): it pre-owned the national cards only
  after `startRun`, so a run whose first offer was a national team (~2.5 % of seeds) collected
  it into an empty album.

### Fixed — rc.27 (Etapa 1 of the 2.0 completion plan · 2026-10-28 · DESIGN-DECISIONS #143)
- **A Swiss never pairs two teams that already met (every Draft mode and Road to Worlds).**
  Root cause: `pairActiveTeams` shuffled each record group and popped pairs off the end
  with no memory of earlier rounds, so most 16-team Swisses replayed at least one series
  (181 of 200 all-AI Swisses in the plan's sweep; seed 1 round 4 had `team6` × `team9`
  twice). The pairer now searches every same-record pairing against the played history
  (derived from the saved rounds — no new save field), trying the old order first with
  the same RNG draws, so rounds that were already clean are byte-identical. For the
  16-team 3W/3L format a rematch-free round always exists (proof sketch in #143; 2 M
  random campaigns offline, 5,000 in the suite). Runs and career events saved mid-Swiss
  by an older build are handled explicitly: a stored round with a rematch is re-paired
  from its own seed (never the run's RNG), and the next-opponent cells show the round
  the engine will actually play. Difficulty matrix before/after within noise;
  challenges unchanged. Golden master seed 20260709 regenerated (it rematched in round 3).
- **Review fixes (rc.27, after the independent review of #143 and the lint pass).** A
  stored pre-rc.27 round with a rematch is now repaired group by group (clean record
  groups keep their pairs; the player keeps the opponent they were shown when that pair
  was clean) instead of being re-paired whole. The career Calendar jumps to the current
  month again on in-app navigation — root cause: with `useMounted` true on the first
  client render, the shell's scroll-to-top effect ran after the Calendar's own scroll
  (passive effects run child-first); it is a layout effect now. A client navigation into
  a `/pt` page no longer shows one frame of EN (`SyncLocale` writes in a layout effect),
  and `AnimatedNumber` no longer re-counts when the OS motion setting is turned back on.
- **Lint back to zero (5 errors + 1 warning since rc.20).** Root cause: React 19's
  `react-hooks` rules flag a setState called synchronously inside an effect, and the React
  Compiler skipped the whole Draft Match Center because a manual `useMemo` depended on a
  value it could not prove immutable. `useMounted` is now a `useSyncExternalStore` gate
  (false on the server and during hydration, as before; true on the first render of a
  client-side navigation, where there is nothing to hydrate); `Modal` derives its portal
  host from it; `AnimatedNumber` reads reduced motion through `useOsReducedMotion`; the
  Draft playback parks its clock through its timer (like the career one); the Match Center
  narration is a plain derivation the compiler memoizes.
- **PT says "Swiss", the RLCS term, everywhere** ("Fase Swiss", "Eliminado no Swiss",
  "Vitórias no Swiss"…) instead of "Suíça/suíço", matching the career copy. Root cause:
  the draft copy was translated literally ("Suíça" reads as the country).
- **Runbook:** the `profile_grants` check in `V2-IMPLEMENTATION-PLAN.md` §6-B now accepts
  `early-supporter` (a `GrantId` since rc.4) and replaces the old constraint idempotently;
  §6-B step 3 notes that the freeze trigger stops every client from moving `xp`/`mmr` the
  moment it exists. README brought up to date (scripts, layout, docs, scope).

### Changed — rc.26 (the dataset leaves the shared path · 2026-10-27 · DESIGN-DECISIONS #142)
- **The layout, the home and the content pages stop loading the dataset (#60).** The
  dataset chunk (505 KB raw / 62 KB gz) now loads only on the pages that play with it
  (`/play`, `/challenges`, `/collection`, `/profile`, `/quiz`, career): 5 of the 28
  exported pages, down from all 28. Home first-load JS 367 → 288 KB gz (1.51 → 0.95 MB
  raw), content pages 349 → 270 KB gz; `/achievements`, `/leaderboards` and `/missions`
  went light too. Root cause: the root layout's `AppShell` imported the run store
  (dataset + the whole engine) just to clear a run on navigation, the profile store took
  two lookups from the `@/data` barrel, and the home built its daily tile and quiz panel
  from the dataset.
- In their place: `store/lazyRunStore.ts` (a persisted-run check; the run store loads only
  when a run exists or is about to start, warmed on hover/focus of a play card, and `/play`
  still opens if the chunk fails to load); `data/catalog.ts` (achievements, challenges and
  every special id, the national ones from `nationalSpecialIds.json`, now written by
  `build:data`); dataset-free halves `engine/counterAchievements`, `engine/quizState`,
  `engine/challengeStars`, `lib/dailyPlan`; the home quiz panel loads with its modal.
- Guards: `src/data/sharedPath.test.ts` runs in `validate:data`, so `npm run build` fails
  when the layout, the home or a content page static-imports the barrel again; the
  integrity suite checks the catalog against the barrel. The daily is unchanged (same
  config over five years of dates) and every daily pool must stay viable, since the home
  now names the day's template without the dataset.

### Changed — rc.25 (live-data difficulty pass, APAC/SSA, D01 · 2026-10-27 · DESIGN-DECISIONS #138–#141)
- **APAC and SSA stay closed, and their region-only rosters are dormant**: they no
  longer play in the general draft, their national teams (Malaysia 2025, South
  Africa 2024/2025) are not drawn, and the national album lists only teams you
  can find today (they join when those regions open) (#138).
- Analytics: daily runs now send `region: "daily"` on `run_started` (they showed up
  as region "None" on the dashboards).
- The difficulty sim bots (`difficulty.sim.test.ts`, `difficulty.matrix.test.ts`)
  take the free reroll on an offer with nothing pickable, like the game — they used
  to abandon the draft, silently dropping about 1 in 4 Legacy drafts from samples.
  The matrix tool also records reset counts per session (`SIM_RESET_SET`) and lets
  national teams appear, like a real classic run.

### Balance — rc.25 (#140, #141)
- **Difficulty calibrated on live play.** A reset model fitted on `main` reproduces
  the last 14 days of PostHog (Easy 64.6 · Normal 34.5 · Hard 22.3 · Legacy 4.1 %).
  Every pool now gives typical players the live worldwide rates, and on Hard and
  Legacy a run reset 12+ times can't win more often than it does live (54 / 12 %).
- Worldwide shifts: Normal −1.3 → −1.05, Hard −0.7 → −0.5, Legacy 1.3 → 1.6 (the
  new 97–98 mythics and national teams had lifted Legacy grinders to 16 %).
  Typical worldwide Legacy lands ≈2.8 % (was ≈4.1 %).
- Region boosts (Easy / Normal / Hard / Legacy): SAM −1.85 / −0.35 / 1.45 / 3.95 ·
  EU −0.05 / 0.45 / 0.9 / 1.5 · NA 0.4 / 1.15 / 2.55 / 2.15 · MENA −0.55 / 1.45 /
  2.9 / 4.05 · OCE 0.25 / 1.35 / 3.5 / 5.35. SAM Easy/Normal stop being far harder
  than worldwide (live ≈30 / 17 %), and OCE/MENA Legacy stop rewarding grinding
  (OCE grinders won ≈32 %).
- 9 challenges re-tuned (8 by boss shift on their seed; Perfect Storm re-seeded).

### Fixed — rc.25
- **D01: Chiefs Esports Club S6 and Tainted Minds S6 had swapped player trios.**
  Root cause: the two `teams.md` blocks carried each other's players since the
  original import. The six renamed card ids stay lookup keys for the corrected
  cards (`src/data/cardIdAliases.json`), so run-history replays, runs in progress
  and cloud rows from older builds keep resolving — no save migration (#139).

### Added — rc.24 (the v2.0 database expansion, 2026-10-27 · DESIGN-DECISIONS #133–#137 · ROAD-TO-WORLDS R39)
- **The v2.0 base export** from `rocket-draft-database` (2026-10-26, 1383 approved
  decisions): 149 new lineups (289 → 438 — international rosters from S3 to 2026,
  second rosters of an org in one season, regional rosters for every region),
  22 corrected blocks, 18 new special cards and 13 corrected ones, 62 org logos,
  204 nationalities and 364 real birth dates. No saved id disappears. Generator:
  `· recorte: <name>` on the team line for a second roster in a season (it joins
  the id), `PERSON_ID` for homonyms, `BIRTHDAY`, `NATIONAL_TEAM_NAMES` (#133).
- **Region-only mode for NA, EU, SAM, MENA and OCE** (was SAM only). The
  `sam-only` flag now means region-only in any region; APAC and SSA stay "Coming
  soon" and their flagged rosters play in the general pool until they open. The
  setup screen shows the selected region's roster count (#134).
- **National teams** — the FIFAe 2024 and 2025 national rosters (32 teams, 133
  cards). A rare draw of their own in Classic and Quick drafts (2.5% per offer,
  undiscovered teams favoured); every card is a gold **National team** special
  (the flag as art, +2 to every team attribute); seeing the team collects all of
  its cards at once, with a toast and a "Rare draw" note on the offer. Never an
  AI opponent, never in dailies, challenges, the quiz or the career (#135).
- **National-team album** in the collection: a second tab with one crest per
  team, grouped by edition, progress per edition; a team opens its cards. The
  existing special-card counters and achievements don't count national cards.
- **Real ages in Road to Worlds** — players with a known birth date use it; new
  careers only (R39).
- Opt-in tuning tools: `difficulty.matrix.test.ts` (before/after matrix, every
  difficulty × any pool) and `challenges.tune.test.ts` (challenge re-tune scan).

### Changed — rc.24
- Worldwide is described as "the international pool" (it has held Major teams
  since v1.4); the regional texts, the home SEO block and the `/sam` page no
  longer say only SAM is live (EN + PT).
- National team names show in Portuguese in the PT UI (cards, draft header,
  album, toast); the data stays English like every org.
- The career's card history ignores national (FIFAe) cards, so they never become
  a player's anchor overall or lift a potential (R39).
- The quiz keeps to club careers (national lineups are not clues).

### Balance — rc.24
- **Region-only boosts per region × difficulty, fitted to worldwide parity**
  (#136): SAM −1.2 / −0.1 / 1.4 / 4.0 · EU 0.25 / 0.5 / 1.2 / 1.5 · NA 0.6 / 1.3 /
  2.3 / 2.0 · MENA −0.1 / 1.4 / 2.6 / 4.1 · OCE 0.9 / 1.35 / 3.3 / 5.0 (Easy /
  Normal / Hard / Legacy). Every region now lands at ≈85 / 54 / 40 / 9 % title
  rate for a good drafter, like worldwide. SAM Easy and Normal get easier (61 →
  83 %, 35 → 53 %); SAM Legacy is unchanged.
- Worldwide difficulty unchanged — measured before and after the expansion
  (Easy 85 → 86 %, Normal 54 → 54 %, Hard 40 → 40 %, Legacy 9.1 → 8.4 %).
- 17 challenges re-tuned by boss shift on their original seeds (#137).

### Fixed — rc.24
- **Region-only Normal was harder than Hard** (SAM 35 % vs 40 % title rate; OCE
  would have been 44 % vs 58 %). Root cause: one flat +2 boost for Easy, Normal
  and Hard, while Hard also sets the AI's chemistry cap to 0 — in a small field
  of real rosters at full chemistry that outweighs Hard's 0.6 extra shift. The
  per-region × difficulty boosts absorb it; `regional.test.ts` now asserts the
  field toughens from Easy to Legacy in every region.
- Collection detail: the effect line of every special started with an orphan
  "—". Root cause: only the legacy situational effects have a label, but the
  separator rendered unconditionally.

### Added — rc.23 (the banner's animated layer on the profile, 2026-10-21 · DESIGN-DECISIONS #132)
- **Animated banners on the profile hero, filter-free.** `build:banners` now
  also extracts, from the design file's animated SVG, ONLY the elements that
  animate (sparkles, dust, flames, rings) with their ancestors and the
  gradients / clips they reference, every `filter` stripped, into
  `public/banners/<art>.anim.svg` (0.3–24 KB; `src/generated/banner-anim.json`
  lists them). The hero draws it as a second `<img>` over the WebP, so the
  design file's SMIL motion plays while turbulence / displacement / blur never
  run in the browser. Hero only (board rows, locker and lists stay still); off
  under lite / reduced motion. Measured (`perf:probe`, every badge unlocked,
  Cosmic Ascension equipped): profile **23 ms/s** of main thread (budget 80),
  board 7 ms/s, zero non-composited animations.
- `perf:probe` accepts `CHROME_NO_SANDBOX=1` (containers that run as root).

### Changed — rc.23
- Profile hero: the badges sit beside the NAME; featured 58 px, others 44 px.
- Titles: the text glows too (a blurred copy of the name behind the gradient
  text, in the title's glow colour; white gold on legendary), the chip glow a
  touch stronger; the legendary band passes every 9 s, the epic every 14 s
  (one way, then rest); board rows no longer clip the glow (the truncation
  wrappers keep padding for it). Rocketeer: Daily Driver's warm gradient
  ending in a light violet.
- Legendary badges are drawn at their larger size (16 %) instead of scaled by
  CSS — the scaled composited layer looked soft at rest.
- The board's player peek shows the banner with its glow (and the legendary
  tilt / pointer band) like the profile; the epic hero glow is lighter.

### Changed — rc.22 (banner and title polish from Miguel's review, 2026-10-21)
- Banners: WebP at 2× (800 / 1240 / 2480, quality 88 — 1× looked soft on
  retina); the design file's frame drawn as a CSS ring in the banner's
  materials (thicker and brighter up the rarities; thin on rows); the holo
  band is wider, slower and crosses ONE way with a long rest (epic 16 s,
  legendary 13 s); on a legendary the band follows the mouse (hero and
  board rows) and the hero tilts a little, like the legendary titles;
  the legendary hero glow is softer and white gold.
- Profile hero: the badges sit by the name and title, on the banner's dark
  reading zone.
- Titles: text larger inside the chip (less padding), weight 700; the glow
  hugs the silhouette (3 / 8 / 16 px) and no longer paints the inside;
  legendary pulled further to white; uncommon and rare generic titles plain
  grey, the pre-season Platinum / Diamond / Champion / Finalist green;
  Rocketeer blue → violet → orange; long names keep the same size (only the
  tracking tightens) so every board row matches.
- Legendary badges back to 16 % larger.

### Changed — rc.21 (Miguel's banner art, title polish, 2026-10-21 · DESIGN-DECISIONS #132)
- **Banners are Miguel's art** (`data-sources/banners/banners-rocket-draft.html`,
  the `RDBanners` generator): `npm run build:banners` exports the 18 banners as
  static, frameless SVGs (`public/banners/`), and build-images rasterises them
  to WebP (400 / 800 / 1240 px, 8–11 KB each at 1240) — the SVGs carry
  turbulence, blur and displacement filters that must never run in the
  browser (the rc.9 lesson from the badges). The card renders ONE image
  (`--cos-img`, cover, right-anchored; thumbnails frame the focal area) and
  adds the tier effects in CSS, transform / opacity only: a holo band on epic,
  a strong prismatic band on legendary, and on the profile hero a glow in the
  banner's own colour (static box-shadow). Rows keep a thin veil at both
  edges; phones a uniform one. The rc.20 CSS pattern families are gone.
- **Titles:** a step larger (profile hero 14 px, board rows 11.5 px);
  uncommon / rare quiet (faint tint, a whisper of glow on rare); epic glow
  stronger, with a per-title glow colour; legendary pulled to white with
  white-gold and light-pink details, a strong white / gold / pink glow and a
  vivid holo band. Pre-season Champion → rare green, Diamond / Platinum →
  uncommon green, Gold / Silver / Bronze plain grey; the podium titles (#2, #3,
  Elite) and the Road to Worlds **World** Champion in gold with an orange
  glow; Pro → **Pro Player** (ice / sky), Contributor emerald / teal, Early
  Supporter a rose tone off the Supporter's raspberry; Daily Driver and
  Rocketeer three-colour gradients; On Fire and Can't Stop → uncommon (fewer
  rare generics).
- **Badges:** build-images measures each badge's alpha-weighted centroid and
  the manifest carries the shift (`badgeShifts`) that BadgeEmblem applies, so
  crests and tabs no longer make a badge sit off-centre next to the others;
  legendaries drawn 22 % larger (was 14 %).

### Fixed — rc.21
- **Long titles rendered larger than the others.** Root cause: the
  `cos-title-long` rule set `font-size: 0.92em` on the chip itself, and an em
  there resolves against the PARENT (16 px), overriding the chip's own 11 px
  class. The rule now targets the inner text span.

### Added — rc.20 (the final cosmetics: titles + banners, 2026-10-21 · DESIGN-DECISIONS #131)
- **The official title / banner set** (`data-sources/badges/cosmeticos-atualizado.md`):
  36 titles and 18 banners replace the provisional rc.3 set, all CSS (no assets).
  Tier treatments — common grey · uncommon a weak colour · rare a strong colour
  with a light glow · epic gradient + glow + holo band · legendary white gold with
  glow, holo band and pointer tilt (titles) / layered colour with a sheen
  (banners). Eighteen banner pattern families (pitch, arena, flare, flames,
  circuit, grid, slipstream, singularity, overdrive, cosmic, blueprint, lane,
  heat, vault, target, playbook, retro, tactic), each a stack of gradients; only
  the legendary sheen moves, with transform. The dark overlay thins with the
  tier and darkens again at the right edge so the rating always reads; phones
  keep it darker (the hero centres its text).
- **Login calendar (30 days).** Eight milestone days with cosmetics (3 The
  Regular · 5 Kickoff · 7 Spark · 10 Locked In · 14 After Hours · 21 Solar
  Flare + On Fire · 25 Can't Stop · 30 Wildfire badge + banner + Daily Driver),
  22 XP-only days (`LOGIN_STREAK.milestoneBonus`, `cycleDays`). The modal shows
  the whole cycle: banked days, today, the items drawn small on their day, the
  next reward; a milestone whose item is already owned (a new cycle) is ticked
  and pays XP; past day 30 the calendar reads complete.
- **Season 1 rank track** (`season-rank`, seasonId 1): Bronze Circuit · Silver
  Challenger · Gold Neon Grid + Playmaker · Platinum Slipstream · Diamond
  Unstoppable · Champion Singularity + Rocketeer · GC Overdrive · SSL Cosmic
  Ascension + Rocket Demigod. Handed out the first time the rank is reached
  (lower ranks included), kept once owned; teased as locked silhouettes.
- **Play milestones, counted from the Season 1 reset** (new sources
  `runs-won-since-s1`, `runs-finished-since-s1`, `legacy-streak`,
  `specials-owned`, `challenge-perfect`): Rookie (first win) · Blueprint (10
  runs finished) · Victory Lane (25 wins) · Draft Veteran (100 wins) · On a
  Roll / Heatwave (3 / 5 consecutive Legacy titles — `profile.legacyStreak`, new
  durable field, merged in the sync) · Card Hunter / The Vault (1 / 10 specials
  since the reset) · Target Practice (25 missions) · RL Nerd / Playbook (10 /
  50 quizzes) · Road to Worlds Champion (first Worlds).
- **Three fixed challenges with exclusive cosmetics** (all three stars):
  Pure Talent (Silver, base cards only → Back to Basics banner + Pure Talent
  title), Homegrown (Gold, three starters from one region → Homegrown title),
  Time Capsule (Platinum, three starters from one RLCS season → Golden Era
  banner). New star kinds `sameRegion` / `sameSeason` read the drafted roster
  (`StarContext.roster`). The challenge card and briefing show the reward strip.
- **Unlock pop-up** (`CosmeticUnlockModal`, `cosmeticUnlockStore`): every
  earned title / badge / banner gets the special-card ceremony (burst, ring,
  float), its rarity, description, how it was earned and "Wear it now". Fed by a
  profile-store subscription on the owned map; hydration and the cloud merge
  stay quiet; it waits for the run ceremonies and the login modal.
- **Pre-season titles** per the document: First Chapter (participation), the
  board titles (Champion white gold · #2 / #3 gradients · Elite / Finalist
  solid) and one title per peak rank (grey → white gold), plus the four manual
  grants with RESERVED colours (early supporter cobalt · supporter raspberry ·
  contributor emerald · pro baby blue), checked by a test.

### Changed — rc.20
- **Badges follow the revised design file** (`Badges-Rocket-Draft-Revisado`):
  Season Elite covers #4–10 (4th / 5th place badges retired), Season Finalist
  #11–50; Crowned World Champion is the FIRST Worlds title (the original World
  Champion art retired); Early Supporter badge added (grant `early-supporter`);
  On Target at 25 missions; Pre-season Champion back to epic. 35 badges.
- **Pre-season peak-rank rewards are cumulative** (the document: "conceder
  também os itens dos ranks inferiores"); board rewards stay one band each.
- The provisional titles / banners (`legacy-title-day-one`, the rc.3 board
  banners, `streak-*`, `stars-title-45`, `quiz-title-30`, `missions-title-100`,
  the career title / banner set) are gone — never shipped outside staging.
- Locker: titles in two columns (the long pre-season names), long names get a
  tighter chip; the rank track teases as locked slots (rc.4 hid it).
- `achievementToast`-style XP from mid-run achievements now updates the season
  peak rank and refreshes cosmetics (the rank track can trigger there).

### Fixed — rc.20
- **Cloud merge dropped and re-dated playing rewards.** Root cause:
  `mergeProfiles` refreshed the owned cosmetics from a PARTIAL fact set (no
  wins, stars, career marks), so `refreshOwned` dropped every runs-won / stars /
  career item and the next store refresh re-added it with a new date — "NEW"
  markers (and now the unlock pop-up) fired again after every sync. The merge
  now reads the complete merged facts.
- Collecting specials never refreshed cosmetics (no source read them before);
  it does now (Card Hunter / The Vault).

### Changed — rc.19 (2026-10-20)
- Legendary glow tighter (core sigma 2.2, halo 16 at 0.3) so badges built from
  separate pieces (laurel leaves, e.g. Veteran Drafter IV) keep their gaps.

### Changed — rc.18 (2026-10-20)
- Legendary glow is two baked layers: a strong core hugging the silhouette over a
  wide, faint halo (build-images); a little larger overall.

### Changed — rc.17 (2026-10-20)
- Legendary glow: white gold (build-images re-tints every *.glow.webp), larger
  (scale 1.28) and softer (breathing 0.55 → 0.72).

### Changed — rc.16 (2026-10-20)
- Legendary badges are drawn 14 % larger than the others (same layout box).

### Changed — rc.15 (2026-10-20)
- Legendary glow a little larger (scale 1.18) and softer (breathing 0.68 → 0.85).

### Changed — rc.14 (2026-10-20)
- Legendary badges sway at rest again (±20°, ±11° on board rows) — keyframes
  with plain values (no `var()`), so the GPU runs them; hover tilt up to
  32° / 21° / 12° by size; the silhouette glow a touch stronger (wider, breathing
  0.85 → 1).

### Changed — rc.13 (2026-10-20 · DESIGN-DECISIONS #130)
- Legendary badges are **still at rest** (no idle sway) and the **rays are gone**;
  they keep the silhouette glow (breathing), a slow sweep (8 s) and, on hover,
  the size-scaled tilt. Twinkles only on badges ≥ 64 px (hero, locker, peek),
  not on the profile showcase or the board.

### Fixed — rc.13
- **The profile and the leaderboard stuttered with a legendary banner on screen.**
  Root cause: `.cos-banner::after, .cos-banner > * { position: relative }` also hit
  the animated banner's sheen (`.cos-banner-animated::after`), turning the absolute
  band into an empty INLINE box. A transform can't be GPU-animated on an inline box
  (Chrome trace: `compositeFailed` "transform-related property cannot be
  accelerated on target"), so it ran on the main thread every frame — and that
  dragged every other animation on the page (all the badge effects) through main-
  thread style updates. The sheen also never showed. Fix: the rule targets
  `.cos-banner > *` only; the sheen is a block again.
- Measured on a production build in headless Chrome with GPU compositing, every
  badge unlocked (main-thread ms per second while idle): profile with a legendary
  banner 254–330 → **44**; leaderboard 416–480 → **19**; profile animations 78 →
  28; the trace shows no non-composited animation on either page.

### Changed — rc.12 (2026-10-20)
- Legendary rays now start at the badge's centre (behind the art, so they read
  as coming out of it) and end a little closer, fading just past the edge — they
  used to float in a ring away from the centre.

### Changed — rc.11 (legendary glow in the silhouette, 2026-10-20 · DESIGN-DECISIONS #129)
- **Legendary glow follows the badge's own shape.** `build-images` now also makes
  one `*.glow.webp` per badge: the art's silhouette painted gold, padded and
  blurred ONCE at build time (~16 KB). The badge shows it behind the art, inside
  the sway (so it turns with the badge), breathing gently (opacity only) and a bit
  stronger than before. No round halo, no runtime blur; only legendaries request it.
- **Rays are a detail now**: short, fainter, peeking just past the edge, turning
  slowly (36 s).
- Hover tilt toned down (26° / 17° / 10° by size).

### Changed — rc.10 (legendary presence, 2026-10-20 · DESIGN-DECISIONS #129)
- Legendary badges move more at rest (sway ±24°, ±12° on small badges) and tilt
  further under the pointer (34° / 22° / 13° by size).
- The pulsing silhouette aura is replaced by a **wide, soft gold glow** behind the
  badge (breathing a little, opacity only) with **fine light rays** over it, turning
  slowly (30 s, rotate only) at low opacity — the rc.6 rays idea, toned down. Both
  stay flat behind the tilting badge. Board-row badges keep the glow, skip the
  rays. Under reduce-fx the rays are hidden and the glow is still.

### Changed — rc.9 (leaderboard performance, legendary aura, 2026-10-20 · DESIGN-DECISIONS #129)
- **Badges are pre-rendered WebP in production.** `build-images` (prebuild) now
  rasterises `public/badges/*.svg` once into `/img/badges/<art>.<hash>.<w>.webp`
  (96 / 224 px, 1-year immutable cache; ~6 KB / ~20 KB each), listed in the asset
  manifest and checked by `postexport`. `badgeArtSrc(art, px)` picks the width for
  2× the display size; dev keeps the source SVG. Same number of requests, fewer
  bytes, and no SVG blur filters in the browser.
- **Legendary**: the gentle 3D sway is back (±18°, ±9° on small badges; slower,
  8 s) with a slow reflection riding it; the round halo is replaced by a **gold
  aura in the badge's own silhouette** (the art as a mask, a touch larger, behind
  it) that pulses (opacity + scale). Pointer tilt scales with the size (26° /
  16° / 9°), so board-row badges tilt gently.
- Small badges (board rows) skip the twinkles.
- **Pre-season Champion** is now **rare** (only Grand Champion is epic).

### Fixed — rc.9
- **The leaderboard still stuttered.** Root causes: (1) every row's badges are SVGs
  with 3–4 blur filters, rasterised in the browser (~180 on a board); (2) legendary
  titles animated `background-position` on clipped gradient text, and animated
  banners animated `background-position` across the whole row — both repainting
  every frame; (3) the aurora banner pattern had a `filter: blur(18px)` redrawn
  with each repaint. Fixed by the WebP badges above, title and banner sheens moved
  to `transform`, and the aurora drawn with soft gradients (no filter). Audit on a
  production build: every animation on the board animates only transform/opacity.

### Changed — rc.8 (badge effects tuned, 2026-10-20 · DESIGN-DECISIONS #128)
- **Rare badges are plain** (no holo). **Epic** sweep a little softer.
- **Legendary badges no longer move at rest** (the idle sway read as odd): they
  tilt only under the pointer (desktop, ±30°, the reflection follows). At rest
  they get a brighter prismatic sweep, three twinkles and a new **warm halo**
  behind the art — wide and faint, breathing slowly (opacity / scale only), so it
  frames the badge without doubling the art's own glow; it lifts on hover.
- Hosting unchanged: pure static export on an assets-only Worker (no script, no
  `run_worker_first`); badge SVGs are static files with a 1-day cache, and the
  holo mask reuses the same file — no extra requests.

### Changed — rc.7 (badge effects rebuilt, 2026-10-20 · DESIGN-DECISIONS #128)
- **Badge effects redone.** Miguel on rc.6: ugly, the spinning rays behind the
  legendaries did not work, the holo was too fast and thin to see, and the profile
  with every badge froze the browser. Now:
  - **Rare** — one wide, soft, cool light sweep, slow (every ~7.5 s).
  - **Epic** — a wider prismatic sweep (~every 5.8 s) and two twinkles.
  - **Legendary** — a strong 3D sway (±28°, with a slight lift) carrying a soft
    prismatic reflection that rides the turn, three twinkles, and on desktop the
    pointer takes over the tilt (±30°) with a smooth hand-off. No rays, no extra
    glow: the art's own glow is left alone.
- Each badge runs on its own offset, so a grid never pulses in sync.

### Fixed — rc.7
- **The profile froze with many badges on screen.** Root cause: the rc.6 effects
  animated `filter: drop-shadow` on the badge images and used `color-dodge`
  blending over a spinning gradient; every badge SVG carries 3–4 SVG blur filters,
  so the browser re-rasterised and re-filtered each badge every frame. The effects
  now animate only `transform` / `opacity` (GPU-composited), use no CSS filter
  and no blend mode, and only run for badges on screen (one shared
  IntersectionObserver sets `data-live`); the masked holo layer is not even
  created for off-screen badges. No new requests.

### Added — rc.6 (badge effects, Supernova, badge showcase, 2026-10-20 · DESIGN-DECISIONS #126–#127)
- **Badge effects by rarity**, after the special cards' holo: common / uncommon
  plain; **rare** a prismatic holo with a light sweep; **epic** a turning rainbow
  holo, a faster sweep, sparkles and a violet aura; **legendary** all of it
  stronger plus golden rays behind, a pulsing gold aura and a **3D tilt** (an idle
  sway, and pointer tracking on desktop). The holo is masked by the badge's own SVG,
  so only the badge lights up. Shown everywhere a badge is ≥ 28 px: locker, profile
  hero, badge showcase, leaderboard rows (tilt included) and the player peek. Off
  under "Reduce visual effects" / lite-fx, still under reduced motion.
- **Supernova** (epic): 70 challenge stars. All badge art refreshed from Miguel's
  updated design file (`npm run build:badges`). Catalog: 37 badges.
- **Badge showcase on the profile**: beside the season track, every badge the
  player owns, best first, with effects (up to 15, then "+N"); tap to open the
  locker.

### Changed — rc.6
- **No Season 1 rank rewards.** Rank- and rating-linked rewards are handed out only
  when a season turns over, so the in-season track lost its badges, titles and
  banners (`s1-*`); today the only rank/rating rewards are the pre-season (PS) ones.
  The season card is now the rank track ("your peak rank becomes a badge when the
  season ends") with the season numbers and rating history under it.
- **Locker order**: rarity first (owned legendaries, then epics…), then the badge's
  family (board place, peak rank, manual, career, runs, stars, quiz, missions,
  streak), then the catalog priority; locked slots follow the same order.
- **Locker slots**: when a badge is selected, every other slot shows what a tap
  will do on an overlay (Swap / Move here); with all slots full, "Replace".
- **Profile hero**: the badges sit beside the Season Rating (they were above it,
  which left a gap over the name), a step bigger (72 / 56 px).
- **Home**: every card is clickable as a whole (Classic Draft, Daily Challenge,
  Missions, Daily Quiz, like the tiles already were); the only control with its
  own target is Quick Draft on the Classic Draft card (and the missions Daily /
  Weekly switch).
- **Player peek**: the player's place on the board you are looking at (#N) replaces
  the pre-season tag; the rank · season line is gone; bigger badges (108 / 76 px)
  with their effects; no "featured" label — the middle one is simply bigger.

### Changed — rc.5 (badge slots + profile / board polish, 2026-10-20 · DESIGN-DECISIONS #125)
- **Locker badge slots.** A badge you tap drops into the first free slot. With all
  three full, the strip asks which slot to replace (the badge waits, tagged "Pick a
  slot"; Cancel backs out). Tapping a badge that is already shown selects its slot:
  tap another slot to swap them (that is how a badge becomes featured), or the small
  bin on the slot to remove it and open the slot. With a slot selected, tapping a
  new badge puts it in that slot. The strip is sticky, so it stays in view over the
  long grid. Pure helpers in `engine/cosmetics.ts` (`addBadge`, `placeBadgeAt`,
  `swapBadges`, `removeBadgeAt`), tested.
- **Profile hero:** the three badges moved into the free space above the Season
  Rating, a step bigger (featured 64 px, others 48), and the banner is shorter.
- **Leaderboard:** taller rows (52 px) with bigger badges (featured 36, others 28).
  On phones the title sits under the name so it is never clipped beside the badges.
- **Player peek** (tap a row) rebuilt as a small profile card: the banner with rank
  emblem, name, title and rank · season (+ the pre-season place as a gold tag); a
  badge showcase with the featured badge centred and largest, each with its name;
  then rating · rank · titles.
- **Home:** the Daily Quiz card reads top-down like the others (title + Live tag,
  line, button at the bottom) instead of having its text pushed to the bottom.

### Fixed — rc.5
- Responsive visibility on title chips (`hidden` / `sm:hidden`) had no effect: the
  unlayered `.cos-title { display: inline-flex }` rule outranks Tailwind's layered
  utilities. The breakpoint classes now live on a wrapper.

### Added — rc.4 (badges, locker, home + board polish, 2026-10-20 · DESIGN-DECISIONS #122–#124, ROAD-TO-WORLDS-DECISIONS R38)
- **The approved badge catalog: 36 illustrated badges** (Miguel's "Gema & Moldura"
  design file, `data-sources/badges/`). One static SVG each in `public/badges/`,
  exported by the new `npm run build:badges` (runs the file's own generator in an
  empty `node:vm` sandbox, then checks every catalog art key exists). Badge id =
  art key = file name. Series: login streak (Spark 7 days, Wildfire 30), challenge
  stars (Rising Star 25, Constellation 50), runs won (Veteran Drafter I–IV: 50 /
  250 / 500 / 1,000 titles), daily quiz (Scholar I–III: 10 / 25 / 50 solves),
  missions (On Target, 50), pre-season (First Chapter; Season Finalist / Elite /
  5th / 4th / 3rd / Runner-up / Champion by final board place; Pre-season Bronze →
  Supersonic by peak rank), Road to Worlds (Road Warrior, Underdog, World
  Champion = first Worlds, Crowned World Champion = 3 Worlds across saves, Dynasty)
  and manual grants (Contributor, Supporter, Verified Pro). Rarity uses the design
  file's five steps — **Uncommon** is a new tier (common → legendary).
- **Featured badge.** Up to three badges on the banner, and the first one is
  FEATURED: drawn a size up on the profile hero, first (and larger) on leaderboard
  rows and in the profile peek. The locker's badge tab opens with an "On your
  banner" strip — tap a shown badge to feature it. Order is the choice, so the cloud
  row (`equipped_badges`) did not change.
- **New-item dots.** A small green dot on each locker tab that holds something new,
  and on each slot of the profile hero (title, badges, "Change banner") plus the
  locker button — replacing the old number bubbles.
- **Home missions: Daily / Weekly switch** on the widget, and "All missions" is now
  a real button in the same style as "Play today's challenge".
- **Daily Quiz tile** has the Daily Challenge anatomy: title + **Live** tag, the
  line, and a "Play today's quiz" button (replaces the purple "Play →").
- Settings: **Reduce visual effects** (see Fixed).

### Changed — rc.4
- **Locker no longer spoils locked items.** Items still to earn by playing show as
  the collection's silhouettes (lock + rarity, no art, no name). Season-track and
  leaderboard / rank / grant rewards the player does not own are not listed at all;
  Road to Worlds rewards only tease where career mode is on.
- **Pre-season board and peak-rank rewards are non-cumulative** (Miguel's rule): a
  player gets their own band only (1st → Season Champion, not Elite + Finalist; a
  Gold peak → Pre-season Gold only). The provisional pre-season titles / banners
  follow the same bands (#2–10 elite, #11–50 contender, #51–100 challenger).
- **Season-scoped rewards are kept once earned** (Season 1 track, Dynasty): the
  derivation no longer drops them when the season's facts reset. Preview-only
  ownership is now marked so the staging "unlock all" switch still cleans up.
- **Leaderboard rows**: place · name · badges · title on the left; rank and the
  number on the right (the title moved next to the badges and shows on mobile too).
- **/missions** uses the full width: daily missions on the left, weekly on the
  right in the bigger card.
- Season 1 track badges (Silver / Gold / Champion) wear the design file's Season 1
  rank art until the generic track badges are drawn. Titles and banners are still
  the provisional rc.3 set.
- Removed the rc.3 line-art badges (`legacy-badge-*`, `streak-badge-*`,
  `stars-badge-*`, `quiz-badge-10`, `missions-badge-25`, `career-badge-*`,
  `grant-badge-*`) — staging-only ids, never shipped.

### Fixed — rc.4
- **The game stopped working with Settings → Reduce motion on.** Root cause: the
  manual switch added `html.force-reduce-motion`, whose CSS turns off the draft
  reel's animation (`.slot-reel-track`), but `DraftScreen` only skips the reel for
  the OS `prefers-reduced-motion` query — so `onAnimationEnd` never fired, the
  drawn lineup never appeared and the draft stalled on the first pick. The switch is
  gone; in its place **Reduce visual effects** (`reduceEffects` → `html.reduce-fx`)
  drops the expensive decoration only (backdrop blur, rarity loops, holo and glare
  layers on special cards, the collection tilt) and never an animation the game
  waits on. Career event playback follows the OS preference via
  `useOsReducedMotion()`. Old saves keep a harmless `reducedMotion` key.

### Changed — rc.3 (visual language reset, 2026-10-19 · DESIGN-DECISIONS #121)
- **Cosmetics speak the game's language again.** rc.2's layered, bevelled art
  was rejected ("cara pobre", disconnected from the clean UI). Badges are now
  LINE ART: an outlined shape (8 shapes) with a stroke glyph (18 glyphs), one
  gradient stroke, round caps — the Legacy emblem's grammar. Titles are the
  same chip as the "Live" / "New" tags. Banners keep the left side dark and
  put the colour on the right. Effects follow the special cards: basic = one
  muted colour and nothing else; rare = one accent; epic = gradient + glow;
  legend = prismatic gradient + glow + holo loop.
- **Avatars and frames removed** (the mechanic, not just the art): a player is
  name, title, badges and banner. The season track and the legacy rewards that
  used to be frames became badges / banners (`legacy-badge-<rank>`,
  `s1-badge-gilded`, `s1-badge-prism`, `s1-banner-supersonic`,
  `streak-badge-7`, `stars-badge-25`, `career-banner-world-champion`).
  Titles re-tiered so there are basic (gray) ones. Catalog: 53 items.
- **Profile hero back to the v2 layout** (rank emblem · name · title · badges ·
  rating · XP bar), every slot still tappable (title, badge slots, "Change
  banner"). Season track: rank on top, reward below, the bar follows XP.
- **Leaderboard** rows are thin again: place · name + badges · title · rank ·
  value; banners are a hint on the right.
- **Home**: identity block is the centred rank emblem with rank / rating /
  runs / titles as tags; no decorative glyphs on the Play cards; Today row is
  Daily Challenge · Challenges · Missions (tall), with the quiz as a short tile.
- **Challenge cards**: a divider before the three stars, and the XP each pays.

### Added — rc.2 (UX & design pass, 2026-10-19 · DESIGN-DECISIONS #119–#120, ROAD-TO-WORLDS-DECISIONS R35–R37)
- **Cosmetics redrawn** (`src/data/cosmetics.ts`, `CosmeticViews.tsx`): every item
  is now layered SVG with a tier language — Basic flat · Rare rimmed · Epic
  metal + gem + glow · Legend wings/laurels + sparkle + holo. Badges have seven
  shapes and nineteen glyphs; frames have eight shapes (ring, hex, octagon,
  shield, square, crest, wings, laurel); titles sit in tiered chips; banners
  gained hex / waves / circuit / aurora / stadium patterns. Rank rewards use
  the rank's own palette. 15 **avatars** (6 starters, 9 earnable) are a new
  cosmetic kind; catalog: `docs/COSMETICS-CATALOG.md` (generated).
- **Profile v3**: the banner is the stage — avatar in frame, name + title chip,
  three badge slots, rank art (menu set), Season Rating, XP bar. Every slot
  opens the **locker modal** on its tab; a "new items" counter on the locker
  button; exclusive items the player does not own are hidden; **no auto-equip**.
  Season track is a horizontal progress bar with the reward art per rank;
  rating history is a small sparkline; lifetime stats in three tiers.
- **Home v3**: a bento — Play (Classic with Quick Draft as its secondary action,
  Road to Worlds), Today (Daily Challenge, Challenges, Missions, **Daily Quiz as
  a modal**), You (Collection, Achievements, Profile, Leaderboards). Identity
  line is rank art + rank + rating only (no frame, XP, title or badges).
- **Login streak modal** on app open (seven-day strip with XP per day and the
  milestone rewards); the login toast is gone.
- **Missions page**: weekly block featured beside a smaller daily block; the
  streak is one quiet line.
- **Challenges**: every card lists its three star requirements; locked cards keep
  their layout under a dark overlay with the rank emblem and the gate; the star
  track panel is gone, replaced by a **star reward modal** on a cleared run that
  earned new stars (with the next cosmetic milestone).
- **Road to Worlds hub v3**: the timeline block owns the clock with a strict
  hierarchy (Play/Pause primary · Skip to next stop secondary · +1 day
  tertiary); a pending insert takes the whole block over with icon-coded
  effects and blocks the clock; "What you can do today" and "Your edges" are
  gone — replaced by a **Squad block** (starter cards with OVR, archetype, age,
  phase, growth ETA; sub, coach, chemistry) and a **Training block** (today's
  status, this week's drill, scrim CTA, the edges). Finances at a glance in the
  side column. Leaving the hub pauses autoplay.
- **Preview tools** (dev + staging only): "Unlock every cosmetic" switch on the
  profile; a fictional 60-player leaderboard when accounts are disabled, plus
  `docs/sql/seed-staging-leaderboard.sql` for a real staging project.
- **Local amateur sides** are clickable in event lobbies (roster sheet) and
  carry regional names again (per-region banks, no numeric tags).

### Changed — rc.2
- Training screen: the week strip is a one-line status (the hub owns the
  calendar), "what your attributes do" is collapsed by default, the sticky
  advance bar is gone (the top bar has Play / Skip ahead).
- Finances screen: "Loans & debt" moved below the toolbox and folds away unless
  a loan is live.
- "Week N of 9 · days left" removed from the home and the profile (season
  length is not final).
- Leaderboard rows show the avatar in its frame (rank emblem small).

### Balance — rc.2
- `CAREER_INSERTS.chancePerWeek` 0.35 → **0.14** (~1.5 inserts per split).

### Changed
- **Docs slimmed for new chats:** `AGENTS.md` now opens with a "Context budget"
  section (orientation path, files to grep instead of read, output filtering);
  `docs/STATUS.md` and `docs/ROAD-TO-WORLDS-STATUS.md` rewritten as
  current-state-only (~550 / ~450 words, with a system → file map for career);
  the v2 plan gained a navigation header pointing at §6–§8 only.
- **Series simulation variety** (#114): a momentum bounce (`SIMULATION.momentumBounce` 1.5)
  for the side that lost the previous game, a `comeback` flag + narration note when the
  winner trailed by 2 games, and the scoreline flavour re-tuned (`SIMULATION.goals`).
  Measured on equal teams: 4–0 sweeps 43 % → 22 %; for a +6 favourite 7–0 games 24 % → <5 %
  while the series win rate stays 99.8 %. §25 anchors unchanged. **Golden master
  regenerated** (`regression.golden.test.ts`) for this deliberate change.
- Leaderboard category keys: `mmr` → `season_mmr` (Season Rating) as the headline board.

### Balance
- `SIMULATION.offenseWeight` / `defenseWeight` 0.5 (new); `ch-perfect-storm`
  opponent shift −8 → −9 (stays in the legend band).
- `CAREER_AGE.growthMult` 21-22 / 23-24 / 25+: 0.7 / 0.35 / 0.15 → 0.8 /
  0.45 / 0.2. `CAREER_TRAINING.coachMult` 0.01 / 1.2 → 0.015 / 1.3.
- Starter roster shapes: prospects 65-68 (pot 80-90), journeymen 71-74,
  balanced 68-71 (pot 76-84). Community Cups: ≤ 2 stronger orgs + local scene
  (−7..+1 band).

### Fixed
- Career market: with three starters signed and a free sub slot, the offer
  sheet refused every signing. Root cause: the role picker always reset to
  "starter" and the block message said "squad full"; it now defaults to the sub
  slot and names the real reason (starters full / sub taken / squad full).
- Career: the coach buttons on Squad, Training and the hub opened the market
  on the free-agents tab. They now deep-link to `/career/market#coaches`.
- **Bracket spoiler** (draft game `PlayoffBracketView` + career `CareerBracket`): when the
  user went out and the remaining AI rounds auto-resolved in the same step, the later rounds'
  pairings were drawn at once (scores hidden) — and the user's absence from them gave the
  animating result away. Root cause: pairings were shown for every simulated round. Now a
  round's pairings only show once every earlier round is fully revealed.

---

## [1.4.8] — 2026-11-05 · Inline email login

### Changed
- Announcement, header and home sign-in actions open a lazy-loaded email/code dialog in place. Successful authentication closes it and keeps the current route and run. Reopening an unfinished login resumes the code step; Profile reuses the same form.
- Email/code forms support native validation, keyboard submission, automatic dialog focus, keyboard containment and readable request errors. In-flight requests cannot be duplicated by repeated submissions.
- Initial English and saved language preferences are unchanged.

### Fixed
- Login calls to action previously navigated to Profile, interrupting the player's current screen and clearing an active run through the existing leave-run behavior.

---

## [1.4.7] — 2026-11-04 · Rocket Draft 2.0 announcement

### Changed
- Replace the Season 1 notice with a responsive 2.0 announcement: real rc.36.10 staging captures, Road to Worlds overview, expanded player/team database, five Regional Draft scenes, three-star challenges, missions/quiz/login cosmetics, season reset and pre-season titles/badges, and the existing profile sign-in action. English and Portuguese copy; signed-in confirmation remains conditional on the real account state.
- Show once per document load after the tutorial, including on refresh/reopening; navigating back home after dismissal keeps it closed. The old permanent seen marker is ignored; player save keys are unchanged.
- The announcement owns its portal, focus trap, Escape/backdrop dismissal and scrollable body with persistent close/account controls. Shared modals and game modes are unchanged. No staging code is merged.

---

## [1.4.6] — 2026-10-16 · Season 1 announcement

### Added
- **Season 1 announcement pop-up** on the home page (`src/components/screens/Season1Notice.tsx`, copy `HOME.season1` EN+PT). Opens once per browser, after the first-run tutorial: v2.0 is days away (brand-new career mode, expansions, improvements), the pre-season ends, and pre-season account holders get Season 1 rewards. Signed-out players get a "Create account / Log in" button (→ /profile); signed-in players see their rewards are secured. The seen marker is a plain localStorage key (`rd-notice:season1:v1`), outside the persist contract. Remove it when Season 1 ships.

---

## [1.4.5] — 2026-10-05 · Static relaunch (Cloudflare) + request/performance diet

> Branch `perf/static-cloudflare`, cut from `staging` @ `badd177` (v1.5.0-alpha.2), so it
> carries the Road to Worlds alpha below. The version number is still to be chosen.
> **Why:** production (Vercel Hobby, `main` @ v1.4.4) was disabled with HTTP 402 after it
> passed 3M requests in a month against the Hobby cap of 1M. The app has no server code, so
> it is now a **pure static export served by Cloudflare Workers Static Assets with no Worker
> script**. Static-asset requests there are free and not metered. Every page view also costs
> far fewer requests and bytes. No gameplay or balance changes.
> Gates (2026-10-03): `tsc` clean · **385/385** vitest · `npm run build` green (48 s; `out/`
> = 1,071 files, 35 MB) · lint at 5 errors + 1 warning, all pre-existing (TournamentScreen,
> AnimatedNumber, Modal, useMounted, calibrate-rarity), down from 9 errors / 4 warnings.

**Measured before/after.** Browser runs against the static export. "Before" is `staging`
@ `badd177` exported as-is with Cloudflare's default headers; "after" is this branch on
`wrangler dev`. Counts are requests to the site's own host.

| Scenario | Before | After |
| --- | --- | --- |
| Cold home view | 74–80 requests | **27** |
| Warm return to home | 80 (72 of them 304s) | **2** |
| Click home → `/play` | `/play.txt` 316 KB raw on a non-prefetched click (CSS inlined) | **3 requests**, `/play.txt` 11.5 KB raw |
| Full draft run (home → `/play` → draft → tournament → results) | 166, incl. 68 prefetch requests and 22 404s | **≤ 71**, incl. 42 distinct images and 0 404s |
| Home first-load JS + CSS | 544 KB gz for the JS alone (CSS was inlined into the HTML) | **344 KB gz** for JS + CSS |
| Home HTML | 504 KB raw / 27 KB br | **40 KB raw / 7.5 KB br** |

> **Correction to the [1.4.0] "edge-request diet" entry.** This file is append-only, so the
> old text stays. That entry named the Vercel Analytics / Speed Insights beacons and the
> `trackEvent` double-sink as the root cause of the launch blowup (~1.1M edge requests in 4
> days). The browser measurements and request accounting done for this release do not
> support that. The dominant multipliers were:
> - **`next/link` viewport prefetch**: ~4–5 requests per visible link. In the static export
>   it is exactly 5 (one HEAD and 4 segment `.txt` files), plus the route's JS.
> - **`/public` images served with `Cache-Control: max-age=0`**: every logo, flag and rank
>   icon was revalidated on every page load.
>
> The pre-v1.4 beacons were only **~7–20%** of edge requests: about 15 in a typical session
> and about 37 in a heavy one, against 150–200 other requests. Removing them was right, but
> it could never have kept the site under the cap. That fits the >3M recurrence on an
> unchanged `main` (no deploys since 2026-06-23).

#### Added
- **Cloudflare hosting config.**
  - `wrangler.jsonc` is assets-only: `assets.directory: "./out"`, no `main`, no
    `run_worker_first`. It sets `not_found_handling: "404-page"` and `html_handling:
    "auto-trailing-slash"`, so `/play` serves `play.html` and `/play/` or `/play.html`
    redirect to `/play`. It also sets `workers_dev: false`, `preview_urls: false` and an
    apex custom-domain route (`rocketdraft.app`).
  - `public/_headers` caches `/_next/static/*` and `/img/*` (content-hashed) as immutable
    for a year. The unhashed files get moderate TTLs: `/flags` 7 days; `/orgs`, `/cards`
    and `/ranks` 1 day; the icons and OG image 7 days; the manifest 1 day. Every response
    gets `nosniff` + `Referrer-Policy`. HTML and the `.txt` RSC payloads have no rule, so
    they keep the host default (`max-age=0, must-revalidate` + ETag) and a deploy shows on
    the next load.
  - `wrangler@4` is a new devDependency.
- **Build and deploy scripts.**
  - `prebuild` runs `validate:data && test:contract && build:images`.
  - `postbuild` runs `scripts/postexport.mjs`.
  - `preview:static` runs `wrangler dev` on `out/`. `npm start` now points to it, because
    `next start` does not work with `output: "export"`.
  - `deploy` runs `npm run build && wrangler deploy`. Its `predeploy`
    (`scripts/check-deploy.mjs`) refuses to run when `ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS` is
    set in the shell.
  - `.nvmrc` pins Node 24 for local dev and Workers Builds.
- **`scripts/postexport.mjs`** runs named steps after the export:
  - flatten the Windows `__next.*` segment folders (see Fixed);
  - strip `/career` when career mode is off;
  - check that every route has its `__PAGE__` prefetch file;
  - check that the required files exist;
  - check Cloudflare's limits (20,000 files, 25 MiB per file);
  - print a report.

  A broken export fails the build loudly; it is never shipped.
- **Build-time image pipeline** (DESIGN-DECISIONS #105). `scripts/build-images.mjs` (sharp) turns the drop-in PNGs
  into content-hashed WebP under `public/img/**` (git-ignored) and writes the committed
  `src/generated/asset-manifest.json`.
  - Sizes: org logos at 96 / 264 px, special photos at 256 / 512 px, rank emblems in a
    224 px box. Menu emblems stay at their 160 px source size.
  - It is deterministic and incremental. It prunes stale files, each URL hash covers the
    source bytes plus that category's encoder settings (see Fixed), and `--force` redoes
    the whole set.
  - Today it produces 496 WebP files (~7.0 MB) from ~24.3 MB of PNG sources.
- **`src/lib/assets.ts`** exports `flagSrc`, `orgLogoSrc`, `hasSpecialPhoto`,
  `specialPhotoSrc` and `rankSrc`.
  - In production they return the hashed `/img/…` WebP URL (or `/flags/<cc>.png`),
    percent-encoded, **and only for files that exist**. A missing asset therefore renders
    its fallback without any request.
  - In dev and test they return the raw PNG paths and treat every asset as present.
- **`src/lib/imageLoader.ts`** is a custom `next/image` loader. It maps
  `/cards/specials/<id>.png` to the 256 / 512 px WebP; `images.deviceSizes: [512]` and
  `imageSizes: [256]` make the srcset exactly 256w + 512w. Dev keeps `unoptimized` raw PNGs.
- **`AppLink`** (`src/components/ui/AppLink.tsx`) is a drop-in `next/link` wrapper that only
  prefetches on intent (see Changed). An ESLint `no-restricted-imports` rule now forbids
  importing `next/link` anywhere else.
- **Automatic `html.lite-fx` for weak devices** (DESIGN-DECISIONS #108). `SettingsEffects.tsx` applies it when
  `navigator.deviceMemory` is ≤ 2 GB or the OS asks for `prefers-reduced-motion`. Under it,
  and under Settings → Reduce motion:
  - panels, sticky bars, full-screen overlays and the modal scrim drop their backdrop blur;
  - surfaces that carry text get opaque fallbacks;
  - the infinite decorative loops stop (sheens, rarity halos, hue shifts, title glows, the
    legend border, the ray spin).

  Capable devices never get it.
- **`src/store/persistContract.test.ts`** (32 tests, DESIGN-DECISIONS #107) freezes the persist contract:
  - every key and version: `settings` unversioned, `profile` 11, `run` 3, `career` 3;
  - a `migrate` for every versioned store;
  - no `skipHydration`, and no unknown `rocket-draft:*` keys;
  - the `partialize` shapes.

  It also runs the profile migrate from every version 1–10 and checks real hydration
  end-to-end through an in-memory `localStorage`.
- **`src/data/validate.ts`** exports `validateDataset()`: schemas, duplicate ids,
  referential integrity and the rank check. `integrity.test.ts` uses it. The test also
  asserts that the runtime data deep-equals the zod output, so an undeclared JSON key now
  fails CI, and that no non-test file imports `zod`, `schemas` or `validate`.
- **Static `src/app/opengraph-image.png` (1200×630) and `apple-icon.png` (180×180)** replace
  the `.tsx` image generators. The alt text lives in `opengraph-image.alt.txt`.
- New tests: `src/lib/analytics.test.ts`, `src/lib/supabase.test.ts` and
  `src/store/accountStore.test.ts` (queueing and replay, tagged reads, sync gating).
- `postbuild` (scripts/postexport.mjs) now fails the build when `NEXT_PUBLIC_POSTHOG_HOST` or
  `NEXT_PUBLIC_SUPABASE_URL` is not an https URL or points at a loopback/localhost host. For
  local measurement builds against mock servers, set `ROCKET_DRAFT_ALLOW_LOCAL_ENDPOINTS=1` in
  the shell; env files are ignored for this flag. Such an out/ must never be deployed. Every
  build now logs whether accounts (Supabase) and analytics (PostHog) are ENABLED and where
  each value came from (shell or .env.local).
- `postbuild` checks that every image URL src/lib/assets.ts can request (each manifest org ×
  width, special × width, rank and flag) exists in out/, and fails otherwise.
- `npm run test:contract` (the persist-contract save gate) now runs in `prebuild`. Every
  `npm run build`, `npm run deploy` and Workers Builds deploy is blocked if a persist key,
  version, migrate, partialize or skipHydration change breaks existing saves.

#### Changed
- **Hosting moved from Vercel to Cloudflare Workers Static Assets as a pure static export**
  (DESIGN-DECISIONS #102).
  - `next.config.ts` sets `output: "export"`. Nothing that needs a server may be added:
    route handlers that read the request, rewrites, redirects or `headers()`,
    middleware/proxy, Server Actions, ISR.
  - `robots.ts`, `sitemap.ts` and `manifest.ts` are `force-static`; the manifest icon now
    points to `/apple-icon.png`.
  - `www` → apex is now a Cloudflare zone Redirect Rule (ops), not something in code.
  - The runtime image optimizer (`/_next/image`) and `minimumCacheTTL` are gone.
  - Removed: `@vercel/analytics`, `@vercel/speed-insights` and the 5 unused template SVGs
    in `public/`.
- **Internal links prefetch only on intent** (DESIGN-DECISIONS #103). All 43 links in 15
  files now use `AppLink`.
  - It renders `prefetch={false}` until the first real mouse hover (`pointerType ===
    "mouse"`) or keyboard focus (`:focus-visible`). After that, that link uses Next's normal
    prefetch.
  - Touch taps never prefetch, so a prefetch can't race the navigation.
  - Viewport prefetch had cost 5 requests per visible link plus route JS: 41–68% of
    own-host requests in the baseline runs.
- **`experimental.inlineCss` removed, which reverses [1.1.7]** (DESIGN-DECISIONS #104). The
  Tailwind CSS is 149 KB raw / 22.2 KB gz / 17.4 KB br, and inlining copied it into every
  HTML page *and* every RSC `.txt` payload. Measured with the option off vs on:
  - `index.html`: 42.2 KB raw / 7.8 KB br (was 488.6 KB / 27.4 KB)
  - `play.html`: 28.4 KB / 5.1 KB (was 474.7 KB / 24.7 KB)
  - `play.txt` (navigation payload): 11.8 KB / 2.6 KB (was 306.3 KB / 20.0 KB)
  - `out/`: 35.7 MB (was 80.0 MB)

  The cost is that a first visit now downloads 2 stylesheets (149 KB + 1.8 KB raw); after
  that they are cached as immutable.
- **Tailwind scans only `src/`** (`@import "tailwindcss" source("..")` in `globals.css`). The
  CSS went from 150,359 to 149,004 B, and 7 selectors no file in `src/` uses were dropped.
- **Asset consumers use the manifest.**
  - `TeamLogo`, `CountryChip`, `RankBadge`, GameCard's `SpecialArt` and the results share
    card now get their URLs from `assets.ts`.
  - Org logos pick their file by display size: ≤ 32 CSS px gets the 96 px file, anything
    larger the 264 px file. The `<img>` gets width/height, `loading="lazy"` and
    `decoding="async"`.
  - The share card draws the 264 px WebP logo.
  - `next/image` `priority` became `preload`. Next 16 deprecated `priority`; the behaviour
    is the same.
  - The failure-state resets that ran in `useEffect` are now derived state.
- **posthog-js (~75 KB gz) and @supabase/supabase-js (~61 KB gz) are dynamic `import()`s,
  out of every page's bundle** (DESIGN-DECISIONS #109).
  - PostHog loads after the window `load` event plus `requestIdleCallback` (3 s deadline,
    `setTimeout` fallback on Safari, 10 s cap if `load` never fires).
  - Until then, game events are queued (cap 50) with their original timestamps and
    `$current_url`/`$pathname`. SPA pageviews from before init are replayed the same way.
  - Supabase starts at page load only when a stored `sb-<ref>-auth-token` (or its
    code-verifier) or an auth-redirect URL is present. Guests download it only when they
    send a sign-in code, open the leaderboards, or sign in from another tab.
- **PostHog config**: `advanced_disable_flags: true` (no `config.js`, no `/flags`, no 5-minute
  polling; nothing in `src` uses flags) and `capture_pageleave: false` (no insight uses
  `$pageleave`). The unused `posthog-js/react` provider was removed. All other init options
  are unchanged (token, EU host, `defaults`, localStorage persistence name, DNT,
  history-change pageviews), so the anonymous distinct id survives the update.
- **Analytics discontinuity at the cutover: compare pre/post numbers with care.**
  - $pageview, unique-user and session counts dip by design. A visit that bounces before
    load + idle + chunk download now records no $pageview and no session; before, the first
    $pageview fired at hydration.
  - `$pageleave` is no longer collected, so PostHog Web Analytics bounce rate and session
    duration change for single-page sessions.
  - **UTM caveat:** a visitor who lands on `/?utm_source=…` and navigates inside the SPA
    before the SDK starts keeps the right landing `$current_url`, but the `utm_*`/`gclid`
    campaign properties are not attached to the person or session. Channel/UTM breakdowns
    undercount. No documented insight uses UTMs.
  - A few events can be lost if the tab closes in the seconds before the SDK arrives.
- **No runtime zod** (DESIGN-DECISIONS #106).
  - `src/data/index.ts` now serves typed casts of the JSON. Schema and integrity
    validation moved to `src/data/validate.ts` and runs in `npm test`,
    `npm run validate:data` and **`prebuild`**, so an invalid dataset still fails
    `npm run build`.
  - The `@/data` bundle dropped from 690 KB raw / 118.0 KB gz to 355 KB / 51.1 KB (zod plus
    the schemas were 66.2 KB gz).
  - Module init is ~60–80 ms less main-thread work (Node desktop medians 81.8–102.7 ms →
    21.4 ms; phones are slower in absolute terms).
  - The runtime output is identical to zod's, including stripping the undeclared `secret`
    key from 2 special cards. The only difference is key order in 68 records, which nothing
    depends on.
- **GeistMono `preload: false`.** It is redeclared through `next/font/local` with the same
  file, variable and fallbacks, which cuts font preloads from 5 to 4. The first `font-mono`
  text (region chips) can briefly render in `ui-monospace` until the font arrives
  (`display: swap`).
- **Career mode is env-driven** (`FEATURES.careerMode = NODE_ENV !== "production" ||
  NEXT_PUBLIC_CAREER_MODE === "1"`; ROAD-TO-WORLDS-DECISIONS R19).
  - It is off in production builds unless `NEXT_PUBLIC_CAREER_MODE=1` is set at build time,
    inline, for a local preview build only (never in `.env*` files or the production
    Worker's build variables). Dev and tests keep it on.
  - `src/app/career/layout.tsx` is now a server component: `robots` noindex/nofollow, plus
    `notFound()` when the flag is off. The client guard and UI moved unchanged into
    `CareerShell.tsx`.
  - `postexport` deletes `out/career*` when the flag is off. It loads `.env*` the same way
    `next build` does, and fails instead of deleting if the home page links `/career` or
    the sitemap lists it.
- **Career copy split out of the core dictionaries.**
  - `CAREER` is gone from `copy.en.ts`/`copy.pt.ts`. Career modules read
    `copy.career.{en,pt}.ts` through `useCareerCopy()` / `getCareerCopy()`
    (`src/content/careerCopy.ts`), and `useCopy().CAREER` no longer exists.
  - The core copy chunk on every page went from 149,573 to 76,854 B raw (55.2 → 28.6 KB
    gz).
  - The 4 home-card strings moved to `HOME.careerTitle/careerBadge/careerDesc/careerCta`
    with the same EN/PT text.
- **Body ambient glows moved to a fixed composited `body::before` layer.** They were on
  `background-attachment: fixed`, which repainted the whole page on every scroll frame.
  - Desktop and Android look the same: pixel diffs are ≤ 2/255.
  - **iOS Safari looks different while scrolled.** It ignores `background-attachment:
    fixed`, so before, its glows scrolled with the page and repeated every viewport height.
    Now they stay fixed to the viewport, as on other browsers.
- **Reduce motion now also removes blur.** Players with Settings → Reduce motion or the OS
  reduced-motion preference get the lite-fx look: no blur, opaque bars.
- **Generated image widths have a single source of truth.** scripts/build-images.mjs writes
  `widths` into src/generated/asset-manifest.json, and src/lib/assets.ts derives
  ORG_LOGO_WIDTHS and SPECIAL_PHOTO_WIDTHS (now `readonly number[]`) from it, choosing the
  smallest width that covers the request: 3× density for logos, so ≤ 32 CSS px still gets
  the 96 px variant.

#### Fixed
- **22 guaranteed 404s per draft run, re-fired on every card mount.** In the measured run, 9
  came from region flags (`/flags/na.png` and similar) and 13 from the 2 logo-less orgs that
  showed up. The 3 photo-less specials also 404'd whenever they were shown. Each 404 returned
  the full ~490 KB 404 page. In production, missing
  assets now render their fallback (text chip, monogram, CSS emblem, stylized art) with no
  request. Root cause: `TeamLogo`, `CountryChip`, `RankBadge` and `SpecialArt` built asset
  URLs blindly and relied on `onError`, and that failure state lived per mount. The fix
  decides from the build-time asset manifest.
- **A special card's photo fallback could stick after the card changed.** Root cause:
  `SpecialArt`'s `failed` flag was component state that was never reset for a new card. It
  is now derived from the URL that failed.
- **Windows-built static export: page prefetch files written to the wrong path.** Every
  `__PAGE__` prefetch for those routes 404'd (7 404s / 3.3 MB on one cold home view). Root
  cause: Next's export builds the segment-file path with `path.relative`, which uses
  backslashes on Windows, while the segment encoder only replaces `/`. The files were
  written as `X/__next.X/__PAGE__.txt` instead of `X/__next.X.__PAGE__.txt`. `postexport`
  now flattens them (55 files in 37 folders on this build) and checks every name against
  Next's own encoder. It does nothing on Linux.
- **Duplicate favicon/icon links in `<head>`.** Root cause: a manual `metadata.icons` entry
  in `layout.tsx` on top of the `favicon.ico` / `icon.svg` file conventions. It is removed.
  Next only emits the file-convention icons (including `apple-touch-icon`) when
  `metadata.icons` is unset.
- **Cloud sync could overwrite the cloud backup after a failed read.** Root cause:
  `fetchCloudRow` returned `null` both for "no row" and for "error", so the push went ahead.
  The read is now tagged (`ok` / `no-row` / `error`), and an error aborts the sync with
  nothing merged or pushed.
- **Cloud sync ran up to 3 times per page load and again on every tab refocus.** Root
  cause: every auth event, including `TOKEN_REFRESHED` and the refocus `SIGNED_IN`, called
  `syncNow`, and `init` also called it through `getSession`. Now only one sync runs at a
  time per user. It runs once per page load per signed-in user (`INITIAL_SESSION` / first
  `SIGNED_IN`). A failed sync may be retried by a later `SIGNED_IN`.
- **Cloud sync could revert progress made during the cloud read.** Root cause: the local
  snapshot was taken *before* the read, and sync did not wait for the profile store to
  hydrate. The snapshot is now taken after the read, and sync waits for profile hydration.
- **`/career` was exported with HTTP 200, `index, follow` and canonical `/` even with the flag
  off.** Root cause: the only gate was a client-side `useEffect` redirect in
  `career/layout.tsx`, and a static export writes every route. The fix is the server
  layout with `notFound()` + noindex, plus the `postexport` strip.
- **The legendary cursor-holo hue shift (`.holo-rainbow-legendary`) kept animating with
  Reduce motion on.** Root cause: the class was never added to the reduce-motion selector
  lists.
- **Lint.** 3 `react-hooks/set-state-in-effect` errors (TeamLogo, RankBadge, Badge) are
  fixed; root cause: failure state was reset inside effects, and it is now derived. Also
  fixed: `prefer-const` and unused imports/vars in `careerV03.test.ts` and `careerFlow.ts`;
  root cause: leftovers from the v0.3 pass.
- **Cloud sync: a signed-in player's progress reaches the cloud backup and their leaderboard
  row again during a session.** A debounced push (`CLOUD_SYNC.pushDebounceMs`, 4.5 s after
  the last profile change, or at once when the tab is hidden) runs the guarded sync only when
  the durable profile differs from what this tab last pushed. Refocus `SIGNED_IN` and
  `TOKEN_REFRESHED` still don't sync. Root cause: the NET-2 once-per-page-load hardening
  removed the refocus/token-refresh syncs, which had been the de-facto in-session push,
  without adding the planned post-run push, so a session's progress stayed local until a
  full reload.
- **Display name: the cloud name is shown as soon as the read succeeds**, and an aborted sync
  (read error, push error, unexpected error) keeps the shown name or falls back to the email
  prefix. A late sync never shows a name after a sign-out or user switch. Root cause: the new
  abort paths returned before the only `set({ username })`, so a signed-in player could see
  no name and no rename pencil (v1.4.4 always set one).
- **Cross-tab: a sync folds the profile currently saved in localStorage into its local
  snapshot** with the monotonic `mergeProfiles`. Storage that is unreadable or holds another
  schema version is ignored. Root cause: zustand persist never re-reads storage, so an idle
  tab woken by a sign-in in another tab merged and wrote back its page-load profile, which
  could overwrite the other tab's newer save.
- **A sync that finishes after a sign-out no longer marks the user as synced for this page
  load.** Root cause: `syncedThisLoad.add` ran unconditionally, so signing back in during the
  same page load skipped the sync.
- **WebP URLs now change when encoder settings change.** Root cause: the `/img/` file hash
  covered only the source PNG bytes, so changing quality or the rank box size re-encoded files
  under the same `immutable` URLs, and the node_modules/.cache settings stamp was lost on
  `npm ci`. Each category's encoder settings (ORG_WEBP, SPECIAL_WEBP, {box, RANK_WEBP}) are
  now part of its hash, and the stamp is removed. All /img/ URLs changed once; none had been
  served in production yet.

#### Known limitations / follow-ups
- **Touch devices never prefetch.** A tap fetches the route's `.txt` and JS on demand: one
  small request, but a little less instant than a prefetched link.
- **No deploy-skew protection** (Vercel had it). A long-lived tab can 404 on a chunk that a
  new deploy deleted, including the lazy Supabase/PostHog chunks. The leaderboard then shows
  empty and sign-in shows the generic error until the user reloads. Possible mitigation
  (not done): keep the previous build's `_next/static` in each upload.
- `/play/` and `/play.html` redirect with **307** (Vercel used 308). Minor SEO difference.
- `_headers` rules also apply to 404s and redirects (a 404 under `/flags` would be cached
  for 7 days). Production code no longer requests missing files.
- A PNG dropped into `public/` reaches production only after the next `npm run build`
  (`prebuild` regenerates the WebP files and the manifest). Dev shows it immediately. Always
  build through `npm run build`: a bare `next build` skips data validation and image
  generation.
- 404s under `/_next/static/*` and `/img/*` inherit the `immutable` Cache-Control from
  `public/_headers`, so those URLs must never be reused for different content. The image
  hash now covers the source bytes plus the encoder settings (see Fixed).
- **Signed-in "Reset all progress" is restored from the cloud by the next sync** (the merge is
  monotonic), now about 4.5 s later. Product decision pending: hide the reset for signed-in
  players, or reword its copy.
- A rename that lands between a background sync's cloud read and its upsert can be reverted
  in the cloud. The window is pre-existing; the debounced push makes it more frequent.
- Content pages (`/about`, `/faq`, …, `/pt/*`) emit no `og:image`. This is pre-existing and
  unchanged; their `openGraph` objects replace the root's without inheriting its images.
- Ops before cutover:
  - `wrangler login`;
  - the `rocketdraft.app` zone active on Cloudflare, with the old Vercel apex record
    removed (the custom-domain route fails until then);
  - the `www` → apex Redirect Rule;
  - `NEXT_PUBLIC_*` and `GOOGLE_SITE_VERIFICATION` available at build time (`.env.local`
    for a local `npm run deploy`, Build variables for Workers Builds).

---

## [1.5.0-alpha] — UNRELEASED · "Road to Worlds" (awaiting Miguel's review — staging)

### v0.3 adjustment pass (2026-07-11 — Miguel's second playtest list)

#### Added
- **FIFA-style autoplay.** The primary Advance control is now ▶/⏸: the calendar rolls one
  day at a time (`CAREER_PLAYBACK.autoAdvanceDayMs`), pausable on any day, and the autopilot
  pauses ITSELF at every stop (matchday, fresh invite, window Monday, pending decision,
  season end). "Skip ahead" keeps the old batched advance as the secondary action. Works from
  every career screen (TopBar) — Training also gained its own advance footer.
- **Career popup layer** (`CareerToaster` + store toast queue): fresh mail and
  priority-2+ news pop as tap-through toasts (incoming bids, contract warnings, player
  unavailable, unlocks, scrim results, the window report) — the world talks while autoplay runs.
- **Scrims v2 — schedulable sparring.** The Training screen picks the OPPONENT (6-org
  nearest-strength shortlist with rating gap + engine-truth benefit preview via
  `scrimProjection`) and can BOOK scrims ahead (`scheduleScrimFlow`; they run automatically on
  arrival, appear on the calendar as training events, and land in a per-game result log
  `save.scrimLog` with game-by-game scores). The same org can never be scrimmed twice on one
  day (`sameDay` guard + indexed seed streams `scrim:{s}:{d}:{n}`).
- **Salary negotiation (sign + renew).** Every ask now carries a hidden deterministic
  reserve (uniform in [0.88, 1] × ask per player/window — `CAREER_NEGOTIATION`): counter-offer
  below the ask with the TRUE accept odds shown (the uniform CDF, no lying UI); rejections
  harden the ask +4% (telegraphed) and after 2 the player only signs at full price this
  window. Reserve fixed per window → save-scumming buys nothing. Supersedes design §21.4's
  fixed-ask-only market (recorded in DESIGN-DECISIONS).
- **Visible rep-gated signings.** New signings accept only up to
  `signableCapBase + signableCapPerRep × rep` (74 + 0.3/rep, uncapped at 84 rep): locked
  market rows stay VISIBLE with the reputation they need ("Signs at N reputation") — the
  climb is the content. Renewals and the current squad are always exempt. Coach hiring is now
  earned at rep 10 (`CAREER_UNLOCKS.coachRep`, announced as an unlock crossing).
- **Org sheets.** Any AI org's roster (spoiler-safe views: name/age/OVR/archetype), coach,
  stars and Season Points — tappable from standings rows, the event lobby field, the deals
  tab and the transfer wire.
- **The transfer wire + window report.** Every AI move, user deal and scripted-beat transfer
  lands in `save.transferLog` (ring 150); the HQ shows a region-filterable window panel, and
  the first Monday after a window closes mails a **window report** (move count + top fees).
- Save v3 (`migrateSaveToV3`, additive): `scheduledScrims`, `scrimLog`, `transferLog`,
  `negotiationTries`, bid bookkeeping. Persist version 2 → 3; in-place, never a reset.
- 19 new engine/store tests (`careerV03.test.ts`) locking the pass's behaviors.

#### Balance
- **Training anti-stagnation:** weeklyBase 0.10 → **0.13**; headroomSoftK 4 → **2.5** (the
  h/(h+K) collapse near potential was the visible "my player stopped growing"); age 21-22
  growth 0.6 → **0.7**, 23-24 0.3 → **0.35**; season/split caps 6/2.5 → **7/3**; committed-
  event weeks now train at **matchPrepShare 0.5** instead of freezing (playing weak
  unofficials was a development TRAP — slower than skipping them).
- **Early reputation floor:** a regional swiss exit now pays **+1 rep** (`regionalSwissExit`),
  unofficial finals pay **+1** (`t3Final` under the split cap, `t2Final`) — an 0-3 Swiss
  season 1 still climbs toward the first gear unlocks instead of soft-locking at rep 5.
- **Economy recalibration:** ONE market value for everyone
  (`marketValueFor` = person-neutral salary curve × 3.2) now anchors every fee — AI↔AI trade
  fiction (±15% band), AI bids for user players (×1.0-1.35) and user buys (bounded contract
  load 0.85-1.6×) — replacing the ask × synthetic-splits formula that priced same-OVR players
  up to 6× apart. **Prize pools grow ×1.12^season** and **sponsor tiers ×1.10^season** (new
  deals) — the income side finally outpaces the 1.08^season salary inflation.
- **Living market:** mid-window move rate 0.25 → **0.35**; **40% of needs-pass moves now shop
  a lower-rated org's player** (fee trade, like-for-like guard) instead of only draining the
  FA pool; a new **scavenger pass** picks displaced quality out of free agency (edge ≥ 3) so
  good players stop rotting there.
- **Incoming bids:** can land on ANY window day (daily roll: base 5.5% + 3%/star ≥82 +
  2%/developing prospect, cap 18%/day, max 2/window, 2-day cooldown) and target selection is
  attractiveness-weighted — AI GMs also hunt your prospects, not only your best player.
- **Fictional players:** ALL fic/rook ids now develop at every rollover (previously only
  market-touched ids ever grew — fillers never reached potential); wonderkid chance 5% → 8%;
  **10% headliner chance** gives one filler org slot a 77-84 base roll (texture in thin
  regions without early superteams; creation range for the rest stays 64-80).
- Scrim rewards: chemistryCredit 0.04 → **0.05**, xpWeeks 0.4 → **0.5** (booking sparring
  must be visibly worth the click).

#### Fixed
- **Backer debt lock (the "sold a player, still trapped" bug).** Root cause: the only code
  path that ever reduced `loan.remaining` was the prize garnish in `applyPrize` — player-sale
  fees went through a plain `transferIn` ledger push, so selling your star paid NOTHING and
  the org stayed locked out of fee transfers/gear for seasons. Now: sales amortize **50%**
  of the fee automatically (`applyTransferIncome`), and Finances has a manual **"Pay down
  debt"** (any amount, `payDebtFlow`) — clearing the debt lifts the lock immediately, with a
  "debt cleared" mail/news beat.
- **Training stagnation at zero.** Root cause: per-tick gains quantized with `floor2` — any
  daily gain below 0.01 OVR (age 21+, near-potential, no coach) floored to literal 0 forever;
  the accumulators and overall also rounded at 2 decimals, compounding the freeze. Ticks now
  quantize at 4 decimals (`floor4`/`round4`) — slow developers crawl instead of flatlining.
- **Same-day scrim rematch.** Root cause: the opponent pick was seeded per (season, day) with
  no memory — the second block on one day always drew the same pool and often the same org.
  Picks now exclude today's opponents and the seed stream carries the block index.
- **Ambitious-renewal threshold hardcoded at 88** in `renewPlayerFlow` — moved to
  `CAREER_SALARY.ambitiousOverall` (the "every tunable in balance.ts" rule).
- **Mobile: screens keeping the previous scroll position.** Root cause: Next.js preserves
  scroll on client-side navigation; the career layout now resets to top on every pathname
  change.
- Money params in mail/news bodies (`fee`, `bonus`, report fees) now render formatted
  (`formatMoney`) instead of raw integers.

---

### v0.2 overhaul (2026-07-09/10)

#### Added (v0.2 overhaul pass, 2026-07-09/10 — Miguel's playtest feedback)
- **Day-based calendar (FIFA-career style).** The clock is now the DAY: `clock = {seasonIndex,
  day}` over 224 days (7-day Monday-start weeks on the same 32-week grid — seed streams stay
  week-keyed, so all determinism holds). Real calendar dates per season (Season X kicks off
  Mon 2020-10-05; `CAREER_SEASONS[i].startDate`). Weekly world processing on Mondays, training
  Mon-Fri, matchdays on Saturdays, Sundays rest; transfer windows are day ranges with a
  days-left countdown. Continue advances to the next stop (matchday / window-open Monday /
  pending decision) and "advance one day" is always available; official matchdays block the
  clock until played or simmed, and skipping past an unofficial matchday declines the invite.
  Saves migrate in place (v1 week → v2 day, `migrateSaveToV2`).
- **Scrims — things to do between events.** Up to 2 weekday scrim blocks per week: a seeded
  Bo5 behind closed doors vs a nearby-strength org from your region, granting a small
  chemistry credit + light match XP (`CAREER_SCRIM`, `runScrimFlow`), reported on the wire
  with the score.
- **Gear & staff progression ladder** (replaces the generic 3-level facilities): pro
  peripherals → 240Hz monitors → tournament PCs → bootcamp → structured bootcamp → sports
  psychologist → Performance Center, each rep-gated and bought strictly in order
  (`CAREER_GEAR`, `buyGearFlow`); training bonuses stack to +35% and PCs/Center feed the org
  buff levels. **Sponsor perks**: tier 2+ deals discount gear (20/35/50%), tier 3+ include
  free bootcamps (1-2/season) — a reason to chase tiers beyond the base check.
- **Coach market with real names.** Coaches are hired from a Market shortlist mixing REAL
  retired pros (fed by the world's retirement flow; coach OVR = 55 + 0.25 × final playing
  OVR) with generated candidates (`CAREER_COACH_MARKET`, `coachCandidatesFor` in market.ts);
  hires validate the shortlist and replacing a coach pays one split of severance.
- **Inbox (mail) split from the news wire.** `save.mail` (MailItem, per-item read state):
  transfer bids, sponsor offers/settlements, contract notices, backer events and unlocks now
  land as e-mails addressed to the manager with full body text; the news feed (every template
  now with a 1-2 line body, `news.body.*` EN+PT) moved onto the HQ dashboard.
- **Training v2.** Per-player session INTENSITY (light 0.6× / normal / heavy 1.35×, heavy
  adding a small telegraphed pre-event absence risk), truthful engine-side projections
  (`trainingProjection` — the Training screen no longer re-implements engine math), and daily
  ticks aligned to the day clock.
- **Career event playback pacing group** (`CAREER_PLAYBACK`) + rebuilt event screen (live
  spoiler-safe Swiss standings, playoff bracket, AI ticker, goal-by-goal user series, working
  speed/skip/sim controls, instant → animated digest), wiring the previously-dead
  `eventPlayback.ts` view-model.
- **Procedural crests for filler orgs + crest builder v2**: crestId now encodes
  `shape[:symbol[:pattern]]` (legacy ids still render identically); every generic org gets a
  deterministic logo via the shared `OrgMark` dispatcher.

#### Balance (v0.2 economy rescale — the garage-org start)
- Starting budget **$150k/100k/60k → $20k/12k/8k**; salary curve anchor **$8k → $1.5k** @ OVR
  70 with growth **1.13 → 1.20**/pt and floor **$2.5k → $250** (entry salaries land in the
  hundreds; a 90-OVR star still asks ~$57k/split — progression IS the product); prize pools
  t3 $5k→$2k · t2 $25k→$10k · regional $100k→$40k · major $300k→$150k · worlds $1M→$600k;
  sponsor bases $8k/20k/45k/90k → $1.5k/6k/18k/45k; transfer fee floor $10k→$2.5k; scout
  report $10k→$2.5k; stand-in $5k→$1k; Backer floor −$20k→−$5k (rescue to +$3k); money
  quantum $250→$50.
- **Team stars recalibrated (again):** 0-4★ absolute band → **0-5★ half-star steps driven by
  world-percentile** (0.8 × rating percentile + 0.2 × prestige) — strong teams now always
  read strong; org rating snapshots persist for cheap user-side reads (`userStarsFor`).
- **Chemistry swap-drop softened:** new `newcomerGraceFactor` 0.35 — a newcomer's pairs
  inherit part of the incumbent core's tenure, so one swap dents chemistry (~85% → ~60%)
  instead of halving it; `maxRawPerPair` 6.5 → 6.0 keeps Perfect reachable.
- **Training focus rebalance:** single-attribute focus overall share 0.7 → **0.9** (+ offset
  0.3 → 0.35/wk) so specializing finally competes with balanced; `auto` = coach plan at 0.95
  (falls back to balanced with no coach — the old double penalty is gone).

#### Fixed (v0.2)
- **Training gains double-counted toward the split/season caps.** Root cause: the weekly
  training loop applied `trainWeek`'s returned accumulators AND re-added the gain on top
  (`p.gainedThisSplit += res.gained` after `Object.assign`), so caps triggered ~2× early.
  The day-tick rewrite applies the returned player verbatim.
- **Event screen score orientation.** `GameResult.score` is `[winnerGoals, loserGoals]`, but
  the old screen padded it as `[teamA, teamB]` — losses could render as fake ties with
  phantom goal-feed entries (the "confusing" bug). The rebuilt screen uses the
  `eventPlayback.goalTimeline` view-model, which orients via `winnerTeamId`.
- **Instant-sim trap**: choosing "Instant result" dropped the user into manual playback with
  a hidden exit (up to ~16 clicks). `watched:false` now routes straight to the digest.
- **Sale fees no longer inflate the "biggest signing" record** (`resolveAcceptedBid` wrote
  sale proceeds into `stats.biggestSigningFee`).
- **Nondeterministic news ids** (`Math.random`) replaced by a per-save monotonic `seq` —
  identical runs now produce byte-identical saves.
- Offer expiry is day-accurate (`resolveDay` = window close), replacing the engine-hardcoded
  `WINDOW_LAST_WEEK` table.

#### Added
- **Road to Worlds — the career mode (design: `docs/ROAD-TO-WORLDS-DESIGN.md`).** Found an org
  at RLCS Season X, sign and develop players (age + hidden potential shown as a scouted band,
  RL-realistic ages: debuts 13-15, careers end ~24-25), manage budget/sponsors/reputation
  through a 32-week season calendar (3 splits × [3 regionals + 1 Major] + Worlds; Season
  Points → Major/Worlds qualification with per-region slot tables), transfer windows with a
  living AI world that drifts toward real RLCS history (anchor-fidelity market passes +
  ~26 hand-written scripted news beats EN/PT — e.g. Vitality signing zen in 2024, degrading
  into a Blockbuster bid if you own him), weekly training with delegate-to-coach fast path,
  field-quality-scaled match XP, roster-stability rule (tiered; the original hard forfeit one
  flag away), progressive unlock ladder (psychologist → facilities → bootcamp → relocation
  teaser), cosmetic 0-4★ team ratings, one-rescue Emergency Backer (second bankruptcy ends
  the career), endings (Worlds title credits / 2026 Final Whistle / Insolvency) + infinite
  procedural era. New: `src/engine/career/*` (7 pure modules + 123 tests incl. a
  full-season deterministic integration harness), `careerStore`/`careerFlow` (3 save slots,
  `rocket-draft:career:v1`, additive migrate), `/career/*` routes + 13 screens with animated
  per-game event playback (goal-by-goal, scorer names), `CAREER_*` balance groups, EN+PT
  career copy, career data files (beats/sponsors/names/crests). Behind `FEATURES.careerMode`.
- **Engine (additive only, goldens locked):** `assembleTournamentTeam` export with in-memory
  org override + bounded `ratingBonus` + `chemistryOverride` channels; `initFieldTournament`
  (explicit-field Swiss/single-elim, AI-vs-AI capable); `regression.golden.test.ts` pins the
  shared sim pipeline's draw order so career work can never silently reshuffle existing modes'
  fixed-seed content (challenges/daily untouched — full 249-test suite green).

#### Fixed (v0.1 adjustment pass, 2026-07-09 — pre-review)
- **CRITICAL: releasing/selling a squad player crashed the whole career and corrupted the
  save.** Root cause: `releasePlayerFlow` filtered the player out of `squad` but left his id
  in `starterIds`; `userTeamFor` maps `starterIds` on every top-bar render and threw
  "starter … is not on the squad", crashing the `/career` layout so hard the player couldn't
  even reach the reset. Fix, three layers: a `syncSquadRoles()` invariant (starterIds always
  hold 3 on-squad ids, roles synced) called after every squad mutation; `userTeamFor` now
  degrades a missing starter to the sub → an emergency stand-in instead of throwing; and
  `careerStore.onRehydrateStorage` self-heals every slot on load so already-corrupted saves
  recover. Regression-locked in `careerFlow.test.ts`.
- **New squad started at 100% chemistry.** It leaked through a shared `career:org` id feeding
  `computeChemistry`'s shared-org + org-loyalty. Chemistry is now EARNED over time
  (`worldSim.careerChemistry` + `CAREER_CHEMISTRY`): a fresh same-region trio ≈ 23%, climbing
  to High after ~2 splits; swapping a starter drops it.
- **Sponsors were offered on day 1.** Gated behind `CAREER_SPONSOR.firstOfferRepGate`.
- **Team stars miscalibrated** (elite orgs read as 2★). `starsFor` now uses an absolute
  rating band + prestige, not intra-region percentile.
- **Career nav disappeared in the inbox** — `"/career/news".startsWith("/career/new")` matched
  the bare-route prefix; now exact-matched.
- **Removed** the "reputation expects it (−N)" hub line; **forced manual training when no coach
  is hired** (delegating to a nonexistent coach made no sense).

## [1.4.4] — 2026-06-23 · "World Stage" patch

#### Balance
- **MMR per-title award re-tuned (#101).** Normal **1 → 2**, Hard **3 → 5**, Legacy finalist
  **5 → 4**; Easy (+1) and Legacy title (+9) unchanged. Hard now reads as real prestige, and a
  *lost* Legacy grand final sits a notch below a Hard title won. Win-only economy + saturating
  backfill unchanged (#82). **Forward-looking:** `mmrRawGain` uses the new table for live gains;
  existing profiles already backfilled at v11 aren't recomputed (MMR is cosmetic, never lost,
  cloud-merge max — not worth a re-base). `balance.ts`. (And yes — Hard wins *did* already award
  MMR; this just raises Hard from +3 to +5.)

#### Changed
- **Header rank emblems normalised to a consistent visual size.** The `menu` rank PNGs are all
  160×160 but fill their canvas by very different amounts — gold's solid triangle covers ~47% of
  pixels, Supersonic Legend's airy winged emblem ~25% — so under `object-contain` the heavier
  ranks rendered visibly oversized next to the profile in the header. Each menu rank now carries a
  per-rank scale (√ of its opaque-pixel area vs Supersonic Legend, the reference "right" size,
  clamped to ≤1), so every emblem reads at SSL's weight. The reserved layout box is unchanged, so
  there's no layout shift. The profile art set was already uniform (~0.30 coverage) and is
  untouched. `RankBadge.tsx`.

#### Fixed
- **Rank-up ceremony didn't play on the results screen after a mid-run rank-up.** If an
  achievement earned MID-run pushed you across a rank threshold, its XP was applied to the profile
  live — so the results screen's baseline (`xpNow − results.xp.total`) already contained it, saw no
  rank change, and skipped the ceremony. The run now stamps `xpAtStart` (profile XP the instant the
  run was created) and uses THAT as the rank-up baseline, so the run's whole XP gain — mid-run
  feats, end placement, counter achievements — fires the ceremony on results no matter when each
  piece landed. Root cause: the baseline subtracted only the run-results XP figure, but mid-run
  achievement and post-run counter XP are applied outside it. `runStore.ts`, `ResultsScreen.tsx`,
  `engine/types.ts`.

---

## [1.4.3] — 2026-06-23 · "World Stage" patch

#### Balance
- **Legacy SAM re-anchored to the ~95 ceiling (#99).** Feedback: SAM Legacy was too easy —
  you could reach/win the grand final with "not so strong" teams (the strongest SAM roster
  ever built is **95**). The TITLE rate looked fine, but the **reach-the-grand-final** rate was
  the tell: at boost 2.8 a 90-91 team made the final in **32%** of runs and a 92-93 in **68%**.
  `REGION_LOCK.opponentRatingBoost.legacy` 2.8 → **4.0** (effective shift 4.10 → 5.30). New SAM
  curve (`difficulty.sim.test.ts`, title / reach-final): 88-89 ≈ 0.6% / 2%, 90-91 ≈ 3% / 14%,
  **92-93 ≈ 13% / 48%**, the **94-95 ceiling ≈ 32% / 87%**, blended ≈ 10% / 34%. Non-elite is
  walled out; the best-possible team keeps a real, satisfying shot. WW Legacy unchanged.
  Root cause of the ease: the v1.4 +6-SAM-teams pass raised the achievable draft ceiling to ~95,
  but the SAM curve had been measured by *title* rate only — which stays modest even when a weak
  team reaches the final and loses, so "made the final far too often" was invisible. The harness
  now logs reach-final % too. `balance.ts`, `difficulty.sim.test.ts`.

#### Changed
- **Difficulty sim harness now logs reach-the-grand-final % alongside the title rate**
  (`curve()` in `difficulty.sim.test.ts`), and takes an optional `boostOverride` so SAM boosts
  can be swept without editing `balance.ts`. SAM assert band retuned to the boost-4.0 curve
  (92-93 0.05–0.22, 94+ 0.18–0.45 + monotonic at the top).
- **`profileStore.collectSpecials`** — a standalone "add these fielded specials to the
  collection" action, so the Challenge flow can unlock its drafted specials the same way a
  normal run does. New regression test `store/runStore.challenge.test.ts` (the first store-level
  test) drives the real `playChallenge` and asserts the collection.

#### Fixed
- **Special cards drafted in a Challenge never reached the Collection (#100).** Feedback: specials
  unlocked in challenge mode didn't show up in the collection. Only the challenge's **reward**
  special was persisted (`completeChallenge`); the specials you actually drafted and fielded were
  dropped on the floor. A normal run collects every drafted special via `compileResults` →
  `applyRunResults`, but the challenge path (`playChallenge`) only ran the reward funnel. Now
  `playChallenge` also calls `collectSpecials(user.specialIds)` — **win or loss**, mirroring a
  normal run. Root cause: challenge clearing reused the reward-only one-and-done funnel and never
  had the drafted-special collection step that the tournament results path provides.
  `store/runStore.ts`, `store/profileStore.ts`.

---

## [1.4.2] — 2026-06-22 · "World Stage" patch

#### Balance
- **Legacy SAM hardened at the top (#98).** Playtest showed the SAM ceiling was far too
  easy after the v1.4 +6-SAM-teams pass: those teams (kv1 88, drufinho 87, …) + chemistry
  raised the ACHIEVABLE ceiling well above 93, and at boost 1.65 a 92-93 team won ~36% and
  the new **94+ pinnacle won ~61%** (Miguel went champion with 93 AND 95 rosters back to
  back). `REGION_LOCK.opponentRatingBoost.legacy` 1.65 → **2.8** (effective shift 2.95 →
  4.10). New SAM curve (`difficulty.sim.test.ts`): 88-89 ≈ 1%, 90-91 ≈ 6%, **92-93 ≈ 22%**
  (a 93 wins ~1-in-5), **94+ pinnacle ≈ 47%** (rewarding, like the worldwide 98+ ≈ 42%),
  blended ≈ 18%. WW Legacy unchanged. Test band retuned (92-93 0.15–0.35, + a 94+ < 0.6
  guard). `balance.ts`, `difficulty.sim.test.ts`.

---

## [1.4.1] — 2026-06-22 · "World Stage" patch

A small post-launch patch (player-reported fixes).

#### Fixed
- **Achievement "Reunion" was unobtainable.** It asked for three players from the same
  LINEUP, but the draft offers each lineup at most once (`shownLineupIds`), so you can
  never field three cards of one lineup. Now it's three from the same ORG — reachable
  (different NRG / Vitality seasons share an orgId; 30 worldwide orgs have ≥3 lineups).
  Root cause: the condition keyed on `lineupId`, which the draft mechanic makes unique
  per pick. `engine/achievements.ts`, `achievements.json`.

#### Changed
- **Team "Bigode" → "Bigodes"** (correct name); orgId `bigode` → `bigodes`. `teams.md`.
- **royales "NRG beater" flavor reframed** around the single GAME royales won off NRG,
  not the series. `specialCards.json`.

---

## [1.4.0] — 2026-06-22 · "World Stage"

> Big release: email-code login + cloud sync + leaderboards, a rank-unlocked
> Challenges mode, a special-card rarity rework, an International-Majors + SAM
> expansion, and a visual / mobile / Core-Web-Vitals pass. Codename **World
> Stage**. Prepared for `main`; reviewed before it ships.

### "World Stage" — v1.4.0 final pass (2026-06-22)

The closing pass before v1.4.0 ships to `main`: 6 more SAM teams, two new
specials, a Legacy difficulty nudge, a Collection that defaults to the official
catalogue, the mobile **CLS hard-fail** fix, and a Vercel build-reliability fix.

#### Added
- **6 more SAM-only teams** (regional pool, `sam-only, legacy`): **Black Dragons**,
  **Cadê Meu Boost**, **NoX Gaming** (S1 · 2016) and **BS+Competition**, **Bigodes**,
  **Plot Twist** (2026). 8 brand-new people (Freedom, Godan, Krames, DuO, TheKillah,
  Zé, Saladk1ng, MagoMagnífico) with nationalities; the rest reuse existing SAM
  people (sosa reuses the existing person by direction). lineups 283→**289**, players
  397→**405**, orgs 142→**148**. `teams.md`, `build-dataset.mjs` (COUNTRY).
- **2 new rare specials**: **royales — "NRG beater"** (87, base Plot Twist 2026) and
  **freedom — "OG Brazil Goat"** (89, base Black Dragons 2016). 93 specials total.
  `specialCards.json`. Royales art dropped in; `sp-freedom-og-brazil-goat.png` still
  pending (styled fallback renders meanwhile).

#### Changed
- **Collection shows the OFFICIAL catalogue only by default.** The 5 special-person
  cards (creator / wings / community) no longer appear as locked silhouettes nor count
  toward the total — they show and increment the total only once OWNED, so the
  denominator reads the official count (**88**) until one is unlocked. New
  `isSpecialPersonRarity` engine helper; `CollectionView` derives a `collectibleCards`
  set that every total reads from. `engine/cards.ts`, `app/collection/CollectionView.tsx`.
- **Self-hosted fonts** — Geist + Geist Mono via the official `geist` package, Rajdhani
  via committed woff2 + `next/font/local`, replacing `next/font/google`. Same CSS
  variables, identical rendering. `layout.tsx`, `src/app/fonts/`. (See the build fix.)

#### Balance
- **Legacy nudged ~1-2% harder (#94).** Worldwide `opponentRatingShift` 1.2 → 1.3: the
  98+ pinnacle tightens ~49% → ~42%, the 96-97 elite tier holds ~15%, a ~92 team ≈ 0%
  (bands still pass, no "never win"). SAM hardened SEPARATELY (not lockstep this pass):
  the +6 regional teams reshaped the pool and `REGION_LOCK.opponentRatingBoost.legacy`
  1.5 → 1.65 makes SAM ~1% harder overall (88-91 tier tighter; ~92-93 ceiling ~36%, a
  real shot). Validated on `difficulty.sim.test.ts`; all 20 challenges stayed in band
  (no re-seed needed). `balance.ts`.

#### Fixed (Core Web Vitals — mobile, was failing CrUX)
- **CLS 0.44 hard-fail → reserved layout (home).** The rank/XP block and the daily-card
  text rendered only after mount (mounted-gated to avoid a persisted-state hydration
  mismatch) with NO reserved space — injecting ~96px+ on hydration and shoving the page
  down on every load. They now render into fixed-height containers (`min-h`), so mount
  fills reserved space with zero shift. Root cause: mount-gating without height reservation.
  `HomeMenu.tsx`.
- **React #418 (hydration text mismatch), home console.** The daily card's number / label
  / description are date-derived (`todayKey()` → `new Date()`), but the home is a STATIC
  page — SSR baked the BUILD day's daily and the client rewrote it on hydration (text
  mismatch + a wrong-daily flash). The date-derived text is now mount-gated; the static
  `/` HTML carries no baked date (verified: empty daily slot). `HomeMenu.tsx`.
- **LCP render-delay (mobile lab ~5.3s).** The LCP element (hero subtitle) sat inside the
  `rise-in` (opacity:0) island, painting only after hydration/animation. The hero now
  renders OUTSIDE `rise-in`, in the SSR HTML, painting immediately. `HomeMenu.tsx`.
- **a11y / agentic-nav: prohibited ARIA.** The locked-Collection glyph put `aria-label` on
  a bare `<span>` (prohibited; dropped by assistive tech). Now `aria-hidden` — the lock
  text is already the card subtitle. `HomeMenu.tsx`.
- **Legacy-JS down-levelling.** `tsconfig` target ES2017 → ES2022 (browserslist is already
  modern) so our own code isn't needlessly transpiled down. The residual Lighthouse
  "legacy JS" is third-party (posthog) and low-priority. `tsconfig.json`.

#### Fixed (deploy)
- **Vercel build timeout (45-min limit exceeded).** The build is ~45s locally, so the
  timeout is an environment HANG, not slow compute — and the only build-time external
  dependency was `next/font/google` fetching Geist / Geist Mono / Rajdhani from
  `fonts.googleapis.com` (Google Fonts rate-limits shared CI/build IPs → a stalled fetch
  = a 45-min hang). Fixed by self-hosting all three fonts (above) so the build makes no
  external request. There is no `vercel.json`, no `prebuild`/`postinstall`, and `build:data`
  is NOT chained into the build, so nothing else reaches the network at build. (`reactCompiler`
  was ruled out: it builds in ~45s locally with it on.) Cannot be verified on Vercel this
  pass — staging pushes are paused — but the hang vector is removed.

#### Deferred (follow-ups, not blocking)
- **Home `@/data` de-barrel (INP / −146 KiB unused JS).** `@/lib/daily` + `runStore` still
  pull the full dataset barrel into the home chunk (DESIGN-DECISIONS #60 / STATUS backlog).
  Left for a focused change with `npm test` — the urgent indexing-threatening CLS/#418/LCP
  are fixed; INP 260 ms is "needs improvement", not a fail.
- **Rank menu PNGs** stay 160×160 (= 2× retina at the 80px display): Lighthouse's 6 KiB
  "savings" would cost retina sharpness, so kept.

### International Majors & content-creator / Wings cards (2026-06-22)

#### Added
- **24 international-Major teams** (RLCS 2021-22 → 2025) folded into the worldwide pool with
  reviewed overalls — lineups 259→283, players →397, orgs →142. Deduped against the existing
  base: jstn./SquishyMuffinz spellings, canonical orgs on the `org:` line, **skipped "The
  General NRG"** (= NRG 2021-22 Worlds, same roster/org/season) and the duplicate Ground Zero
  2022-23, and **"Helfie Chiefs" → Chiefs Esports Club** (a 2025 sponsor name, verified).
  Nationalities researched + filled for the new players/staff. `teams.md`,
  `build-dataset.mjs` (COUNTRY), generated `*.json`.
- **`community` special rarity (emerald/teal) — content-creator cards.** A normal-draw rarity at
  the **rare tier** (`rarityChance` 0.045, Bronze+), visually distinct from the easter-egg cards.
  **gian + jato** get content-creator **coach** cards. Wired through `types`/`schemas`/`balance`
  (`rarityChance`, `rarityOrder`, `RANK_REWARDS`), `GameCard` (accent/ovr/holo), `globals.css`
  (emerald frame/halo/holo/ovr), `CollectionView`, `copy.en/pt`.
- **`wings` special rarity (orange) — the Wings E-Sports easter egg.** A SEPARATE rarity from the
  `creator` card (which is liberatoRL ONLY). **repi + ninja23509** get `wings` cards (secret in
  the collection, +4 team overall & all stats, overall = base), anchored to the Wings line so they
  surface ONLY when it's drawn — via the existing rareSpawn path. Excluded from normal rolls
  alongside `creator` (`rollSpecial`). Own orange frame/halo/holo/ovr in `globals.css`.
- **brunovisquii — rare coach special** (coach of Team Secret).
- **Special cards with no assigned image now show the ORG LOGO** instead of stylized initials —
  the **drafted team's** crest in-game (follows `card.orgId`, set to the drafted lineup by
  `resolvePlayerCard`) and the **base card's** crest in the Collection (resolved via
  `resolveSpecial(baseCardId)`). `GameCard` `SpecialArt` fallback.

#### Changed
- **Collection sort order (by direction):** legendary → mythic → epic → rare → content-creator →
  Wings → Creator (the two easter-egg rarities sit last). `CollectionView` `RARITY_RANK`.
- **Wings offer always centers the Creator:** the Wings line is reordered so LiberatoRL is the
  middle player slot, so his Creator card sits in the center when the easter egg is drawn.
- **Coach situational boost ×1.5 → ×2.0** so coaches (base + special) pull more weight in-match
  (clutch/experience/consistency/mechanics modifiers) without touching the OVERALL contribution
  that anchors the Legacy difficulty curve (#89). Coach specials already share the player
  per-rarity rates + rank gates (`rollSpecial` — no separate coach rate). `teams.ts`.

#### Fixed
- **Creator-rarity specials could leak onto a person's other cards.** `rollSpecial` included
  `creator`-rarity specials in the normal roll. The Creator never leaked only because liberatoRL
  has a single (Wings) card; repi/ninja23509 own many cards, so their new Wings specials would
  have surfaced off the Wings line at the diamond+ creator rate. Root cause: easter-egg specials
  are assigned via the rareSpawn path (`drawNextOffer`), never a normal roll, but `rollSpecial`
  didn't exclude them — now it does. `draft.ts`.

#### Balance
- **Re-tuned 13 challenges' seed/opponentShift** across two passes: (1) the +24-team pool growth
  shifted 11 challenges' fixed-seed drafts out of band; (2) the special-pool RNG changes (the
  `rollSpecial` exclusion, then the new `community` rarity) shifted **ch-samba-style** (→ -7) and
  **ch-south-american-steel** (→ -5), both SAM challenges where the affected persons appear. All
  20 back in their win-rate bands; themes are constraint-enforced, so re-seeding stays theme-safe.

#### Deferred
- **firewall154 content-creator card.** He exists only as a SUB in the base, and the special
  loader resolves `baseCardId` against player/coach cards only. Deferred per direction until the
  SAM base expansion gives him a player/coach card — the special attaches then without rework.
- **3 new-org logos — curated PNGs now hand-dropped in** (`public/orgs/quadrant.png`,
  `luminosity-gaming.png`, `team-mobula.png` — keyed to the exact orgId, per the drop-in
  convention). `fetch-assets --orgs` had pulled the wrong crest for these (`quadrant` → Team
  Liquid, `luminosity-gaming` → ROUNDS, `team-mobula` → 9Lies — same-name/rebrand collisions on
  Liquipedia), so they stay `false` in `asset-overrides.json` (no auto-fetched `logoUrl`) and the
  UI renders the hand-dropped files via the `/orgs/<orgId>.png` fallback. `detonator` fetched
  correctly and is in.

### Staging-review adjustments (2026-06-21)

A pass over the v1.4 build before it ships, from playtesting on `staging`:

- **Balance — MMR reworked to a win-only economy (supersedes the original v1.4 MMR
  below).** The placement-curve formula over-rewarded — a mediocre fresh account drifted
  to ~1200 and elites blew past 1500. MMR now moves **only on a real title**, by a flat
  table: Easy/Normal championship **+1**, Hard **+3**, Legacy grand finalist **+5**,
  Legacy title **+9**; everything else **0** (no placement curve, Swiss, difficulty
  multiplier or regional bonus). Start stays 1000; live gains are tiny and linear, so
  climbing past 1600 is a real grind. The **retroactive backfill is capped at 1600** via
  a saturating curve of title history (`MMR.backfillScale`), so the best current players
  land *near* 1600 and a title-less account stays at start. Daily titles still earn MMR
  (a real tournament); Challenge mode never did. Profile **v10 → v11** hard-resets MMR to
  the new value (a one-time correction, not a floor). `balance.ts` (`MMR`/`mmrRawGain`/
  `mmrAfterRun`/`mmrBackfillFloor`), `mmr.test.ts`.
- **Changed — Legacy unlock decoupled from Daily/Challenge.** A Daily/Challenge Hard win
  still counts as a **title** (achievements, leaderboard, MMR) but no longer **unlocks
  Legacy** — only a Classic/Quick Hard (or Legacy) championship does. New `legacyUnlocked`
  latch on the profile (synced, OR-merged), seeded `true` for anyone with an existing
  Hard/Legacy title so no one loses access. `profileStore`, `profileSync`, `ResultsScreen`
  (unlock-celebration guard).
- **Changed — Challenges:** every series is now **Best-of-7** (schema-enforced); rerolls
  **scale with difficulty** instead of a flat 8 — easy 8 / normal 5 / hard 3 / legacy 0;
  XP rewards retuned into per-rarity bands (Common 80–110 → Legend 440–560). The set grew
  from 10 to **20**, spread so **every rank Bronze→SSL unlocks new content**, with varied
  twists (region / era / nationality / OVR-cap / no-specials / build-around). Every seed
  is **sim-validated into a difficulty band** — the winnability test now also asserts an
  upper bound (≤0.85) so nothing is a walkover. `challenges.json`, `balance.ts`
  (`CHALLENGE.rerollsByDifficulty`), `challenges.ts`, `schemas.ts`, `challenges.test.ts`.
- **Changed — rank-image lock messages.** Rank-locks show the unlocking **rank's badge**:
  locked Challenge cards (the rank that unlocks each) and the Collection's per-rarity locks.
  Reuses `RankBadge`. (The home Collection/Challenges tiles keep the original padlock glyph.)
- **Balance — special-card rarity ladder + chance ramp retune.** Each rank Bronze→Platinum
  now unlocks exactly ONE new rarity: **rare→epic→mythic→legendary** (legendary moved
  **Diamond → Platinum**, so Platinum is no longer a dead rank). The per-run special
  appearance chance, previously flat 4% until Champion, now **ramps from Diamond**:
  4% Bronze–Platinum → **6% Diamond → 9% Champion → 12% GC → 16% SSL** (`RANK_REWARDS`).
- **Fixed — special cards on the SUB slot didn't render in the draft.** A sub who carries
  a special (e.g. Turbopolsa) showed its special only on the results screen. Root cause:
  `resolveSub` (`engine/cards.ts`) — unlike `resolvePlayerCard`/`resolveCoach` — took no
  `specialId` and never set `special`, so every card-render path dropped it (the rating
  path read `roster.sub.specialId` directly, which is why the numbers were right). Now
  `resolveSub` is special-aware and the offer/pick dispatchers forward the id. `cards.test.ts`.
- **Fixed — email-code login dead-end after navigating away.** Requesting a code then
  leaving `/profile` lost the in-flight state (it lived in the `SignIn` component's local
  `useState`), so on return you could neither enter the code nor (past Supabase's 60s send
  limit) request another. The in-flight email now lives in `accountStore` (a
  navigation-surviving singleton) so you resume on the code step; added a **Resend** action,
  surfaced Supabase's `over_email_send_rate_limit`/`otp_expired` codes with clear copy, and
  a rate-limited resend still lets you enter an existing code. `accountStore`,
  `AccountSection`, `supabase.ts`, copy (en+pt).
- **Fixed — Supabase MMR leaderboard SQL errored / board empty.** `docs/ACCOUNTS-SETUP.md`
  §1c recreated the `leaderboard` view with `mmr` inserted **mid-column-list**, which
  Postgres rejects (`CREATE OR REPLACE VIEW` can only append) — so the column/view never
  got created and the MMR tab failed closed to "no entries". Rewrote §1c to **DROP +
  CREATE** the view (order-free) and corrected the stale `default 200` → `1000`. (Doc fix;
  Miguel re-runs the corrected SQL in Supabase.)
- **Fixed — rank-up celebration didn't fire on a challenge clear.** The full-screen rank-up
  ceremony lived only in the tournament `ResultsScreen`, so clearing a challenge whose XP
  crossed a rank threshold ranked you up silently. `RankUpCelebration` is now exported and
  the `ChallengeScreen` fires it on a clear that crosses a rank (XP captured pre-reward in
  `ChallengeRunState.xpBefore` for robustness). `runStore`, `types.ts`, `ResultsScreen`,
  `ChallengeScreen`.
- **Balance — secret Creator card eligible from Bronze + stronger.** The dev easter-egg
  card now drops from **Bronze** (never advertised — the Collection's rarity grid omits the
  `creator` tier) instead of Diamond. Its boost rose **+5 → +7** (team overall + every team
  attribute) so the 71-overall card is genuinely worth slotting, not a downgrade; the
  special-effect schema cap was raised 5 → 7 to allow it (normal specials stay ≤5). It stays
  a rare, un-buildable-around pull, so it doesn't shift competitive balance. `RANK_REWARDS`,
  `specialCards.json`, `schemas.ts`.
- **Balance — chemistry is now ADDITIVE (revises the strongest-link rule).** Per player pair,
  chemistry sums two INDEPENDENT axes — **connection** (same lineup > ex-teammates > shared
  org, current or career) **+ heritage** (same country > region) — instead of counting only
  the single strongest link. So a pair who share a country AND once shared an org now score
  both (the old model masked the org behind the country, which is why "players who passed
  through the same org" chemistry felt inconsistent). Within each axis only the strongest
  form counts (the alternatives describe the same relationship, so they can't double-count).
  Recalibrated (`maxRaw` 11 → 10, weights rescaled): a 3-same-country roster still lands
  **Great, not Perfect** (75%); any real connection — shared org/teammates, org loyalty or
  matching staff — completes the bar. Sim-neutral: AI lineups still saturate to 100% and
  Hard/Legacy already weight AI chemistry at 0, so the field isn't inflated. `chemistry.ts`,
  `balance.ts` (`CHEMISTRY`), `chemistry.test.ts`.
- **Balance — Legacy difficulty retune + a REALISTIC difficulty sim harness (#79.1).** A
  new `difficulty.sim.test.ts` measures the win-rate-by-final-overall CURVE from teams that
  are actually DRAFTED (synergy-aware, with the real reset-until-satisfied behaviour) — not
  a hardcoded 92.5/95.5/97.5 team — and is fully deterministic (fixed seeds → identical
  every run). It revealed the #79 ease had overshot at the top: a worldwide 98+ pinnacle was
  winning ~47%. Retuned `legacy.opponentRatingShift` **1.35 → 1.2** so the whole elite tier
  has a real, growing shot — worldwide: a ~92 team ≈ 0%, **96-97 ≈ 15%**, a **98+ pinnacle
  ≈ 49%** (the best team a player can build is rewarded, no "never win"; non-elite almost
  never wins). SAM is tuned on its OWN flatter, lower scale via
  `REGION_LOCK.opponentRatingBoost.legacy` **2.05 → 1.5** (its ~92-93 ceiling ≈ 34%, never
  impossible) — this boost moves in lockstep with the WW shift so the SAM curve stays put.
  The old flaky, hardcoded
  Legacy anchor in `balance.test.ts` was retired (the new harness covers it properly).
  `balance.ts`, `difficulty.sim.test.ts`, `balance.test.ts`.

### Added
- **Achievements rebuilt + real-time (≈56, grouped).** A full new set replaces the
  old 25, organised into seven groups (Milestones · Modes & Difficulty ·
  Performance · Chemistry & Composition · Roster Building · Collection ·
  Progression) with assigned rarities + secret flags. They now pop the **moment**
  they're earned via a global toaster — mid-draft (perfect chemistry, all-one-
  region, loaded-with-specials), mid-match (hat-trick, 7-goal win, reverse sweep,
  giant-slayer, game-7 OT…), and at run end — not only on the results screen.
  Engine split into `teamAchievements` / `liveAchievements` /
  `evaluateRunAchievements` / `evaluateCounterAchievements` so each fires at its
  natural trigger; a single `awardAchievements` funnel marks + grants XP + toasts.
  Adds two lifetime counters (`gamesWon`, `goalsScored`, profile v5 → v6) and
  **per-player goal attribution** in the match sim (`GameResult.scorers`) — derived
  deterministically WITHOUT consuming the series RNG, so every existing seed stays
  byte-identical. Icons are now group-based; the grid groups with per-group
  progress. New `achievements.test.ts`. (Old earned ids orphan — per "substitua todos".)
- **Leaderboards + accounts foundation (email-code login + cloud sync).** A new
  `/leaderboards` page (linked from the home menu) tracks the player's peak team
  overall per difficulty and per pool (worldwide / SAM), plus championships,
  daily streak and challenges cleared — working **today**, from the local
  profile. Email-code sign-in + global boards + cloud backup activate the moment the
  Supabase env vars are set (the code is dormant until then — guest play is
  unchanged). The progress-safety guarantee is built and unit-tested:
  `mergeProfiles` (`src/lib/profileSync.ts`) merges a guest's local save into the
  cloud on first sign-in and **never regresses below either side** (counters MAX,
  collections UNION keeping the earliest unlock, history union-by-runId) — a
  player who already has progress keeps all of it (#55.7). New: leaderboard
  `records` on the profile (schema v4 → v5, backfilled from history), the
  `@supabase/supabase-js` client wrapper (`src/lib/supabase.ts`, no-op until
  configured), and `RunHistoryEntry.mode`/`.region` for attribution. **Ops setup
  (SQL schema + RLS, email sender, env vars): `docs/ACCOUNTS-SETUP.md`.**
- **MMR — a cosmetic skill rating (parallel to XP).**
  > **Superseded by the Staging-review MMR rework (win-only, start 1000) above.**
  Every profile now carries an
  `mmr` that starts at **200** and rises a small, capped amount per finished run —
  placement base × per-difficulty multiplier (+1 for a region-locked clear), so an
  easy win is ~+3, a Legacy podium ~+6 and a Legacy title ~+12-13. It's never spent
  or lost (cloud merge takes MAX, `?? 200`-seeded for pre-MMR rows) and is tuned to
  grow ~50× slower than XP, so it reads as "how good are you," not playtime — a few
  hundred after 50 runs, low thousands after 200. Surfaces next to your rank on the
  profile card and as a leaderboard category. Numbers live in `balance.ts` (`MMR` +
  `mmrForResult`); zero gameplay impact. **Ops: run the `mmr` SQL in
  `docs/ACCOUNTS-SETUP.md` §1c for the global MMR board.** Veterans aren't dropped
  to 200: a one-time `mmrBackfillFloor` seeds MMR from existing title history (no
  rank/achievement reset needed — #80).
- **MMR on the results screen + a discreet home sign-in nudge.** The run-complete
  screen now shows MMR earned this run + your new total (beside the XP total). The
  home menu gets a small, low-key "sign in to save your progress + climb the
  leaderboards" link — only when accounts are on and you're signed out.
- **Run recap — see how any past run went.** Each history row on the Profile is now
  a button opening a recap modal: the drafted team on a field (`FieldView`),
  placement, difficulty/region, team overall, chemistry, Swiss record, goals
  conceded, the champion (if you didn't win) and XP. Backed by a compact
  `RunHistoryEntry.recap` (roster refs + outcome facts, ~1KB) written at run end;
  older saved runs degrade to a name+stats summary. Rides the existing cloud sync
  (no schema change).
- **Challenges now play out a real, animated Bo7.** The challenge match used to
  resolve instantly; it now reveals game-by-game with a live series score, per-game
  sfx and a Skip — the same sim playback as the other modes — before the
  cleared/failed hero. The briefing also shows the **opponent lineup on a field**
  (`FieldView`) so you can scout the line you must out-draft before committing.
- **Challenges — a new rank-unlocked mode (`/challenges`).**
  > Superseded by the Staging-review challenges pass above (now 20 challenges,
  > all Bo7, rerolls by difficulty).
  Authored puzzles: a
  constrained draft then a single Bo7 against a fixed historical line. Cleared =
  cleared (one-and-done, like an achievement), granting XP (+ an optional earned
  special that bypasses the rank gate). 10 starter challenges span the ranks and
  the archetypes — Beat-the-Wall, Region Pride (SAM-only), Era Lock (one season),
  One Nation (a nationality), Underdog (overall cap), Purist (no specials) and
  Build-Around (a fixed low-overall player) — with a couple of prereq chains.
  Each is seeded for a repeatable, solvable puzzle and **validated winnable** by
  a sim (`challenges.test.ts`: a strong legal team must clear every one — from a
  100% on-ramp down to a 27% Grand-Champion "miracle"). New `RunMode`/`RunPhase`
  `challenge`, `engine/challenges.ts`, hand-authored `src/data/challenges.json`
  (referential-integrity checked), `profileStore.challengesCompleted` (profile
  schema v3 → v4), a `/challenges` nav entry, briefing + match screens, and full
  EN/PT copy. Implements `docs/CHALLENGES-DESIGN.md`.
- **Legacy identity pass.** A prismatic hexagon-with-crown emblem (shared
  `components/ui/icons.tsx`) now marks Legacy across the app: on the setup
  difficulty card, as a discreet in-run indicator in the `RunStepper` (shows in
  draft / review / tournament / results), and in the unlock ceremony.
- **Richer Legacy-champion celebration.** Winning the all-time gauntlet now gets
  the crown emblem, a "Legacy Champion" prismatic selo, a second prismatic ray
  bank and a denser confetti shower (30 vs 16 pieces, full cyan→purple→gold
  palette) — the hardest title to win now reads as the biggest moment.

### Changed
- **Leaderboard trimmed to four categories + MMR.** Down from twelve tabs to the
  ones that matter, titles first: **Titles · Total**, **Titles · Legacy**, **Best
  overall · Legacy**, **Best overall · Regional**, and **MMR** (which replaced the
  old Total-XP board). The other DB columns still exist — they're just no longer
  surfaced as tabs — so nothing about sync changed. `best_sam`'s label is now
  "Regional" (it's the only regional pool).
- **Leaderboards reachable from a header trophy.** A compact trophy button sits
  beside the settings gear (desktop + mobile header) — one tap to the boards from
  anywhere, without crowding the 5-slot bottom nav. **MMR is the headline board**
  (first tab + default).
- **Challenge match now uses the full sim look.** The Bo7 reveals in TWO columns
  (your wins left, the boss's right) with a running scoreline + live cue, matching
  the Classic Match Center, and **both teams' lines are shown on a field** above it.
- **Tighter mobile chrome.** The bottom nav is now icons-only (labels dropped,
  icons enlarged + centered); the header drops the "Rocket Draft" wordmark on mobile
  (icon only). Both keep accessible labels (`sr-only` / `aria-label`).
- **Challenge mode is rank-gated at Bronze (with the Collection).** Unranked players
  see a locked card on the home menu and a locked state on `/challenges`; both
  unlock at Bronze (one run away). #81.
- **Challenges grouped by rarity.** The grid is now sectioned by tier (Common →
  Legend) with a per-section cleared count, instead of one flat list.
- **Eliminator overall uses a real bolt icon** (`BoltIcon`) instead of the `⚡`
  emoji on the results screen, matching the hand-drawn SVG icon system.
- **Dropped the Vercel Analytics + Speed Insights sinks (edge-request diet).** The
  game blew past Vercel's Hobby **1M edge-requests/month** cap in 4 days at launch
  (~1.1M). Root cause: `<Analytics/>` + `<SpeedInsights/>` fire a beacon to
  `/_vercel/insights/*` and `/_vercel/speed-insights/vitals` on every pageview and
  SPA navigation — all counted as edge requests — and `trackEvent` *doubled* it by
  fanning every game event into the Vercel sink on top of PostHog. PostHog (EU,
  cookieless, direct ingestion — bypasses the Vercel edge) already captures the
  exact same pageviews + custom events, so the Vercel sinks were pure redundant
  edge load. Removed `<Analytics/>`/`<SpeedInsights/>` from `layout.tsx` and the
  `@vercel/analytics` `track()` call from `lib/analytics.ts` (PostHog-only now). No
  analytics data lost. `@vercel/analytics`/`@vercel/speed-insights` deps can be
  removed from `package.json` later (kept for now; harmless).
- **Image-optimizer variant diet.** The only `next/image` use is the small
  special-card photo (`GameCard`, ≤256px display), but the default size ladders let
  the optimizer mint ~8+ variants per photo — each `/_next/image?…&w=…` an edge
  request, ×86 photos on the collection screen. Trimmed `images.deviceSizes`/
  `imageSizes` to the widths actually used (~256/640) and set `minimumCacheTTL` to
  31 days so repeat visits stay off the optimizer. No visible change at card size;
  optimization stays ON (mobile LCP unaffected).

### Balance
- **MMR rescaled to a Rocket-League-like ladder; everyone starts at 1000 (#80).**
  > **Superseded by the Staging-review MMR rework (win-only, start 1000) above.**
  The first cut topped out far too low (a heavy player sat ~440) and started new
  players at 200 (too long a climb). Now the floor is **1000** — a new account isn't
  at the bottom, so reaching ~1500 is a short, motivating climb (~30-50 runs) and
  ~1900 is the real grind toward the ~2300 soft cap. Rework: bigger, granular gains
  (placement + per-Swiss-win + difficulty mult + a regional-title bonus) with
  **diminishing returns** toward a `softCap` (2300) + a `hardCap` (2800) clamp, so a
  very good player lands ~1500-2000 and even an obsessive grinder can't reach absurd
  values (a 2000-run grind stops at the cap, not 100k). The veteran backfill uses the
  closed-form integral of the same damped recurrence, so it's consistent — existing
  players (incl. Miguel) re-seed into the 1500-2000 range on the v9 migrate. Numbers
  in `balance.ts` (`MMR`/`mmrRawGain`/`mmrDamp`/`mmrAfterRun`/`mmrBackfillFloor`).
- **Hard eased to ~15% total win rate (v1.4).** `hard.opponentRatingShift`
  −0.2 → −0.7 (faithful sim showed ~12.5% at −0.2; the blend is flat so it needs a
  moderate nudge). Hard stays the hidden-overall knowledge test; the §25 anchors
  (rating-diff based) are untouched and `balance.test.ts` Hard bounds still hold.
- **Legacy eased toward ~5% total win rate — WW and SAM both (#79).** PostHog
  showed the live Legacy total win rate at ~2-4%. A faithful blended sim (REAL
  drafted teams built over every lineup, run through full tournaments — the sim
  baseline reproduced the live ~2.6% WW / ~1.9% SAM) was used to calibrate a
  light, anchor-preserving ease: `legacy.opponentRatingShift` **1.65 → 1.35**
  (lifts the elite end most — a 97 dream ~25% → ~29%, a 92 stays near zero) and,
  reversing the v1.3 SAM pin (#75), `REGION_LOCK.opponentRatingBoost.legacy`
  **2.95 → 2.05** so the SAM effective shift drops **4.60 → 3.40** and SAM eases
  too. In-sim blended lands ~3% (the sim weights weak historical teams a real
  drafter would pass, so live should sit higher, ~4-5%); re-check PostHog after
  deploy and nudge again if short. Hard is untouched (it has its own rate). The
  `balance.test.ts` Legacy anchors still hold (good ~0%, strong ~2%, dream ~29% <
  40%). **Root cause of the prior 2-4%:** at the very top the user-vs-field gap is
  near zero and the ±4.5 series-form swing dominates, so only 97+ drafts had a real
  shot; lowering the flat opponent shift widens that gap exactly where it was
  thinnest.
- **Special-card rarity rework — absolute per-rarity spawn rates.**
  > Superseded by the Staging-review rarity retune above (ramp now from Diamond:
  > 6/9/12/16%, legendary at Platinum).
  The old model
  rolled one flat appearance chance and then a within-pool weighted pick, so a
  player whose ONLY special is a legendary (kronovi, m0nkeym00n, violentpanda)
  showed it ~4% of the time — every time a special procced — because the weighted
  pick normalised over a one-card pool. Rarity rate was effectively coupled to
  pool size. Now each rarity a person owns is rolled at its OWN absolute rate
  (`SPECIALS.rarityChance`, scaled by the rank/daily mult), rarest-first, first
  hit wins. Calibrated with `scripts/calibrate-rarity.mjs`: the overall special
  rate is preserved (~1.6% per offer slot, was ~1.64%) while legendaries are
  ~4× rarer (a lone legendary drops from ~4.0% to ~1.0%). The rank-gate and the
  rank ramp SHAPE (Champion ×1.5 / GC ×2.5 / SSL ×4) are unchanged — the mult is
  just re-anchored to the baseline rank (`rankBaselineChance`). AI opponents use
  the same per-rarity weighting so their rosters stay consistent.

### Fixed
- **Flaky Legacy balance test stabilised.** The v1.4 Legacy ease nudged a 92.5
  team's title rate up against the old tight `< 0.03` bound; since the bracket draw
  isn't fully seed-deterministic, it tripped intermittently. Bounds loosened to the
  post-ease rates with variance headroom (still catch a regression, not noise).
- **Resetting a challenge mid-run kept the fixed seed.** "Reset run" routed a
  challenge back through `startRun` → a fresh classic draft, losing the puzzle's
  fixed offers + boss. `restartRun` now re-invokes `startChallenge(challengeId)` for
  challenge runs, replaying the same seed.
- **"Who ended your run" bolt is yellow, not orange.** The difficulty-inflation bolt
  on the eliminator overall (Legacy / region-locked) now uses amber, reading as a
  distinct "buffed" marker instead of clashing with the brand orange.
- **Challenges are now genuinely winnable (was 0-6% with real play).**
  > Superseded by the Staging-review challenges pass above (now 20 challenges,
  > rerolls by difficulty 8/5/3/0).
  The old
  winnability test validated an UNREACHABLE roster (the single best card at every
  slot across all lineups), so it proved nothing about real play — measured with a
  competent auto-draft, most challenges sat at 0-6% and `ch-south-american-miracle`
  was impossible; `ch-vive-la-france`'s fixed seed couldn't even assemble a French
  roster. Fixes: (1) a per-challenge `sim.opponentShift` boss-balance knob so a
  famous superteam stays the headline opponent yet is beatable; (2) re-thought,
  distinct seeds per challenge (no two share an offer sequence) chosen to surface a
  strong legal roster; (3) `challengePool` restricts a nationality twist to lineups
  that actually contain an eligible national, and the challenge reroll budget rose
  5 → 8, so a constrained draft always completes; (4) the winnability test rewritten
  to simulate a competent draft, asserting realistic per-tier win rates (~50% /
  legend ~30%). Every challenge now clears its floor.
- **Collection counter no longer counts ghost cards.** The "X / N" unlocked count
  was `Object.keys(unlockedSpecials).length`, which included ids for specials no
  longer in the hand-curated set — so the counter read higher than the cards
  actually shown. Now pruned (`pruneUnlockedSpecials`) on every store path (migrate,
  cloud hydrate, cloud merge), mirroring the achievements fix, so the count is
  accurate and the cloud row self-heals; the `specialsOwned` achievement counter is
  corrected too.
- **Phantom "already-earned" achievement count — now fixed for signed-in players
  too.** Root cause: the v1.4 set replaced every achievement id, but a player's
  earned map still held the OLD ids; the unlocked count reads
  `Object.keys(achievements).length`, so it showed ~28 unlocked even though none of
  the NEW achievements were earned. The v7 migrate pruned stale ids on *local*
  rehydration — but the cloud path bypassed it entirely: `mergeProfiles` unions the
  earned maps with no validity filter and `hydrateDurable` wrote them back
  wholesale, so a signed-in player kept seeing 28 (and the stale ids were re-pushed
  to the cloud, defeating the migrate permanently). Now `pruneEarnedAchievements`
  runs on **every** path a durable profile enters the store — the migrate (v8),
  `hydrateDurable`, and the `accountStore` cloud merge before hydrate+push — so the
  count is accurate AND the cloud row self-heals on the next sync.
- **In-match feats no longer pop before their match is shown.** Root cause: the
  engine simulates the whole round (and AI rounds) ahead of the animation, but
  `playRound` awarded `liveAchievements` over that pre-simulated state immediately —
  so e.g. a hat-trick toast fired the instant you advanced, before its match was
  revealed on screen ("the game hadn't even started"). Live feats are now awarded
  by `TournamentScreen` as each user series finishes *revealing* (scoped via
  `liveAchievements(t, earned, revealedUserSeries)`); `finishRun` re-evaluates the
  full tournament as a dedup-safe safety net.
- **Set-swap no longer floods existing players with toasts.** Cumulative
  achievements ("Score 100 goals across all your runs") are correct by design, but
  because the v1.4 set introduced brand-new ids, every milestone an existing player
  had already passed re-fired as a toast on their next run (felt like "I got 100
  goals on my first run"). The v8 migrate now **silently** pre-marks counter /
  collection / rank achievements already satisfied by career totals (no toast, no
  XP — the old set already rewarded the equivalent), so the swap is invisible.
- **Slot-machine reveal now replays on "Reset run".** Root cause: `OfferReveal`
  was keyed by `draft.round` only, and a reset starts a fresh run back at
  round 1 — an identical key, so React never remounted the component and its
  lazy reel-state initializer never re-ran (the reel stayed `null` from the
  prior draft's `onAnimationEnd`). Now keyed by `runId`+`round`; a reset mints a
  new `runId`, forcing the remount that rebuilds and re-spins the reel.
- **Modal close button no longer renders off-screen on mobile.** Root cause: the
  shared `Modal` centered its card with `items-center` and had no max-height or
  scroll, so any card taller than the viewport was centered with its header (and
  the ✕) pushed above the top of the screen, unreachable. The card is now a flex
  column capped at `100dvh-2rem` with a pinned, non-scrolling header and a
  scrollable body — affects every modal (collection detail, onboarding, reset
  confirm). The first-run tutorial got the same scroll treatment plus a
  safe-area-aware skip button.

## [1.3.5] — 2026 · Progression + collection polish

### Changed
- **XP ladder stretched.** SSL 50k → 60k with the mid-ranks redistributed for a
  longer, steadier endgame climb (progressively larger gaps). **Bronze stays 200**
  so the Collection still unlocks on the first run.
- **Rank-up screen shows the special-card chance GAINED** over the previous rank
  (e.g. "+2%") instead of the absolute value — reads as a reward and stays correct
  as the base rates change.

### Fixed
- **Collection card on the home is no longer clickable while locked** (Unranked):
  it renders as a non-link (not focusable, `aria-disabled`) until Bronze. The
  `/collection` route already guards direct-URL access with a locked state.

### Notes
- Public site changelog consolidated: the [1.3.3]–[1.3.5] patches are merged into a
  single "Proving Grounds" entry in-app so the page stays tidy. This dev changelog
  keeps the per-version history.

## [1.3.4] — 2026 · Legacy elite ease

A small follow-up to the [1.3.3] retune: the very best drafts deserved a slightly
better shot at Legacy without making it easier overall.

### Balance
- **Legacy elite eased — `opponentRatingShift` 2.3 → 1.65.** A worldwide overall-97
  dream now wins the title ~25% (was ~15%) and the all-time-best 99 ~60% (was ~47%),
  while the base of the curve stays low (a 95 single digits, a 92 ≈ 0). Verified on
  real-team sims.
- **SAM curve unchanged.** `REGION_LOCK.opponentRatingBoost.legacy` 2.3 → 2.95 so the
  effective SAM opponent shift stays pinned at +4.6 — the worldwide-elite ease does
  not touch SAM (still ~92→15%, ~95→44%).

### Changed
- **"Who ended your run" shows the eliminator's BOOSTED overall** — the number the
  team actually played at in Legacy / region-locked (rating + difficulty shift),
  keeping the ⚡ marker, so it's clear why a "lower-rated" team could beat you.

## [1.3.3] — 2026 · Legacy difficulty retune + systems pass

Legacy had drifted too easy — a worldwide overall-97 draft won the title ~53% of
runs, and a strong SAM draft cruised — losing the "all-time gauntlet, only the
very best win" identity. Re-anchored on **real-team simulations** (user teams
built from actual cards so both rating AND situational stats match the live
game, not just the team overall). Plus a systems pass: chemistry "shared past"
links, a meaningful sub slot, and results/share polish.

### Added
- **Chemistry "shared past" links.** Two players whose drafted cards differ but
  who once shared a LINEUP (ex-teammates) or an ORG in their careers now link up:
  ex-teammates is a strong link (= a real org link), shared-org-history a weak
  nudge. Kept in the strongest-wins ladder (NOT additive), so it never inflates a
  same-country stack past Great — it rewards MIXED rosters of veterans who crossed
  paths (e.g. a drafted-KRU player + an old FURIA teammate). See DESIGN-DECISIONS #77.
- **Subs can roll special cards** (v0.5 only did players + coaches). Specials belong
  to the PERSON, so a sub who was also a famous player — e.g. Turbopolsa — can now
  appear as one of their specials, with that special's overall and chemistry context.

### Changed
- **The sub slot now matters.** Its depth bonus (consistency + experience) scales
  with the sub's overall instead of a flat +1/+1, so a strong or special sub is a
  real bench, a token one barely registers. See DESIGN-DECISIONS #78.
- **Results screen shows the team-overall breakdown in ALL modes** (was hidden runs
  / Hard+Legacy only) — a clean end-of-run summary of how the overall was built.
- **"Who ended your run" upgraded:** shows the eliminator's team overall as a plain
  number with a ⚡ marker when the difficulty boosted it (Legacy / region-lock — it
  played above its overall), and now reveals the **special cards the opponent
  actually fielded** (AI player upgrades), not just their base cards.
- **Share image polish:** special cards render their full identity — rarity border,
  a holographic sheen (not just a border glow), and the rarity-coloured overall —
  and **every card shows its org crest** as a small watermark (styled fallback when
  a logo PNG is missing).

### Balance
- **Legacy `opponentRatingShift` 0 → 2.3.** A worldwide overall-97 draft now wins
  the title ~15% (was ~53%); the all-time-best 99 (Vitality '22-23) ~46%; a 95 a
  few %; a 92 ≈ 0. The Bo7 curve is steep on purpose — each overall point roughly
  doubles the title odds.
- **`REGION_LOCK.opponentRatingBoost` is now per-difficulty** (was a single flat
  +2 for all modes). easy/normal/hard keep +2 (SAM stays the accessible mode);
  **legacy 2 → 2.3**. Anchored on the best REALISTICALLY-ACHIEVABLE SAM team, not
  the theoretical ceiling: live SAM play showed real drafts land in the 80s (weak,
  random pool — overall 92 is already a rare-good result, 95+ is never built).
  Effective SAM opponent shift = `legacy.opponentRatingShift` (2.3) + boost = +4.6,
  giving a typical ~90 team ~2%, the best realistic ~92 ~15% (the anchor), and the
  rare 95/97 unicorns a lot (once-in-a-lifetime SAM drafts). Mirrors worldwide,
  where the best achievable ~97 also wins ~15%.
- Re-anchored the `balance.test.ts` Legacy assertions to the new targets (good
  92.5 never wins; strong 95.5 <2%; a dream ~97.5 ~10% — the reachability case).
- **Special-card appearance chance trimmed** to curb inflation: base ranks
  (Bronze–Diamond) 0.05 → 0.04, Champion 0.08 → 0.06, Grand Champion 0.12 → 0.10
  (SSL unchanged at 0.16). The ramp stays monotonic — it climbs only at the top.
- **Creator card buffed — now +5 to the team's final OVERALL** (on top of its
  existing +5 to every combat attribute). It forces the 71-overall LiberatoRL card
  into the roster, so before this it was a *trap* (you sacrificed ~5 overall and
  ~30pp of win rate for the tribute); the +5 makes it break-even with a normal
  draft (~94 either way) while keeping the combat flavour. SAM-only rare spawn, so
  not abusable. New `overallBonus` field on the special-effect model carries it.
- **Draft anti-frustration tilt now weights by roster OVERALL, not historical
  strength** — and it was effectively broken in SAM. `historicalStrength` tracks
  overall worldwide but is miscalibrated in the compressed SAM pool (its "strong"
  teams averaged a LOWER overall than its "solid" ones, and it has no elite tier),
  so the SAM tilt barely moved offers (good-team share 15.5%→16.3%, ≈ uniform).
  Overall-based weighting self-adapts to any pool; worldwide is preserved. SAM also
  gets a firmer nudge (`regionTierBias` 0.6 vs the global 0.35) since its pool is
  bottom-heavy: SAM good-team (≥84) share 15.5%→~19%, weak (≤78) 36.6%→~27%. Daily
  stays byte-identical (tilt off there); weak rosters still appear (never filtered).

## [1.3.2] — 2026 · Second live-feedback pass

More staging feedback: winning was still rare (not because a strong team's WIN
chance is low, but because BUILDING a strong team is), the Hard rank-gate broke
the flow, and Perfect chemistry was too hard again. Supersedes [1.3.1] balance.

### Added
- **Legendary achievement "Continental Crown"** (300 XP): win a **Legacy**
  tournament in **region-locked** mode — the hardest feat in the game.
- **Collection lock shown on the home menu** (a padlock + "unlocks at Bronze")
  when Unranked, not only inside the Collection screen.
- **Team-overall breakdown on the results screen for hidden-overall runs**
  (Hard/Legacy) — the same players/coach/sub/org/chemistry/specials breakdown the
  review screen shows in visible modes, now revealed at results where the overalls
  are first shown.
- **5 new SAM-only lineups**: Euphoria (RLCS X), Erased (RLCS X), Dream Conspiracy
  (2021-22), w7m esports (2022-23) and Hero Base (2024). NOTE: the suggested W7M
  2024 roster was NOT applied — `w7m esports · 2024` already exists with a
  different roster; left untouched (needs a call on which roster is correct).
  New orgs (euphoria, erased, dream-conspiracy, hero-base) render styled logo
  fallbacks until art is dropped into `public/orgs/`.
- **2 new special cards**: `sp-loud-klaus` (Klaus, rare 85, based on his Hero Base
  2024 card) and `sp-sam-mvp-drufinho` (rare 90). NOTE: drufinho's 2022-23 card is
  KRÜ in the dataset, so the FURIA base used is `drufinho-furia-2024` — retarget if
  a different base is intended.

### Release
- **Displayed version is v1.3.0 "Season Rewards"** — the public launch label for the
  whole v1.3 effort (the [1.3.1]/[1.3.2] entries are dev iterations folded in).
  In-app changelog page updated (EN + PT).

### Changed
- **Win rates raised across the board** (the run-level odds were too low because
  strong drafts are rare): Normal `opponentRatingShift` -1.0 → **-1.3**, Hard -0.2
  → **-0.5**, Legacy 0.2 → **-0.3**. A ~92 elite now wins Hard ~12%, a ~95 dream
  wins Legacy ~17% (was ~10%), and the chemistry change (below) makes those totals
  easier to reach. `balance.test.ts` Legacy band rebased (playoffs is reachable;
  the title is the wall).
- **Hard mode is no longer rank-gated** (`RANK_REWARDS.hardMode` = true for all
  ranks) — gating it behind Silver broke the experience in playtest. Every
  difficulty is open from the start (Legacy still needs a Hard win).
- **Chemistry thresholds eased to Miguel's spec**: **3 same-country players reach
  Great** (was Good), and **adding one org connection** (drafting a player's org,
  or a coach/sub who shares it) **reaches Perfect**. Country alone still can't hit
  Perfect — a same-country coach+sub is a soft bonus that falls short on its own.
  `maxRaw` 15 → 11, `sameCountryPair` 2 → 3, org/staff links 1.5 → 2,
  `staffCountryBonus` 0.5.
- **Region-lock boost 3 → 2** (`REGION_LOCK.opponentRatingBoost`): a regional field
  is too weak to wall a genuinely strong SAM draft at any boost, so SAM favours
  winnability — a typical ~90 SAM team wins Legacy ~18% (not ~40%), a great one
  wins comfortably. SAM stays the more accessible region-pride mode.
- **Ranks**: Bronze 300 → **250 XP** (one run clears Unranked even on a loss);
  Supersonic Legend 40k → **50k XP** (longer endgame).

## [1.3.1] — 2026 · Live-feedback pass (balance targets, chemistry rules, polish)

Pre-launch iteration on v1.3 from live play. Supersedes the [1.3.0] balance.

### Added
- **First-launch tutorial**: a short full-screen, multi-step feature tour (draft →
  collection → ranks → difficulties), shown once (`flags.seenTutorial`),
  skippable. Client-only + mounted-gated → no SSR/SEO/page-speed impact.
- **Rank-up screen now lists what you unlocked** (the Collection, a new rarity,
  Hard mode, a higher special chance) — derived from `RANK_REWARDS`.
- **Region-lock difficulty normalisation** (`REGION_LOCK.opponentRatingBoost` = 3):
  a flat boost to region-locked (SAM) opponents so the regional curve mirrors
  worldwide with adapted overalls — a SAM-best (~90) draft faces roughly the same
  odds a worldwide dream (~95) does, instead of SAM being trivially easy.
- **Share preview**: the share button now opens a preview modal (image + caption)
  with native Share (image + text), an X compose intent, or a plain download. The
  share image now shows the **drafted roster as rarity-framed mini-cards**.
- **Follow on X pill** on the home, next to Join the Discord.

### Changed
- **Difficulty retuned to live targets** (measured for ~90 "good" / ~92 "elite" /
  ~95 "dream" teams): Normal `opponentRatingShift` 0 → **-1.0** (a good team can
  win, an elite has strong odds); Hard `{elite 1.15…}` → **`{elite 0.7, strong
  1.1, solid 1.0, underdog 0.7}`** + shift 0.3 → **-0.2** (a 90 can't win, a 92
  elite ~10%, a 95 dream comfortably); Legacy shift 0.6 → **0.2**, elite weight
  1.8 → **1.4** (a 95 dream ~10%, a 92 elite very rarely). Hard's real difficulty
  remains drafting with overalls hidden. `balance.test.ts` Hard band rebased.
- **Chemistry reworked** (engine + CHEMISTRY): **Perfect only at a FULL bar** (raw
  ≥ maxRaw; tiers Perfect=100). **Shared org now outranks country** (org 3 >
  country 2) and **Perfect requires real org/lineup overlap** — a country-only (or
  country+staff) stack tops out at Good, never Perfect. Same-country/-org/-lineup
  pairs are **merged into one breakdown line** (a 3-player Brazil core reads as one
  "Same country +6", not three +2s). Coach/sub now state a **named reason**
  ("coached this lineup" / "same org" / "same country") instead of a vague
  "connection". `maxRaw` 12 → 15.
- **Special cards show the DRAFTED org on your field** (and in the draft offer), not
  the special's historical org — a yanxnz FURIA special drafted from a Rebel offer
  now wears the Rebel crest. The special keeps its moment for art/title + chemistry,
  and the Collection still shows the moment (resolves via the special's own base
  card). Updates DESIGN-DECISIONS #23.
- **Header "Play" always opens Setup**, even mid-run on `/play` (clears the run).
- **"Who ended your run" cards** now use the team-review screen's proven 6-card row
  (3-up mobile / 6-up desktop, fluid `max-w-32` cells) instead of a cramped
  flex-wrap — the layout that fixed the long-standing mobile overflow there.

### Fixed
- Share card download now goes via a Blob URL (revoked after use) instead of a
  giant data-URL `href`.

## [1.3.0] — 2026 · Rewards, chemistry, legacy rebalance + sim/UI overhaul

A large gameplay update. Progression now **unlocks content**; Legacy is finally
winnable for a great draft; chemistry is reachable; tournament fields are
org-unique; the Match Center and playoff reveal were reworked; and the community
SAM overall review landed. The Challenges feature was **designed** (see
`docs/CHALLENGES-DESIGN.md`) and deferred to a later release.

### Added
- **Rank-gated reward system** (`RANK_REWARDS`, `engine/progression`): special-card
  **rarities unlock by rank** — Unranked none · Bronze rare · Silver epic ·
  Gold/Platinum mythic · Diamond+ legendary — and the special **appearance chance
  ramps at the top** (Champion 8% · Grand Champion 12% · SSL 16%; Bronze–Diamond
  stay the familiar 5%). The **Collection is locked until Bronze** with a clear
  "reach Bronze" panel, and the rarity-progress tiles show **"Unlocks at <Rank>"**
  hints. **Hard mode unlocks at Silver** (Legacy still needs a Hard win on top);
  existing Hard/Legacy winners keep access. **Bronze lowered 400→300 XP** so one
  run — win or lose — clears the Unranked on-ramp. New `engine/progression.test.ts`
  pins the whole ladder.
- **New chemistry sources** (reachable Perfect, especially region-locked): a
  **same-region pair** link (the weakest pairwise tier — the floor that lifts a
  mixed-nationality roster out of Poor) and **coach/sub nationality** links (same
  country, or region at half), within the existing staff caps.
- **`docs/CHALLENGES-DESIGN.md`** — full design for rank-unlocked "beat-the-line"
  puzzles. Design only; implementation deferred.

### Changed
- **Org-unique tournament fields**: the Swiss/quick field now draws **one lineup
  per org** (graceful fallback for tiny regional pools), so a bracket is a set of
  distinct teams instead of "FURIA 24 + FURIA 25 + …".
- **Special cards in hidden-overall (Hard/Legacy) mode** now always show their
  **photo, identity (title/org/season) and full buff** — only the overall number
  and the rarity label stay hidden, matching base cards and GAME-DESIGN §11/§14.
  (Reverts the v0.7 over-masking.)
- **Match Center games split by outcome**: each game card lands in the **winner's
  column** (mirroring the scoreline — teamA left, teamB right), so a 4-2 series
  reads as 4 cards under one team and 2 under the other, instead of a chronological
  flow.
- **Playoffs reveal a whole round at once**: entering a round shows **all its
  matchups** (teams + overalls); the user's match plays, then the other results
  reveal one-by-one before advancing. (Previously only the user's match showed
  until its result.)
- **Draft anti-frustration tilt** (`DRAFT.tierBias`, 0.35): offers are *softly*
  weighted toward historically stronger lineups so a long session is less of a
  parade of no-hope teams — weak rosters still appear. Global and
  difficulty-independent; the **daily draw stays byte-identical** (mode-gated).

### Balance
- **Legacy made winnable** (live feedback: a 2-hour session, zero titles).
  `opponentRatingShift` 1.2→**0.6**, `opponentTierWeights` elite 2.6→**1.8**
  (a mixed gauntlet, not all-elite), user `chemistryMaxBonus` 2.6→**2.9**. Net:
  a great, chemistry-built draft (~95.5+) now wins Legacy ~**8%** of runs while a
  merely-good (92.5) team still almost never lifts it — the crown is a real but
  rare achievement. Combined with org-unique fields this dismantles the SAM "FURIA
  wall". The `balance.test.ts` Legacy band was rebased to the new intent and a
  **reachability assertion** added (a strong draft *must* be able to win it).
- **Hard**: user `chemistryMaxBonus` 2.1→**2.3** (chemistry is the player's
  asymmetric edge here — the AI cap stays 0).
- **Community SAM overall review** (`data-sources/overall-review-v1.3.csv`): **69
  overalls** adjusted via the repeatable review tool (zero drift). Roster fixes:
  Team Secret coach **BRUNOVISQUII** added (2122 ovr 79 · 2024/2025 ovr 84),
  **FURIA 2025 coach corrected to STL** (was mis-assigned BRUNOVISQUII), **EndGame
  2022-23 Luk→Royales**, **Kronovi iBUYPOWER S1 92→97**. The SAM `legacy`
  historicalStrength floors were already consistent.
- **Normal anchor**: org-unique fields restored the good-team Normal title rate;
  the test sample was raised 300→1000 runs to read the true ~5.5% reliably past
  the 5% line (the field is a touch stronger after the overall review).

### Fixed
- **Tournament fields could draw an org's multiple seasons into one bracket**
  (e.g. FURIA 24 + FURIA 25). Root cause: `generateOpponents` sampled lineups
  with no org-uniqueness guard. Now one lineup per org, with a fallback that only
  repeats an org when a small regional pool can't otherwise fill the field.

## [1.2.7] — 2026 · Info pages, full PT translation + technical polish

New static info pages with full Portuguese, richer page metadata and structured
data, a web app manifest, and a few technical/perf tidy-ups. No gameplay or
balance changes.

### Added
- **Six info pages, bilingual (EN + localized PT URLs), server-rendered and
  static**: `/about`, `/faq`, `/ratings` (overall methodology), `/strategy`,
  `/special-cards`, `/sam` (South America) and their PT twins `/pt`, `/pt/sobre`,
  `/pt/faq`, `/pt/overalls`, `/pt/estrategia`, `/pt/cartas-especiais`, `/pt/sam`.
  Copy fact-checked against `GAME-DESIGN.md` (no invented players/stats).
  `/special-cards` is a curated **no-spoiler** showcase — the in-game `???`
  collection mystery is untouched (DESIGN-DECISIONS #59).
- **Bilingual content**: the EN/PT toggle now also translates these pages + the
  home's lower content block in place — `LocaleContent` is mounted-gated to each
  URL's locale; landing on a `/pt` URL switches the whole UI to Portuguese
  (`SyncLocale`). `hreflang` (en-US ↔ pt-BR ↔ x-default) links each pair via
  `src/lib/contentMeta.ts`. (DESIGN-DECISIONS #56–57.)
- **GWR credited** as the overall-balancing lead on `/about` and `/ratings`
  (EN + PT), alongside the existing footer credit.
- **Structured data**: `BreadcrumbList` on hub pages, `FAQPage` on `/faq`,
  `HowTo` on `/how-to-play`, plus an `ItemList` builder — alongside the existing
  site-wide `VideoGame`. Helpers in `src/lib/jsonld.ts` + `<JsonLd>`.
- **Web app manifest** (`/manifest.webmanifest`) + a generated **apple-icon**.
- **`src/data/counts.ts`** — a light module for the home's "x/89" denominators so
  the menu stops importing the full `@/data` barrel just for two integers.

### Changed
- **Home** split into a server shell (`page.tsx`, metadata) and a client island
  (`HomeMenu.tsx`) that also carries the lower content block. The route map lives
  in `pageRoutes.ts` (no JSON imports) so the home bundle stays lean.
- **Footer**: added `About` + `FAQ` links; the draftrlcs.app attribution is now
  plain text (credit retained, link removed). Removed `isBasedOn` from the
  VideoGame JSON-LD.
- **Sitemap**: stable per-release `lastModified` (was `new Date()` every build),
  all new EN+PT routes, and `hreflang` alternates.
- **`RankBadge`** no longer sets `fetchPriority="high"` on the decorative,
  mounted-gated rank emblem (it paints after hydration, so the priority was wasted).
- **Canonical host signals** (metadataBase / sitemap / robots / canonical tags)
  are consistent on the apex. Removed a redundant in-code `www`→apex redirect —
  host canonicalization is already handled at the Vercel edge.

### Fixed
- None — no gameplay or balance changes this release.

## [1.2.6] — 2026 · champion-on-Hard scroll fix

### Fixed
- **Champion-on-Hard "can't scroll down"** (`ResultsScreen.tsx`). The first Hard
  championship mandatorily shows the **Legacy-unlock** ceremony, which locks page
  scroll (intended) — but its overlay was `overflow:hidden` (via `.celebrate`) and
  vertically centered, so on a **short viewport** the content and the "tap to
  continue" dismiss hint were clipped off-screen, reading as a stuck scroll lock.
  Only short viewports overflowed, so it didn't reproduce on taller screens. Root
  cause: a centered, overflow-hidden full-screen overlay clips its own dismiss
  affordance when its content exceeds a short viewport. Fix: `CeremonyPortal` is
  now a scroll container (`overflow-y-auto` + a `min-h-full` center-or-scroll
  wrapper) so any ceremony stays reachable; the Legacy rays moved to their own
  fixed clip layer (`.celebrate-rays-prism` CSS untouched → the champion hero is
  unaffected); the body-scroll lock now captures/restores the prior value. Verified
  live at 880×300 (overlay scrolls, hint reachable, scroll restored on dismiss).

## [1.2.5] — 2026 · SAM overall review + Legacy relevance + Hard/Legacy rebalance

A community overall-review pass (151 reviewed overalls), a new `legacy` lineup
flag that lifts hand-picked SAM landmark rosters into the legacy gauntlet, and a
Hard/Legacy rebalance that makes chemistry the player's edge.

### Added
- **`legacy` lineup flag** (`data-sources/teams.md` → `scripts/build-dataset.mjs`).
  A block tagged `flag: … legacy` has its `historicalStrength` floored at
  **"strong"** regardless of average overall, so the difficulty-based opponent
  sampler (`balance.ts → opponentTierWeights`) surfaces it in the **legacy**
  gauntlet — without inflating the underlying card ratings. It only weights
  opponent generation; the draft pool is untouched, and a naturally-elite lineup
  is never downgraded. Applied to **20** community-flagged SAM regional landmark
  rosters (KRÜ, Complexity, The Three Sins, Noble, eRa, Exeed, NiP, w7m,
  Godfidence, Sunset, …) that previously sat at solid/underdog and were filtered
  out of SAM legacy runs. Their expected share of a SAM-legacy opponent field
  rises from ~21% to ~74%.

### Balance
- **Community overall review applied** (`data-sources/teams.md`, regenerated +
  validated). 151 reviewed overalls from the shared review CSV — **113 player,
  21 sub, 17 coach** cards, all SAM teams (deltas +1…+25, avg +5.1; e.g. Erodium
  S7 valt 73→80, Noble esports X renaN 75→83, Most Wanted S9 math 79→84). The
  CSV's "OVR atual" column matched the dataset exactly on all 151 rows before the
  bump (no drift). Player/sub/coach ratings only — identities and lineups
  unchanged (org buffs: see Fixed).
- **Hard & Legacy rebalanced — chemistry is now the player's edge.** Players
  reported a very good team still getting knocked out in the Hard/Legacy Swiss.
  Cause: every AI lineup is a real roster at ~100% chemistry, so the shared
  chemistry cap was a near-flat field-wide buff a drafted team (~20% chemistry)
  couldn't match. New `opponentChemistryMaxBonus` (`balance.ts`) is **0 on Hard
  and Legacy** — opponents keep their rating shift, stronger field, hidden
  overalls and specials, but no longer bank a chemistry bonus the player can't.
  Easy/Normal unchanged. A "good" (~92.5) drafted team's playoff odds go ~65%→~88%
  on Hard and ~5%→~28% on Legacy; Legacy stays a brutal gauntlet (title still a
  long shot) and the ladder still reads Normal < Hard < Legacy. Overall-dominant
  anchors (GAME-DESIGN §25) untouched; a Legacy case was added to the sanity
  suite. See DESIGN-DECISIONS #54.

### Fixed
- **Data-pipeline drift reconciled** (`data-sources/teams.md` ↔ generated JSON).
  Rebuilding from `teams.md` surfaced two pre-existing spots where the generated
  JSON had been edited out-of-band without updating the source (against the
  pipeline contract): (1) the **v1.2.3 "org buffs small fixes"** — 23 org-buff
  bumps hand-applied straight to `lineups.json` — are now written back into the
  `teams.md` `org:` lines so they survive a rebuild (**net org-buff change vs the
  shipped data: none**); (2) **swiftt** (FURIA 2026) carried a stale `88` in
  `lineups.json` vs the canonical `87` in `teams.md` — the review CSV agrees (87)
  — regenerated to 87. `teams.md` is the single source of truth again and a clean
  `build:data` is now idempotent. `orgs.json` default buff levels are regenerated
  to match (18 orgs); this is the org-card *default/fallback* only — in-match org
  buffs are read per-lineup (`lineups[].orgBuffLevel`, unchanged), so gameplay is
  unaffected.

## [1.2.4] — 2026 · analytics

Post-launch analytics: detailed, **free** product analytics so we can see how
the game is actually played (runs by difficulty, win-rate, where players drop
off) without the paid Vercel events tier.

### Added
- **PostHog product analytics** (`posthog-js`) as a second analytics sink
  alongside Vercel Web Analytics. The typed `trackEvent` wrapper
  (`src/lib/analytics.ts`) now fans the same events out to BOTH; a new
  `PostHogProvider` (`src/components/PostHogProvider.tsx`) bootstraps it in the
  root layout. Configured cookieless + anonymous (localStorage persistence, no
  `identify`, autocapture and session recording off, DNT respected) so the
  privacy promise is unchanged. **No-op until `NEXT_PUBLIC_POSTHOG_KEY` is set**
  (env), so local dev and an unconfigured build behave exactly as before.
  Unlocks funnels (visit → run_started → tournament_started → run_completed),
  retention / returning players, and difficulty / win-rate breakdowns on the
  free tier.
- **`run_abandoned` event** — emitted from the run store when a run is left
  before its results screen, with `phase` (draft / review / tournament) and
  `reason` (`"quit"` to the menu / `"restart"`). Turns the funnel's implicit
  drop-off into an explicit, attributable signal.
- **SPA-aware pageviews** for PostHog (`capture_pageview: "history_change"`,
  App Router route changes), and a documented `.env.local` template for the two
  `NEXT_PUBLIC_POSTHOG_*` vars.

### Changed
- **Privacy policy — Analytics section** (EN + PT) now names both processors
  (Vercel + PostHog), states the cookieless / anonymous / DNT configuration, and
  notes that aggregate gameplay (difficulty mix, completion) is measured — not
  only page visits.

## [1.2.3] — 2026 · org buff fixes

### Balance
- **Org buff small fixes** — 23 per-season org-buff levels were hand-tuned for
  SAM regional + 2026 teams. (Edited directly into `lineups.json`; v1.2.5
  reconciled them back into `data-sources/teams.md` as the source of truth — see
  [1.2.5] → Fixed.)

## [1.2.2] — 2026

A small post-launch patch: a clearer org/coach buff readout plus roster data
corrections.

### Changed
- **Org & coach buff readout is now plain-language** (`GameCard.tsx`). The org
  card's cryptic centre symbol (`·` for neutral, `+`/`++`/`+++` for a boost) and
  matching nameplate text confused players. A neutral org now reads a muted
  **"—" / "No buff"**; a boost reads a numeric **"+2" / "Mechanics +2"** (the tier
  as a number). Coach buff pills use the same **"Stat +N"** form for consistency.

### Fixed
- **Roster / coach data** (`data-sources/teams.md`, regenerated + validated):
  coaches added — Team Liquid 2022-23 **xpere** (85), mousesports S9 **Lethamyr**
  (79), Evil Geniuses S5 **fireworks** (75), Canberra Havoc S8 **Jimmah** (72);
  FURIA 2024 coach corrected to **STL** (was brunovisqui).
- **`SnipJuzo` unified into `snipjz`** — the two ids were the same person; the
  FantasyDeath S7 card now resolves to `snipjz` (3 cards across his teams).

## [1.2.1] — 2026 · launch polish

The final pass before the public launch: a featured Daily, a special-card buff
tag, mobile card-fit fixes, more reachable chemistry, and SEO copy polish.

### Added
- **Authored Daily Challenges** (`src/lib/daily.ts`). A new `AUTHORED_DAILIES`
  map lets a specific date OVERRIDE the template wheel with a hand-designed
  config; `generateDailyConfig` short-circuits to it. Today (**2026-06-17**) is
  **"Loaded Draft"**: a **stronger field** (Hard difficulty) with **overalls left
  visible** so the cards show off, and a **hand-scripted 6-pick draft** — balanced,
  distinct orgs, a single Dignitas — where **al0t's special lands on pick 2** and
  **violentpanda's "Brain" legend (OVR 97) on pick 5**, with a deliberately weaker
  team (Gen.G, carrying the coach+sub) right before it. Deterministic by
  construction, so it stays "the same run for everyone."
- **Scripted daily draft** (`DraftState.scriptedLineups`: an exact lineup per pick,
  each optionally forcing a player to appear as a specific special; threaded
  through `createDraft` → `daily` → `runStore`). `drawNextOffer` offers the
  authored lineup for each pick (keyed off picks made, so it's reroll-proof) and
  `buildOffer` forces the scripted special onto that player — shown regardless of
  whether the slot is still open (the legend still APPEARS at pick 5; it's only
  pickable if a player slot was left open, which the weaker pick-4 team nudges by
  carrying the coach/sub the player wants instead). A scripted offer that can't
  fill the remaining slots falls back to a normal staff-aware draw, so the run
  always completes. Natural specials are suppressed (`specialChanceMult: 0`) so
  only the two authored cards appear; no rerolls (the draft is curated). Inert
  unless the field is set (default runs are byte-identical).
- **Special-card buff tag** (`GameCard.tsx`). Every special now wears a small
  pill advertising its boost — `+5 MEC`, `+3 OFF·CON`, `+5 Team` — reusing the
  existing `Badge` (`tone="good"`). On hidden-overall / Hard runs the value masks
  to `+?? MEC` (stat shown, amount hidden), per direction. It never reveals the
  card's identity, so it shows even on not-yet-unlocked specials in the draft.

### Changed
- **Daily overall-visibility is now the daily's own call**, decoupled from the
  difficulty's hidden-lock (`runStore.startDailyRun`). A Daily can run a stronger
  field (Hard) while keeping overalls visible — `config.hiddenOverall` is the
  single source of truth. (Also fixes the latent "Champions Only" template, which
  declared `hiddenOverall: false` but was being force-hidden by Hard.)
- **Achievements read varied, not monochrome-per-tier** (`achievementStyle.ts`).
  Each non-Legend tier now spreads across several distinct hues (Common: cool
  muted; Rare: cool brights; Epic: vivid jewels) so the trophy wall looks varied;
  vividness still rises with rarity. **Legend stays standardized** — one prismatic
  look for every legend, unchanged.
- **Results team-reveal staff row matches the players** (`ResultsScreen.tsx`).
  On desktop the coach/sub/org cards now use the same size and spacing as the
  three player cards, aligned on one row (a `sm+` grid mirroring the top). Mobile
  layout is preserved (and its card-fit is fixed below).
- **Region chips match the Worldwide label size** (`SetupScreen.tsx`): the region
  codes went `text-sm` → `text-base` (16px), so they no longer read squished.
- **In-card org logos shrink on mobile only** (`GameCard.tsx`). After the v1.2.0
  enlargement (`lg` = 72px) the logo crowded out the nameplate on small cards;
  it now steps down on mobile (`40px` base / `56px` `sm`) and restores to the
  full `72px` at `md+` — desktop is untouched. Card mobile padding and the overall
  number also tighten a step on mobile to keep every line inside the frame.
- **SEO copy polish** (no score regression, just sharper): refreshed `<title>`,
  a deduplicated/expanded `keywords` set, an `Esports` schema genre, a stronger
  product `description` (EN + PT, feeds metadata/OG/hero), and the OG / link-preview
  image now leads with the SAME logo lockup as the site header (the `icon.svg`
  hexagon mark + the ink/orange "RocketDraft" wordmark).

### Balance
- **Perfect chemistry is reachable** (`balance.ts` `CHEMISTRY.tiers`). Tier
  thresholds lowered — Perfect 80→72, Great 58→52, Good 36→32, Okay 15→14 — so a
  committed coherent roster (a 3-player country stack = 9 raw = 75%, or a lineup
  pair + org/coach links) now lands **Perfect** instead of stalling at Great.
  This is a label remap ONLY: the chemistry rating reward is percent-based
  (`rating.ts`), so it is unchanged, the overall-dominant anchors (GAME-DESIGN
  §25) still hold, and the AI (already ~100% chemistry) is not buffed. The 50-test
  suite — including the chemistry and full-tournament anchors — stays green.

### Fixed
- **The Creator card showed no field effect.** `FieldView.fieldFx` switches on the
  special's rarity to pick the on-pitch glow/border/holo, but the `switch` had no
  `creator` case (added after the other four), so the newest rarity fell through
  to "no effect" — on both mobile and desktop. Added the `creator` case (rose/pink
  at mythic energy, matching `.card-creator` / `.ovr-creator` in `globals.css`).
- **`how-to-play` AND `play` route metadata claimed a "budget" mechanic** that
  doesn't exist (both inherited the phrasing from the v1.1.4 per-page SEO pass) —
  both reworded to "build team chemistry" (accurate; both pages are indexed).
- **Daily "Good+/Great+ chemistry" objectives now track the tier floors.** The
  satisfaction gates in `results.ts` were hardcoded (40% / 62%) and drifted from
  the displayed tier after this patch's threshold change; they now read
  `CHEMISTRY.tiers` (Good 32% / Great 52%), so the objective passes exactly when
  the chemistry badge shows that tier. (Featured launch day isn't affected — it
  runs a win-title objective.)

## [1.2.0] — 2026 · "Regional Champions"

A second draft pool per region, the SAM Top-8 import, an easter-egg card, and a
batch of UX polish. Prep for the public launch.

### Added
- **Region-locked draft mode.** A new "Region" picker on the setup screen
  (`SetupScreen.tsx`), for both Classic and Quick: **Worldwide** (default — the
  Worlds/finals pool, unchanged) or a region. Only **SAM** is live; the other six
  show a disabled **"Em Breve" / "Coming soon"** state. A region-locked run draws
  from that region's FULL pool — its Worlds finalists PLUS its regional Top-8
  teams. Pool computed in `runStore.startRun` via `lineupPoolForRegion(region)`
  (`src/data`) and threaded through `createDraft`'s `poolLineupIds` into both the
  draft and the opponent field. `RunState.regionLock` persists it across reload /
  "play again"; `profileStore` remembers the last choice (`lastRegionLock`).
- **SAM (South America) regional dataset — 46 new lineups.** The SAM Top-8 teams
  that did NOT reach Worlds (S7→2025), researched from Liquipedia, merged into
  `data-sources/teams.md` under a labeled "Regional Top-8 (sam-only)" trailing
  section (parser reads season from each team line, region from `### SAM`). +72
  players, +138 cards → 254 lineups / 372 players / 762 cards; the Worlds /
  draftable pool stays **208**. Every block carries `flag: sam-only` → `samOnly`.
- **`samOnly` separation tag.** New `Lineup.samOnly` (schema + generator + type).
  A new `draftableLineups` export (`!samOnly`) is the default pool for the general
  draft, opponents AND daily challenges, so regional teams never leak into them.
- **"Creator" special-card rarity + the Wings easter egg.** A new `creator`
  rarity (pink/violet frame, rose-pink OVR, mythic-tier halo, `holo-creator`
  sheen). One unique card — **"Rocket Draft Creator"** (player `liberatorl`,
  OVR 91) — whose effect lifts EVERY team attribute by +2. It lives on **Wings
  E-Sports · S2**, a hidden SAM-region lineup (`rareSpawn`) that is EXCLUDED from
  the normal draw and the opponent pool and instead **force-injected** into one
  draft offer at `DRAFT.easterEggChance` (≈1%/offer, region-locked only); when it
  appears, LiberatoRL's card is GUARANTEED to be the Creator special, so the prize
  isn't gated behind a second 5% roll. Player specials can now carry
  `team_attribute_boost` (was coach-only) — applied for the user and AI teams.
- **Regional first-run tutorial** (`RunOnboarding`): a one-time "Regional Draft"
  modal (flag `seenRegionalIntro`) that chains after How-to-play.
- **Two achievements:** `regional-champion` ("Regional Royalty" — win a
  region-locked run) and the **secret** `creator` ("The Creator's Card" — unlock
  the hidden card). New optional `AchievementDef.secret` masks it as "???" in the
  grid until earned.

### Changed
- **Onboarding tutorials are more visual** — themed numbered step cards
  (how-to orange · regional emerald · legacy cyan), larger gradient badges,
  emphasized intro line.
- **Celebratory overlays are robustly full-screen.** The unlock-ceremony, rank-up
  AND Legacy-unlock now render through a shared `CeremonyPortal` that portals onto
  `<body>`. Root cause they needed it: the results screen animates with a
  `rise-in` transform, whose containing block was re-anchoring the previously
  inline `position: fixed` overlays (most visibly the Legacy unlock, which read as
  "not full-screen").
- **Celebrations advance ONLY on user input** — removed the auto-dismiss / auto-
  advance timers (unlock 1s + 3.2s, rank-up 4.2s, Legacy 5.2s). They now wait for
  a tap / Continue.
- **Region selector UX** (`SetupScreen.tsx`): the full-width **Worldwide** card
  is back on top (the default); below it a **4-then-3 grid** of equal-size region
  chips fills the container. Only **SAM** is selectable; the tags reuse the
  difficulty-mode Badges — orange **Selected** and neutral grey **Coming soon**.
  No SAM accent green. A dynamic line below names the locked region.
- **In-card logos enlarged** — `TeamLogo` md/lg/xl bumped a notch for readability
  on the draft/result cards, without overlapping the card frame.
- **Achievements reclassified into rarity tiers** — **Common · Rare · Epic ·
  Legend** (was Milestone/Skill/Collection/Legend), recoloured to match
  (slate / blue / violet / prismatic). 24 achievements: 4 common, 9 rare, 6 epic,
  5 legend.
- **Results team-reveal reworked.** The drafted line-up now shows as three
  draft-sized cards across the pitch (the middle one raised, the outer two
  aligned) with the coach/sub/org in a spaced row below — replacing the cramped
  flat grid. Achievement unlocks keep the existing corner toasts (unchanged).
- **Eliminator strip ("who ended your run") realigned** to a tidy left-aligned row.
- **Creator card reads simply "Creator"** (no rarity-type line) and is pinned
  **last** among unlocked cards in the collection (lowest sort weight).
- Version → **1.2.0 "Regional Champions"** (`site.ts` + `package.json`); reader-facing site
  changelog updated (EN + PT).

### Balance
- `DRAFT.easterEggChance = 0.01` — per-offer chance to force-inject the easter-egg
  lineup (Wings) when a region-locked pool contains one. The `&&` short-circuits
  when no `rareSpawn` lineup is present, so the seeded daily/general draws stay
  byte-identical (≈8-10% over a classic run, 3-6% over quick; tune in `balance.ts`).
- `SPECIALS.rarityWeights.creator = 12`; `XP.specialUnlock.creator = 100`.
- **Chemistry reworked to be a real lever.** Per-pair/link weights rebalanced
  (same-lineup 4 · same-country 3 · same-org 2 · org-link 1.5/player · coach 1.5
  cap 3 · sub 1 cap 2), `maxRaw 12`, tiers re-floored (Perfect 80 / Great 58 /
  Good 36 / Okay 15). A coherent roster (shared country / org / historical lineup)
  now reaches Great–Perfect, so the boost is worth chasing over a higher-rated
  all-star mix — the top overall is no longer always the smart pick. Per-difficulty
  `chemistryMaxBonus` raised (easy 1.0→1.3, normal 1.6→2.0, hard 1.8→2.1,
  legacy 2.2→2.6). `chemistry.test.ts` rewritten to the new weights + reachability
  anchors; `balance.test.ts` unaffected (fixed user team). The first-run tutorial
  now explains chemistry as the player's edge.

### Fixed
- **Overall-visibility toggle stayed off after Hard.** Selecting Hard/Legacy
  correctly locks overalls hidden, but switching back to Normal/Easy left the
  toggle off. Root cause: the difficulty button only called `setDifficulty`; the
  `showOverall` preference was never restored when the new difficulty unlocked it.
  Fix (`SetupScreen.tsx`): on a locked→open difficulty change, re-enable overalls.
- **"The Three Sins" showed Ellevens' logo**, and a few SAM orgs collided on the
  Liquipedia name-search. Pinned exact `File:` overrides (`the-three-sins`,
  `denial-esports`) and monogram fallbacks (`northern-gaming`, `cringe-society`,
  `senbei-strikers`) in `asset-overrides.json`; re-verified no duplicate logos
  (except the intentional FUT NA/SSA share) and dark-card contrast per-logo.
- **Slot-machine reel showed non-pool teams in regional mode.** The draft reel now
  spins only over the run's actual lineup pool (`run.draft.poolLineupIds`), so a
  region-locked run never flashes a team outside its region.

### Data / generator / docs
- `scripts/build-dataset.mjs`: parses `flag: sam-only` and `rare`; added SAM Top-8
  `COUNTRY` entries. Per Miguel's notes: `obtth`/`liberatorl`/`ninja23509` = BR;
  `diaz` kept as the single existing NA player (no `diaz-sam` split);
  `brunovisquii` kept as FURIA 2025 coach. Fixed the Wings block's season key
  (`· 2016` → `· S2 · 2016`).
- **Reviewed overalls integrated** (manual review-pass CSV from Miguel's friend):
  **162 overall edits** across all regions + **9 coach fixes** — 3 corrections
  (FC Barcelona S7 → `Roken`, Veloce S8 → `miztik`, FUT NA 2026 → `adam_baguette`)
  and 6 missing coaches added (Team Secret 22-23, and Twisted Minds / NiP /
  Shopify / SSG / PWR 2026). `COUNTRY` += `adambaguette` FR, `lbp` AU; coaches
  114 → 120. Applied via a matched + nick-verified migration over `teams.md`.
- **Footer credit:** added **GWR** ([x.com/zgwr_rl](https://x.com/zgwr_rl)), who
  helped balance the overalls (`site.ts` `balanceCreditName/Url`, `SiteFooter`).
- **Org logos completed + logo-era system extended.** Fetched every missing SAM
  org logo from Liquipedia (`npm run fetch:assets --orgs`), curating exact
  `File:` titles in `asset-overrides.json` for the ~14 where the name-search
  grabbed another org's logo (`w7m`, `hawks`, `monos`, `ruby`, `endgame`, …).
  Orgs with no Liquipedia logo (`bodybuilders`, `era`, `poison-bullets`,
  `sapphire`, `wings-e-sports`, `pioneers-oce`) fall back to the styled monogram.
  Added season-correct `ORG_LOGO_ERAS` for **NRG** (2016/2017/2019/2020 → 2024),
  **Dignitas** (2018 → 2025), **Spacestation** (2021 → 2023) and **Team Vitality**
  (2018 → modern), using dark-card-legible variants (verified by per-logo
  luminance — several `lightmode` files were near-black and swapped to `darkmode`).
  Coverage: 128 logos + 6 intentional monograms, 0 gaps. ATTRIBUTION.md (CC-BY-SA)
  regenerated.
- Profile persist bumped to **v3** with a backfill migration (deep-merges new
  `settings.lastRegionLock` + `flags.seenRegionalIntro` onto older saves).
- Review aids: `data-sources/sam-pending/overall-review.csv` (every team) +
  `overall-review.md` (the new SAM teams) for the manual overall pass.
- New `src/engine/regional.test.ts` (pool separation · regional pool · rare-spawn
  rarity · Creator team boost). Suite: **49 tests**, all green; `tsc` clean; lint
  at the 8-error baseline (0 new).
- **Open item:** `SnipJuzo` vs `snipjz` may be the same person under two ids —
  left separate pending confirmation.

---

## [1.1.7] — 2026

### Changed
- **Performance (PageSpeed): render-blocking CSS removed.** Enabled
  `experimental.inlineCss` in `next.config.ts` — the Tailwind CSS is now inlined
  into the HTML `<head>` instead of two render-blocking `<link rel="stylesheet">`
  requests (~590 ms of render-blocking on mobile per Lighthouse). Build-verified:
  the prerendered home has **1 inline `<style>` and 0 blocking CSS links**. Helps
  FCP/LCP (mobile LCP was render-delay-bound). Must be deployed before PageSpeed
  reflects it.
- **Modern `browserslist`** added to `package.json` (Chrome/Edge/FF ≥111,
  Safari/iOS ≥16.4) so SWC stops shipping ~14 KiB of legacy polyfills
  (`Array.at/flat/flatMap`, `Object.fromEntries/hasOwn`, `String.trimStart/End`)
  — all targeted browsers support these natively. (Observed post-deploy: Next 16
  still emits these polyfills regardless, so no measurable effect — kept as a
  modern-target baseline.) Net result after deploy: PageSpeed **mobile ~95 /
  desktop ~99** (warm run; the inlineCss change took mobile LCP 3.5s→1.4s).

> Still pending (tracked in STATUS): the home page imports the full dataset +
> Zod for two counts + `daily.info` (~94 KiB unused JS on the landing page) —
> a refactor saved for a focused follow-up (it touches the deterministic daily).

## [1.1.6] — 2026

### Fixed
- **Site not indexing on Google — apex/www canonical conflict.** The app is
  canonical on the apex (`SITE.url = https://rocketdraft.app` → `metadataBase`,
  sitemap, robots, every page canonical), but Vercel was redirecting
  apex → www (308). Googlebot hit `rocketdraft.app` → 308 → `www…`, whose
  canonical pointed back at the *redirecting* apex, so Search Console reported
  "Page with redirect", canonical "N/D", and refused to index.
  - **Fix:** made the **apex the primary served domain** and flipped the redirect
    to **`www → apex`** (Vercel → Domains). **No code change** — the code was
    already apex-canonical; only the redirect direction was wrong.
  - Verified live: apex `200`, `www → apex` `308`, `http → https` `308`, and
    sitemap/robots/all canonicals on apex+https. Pages now show under
    `site:rocketdraft.app`. Root cause: redirect direction contradicted the
    declared canonical. Remaining (Miguel, Search Console): submit the sitemap;
    the stale `http://` homepage entry self-heals on re-crawl.

### Added
- **SAM (South America) regional Top-8 dataset — staged for the "SAM Only"
  mode.** `data-sources/sam-pending/` holds `teams-sam.md` (45 new Top-8 SAM
  lineups, S7→2025, that did NOT reach Worlds/Finals, each flagged
  `flag: sam-only`), `sam-merge-notes.md` (merge steps + the generator change
  for the flag + `COUNTRY` additions + dedup/collision map + overall methodology
  + per-season Top-8 tables + Liquipedia sources) and `validate-sam.mjs`.
  **Inert:** `build:data` only reads `teams.md`, so this does NOT affect the game
  yet — it ships with the SAM-only mode patch. Researched from Liquipedia
  (rosters sourced; overalls anchored to existing dataset values per
  player/season). Validated: 0 duplicate lineup ids vs the 208 existing teams.

## [1.1.5] — 2026

### Fixed
- **Player nationalities completed + corrected from Liquipedia.** Most players
  had no country (so same-country chemistry skipped them and flags were missing
  or wrong). New audit tool `scripts/fetch-nationalities.mjs` read every player's
  Liquipedia `{{Infobox player}}` `|country=` and compared it to the curated
  `COUNTRY` map: **137 → 2 players without a country** (only `Ghaazi0` and
  `Plu'oh` have no LP page; left countryless rather than guessed). **158 entries
  written** to `COUNTRY` in `build-dataset.mjs` (134 fills + 22 verified
  corrections + 2 manual). Real fixes included e.g. `al0t` FI→SE, `deevo` AU→GB,
  `radosin` CZ→FR, `ronaky` ES→DK, `eversax` FR→BE, and the SSA-guessed `lawler`
  /`leoro`/`noxes` ZA→US/ES/PR (imports, not South Africans).
  - Each suspect was verified by hand against the LP infobox (id/name/team).
    **Wrong matches were rejected** (a shared handle resolving to a *different*
    person) and kept their prior value: `scrub` (≠ "Scrub Killa"), `greazy`
    (≠ "gReazymeister"), `torres823` (≠ "TORRES8232"), `jhzer`, `kairos`
    (LP says US but the real name is Brazilian — kept BR). Region-odd but
    id-confirmed imports (APAC/SSA Western players) were applied intentionally.
  - Root cause: the original `COUNTRY` map was a small high-confidence-only
    hand pass, so ~133 players were never assigned and a handful were guessed
    wrong. Evidence: `data-sources/nationalities-audit.md`.

### Added
- **13 new country flags** (`ch cl id ie is ma my no nz pr pt sg th`) fetched to
  `public/flags/` by `npm run fetch:assets -- --flags`, which now sees the new
  ISO codes in the rebuilt data (21 → 34 flags).

---

## [1.1.4] — 2026

### Added
- **Per-page SEO metadata** for `/play`, `/collection`, `/how-to-play` and
  `/achievements`. They were client components (can't export `metadata`), so all
  four inherited the home page's title/description — Google would have indexed
  them with the same generic title. Each is now split into a server `page.tsx`
  that exports a unique `title` + `description` + canonical and renders its
  client `…View` (the same pattern already used for `/privacy` and `/changelog`;
  `git mv` preserved the view bytes). Verified in the production build: the
  prerendered HTML carries the distinct `<title>`, `<meta name="description">`
  and `<link rel="canonical">` per route.

---

## [1.1.1 – 1.1.3] — 2026 (shipped)

> Shipped as the post-launch wave across three tags: **1.1.1** visual/special-card
> polish + revamped icon, **1.1.2** full database review + special-card photos,
> **1.1.3** image compression + collection performance. Bundled in one narrative
> below.

A post-launch follow-up: a bigger special-card collection, mobile + onboarding
polish, the analytics/SEO groundwork for measuring real usage, and PT-BR for the
last two English-only pages.

### Added
- **Custom in-game analytics events** — `src/lib/analytics.ts`, a typed
  `trackEvent` wrapper over Vercel Web Analytics, emitted from the run store:
  `run_started` (mode / difficulty / hiddenOverall), `tournament_started`, and
  `run_completed` (placement, won, team overall, swiss W-L, xp). Gives
  completion rate, difficulty mix and win-rate-by-difficulty. Values are scalar
  and non-PII, store-layer only (never in `engine/`); `run_completed` fires once
  per run (finishRun guards re-entry), never from React render.
- **Vercel Speed Insights** (`@vercel/speed-insights`) mounted next to
  `<Analytics/>` in the root layout — page-speed / Web-Vitals data.
- **`season_mvp` special cardType** — a season/league MVP award kept distinct
  from `worlds_mvp` so it isn't mislabelled as a world title. Wired through the
  Zod schema, `SpecialCardType`, and both copy dictionaries (`SPECIAL_TYPE_LABELS`).
- **PT-BR for the Privacy Policy and Changelog pages.** Both moved off hardcoded
  English into `PRIVACY` + `CHANGELOG_PAGE` copy groups and now follow the EN/PT
  switch — the route stays a server component (keeps `metadata` for SEO) and
  renders a client `…View` that reads `useCopy()`. Reverses the earlier
  "EN by design" call for these two pages (see DESIGN-DECISIONS #41).
- **Org logo-era guide**: a step-by-step comment + season-key cheat sheet +
  worked NRG example on `ORG_LOGO_ERAS` (`scripts/build-dataset.mjs`) and a
  recipe in `docs/DATA-GUIDE.md`, so multiple logos per org can be added without
  code help. (The mechanism itself already shipped in v0.5.1.)
- **Hidden dev preview** for reviewing card art: visiting `/collection?dev=1`
  renders every special as unlocked. Visual only — it never writes to the
  profile (real collection / achievements stay honest) and shows a "DEV PREVIEW"
  badge. No UI entry point; `mounted`-gated so the page stays statically rendered.

### Changed
- **Special-card rarity identity reworked** (the cards are the centerpiece):
  legendary OVR is now a **white-gold metallic** gradient (not flat amber) with
  a brighter halo; mythic OVR matches the **border red** with a stronger glow;
  epic moved from teal to a **blue → purple** border with a light-purple OVR;
  rare set to a **deep, dark blue** (slight purple touch) with a matching blue
  OVR, kept clearly distinct from epic. Effect intensity
  now clearly ramps rare → epic → mythic → legendary. Colors live in the
  `.card-*` / `.ovr-*` rules in `globals.css` + `SPECIAL_OVR_COLOR` in GameCard;
  field-glow tints in `FieldView`.
- **Header brand icon** now renders `public/icon.svg` (the same file as the
  favicon) instead of a separate inline SVG, so updating the icon in one place
  updates both.
- **Special-card photos now use `next/image`** — Vercel (and the local
  optimizer) serves a resized **WebP/AVIF** per card at its display size, lazily,
  with **transparency preserved** (so the blended/transparent photos keep
  working). A ~620KB source PNG becomes a **~13KB** WebP at card width (≈98%
  smaller); source files and their framing are untouched. Keeps the collection
  light even with the full 83-card photo set. (Quality left at the default 75 —
  Next 16 rejects non-allowlisted `quality` values.) Image optimization is
  **off in dev** (`images.unoptimized` when `NODE_ENV !== "production"`) so that
  replacing a card photo shows up on a refresh instead of serving a stale cached
  transform; production stays fully optimized.
- **Special-card source photos compressed** — the curated PNGs shipped at
  ~500KB each (600×823), **45.8MB** total. The client never gets them
  (`next/image` transcodes to WebP), but on a cold Vercel cache the optimizer
  still had to download + transform a 500KB source before the first paint —
  measurably dropping the **/collection Speed Insights score (99 → 93)** on a
  full collection. Re-encoded in place to ≤512px-wide quantized PNGs (the
  largest on-screen use is the detail modal at ~208px CSS): **45.8MB → 11.6MB
  (~74% smaller)**, alpha preserved on cut-out photos, no visible quality change
  (the client output WebP is indistinguishable at display size). New
  `scripts/optimize-images.mjs` (`npm run optimize:images`) keeps future photo
  drops light and is idempotent; `--check` fails if any file is over budget.
  Root cause: source PNGs were dropped in at full editor export weight with no
  compression pass.
- **Collection LCP** — the first ~6 (above-the-fold) unlocked card photos now
  load with `priority` (eager + high fetch priority) instead of lazily. The page
  is client-rendered and gated on `localStorage`, so photos only mount after
  hydration; without a priority hint the largest paint waited on
  IntersectionObserver. New optional `priority` prop on `GameCard` → `SpecialArt`
  → `next/image`; passed only to the leading grid cells (unlocked cards sort
  first, so those indices are exactly the above-the-fold photos).
- **Collection renders progressively** — the album now mounts `PAGE_BATCH` (24)
  cards up front and appends another batch via a bottom sentinel
  (IntersectionObserver, 600px margin) as you scroll, instead of mounting the
  whole catalogue at once. This is the lever that scales: initial DOM + image
  requests stay flat as the special-card set keeps growing (83 → 200+), which is
  what actually moves LCP/INP on a full collection. Cards still render in full
  (no `content-visibility` clipping of the overflowing glows/tilt) and the
  continuous "album wall" feel is preserved — no "load more" click. The reveal
  resets to one batch on a filter change via a render-phase reset (no
  setState-in-effect). Why progressive reveal over virtualization: the rarity
  glows/tilt deliberately overflow the card frame, so windowing would risk
  clipping; appending keeps every mounted card intact.
- **Collection grid on mobile** now shows **2 cards per row** instead of one
  oversized card (`grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]`).
  Desktop is unchanged — the original auto-fill grid still applies from `sm:` up.
  ⇢ Only the collection grid `<div>` changed; **no card-component internals were
  touched** (cards are already `fluid`/`w-full`, so they just fill the cell).
- **First-run onboarding** (How-to-Play + Legacy intros): each numbered step now
  renders as its own **Panel card** for more scannable reading. Copy is unchanged
  (still `string[]`), so EN/PT stay correct automatically.
- **`specialCards.json` is now HAND-MAINTAINED** (like `achievements.json`) and
  decoupled from the generator. `npm run build:data` no longer writes it — it
  only re-validates that every `baseCardId` resolves and regenerates the photo
  README. The legacy `SPECIALS` catalogue in the generator is reference-only now.
  This protects the hand-curated cards (now 83) from being overwritten.
  (see DESIGN-DECISIONS #42)

### Fixed
- **Game wouldn't boot after the manual `specialCards.json` edit** — two root
  causes:
  1. A new card used `cardType: "season_mvp"`, which wasn't in the Zod enum /
     `SpecialCardType` / copy labels, so schema parsing threw at load. Added it
     everywhere.
  2. Six cards referenced players/base cards that didn't resolve (referential
     integrity threw). Five were nickname/id drift or wrong era anchors and were
     re-linked to real cards: `exotiiik`→`exotiik` (spelling; base
     `exotiik-team-bds-2024` already existed), and re-anchored
     `okhalid`→`okhalid-team-falcons-2122`, `lostt`→`lostt-furia-2024`,
     `bananahead`→`bananahead-wildcard-2025`, `seikoo`→`seikoo-team-bds-2122`
     (note: this last title says "Endpoint" but seikoo has no Endpoint card in
     the dataset — flagged for Miguel). The sixth, `mawkzy`, isn't in the dataset
     at all and was moved to `data-sources/specials-pending.json` (nothing lost).
  Result: **83 valid specials**; `validate:data`, 42 tests and `next build` all green.
- **Collection lag / freeze with a large (near-complete) collection.** Root
  cause: every special card rendered a 3D `TiltCard` layer **plus** two
  `mix-blend-mode` holo layers (cursor color-dodge + reverse-holo screen) **plus**
  two `backdrop-filter: blur` pills **plus** infinite sheen/halo animations — all
  of them, for every card at once. Dozens of blend-mode + backdrop-blur + 3D
  compositing layers thrash the GPU and froze scrolling; with photos now added,
  83 images also decoded up front. Fix, in layers: (1) `TiltCard` now sets
  `will-change: transform` **only while actually tilting** (it was always-on —
  one forced GPU layer per card × 83); (2) a **`lite` mode** for the collection
  grid (`GameCard` `lite`) skips the cursor holo (mix-blend-mode) + backdrop-blur
  pills and the per-frame box-shadow halo pulse, but **keeps the 3D tilt and the
  foil sheen** so the grid still feels alive; (3) card photos **lazy-load**
  (`loading="lazy"`); (4) an `FxCard` IntersectionObserver pauses the remaining
  sheen on off-screen cards. The **full effects** (cursor holo + animated halo)
  still play on the detail / single-card view. (A first attempt that only paused
  off-screen animations didn't help — the real cost was the always-on
  blend/backdrop/tilt *layers* on the visible cards, not the animations.)
- **Toned down the rarity halos/glows** a notch (legendary especially) — it read
  too strong once real card photos were added. `*-halo` keyframes, the static
  `.card-*` glows, and the legendary holo sheen (`.holo-legendary::after`, ~25%
  lower opacity) in `globals.css`.

### Data — RLCS Worlds dataset corrected vs Liquipedia
- Audited every RLCS World Championship field (S1 → 2026) against Liquipedia
  (wikitext-verified) — full findings in `data-sources/liquipedia-worlds-audit.md`.
  Team **counts were all correct**; the errors were **rosters**, mostly in the
  3rd slot and in MENA/APAC/SSA + the 2025 season.
- Fixed in `data-sources/teams.md` (then regenerated): S6 (Chiefs ↔ Tainted
  Minds swap), 2021-22 + 2022-23 (MENA/APAC/SSA/OCE/SAM rosters), 2024 (Oxygen,
  QuikTrip Pioneers, Team Secret), 2025 (Dignitas/NiP rosters, **Geekay moved
  MENA → EU**, TSM, FURIA, Team Secret). `validate:data` + 42 tests pass; all
  special-card refs still resolve.
- **Normalized duplicate player spellings**: `ExplosiveGyro` → `Gyro.`,
  `Sweaty_Clarence` → `Sweaty`. `zen` (EU) and `ZeN` (OCE) kept distinct (the
  generator already splits that key). Org spellings already unified via
  `ORG_ALIAS` (no new duplicates found).
- Obscure-region + newly-added players use approximate overalls. **Not changed:**
  S9 (no Worlds happened — COVID) and 2026 (not played yet) — flagged for a call.

## [1.0.0] — "Kickoff" — 2026 (released)

The public launch (rocketdraft.app), assembled across focused passes.
**Pass 1: launch foundation + card work. Pass 2: settings, sound, dailies.
Pass 3a: polish adjustments (below).** Still to land before 1.0 ships:
**PT-BR translation + language switch** (Pass 3b). (Accounts + leaderboard are
a v1.1 fast-follow.)

### Added (Pass 3b — PT-BR + language switch)
- **Full Portuguese (PT-BR) translation** of the UI with an **EN/PT toggle in
  the header** (always visible). Persisted per device; switches instantly with
  no reload, including mid-run.
- i18n architecture: `copy.en.ts` (`EN`) + `copy.pt.ts` (`PT`) + a `useCopy()`
  hook **gated by `useMounted()`** so the first (server-matching) render is EN,
  then the saved language — no hydration mismatch/flash. `getCopy()` covers
  non-component helpers. `<html lang>` updates with the language.
- Translated: home, nav, footer, setup, draft, team review (incl. analyst
  readout), tournament, results, collection, profile, settings, achievements,
  how-to-play, onboarding, difficulty names/taglines, card role tags, and
  narration. Scope note: historical CONTENT stays EN by design — achievement
  titles/descriptions, special-card titles/flavor/effects, player/org/season
  names, daily-challenge labels, the engine-generated XP-line labels, and the
  changelog/privacy long-form pages.

### Changed / Fixed (Pass 3a — polish)
- Settings icon is now a proper **gear** (was a sun).
- Light **menu click** sound + a light **match-resolved** cue in the sim
  (distinct for the user's series won vs lost).
- **Collection grid fills the row** (CSS auto-fill, fluid cards) — no more
  empty column on the right on desktop; locked + earned stay the same size.
- Special **overall numbers**: legendary is a true **gold** (not pale yellow),
  and mythic/rare/epic are more saturated (less washed out).
  ⇢ tweak in `SPECIAL_OVR_COLOR` in `src/components/cards/GameCard.tsx`.

### Added (Pass 2 — settings, sound, dailies)
- **Settings screen** (`/settings`, gear in the header): sound on/off + volume,
  reduce-motion override, and animation speed (Slow/Normal/Fast). Persisted.
- **Animation speed** scales the draft reel, reveals, ceremonies and page
  transitions (`--anim-scale`) and sets the tournament playback default;
  **Reduce motion** is a manual override on top of the OS setting.
- **Subtle sound effects** (synthesized — no assets): draft pick, reroll,
  tournament start, card unlock, rank-up, win/lose. Respects the volume/mute
  setting; off is instant.
- **Richer daily challenges**: a sequential **daily number** (#1, #2, …), new
  models (**Legacy Day**, **Underdog** — win with a sub-88 team, **Champions
  Only**), and new bonus objectives (Great+ chemistry, win the title,
  team-overall-under). The number + objective show on the home card.

### Added (Pass 1 — launch foundation)
- **SEO**: full metadata for rocketdraft.app (canonical, Open Graph, Twitter
  card, keywords), a generated OG/preview image, `sitemap.xml`, `robots.txt`,
  `VideoGame` JSON-LD, and a Google Search Console verification hook
  (`GOOGLE_SITE_VERIFICATION` env).
- **Vercel Web Analytics** (privacy-first, no cookie banner). Search-impression
  data comes from Search Console (set up at deploy).
- **Footer** across the site: Changelog · How to play · Privacy · Discord ·
  Support links, "Made by LiberatoRL", "Inspired by draftrlcs.app by Rams",
  and the version/codename. (Discord + support links render once set in
  `src/config/site.ts`.)
- **Changelog** and **Privacy Policy** pages (`/changelog`, `/privacy`).
- **Subtle home buttons** for the community Discord and "buy me a coffee"
  (hidden until their URLs are set).
- **First-run How-to-Play modal** (shown once) and a **first-Legacy intro**
  modal (one-time flags in the profile store).
- `src/config/site.ts` — one place for the domain, version, attribution and
  external links.

### Changed
- **Special-card overall numbers are rarity-colored** (legendary gold, mythic
  red, epic teal, rare indigo) with a heavy `.ovr-shadow` so they stay legible
  over the photo.
- **Epic rarity → teal/emerald** (frame, halo, holo, accents, field FX) — a
  cleaner blue→green→red→gold ladder than the orange trial.
- **Special cards on the "Your Team" field now carry a rarity-tinted
  holographic sheen** (`field-holo`) on top of the glow + border, on every run.
- **Draft header shows the season's year** next to the season label (only when
  the label doesn't already contain it).
- **Rank images load faster**: explicit dimensions + eager/high-priority
  decoding (no layout shift / late paint).

### Fixed
- **Org cards: the "ORG" tag is a fixed color again** (it was tracking the
  region color); only the org's region chip stays region-tinted.
- **Small/reduced cards no longer clip the type·rarity pill** — it now
  truncates with an ellipsis inside the card instead of spilling past the
  frame and clipping mid-letter.

---

## [0.6.1] — "Main Stage" (cont.) — 2026-06-15

Tuning round on v0.6.0, by direction — colors, effects and the celebration
moments. Not yet committed: Miguel reviews on localhost first.

### Changed
- **Special-rarity palette, take 2** (by direction): **rare** goes back to the
  bluish dark-purple (indigo) it was before; **epic** becomes **orange/amber**
  (the purple/pink wasn't working); **mythic** stays red; **legendary** is
  pushed further from the gold base cards — a near-white platinum-gold border
  with a traveling shimmer and the brightest halo, so it reads as the single
  most special card in the game.
- **Special-card effects now ramp by tier**: the cursor holo, sheen and halo
  scale from rare (faintest) up to legendary (most spectacular), and are more
  pronounced across the board than before.
- **Collection is a single grid again** (no rarity sections): unlocked cards
  lead in rarity→overall order, then the still-locked cards in the same order.
- **Reset run restarts in place**: the in-run Reset button now starts a fresh
  draft on the SAME difficulty/mode instead of bouncing back to the setup
  screen (`runStore.restartRun`).
- **"Who ended your run" shows the FULL opposing roster** — players plus coach
  and sub (when fielded) and the org, not just the three players.
- **Special FX on the "Your Team" pitch now show on Hard/hidden runs too** and
  are a living rarity glow (animated `field-fx`), not just a border line — a
  special's presence is public information; only base-card rarity stays hidden.

### Added
- **Legacy unlock celebration**: winning your first Hard tournament (which
  unlocks Legacy) now gets its own full-screen, prismatic moment in the same
  language as the card-unlock / rank-up ceremonies.

### Fixed
- **"New card unlocked" and "Rank up" now advance on a tap ANYWHERE** on the
  overlay (not only on the emblem); the explicit Continue/Next button stops
  propagation so it doesn't double-advance.

---

## [0.6.0] — "Main Stage" — 2026-06-15

The last polish pass before the **1.0** community launch — a feedback round on
the MVP plus launch-prep. Committed by Miguel after localhost review.

### Added
- **Run resets automatically when you leave it** (by direction): the
  leave-the-run confirmation modal is gone. Navigating off the run page — to
  home, collection, profile, anywhere — now silently resets the run
  (`AppShell` clears it whenever the route isn't `/play`; a refresh on `/play`
  still resumes). DESIGN-DECISIONS #30.
- **"Reset run" button** next to the difficulty tag in the run header — a
  deliberate restart back to the setup screen, behind one confirmation.
- **Eliminator reveal** (experimental, `FEATURES.showEliminatorTeam`): on a
  lost run, a subdued strip on the results screen shows the historical lineup
  that knocked you out (last lost series' opponent), with the stage and final
  score. Built to be trivially reversible — flip the flag and the data field
  stays null, so nothing renders. DESIGN-DECISIONS #31.
- **Special-unlock XP** (by direction): a newly unlocked special grants flat XP
  by rarity (rare 10 · epic 20 · mythic 40 · legendary 75), added after the
  difficulty multiplier like achievement XP and shown as its own breakdown line.
- **Card role tags**: player/coach/sub/org wear a small color-coded pill
  (player blue · coach amber · sub emerald · org region-colored) so kinds read
  at a glance; the org card's region chip matches the draft-draw region accent.
- **Collection rarity sections**: the album is grouped by rarity
  (Legendary → Mythic → Epic → Rare), each section sorted by overall; locked
  cards are grouped the same way.

### Changed
- **Special-card rarity palette** (by direction): legendary → white & gold
  (Ultimate Team "Legend" look), mythic → red, epic → purple/pink, rare → dark
  purple — a distinct color identity per tier on the frame, halo and title
  accent. DESIGN-DECISIONS #32.
- **Drafted cards on the field now wear their rarity border** (overalls-visible
  modes only): special cards get their rarity color + glow, base cards their
  gold/silver/blue border. Hidden runs stay neutral — rarity is secret there.
- **Rank-up celebration reworked**: now a full-screen overlay in the same
  language as the "new card unlocked" ceremony (black backdrop, emblem bursting
  in the center) and using the MENU rank art instead of the profile set (the
  v0.5 version read as cramped and pulled the wrong art).
- **Hidden-run specials show a team logo**: on Hard/hidden runs a masked
  special now wears the drawn lineup's crest — like the other cards — instead
  of a bare "?", while its own moment stays hidden. DESIGN-DECISIONS #33.
- **Mobile step transitions reset the scroll** to the top of the page (every
  phase change and each new draft lineup) — tapping a bottom-of-screen button
  used to land the next step still scrolled to the bottom.

### Balance
- Special-unlock XP added (above) — small, collection-side, never scaled by
  difficulty (`XP.specialUnlock`). No simulation knobs changed.

### Fixed
- **Drawn team flashed before the slot-machine reel** (recurring — the v0.5.1
  `useLayoutEffect` only narrowed it). Root cause: the reel was armed AFTER the
  new offer rendered, so the real lineup name painted for one frame before the
  reel covered it. The reel reveal is now a child component remounted per draft
  round (`key`), building its spinning names in a lazy `useState` initializer,
  so the drawn name is never rendered before the reel lands. React-Compiler
  safe — no setState or ref access during render (the project has
  `reactCompiler: true`).
- **Mobile review cards overlapped**. Root cause: the review strip used
  fixed-width `size="sm"` cards (w-32 / 128px) inside a 3-column grid whose
  mobile tracks are narrower than 128px, so cards overflowed and overlapped.
  The strip now uses the same proven fluid + max-width wrapper the draft and
  results screens already use — only this strip changed, card internals
  untouched (measured: 0 overlaps at 375px, cards shrink to ~109px to fit).
- **Collection card sizes differed**: locked cards rendered narrower than
  earned ones (md:w-40 vs md:w-44). Locked cards now match the earned GameCard
  footprint exactly (w-36 md:w-44 — measured identical).

### Quality gates
- 42 vitest tests pass, `tsc` clean, `next build` clean. ESLint baseline
  unchanged (8 pre-existing `react-hooks/set-state-in-effect` warnings in
  untouched UI primitives; this change adds none).

---

## [0.5.1] — 2026-06-12

Hotfix round on v0.5.0 feedback — the draft screen is the visual heart of
the app and shipped broken. Not yet committed/deployed: Miguel reviews on
localhost first.

### Added
- **Era-aware org logos**: orgs rebrand, and a card should wear the logo of
  ITS season. `seasons.json` gained `order`, orgs can declare `logoEras`
  (curated `ORG_LOGO_ERAS` map in the generator), and `TeamLogo` resolves
  `public/orgs/<orgId>@<era>.png → <orgId>.png → monogram` from the card /
  lineup season. Wired through draft cards, field view and every tournament
  view. NRG is the worked example: classic shield through S9, modern mark
  after. `fetch-assets` gained an `"orgFiles"` override block (exact
  Liquipedia file → asset) and now prefers NEWER files for the default logo
  slot (org pages list every past identity, including predecessor orgs).
- Identity guard tests: zen (EU) ≠ ZeN (OCE), era spellings never become
  separate orgs (alias map), same-name orgs from different regions stay
  split — the unification contract is now CI-enforced.

### Changed
- **One-click drafting** (by direction): clicking a card drafts it straight
  into the first open compatible slot — the select-then-place step is gone
  (player slots are functionally identical, so there was nothing to choose).
- **Hidden runs reveal org logos** (by direction): base cards and org cards
  show their team crest on blackout runs — only ratings, buffs and rarity
  stay secret.
- **Specials are masked on hidden runs** (by direction): the rarity frame,
  holo and effect description announce "this is a special", but the photo,
  title, card type, moment context and overall stay hidden until the
  results-screen reveal (draft, review and field views).
- Draft hint copy updated for the one-click flow.

### Balance
- **Special appearance 16% → 6%** (coach 12% → 5%) by direction — a Hard
  run surfaced 4 specials and they stopped feeling special. ~0.4 expected
  special sightings per run across all modes.

### Fixed
- **Draft cards rendered at different sizes** (v0.5.0 regression, urgent):
  pickable cards collapsed to their content width while disabled ones kept
  full size. Root cause: the fluid-width attempt set `w-full` only on the
  inner card frame, but `<button>` wrappers are shrink-to-fit (unlike the
  `<div>` used by disabled cards), so 100% of a collapsed parent collapsed.
  `GameCard` now has a real `fluid` mode that threads `w-full` through
  TiltCard → button → frame, with the size cap on an outer wrapper
  (`max-w-36 md:max-w-44` — the original card size). Team reveal uses the
  same path.
- **Drawn team name flashed before the slot-machine reel** (v0.5.0
  regression): the reel was armed in `useEffect`, which runs after paint —
  the new offer rendered for a frame first. Moved to `useLayoutEffect`.
- **Leaving a run briefly showed the screen underneath**: `clearRun()`
  before `router.push("/")` re-rendered `/play` as the setup screen during
  the route transition. Leaving now only navigates — the home page already
  abandons the run on mount (run-header back button, leave-run modal and
  the results back-to-menu button all fixed).
- Review screen no longer leaks special-card titles on hidden runs (the
  effect description still shows, per direction).

## [0.5.0] — 2026-06-12

First live-playtest feedback round (Vercel MVP) — the "last MVP version"
before the 1.0 push.

### Added
- **Slot-machine lineup reveal**: each drawn lineup spins in through a
  decelerating name reel ("the draw felt instant" feedback). Reduced-motion
  users skip it; resumes after refresh don't replay it.
- **Rank-up celebration**: ranking up now gets its own full-screen moment
  (badge burst + rays) after the unlock ceremony — the old corner badge was
  easy to miss.
- **Region color identity** in the draft: the drawn lineup's region badge is
  color-coded (NA blue · EU amber · SAM green · MENA purple · OCE cyan ·
  APAC rose · SSA orange).
- **Leave-run guard**: navigating to the menu mid-run (nav links, logo, the
  run-header back button) asks for confirmation — playtesters lost drafts to
  stray Home clicks. Results phase never warns. Profile, collection,
  achievements and how-to-play pages all gained a "Back to menu" link.
- **Asset fetcher** (`npm run fetch:assets`): downloads org logos and player
  photos from Liquipedia (rate-limited per their API terms, CC-BY-SA
  attribution generated in `public/ATTRIBUTION.md`) and country flags from
  flagcdn — no more saving 200 images by hand. Misses are reported and can
  be mapped in `data-sources/asset-overrides.json`; existing files are never
  overwritten. Country chips now render real flag images when present.
- **Difficulty outcome tests** (`balance.test.ts`): full-tournament rates
  for a representative good roster are pinned per difficulty (playoffs/title
  bands), so balance regressions fail CI, not playtests.

### Changed
- **Tournament playback v3 (focus + pacing)**: the Match Center now shows
  ONLY the user's series — AI series never hijack it (they pop into the
  bracket/standings and stay clickable). Within a round the user's series
  plays first, game by game (950ms), then lingers ~2.8s so the result and
  narration can be read; a breath separates rounds. Swiss standings move
  only when a full round is revealed ("Through Round N" tag).
- **Spoiler fixes**: upcoming Swiss opponents are hidden until every
  simulated round is fully revealed (Swiss pairs by record — naming the next
  opponent leaked the current result), and the playoff bracket only appears
  once the whole Swiss stage has been revealed.
- **Special cards belong to the PLAYER, not one base card**: any Kronovi
  card can roll any Kronovi special. When one appears it carries its own
  historical moment (org/season shown and used for chemistry). Which special
  shows is weighted by rarity — legendaries are the chase pulls
  (`SPECIALS.rarityWeights`).
- **"No Coach"/"No Sub" are no longer pickable** (v0.3 punt reverted by
  feedback): they render as stamped vacant cards, a fully blocked offer
  grants the free reroll, and when only staff slots remain the lineup draw
  softly favors lineups that still have a coach/sub
  (`DRAFT.staffScarcityBoost`).
- Collection grid sorts collected cards first.
- Draft/team-reveal card grids are fluid on phones (fixed-width cards
  overlapped below ~400px).
- Achievements: per-achievement hue variation inside each category family,
  light 3D tilt on earned cards, and a premium animated prismatic frame for
  the legend tier. The unlock toast (and results list) now wears each
  achievement's own icon/colors instead of a generic trophy.
- 3D tilt deepened on all tiers (light 5°→8°, strong 10°→14°, max 15°→19°).
- How-to-play texts caught up with v0.2 rules (double elim, no player-as-sub).

### Balance
- **The game was too hard overall** (live feedback: good teams missing
  playoffs). Three structural causes found and fixed:
  1. **Series form swing ±6 → ±4.5** — at ±6, a +3 rating edge was close to
     a coin flip, which read as "my good team keeps losing".
  2. **AI chemistry advantage trimmed**: every historical lineup has 100%
     chemistry, so `chemistryMaxBonus` acted as a flat field-wide buff —
     lowered across the board (easy 1.2→1.0 · normal 2.2→1.6 · hard 2.8→1.8
     · legacy 2.8→2.2).
  3. **Superteam compression** (`TEAM_RATING.superteamPivot/Slope`): rating
     above 94 counts at 0.55× for BOTH sides. Historical 99-overall rosters
     (zen/Vatira/M0nkey M00n at 100% chemistry ≈ 102 total) were an
     unbeatable Bo7 wall — the title was near-impossible even with a great
     draft. Hierarchy preserved, wall removed.
- Normal: user roll −4..4 → −3..4, elite weight 1.0 → 0.7. Hard: user roll
  → −3.5..4, elite 1.5 → 1.15, shift +0.5 → +0.3. Easy: shift −1.5 → −2.0.
- Measured outcomes for a 92.5-rated roster (300+ runs/difficulty): Easy
  100% playoffs / 59% title · Normal 97% / 12% (28% with a 94.5 dream
  draft) · Hard 79% / ~1%. Title chance now scales with draft quality.
- Specials appear meaningfully more often: base card chance 7% → 16%
  (coach 5% → 12%) — the per-player pool also multiplies eligible cards.
  Daily "Specials Surge" multiplier ×4 → ×2.5 accordingly.

### Fixed
- **Chemistry felt broken — root cause: org identity fragmentation.** The
  same organization spelled differently per era created SEPARATE orgs
  ("Team Dignitas"≠"Dignitas", "Renault Vitality"≠"Team Vitality",
  "Chiefs ESC"≠"Chiefs Esports Club", Mock-It ×3, QuikTrip Pioneers), so
  same-org chemistry never connected across eras. The generator now
  unifies them via an alias map while lineups keep their era display name.
  Conversely, same-name-different-org collisions (OCE Pioneers vs SSA
  Pioneers, FUT Esports NA/SSA) are now split per region — they were
  incorrectly fused into one org before. Player ids were already normalized
  (yanxnz/Yanxnz/yanXNZ = one person) — verified by test.
- ~24 missing nationalities curated (high-confidence only), improving
  same-country chemistry coverage (157 → 133 without one).
- **Champion celebration rays clipped while rotating** — the `inset:-55%`
  ray layer was a rectangle, so its short side crossed the panel edges as it
  spun. Now a square sized past the container diagonal, centered with the
  `translate` property (which survives the `transform` rotation).
- Stale `.next` Turbopack cache served pre-edit CSS in dev — cleaned;
  README troubleshooting note already covered the recovery.

## [0.4.0] — 2026-06-12

The real dataset + MVP closing polish.

### Added
- **Full historical dataset** imported from the curated finals archive:
  **208 lineups · 624 player cards · 305 players · 83 coaches · 76 subs ·
  104 orgs across 15 seasons (2016 → 2026) and 7 regions (SSA added)**.
  Test data fully replaced.
- **Dataset pipeline**: `npm run build:data` regenerates every JSON (and the
  image-manifest READMEs) from `data-sources/teams.md` — future data updates
  are an MD edit + one command. Tests are dataset-agnostic now.
- **54 official special cards** (47 players + 7 coaches) from the v3
  catalogue: legendary legacy cards, every Worlds/Major MVP, iconic moments.
  New v3 effect model (direct attribute boosts; coach cards boost TEAM
  attributes), multiple specials per base card, coach specials appear on
  coach cards in the draft (separate low-frequency pool).
- **Era-accurate org buffs**: the same org can be `+` in one season and
  `+++` in another (per-lineup override; the org entity keeps a default).
- Tilt 3D em todas as cartas (leve nas normais, forte nas especiais, máximo
  na visualização da coleção) + **holo Balatro-style reativo ao cursor**
  por tier: foil (rare) · reverse-holo (epic) · holo (mythic) ·
  polychrome animado (legendary).
- One unique icon per achievement (22), keeping category colors.
- Back-to-menu link on the achievements page.

### Changed
- Home mode cards now open their OWN setup (Classic → classic difficulty
  select; Quick → quick) — no mode switcher inside setup. "Play again"
  returns to that mode's difficulty selection.
- Draft: clicking a card whose kind has a single open destination
  (coach/sub/org or the last open player slot) assigns immediately.
- Unlock ceremony auto-plays (reveal + advance); clicking skips ahead.
- Daily Challenge: a loss no longer reads as "completed" — the card shows
  Victory (+XP) or Defeat plus "come back tomorrow", and the streak counts
  only victories.
- Player nationality is now optional data (the archive doesn't carry it);
  same-country chemistry applies only when both players have one. ~85
  well-known nationalities curated in the generator.
- Card overall floor relaxed to 50 (bench/staff ratings + vacant cards).

### Fixed
- **`npm run dev` failing with "connection refused"**: orphaned dev-server
  processes plus a stale `.next/dev/lock` (Next 16's single-instance lock)
  blocked new instances. Cleaned up; troubleshooting note added to README.
- **Champion celebration showed only two rotating beams**: a plain
  `conic-gradient` holds its last stop instead of repeating — switched to
  `repeating-conic-gradient` (gold and prismatic variants).
- UTF-8 corruption introduced by a PowerShell bulk-edit during development
  was caught and reverted before commit (files restored from git).

## [0.3.0] — 2026-06-12

Feedback round 2 + the first MVP 2 features.

### Added
- **Quick Draft (live)**: players-only draft into a straight 8-team
  single-elimination Bo5 bracket. Mode selector on the setup screen;
  XP at ×0.5.
- **Daily Challenge (live)**: date-seeded run — same draft, opponents and
  modifiers for everyone on the same day. Template wheel for variety
  (Pure Bracket, Regional Lockdown, Old School, Modern Era, Blackout,
  No Safety Net, Gauntlet, Specials Surge) plus optional bonus objectives
  (chemistry / goals-conceded). One play per day, local streak counter,
  XP at ×1.5. Lives on the home screen with today's modifiers.
- **Star-of-the-game narration**: every game has a star from the winning
  side; OT/deciding/high-roll games show them in the Match Center, series
  summaries name who led the charge, and "Best player" on results now uses
  real star counts instead of noise.
- **Unlock ceremony**: freshly unlocked specials get a card-back → burst
  reveal moment before the results screen.
- **Share card**: canvas-rendered 1200×630 result image (placement, roster,
  record, XP) downloadable from results.
- 8 new achievements (Lift-Off, Comeback Kings, On the Podium, The Long Way,
  Strangers, Old School, Immortal Gauntlet, Curator) with per-category
  visual identities (milestone/skill/collection/legend) in the grid.
- Tiered holographic effects on special cards (epic reverse-holo, mythic
  holo, legendary prismatic) and **3D tilt + cursor glare** in the collection.
- Flawless-run celebration (prismatic variant) when winning without
  dropping a series; champion celebration fixed and upgraded.
- "No Coach"/"No Sub" vacant cards are now **pickable** — intentionally
  punt a slot (overall 50, no bonuses, excludes nobody).
- Profile: title rate, playoff rate, podiums and lifetime Swiss wins.

### Changed
- Home reworked: Classic Draft is the menu's primary action; Quick and
  Daily are live side cards.
- Review screen relayout (field + analyst left, numbers right, card strip
  below) — cards no longer sink below the fold. Starting the tournament now
  begins the simulation automatically.
- Simulation controls gained 4× speed; "View results" is bigger and
  duplicated at the bottom of the bracket page.
- Setup pre-selects the last mode/difficulty/visibility; "Play again"
  starts a new run directly with the same setup.
- Hidden-overall runs now black out EVERYTHING except special cards:
  coach bonuses, org buffs and org rarities included (draft, field, review,
  brackets).
- Run history shows the last 10 entries.

### Balance
- Hard softened (was over-tuned, compounded by the champion-heavy small
  dataset): user roll range −5..4 → −4..4, opponent shift +1.0 → +0.5,
  elite weight 1.8 → 1.5. Legacy shift 1.5 → 1.2.
- Rank curve stretched for a 100-150-run road to Supersonic Legend
  (SSL at 30,000 XP; growing gaps per tier).

### Fixed
- **Reset-progress modal could open unreachable and lock the scroll.** Root
  cause: the page-level `rise-in` animation kept a computed transform
  (fill-mode `both`), turning the page into a containing block for
  `position: fixed` — the dialog anchored to the page middle instead of the
  viewport. Fixed by rendering modals through a portal on `<body>` and
  switching `rise-in` to fill-mode `backwards`.
- **Champion celebration looked broken**: `text-shadow` renders above
  `background-clip: text` gradients. Switched the glow to
  `filter: drop-shadow`.
- Daily run no longer gets wiped by the home screen's "reset run on menu"
  rule when launched from the menu.

## [0.2.0] — 2026-06-11

First feedback round on the MVP — draft flow, simulation flow and visual
identity reworked.

### Added
- **RLCS field view**: the drafted team renders on a stylized top-down pitch
  (3 players on field, coach/sub on the bench, org slot) — used on the draft
  and review screens, and as the placement target during the draft.
- **Double-elimination playoffs** (upper + lower bracket, Bo7) plus a
  dedicated **third-place series** (LB semifinal loser vs LB final loser).
  New placements: Champion / Grand Finalist / 3rd / 4th / Top 6 / Top 8.
- **Automatic tournament simulation**: press Start once — user series play
  game-by-game in the Match Center, AI series resolve in the background,
  rounds chain automatically. Speed toggle (1×/2×), pause and skip-to-end.
  Standings and brackets are spoiler-safe (only revealed results show).
  After the run, every finished series can be clicked open for review.
- Swiss "Your Path" bracket cards with team logos and green/red outlines on
  the user's matches (also applied across the playoff bracket).
- Placeholder cards ("No Coach" / "No Sub", overall 50, no rarity) when a
  historical lineup didn't field one.
- **Common (no-rarity) tier**: overalls ≤69 and neutral orgs; org cards now
  carry rarity from their buff (+ silver · ++ gold · +++ blue).
- Asset pipeline (drop files in, no code): `public/orgs/<orgId>.png`,
  `public/ranks/menu|profile/<rankId>.png`,
  `public/cards/specials/<specialId>.png` — all with automatic styled
  fallbacks and README manifests in each folder.
- "Unranked" rank tier; growing XP curve up to Supersonic Legend (14.5k XP).
- Achievements tile on the home screen, dedicated `/achievements` page and
  slide-in achievement toasts on the results screen.
- "Untouchable" achievement + results callout: complete a run without
  conceding a single goal (intentionally near-mythical).
- Champion celebration on the results screen (rotating rays, confetti,
  shining title) — restrained for non-title runs.

### Changed
- **Draft interaction**: click a card, then click the target slot on the
  field — no confirm button. Players choose WHICH player slot (1/2/3).
- Offer layout: two rows of three (players / coach·sub·org).
- Card redesign: base cards show the org logo as centerpiece (no player
  photos by design); special cards carry a player photo with stronger
  rarity treatment (halos, foil sheen, photo gradient).
- **No resume system**: returning to the menu resets the run; the in-run
  header has a back button. Refreshing mid-run still resumes (accident
  protection), but leaving the flow abandons it.
- Sub slot accepts only sub cards (player-as-sub removed). When an offer has
  nothing pickable the player now gets a **free reroll** (doesn't consume
  the difficulty budget).
- Results team reveal arranged as players row + staff row.
- XP model: per-playoff-series-win line + placement bonuses replace the old
  semifinal/final lines (see BALANCE-GUIDE).

### Fixed
- Persisted runs from v0.1 are discarded on load (store version bump) — the
  run shape changed and resuming one would crash.

## [0.1.0] — 2026-06-11

First playable build (MVP 1 + collection/progression slice).

### Added
- Classic Draft: free-choice draft over 6 slots (3 players, coach, sub, org)
  from randomly drawn historical lineups; person-level draft exclusion;
  player-as-substitute rule; forced free skip; rerolls by difficulty.
- Difficulties Easy / Normal / Hard + unlockable Legacy (win on Hard).
- Overall visibility toggle; locked hidden on Hard/Legacy; full reveal on the
  results screen (card-flip animation).
- Base card rarities (silver / gold / blue) + hidden "??" black cards.
- 10 special cards (rare/epic/mythic/legendary) with situational effects and
  the draft-and-finish unlock rule; collection album with filters, rarity
  progress and detail modal.
- Tournament: 16-team Swiss (Bo5, pre-computed next pairings, live standings)
  into single-elimination Bo7 playoffs (8 teams, seeded bracket); skippable
  game-by-game series ticker with broadcast-tone narration.
- Chemistry system (lineup / country / org / coach / sub links) with tiers
  and review breakdown; org buffs; coach bonuses; sub depth bonuses.
- Results screen: placement, highlights (best player, biggest win, closest
  series, toughest loss), XP breakdown with difficulty/hidden modifiers, rank
  progress, achievements, special unlocks.
- Progression: XP, 8 RL-inspired ranks, 13 achievements, run history (25),
  profile screen with reset.
- Hand-curated dataset: 24 lineups · 72 player cards · 49 players · 16 orgs ·
  12 coaches · 4 subs · 11 seasons (2016 → 2023-24, all six regions).
- Zod validation + referential integrity for the whole dataset.
- Seeded, reload-deterministic RNG; runs resume after refresh.
- Test suite (26 tests): dataset integrity, draft rules, chemistry, Swiss
  structure, simulation sanity anchors, full-run integration.
- Docs: architecture, data guide, balance guide, design decisions, roadmap.

### Balance
- Initial values for every knob in `src/config/balance.ts` (see
  BALANCE-GUIDE.md). Simulation anchors verified by tests:
  equal ratings ≈ 50/50 · +2 ≈ 65-75% · +6 ≥ 85% · +12 ≥ 97% per series.

### Fixed
(pre-release QA, kept for the record)
- **Simulation was far too deterministic** — a +2 rating edge won ~93% of
  Bo5 series because per-game noise averages out across a best-of. Root
  cause: single noise source. Fix: added a per-series "form" roll
  (`SIMULATION.seriesFormRange`) that does not average out; consistency and
  defense-stability dampen its negative side.
- **User team region was computed from the first pick only** (display bug in
  `engine/teams.ts`).
- **"Best player" highlight ignored the actual card overalls** (used the team
  average for every candidate).
- **Series ticker could label a Bo7 as Bo5** when the series ended in 5 games.
- **Going 3-0 in Swiss auto-simulated the entire playoffs** (caught in the
  first visual playtest). Root cause: "user advanced" was treated as "user has
  no series left", triggering the fast-forward meant for eliminations. Fix:
  rounds now auto-resolve only while the user has no pending series
  (`userHasPendingSeries`), stopping at the user's next playoff matchup; a
  "Playoff spot secured" panel covers the waiting state.

[0.1.0]: v0.1.0
