# Tuning Hard & Legacy difficulty (quick reference)

All knobs live in **`src/config/balance.ts`** → `DIFFICULTY.hard` / `DIFFICULTY.legacy`
(and `REGION_LOCK` for SAM). Edit a value, run `npm test`, playtest. No other file needs touching.

## The one lever you'll use 95% of the time

```ts
DIFFICULTY.hard.opponentRatingShift    // currently -0.7
DIFFICULTY.legacy.opponentRatingShift  // currently +1.35  (NOTE: positive — Legacy opponents are BUFFED)
```

A flat rating added to **every opponent**. Note the **signs differ**: Hard
*subtracts* from opponents (it's eased), while Legacy *adds* — the Legacy field is
buffed above raw, which is why it's the gauntlet.
- **More negative → EASIER** (opponents weaker → you win more).
- **More positive → HARDER**.
- Sensitivity: ~**0.2–0.3** is a noticeable change. As a rough guide for a fixed
  team total, a **+0.3** shift on Legacy roughly **halves** the title rate at the
  top end (and a -0.3 roughly doubles it).

Measured now (worldwide, faithful blended sim — the v1.4 targets):
- Legacy `+1.35`: a ~92 team stays near 0%; a 97 dream ~29%; the blended total win
  rate sits around **~5%** (Miguel's v1.4 target). SAM Legacy is eased in lockstep
  (effective shift 4.60 → 3.40) toward the same ~5%.
- Hard `-0.7`: the blended total win rate sits around **~15%** (Miguel's target;
  the sim showed ~12.5% at the old -0.2, so this nudges it up).

Want Legacy easier (a 97 dream above ~30%)? Move `legacy.opponentRatingShift`
*down* toward `+1.0`. Want Hard harder? Move `hard.opponentRatingShift` toward `0`
(e.g. `-0.4`).

## The field-strength lever (secondary)

```ts
DIFFICULTY.legacy.opponentTierWeights  // { elite: 1.8, strong: 1.1, solid: 0.3, underdog: 0.15 }
DIFFICULTY.hard.opponentTierWeights    // { elite: 1.0, strong: 1.1, solid: 1.0, underdog: 0.7 }
```

Sampling weights for who you face. **Raise `elite` → harder** (more superteams),
**lower it → easier**. Combine with the shift if you want a *different field* rather
than just *weaker opponents*.

## Player's own edge (makes strong drafts win more, doesn't touch the field)

```ts
DIFFICULTY.hard.chemistryMaxBonus    // 2.4
DIFFICULTY.legacy.chemistryMaxBonus  // 3
```

The player's chemistry rating bonus cap (AI cap is **0** on Hard/Legacy, so this is
a pure player buff). Raise it to reward coherent, high-chemistry drafts without
weakening opponents.

## SAM (region-locked) only

```ts
REGION_LOCK.opponentRatingBoost  // per-difficulty: { easy: 2, normal: 2, hard: 2, legacy: 2.05 }
```

A **per-difficulty record** (not a flat scalar) added to **every region-locked
opponent**. **Higher → harder SAM**, **lower → easier SAM**. easy/normal/hard stay
at **2**; **legacy is 2.05** (v1.4, #79), so the SAM Legacy effective shift =
`legacy.opponentRatingShift (1.35) + 2.05 = 3.40` (down from 4.60 pre-v1.4),
easing SAM Legacy toward the same ~5% target as worldwide. Tune the per-difficulty
entry you care about — raising `legacy` re-hardens SAM Legacy without touching the
other modes.

## After any change

1. `npm test` — the `balance.test.ts` anchors must stay green (retune or rebase the
   band with a comment if you consciously moved the target).
2. Playtest a Hard and a Legacy run.
3. Note it in `docs/CHANGELOG.md` under **Balance**.
