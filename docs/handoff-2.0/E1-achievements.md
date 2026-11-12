# Handoff E1 — revisão das conquistas (Season 1)

Pedido do Miguel (12/11): "Hoje algumas estão muito fáceis e várias não fazem sentido. Vamos
revisar quais fazem sentido e pensar em novas, ligadas ao Road to Worlds e às novidades do
patch. Conquistas raras, difíceis, lendárias e secretas."

Base da revisão: quantas das 455 contas reais da pre-season (432 com pelo menos uma run) têm
cada uma das 55 conquistas da v1.4.8, mais uma sonda de frequência por run
(`src/engine/achievements.rates.probe.test.ts`, opt-in: `ACH_RATES=1 ACH_RUNS=3000 npx vitest run
src/engine/achievements.rates.probe.test.ts`; 12.000 runs Classic mundiais com o bot de draft
da matriz de dificuldade, sem resets). A sonda é uma política de simulação, não uma previsão.

## Resumo

- **Catálogo do draft: 77 → 92.** 62 mantidas, 15 retiradas, 30 novas. Por tier, hoje:
  {"common": 15, "rare": 25, "epic": 35, "legend": 17}. As 30 novas: {"rare": 10, "epic": 14, "legend": 4, "common": 2}; 7 delas secretas (9 secretas no total).
- **Road to Worlds: 15 → 22** (7 novas no catálogo próprio do modo, `src/data/career/achievements.ts`).
- **Nenhum campo persistido novo.** Tudo lê dados que já existem (`regionTitles`, `podiums`,
  `wins`, `dailyResults`, `legacyStreak`, `challengeStars`, `quiz`, `login`, `missions`,
  `unlockedSpecials`). Versão do persist continua 12.
- **XP por tier não mudou** (common 100, rare 250, epic 600, legend 1.500). Soma do catálogo:
  44100 → 54250 XP, uma única vez na vida da conta (+17100 das novas, −3900
  das retiradas, o resto são os rebaixamentos). O SSL da Season custa 675.000.
- **`balance.ts` não foi tocado.** Os limiares das conquistas ficam nos avaliadores, como os
  que já existiam.

## Regras desta revisão

1. **Troféu de participação sai.** Acima de ~90% dos jogadores, ou acontecendo sem intenção
   em boa parte das runs, não é conquista.
2. **Um id que alguém já tem nunca muda de significado nem de limiar.** Para endurecer, o id
   antigo sai e entra um id novo (Hat-Trick → Double Hat-Trick; Giant Slayer → Giant Killer).
   Tier e XP podem mudar: o XP já pago não volta, o tier é só a moldura.
3. **Id retirado some do perfil no próximo load** (`pruneEarnedAchievements` roda no migrate,
   no `hydrateDurable` e no merge da nuvem). Aceito só para os 15 abaixo; o fixture
   `src/store/__fixtures__/preseason-held-ids.json` perdeu os mesmos 15 e o teste de guarda
   (`preseasonRehearsal.test.ts`) continua falhando se qualquer outro id sair do build.
4. **Secreta = `"secret": true` no JSON** (o campo já existia para Stone Wall e Behind the
   Game). Enquanto não ganha, o card na grade mostra "???" e "Hidden — discover it in play" /
   "Secreta — descubra jogando", sem nome, sem descrição, sem ícone do grupo; o tier e o XP
   aparecem. Depois de ganha, aparece normal. O toast e a tela de resultado só mostram
   conquistas já ganhas, então não vazam nada.
5. **Contador de vida satisfeito por um veterano é pré-marcado em silêncio na migração**
   (`backfillSatisfiedCounters`: sem XP, sem toast). Feitos de run, secretas e os sistemas da
   Season (quiz, login, missões, estrelas, sequência Legacy, títulos por região) nunca são
   pré-marcados: o veterano ganha jogando, com XP e toast.
6. **Toda conquista nova tem um teste que monta o estado que a dispara** e o estado vizinho
   que não dispara (`src/engine/achievements.e1.test.ts`, `src/store/profileStore.achievements.test.ts`,
   `src/store/profileStore.achievementsBackfill.test.ts`).

## As 77 que existiam

Posse = contas com a conquista, de 455. "nova na 2.0" = uma das 22 criadas durante a 2.0, que
ninguém em produção tem ainda.

