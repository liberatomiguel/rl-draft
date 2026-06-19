# Challenges — design (SHIPPED in v1.4)

> Status: **SHIPPED in v1.4.** Built per this design. Engine `engine/challenges.ts`,
> data `src/data/challenges.json` (hand-authored, 10 starters), `/challenges`
> route + nav, briefing + match screens, `profileStore.challengesCompleted`.
> Deviations from the original proposal:
> - **No separate `/api`** — fully client/engine, like the rest of the game.
> - **`picks` constraint dropped** for v1.4 (every challenge is a full 6-slot
>   draft); the schema is `.strict()` so re-adding it is a deliberate change.
> - **Generous, difficulty-independent reroll budget** (`CHALLENGE.rerolls`) so a
>   tight twist is always assemble-able — the test is beating the boss, not luck.
> - **Overalls always shown** (challenges are strategy puzzles, not the Hard/Legacy
>   knowledge test).
> - Next: objective-only seed puzzles (clear by reaching an OVR/chemistry target
>   without a boss) and badge cosmetics are still open follow-ups.

## 1. The idea (one line)

A rank-unlocked set of **authored puzzles**: the game shows you a famous
historical line you must **out-draft and beat** in a single Bo7. Drafting skill
under a twist — not luck — is what wins. It gives the rank ladder a *content*
reward (new puzzles), complementing the *card* reward (rarities) shipped in v1.3.

