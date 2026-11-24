# Mobile redesign: audit, rules, stages

> Started 2026-11-24 on branch `design/mobile-redesign` (cut from `staging`
> at v2.1.0-rc.4). **Published to staging as v2.1.0-rc.5 on 24/11** after
> Miguel's review. The phone rules are in `DESIGN.md` ("Phone"); the
> decisions are DESIGN-DECISIONS #178 to #182 and R148. The stage sections
> below are the record of each stage as first drawn; "Stage 6 and Miguel's
> review" at the end says what changed after he played them. Filters used:
> the anti-slop rulebook (core, UI, layout-mobile, human) and unslop.

## Audit (24/11, 375 x 812, PT, guest, fresh save)

"Screens" is page height divided by the viewport. Measured in the dev build.

| Screen | Screens | What is wrong on a phone |
|---|---|---|
| Home | 6.8 | The first screen was wordmark, four lines of pitch, two community buttons and the sponsor; the draft button sat at the bottom edge. The rank name was cut ("BRON"). Every TODAY row carried a full-width button repeating its own title. Discord three times on one page. |
| Setup | 2.4 | Four tall difficulty boards before the region and the switch. The start button is pinned (fine). |
| Draft | 1.9 | The stepper wrapped to two lines (86px). The team board is under the fold: the player picks without seeing the team. The site footer shows in the middle of a run. |
| Review | 2.7 | The pinned button floats over the text with no ground under it. |
| Tournament | 2.4 live, 4.1 finished | The live series starts at 375px: header, stepper, title and speed controls come first. Team names cut ("SEU TI...", "HOGA..."). |
| Results | 3.5 | The action dock is 124px (two wrapped buttons and a link). With header and nav, 238px of 812 are fixed. A first run opens two full-screen ceremonies and two toasts in a row. |
| Career HQ | 7.3 | The desktop dashboard stacked: day, squad, bootcamp, training, standings, finances, progression. The date is on screen three times and Advance twice. 122 text nodes under 12px. |
| Career shell | n/a | Site header 57 + career bar 109 (date, advance and a `<select>` as the navigation) + bottom nav 57 = 223px fixed, 27% of the screen. |
| Squad / Market / Training / Finances / Club | 2.9 / 6.5 / 5.5 / 5.4 / 5.9 | Boards inside boards. Market tabs are four boxes in a 2 x 2 grid; Standings regions are seven boxes. Every tab opens its own tour over the content. |
| Standings / Calendar / News / Season / Saves | 4.1 / 2.2 / 1.7 / 2.7 / 2.0 | Calendar and News are close to right. |
| Challenges | 17.1 | 45 full cards in one column, three tags and three goals each. 801 text nodes under 12px. Two spans run to 410px. |
| Collection | 13.7 | Two filter rows of boxed buttons, then every card of every rarity at two per row. |
| Profile | 5.7 | Identity, sign-in, season track, badges, stats, achievements, history, tools, reset in one column. |
| Quiz | 1.5 | The pinned input sits over the stats strip. |

Not audited yet: missions, achievements, leaderboards, settings, content
pages, the event weekend, follow, the season review (they need progress).

Shared causes:
1. **The phone layout is the desktop layout stacked.** Nothing is cut,
   reordered or deferred.
2. **A global patch stands in for a design**: `globals.css` forces 44px on
   every `a` and `button` and 11px on every small text under 640px.
3. **Too much fixed chrome**, and two navigations at once in the career.
4. **Boxes for everything**: each row of a list is a framed board, and tabs
   are framed buttons, so a screen reads as a wall of equal rectangles.
5. **Ceremonies stack** (tour, notice, rank-up, unlock, toasts).

## Phone rules (proposal for `DESIGN.md`)

1. **The first screen is the screen's job and its one action.** A returning
   player can act without scrolling.
2. **Chrome budget: 110px fixed.** Header 56 and one bottom bar. Never two
   navigations. A flow that must not be left (a run) hides the bottom nav.
3. **Summary first, detail on demand.** Tabs, sheets and "show all". No screen
   over about three screens unless it is a list the player came to scroll.
4. **Rows, not boxes.** A list is rows with hairlines on one board. The row is
   the control and ends in a chevron; no button repeats its title.
5. **Type floor 12px, text 14 to 16.** Targets 44px with 8px between them. The
   primary action sits in the thumb zone, pinned when the screen is long.
6. **One ceremony at a time.** The rest becomes a line on the screen under it.
7. **Fluid under 375px** (`clamp`), checked at 320, 375 and 430.

