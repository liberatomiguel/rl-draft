# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

Spec: `MATCHDAY-SPEC.md`. Decisões: `ROAD-TO-WORLDS-DECISIONS.md` R137–R140.
Metas: `ANALISE-POSTHOG-2026-11-20.md`; referência: `BALANCE-BASELINE-v2.0.35.md`.
`package.json`/`SITE.version` seguem 2.0.35; `BALANCE_VERSION` 40.

## Feito

- **Fatia 1** (`dev.1`): série em passos; trava em `match.steps.test.ts`.
- **Fatia 2** (`dev.3`, `FEATURES.matchdayStyles`): estilos, confronto, traços.
- **Fatia 3** (`dev.5`–`dev.6`, `FEATURES.matchdayDecisions`, desligada): plano, pausas, embalo no lugar do bounce, "deixar com o coach", modos `prefs.matchdayMode` (rápido por padrão) e `matchdayStopAt`. Série do usuário em `seriesSeed`, salva em `activeEvent.userSeries`. `dev.6` (R140): a IA planeja e pausa com o seu coach, em IA × IA também. Código: `engine/career/matchday.ts`, `matchdaySeries.ts`, `store/careerFlow.ts`.

## Medição (dev.6; bots; dumps em `matchday-f3-dumps/` nas notas)

Flag desligada = baseline carreira por carreira (14/14).

| | v2.0.35 | Ligada |
|---|--:|--:|
| Motor +2 / +5 / +6 | 75,5 / 96,1 / 98,4% | 75,4 / 96,2 / 98,4% |
| Carreira ±2 N / H / E | 59,4 / 56,2 / 76,1% | 57,7 / 56,0 / 75,2% |
| Série perdida no endgame: Major N / H | 45 / 64% | 59 / 74% |
| Soft lock; falência N / H | 0; 0 / 4 de 42 | 0; 2 / 6 de 42 |

Zebra de +5: 3,8%. Tempo por temporada: 3,4 s (dev.5: 4,4 s na mesma carga); o motor custa ~+53 µs por série.

**Rápido × personalizado** (usuário contra IA com coach médio, 20 mil séries por célula):

| Gap | Bom manual | Coach médio | Coach 0,7 | Sem coach | Antigo |
|---|--:|--:|--:|--:|--:|
| −2 | 27,4% | 24,7% | 26,3% | 20,6% | 25,1% |
| 0 | 53,2% | 50,1% | 52,0% | 45,9% | 49,7% |
| +2 | 78,0% | 75,4% | 77,0% | 71,8% | 74,9% |

Meta do R140 atingida: coach médio × coach médio = 50%, bom manual +3 pp.

## Para o Miguel decidir

- Com a IA planejando, o rápido sem coach fica ~4 pp abaixo de hoje (45,9%) e o favorito de +2 sem coach cai para 71,8%: aceitar, ou dar ao time sem coach uma qualidade mínima.
- O endgame dos bots ficou mais difícil (séries perdidas em Major 45 → 59% na Normal).

## Fatia 4 precisa saber

Opção B (R137). Os momentos-chave saem da súmula; os dados do jogo estão em `SeriesState.games` e o medidor em `SeriesState.matchday` (só para leitura; sem barra de embalo).

## Fatia 5 precisa saber

- Telas: pré-série (`shownStyle`, `playmakerIndex`, traços; sugestão de `coachPlanFor`), pausa e a opção (rótulos `matchdayMode.*` prontos).
- Com o personalizado, `playEventRound`/`simEvent` param numa série aberta (`pendingUserSeriesOf`); a tela usa `setSeriesPlan`, `playSeriesGame`, `seriesTimeout`, `seriesAdjust`, `seriesSub`, `delegateSeries` e depois `playEventRound`. O autoplay e o "Avançar" precisam tratar essa parada.
- Decidir se o reserva que entra na troca recebe XP (`fieldedIds` não muda hoje).
