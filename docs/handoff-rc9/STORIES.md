# rc.9 STORIES: the manager's post and the Fans tab

Branch `rc9/ui`, commits `9ffe710d`, `01e11124` and the one carrying this file. R253 to R257, #288 to #293.

## What changed

- **When:** `engine/career/fanFeedMoments.ts` (`postMomentOf`, `offerAllowed`), numbers in `CAREER_FEED.offer` (`balance.fanFeed.ts`). Title, final lost, Major/Worlds exit, favourite out of a qualifier, a first qualification or first playoffs, upset with a 3+ rating gap, streak of 6/10/15. 21 days apart (a title skips it), 6 a season, lapses after 4 days.
- **Where:** decision kind `post` (`store/careerDecisions.ts`, marked block; never holds), one row in `DecisionBlock` plus `top?.kind === "post"` in its `inline` test, `feed/PostDecision.tsx`. Top bar: one marked line in `CareerTopBar.tsx` (the surfacing day only). `NowFeedPost.tsx` deleted, its line out of `HubScreen.tsx`.
- **The sheet:** `feed/PostSheet.tsx`, `feed/FeedPostParts.tsx`; figures from `postEffectsOf` (the action run on the save).
- **Effects:** `CAREER_FEED.effects` (followers, morale, board). **LOCKER merge point:** `store/fanFeedFlow.ts` `moveSquadMorale`, one loop over `nudgeMorale`, reason `managerPost` (one union member in `lockerRoom.ts`, one line each in `copy.career.locker.en/pt.ts`). Board: `applyConfidence(board, fx.board, "managerPost")`, reason copy in `copy.career.en/pt.ts` `board.reasons`.
- **Text:** 63 manager posts (EN, PT), 6 replies; stored variant per post.
- **Fans tab:** `feed/FanFeedView.tsx`.
- **Save:** optional `fanFeed.offer`, `offerLog`, `reached`, post `moment`/`variant`/`streak`. `repairFanFeedOnLoad` in `migrateSaveToV5` retires an rc.8 pending post.

## Measured

Offers per season (FEED_SIM=1, `store/fanFeedOffer.sim.test.ts`, arc bot): tuned EU 0.3; professional EU/SAM 1.0 (6 seasons); professional SAM/NA 1.4; professional easy 1.6. None of these clubs reached a final or a Major, so the main moments never fired. **Below the 3-to-6 aim for clubs that win nothing.**

Tests green one file at a time: `fanFeedMoments` 14, `fanFeed` 36, `fanFeedOffer` 11, `fanFeedOffer.board` 1, `fanFeedFlow` 19, flag-off 4, `careerDecisions` 26, `persistContract` 45, `lockerRoom.view` 7, locker copy 2. `tsc` clean, eslint clean on my files.

## Seen (stories.localhost:3210, hand-built feed state on a new career)

Shots in `.claude/rc9/shots/stories/` (17): HQ decision 1280/375/320, sheet per tone 1280, 375, 320, receipt figures, exit, PT, feed thread with replies, receipt row, Fans tab 1280/375/320, empty state. Click-through: Write the post opens the sheet; each tone card switches preview and figures; Escape closes and focus returns; Publish posts and opens Fans (save checked: board log and morale log name the post); Not this time removes it with no effect; +1 day moves the clock with the offer standing; the top bar's state clears the next day. No sideways scroll at 375 or 320.

## Not verified

A real played series producing an offer in the browser (state was injected); Show all (fewer than 12 threads); the soft-lock probe and full suite; `BALANCE_VERSION` untouched (its test may fail on the new export).

## For Miguel

1. Offer rate for weak clubs (about 1 a season): accept, or shorten the gap / add regional top 4.
2. Effects sizes (R256).
