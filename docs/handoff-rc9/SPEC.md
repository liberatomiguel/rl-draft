# rc.9 "the finishing pass": common spec for every agent

Base: `rc9/int`, cut from `release/v2.2` at rc.8 (`95a1523`, what staging
serves). Goal: finish the update Miguel will ship as **2.1** (career founded,
career at an existing org, the draft). The Pro player career does not ship.
Miguel played rc.8 on 27/11 and wrote the notes quoted below (PT, his words).
A front's brief names its section here. Read `AGENTS.md`, then `DESIGN.md`,
then your section. Nothing else unless you are about to change it.

## Rules for every front

1. **Stay in your worktree and your files.** The brief lists what you own. In
   shared files (`balance.ts`, `types.ts`, `careerFlow.ts`, `copy.career.*.ts`,
   `globals.css`) add a small marked block (`// rc9 <front>`), never reorder or
   reformat. New code goes in new files where it can.
2. **Flags.** A new mechanic sits behind the flag its system already has
   (`lockerRoom`, `matchdayDecisions`, `realOrgStart`, `board`, `fanFeed`...).
   Flag off = nothing written to the save, bit-identical results. Do not add
   flags without need. Persist contract: optional additive fields only.
3. **Numbers** in `src/config/balance.ts`. **Strings** in the copy files, EN
   and PT keyed alike (career strings in `copy.career.*`). PT is written as
   Portuguese, not translated: no org or event name after a bare preposition,
   event names take the article.
4. **Do not bump `BALANCE_VERSION`.** `balanceVersion.test.ts` failing because
   you added an export is expected; say so in the handoff. Integration bumps it.
5. **Decision numbers** are reserved per front in the brief (R for career,
   `#` for DESIGN-DECISIONS). Write the entries; add a CHANGELOG entry under a
   `## rc.9 (unreleased)` heading with a root-cause line for every fix.
6. **Heavy jobs, one at a time** (Miguel's PC freezes). Heavy = `tsc`, a
   vitest run of more than one file, any simulation or probe, the dev server,
   a build. Lock: `mkdir C:/Users/Miguel/CLAUDE/rocket-draft/.claude/rc9/heavy.lock`
   takes it (check the exit code; if it fails, wait and retry, never proceed),
   `rmdir` releases it. Never remove a lock you did not create. Hold it under
   10 minutes; split longer simulations into slices and release between them.
   Engine worktrees have no `node_modules`: run tools through the main
   checkout, e.g. `node ../../../node_modules/vitest/vitest.mjs run <file>`
   and `node ../../../node_modules/typescript/bin/tsc --noEmit -p .` (path
   first, flags after). Tests that time out at 5 s under load are not
   failures: rerun with `--testTimeout=30000`.
7. **No build, no deploy, no push, no `main`, no staging.** Commit on your
   branch with explicit paths (`git add <paths>`, `git commit -m ... -- <paths>`),
   never `git add -A`, never `git stash`. Message: `v2.2.0-dev - <FRONT>: ...`.
8. **Never bulk-edit with PowerShell or scripts** (mojibake, and anti-slop
   R-33). Use the edit tool.
9. **Handoff:** `docs/handoff-rc9/<FRONT>.md`, under 400 words: what changed
   (files), what you measured or saw with the evidence, what you did NOT
   verify, decisions left for Miguel. Your final message to the planner is
   that handoff's summary in under 250 words. Report failures as failures.

## The look (every UI front)

Miguel on rc.8: "estou achando algumas fontes muito pesadas, e com as letras
muito coladas, o visual todo meio pesado"; "várias telas novas estão muito
simples e feitas de qualquer jeito, somente com texto branco, sem hierarquia,
informações amontoadas, sem diferenciação"; "não podemos ter somente texto,
textos em branco e em negrito amontoados, precisamos de respiro, de clareza";
"o jogo inteiro precisa ser bonito e elegante".

- `DESIGN.md` is the direction (the DS front updates it; read the version in
  your tree). The anti-slop skill is the filter: read the whole of
  `C:/Users/Miguel/CLAUDE/rocket-draft/.claude/rc9/anti-slop-notes.txt`
  (sections 1 to 5) before the first edit. Mode "during". The direction asks
  for a dark theme on purpose (R-21 answered) and names its own slab, solids
  and tags; do not re-litigate those.
- What the filter means in this game, in order of how often rc.8 breaks it:
  1. **One focal point per screen** and the screen built around the decision
     the player makes there (C-3). Name that decision before laying out.
  2. **Three text steps, used on purpose**: `--ink` for the value or the
     name, `--sub` for what explains it, `--faint` for the label. A block of
     all-white bold lines is the defect Miguel describes.
  3. **A figure is a figure**: large number, quiet label under it. Deltas
     carry their sign and colour (`--good` / `--bad`) and say against what.
  4. **Whitespace separates, boxes group.** No box inside a box inside a box;
     no grid of identical boxes as the default (R-14). A list is rows.
  5. **Less text.** A screen states each fact once. Cut repeated labels,
     explanations of the obvious, technical words (ids, "tier 3", raw
     modifiers). Player-facing copy says what happened or what the button
     does. No em dash, no buzzwords, no rule-of-three, no staccato drama.
  6. Every state exists: empty, loading where there is one, error (R-27).
     Every control works with the keyboard and shows focus (R-32, R-39).
  7. Phone is designed, not shrunk: check 375 x 812 and 320 x 640, no
     sideways scroll, 44 px targets (DESIGN.md "Phone").
- Before designing a screen, open the game's best existing screens (the draft
  run, the Home, the player sheet) and match their finish.
