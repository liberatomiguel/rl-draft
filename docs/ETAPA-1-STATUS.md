# Etapa 1 (v2.1 Matchday + Mundo vivo): estado

Spec: `MATCHDAY-SPEC.md`. Decisões: `ROAD-TO-WORLDS-DECISIONS.md`
R137 (20/11) e R138 (fatia 2). Metas: `ANALISE-POSTHOG-2026-11-20.md`;
referência simulada: `BALANCE-BASELINE-v2.0.35.md`.

## Fatia 1 (`v2.1.0-dev.1`)

Série em passos sem mudar resultado: `startSeries` / `playNextGame` /
`finishSeries` em `engine/match.ts`; `SeriesState` é JSON puro. `seriesSeed`
em `career/seeds.ts`, testado, **não ligado** (ligar move as outras séries da
rodada). Trava: o digest de `match.steps.test.ts`.

## Fatia 2 (`v2.1.0-dev.3`, atrás de `FEATURES.matchdayStyles`, desligada)

`career/styles.ts` (cinco estilos, natural + encaixe pelos atributos),
`career/traits.ts` (0–2 traços por nome + sal), confronto e traços em
`match.ts`, `CAREER_MATCHDAY` em `balance.ts`. Só `assembleTournamentTeam`
com `rollRange` (carreira) preenche `style`/`traits`. LAN não ligado.

**Medição** (bots autopilot/tuned/professional, sem a política "strong" do M1,
que não está neste ramo). Flag desligada = baseline, carreira por carreira.

| | Desligada | Ligada |
|---|--:|--:|
| Motor: favorito +2 / +5 / +6 | 75,2 / 96,0 / 98,2% | 74,9 / 95,9 / 98,2% |
| Carreira ±2: Normal / Hard / Easy | 59,4 / 56,2 / 76,1% | 59,1 / 57,3 / 76,1% |
| Carreira ≥ +6: Normal / Hard | 99,8 / 99,5% | 99,9 / 100% |
| Final regional até T5, NA e EU (N/E/H) | 0/6 em tudo | 0/6 em tudo |
| Título regional, rating 84–87: N / H | 17 / 7% | 8 / 13% |
| Worlds por participação (endgame N) | 1 de 12 | 0 de 11 |
| Soft lock / falência N / falência H | 0 / 0 / 4 de 42 | 0 / 1 / 5 de 42 |

Guardas duras de pé (Draft intacto, +6 ≥ 98%, +2 ≥ 73%, 0 soft lock, âncoras).
Zebra de +5: ~4% no motor, abaixo da faixa 5–8%; os tetos não precisam baixar.
Metas 1 e 2 (EU/NA) não se movem: o confronto é aleatório em relação ao
rating e não é a alavanca. Meta 4 está dentro do ruído (amostras de 16–37
temporadas). Meta 5 vale (0–8%), mas os bots quase nunca ganham o Worlds.

## Fatia 3 precisa saber

- Plano escolhe `TeamStyle.played`; o embalo substitui o hook de comportamento
  em `traitBounce`. Teto somado ±1,2 já é aplicado em `gameSide`.
- `package.json`/`SITE.version` seguem 2.0.35; `BALANCE_VERSION` 38.

## Fatia 4, decidida (opção B, R137)

Súmula com 2 a 4 momentos-chave por jogo, todos tirados da súmula; sem
narração lance a lance e sem barra de embalo.
