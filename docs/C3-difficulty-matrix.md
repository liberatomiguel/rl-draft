# C3 — main real versus relatório versus staging expandida

Esta revisão substitui a calibração inicial C3 (commit a3a4acf), que não havia executado main e usava pesos de resets escolhidos sem ajuste à base antiga. Não usar as recomendações anteriores como conclusão final.

## Bases realmente executadas

- Main remota: **27c98eb, v1.4.8**. 289 elencos; apenas mundial e SAM disponíveis.
- Staging remota: **6da4bc9, rc.45**. 484 elencos (+195), mundial/SAM/NA/EU/MENA/OCE. A configuração e os JSONs de jogo relevantes são iguais à base claude/rc42-balance 473241a.
- Depois: mesmo motor e dados de staging, com os ajustes C3 finais. Não há patch de dados ou especiais.
- Test harness idêntico copiado para os worktrees isolados main/staging (apenas o teste de cobertura adicional foi excluído por compatibilidade de tipos antigos). SHA-256: AB345BD6E3D43D65C775EF8FFF8FDC3031E0C181146F65273DBF3F29957B30B4. O código do motor/data/balance de cada versão foi executado como está em sua referência. Não transplantamos o motor novo para main.

## Método e referência real

240 sessões por célula, agenda de resets **0,1,2,3,5,8,12,20**, 30 sessões em cada estrato e 6 torneios por time mantido. Seeds pareadas entre versões e candidatos. Equipes reais via buildUserTeam; pool regional tanto no draft quanto no torneio. População secundária: cada elenco elegível usado como usuário em 4 torneios. Draft Classic nas quatro dificuldades; especiais 1/1/2/4; seleções ativadas quando a versão suporta. A heurística de picks é a mesma nas duas versões, incluindo seu conhecimento de overall em dificuldades que escondem números. Quick/challenge/daily não foram usados para ajustar a política do bot.

O anexo tem win rates diários gerais (Or8u), inícios por dificuldade (6KJD) e inícios SAM por dificuldade (OXMR). **Não tem win rates por região, nem denominadores diários de run_completed, nem distribuição de resets por jogador.** Não inventamos nenhum desses dados. OCE no relatório foi integralmente desconsiderado: não há esse region lock na main. A OCE simulada da staging só é comparada ao padrão mundial da main.

Alvo real operacional = média dos 14 dias completos, 13–26/10; 27/10 parcial excluído. A taxa agregada ponderada do período não é reconstruível com o anexo. A main atual é um snapshot; não prova que todas as sessões históricas do relatório usaram exatamente esse commit. O relatório também mistura modos; Classic é uma aproximação explícita para calibração, não uma reprodução individual de jogadores.

## Main sem calibração e ponte com os dados reais

O blend uniforme de resets não reproduz humanos. A tabela mostra isso ANTES do ajuste estatístico:

| Dificuldade | Real (média diária) | Main WW, blend uniforme | Main SAM, blend uniforme | Main mistura calibrada | Main WW calibrada | Main SAM calibrada | Média de resets ajustada |
|---|---|---|---|---|---|---|---|
| easy | 64.2% | 79.9% | 51.3% | 64.2% | 68.5% | 35.3% | 0.94 |
| normal | 34.9% | 47.2% | 28.7% | 34.9% | 35.9% | 19.4% | 2.10 |
| hard | 20.2% | 37.0% | 31.8% | 20.2% | 20.3% | 19.0% | 1.48 |
| legacy | 5.1% | 7.8% | 6.1% | 5.1% | 5.3% | 4.4% | 3.20 |

Para cada dificuldade, ajustamos **um único parâmetro lambda**, usando SOMENTE main e o anexo: pesos dos oito estratos proporcionais a exp(−lambda × resets). A mistura WW/SAM usa, como proxy, a média da fração SAM de run_started por dificuldade em cada um dos 14 dias. Escolhemos lambda em −0,5…8, passo 0,001, minimizando a diferença entre a mistura de títulos main e o alvo real. Os valores e pesos completos estão em C3-calibration.json. Não usamos OCE e não ajustamos os pesos novamente na staging.

**A concordância da mistura main com o relatório é um resultado do ajuste, não uma validação independente do modelo.** Os resets ajustados não são resets observados. Há diversas políticas de bot/humanos capazes de explicar a mesma média. SAM inícios não equivale necessariamente a SAM partidas concluídas; por isso as taxas regionais humanas não são identificáveis. O teste útil é transferir a política congelada para staging e medir o desvio.

Para preservar a experiência mundial antiga e normalizar os novos regionais, o alvo simulado de cada região é **main WW sob os pesos ajustados**, não a mistura humana WW+SAM tratada como se fosse uma medição mundial. Por isso Easy tem alvo simulado WW 68,5% embora a referência real misturada seja 64,2%.

## Main → staging → C3: efeito realmente medido

“Grinder” = média dos estratos de 12 e 20 resets, 60 sessões/360 torneios por célula. A comparação é pareada, mas versões com pools diferentes consomem RNG de forma diferente; ela não isola somente os +195 elencos: também inclui regras, especiais, seleções e boosts da versão.

