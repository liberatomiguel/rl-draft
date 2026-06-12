# Special card photos

Drop one image per special card here, named by the card id from
`src/data/specialCards.json`:

```
sp-jstn-this-is-rocket-league.png
sp-kaydop-triple-crown.png
sp-squishy-double-touch.png
sp-turbopolsa-three-rings.png
sp-monkey-moon-worlds-mvp.png
sp-fairy-peak-the-wall.png
sp-ahmad-major-mvp.png
sp-yanxnz-sam-breakthrough.png
sp-garrettg-the-mainstay.png
sp-zen-generational.png
```

The photo fills the whole card behind a gradient overlay — portrait-ish crops
work best (≥480×680px), with the player's face/upper body in the TOP HALF of
the image (the bottom fades into the name plate). Missing files fall back to
stylized placeholder art. A per-card override is possible via the `imageUrl`
field in `specialCards.json`.