| id | o que pede | posse | veredito | motivo |
|---|---|---|---|---|
| `ach-first-team` | First Lineup: Build your first team. | 435 (96%) | manter | Gancho inicial: o primeiro toast do jogo, na tela de review. |
| `ach-first-run` | Debut: Finish your first run. | 432 (95%) | manter | Gancho inicial. Com First Lineup garante os 200 XP do Bronze na primeira run (Coleção e Challenges abrem), qualquer que seja o resultado. |
| `ach-first-title` | Lift-Off: Win your first tournament. | 404 (89%) | manter | Gancho inicial: o primeiro objetivo de verdade. |
| `ach-runs-10` | Getting Started: Play 10 runs. | 371 (82%) | manter | Primeiro degrau da escada de runs. |
| `ach-runs-50` | Regular: Play 50 runs. | 255 (56%) | manter | Escada de runs. |
| `ach-runs-200` | Lifer: Play 200 runs. | 104 (23%) | manter | Escada de runs. |
| `ach-titles-5` | Contender: Win 5 tournaments. | 281 (62%) | manter | Primeiro degrau da escada de títulos. |
| `ach-titles-15` | Dynasty: Win 15 tournaments. | 172 (38%) | manter | Escada de títulos. |
| `ach-titles-50` | Hall of Famer: Win 50 tournaments. | 70 (15%) | manter | Escada de títulos. |
| `ach-games-50` | Series Veteran: Win 50 individual games. | 405 (89%) | **retirar** | Volume de poucas runs. O primeiro degrau de jogos passa a ser 200. |
| `ach-games-200` | Game Wizard: Win 200 individual games. | 358 (79%) | manter, rare → common | Vira o primeiro degrau de jogos (50 saiu). |
| `ach-goals-100` | Goal Getter: Score 100 goals across all your runs. | 428 (94%) | **retirar** | Volume de poucas runs (428 das 432 contas ativas). O primeiro degrau de gols passa a ser 500. |
| `ach-goals-250` | Sharpshooter: Score 250 goals across all your runs. | 406 (89%) | **retirar** | Idem, um degrau acima. |
| `ach-goals-500` | Goal Machine: Score 500 goals across all your runs. | 388 (85%) | manter, rare → common | Vira o primeiro degrau de gols (100 e 250 saíram). |
| `ach-hard-title` | Proving Ground: Win a tournament on Hard. | 311 (68%) | manter | Porta de entrada do Legacy. |
| `ach-legacy-title` | All-Timer: Win a tournament on Legacy. | 211 (46%) | manter | Marco real de dificuldade. |
| `ach-legacy-10` | Eternal: Win 10 tournaments on Legacy. | 43 (9%) | manter | Difícil de verdade. |
| `ach-legacy-regional` | Regional Legend: Win a region-locked tournament on Legacy. | 48 (11%) | manter | Difícil de verdade. |
| `ach-quick-win` | Speed Run: Win a match in Quick Draft. | 152 (33%) | manter | Trivial, mas é o gancho do modo Quick (só 33% chegaram a jogar). |
| `ach-swiss-flawless` | Flawless Swiss: Go 3-0 in the Swiss stage. | 414 (91%) | **retirar** | 3-0 no Swiss: 74% das runs no Easy, 36% no Normal. |
| `ach-daily-win` | Daily Grind: Win a Daily Challenge. | 97 (21%) | manter | Gancho do Desafio Diário. |
| `ach-daily-7` | Streak Master: Win the Daily Challenge 7 days in a row. | nova na 2.0 | manter | Sequência diária. |
| `ach-blowout` | Statement Win: Win a match by 7 goals or more. | 434 (95%) | **retirar** | Vitória por 7 gols sai em 6–42% das runs; 95% dos jogadores têm. |
| `ach-undefeated` | Untouchable: Win a tournament without losing a single series. | 374 (82%) | manter, rare → common | Tem identidade, mas 82% têm: desce de tier. A versão dura é Flawless Legacy / Perfect Event. |
| `ach-clean-sheet` | Stone Wall: Win a tournament without conceding a goal. | 8 (2%) | manter | Rara de verdade (8 jogadores). Secreta. |
| `ach-three-specials` | Loaded: Finish a run with 3 special cards on your team. | 193 (42%) | manter, epic → rare | Depende de sorte no draft, não de dificuldade: desce de tier. |
| `ach-hattrick` | Hat-Trick: Have a player score 3 goals in one match. | 435 (96%) | **retirar** | Acontece em ~96% das runs (sonda: 83–100% por run). Substituída por Double Hat-Trick (6 gols). |
| `ach-four-goals` | Four-Star: Have a player score 4 goals in one match. | 433 (95%) | **retirar** | Mesma coisa um degrau acima: 43–95% das runs. |
| `ach-solo-show` | One-Man Army: Have one player score all your team's goals in a match (3 or more). | 420 (92%) | **retirar** | 38–60% das runs, sem intenção do jogador. |
| `ach-game7` | Game Seven Ice: Win a final in game 7. | 236 (52%) | manter | Identidade RLCS, frequência boa (2–7% das runs). |
| `ach-reverse-sweep` | Reverse Sweep: Win a series after falling behind by two games. | 373 (82%) | manter, rare → common | Identidade RLCS, mas 82% têm: desce de tier. A versão dura é Never Out of It / The Impossible Comeback (na final). |
| `ach-lower-bracket` | The Long Way: Win a tournament out of the lower bracket. | 330 (73%) | manter, epic → rare | 73% têm: desce de tier. A versão dura é The Longest Road. |
| `ach-scored-every-game` | Ever-Present: Have a player score in every game of a tournament. | 192 (42%) | manter | Rara por run (0,1–1,4%). |
| `ach-ot-game7` | Overtime Hero: Win a final in game 7 overtime. | 120 (26%) | manter | Rara por run (0,5–1,4%). |
| `ach-one-goal-final` | On the Wire: Win a final decided by a single goal. | 274 (60%) | manter | Frequência boa. |
| `ach-giant-slayer` | Giant Slayer: Beat a team with a higher overall than yours. | 416 (91%) | **retirar** | Qualquer série contra um time com rating maior: 24–47% das runs. Substituída por Giant Killer (final, 2+ pontos). |
| `ach-perfect-chem` | Perfect Sync: Build a team with perfect chemistry. | 355 (78%) | manter, rare → common | Mecânica central, mas 78% têm: desce de tier. |
| `ach-perfect-chem-title` | In Perfect Sync: Win a tournament with perfect chemistry. | 257 (56%) | manter, epic → rare | 56% têm: desce de tier. |
| `ach-no-chem-title` | Total Strangers: Win a tournament with no chemistry at all. | 95 (21%) | manter | Feito deliberado e difícil. |
| `ach-early-era-title` | Old School: Win a tournament with only early-era players (2019 or earlier). | 158 (35%) | manter | Feito deliberado (o par, New Wave, saiu). |
| `ach-open-era-title` | New Wave: Win a tournament with only open-era players (2020 onward). | 338 (74%) | **retirar** | A maior parte do banco é 2020+: 39–58% dos títulos saem assim sem querer. Old School (2019 ou antes) fica. |
| `ach-all-sam` | South American Steel: Build a team of three South American players. | 183 (40%) | **retirar** | Grátis com o Draft Regional da SAM (por isso 40% já tinham). |
| `ach-all-eu` | European Power: Build a team of three European players. | 362 (80%) | **retirar** | Grátis: o Draft Regional da EU só oferece europeus (e sai em 7–12% das runs mundiais). |
| `ach-all-na` | North American Core: Build a team of three North American players. | 307 (67%) | **retirar** | Grátis com o Draft Regional da NA. |
| `ach-all-ssa` | Sub-Saharan Pride: Build a team of three Sub-Saharan African players. | 5 (1%) | manter | Região sem Draft Regional: três jogadores SSA num draft mundial é raro de verdade (5 jogadores). |
| `ach-all-mena` | MENA Force: Build a team of three MENA players. | 49 (11%) | **retirar** | Idem MENA: a 2.0 abriu o lock e a conquista virou grátis. |
| `ach-all-oce` | Oceanic Unit: Build a team of three Oceanic players. | 56 (12%) | **retirar** | Era difícil na 1.4.8 (sem lock de OCE); na 2.0 o Draft Regional da OCE entrega na tela de review. |
| `ach-all-apac` | APAC Assembly: Build a team of three Asia-Pacific players. | 7 (2%) | manter | Idem APAC (7 jogadores). |
| `ach-all-champions` | Champions Only: Build a team of three world-champion-tier players. | 229 (50%) | manter, epic → rare | 50% têm: desce de tier. |
| `ach-same-team` | Reunion: Build a team of three players from the same org. | 79 (17%) | manter, legend → epic | 17% têm uma 'lenda': desce para épica. |
| `ach-first-special` | First Pull: Unlock your first special card. | 387 (85%) | manter | Gancho inicial da coleção. |
| `ach-specials-15` | Collector: Unlock 15 special cards. | 262 (58%) | manter | Escada da coleção. |
| `ach-specials-50` | Curator: Unlock 50 special cards. | 154 (34%) | manter | Escada da coleção. |
| `ach-specials-all` | Completionist: Unlock every special card. | 6 (1%) | manter | Rara de verdade (6 jogadores). |
| `ach-creator` | Behind the Game: Unlock the Creator card. | 86 (19%) | manter | Easter egg. Secreta. |
| `ach-ssl` | Supersonic Legend: Reach the Supersonic Legend rank. | 171 (38%) | manter | Na Season 1 o SSL custa 675k XP: volta a ser lendária para quem ainda não tem. |
| `ach-runs-500` | Marathon: Play 500 runs. | nova na 2.0 | manter | Escada de runs. |
| `ach-runs-1000` | Iron Will: Play 1,000 runs. | nova na 2.0 | manter | Escada de runs. |
| `ach-titles-100` | Trophy Room: Win 100 tournaments. | nova na 2.0 | manter | Escada de títulos. |
| `ach-titles-250` | Legend of the Game: Win 250 tournaments. | nova na 2.0 | manter | Escada de títulos. |
| `ach-games-1000` | Thousand Wins: Win 1,000 individual games. | nova na 2.0 | manter | Escada de jogos. |
| `ach-goals-2500` | Net Breaker: Score 2,500 goals across all your runs. | nova na 2.0 | manter | Escada de gols. |
| `ach-legacy-25` | Immortal: Win 25 tournaments on Legacy. | nova na 2.0 | manter | Escada do Legacy. |
| `ach-legacy-undefeated` | Flawless Legacy: Win a tournament on Legacy without losing a single series. | nova na 2.0 | manter | 0,8% das runs Legacy na sonda. |
| `ach-legacy-streak-2` | Back to Back: Win two Legacy tournaments in a row. | nova na 2.0 | manter | Primeiro degrau da sequência Legacy (agora há 3 e 5). |
| `ach-challenge-perfect` | Three Stars: Earn all three stars on a challenge. | nova na 2.0 | manter | Primeiro degrau das estrelas. |
| `ach-challenge-all` | Puzzle Master: Clear every challenge. | nova na 2.0 | manter | Exige SSL na Season (5 desafios). |
| `ach-quiz-first-try` | Called It: Solve the Daily Quiz on your first guess. | nova na 2.0 | manter | Gancho do Quiz. |
| `ach-specials-100` | Archivist: Unlock 100 special cards. | nova na 2.0 | manter | 90% da coleção. |
| `ach-national-first` | National Pride: Complete a national team. | nova na 2.0 | manter | Álbum das seleções. |
| `ach-national-all` | World Tour: Complete every national team. | nova na 2.0 | manter | Álbum completo. |
| `ach-rank-diamond` | Diamond Standard: Reach the Diamond rank. | nova na 2.0 | manter | Escada de rank da Season. |
| `ach-rank-champion` | Champion Class: Reach the Champion rank. | nova na 2.0 | manter | Escada de rank da Season. |
| `ach-rank-gc` | Grand Champion: Reach the Grand Champion rank. | nova na 2.0 | manter | Escada de rank da Season. |
| `ach-rating-1000` | Rated: Reach 1,000 Season Rating. | nova na 2.0 | manter | O rating começa em 400: são ~17 títulos Legacy líquidos. |
| `ach-rating-2500` | Title Contender: Reach 2,500 Season Rating. | nova na 2.0 | manter | ~58 títulos Legacy líquidos. |
| `ach-rating-5000` | Top of the Board: Reach 5,000 Season Rating. | nova na 2.0 | manter | ~128 títulos Legacy líquidos numa Season. |

