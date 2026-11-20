# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

Spec: `MATCHDAY-SPEC.md`. Decisões: `ROAD-TO-WORLDS-DECISIONS.md` R137–R139.
Metas: `ANALISE-POSTHOG-2026-11-20.md`; referência: `BALANCE-BASELINE-v2.0.35.md`.
`package.json`/`SITE.version` seguem 2.0.35; `BALANCE_VERSION` 39.

## Feito

- **Fatia 1** (`dev.1`): série em passos; trava em `match.steps.test.ts`.
- **Fatia 2** (`dev.3`, `FEATURES.matchdayStyles`): estilos, confronto, traços.
- **Fatia 3** (`dev.5`, `FEATURES.matchdayDecisions`, desligada): plano, pausas, embalo no lugar do bounce, "deixar com o coach", modos `prefs.matchdayMode` (rápido por padrão) e `matchdayStopAt`. Série do usuário em `seriesSeed`, salva em `activeEvent.userSeries`. Código: `engine/career/matchday.ts`, `matchdaySeries.ts`, `store/careerFlow.ts`.
- **Fatia 4** (`dev.9`, `FEATURES.matchdayBoxScore`, desligada): súmula, nota 0–10, momentos-chave e estatísticas da temporada (opção B, R137; decisão R140). Código: `engine/career/boxScore.ts`, `content/momentText.ts`, `store/careerFlow.ts` (`accumulateBoxStats`). Só apresentação: não muda resultado; o mundo simulado não chama a súmula (tempo de simulação por temporada inalterado). `BALANCE_VERSION` 40 só pelo fingerprint das constantes novas.

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

## Fatia 5 precisa saber

**Súmula (fatia 4):**
- `buildSeriesBoxScore(series, roundKey, {a: teams[teamAId], b: teams[teamBId]})` devolve `games[]` (`players.a/b[]` com gols, assistências, chutes, defesas, demos, pontos, nota; `moments[]`; `mvp` do jogo), `totals` (com `avgRating`) e o `mvp` da série (maior pontuação do vencedor). Use o `key` da rodada do `eventPlayback` ("sw:2" / "po:0"): é o mesmo que alimenta as estatísticas salvas, então a tela mostra os números que entram nelas. Chame só ao abrir a série; é determinístico.
- Texto do momento: `momentText(useCareerCopy(), moment, teams[side].playerNames[moment.playerIdx])`. O `clock` é o do `matchTimeline` (restante na regulamentar, jogado na prorrogação), então o momento encaixa na linha do tempo do Match Center.
- Estatísticas do elenco: `save.boxStats` (`SeasonBoxStats[]`, mais nova primeiro, no máximo duas temporadas; chave = id do jogador, ou o nome se não achar). Média = `avgRatingOf(linha)`. Só a série do usuário entra, ao fim do evento: o evento em curso ainda não está lá.
- Com a flag desligada nada é gerado nem salvo; a tela esconde a súmula nesse caso (`FEATURES.matchdayBoxScore`).
- Troca no meio da série (fatia 3): não conferi como o reserva aparece em `scorers`/`playerNames`. A súmula lê os `playerNames` do time ao fim do evento e atribui por índice; se a troca mudar o índice, olhar isso antes de mostrar nomes.

**Telas e modos:**

- Telas: pré-série (`shownStyle`, `playmakerIndex`, traços; sugestão de `coachPlanFor`), pausa e a opção (rótulos `matchdayMode.*` prontos).
- Com o personalizado, `playEventRound`/`simEvent` param numa série aberta (`pendingUserSeriesOf`); a tela usa `setSeriesPlan`, `playSeriesGame`, `seriesTimeout`, `seriesAdjust`, `seriesSub`, `delegateSeries` e depois `playEventRound`. O autoplay e o "Avançar" precisam tratar essa parada.
- Decidir se o reserva que entra na troca recebe XP (`fieldedIds` não muda hoje).
