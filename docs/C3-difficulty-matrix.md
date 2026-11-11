# C3 — matriz de dificuldade antes/depois

Base rc.45 `473241a`. Todos os times do usuário passam por `buildUserTeam`; o mesmo pool regional é aplicado ao draft e ao torneio. Modos medidos: draft Classic nas quatro dificuldades, incluindo Legacy. Quick não foi medido separadamente. APAC/SSA não são region locks jogáveis.

Referência: `dados-rocket-draft-win-rate.json`, insight Or8u. O anexo fornece taxas diárias, sem denominadores diários de partidas concluídas; portanto não permite reconstruir o win rate agregado ponderado. Alvo operacional = média dos 14 dias completos (13–26/10), excluindo 27/10 parcial: easy 64.2% · normal 34.9% · hard 20.2% · legacy 5.1%. Não são metas de precisão humana.

## Método

120 sessões por célula, 6 torneios por time mantido (720 partidas de torneio por célula), seeds pareadas, resets `0,0,0,1,1,2,3,5,8,12`. População secundária: cada elenco elegível como usuário, 4 torneios por elenco. Heurística de picks idêntica antes/depois; usa overalls mesmo em Hard/Legacy e representa conhecimento, não erros humanos. Multiplicador de especiais por dificuldade = 1/1/2/4. Seleções habilitadas.

Ponderação explícita dos estratos (hipótese, não inferência do anexo):

| Resets | Easy | Normal/Hard/Legacy |
|---|---|---|
| 0 | 0.68 | 0.3 |
| 1 | 0.2 | 0.25 |
| 2 | 0.07 | 0.2 |
| 3 | 0.02 | 0.1 |
| 5 | 0.02 | 0.07 |
| 8 | 0.005 | 0.04 |
| 12 | 0.005 | 0.04 |

Médias de resets: 0,60 Easy, 2,10 demais. “Grinder” = 12 resets; só 12 sessões/72 torneios nesse estrato, bastante ruído. A tabela também mostra o blend uniforme de sessões (3,2 resets médios) para revelar sensibilidade. Legacy não foi afrouxado: a referência anterior registra ~12% para grinders, mas nesta amostra WW chega a 15,3% e OCE a 16,7%. A amostra não permite afirmar um teto universal. Não usar um ajuste que aumente essa facilidade para tentar acertar a média típica. Não prometer equivalência exata entre simulação e humanos.

| Pool/dificuldade | Boost antes→depois | Título ponderado antes→depois | Final ponderada antes→depois | Título blend antes→depois | Grinder antes→depois | População antes→depois |
|---|---|---|---|---|---|---|
| WW/easy | 0.00 → 0.00 | 64.0% → 64.0% | 86.8% → 86.8% | 73.3% → 73.3% | 95.8% → 95.8% | 25.2% → 25.2% |
| WW/normal | 0.00 → 0.00 | 33.5% → 33.5% | 56.9% → 56.9% | 38.1% → 38.1% | 68.1% → 68.1% | 13.9% → 13.9% |
| WW/hard | 0.00 → 0.00 | 25.6% → 25.6% | 44.3% → 44.3% | 28.7% → 28.7% | 52.8% → 52.8% | 12.5% → 12.5% |
| WW/legacy | 0.00 → 0.00 | 1.9% → 1.9% | 6.6% → 6.6% | 3.3% → 3.3% | 15.3% → 15.3% | 2.3% → 2.3% |
| NA/easy | 0.40 → 0.60 | 68.2% → 65.9% | 87.1% → 86.3% | 78.9% → 76.3% | 97.2% → 94.4% | 27.1% → 24.1% |
| NA/normal | 1.15 → 1.15 | 35.3% → 35.3% | 62.4% → 62.4% | 36.7% → 36.7% | 58.3% → 58.3% | 8.9% → 8.9% |
| NA/hard | 2.55 → 2.55 | 21.8% → 21.8% | 42.6% → 42.6% | 22.9% → 22.9% | 50.0% → 50.0% | 6.0% → 6.0% |
| NA/legacy | 2.15 → 2.15 | 2.5% → 2.5% | 9.5% → 9.5% | 2.6% → 2.6% | 5.6% → 5.6% | 0.9% → 0.9% |
| EU/easy | -0.05 → -0.05 | 62.5% → 62.5% | 84.3% → 84.3% | 74.0% → 74.0% | 88.9% → 88.9% | 27.5% → 27.5% |
| EU/normal | 0.45 → 0.45 | 36.2% → 36.2% | 57.4% → 57.4% | 39.2% → 39.2% | 65.3% → 65.3% | 11.4% → 11.4% |
| EU/hard | 0.90 → 1.30 | 25.9% → 19.8% | 45.9% → 39.9% | 27.5% → 22.1% | 56.9% → 44.4% | 10.3% → 8.7% |
| EU/legacy | 1.50 → 1.50 | 2.7% → 2.7% | 8.2% → 8.2% | 2.9% → 2.9% | 6.9% → 6.9% | 1.0% → 1.0% |
| SAM/easy | -1.85 → -1.85 | 63.8% → 63.8% | 88.8% → 88.8% | 74.6% → 74.6% | 88.9% → 88.9% | 28.9% → 28.9% |
| SAM/normal | -0.35 → -0.35 | 33.9% → 33.9% | 63.9% → 63.9% | 38.1% → 38.1% | 62.5% → 62.5% | 12.3% → 12.3% |
| SAM/hard | 1.45 → 1.05 | 18.2% → 20.3% | 42.9% → 51.3% | 22.8% → 24.6% | 50.0% → 45.8% | 7.1% → 5.6% |
| SAM/legacy | 3.95 → 3.95 | 5.2% → 5.2% | 16.9% → 16.9% | 6.3% → 6.3% | 5.6% → 5.6% | 1.7% → 1.7% |
| MENA/easy | -0.55 → -0.15 | 67.7% → 64.0% | 90.9% → 90.9% | 77.4% → 75.8% | 84.7% → 88.9% | 31.9% → 28.4% |
| MENA/normal | 1.45 → 1.45 | 36.1% → 36.1% | 68.1% → 68.1% | 36.3% → 36.3% | 45.8% → 45.8% | 11.2% → 11.2% |
| MENA/hard | 2.90 → 3.50 | 24.1% → 20.5% | 61.1% → 54.0% | 24.6% → 21.0% | 36.1% → 27.8% | 8.6% → 6.9% |
| MENA/legacy | 4.05 → 4.05 | 3.4% → 3.4% | 23.2% → 23.2% | 3.6% → 3.6% | 8.3% → 8.3% | 0.0% → 0.0% |
| OCE/easy | 0.25 → 0.25 | 64.4% → 64.4% | 82.0% → 82.0% | 76.4% → 76.4% | 97.2% → 97.2% | 31.4% → 31.4% |
| OCE/normal | 1.35 → 1.35 | 34.3% → 34.3% | 54.3% → 54.3% | 39.3% → 39.3% | 73.6% → 73.6% | 12.2% → 12.2% |
| OCE/hard | 3.50 → 3.50 | 19.7% → 19.7% | 36.0% → 36.0% | 23.5% → 23.5% | 59.7% → 59.7% | 4.8% → 4.8% |
| OCE/legacy | 5.35 → 5.35 | 2.9% → 2.9% | 6.1% → 6.1% | 4.2% → 4.2% | 16.7% → 16.7% | 0.5% → 0.5% |

