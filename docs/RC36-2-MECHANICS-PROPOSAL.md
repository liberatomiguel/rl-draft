# rc.36.2 — gameplay choices for the playtest

Current diagnosis: season goals only deduct reputation on a miss. Sunday's
keep/recover/prepare offers 0 / +0.25 throughout / +0.5 opener, so Keep is
strictly dominated. Miguel approved this model for the playtest on 31/10.

## Approved playtest candidate

- Season goals: +1 reputation for the target, +2 for the stretch, independently,
  once at season review; reputation capped normally, no cash payout. Existing
  failure risk remains. Existing closed season reviews are never repaid.
- Sunday continuity: +0.10 team rating every Sunday series.
- Sunday recovery: +0.35 every series, −0.50 opener (first series −0.15).
- Sunday preparation: −0.15 every series, +0.75 opener (first series +0.60).
  Recovery suits a long Sunday but risks its opening; preparation suits the
  opening but loses strength later; continuity is stable. The engine must
  apply negative opener values (it currently only applies positive ones).
- Between events: show actual recorded weekly scrims as a quick recap, with
  optional jump to their results. No new matches or daily chore.

## Economy experiment already requested

One candidate, using existing tunables: season money index 1.12 → 1.15 for
all money streams together; renewal raise cap 1.50 → 1.75 and market floor
0.50 → 0.60, preserving the 2.5 maximum jump; coach quality curve 1.12 → 1.14.
Compare renewal/prize/coach curves and solvency before selecting the release
values. This does not change match difficulty or career development pace.

## Regional examples — Miguel chose the starting season

The career begins in RLCS X. Show only that season's strongest dataset
lineups, ranked by their actual average overall, with the starting season
explicit in the label. In SAM the current dataset ranks Rebel, True Neutral,
Noble, then FURIA; later FURIA dominance does not change the initial roster.
No team strength, org entry schedule or dataset row is changed.
