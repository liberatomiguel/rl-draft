# v2.3 wave 2, front UI: the locker room and the fan feed on screen

Branch `v23/ui-stories` (base `23a091f`). Flags as in wave 1 (`FEATURES.lockerRoom`, `FEATURES.fanFeed`). Decisions R201 to R204 (`ROAD-TO-WORLDS-DECISIONS.md`), DESIGN-DECISIONS #220 to #223.

## Surfaces

| Spec | Surface | File | Mounts in |
|---|---|---|---|
| U1 | Mood on the starter cards (face glyph + word) | `locker/lockerUi.tsx` (`TileMood`, `MoodMark`, `MoodGlyph`, `PlayerFace`) | `SquadScreen` starter tiles' `footer` |
| U1 | Why sheet: mood, last 4 changes with reason and value, open promise (progress, deadline, at-risk line), his open talk | `locker/PlayerMoodSheet.tsx` (`Modal`, portal) | opened from the locker room rows |
| U2 | Locker room board: first open talk in full, other talks as rows, one row per player, the word (kept / broken), open promises | `locker/LockerRoomBlock.tsx` (`#locker-room`) | `SquadScreen`, left column under Roster stability |
| U2 | HQ card: talks waiting, promises at risk (desktop: first talk answerable; phone: rows to the locker room) | `locker/NowLocker.tsx` | `HubScreen`, under `DecisionBlock` |
| U3 | The talk as a conversation | `locker/LockerTalk.tsx`; `locker/LockerTalkAnswers.tsx` now renders it without its head | inbox reader, locker room, sheet, HQ card |
| U4 | Fans view: followers, posts, manager posts, receipts quoting the post, empty state, "Show all N" | `feed/FanFeedView.tsx` | `NewsScreen`, fourth tab (`#fans`) |
| U5 | Post after the series: three tones with hints, preview, Post / Skip, posted state with a link to the feed | `feed/NowFeedPost.tsx` | `HubScreen`, under `DecisionBlock` |

Engine (pure, read-only, tested in `src/engine/career/lockerRoom.view.test.ts`): `promiseProgressOf`, `playerLockerLogOf`, `squadMoodOf`, `wordStandingOf`, `lockerAttentionOf`, `lockerDaysBetween` (`lockerRoom.ts`); `managerPostDraftOf` (`fanFeed.ts`). Copy: `locker.ui.*`, `feed.ui.*` (EN, PT).

## Every line in an existing file (all marked `// v2.3 UI`)

| File | Lines | Purpose |
|---|---|---|
| `src/store/careerStore.ts` | 2 imports; `postToFeed` in the interface and the actions | U5 action (`withSave(postToFeedFlow)`) |
| `src/components/career/screens/HubScreen.tsx` | 2 imports; one `div.empty:hidden` with `<NowLocker/>` and `<NowFeedPost/>` | U2, U5 |
| `src/components/career/screens/SquadScreen.tsx` | 2 imports; `footer=` on the starter tiles (flag-gated); `<LockerRoomBlock/>` | U1, U2 |
| `src/components/career/screens/NewsScreen.tsx` | 2 imports; `"fans"` in `DeskView`/`VIEWS` (flag-gated) and `viewLabel`; tab strip classes (flag-gated) + a horizontal-scroll effect; `<FanFeedView/>` | U4 |
| `src/content/copy.career.{locker,feed}.{en,pt}.ts` | `ui` groups | strings |
| `src/engine/career/lockerRoom.ts`, `fanFeed.ts` | appended selectors | views |

## What I looked at in the browser (dev server, `localhost:3230`)

States were reached on a `/career?start=quick` save by writing `lockerRoom` / `fanFeed` / one talk mail into localStorage with a throwaway script (scratchpad, not in the repo): one unhappy player with a bench talk, one angry with a transfer request and a stay promise, one delighted with a minutes promise at risk, word 1 kept / 2 broken (damaged), seven series, a provocative post settled as a receipt, a confident post.

| State | 1280 | 375 | 320 |
|---|---|---|---|
| Squad, neutral squad (no locker state) | | EN | |
| Squad, starter cards with moods | EN | | |
| Squad, locker room with talk waiting, unhappy/angry/delighted rows, word damaged, promise open and at risk, broken-promise reason | EN | EN, PT | EN (talk part) |
| Mood sheet (angry with talk; delighted with promise at risk) | EN | EN | |
| Talk answered in the sheet (promise opened) | | EN (read as text) | |
| Inbox reader with the talk, then answered (Refuse) | PT | | |
| HQ locker card, talk answered on the card (outcome shown) | EN | EN, PT (phone rows) | EN |
| HQ post card: tones, preview (provocative / humble), posted state | EN | EN, PT | |
| Fans: posts, manager post, reply, receipt quoting | EN | EN | EN |
| Fans: empty feed (followers, no series) | | PT | |
| HQ with nothing to show (no gap; wrapper `display: none`) | | EN | |
| Flags off (server restarted with both at 0, same stateful save): HQ, Squad, News `#fans` | | | EN |

No sideways page scroll measured at 320 and 375 on Squad, HQ and News.

## v2.3 FIX (post card, media offer)

- U5: the three tone buttons have an accessible name (`aria-label` = the tone, `aria-describedby` = its hint); the hints and the preview are written for a series already played, won or lost (see FEED.md). Seen on a real played career (lost 0-3 at a qualifier, provocative preview, posted, Fans tab), PT.
- The media offer's answers are mounted in the inbox reader and look like the locker talk's: the rule above, full-width option rows, the hint in the faint line (see MEDIA.md).

## Not seen

- Any state produced by actually playing weeks (a promise kept or broken by the engine, an auto-answered talk, a real receipt): all were hand-built saves, the dates in the log rows are clamped fixture dates.
- Fans at 1280 in PT, the empty feed at 1280 / 320, the "Show all N" button (not checked), a save with `fanFeed` absent on the Fans tab.
- A takeover (established org) save: `useActiveCareerCopy` is used on HQ and News, `useCareerCopy` on Squad, as those screens already do.
- No build, no full suite, no probe.

## For Miguel

1. The talk's answers commit with one tap (R201). Should a promise ask "are you sure"?
2. On HQ the locker card sits under the decision block, above the squad, on desktop and phone. Is that the right place, or should it ride inside the decision block's "Also" line?
3. The squad mood in the board's head is the mood of the average morale; with one angry and one delighted player it reads "Settled". Keep, or show the worst mood instead?