### Retiradas, com quantos jogadores perdem cada uma

- `ach-hattrick` — 435 jogadores (96%)
- `ach-blowout` — 434 jogadores (95%)
- `ach-four-goals` — 433 jogadores (95%)
- `ach-goals-100` — 428 jogadores (94%)
- `ach-solo-show` — 420 jogadores (92%)
- `ach-giant-slayer` — 416 jogadores (91%)
- `ach-swiss-flawless` — 414 jogadores (91%)
- `ach-goals-250` — 406 jogadores (89%)
- `ach-games-50` — 405 jogadores (89%)
- `ach-all-eu` — 362 jogadores (80%)
- `ach-open-era-title` — 338 jogadores (74%)
- `ach-all-na` — 307 jogadores (67%)
- `ach-all-sam` — 183 jogadores (40%)
- `ach-all-oce` — 56 jogadores (12%)
- `ach-all-mena` — 49 jogadores (11%)

Quem tinha perde o card no próximo load. O XP que elas pagaram na pre-season não muda nada:
o XP da Season começa em 0 para todo mundo e o `lifetime.xp` não é recalculado.

### Rebaixadas de tier (ninguém perde nada)

- `ach-games-200` (358 jogadores): rare → common
- `ach-goals-500` (388 jogadores): rare → common
- `ach-undefeated` (374 jogadores): rare → common
- `ach-three-specials` (193 jogadores): epic → rare
- `ach-reverse-sweep` (373 jogadores): rare → common
- `ach-lower-bracket` (330 jogadores): epic → rare
- `ach-perfect-chem` (355 jogadores): rare → common
- `ach-perfect-chem-title` (257 jogadores): epic → rare
- `ach-all-champions` (229 jogadores): epic → rare
- `ach-same-team` (79 jogadores): legend → epic

