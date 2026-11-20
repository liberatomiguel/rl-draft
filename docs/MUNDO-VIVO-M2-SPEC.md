# Mundo vivo M2 — o topo do mundo continua forte (spec, 20/11)

Só spec e medição. Sonda: `src/store/careerWorldTop.probe.test.ts` (`WORLDTOP=1`), com o M1 ligado: 10 carreiras Normal (tuned; NA, EU, SAM, MENA, APAC; 2 seeds; 13 temporadas). Replay como no M1: um time de rating fixo no Worlds real, 100 repetições.

## 1. Por que o topo cai

Top 30 = os 30 melhores jogadores de IA do mundo, ao fim da temporada.

| | S6 | S8 | S10 | S12 |
|---|---|---|---|---|
| Overall médio do top 30 | 94,9 | 93,6 | 92,0 | 91,9 |
| Reais no top 30 | 26,7 | 22,6 | 14,7 | 6,0 |
| Em declínio no top 30 | 15,1 | 20,3 | 17,7 | 8,6 |
| Distância até o próprio teto | 0,9 | 1,7 | 2,3 | 1,7 |
| Potencial médio do top 30 | 94,5 | 93,9 | 92,6 | 92,1 |
| Potencial ≥ 94 / overall ≥ 94 | 43 / 18 | 40 / 13 | 34 / 7 | 26 / 8 |
| Gerados com potencial ≥ 94 (idade; já chegaram) | 6 (18; 0,5) | 9 (18; 1) | 12 (19; 2) | 13 (19; 4,5) |
| Worlds: 1º / 4º / 8º | 98,4 / 95,8 / 93,9 | 97,4 / 95,8 / 93,9 | 95,7 / 94,3 / 92,2 | 95,2 / 94,0 / 92,1 |

| Hipótese | Veredito | Evidência |
|---|---|---|
| Estrelas de IA não chegam ao potencial | **Não** | O top 30 fica a 1–2 pontos do próprio teto; o teto é que cai (94,5 → 92,1). |
| O declínio começa cedo | **Natural** | A geração de 2027 tem 22–24 anos; metade do top 30 declina em S7–S10. A curva (`CAREER_DEV.declinePerYear`) é realista. Não mexer. |
| O topo não concentra talento | **Pesa pouco** | Juntar os 3 melhores da região na org mais forte rende +0,2 a +0,5. O mercado só compra de orgs mais fracas (`market.ts:562`). |
| Elencos de 2027 sem sucessores | **Causa raiz** | Os novatos de S0–S5 têm teto 88 (`balance.ts:3710`, `development.ts:863`); só ~0,9 % viram elite. É a geração do auge em S8–S12. Quem entra do S6 em diante tem a pirâmide inteira, mas chega com 13–16 anos e só alcança o topo depois do S12. |

**Há um buraco de geração entre S7 e S13.**

## 2. Alavancas

### (a) O mundo cresce: renovação de elite (necessária)

- **O jogador vê:** notícias como "prodígio X (EU) desponta" e jovens de IA que viram estrelas em 1–2 temporadas. O Worlds do S12 parece o do S6.
- **Regra:**
  - **Base:** na virada para o S6, o jogo conta a elite de IA ativa de cada região (potencial ≥ 94, fora do declínio). Cada região guarda o seu número, então as diferenças naturais continuam.
  - **Renovação:** a cada virada, se a região estiver abaixo da base, até 2 jovens dela (≤ 20 anos, potencial ≥ 85, contratados primeiro) ganham potencial novo, sorteado nos pesos 93–98 do `eliteProspect`. Eles crescem no ritmo normal.
  - Os jogadores do usuário não contam.
- **`balance.ts`:** `CAREER_WORLD_LIFE.eliteRenewal = { fromSeasonIndex: 6, potentialMin: 94, maxAge: 20, candidateMinPotential: 85, perRegionPerSeason: 2 }`. **Save:** `world.eliteBaseline?` e `world.potentialLift?`, opcionais.
- **Riscos:** exagero (a base trava: nunca acima da elite do S6); atraso (S7–S8 ainda caem 0,5–1); o usuário comprar os prodígios (a base se recompõe na virada).

### (b) Supertimes (opcional depois de (a))

- **O jogador vê:** "Org Y monta supertime". Gatilho do `CAREER_DYNASTY` (R106): o usuário ganha 2 Worlds em 3 temporadas, e 1 rival da região reage.
- **Regra:** na pré-temporada, essa org pode fazer até 2 compras de orgs mais fortes ou de jogadores acima da média + 6, pagando a taxa normal.
- **`balance.ts`:** `superteam: { titles: 2, windowSeasons: 3, orgs: 1, buysPerWindow: 2 }`. **Save:** `org.superteamSince?`.
- **Efeito:** +0,2 a +0,5 para o rival. Um time 97 perde de 1 a 7 pontos de título hoje e de 1 a 2 com (a). Pesa mais nas metas 3 e 6. **Risco:** baixo.

### (c) Assédio às suas estrelas (opcional)

- **Já existe:** propostas recusáveis (`incomingBidForDay`). Recusar uma Blockbuster encarece a renovação em ×1,1.
- **M2:** o supertime faz 1 Blockbuster por temporada pela sua melhor estrela. Recusar encarece a renovação em ×1,25 (`superteamRefusalRenewalMult`). O motor não tem sistema de moral (P5).
- **Efeito:** quase nenhum na dificuldade (o dinheiro sobra depois do T8); vale para a economia (meta 8) e a história. **Save:** o `blockbusterRefusedUntil` atual.

