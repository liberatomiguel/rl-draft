# rc.36.1 — Gate 3b playtest corrections

This revision implements Miguel's rc.36 visual and interaction feedback.
Etapa 4 has not started. The visual reference remains Squad, Market, Inbox
and the regular Draft: neutral surfaces, compact rows and selective accents.

## Delivered

- HQ finances: link at top right, no title icon/footer gap, larger balance and
  chart, payroll/runway as discreet unboxed icon lines.
- HQ: taller starter cards, no next-regional sentence, compact Major/Worlds
  tabs, three progression rows with purchases and next unlock below, simplified
  season goals and thin news rows around a single lead story.
- Calendar: one month at a time with adjacent-month navigation; every window
  day in HQ has a blue top strip, even on event days.
- Training: earned-gain bar with stable animation and finer display precision,
  quiet colors/counter/report, yellow recommendation, no visible cycle history,
  one-click repeat of the previous plan. No growth/payout tuning.
- Sponsorship: active offers open directly; deferring and deadlines persist.
- Talks: lowering bonus/share no longer raises wages behind the slider; quieter
  controls. Wage/share/bonus valuation and save contracts stay intact.
- Crest: predefined colors only, no contrast meter, existing saves supported.
- Follow: shared Swiss standings and bracket from recorded rounds, reveal-safe.

## Verification

- Full suite: **1,441 passed**, 13 opt-in checks skipped; 127 files passed.
- Typecheck clean; lint zero errors/warnings. Static staging-like export passed
  with career on, noindex, accounts/analytics off; 45 data and 35 persist
  contract checks passed in prebuild.
- **39 browser cases/checks passed**: 21 weekend/crest cases, 16 targeted
  training/repeat/calendar/window/sponsor cases across desktop/mobile and EN/PT,
  plus two negotiation cases (EN desktop/PT mobile). Zeroing bonus via the
  range control preserved the selected wage; sponsor deferral survived reload.
- Screenshots of HQ, training, calendar, negotiations and spectator boards
  reviewed for hierarchy, restraint and consistency. No horizontal page overflow
  in the weekend/crest checks; the bracket retains its own horizontal scroll.
- Request budget: two complete Classic runs (seed 1, desktop/mobile), 61
  requests each against 75; cold home 27 against 28.
- Effects: profile 53 ms/s against 80; leaderboard 22 against 60; zero
  non-composited animations. All preview servers and browsers stopped.

The rc.36 economy/growth measurements remain the balance reference. This
revision changes contract input controls and presentation, without tuning
match difficulty, growth, wages, prize tables or sponsor pricing. No new
long-career calibration sweep was needed for this playtest correction.

## Play

Open staging in EN/PT on desktop/mobile. Check the HQ hierarchy, a transfer
window, previous/next calendar month, a cycle's earned gain and direct repeat,
a sponsor popup and its deadline, a high-bonus offer reduced to zero, palette
selection, and Swiss/bracket watching after elimination. Confirm the restrained
visual direction and report any remaining interaction issue.

Gate 3b remains Miguel's playtest; Etapa 4 and main await approval.