- Evidence: screenshots at 1280, 375 and 320 of every screen you touch, plus a
  click-through list (R-35). Dev server: only from the UI worktree
  `.claude/worktrees/v22-pro-qa` (`npm run dev -- --port 3210`, under the
  heavy lock, stopped when you are not looking; `TaskStop` leaves the node
  child alive, kill the PID on :3210 and confirm). Open it as
  `http://<front>.localhost:3210` so your saves do not collide with another
  agent's. `next dev` is never a staging build: flags come from
  `.env.development.local`.

## Fronts and Miguel's words

### DS: design system, chrome, Squad (wave 1)
Type, spacing and hierarchy of the whole system, proven on the career chrome
and the Squad screen. Fallback named by Miguel: "se não conseguirmos chegar em
um resultado legal, vamos usar a fonte chakra. o importante é os textos terem
respiro". Squad: "roster stability não precisa ser um card, pode ser uma linha
discreta dentro dos starters. locker room pode ir para a direita, abaixo dos
season stats. contracts deve ocupar a coluna inteira, melhor organizado, sua
hierarquia repensada. coach está solto dentro do squad, deve ter seu próprio
card. bench também." Morale: "precisa estar melhor integrado no squad, não
precisa de um card só para isso, pode ficar junto dos players." Toasts: "a
notificação de notícia a faixa azul está quebrando no X, deve ocupar a faixa
inteira. a notificação de email não ficou legal com a fonte assim."

### LOCKER: player morale that moves (wave 1, engine)
"como está funcionando o emocional dos players? testei e não me parece estar
funcionando, parece que o emocional não muda. ele deve estar atrelado à forma,
aos resultados, à carga de treino. os jogadores devem te mandar mensagens de
vez em quando, pedindo para baixar a carga de treino, ou dizendo que sentem que
podem treinar mais pois estão se sentindo bem, ou dizer que querem jogar o
próximo campeonato de 1v1 ou 2v2 alguns dias antes, ou um reserva pedindo para
jogar um regional. cuidar só para o emocional não virar um soft lock no início,
debuffando muito os players, e nem um buff muito grande no end game, mas deve
sim fazer diferença."

### LEGACY: the draft's absurd losses and the final overall (wave 1, engine)
"alguns jogadores estão reclamando de derrotas muito absurdas no legacy, para
times que claramente não deveriam ter perdido. na MENA, principalmente. não
devemos mexer muito na win%, pois me parece boa, mas só evitar derrotas muito
absurdas (um time 99 perdendo para um time muito abaixo). algumas pessoas
estão reclamando que o cálculo final do overall também não faz sentido, vamos
pensar em como melhorar a experiência sem mexer muito no core do jogo e na
win% agora."

### ORG: the existing-org mode's own rules (wave 1, engine and store)
"os elementos de progressão do modo com org existente não devem ser os mesmos
do monte sua org. não faz sentido eu ter 'equipamentos profissionais' em uma
org gigantesca. a progressão deve ser somente de staff, centro de performance,
entre outros itens organizacionais e administrativos, e não besteiras como
240Hz monitors. o que deve ser possível é fazer upgrade nas suas facilities."
"a tela de finanças está legal, mas muito confusa e com informações
conflitantes. temos um card de season budget, e um card abaixo obsoleto e com
informações repetidas. em cima, mostra um budget de 1.3M, e embaixo tenho 1.8M
de caixa, não faz sentido." "o dado de tier não deve ser um número físico que
aparece para o player e sobe ou desce. você pode saber qual o seu tier, mas só
sente as implicações na prática. um email para avisar também pode ser legal
(não email técnico, email narrativo)." "não está legal você receber uma
proposta de patrocínio logo ao iniciar uma carreira com org, o legal seria
você entrar e já existir um patrocínio vigente que você precisa cumprir." "o
board ficou legal, mas está escondido, não tem como chegar nele do hub
principal, precisamos ter uma aba dedicada ou junto com o clube."