## As 30 novas (draft)

| id | nome | descrição | tier | XP | grupo | sinal e frequência |
|---|---|---|---|---|---|---|
| `ach-hard-10` | Hard Carry | Win 10 tournaments on Hard. | rare | 250 | mode | `wins.hard`; backfill silencioso |
| `ach-all-difficulties` | Full Rotation | Win a tournament on every difficulty: Easy, Normal, Hard and Legacy. | rare | 250 | mode | `wins` das quatro dificuldades; backfill silencioso |
| `ach-blind-title` | Eye Test | Win a tournament on Normal with overalls hidden. | rare | 250 | mode | run: Normal, `showOverall` falso, não Daily |
| `ach-region-sweep` | World Circuit | Win a region-locked tournament in all five regions: NA, EU, SAM, MENA and OCE. | rare | 250 | mode | `regionTitles` nas 5 regiões de `REGION_LOCK.regions`; sem backfill (contador novo) |
| `ach-region-25` | Home Turf | Win 25 region-locked tournaments in a single region. | epic | 600 | mode | `regionTitles`, 25 numa região; sem backfill |
| `ach-daily-30` | Daily Driver | Win 30 Daily Challenges. | epic | 600 | mode | `dailyResults` com placement champion; backfill silencioso |
| `ach-double-hat-trick` | Double Hat-Trick | Have a player score 6 goals in one match. | rare | 250 | performance | sonda: 1–8% das runs |
| `ach-lower-bracket-full` | The Longest Road | Win a tournament after losing your first playoff series. | epic | 600 | performance | perdeu o `ub_quarterfinal` e foi campeão; sonda: 0,1–0,6% das runs |
| `ach-final-comeback` | Never Out of It | Win a final after trailing by two games. | epic | 600 | performance | final vencida depois de ficar 2 jogos atrás; sonda: 0,03–0,4% das runs |
| `ach-giant-killer` | Giant Killer | Win a final as the clear underdog: the other team rated 2 or more points above yours. | epic | 600 | performance | final vencida com `ratingDiff` ≤ −2 (handicap da dificuldade incluído); sonda: 0,1–1,1% das runs |
| `ach-low-ovr-title` | Moneyball | Win a worldwide Classic tournament on Hard or Legacy with a team overall of 90 or lower. | epic | 600 | performance | Classic, Hard/Legacy, sem lock, overall do time ≤ 90; sonda: 0,3% das runs Hard (2% dos títulos) |
| `ach-swiss-escape` | Back from the Brink | Reach the playoffs after starting the Swiss stage 0-2. | rare · **secreta** | 250 | performance | 0-2 no Swiss, 3 vitórias, entrou nos playoffs (não exige título); sonda: 1,3–2,5% das runs Normal+ |
| `ach-heartbreak` | Heartbreaker | Lose a final in game 7 overtime. | rare · **secreta** | 250 | performance | final PERDIDA na prorrogação do jogo 7; sonda: 0,6–1,2% das runs do Easy ao Hard |
| `ach-flawless-run` | Perfect Event | Win a Classic tournament on Hard or Legacy without losing a single game. | epic · **secreta** | 600 | performance | Classic, Hard/Legacy, nenhum jogo perdido; sonda: 0,4% das runs Hard |
| `ach-final-reverse-sweep` | The Impossible Comeback | Win a best-of-seven final after losing the first three games. | legend · **secreta** | 1500 | performance | final Bo7 vencida de 0-3; 0 ocorrências em 12.000 runs da sonda (o achado raro do jogo) |
| `ach-creator-title` | Dev Build | Win a tournament with the Creator card on your team. | epic · **secreta** | 600 | roster | campeão com a carta do Criador (OVR 71) no time |
| `ach-legendaries-all` | Hall of Legends | Unlock every Legendary special card. | epic | 600 | collection | as 12 especiais Lendárias; backfill silencioso |
| `ach-podiums-100` | Podium Regular | Finish in the top three 100 times. | epic | 600 | milestone | contador `podiums`; backfill silencioso |
| `ach-legacy-streak-3` | Three-Peat | Win three Legacy tournaments in a row. | legend | 1500 | mode | `legacyStreak.best`; mesmo limiar do título On a Roll |
| `ach-legacy-streak-5` | Unbreakable | Win five Legacy tournaments in a row. | legend · **secreta** | 1500 | mode | `legacyStreak.best`; mesmo limiar do banner Heatwave |
| `ach-stars-45` | Star Chaser | Earn 45 challenge stars in a single Season. | rare | 250 | mode | `challengeStars` (zera a cada Season) |
| `ach-stars-90` | Constellation | Earn 90 challenge stars in a single Season. | epic | 600 | mode | `challengeStars`; mesmo limiar da Supernova |
| `ach-stars-all` | Perfect Score | Earn all three stars on every challenge in a single Season. | legend | 1500 | mode | 3 estrelas nos 45 desafios (135); 5 desafios pedem SSL |
| `ach-quiz-streak-7` | Film Study | Solve the Daily Quiz 7 days in a row. | rare | 250 | mode | `quiz.bestStreak` |
| `ach-quiz-streak-30` | Encyclopedia | Solve the Daily Quiz 30 days in a row. | epic | 600 | mode | `quiz.bestStreak` |
| `ach-quiz-last-guess` | Zero Seconds | Solve the Daily Quiz on your final guess. | common · **secreta** | 100 | mode | acerto no último palpite do dia (`quizLimit`) |
| `ach-login-7` | Daily Warm-Up | Reach a 7-day login streak. | common | 100 | progression | `login.best`; gancho da primeira semana |
| `ach-login-30` | Never Miss a Kickoff | Reach a 30-day login streak. | epic | 600 | progression | `login.best` |
| `ach-missions-25` | On Assignment | Complete 25 missions. | rare | 250 | progression | `missions.completedTotal` |
| `ach-missions-100` | Mission Control | Complete 100 missions. | epic | 600 | progression | `missions.completedTotal` |

