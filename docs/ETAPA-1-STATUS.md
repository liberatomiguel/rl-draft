# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

Só o estado atual. Spec: `MATCHDAY-SPEC.md`. Decisões do Miguel de 20/11:
`ROAD-TO-WORLDS-DECISIONS.md` R137. Medição: `ANALISE-POSTHOG-2026-11-20.md`
(dados reais, define as metas) e `BALANCE-BASELINE-v2.0.35.md` (referência
simulada, rodar de novo a cada fatia).

## Fatia 1, entregue (commit `v2.1.0-dev.1`, só motor)

Série em passos sem mudar nenhum resultado. `engine/match.ts`:

```ts
startSeries(teamA, teamB, options: SeriesOptions, rng): SeriesState
isSeriesOver(state): boolean
playNextGame(state, teamA, teamB, rng): SeriesState   // novo estado; não muta
finishSeries(state, teamA, teamB): SeriesResult       // não sorteia nada
simulateSeries(...)                                   // laço sobre os três
```

`SeriesState` é JSON puro: ids dos times, options, target, formA/formB,
winsA/winsB, lastWinner, maxDeficitA/B, games. Os times entram de novo em cada
passo, na mesma ordem (lança erro se não baterem).

`engine/career/seeds.ts`:
`seriesSeed(careerSeed, eventStream, roundKey, teamAId, teamBId)`, stream
`ser:{eventStream}:{roundKey}:{teamAId}:{teamBId}`. Testado, **não ligado**.

Prova: `match.steps.test.ts` compara um digest de 6.000 séries variadas (e do
cursor do RNG) com o motor da v2.0.35, também com salvar e recarregar entre os
jogos. Golden e balance intactos.

## O que a fatia 2 precisa saber

- Modificadores novos (estilo, plano, traços, embalo) entram em `gameSide` /
  `playNextGame` como campos opcionais de `TournamentTeam`: campo ausente =
  caminho antigo. O digest de `match.steps.test.ts` tem que continuar igual com
  a flag desligada; é a trava do Draft.
- Ligar `seriesSeed` tira a série do usuário do RNG da rodada e muda as outras
  séries daquela rodada: isso move resultados, então vai atrás de flag em
  `FEATURES` e com a bateria do baseline.
- `package.json`/`SITE.version` continuam 2.0.35 até o lançamento da v2.1.
- Nada de save, copy ou tela ainda.