### MATCHDAY (wave 2, engine and screens)
"as settings de matchday estão muito rudimentares. a tela de escolhas está
muito confusa, muito cheia de informações, completamente sem hierarquia. a
tela de jogar por jogo também não está funcionando, muitos cliques. precisamos
melhorar e automatizar mais esse sistema. deixar você escolher direcionais
gerais antes de cada série. o fluxo está muito travado, não está divertido.
deve fazer sentido querer escolher coisas antes de séries. o jogo em si deve
ter mais movimento, ver o cronômetro passando, ver as estatísticas subindo,
deve ser uma tela muito mais visual, e muito mais fluida. a opção de ligar
isso deve ser marcada como beta, e mais visível, hoje está escondida lá no
clube. pode ficar na aba de treino."

### STORIES: post, stats, feed (wave 2)
"post after the series aparece demais, deveria aparecer somente de vez em
quando, depois de campeonatos importantes, e ser uma decisão dedicada junto
com as decisões principais, e não um card a mais. o post pode ser mais
completo, mostrar de maneira mais bonita como vai ficar o post, e quais são
suas implicações." "as estatísticas de player ficaram legais, mas precisam
aparecer melhor, hoje só aparece muito rapidamente depois da série. deve ter
um card fixo na tela de evento. no HQ também devemos ver as estatísticas."

### ORG-UI: pick, goals, sponsor, board, finances (wave 2)
"tela de escolher a org existente, tela de metas, tela de patrocínio" are the
three he named as careless. Plus the ORG section's screens.

### CAREER-UI: every other career screen (wave 2)
"precisamos de uma revisão profunda em TODAS as telas do modo carreira. todas
devem ser fluídas, comunicar claramente o que precisa."

### SHARE (wave 2)
"o invite your friends não precisa de imagem, pode ser só um texto dizendo 'eu
estou jogando...' e um link para o jogo. em momentos aleatórios podemos
colocar um pop up (bem esparso, uma vez só) convidando você a convidar o seu
amigo. a imagem de compartilhamento também pode aparecer como pop up algumas
vezes esparsas ao ganhar um draft ou campeonato (sem floodar)." "as imagens de
compartilhamento estão feias, poluídas, amontoadas. melhorar a hierarquia.
seria legal aplicar o banner do perfil de maneira discreta na imagem, para
deixar mais personalizada. um novo cosmético para isso talvez?"

### DUEL: team against team (engine in wave 1, screens in wave 2)
The rc.6 friend duel (same seed, standings compared) is replaced; Miguel:
"jogar um draft simples não é interessante o suficiente para desafiar alguém".
Approved 27/11: "pode ser o time x time. seria legal um modo com por exemplo 7
rerolls (overalls visíveis ou não), seed fixo. os jogos depois precisam ter o
tempo, como na carreira, para ser mais emocionante. com opção de nova partida
depois de terminar."

## Working arrangement since the 27/11 restart (overrides the dev-server paragraph above)

The machine was restarted mid-pass and every agent was killed. All work was
committed as WIP and merged; agents now FINISH fronts that others started.

- UI worktree: `C:\Users\Miguel\CLAUDE\rocket-draft\.claude\worktrees\v22-pro-qa`,
  branch `rc9/ui`, real `node_modules`. Several agents share it: touch only
  your files, commit only your paths (`git add <paths>`, then
  `git commit -m "v2.2.0-dev - <FRONT>: ..." -- <paths>`), commit after every
  coherent step, never `git add -A`, never stash or reset. On `index.lock`,
  wait a few seconds and retry. Nothing goes on drive E:.
- The planner keeps ONE dev server on port 3210 from that worktree: never
  start, stop or restart it, never delete `.next`. Open
  `http://<front>.localhost:3210` in the built-in browser (your front's own
  origin and saves) and pass your own `tabId` to every browser call.
- Heavy lock as in rule 6, for `npx tsc --noEmit` and multi-file vitest. If it
  stays taken for 10 minutes, run `tsc` once before your final commit anyway.
  A type error in a file you do not own is another agent mid-edit.
- Scratch files: `C:/Users/Miguel/CLAUDE/rocket-draft/.claude/rc9/tmp-<front>/`.
- Miguel's later calls, binding: card, section and screen titles are in CAPS
  (Demi, open tracking; `.card-title` does it); names stay mixed case. Tags
  are small and smart ("++DEF", not a sentence). Coaches retire between 28
  and 35. Challenges keep their fixed seed.