## Reprodução

PowerShell, a partir do worktree; aplicar os boosts antigos para reproduzir o before:

```powershell
$env:SIM_MATRIX="1"
$env:SIM_POOLS="WW,NA,EU,SAM,MENA,OCE"
$env:SIM_SESSIONS="120"
$env:SIM_RESET_SET="0,0,0,1,1,2,3,5,8,12"
$env:SIM_PER="6"
$env:SIM_POP_PER="4"
$env:SIM_OUT="docs/C3-matrix-after.json"
node node_modules/vitest/vitest.mjs run src/engine/difficulty.matrix.test.ts
```

O tuning usou `SIM_SWEEP=-0.4,-0.2,0.2,0.4,0.6`: deltas aditivos ao boost da célula, com drafts em cache e seeds pareadas. Os JSONs antes/depois registram todos os estratos e buckets de overall; o relatório é recalculável com os pesos acima. Incerteza é dominada pelas sessões de draft (não considerar todos os torneios independentes), seleção de candidatos e política do bot; não é uma estimativa de causalidade sobre jogadores.

## Resultado e limites pendentes

Cinco ajustes regionais: Easy NA +0,20 e MENA +0,40; Hard EU +0,40, SAM −0,40 e MENA +0,60. Normal, Legacy e os perfis mundiais ficam iguais. Evitei perseguir diferenças de até 2 pp e candidatos que melhoravam menos de 1 pp. Isso aproxima os cinco desvios regionais mais claros; **não iguala todas as células**. WW Hard permanece em 25,6% (alvo aproximado 20,2%); Legacy típico continua abaixo do proxy em vários pools.

Experimento descartado: Hard global −0,5 → +0,1 aproximava WW Hard (18,8%), mas quebrou 45 replays existentes (5 challenges, 40 dailies). Causa: `DIFFICULTY.hard.opponentRatingShift` também alimenta os bosses/gauntlets e o calendário fixo. Restaurado −0,5; nenhuma solução ou regra de challenge/daily foi relaxada para acomodar o tuning. Isolar um ajuste exclusivo do draft no motor/store requer arquivos fora do escopo desta sessão.

Expansões futuras de elencos/cartas/especiais exigem repetir a matriz e `challenges.solvable.test.ts` + `runStore.challenges.replay.test.ts`, além do calendário diário. Limitar a temporada dos challenges protege contra novos elencos, mas novas especiais ainda podem alterar RNG/ofertas; não existe garantia para dados futuros sem os replays.
