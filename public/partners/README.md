# News partners' logos

Drop one PNG per news partner here (transparent, square or wide, ≥ 192 px on
its longer side). Road to Worlds' news desk shows it when
`CAREER_NEWS.brand` (src/config/balance.ts) names that partner; until the
file exists, a styled fallback renders (the partner's name in the game's own
chrome — never a redrawn version of the partner's mark).

Only drop art the partner has sent and approved for this use (material,
naming and credit — ROADMAP UX-03). After adding or replacing a file, run
`npm run build:images` and commit `src/generated/asset-manifest.json`.

```
fiftyfifty.png
```