## Stages (each ends at a gate: Miguel looks, then the next starts)

| Stage | Scope | State |
|---|---|---|
| 1 | Shell (header, bottom nav, run without nav), Home, run stepper | Published in rc.5 |
| 2 | Draft run: setup, draft (team dock in view), review, tournament, results, toasts | Published in rc.5 |
| 3 | Career shell and HQ: one bar, a tab bar in place of the `<select>` (Miguel's A7), HQ as "what is next" | Published in rc.5 |
| 4 | Career tabs: squad, market, training, finances, club, standings, calendar, news, season, event weekend, wizard | Published in rc.5 |
| 5 | Hub: challenges, collection, profile, missions, achievements, leaderboards, settings, quiz | Published in rc.5 |
| 6 | Miguel's review of stages 3 to 5, content pages, the 44px / 11px rule, Delivery Gate | Published in rc.5; a physical phone is still open |

## Stage 1: what changed (375px, PT)

- Header on a phone: logo, language (one 44px button that flips EN / PT),
  rankings, settings, account. Discord is off the phone header. Desktop is
  unchanged.
- Bottom nav: solid (it was the last glass bar), the current destination
  carries the header's orange rule. Hidden during draft, review and
  tournament (`html[data-immersive]`, set in `PlayView`).
- Home: hero 433px to 246px, modes 567px to 444px, TODAY 820px to 439px. Both
  mode buttons are inside the first screen. TODAY rows are rows with a
  chevron. The rank name fits at 320px. Page 6.8 to 6.3 screens: the rest is
  the search text under the menu (2,300px), which is Miguel's call.
- Run stepper: one 44px row (back, current step and "1/4", difficulty, reset).

Checked in the dev build at 375, 320 and 1024px (desktop unchanged).
`tsc`, ESLint on the changed files, `sharedPath` and `persistContract` pass.
Not run: the full suite, `npm run build`, a physical phone, Safari.

## Stage 2: what changed (375 x 812, PT)

Three phone primitives in `globals.css` (under 640px only, desktop untouched):
`.phone-rows` (a list is one board, each child a row, the chosen row carries
the orange rule), `.action-dock` (the screen's one action on ground: `sticky`,
in flow when the screen fits, on the bottom edge when it does not) and
`.team-dock` (the draft's six slots on the bottom edge).

| Screen | Before | Now |
|---|---|---|
| Setup | 2.4 screens | One screen. Difficulties are four rows, only the chosen one spells out its tagline. Regions are eight 44px keys in 4 x 2. The two section intros are desktop only. |
| Draft | 1.9 screens, team under the fold | One screen. The team is a dock on the bottom edge (crest and name per slot, open slots name what is missing). Reroll shares the region badge's row. The pitch is desktop only and comes back on Review. |
| Review | 2.7 screens, button floating over text | 1.5 screens. First screen is the pitch and the overall with its build-up; chemistry, specials, readout follow. The six-card strip (a repeat of the pitch) is desktop only. |
| Tournament | Series started at 375px, names cut | Series starts at 133px. Controls are on the bottom edge (play / pause, speed, skip as a 44px key). Each side of the scoreline is crest over name, two lines, never cut. The record sits on the Swiss path. Finished: 3.6 screens (was 4.1). |
| Results | Action block 124px floating, 238px fixed | One 65px row on ground (play again, share; "back to menu" is the nav's Home). Highlights are four rows of one board. 3.3 screens (was 3.5). |
| Toasts (achievement, reward) | Bottom of the phone, over the action | Under the header. Still one at a time on a phone. |

Also: the site footer and the play strip are off while a run is in play.

Checked in the dev build at 375 x 812, 375 x 667, 320 x 640 and 1280 (desktop
layout unchanged), classic and quick, plus the first-run tour (its "your team"
step lands on the dock). `tsc`, ESLint on the changed folders, the copy tests,
`sharedPath` and `persistContract` pass. Not run: the full suite,
`npm run build`, a physical phone, Safari.

Left for later in this stage's scope:
- **Ceremony order on Results** (unlock, rank-up, Legacy, then the held
  pop-ups) is untouched. It is already one at a time; folding the later ones
  into lines on the screen changes rc.29 logic and needs Miguel's call (6).
- Results is still 3.3 screens: the eliminator's six cards and the XP board
  are full size.
- The career toasts still sit at the bottom (stage 3 redoes that shell).

## Stage 3: what changed (375 x 812, PT)

**Shell.** Fixed chrome in the career went from 219px (site header 57, career
bar with the `<select>` 109, site nav 53) to 110px:
- One bar on top: the career bar (crest, date, advance). The site header is
  not pinned inside the career on a phone; it sits at the top of the page and
  scrolls away (`html[data-career]`, set by `CareerShell`).
- One bar on the bottom: `CareerTabBar` (HQ, Squad, Market, Training, More) in
  place of the site nav. "More" is a sheet with Calendar, Finances, Standings,
  Inbox (with its unread count), Club, Careers and "Exit to menu". The "new"
  dots and the unread count are the top bar's own.
- The wizard and the slot picker keep the site's chrome.
- Career toasts open under the top bars (they sat over the bottom bar).

**HQ.** 7.5 screens to 3.3. The day card and the inbox (moved up beside it)
stay open. Every other block is an `PhoneFold`: its head alone (title and the one
figure it carries: team overall, training status, race position, balance,
reputation) until the player opens it. Folds that follow one another read as
one board of rows. Nothing was removed and no block was rewritten: closed is a
CSS state of the same component. The wire shows its headline and two rows.
The day card drops its own date on a phone (the bar above it says it) and
"skip to" shares a row with "+1 day".

Checked in the dev build at 375 x 812, 320 x 640 and 1280 (desktop unchanged:
header pinned, tab row, every block open), the career's guided tour (all 8
steps find their target), Squad and Finances under the new shell. `tsc`,
ESLint on the changed folders and 222 tests (career components, copy,
`sharedPath`, `persistContract`) pass. Not run: the full suite, the soft-lock
probe (no engine or store change in this stage), `npm run build`, a physical
phone, Safari.

Known, left for stage 4:
- Finances overflows the page by 8px at 375px (it did before this stage).
- The wire's head is 133px on a phone.
- The event weekend, Follow and the season review were not opened under the
  new shell (they need a save further into a season).

## Stage 4: what changed (375 x 812, PT)

Three more phone primitives: `PhoneFold` (stage 3's `HqFold`, now shared, in
`components/ui`), `.phone-tabs` (a row of view buttons becomes one strip of
underlined tabs) and `.plan-dock` (a sticky CTA inside its own board).

| Screen | Before | Now |
|---|---|---|
| Market | 5,382px. Tabs a 2 x 2 grid of boxes, every player a 185px card | 4,560px. One row of four tabs (short labels), search without its board, players as rows of one list (154px each). Still long: it is the list the player came to scroll. |
| Club | 4,815px | 1,903px. Identity and trophies open; the 22 achievements (2,250px), reputation / progression and the season history open on demand. |
| Finances | 4,509px, page 8px wider than the screen | 2,015px, no overflow. The three figures, sponsors and the ledger open; the gear ladder (1,863px) and the two loans open on demand. The ledger's filters are a tab strip under its title. The phone-only jump links are gone (nothing left to jump over). |
| Training | 4,505px, the Start card fixed over everything | 3,238px. Objective and intensity are rows (the chosen one spells out its effect), Start rides the bottom edge while the plan is on screen and rests at the plan's end, the attribute reference opens on demand. |
| Standings | 3,323px. Two boxed tabs and seven region boxes on three rows | 2,637px. Two underlined tabs, seven region keys on one row, the title race opens on demand. |
| Inbox | 1,343px. Filters on three rows, an empty reader board | 1,250px. Filters are one row that scrolls sideways; the reader shows once a mail is open. |
| Wizard, season review | The action a card floating over the form | On ground (`.action-dock`). |
| Event lobby | Three buttons stacked at the left | Play across the screen, instant result and pass on one row. |
| Squad, Calendar, Careers | 2,365 / 1,811 / 1,701px | Unchanged apart from the tighter player tile (shared with Market and Training). |

Checked in the dev build at 375 x 812 and 320 x 640 (no page overflow on
Market, Standings, Finances, Training, Club) and 1280 (desktop unchanged:
boxed tabs with full labels, three-column tile grid, every fold open, the
training CTA in flow). `tsc`, ESLint on the changed folders (the three
remaining warnings predate this work) and 222 tests pass. Not run: the full
suite, the soft-lock probe (no engine or store change), `npm run build`, a
physical phone, Safari.

Not done in this stage:
- **Event playback**: the controls still sit above the live series (it starts
  at 320px). It reads well, but it is not the bottom dock the draft's
  tournament got. `EventScreen` is 1,490 lines and was only touched at the lobby.
- **Season review and Follow** were not opened (they need a save at the end of
  a season); the season review's action bar was changed blind.
- Squad's contract rows (four buttons on two lines each) and the Calendar were
  left as they are.
- The wire's 133px head (stage 3's note) is unchanged.

## Stage 5: what changed (375 x 812, PT, the audit's guest profile)

| Screen | Before | Now |
|---|---|---|
| Challenges | 14,132px: 45 full cards in one column | 3,862px. A tier is one board of rows (66px each): name, kind and opponent on the left; the rank that opens it, the stars earned or the XP on the right. The row opens the briefing, which already held every detail of the card. |
| Collection | 11,376px: 118 "??" cards two to a row | 1,354px on a new album. A rarity with nothing collected starts closed (its row says the count and the rank that opens it); three cards to a row; the filters are two rows. |
| Achievements | 11,116px: 114 rows | 1,250px. Each group opens on demand, its head carrying the count. |
| Profile | 14,910px (it embeds the achievement list) | 4,370px. The achievement groups and the eight-rank season track open on demand. |
| Leaderboards | 7,227px, nine boards on five rows of boxes | 7,077px. The boards are one row that scrolls sideways. The list itself is what the player came to scroll. |
| Quiz | The answer field a fixed card over the stats strip | The field sits in the puzzle's card and rides the bottom edge only while the card is on screen. |
| Missions, Settings | 1,529 / 1,296px | Left as they are: already close to right. |

New: `lib/usePhone` (true under 640px, followed live), for the one place where
the phone needs a different default STATE (the Collection's closed rarities).
Layout stays in CSS.

Checked in the dev build at 375 x 812 and 320 x 640 (no page overflow on any
of the six) and 1280 (desktop unchanged: full challenge cards three to a row,
every rarity and achievement group open, the quiz field in flow). `tsc`,
ESLint on `src/app` and the changed components, and 286 tests pass. Not run:
the full suite, `npm run build`, a physical phone, Safari.

Not done in this stage:
- **Profile is still 5.4 screens**: banner, sign-in, season figures, the badge
  shelf, the lifetime list (about 800px of rows) and the run history are open.
- The Collection's national-team album (4,063px, two tiles to a row) is
  unchanged.
- A signed-in profile, a profile with many cards or cleared challenges, and
  the Collection with owned cards were not seen: the audit profile is a guest
  with almost nothing.

## Stage 6 and Miguel's review (24/11)

Miguel on stages 3 to 5: challenges are a grid, not a list; the Collection
can come open; the closed cards in the career do not work (focus on each tab,
HQ with the most important only, reorder the stack, lesser cards side by
side); the way back to the menu was missed. Then: finish and publish.

| Screen (375 x 812) | Stage 3 to 5 | Now |
|---|---|---|
| HQ | 3.3 screens, six sections folded shut | 2,524px, nothing folded: day, inbox, glance board (four figures two to a row and the progression line, each opening its tab), season goal, headline and two stories |
| Career top bar | Exit inside More | A back key on the left, always on screen |
| Club | 1,903px, three folds | 3,308px open: trophies, reputation, six of 22 achievements and "Show all 22", history |
| Finances | 2,015px, three folds | 4,520px open: summary, sponsors, ledger, loans, then the ladder (1,863px) |
| Training | 3,238px, one fold | 4,167px open; the effects reference stays last |
| Standings | 2,637px, one fold | 3,278px open |
| Challenges | 3,862px of rows | 4,588px: a grid, two tiles to a row |
| Collection | 1,354px, empty rarities closed | 5,820px, every rarity open, three to a row |
| Matchday card | Three boxes, labels on three lines | Three rows |

The 44px / 11px rule: kept as the phone floor (#182), dead bars removed.

Content pages (about, faq, how-to-play, changelog, privacy, ratings, rlcs,
the guides and landings, a region page, /pt, missions, settings): measured at
375px, no sideways scroll on any; 2,800 to 8,500px of reading. Not redesigned:
they are text the reader came to scroll.

Checked in the dev build at 375 x 812 and 320 x 640 (HQ, Club, Finances,
Training, Standings, Season, Challenges, Collection) and at 1280 (HQ: every
block, the glance board and the back key absent). The career tour's eight
targets each resolve to one visible element on a phone. `tsc`, ESLint, the
full suite and `npm run build`: see the CHANGELOG entry for rc.5.

### Delivery Gate (anti-slop, `antislop.md`), phone work only

| Check | Result |
|---|---|
| Sideways overflow or broken mobile layout (R-03) | Pass at 375 and 320 on the screens above. Stage 4 fixed the one page that overflowed (Finances, 8px). |
| Em dashes in new text (R-02) | Pass: none in the new copy keys. |
| Invented figures, testimonials, logos, claims (R-17, 18, 23, 36, 38) | Pass: every figure on the new boards comes from the save's own view-models. |
| Dead controls, links to nothing (R-24, R-26) | Pass: each glance cell and tab-bar slot opens an existing route. One known soft spot: a mail link to `/career#career-progression` lands on the top of HQ on a phone. |
| Empty, loading, error states (R-27) | Pass: the screens keep their existing skeletons and empty lines; the glance board renders with no points and no plan. |
| Keyboard and focus (R-32), accessibility (R-39) | Partly checked: new controls are links and buttons with labels (`aria-label` on icon keys, `aria-expanded` on "Show all"). Not run: a screen reader, zoom at 200%. |
| Ran the app (R-35) | Pass in the dev build's browser. **Fail for a real device**: no physical phone, no Safari. |
| Contrast (R-25), theme modes (R-34) | Not re-measured: no colour or token changed; there is one theme. |
| Performance (R-40) | Not measured. No image or script added. |
| Purpose gate: gradients, glows, pills, glass, identical cards (R-01, 09, 10, 13, 14) | Pass: the new boards are hairline cells on one panel, no glow or glass; the challenge grid is the game's own cards, which `DESIGN.md` keeps as cards. |
| Liveliness: one focal point per screen | Pass on HQ (the day card holds the only filled button). |

## Still open

- A physical phone and Safari (safe areas, the docks over the home indicator,
  `position: sticky` inside the training board).
- A signed-in profile; an album and a challenge list with progress.
- Event playback: the controls sit above the series, not in a dock.
- The Results ceremonies still play one after another.
- The Profile is about five screens; the national-team album is unchanged.
- The Home's search text (2,300px under the menu) is as it was.

## Decisions (as they stand after 24/11)

Miguel approved stages 1 to 5 one by one and answered four of these on
24/11. The others shipped as drawn and can still be changed.

- 1 (Discord and coffee off the phone hero), 2 (no bottom nav in a run), 4 and
  8 (career tab bar: HQ, Squad, Market, Training, More), 7 (the draft's team
  dock), 10 (market tab labels): shipped as drawn.
- 9 (HQ order) and the folded sections: **replaced** by the glance board (R148).
- 11 (challenges as rows): **refused**, grid restored.
- 3 (the Home's search text), 5 (rules 3 and 4 on desktop), 6 (Results
  ceremonies): not decided, nothing changed.

The list as it was asked:

1. **Discord and "Buy me a coffee" leave the phone's hero** and sit at the end
   of the menu (v2.0 put them under the pitch on purpose).
2. **No bottom nav during a run** on a phone.
3. **The Home's search text** (2,300px under the menu): keep, or fold each
   block into a closed `<details>` on a phone (the text stays in the HTML).
4. **Career navigation on a phone (A7)**: a five-slot tab bar (HQ, Squad,
   Market, Training, More) that replaces the site's bottom nav inside the
   career, or another shape.
5. **The visual direction**: the identity (night blue, orange, paper,
   Industry, the card as reference) holds. What still reads as generated is
   density, not style: boards inside boards, boxed tabs, three tags per card.
   Proposal: rules 3 and 4 above apply to desktop too.
6. **Results ceremonies**: keep the full-screen sequence (unlock, rank-up,
   Legacy), or keep only the first and turn the rest into lines on the screen.
8. **Career tabs on the bar**: HQ, Squad, Market, Training, More. Inbox is
   inside More (its unread count shows on the More slot as a dot). Say so if
   Inbox should take a slot of its own.
9. **HQ order on a phone**: the inbox moved up to second place, ahead of the
   squad. This departs from HQ-CONTRACT H7 and needs an entry in
   `ROAD-TO-WORLDS-DECISIONS.md` if it stays.
10. **Market tab labels on a phone**: "Livres / Contrato / Coaches / Negócios"
    (EN "Free / Signed / Coaches / Deals"), so the four fit one row. Your
    wording if these are off.
11. **Challenges as rows on a phone**: the three star goals and the brief are
    one tap away (the briefing) instead of on the list. Say so if a row should
    carry more (the star goals, for instance).
7. **Draft on a phone without the pitch**: the dock replaces it while picking
   (the pitch is back on Review). Say so if the pitch should stay under the
   cards.
