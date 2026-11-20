# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

Spec: `MATCHDAY-SPEC.md`. Decisões: `ROAD-TO-WORLDS-DECISIONS.md` R137–R139.
Metas: `ANALISE-POSTHOG-2026-11-20.md`; referência: `BALANCE-BASELINE-v2.0.35.md`.
`package.json`/`SITE.version` seguem 2.0.35; `BALANCE_VERSION` 39.

## Feito

- **Fatia 1** (`dev.1`): série em passos; trava em `match.steps.test.ts`.
- **Fatia 2** (`dev.3`, `FEATURES.matchdayStyles`): estilos, confronto, traços.
- **Fatia 3** (`dev.5`, `FEATURES.matchdayDecisions`, desligada): plano, pausas, embalo no lugar do bounce, "deixar com o coach", modos `prefs.matchdayMode` (rápido por padrão) e `matchdayStopAt`. Série do usuário em `seriesSeed`, salva em `activeEvent.userSeries`. Código: `engine/career/matchday.ts`, `matchdaySeries.ts`, `store/careerFlow.ts`.

## Medição da fatia 3 (bots; dumps em `matchday-f3-dumps/` nas notas)

Flag desligada = baseline carreira por carreira (14/14).

| | v2.0.35 | Ligada |
|---|--:|--:|
| Motor +2 / +5 / +6 | 75,5 / 96,1 / 98,4% | 75,6 / 96,1 / 98,4% |
| Carreira ±2 N / H / E | 59,4 / 56,2 / 76,1% | 59,7 / 58,6 / 77,0% |
| Carreira ≥ +6 N / H | 99,8 / 99,5% | 99,8 / 99,9% |
| Soft lock; falência N / H | 0; 0 / 4 de 42 | 0; 1 / 5 de 42 |

Zebra de +5: 3,9%, ainda abaixo de 5–8%. Final regional até T5 segue 0/6 em NA, EU e SAM.

**Rápido × personalizado** (vitória do usuário, 20 mil séries por célula, Normal = Hard):

| Gap | Bom manual | Coach médio (72) | Coach 0,7 | Sem coach | Antigo |
|---|--:|--:|--:|--:|--:|
| −2 | 30,4% | 27,9% | 29,3% | 24,0% | 25,1% |
| 0 | 55,7% | 53,3% | 54,8% | 49,4% | 49,7% |
| +2 | 80,4% | 78,2% | 79,6% | 74,9% | 74,9% |

O coach médio custa 2–2,5 pp contra o bom manual; sem coach, 5,5–6,4 pp. Pedaços do manual em série igual: timeout +2,3, ajuste +1,8, estilo +1,3, marcação +1,1, kickoff ~0 pp.

## Para o Miguel decidir

- Sem coach custa ~6 pp: aceitar, ou dar ao time sem coach uma qualidade mínima (ex.: 0,2).
- Decidir também deixa a série igual mais fácil que hoje: +3,6 pp com o coach médio, +6 com o bom manual (a IA não planeja).

## Fatia 4 precisa saber

Opção B (R137). Os momentos-chave saem da súmula; os dados do jogo estão em `SeriesState.games` e o medidor em `SeriesState.matchday` (só para leitura; sem barra de embalo).

## Fatia 5 precisa saber

- Telas: pré-série (`shownStyle`, `playmakerIndex`, traços; sugestão de `coachPlanFor`), pausa e a opção (rótulos `matchdayMode.*` prontos).
- Com o personalizado, `playEventRound`/`simEvent` param numa série aberta (`pendingUserSeriesOf`); a tela usa `setSeriesPlan`, `playSeriesGame`, `seriesTimeout`, `seriesAdjust`, `seriesSub`, `delegateSeries` e depois `playEventRound`. O autoplay e o "Avançar" precisam tratar essa parada.
- Decidir se o reserva que entra na troca recebe XP (`fieldedIds` não muda hoje).
