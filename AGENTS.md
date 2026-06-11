<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rocket Draft — project conventions

Fan-made Rocket League esports draft game. Next.js 16 + React 19 + Tailwind v4
+ Zustand + Zod + Vitest. Start with `README.md`; deep dives in `docs/`.

Hard rules:

- **Game logic only in `src/engine`** (pure TS, no React, deterministic via
  the seeded RNG in `src/lib/rng.ts`). UI calls engine through `src/store`.
- **Every tunable number** goes in `src/config/balance.ts` — never inline
  magic numbers for gameplay values.
- **Every player-facing string** goes in `src/content/copy.ts` (broadcast
  tone: clean esports-desk language, no forced memes).
- **Dataset edits** happen only in `src/data/*.json`; run
  `npm run validate:data` after. Field reference: `docs/DATA-GUIDE.md`.
- After engine/balance changes run `npm test` — the suite asserts the design
  anchors from `docs/GAME-DESIGN.md` §25 (overall must stay dominant).
- Update `docs/CHANGELOG.md` (Added/Changed/Balance/Fixed) with every
  meaningful change; bugfixes always get a root-cause line.
- Design deviations from `docs/GAME-DESIGN.md` must be recorded in
  `docs/DESIGN-DECISIONS.md`.
