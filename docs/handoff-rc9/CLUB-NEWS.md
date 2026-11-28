# rc.9 CLUB-NEWS: inbox, newsroom, Club, saves, wizard, follow (handoff)

Branch `rc9/ui`. Decisions #263 to #269. Screens and copy only.

## What changed

Done by the first agent (commits `ca1234db`, `029245b5`, `8ca6b9ce`, `911f5553`, `36bd158f`, `7d9a721a`): inbox as a list and a reader with the "Reply needed" tag; newsroom as headline rows; Club identity and quiet figures; saves as rows of one board with the account state as one line; wizard step titles; follow and announcement in the type system.

Finished here:
- `screens/NewsScreen.tsx`: Escape closes the open message (yields to a dialog).
- `news/NewsFeed.tsx`: the masthead wraps to two rows on a 320 phone, the unread count never breaks.
- Copy `career.mail`, `news`, `club`, `wizard`, `cloud`, `saves`, `savesNotice`, `follow`: dead keys out (`news.feed.newIn`, `leftScene`, `tpl.sponsorDropped`), full stops off hints and labels, two closers cut (`rsBerths`, the board's package mail), PT articles on events and orgs (about 15 strings).
- Words (string literals, EN / PT), before at `rc9/int` and now: mail 1,904 / 1,893 to 1,377 / 1,400; news 2,443 / 2,581 to 1,532 / 1,632; club 218 / 243 to 194 / 221; wizard 490 / 511 to 362 / 381; cloud 284 / 286 to 271 / 273; saves 30 / 31 to 31 / 33; savesNotice 48 / 45 to 29 / 29; follow 61 / 63 to 49 / 52; spectate 15 / 18 to 0. Total 5,493 / 5,671 to 3,845 / 4,021.

## Seen (dev server, club.localhost:3210, founded career, 3 weeks in)

Inbox list and reader, newsroom, Club, saves, wizard (5 steps), follow empty state, delete dialog (Escape closes). Shots in `.claude/rc9/shots/club/`: 1280 (inbox reader, newsroom, club, saves, wizard x3), 375 (inbox list, reader, newsroom, club x2, saves), 320 (newsroom, club, saves, wizard x2, follow). No sideways scroll and no control under 44px at 375 and 320 on any of them (script check).

## Click-through

Wizard: name, tag, manager, Next x4, Found. Inbox: open row, Escape, tabs Inbox / Newsroom / Transfer window / Fans. Club: all boards load, rep counts up. Saves: Resume, Export, Delete, Cancel, Escape.

## Not verified

- Follow with a live event (needs a lost qualifier; the Event screen was mid-edit by MATCHDAY).
- Keyboard order by hand: the controls are native buttons or links, checked by code and the Escape runs only.
- Focus did not return to the Delete button after Escape in the shared `Modal` (not changed).
- A tab click in the newsroom strip once left the old view after a fast double click while Next compiled (dev only, not reproduced).
- Copy files `copy.career.*.ts` held other fronts' uncommitted hunks; they went into my last commit with mine.
- `balanceVersion.test.ts` not run. `tsc`: one error left, `SeasonScreen.tsx` `bizRecap` (not mine). Tests: news, content and `careerEco07` ran, 1 failure fixed by dropping one assertion (the loan mail no longer prints the `rescueTo` figure); that file was not re-run after the edit.

## For Miguel

- The Club still lists Pro peripherals, 240Hz monitors and Tournament PCs in Progression (founded shelf, ORG decided that for existing orgs only).
- The newsroom lead carries the 50/50 mark twice (masthead and lead); say if one should go.
- `mail.greeting` and `signoff` are unused on screen (only a test reads them); they can go with that test.
