# Tuning Hard & Legacy difficulty (quick reference)

All knobs live in **`src/config/balance.ts`** → `DIFFICULTY.hard` / `DIFFICULTY.legacy`
(and `REGION_LOCK` for SAM). Edit a value, run `npm test`, playtest. No other file needs touching.

## The one lever you'll use 95% of the time

```ts
DIFFICULTY.hard.opponentRatingShift    // currently -0.7
DIFFICULTY.legacy.opponentRatingShift  // currently +1.70  (NOTE: positive — Legacy opponents are BUFFED)
```

A flat rating added to **every opponent**. Note the **signs differ**: Hard
*subtracts* from opponents (it's eased), while Legacy *adds* — the Legacy field is
buffed above raw, which is why it's the gauntlet.
- **More negative → EASIER** (opponents weaker → you win more).
- **More positive → HARDER**.
- Sensitivity: ~**0.2–0.3** is a noticeable change at the top of the curve.

**The right way to tune Legacy is `difficulty.sim.test.ts`** (v1.4) — a REALISTIC,
deterministic harness that drafts real teams (synergy-aware + the reset behaviour) and
prints the **win-rate-by-final-overall curve**. Edit the shift, run that test, read the
new curve. Targets (worldwide): a ~92 team ≈ 0%, only a **98+ pinnacle ≈ 40%** (the very
best team a player can build has a real, satisfying shot; non-elite almost never wins).

Measured now (realistic-draft curve):
- Legacy worldwide `+1.70`: 92-93 ≈ 0% · 94-95 ≈ 0.7% · 96-97 ≈ 9% · **98+ ≈ 40%**.
  (The #79 ease, 1.65 → 1.35, overshot — a 98+ pinnacle was winning ~47%; 1.70 brings it
  to ~40%.) SAM uses its own boost (see below).
- Hard `-0.7`: the blended total win rate sits around **~15%** (the sim showed ~12.5% at
  the old -0.2, so this nudges it up).

Want the Legacy pinnacle higher (less punishing)? Move `legacy.opponentRatingShift`
*down* (e.g. 1.5 → ~45% at 98+). Want it harder? *up*. Want Hard harder? Move
`hard.opponentRatingShift` toward `0` (e.g. `-0.4`).

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
REGION_LOCK.opponentRatingBoost  // per-difficulty: { easy: 2, normal: 2, hard: 2, legacy: 1.0 }
```

A **per-difficulty record** (not a flat scalar) added to **every region-locked
opponent**. **Higher → harder SAM**, **lower → easier SAM**. easy/normal/hard stay
at **2**; **legacy is 1.0** (v1.4 retune, #79.1), so the SAM Legacy effective shift =
`legacy.opponentRatingShift (1.70) + 1.0 = 2.70`. SAM lives on its OWN lower, flatter
scale (weaker pool, ~93 ceiling, but very high chemistry), so it's tuned to its own
curve — NOT the worldwide one. Measured (`difficulty.sim.test.ts`, SAM): 88-89 ≈ 6% ·
90-91 ≈ 15% · **92-93 (the SAM ceiling) ≈ 34%** · never impossible. Because the SAM
curve is flat, lowering this boost lifts the top AND the middle together. Tune the
per-difficulty entry you care about — raising `legacy` re-hardens SAM Legacy only.

## After any change

1. `npm test` — the `balance.test.ts` anchors must stay green (retune or rebase the
   band with a comment if you consciously moved the target).
2. Playtest a Hard and a Legacy run.
3. Note it in `docs/CHANGELOG.md` under **Balance**.
