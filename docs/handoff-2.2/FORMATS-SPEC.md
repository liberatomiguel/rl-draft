# Formatos dos Majors e do Worlds — proposta (v2.2, branch `v22/event-formats`)

> 27/11/2026. Fonte: `Road_to_Worlds_Formatos_dos_Majors_e_Worlds.docx` (Miguel).
> Escopo: Road to Worlds, modo **crie sua org**. Regionais, qualificatórios e copas
> não oficiais NÃO mudam. Status: **implementado no branch, atrás de
> `FEATURES.eventFormats`; não está no staging.** Decisões na §7, registro em
> ROAD-TO-WORLDS-DECISIONS (R-FMT).

## 1. Como é hoje

Todo evento oficial (regional, Major, Worlds) tem o mesmo formato `"swiss"`:
suíço de 16 (Bo5, 3V classifica / 3D elimina) no sábado → eliminação dupla de 8
(Bo7, com disputa de 3º) no domingo. Arquivos: `engine/tournament.ts`,
`engine/swiss.ts`, `engine/playoffs.ts` (compartilhados com o Draft),
`engine/career/calendar.ts` (`officialEventDefsForWeek`),
`engine/career/careerResults.ts` (`placementOf`), `engine/career/economy.ts`
(prêmios por colocação, `PLACEMENTS_BY_FORMAT`), `CAREER_POINTS` (pontos).
O Worlds da Season X é cancelado (`CAREER_CANCELLED_WORLDS`, decisão C1).

## 2. O que o documento pede (temporada = `seasonIndex`)

| # | Temporada | Majors 1–3 | Worlds |
|---|---|---|---|
| 0 | Season X | suíço → mata-mata 8 | 4 grupos de 4 → híbrida 8 (1º upper, 2º lower) |
| 1 | 2021–22 | eliminação dupla de 16 | 2 grupos de 8 (dupla, 2V/2D) → mata-mata 8 |
| 2 | 2022–23 | 4 grupos de 4 → mata-mata 12 (1º bye às quartas) | igual a 2021–22 |
| 3 | 2024 | suíço → mata-mata 8 | suíço → híbrida 8 (top 4 upper) |
| 4 | 2025 | suíço → híbrida 8 | 2 grupos de 8 → híbrida 8 (2–0 upper, 2–1 lower) |
| 5 | 2026 | 4 grupos de 4 → híbrida 8 | 4 grupos de 4 → híbrida 12 (1º upper, 2º/3º lower) |

Regras comuns: 16 times direto; grande final em uma série (já é assim);
desempate pela tabela; grupos de 4 = todos contra todos.

## 3. Modelo: formato = fase 1 + chave

Um formato vira um par `{ stage, bracket }` numa tabela em `balance.ts`
(`CAREER_EVENT_FORMATS[seasonIndex].major / .worlds`). Fase 1 no sábado, chave
no domingo — a pausa entre os dois dias continua no mesmo lugar do fluxo atual
(`atPlayoffsStart`).

**Fases (sábado)**
- `swiss` — o suíço atual, sem mudança.
- `groups4` — 4 grupos de 4, turno único (3 séries por time, Bo5). Tabela:
  vitórias → saldo de games → confronto direto.
- `gsl8` — 2 grupos de 8 em eliminação dupla: 2V classifica, 2D elimina
  (3 rodadas no máximo; avançam dois 2–0 e dois 2–1 por grupo).
- `none` — a eliminação dupla de 16 começa direto na chave.

**Chaves (domingo)**
- `double8` — a atual (fica para os regionais).
- `single8` — quartas, semi, final. 3º/4º empatados (sem disputa de 3º).
- `hybrid8` — upper (4 times, 2 séries) e lower R1 (4 times, 2 séries, quem
  perde sai); quartas = perdedores da upper × vencedores da lower; semi =
  vencedores da upper × vencedores das quartas; final.
- `hybrid12` — como a híbrida 8, com a lower começando com 8 (R1 com 4 séries,
  R2 com 2) antes das quartas.
- `single12` — R1: 2º × 3º de outro grupo (4 séries); quartas: 1º de cada grupo
  × vencedores da R1; semi; final.
- `double16` — eliminação dupla de 16. O **sábado** joga até sobrarem 8
  (UB R1, LB R1, UB quartas, LB R2) e o **domingo** o resto.

**Sementes:** suíço → ordem atual (`seedsFromSwiss`), top 4 na upper.
Grupos → 1º na upper, 2º na lower, cruzando grupos para que dois times do mesmo
grupo não se enfrentem na primeira série da chave. GSL → 2–0 na upper,
2–1 na lower, cruzado. Sorteio dos grupos: potes por rating (a semente de classificação não existe no campo do Major),
sorteio com o RNG do evento, evitando a mesma região no mesmo grupo quando der.

