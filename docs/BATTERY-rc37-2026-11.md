# Bateria rc.37 — resultados (06/11/2026)

Fonte: `C:\Users\Miguel\CLAUDE\rc37-battery\run1` (JSONL por shard) · relatório completo gerado por
`src/store/auditHumanSummaryReport.mjs` em `C:\Users\Miguel\CLAUDE\rc37-battery\report\rc37.md` (+ `.json`,
`-cells.csv` com 2.457 linhas por célula). Revisão `0d92803`, balance v14, simulationHash `5cfa4fcf9934`.
Nada aqui é patch: são medições e recomendações para a F6.

## 1. Cobertura executada

- **4.914 / 4.914 unidades** (A 882 · B 882 · C 1.575 · D 1.575), 0 softlocks, 0 erros, 0 linhas parciais.
  4 shards, 20h47–21h48 cada (23h09 de 05/11 → 20h57 de 06/11).
- Grade: 7 regiões × 3 dificuldades × 3 elencos × 39 perfis distintos (14 base + 25 de um fator;
  `style-consistency` e `briefing-adaptive` ≡ `coachUpgrades`) × 2 seeds (9100, 17019), horizonte S10.
- Pares de Worlds (+0,5 / +1 nos oponentes, só no Worlds, via spy, sem patch): 975 de 1.764 unidades A/B
  expostas (easy 77%, normal 53%, hard 36%); 1.578 braços não expostos são cópias do controle.
- Extensão S11–S20: 155 de 155 controles do tier A campeões até S10.
- Temporadas simuladas: 48.206 controles + 13.327 pós-fork + 1.535 endless.
- **Limitações:** bot ≠ humano (decisões por perfil, sem leitura de tela); 2 seeds por célula (n = 28 por
  célula de perfis base, leitura indicativa); a extensão S20 só cobre campeões (viés pró-sucesso); a
  baseline 04/11 é rc.36.10 com 315 pares; marcos da baseline têm precisão de temporada.

## 2. Funil competitivo (perfis base, n = 1.764)

| Marco | Easy | Normal | Hard | Alvo |
|---|---|---|---|---|
| Regional até o split 2 | 87% | 77% | 72% | < 50% |
| Regional já no split 1 | 71% | 51% | 36% | raro |
| Major até S10 (mediana incondicional) | 80% (S4) | 55% (S9) | 40% (>S10) | S4–5 |
| Worlds até S10 (mediana incondicional) | 77% (S4) | 53% (S9) | 36% (>S10) | S6–7 |
| Título do Worlds até S10 (mediana) | 39% (>S10) | 10% (>S10) | 6% (>S10) | S7–8 |
| Título do Worlds até S8 | 27% | 5% | 1% | ~50% |

- **Bimodal:** quem chega ao Major/Worlds chega cedo (p50 entre quem alcançou = S3); quem não chega até
  S4–5 quase nunca chega. Não há a "rampa" S3 → S5 → S7 do alvo.
- **Regiões (todas as 4.914 carreiras, até S10):**

| Região | Worlds | Título |
|---|---|---|
| SSA | 93% | 18% |
| APAC | 87% | 20% |
| OCE | 61% | 17% |
| MENA | 34% | 13% |
| SAM | 26% | 10% |
| NA | 19% | 10% |
| EU | 6% | 3% |

- **Perfis dominantes:** `academy` (título do Worlds 95 / 67 / 48% em easy / normal / hard; caixa S10 p50
  1,8M / 1,5M / 1,1M; 0% de insolvência) e `prospectsOnly` (93 / 62 / 33%; 1,3M / 0,9M / 0,7M). Todos os
  outros perfis base têm 0–2% de títulos no Normal e no Hard.
- **Decisões isoladas (C/D vs `coachUpgrades`, 126 pares cada):** todas ficam em ±5 pp; só `plan-base`
  perde de forma clara (Worlds −10 pp, título −5 pp). Preleções: `briefing-keep` ≡ `briefing-none`
  (idênticos); `prepare` / `recover` ±2 pp.

