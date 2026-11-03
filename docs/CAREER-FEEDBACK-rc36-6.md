# Career feedback — rc.36.6, 2026-11-03

Base: `staging` / rc.36.5 / `ec2f60b`. Decision R94. Target:
`https://staging.rocketdraft.app`. Production and Gate 3b acceptance remain
unchanged. Scope is Miguel's 03/11 feedback, supplied logo/name workbook and
roadmap review; this is not the Etapa 4–6 implementation.

## Delivered

- Calendar actions now follow the actual clock hold instead of silently
  attempting a blocked day advance. Hidden reports acknowledge/repeat plans;
  the same flow handles coached plans and prevents duplicate cycle rewards.
- Tuesday/Wednesday scrims have a compact recorded-series playback and clock;
  Skip stops at each practice and clock controls wait until it completes.
  Reduced motion uses a brief static reveal. No extra simulation/reward.
- Non-participant actions reduce to watch/results/calendar; no follow
  suggestion beside private bids. Failed qualification keeps the regional
  visible. Every transfer-window day has a blue marker.
- HQ highlights available upgrades; locked bootcamps have no Buy or price,
  and their purpose is clearer. Training's six attribute explanations sit
  higher and include current values and the rating baseline.
- 50/50 presents public news using the supplied logo. Private decisions use
  signed mail; routine technical chatter is quiet. Old communications migrate
  additively. One league email covers each qualifier outcome. EN/PT copy has
  editorial articles and email greeting/paragraphs/signature.
- 50/50 and duds showmatch invitations, rotating 50/50 community cup, rare
  1v1/2v2 community brackets using the chosen squad members' actual attributes.
  Weekly random events wait until after the first regional. Official circuit
  remains 3v3; community rewards do not grant official points.
- Workbook: 834 players, 280 orgs, four excluded rows respected. Shared
  regional catalogs replace separate naming styles for new careers, with
  seeded disjoint allocations. Five real-player collisions use II and three
  cross-region homonyms region labels. Old save identities remain intact.
  Source and generated catalog have a repeatable `build:career-names` script.
- Roadmap/remaining sessions: `ROADMAP-NEXT-2026-11-03.md`.

## Verification performed

- Affected career engine/store/components, bilingual content, assets,
  persistence and balance: **77 files passed, nine optional files skipped;
  968 tests passed, 15 optional skipped**, 43.46 seconds. Includes new weekday,
  playback/idempotence, classification visibility, editorial/migration,
  pre-regional eligibility and selected-roster 1v1/2v2 coverage.
- After the browser exposed redundant qualifier email: the two affected
  communication/weekend test files rerun, **50 passed**, 5.18 seconds.
- Typecheck clean; lint of changed/new TypeScript clean. Dataset validation
  and 35 frozen persist-contract tests pass. BALANCE_VERSION **11**; fingerprint
  `62d58c14`. Persist version 3/saveVersion 5 unchanged.
- Static production build with career/noindex enabled passes, including
  postexport: **49 static pages**, **1700 files / 45.63 MB**, all **863**
  manifest image URLs present. Accounts/analytics disabled, career enabled.
  Initial restricted Windows runs failed creating nested segment directories
  (EPERM); the identical source passed outside that filesystem restriction.
  No infrastructure/config changes were added to work around the environment.
- Browser, disposable local career, EN desktop: new-catalog founders;
  50/50 masthead/credit; locked camp without Buy; Tuesday/Wednesday clocks
  with Skip disabled and no result spoilers; qualifier elimination; three
  follow actions; continue to calendar; regional still visible as not
  qualified; all opening-window days marked; report opt-out followed through
  day 29 with **Cycle 2 running**, no modal or held clock.
- PT mobile 390×844: cycle/attribute guide readable; document content width
  equals viewport width, no horizontal page overflow. Viewport restored.

## Focused acceptance play

1. Start a new career to see the supplied names. Run a plan with scrims on
   Tuesday/Wednesday and try Play/Skip around each broadcast.
2. Disable cycle results, cross a cycle boundary, then re-enable them.
3. Lose a qualifier: check the retained calendar event and watch/results/
   continue choices. Inspect the single league email and public feed.
4. At a progression unlock, inspect the new-item highlight and camp states.
5. When offered a 1v1/2v2 cup, choose participants and play/simulate it;
   new weekly showmatch invites can appear after the first regional.

## Limits and next gate

No lengthy opt-in economic/multi-season matrices, unchanged Draft modes or
request-budget probes were repeated. Previous rc.36.3–5 economy/endgame and
static-request evidence remains the baseline, not new proof of pacing.
Regional timing, 88/90+ affordability and historical Worlds title viability
still need the next focused Gate 3b session and Miguel's acceptance. Remaining
historical editorial corpus is also open. No production release is authorized
by this feedback package.