- **Clean is not bare** (Miguel, 27/11, on the first screens of this pass):
  "algumas telas simplificamos demais agora, deixando só texto puro, sem
  nenhum visual, nenhuma hierarquia, não é isso que é para acontecer." He
  rejected Training as text-only rows, the Market as a list instead of its
  grid of cards, Finances without its large budget figure and with paragraphs
  of explanation, a timeout prompt that stopped the series between games, and
  share images with a poster headline that hid the team. Read DESIGN.md
  "Composition": lead block, large figures, cards with marks, bars, colour
  for state; choices are a grid of cards; rows are for ledgers. "The look"
  item 4 above ("a list is rows") applies to ledgers only.
- Start by reading what exists: `git log --oneline rc9/int..HEAD -- <your
  files>` and the files themselves. Do not redo finished work; finish it.

## State of each front at the restart

**MATCHDAY** (files recovered from drive E:, uncommitted when it stopped, never
type-checked or tested; `tsc` shows 4 errors in `event/SeriesRoom.tsx`).
Baseline measured: a custom-mode Bo5 cost 5 to 7 clicks, games never animated.
Built: engine `matchTimeline.ts` (`timelineSeed` hashes only games up to the
current one, presentation only), `balance.ts` (`markRightCost` -0.08, new
`MATCH_LIVE` pacing group), `matchday.ts` (`planShift` charges the mark,
`markValue`, `markWorthIt`, the coach marks only when worth it, `applyTimeout`
records the cut, optional `userLog`), `matchdaySeries.ts` (`logUserGame`,
`playUserNext`, `planReport`), marked blocks in `careerFlow.ts` and
`careerStore.ts` (`playUserSeriesNextFlow`, `MatchdayLevel` result / watch /
manage, `setMatchdayLevelFlow`). Plan directives: approach (our style or the
answer to theirs), risk (steady / normal / all in = `kickoffScale`), shut
down (nobody or mark their playmaker). UI: `components/match/LiveGameView.tsx`
with `liveModel.ts` (+test) and `useMatchReducedMotion.ts`; `event/SeriesRoom.tsx`
(plan, live games, end; one optional timeout between games only when the
opponent has momentum, auto-continue after 6 s; pause, speed, skip game, skip
series); `planLine.ts`; `EventStatsCard.tsx`; `SeriesDesk.tsx` deleted;
`EventScreen.tsx` rewired; `MatchdayModeSetting.tsx` as three levels with a
BETA tag, placed on Training by one marked line, removed from Club. Copy
`seriesDesk`, `club.matchdayMode`, `eventStats`. Target: 2 clicks per managed
series, 1 to skip (not measured). Left: `tsc`, tests, the browser pass,
screenshots, keyboard, the NARRATION / event / scrim copy-audit items,
R240 to R249, #233 to #239, CHANGELOG, handoff.

**HQ** (recovered from E:, never type-checked). Done: `hub/SeasonPlanChoice.tsx`
(the three plans as one table: column heads once, a row per plan, the board's
proposal preselected, one Accept), `hub/HubPlayerStats.tsx` (season stats,
empty state, nothing when `matchdayBoxScore` is off), `DecisionBlock` (kinds
in one typed table), `DayCard` (the date as the focal figure), `WeeklyScrimLine`,
`HubScreen`, `SeasonGoalBlock`, `SeasonGoalRows`, `NowCards`, `SundayCard`,
`CareerTour`; copy `hub` (about 65 dead keys out), `sunday`, `calendar`,
`ceremonies`, `tour`, `explainers` deleted. `tsc` shows 1 error in
`hub/SquadBlock.tsx`. Left: Calendar, Standings and Season review (not
started), tests (`hqPolish`, tour), 320 shots, click-through, #240 to #247,
CHANGELOG, handoff, word counts.

**TRAIN-MARKET** (recovered from E:, never type-checked). Done:
`TrainingScreen.tsx` and `training/TrainingPackageParts.tsx` rebuilt around
one decision; Market as rows (`market/MarketRows.tsx`), deals as rows, the
offer modal's consequences as three rows; copy `career.training` and
`career.market` cleaned. `tsc` shows 2 errors in `SalaryNegotiator.test.ts`
(`negotiation.asks` was removed). The lock line in `MarketRows.tsx` is still
orange and should be faint. Left: `PlayerSheet`, `MoneyNoticeModal` and its
copy, `ListPlayerSheet`, `TradeSheet`, `SaleConsequences`, `MarketValueTag`,
`RenewalReadout`, phone checks, tests, #248 to #254, CHANGELOG, handoff.

**SHARE, CLUB-NEWS, ORG-UI, DRAFT-UI**: killed without a report. Their state is
their commits plus the commit "WIP at the 27/11 restart" (`10b23ca4`).

**Engine, merged into `rc9/ui`:** ORG, DUEL, BUGS, LEGACY (handoffs in this
folder). **Still on their own branches:** LOCKER (`rc9/locker`), ENDGAME
(`rc9/endgame`), each with a WIP commit.