## 3. Falhas e finanças

- **Insolvência (base):** 10% (easy 2%, normal 7%, hard 21%); um fator 1%. Causas: breach 89, deadline 85.
  Temporada p50 da quebra: S5. Imprudentes: `novice` 58%, `ambitious` 27%, `buyAll` 24%.
  Prudentes (`academy`, `known`, `experienced`): 0%.
- **Por elenco (todas):** easy 1% · normal 2–3% · hard 8–11% (prospects o mais alto).
- **Crise (base):** 63% ficam negativos alguma vez, 82% se recuperam; ≤ −4 semanas 40%, ≤ −8 semanas 17%.
  Crédito oferecido e tomado em 89% das carreiras (principal p50 177k); venda emergencial aceita em 39%.
  39 registros com saldo mínimo abaixo de −1M.
- **Caixa (base):** S1 p50 5,5k · S2 13,5k · S3 16k · S10 229k (p90 1,16M). Temporadas dominantes p50 751k
  (p90 1,87M). Cobre a taxa de um 90+: 17% das temporadas; estrela contratada em S6–S10: 38%.

## 4. Endgame

- **S6–S10, folha ÷ receita p50:** easy 0,65 · normal 0,87 · hard 1,02 (52% das temporadas no vermelho).
- **S11–S20 (campeões):** a folha p50 sobe de 2,0M para 6,1M; a receita sobe de 2,6M para 7,6M
  (razão p50 0,74). 95% voltam a ser campeões, 2 de 155 quebram e o caixa S20 p50 é de 4,0M.
  A extensão é fácil demais para quem já venceu.
- **Mercado:** o pedido de um 90+ por split passa de 108k (S2) para 525k (S10) e 1,55M (S20); a taxa do
  90+ passa de 1,7M (S10) para 5,1M (S20). A folha própria passa de 8× para ~40× o pedido mediano.
- **Prêmio do campeão do Worlds:** 742k (S9–10) → 1,28M (S11–15) → 2,6M (S16–20). Hoje é ~43% da folha S20.

## 5. Pares de Worlds

| Braço | Títulos | ≥1 título até S10 | Rank médio | Caixa S10 p50 |
|---|---|---|---|---|
| controle | 725 | 33% | 7,14 | 547k |
| +0,5 | 584 (−19%) | 28% | 7,51 | 530k |
| +1 | 424 (−42%) | 20% | 8,01 | 502k |

Por dificuldade, entre os expostos: easy 50 → 44 → 33% · normal 19 → 17 → 10% · hard 17 → 12 → 7%.
O +0,5 é suave; o +1 corta quase metade dos títulos. O impacto no caixa é pequeno.

## 6. Química, renovações, reputação, compras

- **Química:** um trio sem país/região em comum fica em **exatamente 67% em 100%** das temporadas com
  posse ≥ 2 splits (S1–S10 e S11–S20). O tempo juntos não muda nada (posse 2–4, 4–8 e 8+ splits têm a
  mesma p50). Confirma o feedback "67% depois de 4 anos".
- **Renovações (13.393 em S1–S10):** a razão entre o novo salário e o pedido de mercado tem p50 de 0,61;
  59% saem ≥ 25% abaixo do mercado. Quando o teto de salto manda (`bound jump`, 43%), a p50 é 0,25 do
  mercado. Em S11–S20, nesse mesmo caso, a p50 é 0,11 e 47% ficam ≤ 10% do mercado. Confirma "renovação barata".
- **Reputação:** o teto de 100 é atingido cedo. 98% dos títulos de Major e 94% dos de Worlds rendem 0
  de rep; 16% dos resultados de Worlds têm Δrep negativo (até −7, inclusive campeões, a verificar).
  Os 214.507 qualifiers são todos `swiss_exit` (o formato não distingue quem avançou). Swiss 3-0 = +2,6.