Secretas hoje: `ach-clean-sheet`, `ach-swiss-escape`, `ach-heartbreak`, `ach-flawless-run`, `ach-final-reverse-sweep`, `ach-creator-title`, `ach-creator`, `ach-legacy-streak-5`, `ach-quiz-last-guess`.

Ganchos para quem acabou de chegar: First Lineup e Debut (os 200 XP do Bronze na primeira
run), Lift-Off, First Pull, Daily Warm-Up (7 dias de login), Called It e Zero Seconds no Quiz.
Um jogador novo deixa de ganhar ~950 XP de conquistas comuns nas primeiras runs (hat-trick,
quatro gols, 7 gols, upset, Swiss 3-0, 100 gols, one-man show). O Bronze continua garantido
na primeira run; o Silver (5.000) chega um pouco depois. Se isso incomodar, a alavanca é o XP
de run, não devolver troféu de participação.

### Onde cada grupo é avaliado

- **Feitos de série** (`liveAchievements`, disparam quando a série aparece na tela): Double
  Hat-Trick, Never Out of It, The Impossible Comeback, Giant Killer, Heartbreaker.
- **Feitos de run** (`conditionAchievements`, no fim da run): Perfect Event, Back from the
  Brink, The Longest Road, Moneyball, Eye Test, Dev Build.
