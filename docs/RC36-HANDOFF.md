# rc.36 handoff — integration completed

The interrupted handoff at commit 8c0567d has been consumed. All six fronts
are integrated on rc36-int; current evidence and the Gate 3b playtest are in
`RC36-GATE3B.md`. Current-state docs: STATUS.md and
ROAD-TO-WORLDS-STATUS.md. History: CHANGELOG.md and decisions R83–R88.

## Integrated work

| Front | Finished source | Integration |
|---|---|---|
| H2 | c29b605 | f03933f |
| T2 | 0615ee4 | 74d87da |
| A | 36e3709 | f47fac2 |
| S2 | 80514b4 | aad0d0f |
| M | f7e4219 + 128dce4 | 2c764e4 |
| B | 085e3d3 + 9ea3752 | b27927b |

Independent review completed. Its two findings are fixed: package scrims
respect the plan's start day, and Sunday's intro traps/restores keyboard
focus. The first base-training session is intentionally not paid twice.
Unused HQ debt/guaranteed fields are gone; committed finance projection stays.
R83–R88 are ordered and all E2E labels retained. Temporary M/profile tests
are removed. Persist and shared-match contracts are unchanged.

## Release evidence

The integrated pre-calibration suite passed 1437 tests (13 opt-in skips),
with clean typecheck/lint, unchanged regenerated data and 45 data validation
tests. B's browser verification passed 21 weekend cases and creation/contrast
checks across desktop/mobile and EN/PT; servers and browsers were stopped.

Final balance measurements, export/E2E/request-budget verification and the
staging release record are consolidated in RC36-GATE3B.md. BALANCE_VERSION
stays six across rc.36; the final test holds its recomputed fingerprint.

## Next stop

**Gate 3b: Miguel's playtest and decisions.** Follow ROADMAP's "Waiting on
Miguel"; do not start Etapa 4 or deploy Season 1 to production before approval.
The remaining loan, EU policy, wage-budget, scouting-band and veteran rebuild
choices retain their defaults; this integration does not silently approve them.
