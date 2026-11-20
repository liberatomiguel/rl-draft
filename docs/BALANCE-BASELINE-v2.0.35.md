# Balance de referência da carreira — v2.0.35 (BALANCE_VERSION 37)

Referência, não meta. Medido com as sondas existentes, sem mudar engine nem números. Bots determinísticos (autopilot/tuned/professional), **não** jogadores reais. Seeds 9100 + 7919·k.

## 1. Série por diferença de rating
Engine puro (bo5, stats iguais, 20 000 séries; bo7 e base 100 dão ±0,6 pt; Normal = Hard para times neutros):

| Gap | Favorito vence | Zebra |
|---|--:|--:|
| +0 | 50,0% | 50,0% |
| +2 | 75,2% | 24,8% |
| +6 | 98,2% | 1,8% |
| +12 | 100% | 0% |

Carreira real (84 carreiras, ~28 mil séries; gap = usuário − rival):

| Gap | Normal | Hard |
|---|--:|--:|
| ≤ −6 | 0,3% | 0,2% |
| −6 a −2 | 17,2% | 14,6% |
| ±2 | 59,4% | 56,2% |
| +2 a +6 | 92,2% | 93,1% |
| ≥ +6 | 99,8% | 99,5% |

## 2. Marcos por região × dificuldade
84 carreiras (autopilot+tuned, 3 seeds = 6 por célula), 8 temporadas. Mediana da temporada entre quem chegou [chegaram/6].

| Região | Dif. | 1ª final regional | 1º título regional | 1º Worlds |
|---|---|---|---|---|
| NA, EU, SAM, MENA | N e H | — [0/6] | — [0/6] | — [0/6] |
| OCE | N | 6 [1] | 7 [1] | 8 [1] |
| OCE | H | 6 [1] | 6 [1] | — [0] |
| APAC | N | 2 [3] | 2 [1] | 3 [1] |
| APAC | H | 4 [1] | 4 [1] | 4 [1] |
| SSA | N | 4 [2] | 4 [2] | 4 [1] |
| SSA | H | 7 [2] | 8 [2] | 8 [2] |

Nenhum título mundial em 84 carreiras. Quebra: 4 falências na Hard (NA, EU, MENA, APAC, 1 cada) = 4/42, 0 na Normal. Atenção: bots não jogam como humanos; "0/6" em 4 regiões fortes mede a política do bot, não um teto.

## 3. Endgame (policy professional, tudo pago, 84 carreiras)
**Nenhum time ≥100 aparece**: o máximo de rating na entrada do Worlds foi 96,5 (mediana 94). A métrica "100+" não é alcançável por este probe; use o gap como proxy.

| Dif. | Evento | Eventos | Títulos | Série perdida | Rating mediano | Gap mediano ao mais forte |
|---|---|--:|--:|--:|--:|--:|
| Normal | Major | 30 | 1 | 45% | 94,9 | +2,9 |
| Normal | Worlds | 12 | 1 | 45% | 95,6 | +2,7 |
| Hard | Major | 38 | 0 | 64% | 92,6 | +6,2 |
| Hard | Worlds | 16 | 0 | 58% | 92,6 | +6,1 |

(Gap = rival mais forte − usuário.)

## 4. Soft lock
`careerSoftlock.probe`, 7 regiões × Normal e Hard × autopilot/tuned, 7 temporadas: **0 achados** (2 slices passaram). Pacing e endgame: 0 softlocks em 168 carreiras.

## 5. Reproduzir
```
GAP=1 GAP_OUT=gap.json npx vitest run src/engine/match.gap.probe.test.ts
PACING=1 PACING_OUT=paceI.json PACING_DIFFS=normal,hard PACING_POLICIES=autopilot,tuned PACING_SEEDS=3 PACING_SLICE=I/6 npx vitest run src/store/careerPacing.probe.test.ts   # I=0..5
ENDGAME=1 ENDGAME_OUT=endI.json ENDGAME_DIFFS=normal,hard ENDGAME_SEEDS=2 ENDGAME_SLICE=I/6 npx vitest run src/store/careerEndgame.probe.test.ts   # I=0..5
P1_SOFT=1 P1_SOFT_DIFFS=normal,hard npx vitest run src/store/careerSoftlock.probe.test.ts
node scripts/balance-baseline-summary.mjs <pasta-dos-json> gap.json
```
~45 s por carreira; as fatias rodam em paralelo (~25 min em 16 núcleos). Dumps (6,5 MB) não versionados: ficam na pasta de notas da sessão, `balance-baseline-v2.0.35-dumps/`.

## 6. Propostas para o Miguel
**Guardas duras (não podem quebrar)**
- Draft inalterado (teste golden).
- Favorito em série desigual: ≥ +6 vence ≥ 98%; +2 vence ≥ 73%.
- Zero soft lock no probe (e nos 168 bots de pacing/endgame).
- Overall segue dominante (testes de âncora §25).
- Falência Normal: 0 em 42 hoje; não subir de forma relevante.

**Métricas feitas para mexer**
- Séries em gap ±2 na carreira (59% Normal / 56% Hard): sobe com Matchday (leitura da partida)? Direção: mais decididas pelo jogador, sem mover o favorito de +6. Meta: aguarda as metas da análise do PostHog.
- Marcos por região (hoje 0/6 em NA/EU/SAM/MENA): desigualdade regional. Meta: aguarda as metas da análise do PostHog.
- Séries perdidas no endgame (45% Normal, 58–64% Hard) e títulos Worlds (2 em 28): meta aguarda as metas da análise do PostHog.
- Falência Hard (4/42): aguarda as metas da análise do PostHog.
