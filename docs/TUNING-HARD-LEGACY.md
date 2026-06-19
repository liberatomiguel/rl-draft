# Tuning Hard & Legacy difficulty (quick reference)

All knobs live in **`src/config/balance.ts`** → `DIFFICULTY.hard` / `DIFFICULTY.legacy`
(and `REGION_LOCK` for SAM). Edit a value, run `npm test`, playtest. No other file needs touching.

## The one lever you'll use 95% of the time

```ts
DIFFICULTY.hard.opponentRatingShift    // currently -0.5
DIFFICULTY.legacy.opponentRatingShift  // currently -0.3
```

A flat rating added to **every opponent**.
- **More negative → EASIER** (opponents weaker → you win more).
- **More positive → HARDER**.
- Sensitivity: ~**0.2–0.3** is a noticeable change. As a rough guide for a fixed
  team total, each **-0.4** shift on Legacy roughly **doubles** the title rate at
  the top end.

Measured now (worldwide, by team OVR):
- Legacy `-0.3`: 92→~0%, 94→~7%, 95→~17%, 96→~36%.
- Hard `-0.5`: 90→~2%, 92→~12%, 95→~50%.

Want a 95 dream to win Legacy ~25%? Try `legacy.opponentRatingShift: -0.6`.
Want Hard harder? Move `hard.opponentRatingShift` toward `0` (e.g. `-0.2`).

## The field-strength lever (secondary)

```ts
DIFFICULTY.legacy.opponentTierWeights  // { elite: 1.4, strong: 1.1, solid: 0.3, underdog: 0.15 }
DIFFICULTY.hard.opponentTierWeights    // { elite: 0.7, strong: 1.1, solid: 1.0, underdog: 0.7 }
```

Sampling weights for who you face. **Raise `elite` → harder** (more superteams),
**lower it → easier**. Combine with the shift if you want a *different field* rather
than just *weaker opponents*.

## Player's own edge (makes strong drafts win more, doesn't touch the field)

```ts
DIFFICULTY.hard.chemistryMaxBonus    // 2.3
DIFFICULTY.legacy.chemistryMaxBonus  // 2.9
```

The player's chemistry rating bonus cap (AI cap is **0** on Hard/Legacy, so this is
a pure player buff). Raise it to reward coherent, high-chemistry drafts without
weakening opponents.

## SAM (region-locked) only

```ts
REGION_LOCK.opponentRatingBoost  // currently 2
```

Added to **every region-locked opponent**. **Higher → harder SAM**, **lower → easier
SAM**. At `+2`: a SAM 88→~6% / 90→~21% Legacy. `+1` ≈ 88→~10% / 90→~30%; `+0` ≈
88→~19% / 90→~40%.

## After any change

1. `npm test` — the `balance.test.ts` anchors must stay green (retune or rebase the
   band with a comment if you consciously moved the target).
2. Playtest a Hard and a Legacy run.
3. Note it in `docs/CHANGELOG.md` under **Balance**.
