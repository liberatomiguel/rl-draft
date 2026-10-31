# rc.36.2 — focused economy playtest

Miguel requested firmer renewals, rising tournament prizes and a review of coach
prices. This is one candidate on the existing economy contract, not a new
calibration search. Balance version 7; fingerprint 286517b1.

## Selected values

| Lever | rc.36.1 | rc.36.2 |
|---|---:|---:|
| Common season money index | 1.12 | 1.15 |
| Renewal current-wage multiplier | 1.50 | 1.75 |
| Renewal fresh-market floor | 50% | 60% |
| Breakout jump guard, before existing premiums | 2.50 | 2.50 |
| Coach quality-point wage growth | 1.12 | 1.14 |

All indexed streams still grow together: wages, prizes, new sponsors, fees and
other indexed costs. Signed player/coach/sponsor amounts are not rewritten.
The season-7 prize multiplier rises from about 2.21 to 2.66. Coach asks at
quality 80 / 84 / 88 in Normal season 0 rise from about $1.6k / $2.5k / $4.0k
per split to $1.9k / $3.3k / $5.5k. Ex-pro and experience premiums still apply.

## Matched careers

Six real-flow careers: SAM/EU × autopilot/tuned/youth × seed 9100 × Normal,
eight seasons each. The comparison reads the same cells from rc.36.1's saved
294-career report; no baseline careers were replayed. The new run also includes
the approved season-goal rewards and Sunday choices, so outcomes are the whole
candidate's effect, not isolated economic causality.

| Measurement | rc.36.1 | rc.36.2 |
|---|---:|---:|
| Career / season rows | 6 / 48 | 6 / 48 |
| Ended careers / softlocks | 0 / 0 | 0 / 0 |
| Tight Mondays / total | 166 / 1530 | 179 / 1530 |
| Renewal observations | 45 | 50 |
| Median renewal ask / previous wage | 2.481 | 2.491 |
| p90 renewal ask / previous wage | 2.75 | 2.75 |
| Major qualifications / Worlds seasons | 8 / 2 | 9 / 3 |

The unchanged breakout guard already bound many developed founders; the new
raise/floor primarily makes moderate development dearer. Existing title and
ambition premiums can exceed the core jump guard. The sample is a solvency
smoke, not a replacement for the 294-career difficulty/region sweep or proof
of the 0.44 / 16% Normal pacing target. That playtest decision remains open.

Reproduction: CAREER_ECON=1 ECON_REGIONS=SAM,EU ECON_DIFFS=normal
ECON_POLICIES=autopilot,tuned,youth ECON_SEEDS=1; the probe records ECON_OUT
and ECON_ARC_OUT together. Pure curves were run once before and once after.
Raw reports are local work artifacts; engine tests and the selected values
are committed. The complete rc.36 reports remain the broader prior baseline.

## Sponsorship diagnosis

Steady pays across six splits, Balanced three, Bold one. Comparing maximum
contract totals made the longest deal look richest; the signing sum also
covers more weeks. Pricing is unchanged: Balanced's weekly pay and bonus are
higher at comparable tier/level. Offer cards now compare maximum return per
remaining payment week, with the full total and duration immediately below.
This normalizes presentation without shortening contracts or adding money.