### (d) Contra-estilo (depois do Matchday fatia 3)

- **Regra:** os 4 primeiros cabeças de chave de Major e Worlds escolhem, com chance de 0,5, o estilo que vence o seu, quando o encaixe deles é ≥ 0,5. Fica dentro do `matchupCap` 0,6 e do D3 (±1,2).
- **`balance.ts`:** `counterStyle: { seeds: 4, chance: 0.5, minFit: 0.5 }`. **Save:** nenhum.
- **Efeito:** até −0,6 por jogo, só contra quem não se adapta. É habilidade, não dificuldade. Não é necessária para a meta 5.

## 3. Simulação: replay com o topo corrigido

Cada posição do campo recupera 0, 25, 50 ou 100 % da queda desde o S6 da carreira; 100 % = (a) completo.

**% de título no Worlds, Normal, média de S10 a S12**

| Time do usuário | Hoje | 25 % | 50 % | (a) completo | (a) + (b) |
|---|---|---|---|---|---|
| 95 | 13,6 | 6,8 | 2,4 | 0,1 | 0,1 |
| 97 | 51,3 | 37,7 | 25,5 | 6,6 | 5,4 |
| 99 | 85,0 | 76,0 | 64,8 | 35,4 | 33,9 |
| 101 | 96,3 | 94,6 | 89,0 | 74,0 | 73,0 |

Referência: no S6 de hoje, o time 97 ganha 2,8 % e o time 99 ganha 26,9 %.

- **Meta 5 (≤ 30–35 %):** com (a) completo, vale até um time 99; o 101 ainda ganha 74 %. Os 44 % reais equivalem ao replay de hoje entre 97 e 99; com (a), essa faixa cai para 7–35 %. Com o atraso, o real deve ficar entre as colunas 50 % e 100 %.
- **Metas 3 e 6 (só relato):** Major e Worlds seguem a tabela. Regional e vaga não medidas; o 8º do campo sobe de 92,1 para 93,9 no S12. Medir no staging.
- **Travas duras:**
  - **Séries:** (a), (b) e (c) não tocam na matemática da série (+6 ≥ 98 %, +2 ≥ 73 %); a (d) fica dentro dos limites do Matchday.
  - **Zebras:** o campo mantém o formato do S6 (4,5 pontos do 1º ao 8º), e o time 101 ainda perde 1 Worlds em 4.
  - **S0–S5 e Draft:** tudo começa na virada para o S6 (S4–S6 iguais em todas as colunas); nada fora da carreira.

## 4. Decisões do Miguel (20/11, R141)

1. **Dose:** cheia, a elite do S6 mantida. O número fica no `balance.ts` (`eliteRenewal.baselineShare`) para ajustar depois do staging.
2. **Mecanismo:** renovação controlada por região.
3. **Prodígios:** o usuário pode contratar os promovidos; a região repõe a base na virada seguinte.
4. **Supertimes (b):** M2.2, só se o endgame seguir fácil no staging.
5. **Recusa:** só salário (×1,25) no M2.2; moral fica para a Etapa 3.
6. **Contra-estilo (d):** M2.3, depois da fatia 3.

**Meta nova:** nas temporadas infinitas, o Worlds deve ir de vez em quando para um supertime de fora da Europa (NRG, Spacestation, FURIA, Falcons), como na história. A EU continua em primeiro na média.

## 5. M2.1 implementado (v2.1.0-dev.7, atrás do `FEATURES.worldLife`)

Regra da seção 2 (a), com `maxAge` 21 e potencial sorteado entre 94 e 98. Bateria: 10 carreiras, 16 temporadas, flag OFF contra ON.

**Campo do Worlds: o melhor time**

| | S6 | S9 | S12 | S15 |
|---|---|---|---|---|
| OFF | 98,4 | 96,6 | 95,3 | 97,0 |
| ON | 98,4 | 97,0 | 97,2 | 97,2 |

**% de título no Worlds, Normal, média de S10 a S15**

| Time do usuário | OFF | ON | Campo travado no S6 |
|---|---|---|---|
| 95 | 8,2 | 2,0 | 0,1 |
| 97 | 38,8 | 19,2 | 4,0 |
| 99 | 73,8 | 54,6 | 31,4 |
| 101 | 92,4 | 84,0 | 69,8 |

Meta 5 cumprida para um time forte realista (97–98). Os times de 99 e 101 continuam ganhando com frequência. O topo fica cerca de 1 ponto abaixo do S6, porque os promovidos se espalham por várias orgs. Segurar o S6 exato endureceria demais (99 → 31 %).

**Região do campeão de IA no Worlds, S6–S15**

| | EU | NA | MENA | SAM | Outras |
|---|---|---|---|---|---|
| OFF | 40 % | 16 % | 28 % | 13 % | 3 % |
| ON | 59 % | 21 % | 13 % | 6 % | 1 % |
| História (13 Worlds) | 62 % | 31 % | 8 % | 0 % | 0 % |

Os campeões vieram de replays só com a IA, 100 por temporada; os Worlds reais das carreiras dão o mesmo resultado (ON: EU 60 de 100).

Com o M2.1, 41 % dos títulos vão para fora da Europa, contra 38 % na história. Por isso não entrou uma alavanca extra para as outras regiões. Os 60 % de fora da Europa com a flag OFF eram efeito da decadência: as estrelas antigas da EU caem primeiro.

**Travas:**

- S0–S5 idênticas em OFF e ON.
- 0 soft locks em 20 carreiras.
- Nada mudou no Draft nem na matemática da série.
