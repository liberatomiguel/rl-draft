# Análise PostHog — 20/11/2026

> Período: 12/11 14:00 UTC até 20/11. Produção, catálogo 2.0, só agregados.
> "T1" = 1ª temporada (`seasonIndex` 0). Carreiras = `careerId` com
> `career_created` no período (1.010). "Parada" = sem torneio desde 18/11.
> **Ressalva:** 129 jogadores bateram no teto de 400 eventos/dia
> (`quality_event_cap`), justamente os mais ativos. Os números de carreira
> longa são um piso.

## 1. Achados

**Funil (carreiras criadas)**

| | Total | Celular | Desktop |
|---|---|---|---|
| Criadas | 1.010 | 449 | 551 |
| 1º torneio | 81% | 79% | 83% |
| Fim da T1 | 56% | 54% | 58% |
| Fim da T3 | 43% | 39% | 45% |
| Fim da T7 | 22% | 19% | 24% |
| Fim da T10 | 10% | 8% | 13% |

Das 531 carreiras paradas, 163 (31%) pararam na T1 (53 até a semana 4).
Segundo pico no fim da T6 (66), junto com `timeline_complete` (259
carreiras, mediana T6). A última página antes de parar é dispersa: nenhuma
tela única prende o jogador.

**Primeira final regional (Normal), entre as carreiras que chegaram à temporada**

| Região | Até T3 | Até T5 | Até T7 | Worlds vencido até T10 |
|---|---|---|---|---|
| EU | 0 de 128 | **1 de 103 (1%)** | 18 de 63 (29%) | 10 de 33 |
| NA | 0 de 100 | 27 de 77 (35%) | 33 de 52 (63%) | 12 de 26 |
| SAM | 5 de 73 | 40 de 60 (67%) | 35 de 39 (90%) | 9 de 15 |
| MENA/APAC/OCE/SSA | 21 de 60 | 35 de 51 (69%) | 31 de 36 (86%) | 10 de 18 |

Easy não alivia a EU: 4 de 21 (19%) até T5. Hard: 0 de 16 na EU até T5.
Amostras de Easy/Hard por região pequena: menos de 20 carreiras, não confiar.

**O overall decide; a dificuldade quase não muda nada**

| Overall do elenco | Normal: título regional | Normal: cai no suíço | Normal: título Major/Worlds | Hard: título regional | Hard: Major/Worlds |
|---|---|---|---|---|---|
| < 80 | 1–2% | 81–95% | 0% | 0–2% | 0% |
| 84–86 | 18% | 22% | 1% | 17% | 0% |
| 87–89 | 45% | 4% | 16% | 36% | 11% |
| 90–92 | 80% | 0% | 49% | 60% | 44% |
| 93+ | **95%** | 0% | **87%** | **98%** | **96%** |

(Normal: 18.563 torneios; Hard: 1.851.) O jogador "para de perder" por
volta de 90. Com 93+, Hard ganha mais que Normal.

**Fim de jogo.** Da T13 em diante, 205 de 211 temporadas (97%) chegam ao
Worlds, com título e rank regional médio 1,0–2,0 (≈42 carreiras: amostra
pequena). Em todas as participações no Worlds, o time do jogador é campeão
em 44% (482 de 1.087). Das 110 carreiras paradas que ganharam o Worlds, 31
(28%) pararam na mesma temporada, 23 na seguinte, 56 jogaram 2+ temporadas a
mais. 31 têm 3+ títulos mundiais.

**Versão de balanceamento.** Título regional com overall 90+: 86% (BV 32, 389
carreiras) → 89% (BV 37, 155 carreiras, só 2 dias). Nenhuma mudança de
32 a 37 mexeu na curva.

**Economia**

| Temporada | Saldo mediano | Saldo p90 | Folha/split mediana | Split com saldo < 0 |
|---|---|---|---|---|
| T2–T4 | 14–43 mil | 47–173 mil | 12–30 mil | 10–12% |
| T7 | 264 mil | 1,2 mi | 102 mil | 11% |
| T10+ | 4,2 mi | 103 mi | 505 mil | 3% |

Insolvência: 38 carreiras (3,8%), mediana T5. Depois da T8 o dinheiro perde
sentido (saldo = 10 folhas). Desde 18/11: 1.419 vendas em 214 carreiras.
Trocas não são distinguíveis de venda + compra. Avanço lento: 3 eventos.
Avanço recusado: invisível.

**Draft.** Classic Legacy: 11.884 runs, 232 jogadores, 2% de título (farm de
rating continua). Normal 33% (431 jogadores), Hard 18%, Easy 63%; Daily 57%;
Quick quase sem uso (589 runs). Desafios: nenhum fica abaixo de 60% de
jogadores que limpam; nada abandonado.

## 2. Fácil demais / difícil demais / abandonado

| | O quê |
|---|---|
| **Fácil demais** | Overall 90+: título quase certo em qualquer dificuldade; T13+ ganha tudo; 44% de título por Worlds; dinheiro sobrando da T8 |
| **Difícil demais** | EU (e NA) no Normal: final regional só a partir da T6–T8; Easy na EU quase igual ao Normal; caixa negativo em 1 de cada 10 splits no início |
| **Abandonado** | 44% das carreiras não fecham a T1; celular 4–6 pontos abaixo em cada degrau; Quick no Draft |

## 3. Metas propostas para a Etapa 1 (proposta para o Miguel decidir)

| # | Meta | Hoje |
|---|---|---|
| M1 | Normal, toda região: ≥ 40% das carreiras que chegam à T5 já tiveram final regional | EU 1%, NA 35% |
| M2 | Easy na EU: final até T5 ≥ Normal + 20 pontos | 19% contra 1% |
| M3 | Overall 93+, Normal: título regional ≤ 75%, Major/Worlds ≤ 55% | 95% e 87% |
| M4 | Mesmo overall: Hard sempre abaixo do Normal | Hard 98% ≥ Normal 95% |
| M5 | Título por participação no Worlds ≤ 30% | 44% |
| M6 | T13+: temporadas que chegam ao Worlds ≤ 80% | 97% |
| M7 | Time favorito por 5+ de overall ainda perde 10–20% das séries | Não mensurável |
| M8 | Splits com saldo negativo em T2–T4 ≤ 8%; saldo/folha mediano T10+ ≤ 4 | 10–12%; 10 |
| M9 | Fim da T1 ≥ 60% das criadas; gap celular-desktop na T3 ≤ 3 pontos | 56%; 6 pontos |

## 4. Eventos e propriedades que faltam

PostHog cobra por evento: quase tudo é propriedade nova (custo zero).

| Pergunta | Falta | Onde |
|---|---|---|
| Vitória por série, zebras (M7) | `seriesWon`, `seriesLost`, `upsetWins`, `upsetLosses` (série ganha como azarão / perdida como favorito por 5+), `oppOverallAvg` | `career_event_completed` |
| Matchday | `liveSeries` (séries vistas ao vivo), `decisions` | `career_event_completed` |
| Mundo vivo | `realOrgsTop8` (orgs reais no top 8 da região), `formatId` | `career_season_completed` |
| Soft lock | `career_action_refused` (`reason`, `screen`), 1 por sessão e motivo | evento novo, crítico, volume baixo |
| Trocas | `kind = trade` (ou `viaTrade`) | `career_transfer` |
| Onde parou | `lastCareerTab` | `session_started` |
| Dados perdidos | Teto de 400/dia corta os mais ativos: isentar eventos críticos de carreira ou subir o teto | `analyticsBudget.ts` |

Revisar `analytics-budget.json` (ainda 120 jogadores/dia) antes do evento novo.