- **Compras (marginal após caps):** perfCenter +2,7 de rating (51% das carreiras); bootcamp +1,3–1,5;
  coach +0,7 (comprado em 100% das carreiras, ~1k cada, nunca envelhece nem sai); PCs +0,6.
  A **psicóloga** dá +3 de clutch e +3 de consistência, mas **0 de rating** em 609k amostras: o rating
  ignora esses atributos.
- **Preleções:** 37–40% dos pedidos em Major/Worlds viram outra preleção efetiva (sem coach não há
  preleção); efeito no funil ±2 pp.

## 7. Comparação com a baseline 04/11 (315 pares)

Título do Worlds 26 → 24%, Major 68 → 65%, insolvência 9 → 7%, caixa final p50 234k → 292k.
`academy` ficou ainda mais forte (título do Worlds +10 pp); `learner` caiu (−13 pp).
O rc.37 deixou o jogo levemente mais difícil e mais estável financeiramente, sem mudar a forma do funil.

## 8. Feedback do staging × dados

| Feedback | Veredito | Dado |
|---|---|---|
| Renovação barata | **confirmado** | p50 0,61 do mercado; 0,25 quando o teto de salto manda; 0,11 em S11–20 |
| Salários inflam na endless | **confirmado** | folha ×3 em 10 temporadas; pedido do 90+ ×3,4 |
| Prêmio baixo no endgame | **parcial** | prêmio do Worlds ~43% da folha S20, mas o patrocínio fecha a conta (razão 0,74) |
| Coaches reais / troca | **apoiado** | coach comprado em 100% das carreiras, barato e eterno |
| Química travada em 67% | **confirmado** | 100% das temporadas sem país/região comum |
| Mais compras com reputação | **apoiado** | rep no teto cedo: títulos rendem 0 |
| Vários patrocínios na endless | neutro | o caixa dos campeões já sobra (p50 4M) |
| Histórico de campeões | fora do escopo | não há dado de campeões no dataset |

## 9. Recomendações para a F6 (não aplicadas)

1. **Desenvolvimento de jovens dominante** (`academy` / `prospectsOnly`) + renovação barata — mesma raiz:
   o jovem cresce e é renovado pelo teto de salto sobre o salário antigo. Proposta: piso de renovação
   atrelado ao pedido de mercado (ex.: ≥ 60–70% do `freshAsk`) e revisar a curva/teto de crescimento dos
   prospects. Meta: título do Worlds no Normal ≤ 30% para esses perfis, sem quebrar a progressão deles.
2. **Desequilíbrio regional:** revisar vagas de Worlds × força dos rivais por região. Meta: Worlds até S10
   entre ~25% e 60% em todas as regiões no Normal (hoje 6–93%).
3. **Rampa de início:** Regional cedo demais (51% já no split 1 no Normal) e funil bimodal. Endurecer os
   Regionais de S1–S2 e suavizar a evolução S3–S6 para levar a mediana do Major a S4–5 e a do Worlds a
   S6–7 no Normal; título no Normal hoje é 10% até S10 (alvo: mediana S7–8 para quem joga bem).
4. **Endless:** campeões revencem 95%. Aqui o Worlds mais difícil faz sentido: +0,5 pós-título ou no
   endless (no Normal/Hard antes do título, não). Conter o crescimento salarial (`moneyIndex` sem teto) e
   subir o prêmio tardio, sem deixar a conta fácil.
5. **Química por convivência:** a posse precisa contar (jogos, scrims, tempo juntos), ex.
   `connMaxPerPair` 4 → 6 com crescimento por splits juntos.
6. **Reputação:** critérios por patamar (o que rende rep muda conforme a rep sobe) e investigar os Δrep
   negativos no Worlds.
7. **Itens sem efeito:** a psicóloga não mexe no rating; as preleções quase não mexem no funil;
   `briefing-keep` ≡ `none`. Corrigir ou simplificar.
8. **Manter:** a escada de dificuldade, as alavancas de crise (crédito, venda emergencial com a trava de
   revenda) e as taxas de falência (algumas, com recuperação possível).

Depois da F6: rerodar só os tiers A + B (~11 h) para validar, e então playtest no staging.