| Pool/dificuldade | Main mesmo pool: título | Alvo main WW: título | Staging: título | C3: título | Desvio staging→C3 contra WW main | Final staging→C3 | Grinder main WW / staging / C3 |
|---|---|---|---|---|---|---|---|
| WW/easy | 68.5% | 68.5% | 64.7% | 70.2% | -3.8 pp → 1.7 pp | 86.5% → 89.5% | 90.6% / 93.3% / 92.2% |
| WW/normal | 35.9% | 35.9% | 35.4% | 35.4% | -0.5 pp → -0.5 pp | 58.1% → 58.1% | 67.8% / 65.8% / 65.8% |
| WW/hard | 20.3% | 20.3% | 20.7% | 20.7% | 0.4 pp → 0.4 pp | 40.4% → 40.4% | 58.6% / 59.4% / 59.4% |
| WW/legacy | 5.3% | 5.3% | 3.9% | 3.9% | -1.4 pp → -1.4 pp | 10.3% → 10.3% | 13.9% / 15.3% / 15.3% |
| SAM/easy | 35.3% | 68.5% | 63.9% | 67.9% | -4.6 pp → -0.6 pp | 88.0% → 87.9% | 90.6% / 95.0% / 94.7% |
| SAM/normal | 19.4% | 35.9% | 33.6% | 35.5% | -2.3 pp → -0.4 pp | 62.7% → 65.0% | 67.8% / 70.6% / 70.6% |
| SAM/hard | 19.0% | 20.3% | 19.0% | 19.0% | -1.3 pp → -1.3 pp | 44.9% → 44.9% | 58.6% / 49.4% / 49.4% |
| SAM/legacy | 4.4% | 5.3% | 5.7% | 5.7% | 0.5 pp → 0.5 pp | 22.0% → 22.0% | 13.9% / 9.7% / 9.7% |
| NA/easy | não existia | 68.5% | 67.1% | 67.1% | -1.5 pp → -1.5 pp | 82.6% → 82.6% | 90.6% / 90.6% / 90.6% |
| NA/normal | não existia | 35.9% | 36.3% | 36.3% | 0.4 pp → 0.4 pp | 60.2% → 60.2% | 67.8% / 57.8% / 57.8% |
| NA/hard | não existia | 20.3% | 18.7% | 18.7% | -1.6 pp → -1.6 pp | 38.7% → 38.7% | 58.6% / 45.0% / 45.0% |
| NA/legacy | não existia | 5.3% | 3.5% | 3.5% | -1.7 pp → -1.7 pp | 11.7% → 11.7% | 13.9% / 8.6% / 8.6% |
| EU/easy | não existia | 68.5% | 71.0% | 69.9% | 2.4 pp → 1.4 pp | 88.8% → 88.0% | 90.6% / 90.8% / 89.2% |
| EU/normal | não existia | 35.9% | 38.1% | 38.1% | 2.2 pp → 2.2 pp | 61.5% → 61.5% | 67.8% / 67.2% / 67.2% |
| EU/hard | não existia | 20.3% | 23.0% | 19.6% | 2.6 pp → -0.7 pp | 42.7% → 41.4% | 58.6% / 52.8% / 49.7% |
| EU/legacy | não existia | 5.3% | 4.1% | 4.1% | -1.2 pp → -1.2 pp | 11.5% → 11.5% | 13.9% / 9.7% / 9.7% |
| MENA/easy | não existia | 68.5% | 69.0% | 69.0% | 0.5 pp → 0.5 pp | 92.7% → 92.7% | 90.6% / 90.8% / 90.8% |
| MENA/normal | não existia | 35.9% | 34.0% | 34.0% | -1.9 pp → -1.9 pp | 71.8% → 71.8% | 67.8% / 59.7% / 59.7% |
| MENA/hard | não existia | 20.3% | 20.4% | 20.4% | 0.0 pp → 0.0 pp | 58.1% → 58.1% | 58.6% / 43.6% / 43.6% |
| MENA/legacy | não existia | 5.3% | 4.8% | 4.8% | -0.5 pp → -0.5 pp | 26.7% → 26.7% | 13.9% / 13.6% / 13.6% |
| OCE/easy | não existia | 68.5% | 64.7% | 68.3% | -3.8 pp → -0.2 pp | 81.6% → 84.5% | 90.6% / 93.9% / 96.9% |
| OCE/normal | não existia | 35.9% | 36.9% | 36.9% | 1.0 pp → 1.0 pp | 59.2% → 59.2% | 67.8% / 70.3% / 70.3% |
| OCE/hard | não existia | 20.3% | 21.6% | 21.6% | 1.3 pp → 1.3 pp | 37.7% → 37.7% | 58.6% / 56.4% / 56.4% |
| OCE/legacy | não existia | 5.3% | 5.5% | 5.5% | 0.2 pp → 0.2 pp | 12.2% → 12.2% | 13.9% / 11.7% / 11.7% |

### Ponte de transferência para a referência real

