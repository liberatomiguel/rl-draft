# Take over an organisation, second pass: a 2027 start and the board's mandate

Integrator's spec, 27/11/2026. It replaces the parts of `ORGMODE-SPEC.md` it contradicts. Read `AGENTS.md`, `DESIGN.md` (UI work) and `docs/ROAD-TO-WORLDS-STATUS.md` (the system map) first; grep the big docs, never read them whole.

## Miguel's brief (27/11, after playing rc.6)

- "Ao começar com uma org existente em 2020, temos poucas orgs disponíveis, e provavelmente as pessoas vão querer jogar com orgs atuais. Vamos repensar esse modo para começar em 2027." And: "e se ao invés de começar só em 2027, pudéssemos escolher qual season começar?"
- "Precisaríamos reduzir e muito os times genéricos... o foco deve ser nas orgs reais. Ainda poderemos ter players genéricos e potenciais estrelas para compra."
- "Devemos usar os dados das outras seasons para complementar os free agents ou até outros times que podem reaparecer."
- "Não deve ter a opção de escolher qual meta você quer. Ao assumir o clube você deve saber qual o nível de exigência, e deve somente receber um pop up avisando quais as suas metas e o que você ganha/perde com isso. Meta de dinheiro, meta de contratações, meta de classificação. Deve receber também isso por email, além de um email de boas vindas."
- "Ter os mesmos itens de progressão não faz sentido, e eles ainda estão ali... Você está assumindo uma org existente, deve conseguir consertar os seus problemas, arrumar a casa e organizar para ganhar campeonatos."
- "Preciso que você se esforce mais na evolução do modo." The rc.6 screens and rules read to him as the founded club with the locks removed.

## Measured facts (dataset, 27/11)

- Real club orgs per region, Season X → RLCS 2027: NA 12 → 19, EU 18 → 24, SAM 14 → 12, MENA 1 → 10, OCE 7 → 2, APAC 0 → 3, SSA 0 → 1 (52 → 71). `rlcs-2027` is dataset order 16, today the "late intake" wave at season index 6 (`CAREER_WORLD.lateIntake`).
- Orgs with a lineup in 2025 or 2026 and none in 2027: NA 3, EU 4, SAM 13, MENA 6, OCE 5, APAC 10, SSA 3.
- The 213 players on 2027 rosters: 131 with a real birthday (18 or younger 11, 19–20 24, 21–23 65, 24 or older 31), 82 with an inferred age.
- Real players with no 2027 roster whose last club card is 2024–2026: 82 (46 of them 24 or older, 7 aged 20 or younger). `subs.json` holds 151 more entries.
- A real player's potential is his best dataset card plus a jitter (`derivePotentialV2`): at a 2027 start nobody has a later card, so a young real player has no growth, while a generated headline prospect has potential 91–93.
- Retirement runs from 24 to 29 (`CAREER_DEV.retirementByAge`): half of the 22-year-olds are gone before their season at 27.

## Stage 1 (front ERA): a career can start at any era, 2027 by default for a takeover

**E1. Start era.** A save gains an optional `startSeasonIndex` (absent = 0). Today one number, `seasonIndex`, is both the calendar era (dataset season, ages, labels, intake, cancelled Worlds, endless variety) and the career's progress (season number shown, first-season rules, ramps). Audit every use, classify it, and separate the two with the smallest diff. Preferred shape: `seasonIndex` stays the absolute era (6 = RLCS 2027) and progress reads `seasonIndex − startSeasonIndex` through one helper; choose the other shape if the audit says it is safer, and record why. A founded career (start 0) must stay bit-identical: the existing suite passes untouched and a founded probe career matches rc.6 row for row.

**E2. The world at the start era.** `buildWorldAtCreation(seed, startSeasonIndex)` builds from that season's lineups. For the last era the 2027 wave is the creation set and the intake does not run again.
- **Returning orgs before fillers.** A region below `minOrgsPerRegion` is completed first with real orgs whose last lineup is in the two seasons before the start (newest season first, then strength), on their last roster minus anyone rostered elsewhere; a hole takes the best regional free agent. Fillers only cover what is left. Expected at 2027: no filler in NA, EU, SAM, MENA.
- **Free agents from earlier seasons.** Real players whose last club card is in the three seasons before the start and who hold no seat, plus that window's `subs.json` people, enter the pool at their last overall aged to the start (nobody past the retirement window). Generated players and prospects stay, as market depth.
- A region above 16 orgs keeps the existing seeding (rc.33).