## 4. Colocações, pontos e prêmios

Novas colocações necessárias: **`top12`** (9º–12º). O 13º–16º continua sendo a
colocação de eliminado na fase 1 (`swiss_exit`), com o rótulo do formato
("fase de grupos", "primeira rodada"). Colocações por chave:

| Chave | 1 | 2 | 3–4 | 5–6 | 7–8 | 9–12 | 13–16 |
|---|---|---|---|---|---|---|---|
| double8 (hoje) | ✓ | ✓ | 3º, 4º | top6 | top8 | fase 1 | fase 1 |
| single8 | ✓ | ✓ | top4 | top8 (5–8) | | fase 1 | fase 1 |
| hybrid8 | ✓ | ✓ | top4 | top6 | top8 | fase 1 | fase 1 |
| hybrid12 | ✓ | ✓ | top4 | top6 | top8 | top12 | fase 1 |
| single12 | ✓ | ✓ | top4 | top8 (5–8) | | top12 | fase 1 |
| double16 | ✓ | ✓ | 3º, 4º | top6 | top8 | top12 | fase 1 |

**Regra proposta: o total de pontos e de dinheiro que um evento distribui não
muda.** Só a divisão entre colocações muda (posições que agora empatam recebem a
média das que substituem; ex.: no `single8`, 3º–4º = média de 3º e 4º de hoje).
Assim a economia e a corrida pelo Worlds só sentem a variância do formato, não um
aumento de prêmio.

## 5. Saves, determinismo e o Draft

- O formato é gravado no `TournamentState` quando o evento começa (campo
  opcional). Sem o campo = formato antigo. Um save no meio de um Major termina
  no formato em que começou; os eventos seguintes usam a tabela nova.
- O Draft nunca grava o campo: `tournament.ts`/`playoffs.ts` ganham caminhos
  novos sem mexer nos antigos (`regression.golden.test.ts` continua bit a bit).
- Persist version / saveVersion não mudam (campos aditivos).
- Atrás de `FEATURES.eventFormats` (ligado só no build de staging), desligado =
  v2.2 de hoje.

## 6. Fases do trabalho

1. **Motor** — fases `groups4`/`gsl8`, chaves novas, `top12`, tabelas de
   prêmio/pontos por chave, simulação sem usuário, testes por formato
   (número de séries, colocações somando 16, determinismo, saves antigos).
2. **Fluxo** — careerFlow/careerSunday: pausa sábado/domingo por formato,
   modo acompanhar, notícias e e-mails que falam "Swiss".
3. **Telas** — tabelas de grupo, chaves de grupo GSL, chaves híbrida/12/16, cartão
   "formato do evento" no lobby (com as frases do documento), Calendar e
   Standings. Copy EN/PT. DESIGN.md obrigatório.
4. **Medição** — bateria pareada antes/depois (NA/EU/SAM, Normal/Hard, título do
   Worlds em S6–S7), probe de soft-lock (`P1_SOFT=1`), rc no staging e portão.

## 7. Decisões (Miguel, 27/11)

1. **Worlds da Season X continua cancelado** (C1 fica). A linha "Worlds" da
   Season X no documento não é jogada na temporada 0; ela só volta no rodízio.
2. **2027 em diante (S7+) alterna entre os seis formatos do documento**, uma
   linha por temporada, em ordem: 2027 = linha da Season X (agora com o Worlds
   dela jogado), 2028 = 2021–22, … 2032 = 2026, 2033 volta à Season X. É
   determinístico pela temporada (o Calendar pode prever). O modo escolher org,
   que começa em 2027, herda o mesmo rodízio.
3. **Total de pontos e de prêmio por evento inalterado** (decidido por mim, a
   pedido do Miguel): só a divisão entre colocações muda.
4. **Séries:** fase 1 Bo5, chave Bo7, final Bo7, como hoje.
5. **Sorteio dos grupos** (decidido por mim): potes pela semente de
   classificação, sorteio com o RNG do evento, evitando a mesma região no mesmo
   grupo quando der.

## 8. Convivência com os outros agentes

Branch próprio a partir de `origin/staging`, worktree `.claude/worktrees/v22-formats`.
Pontos quentes de conflito: `balance.ts`, `copy.career.*`, `careerFlow.ts`,
`EventScreen.tsx`. Blocos novos ficam em seções próprias (no fim do arquivo ou em
módulos novos) para o merge com `release/v2.2` ser trivial. Bateria e build seguem
o protocolo de trava (um trabalho pesado por vez). Os IDs de decisão (R17x) são
numerados no merge, para não colidir com os do modo escolher org.