Think of it as the game's "missions" mode: focused, repeatable, and each one a
distinct test ("beat 2021-22 BDS", "beat them with no player over 88", "beat them
with an all-Brazil roster").

## 2. Why it fits the game

- Reuses the whole core loop (draft → simulate) — low engine risk.
- Turns the historical database into curated set-pieces (the iconic lines become
  bosses), which is exactly the game's fantasy.
- Pairs with the v1.3 reward system: ranking up unlocks rarities **and** new
  challenges, so progression always hands you something to do next.
- Visual vocabulary already exists (achievements grid, rarity families, badges,
  panels) — the surface is a re-skin, not a new design language.

## 3. Player flow

```
/challenges  →  grid of challenge cards (locked / available / completed)
   │
   ├─ locked  (below required rank / prerequisite)  → silhouette + "Unlocks at <Rank>"
   ├─ done    → gold ring + checkmark + "Cleared" (one-and-done, like achievements)
   └─ available → tap → Challenge briefing
                         · shows the TARGET line (logos + names + overalls)
                         · shows the TWIST (constraint)
                         · "Start" → constrained draft → single Bo7 vs the line
                              → win  = cleared (XP, confetti, mark complete)
                              → loss = "try again" (no penalty)
```

A challenge is a **dedicated mini-run**, not something you hope to stumble into
during a normal tournament — you always know the exact line you're drafting
against, which is the whole point of the example Miguel gave. **[DECIDE A]**

## 4. Data model — `src/data/challenges.json` (hand-authored, like specialCards.json)

```jsonc
{
  "id": "ch-bds-2122",
  "title": "Break the Wall",
  "brief": "M0nkey M00n's BDS swept 2021-22 Worlds. Out-draft a dynasty.",
  "rankRequired": "gold",          // unlocks at this rank (reuses RANKS ids)
  "prereq": "ch-vitality-2223",    // optional: clear this challenge first (difficulty chain)
  "opponentLineupId": "team-bds-2122",  // the FIXED line you face (from lineups.json)
  "tier": "epic",                  // visual family (reuses achievementStyle: common|rare|epic|legend)
  "reward": { "xp": 150, "badge": "wall-breaker", "specialId": null },  // XP + cosmetic; optional earned special (e.g. a contributor card) bypasses the rank rarity-gate
  "sim": { "difficulty": "hard", "bestOf": 7 },  // roll ranges / shift come from this profile; opponent is FIXED
  "constraint": {                  // optional "twist" — omit for a pure beat-the-line
    "maxPlayerOverall": 90,        // each drafted player ≤ this
    "region": "SAM",               // draft pool restricted to a region
    "seasonId": "rlcs-2021-22",    // ...or to a single era
    "country": "BR",               // ...or one nationality
    "noSpecials": true,            // base cards only
    "picks": 3                     // players-only (skip coach/sub/org), à la Quick
  }
}
```

Authoring stays in Miguel's hands (like specialCards.json). A `validate:data`
check confirms `opponentLineupId` exists and `rankRequired` is a real rank.

## 5. Challenge archetypes (variety = replay value)

Each is `target line` + `twist`, which yields very different puzzles from the
same data:

| Archetype | Twist | Feel |
| --- | --- | --- |
| **Beat the Wall** | none | Raw "can you build something that beats BDS/Vitality/Falcons?" |
| **Underdog** | `maxPlayerOverall` low | Forces chemistry + buffs mastery — the v1.3 chemistry rework shines |
| **One Nation** | `country` | All-Brazil / all-France roster vs a giant |
| **Era Lock** | `seasonId` | Draft only S3 cards, beat a modern superteam |
| **Region Pride** | `region: SAM` | SAM roster topples a Worlds champion (great post-SAM-launch hook) |
| **Purist** | `noSpecials` | No special cards — pure base overalls + chemistry |

Ship ~8–12 at launch, spread across ranks (a couple at Bronze/Silver as a
tutorialised on-ramp; the brutal ones gated at Champion+/SSL).

## 6. Engine (`src/engine/challenges.ts`) — reuse, don't reinvent

- **Opponent:** `buildLineupTeam(opponentLineupId, sim.difficulty)` — the existing
  AI builder. No `generateOpponents` (the field is a single fixed team).
- **Draft:** a new `RunMode = "challenge"`. `createDraft` gains a constraint that
  filters the candidate pool (`maxPlayerOverall` / `region` / `seasonId` /
  `country` / `noSpecials`). Rank rarity-gates still apply on top (v1.3).
- **Match:** `simulateSeries(userTeam, fixedOpponent, { bestOf, stage: "playoff", difficulty })`
  — the existing series sim. One series, win/lose.
- **Result:** if `winnerTeamId === "user"`, mark the challenge complete + grant XP.

This is ~80% existing code. The genuinely new parts are the constraint filter and
the single-match orchestration.

## 7. Persistence (`profileStore`)

Mirror achievements exactly:
```ts
challengesCompleted: Record<string /*challengeId*/, string /*ISO date*/>
```
Add to `applyRunResults` (a challenge clear writes the date + adds `xp` + grants the
cosmetic/collectible). **One-and-done** (RESOLVED): a cleared challenge stays
cleared, exactly like an achievement — no replay, no re-reward.

## 8. UI surface (re-skin of existing components)

- **Route:** `/challenges`, new `NAV_ITEMS` entry (between Collection and Profile),
  OR a "Missions" hub that also houses the Daily. **[DECIDE E]**
- **Grid:** reuse `AchievementsGrid`'s 1/2/3-col responsive layout.
- **Card:** `Badge` for the rank requirement (rank-tinted) + tier chip from
  `achievementStyle` families; `TeamLogo` for the target line; `xp` pill; a
  completed card gets the `ach-legend` ring treatment.
- **Locked card:** the collection's silhouette pattern + "Unlocks at <Rank>".
- **Briefing modal:** the collection detail-modal pattern — target roster as a
  3-card row, the twist as a `Badge` list, "Start" CTA.
- **Results:** the existing ResultsScreen ceremony; add a "Challenge cleared"
  panel (blue-glow, like the achievements panel) with the +XP.

No new visual primitives — pills, tags, panels, rings all come from the kit, so
it stays consistent by construction.

## 9. Decisions — RESOLVED with Miguel (v1.3 design pass)

- **A — Dedicated mode.** A challenge is its own mini-run: see the exact line, draft
  with the twist, play one Bo7. The "beat a famous line" is ONE archetype — the set
  spans different challenge TYPES (see §5) and **gets harder as you unlock more**
  (so the unlock order is a difficulty curve, not just a rank gate — see below).
- **B — Reward = XP + a cosmetic "cleared" selo**, with room to grow: Miguel wants
  to add **new collectibles** and **special cards for people who helped develop the
  game** as challenge rewards. So the reward schema should be extensible:
  `reward: { xp: number; badge?: string; specialId?: string }` — a challenge MAY
  grant a hand-authored special (e.g. a contributor card in `specialCards.json`) on
  clear. A reward special bypasses the rank rarity-gate (it's earned, not rolled) —
  it just lands in the collection. Ties neatly into the existing Creator card.
- **C — Starter set: OPEN.** Author ~10–12 spanning the §5 archetypes and ranks
  (a couple tutorialised at Bronze/Silver → brutal ones at Champion+/SSL). I'll
  draft them for review when we build.
- **D — One-and-done.** Cleared = cleared, like achievements. No replay-for-XP.
- **E — Own `/challenges` tab.** New `NAV_ITEMS` entry (not a combined hub).

**Progression shape (from A):** challenges should *unlock progressively and ramp in
difficulty*. Cleanest model: each challenge has a `rankRequired` AND an optional
`prereq` (a challenge id that must be cleared first), so a tier opens at a rank and
then forms a short chain that escalates. Pure rank-gating is the fallback if a tree
feels heavy.

## 10. Suggested build phases (when greenlit)

1. **Engine + data**: `challenges.json` + `engine/challenges.ts` + `"challenge"`
   run mode + constraint pool filter + `validate:data` check + ~10 authored
   challenges. Unit tests (a constrained draft only offers eligible cards; a clear
   marks completion + XP).
2. **UI**: `/challenges` grid + briefing modal + play flow + results panel +
   `profileStore.challengesCompleted` + nav entry.
3. **Polish**: more challenges, completion animations, achievement tie-ins
   ("Clear 5 challenges", "Clear an SSL challenge").

Token/▼ effort estimate: Phase 1 ≈ a focused engine session; Phase 2 ≈ a focused
UI session. Comparable in size to the v1.3 reward system.