**E3. Real players past the end of the dataset** (only for a career that starts at the last era).
- **Projected potential.** A real player aged 21 or younger at the start gets `max(dataset potential, overall at start + headroom)`, the headroom drawn per career seed from an age table in `balance.ts` (larger the younger; most draws low, a few high; cap near 96). Older players keep the dataset rule.
- **Longer careers.** A retirement table for these careers of about 26 to 32. Check that peak, plateau and decline still make sense with it.
- Measure, before and after, on the 2027 roster set: share still active after 3, 6 and 8 seasons, and the share of real players in the world's top 30 at seasons 4 and 8. Aims: at least 75 % active after 3 seasons, 50 % after 6, real players at least 60 % of the top 30 at season 4. Report the numbers; do not bend rules to hit them.

**E4. Takeover wiring.** `realOrgChoicesFor` and the takeover read the start era; a takeover defaults to the last era (a `balance.ts` constant), a founded club to 0. Returning orgs can be taken over and are marked as such. For testing other eras before the picker exists: a query parameter on the pick screen in the staging build. The proper picker is a UI stage.

**E5. Checks.** Suite; `P1_SOFT` and `BOARD_SOFT` with a 2027 takeover in NA, EU, SAM and MENA over 7 seasons; a soft-lock run of a takeover at each other era (one region, 3 seasons); the founded bit-identity check. Persist contract unchanged (additive optional field).

## Stage 2 (front MANDATE): the board tells you, you do not choose

**M1. One mandate a season, three goals, no choice.** An established org's season opens with a mandate:
1. **Classification:** the tier's objective (today's Expected package logic), sharpened by the org's demand level.
2. **Money:** picked from the org's state: end the season with cash above a floor; bring the wage bill under the ceiling by a week; keep net transfer spend inside the transfer budget; raise an amount in sales.
3. **Squad:** picked from the org's state: sign a starter at the tier's bar; renew a named player whose deal ends; bring the average age under a line; give a player of 20 or younger a number of series; keep the core.
Each goal states what meeting it gives and what missing it costs (confidence, next season's budget, a bonus), all tunables in `CAREER_BOARD`. The review settles the three; classification weighs most.

**M2. The house's problems.** A pure `orgIssuesOf(save)` reads the org as it is (wages against the ceiling, deals ending, squad age, no coach, short cash, a sponsor about to lapse, chemistry) and returns its two or three problems. The money and squad goals come from them, and the dossier shows them before the takeover with the **demand level** (low, medium, high) so the player knows what he is walking into. Deeper tools to fix them (contract clauses, asks to the board, departments with people) are stage 3: shape the data so they can attach.

**M3. How the player is told.** After the arrival screen, one pop-up, "the board's mandate": the three goals, gain and loss on each, one button. No plan cards. Every new season: the pop-up again with what changed and why. Inbox: a welcome mail from the owner (the org's own history where the data has it) and a mandate mail the player can reread; the week-11 and week-21 mails report on all three. `/career/board` tracks the three with progress. The sponsor desk opens when the pop-up is acknowledged.

**M4.** The three-plan choice and its stated-chance bands leave this mode (the founded club keeps them). Bots follow the mandate. Checks: suite, `BOARD_SOFT`, a `BOARD_PROBE` sanity run reporting how often each goal kind is met by tier.

## Later stages (not now)

Stage 3: inherited contracts as the core game (release clauses, paid terminations, renewal demands), asks to the board paid in confidence with the budget split into transfers, wages and operations, departments with named staff in place of the item shelf. Stage 4: the era picker and the screens.

## Process

- One heavy job at a time on Miguel's PC: the lock directory protocol (your brief has the path). Check that `mkdir` succeeded; never `rmdir` a lock you did not create.
- Tunables in `src/config/balance.ts`; strings in `copy.career.en.ts` and `copy.career.pt.ts`; decisions in `ROAD-TO-WORLDS-DECISIONS.md` (next free R number, leave a gap note if two fronts collide); a handoff `docs/handoff-2.2/ORGMODE-2027-<FRONT>.md` with what changed, the measured numbers and what was not verified.
- Commit on your branch. Never push, never touch `main` or `staging`.