Taxas do bot não são taxas humanas observadas. Uma leitura operacional do desvio é **referência real + (C3 simulado − main WW simulada)**. Essa projeção aditiva preserva o nível do relatório quando a nova curva iguala a curva main; é uma hipótese de transferência, não uma previsão validada em jogadores. A composição de modos/regiões pode mudar após o lançamento.

| Dificuldade WW | Referência real | Main simulada ajustada | Staging simulada ajustada | C3 simulada ajustada | Referência + desvio C3/main (proxy) |
|---|---|---|---|---|---|
| easy | 64.2% | 68.5% | 64.7% | 70.2% | 65.9% |
| normal | 34.9% | 35.9% | 35.4% | 35.4% | 34.4% |
| hard | 20.2% | 20.3% | 20.7% | 20.7% | 20.6% |
| legacy | 5.1% | 5.3% | 3.9% | 3.9% | 3.8% |

### Por que mais elencos não viram automaticamente muito mais vitórias

Os dados realmente mudaram, mas a staging já trouxe ajustes compensatórios anteriores: o shift mundial Normal passou de −1,30 (main) para −1,05; Hard de −0,70 para −0,50; Legacy de +1,30 para +1,60. A expansão também muda o campo adversário, a seleção ponderada e a oferta, não só a força do time usuário. Não atribuir causalidade a uma única dessas mudanças sem um experimento separado.

No blend uniforme de resets, o overall médio dos times mantidos pelo bot mudou assim:

| Dificuldade WW | Main: overall médio | Staging: overall médio |
|---|---|---|
| easy | 94.44 | 94.41 |
| normal | 94.17 | 94.30 |
| hard | 93.54 | 93.87 |
| legacy | 94.22 | 94.46 |

## Boosts e decisões

Boost extra regional e shift total (perfil global + extra). Compensações em NA/MENA Easy mantêm o efeito total anterior apesar da mudança mundial.

| Célula | Extra staging → C3 | Shift total staging → C3 |
|---|---|---|
| WW/easy | 0.00 → 0.00 | -2.00 → -2.40 |
| SAM/easy | -1.85 → -1.85 | -3.85 → -4.25 |
| SAM/normal | -0.35 → -0.55 | -1.40 → -1.60 |
| NA/easy | 0.40 → 0.80 | -1.60 → -1.60 |
| EU/easy | -0.05 → 0.55 | -2.05 → -1.85 |
| EU/hard | 0.90 → 1.10 | 0.40 → 0.60 |
| MENA/easy | -0.55 → -0.15 | -2.55 → -2.55 |
| OCE/easy | 0.25 → 0.45 | -1.75 → -1.95 |

Apenas o perfil global Easy foi facilitado em 0,4; Normal/Hard/Legacy ficam intactos. Normal/Hard mundial estão próximos da main calibrada e não precisam do endurecimento sugerido inicialmente. Legacy mantém as configurações: desvio típico pequeno (com amostra finita) e a curva com muitos resets também foi comparada à main, em vez de impor um teto humano inventado. Candidatos com desvio inicial ≤2 pp ou melhoria <1 pp não justificam tuning. Esses limiares são julgamento de engenharia, não intervalos estatísticos de confiança.

**WW Easy concluído:** o sweep indicou −0,4 no perfil mundial (−2,0 → −2,4), levando a curva calibrada de 64,7% para ~70,2%, contra 68,5% na main. Os extras regionais compensam primeiro essa mudança e depois aplicam o ajuste próprio de cada pool. Os caminhos antigos de ch-old-guard e ch-gauntlet-rookie-road perderam estrelas, mas encontramos NOVOS caminhos legais, na mesma seed e sob as mesmas regras. Foram renovadas somente as ações desses dois testes; nenhuma expectativa de três estrelas, condição, recompensa ou definição de challenge foi afrouxada. Prova final: os 459 testes de soluções engine/store e calendário diário passaram, incluindo as 135 estrelas e 365 dailies. A busca encontrou uma solução completa em 160 políticas para Old Guard e 55 para Rookie Road; isso prova possibilidade, não mede dificuldade humana. Os passos estão em C3-challenge-solutions.md.

## Reprodução e expansão futura

Em cada worktree, usar o mesmo difficulty.matrix.test.ts (sem o teste adicional de cobertura no snapshot main) e apenas o node_modules junction compartilhado. Rodar SIM_MATRIX=1, SIM_SESSIONS=240, SIM_RESET_SET=0,1,2,3,5,8,12,20, SIM_PER=6, SIM_POP_PER=4 e SIM_POOLS=WW,SAM na main / WW,SAM,NA,EU,MENA,OCE na staging. SIM_SWEEP=-0.4,-0.2,0.2,0.4 mede deltas aditivos ao boost da staging, com cache de drafts. Não copiar os boosts regionais novos para main: o harness compatível lê o formato plano da main e o formato por região da staging.

JSONs completos: C3-main-matrix.json (main), C3-matrix-before.json (staging), C3-matrix-after.json (final). C3-calibration.json contém pesos e resumo de todos os candidatos. A auditoria Legacy está em C3-legacy-audit.md. Repetir matriz e replays depois da última inclusão de cartas/especiais/elencos: não há garantia sobre dados ainda não incluídos.
