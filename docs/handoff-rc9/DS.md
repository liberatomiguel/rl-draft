# rc.9 handoff: DS (type, spacing, chrome, Squad)

## What changed
- `src/app/globals.css`: type ladder and spacing as variables (`--w-*`, `--tr-*`, `--text-*`, `--sp-*`, `--panel-pad`), role rules that remap the weight utilities on display text (#209), tracking by role (#211), mixed-case `.card-title`, kicker in Medium/faint (#214), text sizes for the text face (#212), `.stack-sections` / `.stack-block`, Chakra lab variables and latin-ext faces.
- `src/app/layout.tsx`, `src/app/fonts/`: Industry Black no longer declared (#210); Chakra Petch (OFL, licence file) with `preload: false` (#213).
- `src/components/ui/`: `typeLab.ts`, `TypeLabSwitch.tsx` (lab, Settings section in `app/settings/page.tsx`), `CloseIcon`, disabled primary button (#219).
- Chrome: `CareerTopBar.tsx`, `CareerTabBar.tsx`, `CareerToaster.tsx` (#215, #216).
- Squad: `SquadScreen.tsx`, `RosterSeasonStats.tsx`, `locker/LockerRoomBlock.tsx`, `locker/lockerUi.tsx` (#217, #218).
- Copy: `SETTINGS_UI.typeLab*`, `squad.col*`, `contractsEnding`, `stabilityLine`, `openMood`, `roleStarter` (EN and PT).
- `DESIGN.md`: Type, Spacing, Hierarchy recipes. Decisions #209 to #219, CHANGELOG `rc.9 (unreleased)`.

## Seen (dev server, `ds.localhost:3210`, founded career + FURIA takeover)
Screenshots in `.claude/rc9/shots/ds/`: Home 1280/375, HQ 1280 (Industry and Chakra), Squad 1280 (both faces), 1024, 375, 320, news toast and mail toast at 1280, draft run 1280/375, play setup 375. No sideways scroll at 375 or 320 on Squad, HQ, Home. Computed styles checked: h1 700, slab/h2 600, nav and kicker 500, caps tracking 0.07em.
Click-through: type lab via `?type=` both ways; contract name opens the sheet; mood row opens the mood sheet (not clicked); toast X dismisses; tabs navigate.
tsc clean; eslint clean on touched files; 9 test files (sharedPath, persistContract, integrity, copy and career UI tests) pass.

## Not verified
Profile page at all; Settings lab control rendered (code only); mood button click; the toast at 375; the end-of-draft continue button (survey report); every wave-2 screen under the new global ladder. `.panel.p-4/p-5` padding override beats a caller's `pt-0`-style utilities on the same board: watch for it.

## Notes for others
- Turbopack served a stale `globals.css` from cache on first start; touching the file fixed it.
- Home "UNRANKED" breaks at 375 even at 0 tracking: pre-existing, not this front.
- The ORG front's sponsor dialog reopens on every career page.

## For Miguel
Industry refined versus Chakra Petch: switch with `?type=chakra` on staging.