- **Contadores do perfil** (`evaluateCounterAchievements`, depois de cada run; os de vida
  também no backfill): Full Rotation, Hard Carry, Podium Regular, Daily Driver, World Circuit,
  Home Turf, Three-Peat, Unbreakable, Hall of Legends.
- **Sistemas da Season** (`evaluateSeasonSystemAchievements`, logo depois do login, da missão
  completada e do quiz, e de novo em cada run): Daily Warm-Up, Never Miss a Kickoff, On
  Assignment, Mission Control, Film Study, Encyclopedia. Zero Seconds sai do próprio palpite.
- **Desafios** (`evaluateChallengeAchievements`, chamado pelo `runStore` depois do resultado
  do desafio; a regra que estava inline no store foi para o engine): Star Chaser,
  Constellation, Perfect Score, mais Three Stars e Puzzle Master, que já existiam.

## Road to Worlds: 7 novas

As conquistas do modo ficam no catálogo do modo (uma fonte por id, #155) e só aparecem com
`FEATURES.careerMode` ligado. Por isso não há conquista do draft que dependa da carreira: com
a flag desligada ela ficaria visível e impossível.

| id | nome | condição | tier | XP |
|---|---|---|---|---|
| `car-seven-seasons` | The Long Haul | `seasonIndex` ≥ 6 (sétima temporada com a org) | rare | 150 |
| `car-worlds-regular` | Worlds Regular | `stats.worldsQualified` ≥ 3 | epic | 200 |
| `car-five-regionals` | Regional Powerhouse | `stats.titlesRegional` ≥ 5 | epic | 250 |
| `car-three-majors` | Major Collection | `stats.titlesMajor` ≥ 3 | epic | 300 |
| `car-two-worlds` | Back for More | `stats.titlesWorlds` ≥ 2 | legend | 500 |
| `car-worlds-unchanged` | Same Three | flag `cosDayOne` (Worlds com os três titulares do primeiro split, sem troca) | legend | 400 |
| `car-perfect-season` | Perfect Season | flag `cosRegionalDynasty` (todos os regionais principais da temporada + Worlds) | legend | 600 |

- Todas usam tipos de condição que o avaliador já tinha (`stat`, `flag`, `seasonIndex`). As
  duas flags são os fatos dos cosméticos da rc.51, gravados em `careerFlow.ts` na vitória do
  Worlds. **Nada em `src/engine/career` nem em `src/store/career*` foi editado**; só o
  catálogo `src/data/career/achievements.ts` e os textos em `ACH_UI.careerItems` (EN e PT).
  O store da carreira percorre o catálogo a cada avaliação, então as 7 passam a ser
  avaliadas lá: sem RNG, sem simulação. Fica a critério do coordenador rodar a sonda de
  soft-lock.
- XP do modo: soma do catálogo de 4.180 para 6.580, uma vez por conta.
- O pedido citava mais três que **não entraram porque o sinal não existe hoje**:
  - *Bicampeonato seguido de Worlds*: `stats.titlesWorlds` só conta. "Back for More" pede o
    segundo título, sem exigir temporadas seguidas, e o texto diz exatamente isso.
  - *Worlds com elenco barato / academia*: a flag `achWorldsMaxStarterOvr` é gravada, mas não
    há tipo de condição que a leia. Já existem Underdog (3+ de overall abaixo do campo) e
    Homegrown (elenco fundador). Um tipo novo (`worldsMaxStarterOvr ≤ N`, `worldsOnDifficulty`)
    são três linhas em `src/engine/career/achievements.ts`, e aí a sonda de soft-lock é obrigatória.
  - *Worlds no Hard*: mesmo caso (precisa de um tipo de condição novo).

## O que pesquisei e não entrou

- **Time inteiro de uma lineup histórica**: impossível por construção, o draft oferece cada
  lineup uma vez e você leva uma carta por lineup. Reunion (três jogadores da mesma org) já
  cobre o alcançável. Os seis slots da mesma org dariam ~1 em 10.000 drafts.
- **Título depois de 0-2 no Swiss**: 1 em 12.000 runs. Virou Back from the Brink (chegar aos
  playoffs depois do 0-2), 1,3–2,5% das runs.
- **Varrer a final (4-0)**: 34% das runs no Easy. **Três prorrogações numa série**: 8–18%
  das runs. **Título com todo adversário de playoff mais forte**: 1 em 12.000. Fora.
- **Título no Legacy vindo da lower**: 45% dos títulos Legacy; não mede nada além de ganhar
  o Legacy duas vezes.
- **Conquista por cosméticos possuídos**: os cosméticos são derivados depois das conquistas
  na mesma escrita; ficaria sempre uma escrita atrasada.

## Pontos em aberto para o Miguel

1. **As cinco de região (EU, NA, SAM, OCE, MENA) saíram.** 56 e 49 jogadores tinham OCE e
   MENA do jeito difícil, antes de existir o lock. Na 2.0 qualquer um ganha na tela de review
   de um Draft Regional. A identidade regional agora é World Circuit, Home Turf e Regional Legend.
2. **World Circuit é rara (250 XP)**: cinco títulos regionais em qualquer dificuldade, o Easy
   resolve em uma tarde. Se a ideia era um feito grande, a versão dura seria "no Legacy" e
   pede um contador por região × dificuldade (campo persistido novo).
3. **The Impossible Comeback não apareceu em 12.000 runs simuladas.** É de propósito o achado
   raro do jogo (poucos jogadores por Season). Se preferir algo que as pessoas vejam, Never
   Out of It (2 jogos atrás na final, épica) já é a versão alcançável.
4. **Heartbreaker paga 250 XP por perder** uma final na prorrogação do jogo 7. É secreta e
   rara; se parecer prêmio de consolação demais, vira common (100).
5. **Estrelas são por Season**: 45, 90 e 135 precisam ser feitas dentro de uma Season. A
   conquista ganha é permanente.
6. **Giant Killer fala em "rating"**, não overall: o `ratingDiff` da série inclui o handicap
   da dificuldade do adversário, que não aparece no overall mostrado.

## Arte

Nenhum arquivo de imagem foi criado. As conquistas não têm arte por id hoje (ícone do grupo
+ estilo do tier); as 30 novas usam o mesmo fallback. Se o Miguel quiser arte própria, os ids
são: `ach-hard-10`, `ach-all-difficulties`, `ach-blind-title`, `ach-region-sweep`, `ach-region-25`, `ach-daily-30`, `ach-double-hat-trick`, `ach-lower-bracket-full`, `ach-final-comeback`, `ach-giant-killer`, `ach-low-ovr-title`, `ach-swiss-escape`, `ach-heartbreak`, `ach-flawless-run`, `ach-final-reverse-sweep`, `ach-creator-title`, `ach-legendaries-all`, `ach-podiums-100`, `ach-legacy-streak-3`, `ach-legacy-streak-5`, `ach-stars-45`, `ach-stars-90`, `ach-stars-all`, `ach-quiz-streak-7`, `ach-quiz-streak-30`, `ach-quiz-last-guess`, `ach-login-7`, `ach-login-30`, `ach-missions-25`, `ach-missions-100`. E na carreira: `car-seven-seasons`, `car-worlds-regular`, `car-five-regionals`,
`car-three-majors`, `car-two-worlds`, `car-worlds-unchanged`, `car-perfect-season`.

## Arquivos

- `src/data/achievements.json` (92 entradas), `src/store/__fixtures__/preseason-held-ids.json` (−15).
- `src/engine/achievements.ts`, `src/engine/counterAchievements.ts` (novos: `profileCounters`,
  `evaluateSeasonSystemAchievements`, `evaluateChallengeAchievements`).
- `src/store/profileStore.ts` (edições locais: o snapshot da run, o backfill, três chamadas de
  `awardSeasonSystemAchievements`, o palpite final do quiz), `src/store/runStore.ts` (o bloco
  das conquistas de desafio).
- `src/data/career/achievements.ts` (+7), `src/content/copy.en.ts` (`careerItems`),
  `src/content/copy.pt.ts` (`items` −15 +30, `careerItems` +7).
- Testes: `src/engine/achievements.e1.test.ts`, `src/engine/achievements.test.ts`,
  `src/store/profileStore.achievements.test.ts`, `src/store/profileStore.achievementsBackfill.test.ts`,
  `src/store/dailyModes.test.ts` (o XP do quiz no último palpite), a sonda opt-in.
- `docs/DESIGN-DECISIONS.md` (seção E1 no fim), `docs/DATA-GUIDE.md` (contagem e onde ficam as regras).

## Não verificado

- **Nada foi visto no navegador.** Abrir `/achievements` (e a grade do perfil) em EN e PT:
  as 9 secretas como "???", os grupos com as novas na ordem do arquivo, os tiers rebaixados,
  o filtro Road to Worlds com 22. Abrir a aba de conquistas do Clube na carreira (lista de 22).
- O toast de Daily Warm-Up no login do sétimo dia e o de Zero Seconds no quiz saem pela fila
  global; a ordem em relação ao toast de login / quiz não foi vista em tela.
- A sonda usa um bot sem resets; jogadores reais draftam melhor no Hard e no Legacy, então
  as frequências desses dois modos são um piso.
