# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

Spec: `MATCHDAY-SPEC.md`. Decisões: `ROAD-TO-WORLDS-DECISIONS.md` R137–R141.
Metas: `ANALISE-POSTHOG-2026-11-20.md`; referência: `BALANCE-BASELINE-v2.0.35.md`.
`package.json`/`SITE.version` seguem 2.0.35; `BALANCE_VERSION` 41.

## Feito

- **Fatia 1** (`dev.1`): série em passos; trava em `match.steps.test.ts`.
- **Fatia 2** (`dev.3`, `FEATURES.matchdayStyles`): estilos, confronto, traços.
- **Fatia 3** (`dev.5`, `dev.6`, `dev.10`, `FEATURES.matchdayDecisions`, desligada): plano, pausas, embalo no lugar do bounce, "deixar com o coach", modos `prefs.matchdayMode` (rápido por padrão) e `matchdayStopAt`. Série do usuário em `seriesSeed`, salva em `activeEvent.userSeries`. A IA planeja e pausa com o seu coach (R140); sem coach, o time decide no piso `coachlessQuality` = 0,3 (R141). Código: `engine/career/matchday.ts`, `matchdaySeries.ts`, `store/careerFlow.ts`.

## Medição (dev.10; bots; dumps em `matchday-f3-dumps/` nas notas)

Flag desligada = baseline carreira por carreira (14/14).

| | v2.0.35 | Ligada |
|---|--:|--:|
| Motor +2 / +5 / +6 | 75,5 / 96,1 / 98,4% | 75,4 / 96,2 / 98,4% |
| Carreira ±2 N / H / E | 59,4 / 56,2 / 76,1% | 58,3 / 58,1 / 76,2% |
| Série perdida no endgame: Major N / H | 45 / 64% | 58 / 71% |
| Soft lock; falência N / H | 0; 0 / 4 de 42 | 0; 1 / 6 de 42 |

Zebra de +5: 3,8%. Tempo por temporada sem piora (dev.6: 3,4 s; o motor custa ~+53 µs por série).

**Rápido × personalizado** (usuário contra IA com coach médio, Swiss, 20 mil séries por célula):

| Gap | Bom manual | Coach médio | Coach 0,7 | Sem coach | Antigo |
|---|--:|--:|--:|--:|--:|
| −2 | 27,4% | 24,7% | 26,3% | 23,8% | 25,1% |
| 0 | 53,2% | 50,1% | 52,0% | 49,2% | 49,7% |
| +2 | 78,0% | 75,4% | 77,0% | 74,8% | 74,9% |

Sem coach fica a 0,5 pp de hoje e o +2 sem coach, em 74,8%. O coach médio vale só ~+1 pp sobre o sem coach (por construção, R141); o coach 0,7, ~+3.

## Em aberto para o gate da Etapa 1

- XP do reserva que entra na troca (`fieldedIds` não muda hoje, R141).
- O endgame dos bots ficou mais difícil (séries perdidas em Major 45 → 58% na Normal).
- A diferença pequena entre coach médio e sem coach.

## Fatia 4 precisa saber

Opção B (R137). Os momentos-chave saem da súmula; os dados do jogo estão em `SeriesState.games` e o medidor em `SeriesState.matchday` (só para leitura; sem barra de embalo).

## Fatia 5 precisa saber

- Telas: pré-série (`shownStyle`, `playmakerIndex`, traços; sugestão de `coachPlanFor`), pausa e a opção (rótulos `matchdayMode.*` prontos).
- Com o personalizado, `playEventRound`/`simEvent` param numa série aberta (`pendingUserSeriesOf`); a tela usa `setSeriesPlan`, `playSeriesGame`, `seriesTimeout`, `seriesAdjust`, `seriesSub`, `delegateSeries` e depois `playEventRound`. O autoplay e o "Avançar" precisam tratar essa parada.
