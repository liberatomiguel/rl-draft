# Rocket Draft rc.37: relatório completo da bateria de carreiras

**Data:** 06/11/2026 · **Base medida:** `claude/rc37-integration` (revisão `0d92803`, BALANCE_VERSION 14,
simulationHash `5cfa4fcf9934`) · **Carreiras:** 4.914 de 4.914, 0 erros, 0 travamentos.
Neste branch, `docs/battery-rc37/` traz este relatório, as tabelas geradas (`rc37-tabelas.md`) e os dados por
célula (`rc37-cells.csv`). Os dados brutos ficam em `C:\Users\Miguel\CLAUDE\rc37-battery\run1`; o JSON
completo, em `...\report\rc37.json`.

> Nada aqui foi aplicado ao jogo. São medições, conclusões e propostas para a F6. Cada proposta técnica traz o valor
> atual, o valor sugerido, o efeito esperado e como validar.

---

## Parte 0: resumo em uma página

**O que está bom**
- A **escada de dificuldade** funciona: Easy → Normal → Hard corta as chances de forma clara e progressiva.
- As **finanças** estão no ponto: há falências (2% no Easy, 7% no Normal, 21% no Hard, quase sempre de
  jogadores imprudentes), e 82% de quem fica no vermelho se recupera. O crédito e a venda de emergência
  funcionam como rede de segurança, sem virar truque.
- **Não existe decisão de treino "roubada"**: estilos, planos, scrims e preleções ficam todos parecidos.

**Os 8 problemas, do maior ao menor**
1. **Apostar em jovens é o único caminho real para títulos.** Comprar adolescentes de potencial alto e
   desenvolvê-los dá 61–93% de título do Worlds no Normal. Os outros estilos ficam em 0–3%. A renovação
   barata faz parte da causa: um jovem que virou craque é renovado por uma fração do preço de mercado.
2. **A região escolhida decide a carreira.** No Normal, quem começa na África ou na Ásia vai ao Worlds em
   94–100% das carreiras, muitas vezes já na 1ª temporada. Na Europa, só 4% chegam até a S10.
3. **A progressão não tem rampa.** O Regional chega cedo demais (metade das carreiras no 1º split), e depois
   o funil se divide: ou o time decola até a S3–4, ou quase nunca decola. No Normal, só 10% são campeões
   até a S10.
4. **A fase endless é fácil para quem já venceu.** 95% dos campeões voltam a vencer entre a S11 e a S20 e
   terminam com ~$4M em caixa.
5. **Química travada em 67%.** Um trio sem país ou região em comum nunca passa disso, mesmo depois de anos
   jogando junto.
6. **A reputação satura.** Ela bate 100 cedo, e daí em diante títulos rendem zero. Nada se desbloqueia
   acima de 80.
7. **Itens e escolhas que não mudam nada.** A psicóloga não altera o rating, e as preleções quase não mudam
   resultados.
8. **O coach nunca precisa ser trocado.** Ele é comprado barato no começo, nunca envelhece e o salário nunca
   muda.

**O que fazer primeiro (F6):** piso de renovação ligado ao preço de mercado e crescimento dos jovens um
pouco menor (1); força dos rivais por região (2); rivais mais duros na S1–S2 e caminho mais suave na S3–S6
(3); depois a endless, a química e a reputação.

---

## Parte 1: o que foi feito

### 1.1 Integração rc.37
- Entraram, sobre o staging rc.36.15 (`c680a89`), as frentes F1 (mercado), F2 (finanças), F3 (dia de jogo)
  e F4a (ferramenta da bateria). O contrato F5 (replay) entrou só como documento. Nada que estava no
  staging se perdeu.
- A venda de emergência (F2) passou a respeitar a trava de revenda da F1 e usa a mesma avaliação de valor
  (decisão R99). Um teste dedicado cobre isso (`careerRc37Integration.test.ts`).
- O bot passou a usar as opções novas conforme o perfil: oferta de crédito ("aceita", "último recurso",
  "nunca"), venda de emergência ("aceita", "só se apertado", "recusa") e preleções adaptativas.
- Gates: typecheck e lint limpos, **1.630 testes passando** (24 pulados), BALANCE_VERSION 14.

### 1.2 Desenho da bateria

| Bloco | Perfis | Seed | Extras | Carreiras |
|---|---|---|---|---|
| A | 14 perfis base | 9100 | Worlds com rivais +0,5 e +1 a partir do 1º Worlds; extensão até a S20 para campeões | 882 |
| B | 14 perfis base | 17019 | Worlds com rivais +0,5 e +1 | 882 |
| C | 25 perfis de um fator | 9100 | só a carreira até a S10 | 1.575 |
| D | 25 perfis de um fator | 17019 | só a carreira até a S10 | 1.575 |

- Cada perfil joga as **63 situações**: 7 regiões × 3 dificuldades × 3 elencos (equilibrado, promessas,
  rodados).
- **Perfis base** são estilos completos: prudente, ambicioso, novato, comprador compulsivo, academia, só
  promessas, estrelas, negociante, entre outros. **Perfis de um fator** são um jogador padrão
  (`coachUpgrades`) com uma única decisão trocada: estilo, plano, carga, foco, scrim ou preleção.
- O teste de "Worlds mais difícil" copia a carreira na manhã do primeiro Worlds e a joga de novo, com os
  rivais do Worlds 0,5 ou 1 ponto mais fortes. Isso foi feito por spy, sem patch no jogo. Mesma sorte,
  mesmo passado: só o Worlds muda.
- Volume: 48.206 temporadas de controle, 13.327 de pares e 1.535 de extensão. 4 processos, ~21–22 h cada.

### 1.3 Limitações
- O bot não é um humano: ele decide por regras de perfil. Os números mostram o que o jogo *permite*, não
  exatamente o que um jogador médio faria.
- Cada célula de perfil base tem 28 carreiras (2 seeds × 14 perfis): a leitura por célula é indicativa.
- A extensão S11–S20 só cobre campeões (155 carreiras), então o endgame de quem não venceu tem menos dado
  (só até a S10).
- A baseline de 04/11 (rc.36.10) tem 315 pares. A precisão dos marcos nela é por temporada.

---

## Parte 2: funil competitivo

### 2.1 Marcos até a S10 (perfis base, 588 carreiras por dificuldade)

"Mediana" = temporada em que metade de **todas** as carreiras já chegou (">S10" = menos da metade chegou).

| Marco | Easy | Normal | Hard | Alvo do Miguel |
|---|---|---|---|---|
| Regional no 1º split | 71% | 51% | 36% | normalmente não |
| Regional até o 2º split | 87% | 77% | 72% | < 50% |
| Presença em Regional na S3 (splits de 3) | 2,6 | 2,4 | 2,1 | constante (≥ 2) |
| Título qualquer até a S2 | 77% | 66% | 53% | poucos |
| Título Regional+ até a S2 | 34% | 25% | 18% | ≤ 20% |
| Major até a S5 / S10 | 65% / 80% | 42% / 55% | 28% / 40% | mediana S4–5 |
| Mediana do Major | S4 | S9 | >S10 | S4–5 |
| Worlds até a S7 / S10 | 67% / 77% | 45% / 53% | 28% / 36% | mediana S6–7 |
| Mediana do Worlds | S4 | S9 | >S10 | S6–7 |
| Título do Major até a S10 | 51% | 13% | 9% | n/a |
| Título do Worlds até a S8 / S10 | 27% / 39% | 5% / 10% | 1% / 6% | mediana S7–8 |

**Leitura simples:**
- No **Easy**, o caminho até o Worlds está até rápido demais (mediana na S4), e o título chega para 39%.
- No **Normal**, metade nunca chega ao Major nem ao Worlds até a S10, e o título é raro (10%).
- **Funil bimodal:** entre quem chega, a mediana de chegada é a S3 em todas as dificuldades. O jogo não tem a
  rampa S3 → S5 → S7: ou a carreira decola cedo, ou empaca.

### 2.2 Regiões

Todas as carreiras S10 (234 por região × dificuldade), na ordem Major / Worlds (temporada mediana entre quem
chegou) / título / falência:

| Região | Vagas no Worlds | Easy | Normal | Hard |
|---|---|---|---|---|
| SSA | 1 | 100 / 100 (S1) / 47 / 0 | 100 / 100 (S1) / 6 / 0 | 89 / 79 (S1) / 2 / 3 |
| APAC | 1 | 100 / 100 (S1) / 46 / 0 | 96 / 94 (S1) / 9 / 1 | 72 / 68 (S1) / 3 / 4 |
| OCE | 2 | 100 / 100 (S2) / 45 / 0 | 69 / 64 (S4) / 4 / 0 | 21 / 18 (S5) / 3 / 9 |
| MENA | 2 | 85 / 69 (S3) / 32 / 0 | 29 / 26 (S3) / 5 / 2 | 10 / 9 (S7) / 3 / 8 |
| SAM | 2 | 70 / 65 (S3) / 27 / 0 | 12 / 10 (S6) / 3 / 3 | 5 / 5 (S7) / 1 / 12 |
| NA | 4 | 49 / 41 (S5) / 23 / 1 | 9 / 7 (S7) / 2 / 6 | 11 / 10 (S4) / 5 / 11 |
| EU | 4 | 16 / 10 (S7) / 5 / 4 | 5 / 4 (S8) / 2 / 6 | 3 / 3 (S8) / 2 / 19 |

**Leitura simples:** o número de vagas não explica o desequilíbrio. SSA e APAC têm **1 vaga** e mesmo assim
vão ao Worlds quase sempre, já na 1ª temporada. O que manda é a **força dos rivais locais**: nas regiões
fracas o time do jogador é campeão regional logo de cara; na Europa e na América do Norte o campo é forte
demais. Hoje, escolher a região pesa mais que qualquer decisão da carreira.

### 2.3 Perfis base (Easy / Normal / Hard)

| Perfil | O que faz | Major | Worlds | Título Worlds | Falência | Caixa S10 p50 |
|---|---|---|---|---|---|---|
| academy | jovens ≤ 19 de potencial visível ≥ 88, desenvolve e retém | 98 / 98 / 93% | 95 / 95 / 90% | **95 / 67 / 48%** | 0 / 0 / 0% | 1,84M / 1,50M / 1,09M |
| prospectsOnly | só promessas (faixa ≥ 85) | 100 / 79 / 69% | 100 / 76 / 69% | **93 / 62 / 33%** | 0 / 2 / 10% | 1,34M / 0,87M / 0,73M |
| continuous | vende todo split e reforça | 88 / 55 / 43% | 79 / 52 / 36% | 60 / 0 / 0% | 0 / 2 / 2% | 755k / 196k / 148k |
| novice | aceita pedidos, gasta sem reserva | 86 / 60 / 29% | 86 / 57 / 24% | 67 / 2 / 0% | **17 / 57 / 100%** | 562k / 149k / – |
| ambitious | estrelas e progressão cedo | 90 / 64 / 40% | 86 / 60 / 36% | 43 / 0 / 0% | 7 / 12 / **62%** | 546k / 239k / 274k |
| learner | delega, aceita pedidos | 83 / 48 / 36% | 81 / 48 / 36% | 31 / 0 / 0% | 0 / 2 / 17% | 501k / 129k / 172k |
| coachUpgrades | troca de coach quando dá (controle) | 67 / 40 / 29% | 67 / 40 / 21% | 29 / 2 / 0% | 0 / 0 / 5% | 583k / 113k / 66k |
| trader | uma venda planejada por temporada | 79 / 52 / 24% | 76 / 48 / 21% | 26 / 0 / 0% | 0 / 2 / 7% | 426k / 179k / 103k |
| buyAll | compra tudo que desbloqueia | 95 / 67 / 38% | 95 / 64 / 38% | 21 / 0 / 0% | 2 / 10 / **60%** | 550k / 257k / 161k |
| coachFixed | mantém o 1º coach | 71 / 38 / 26% | 69 / 36 / 24% | 21 / 0 / 0% | 0 / 2 / 7% | 504k / 91k / 84k |
| known | só jogadores reais conhecidos | 69 / 33 / 31% | 60 / 33 / 29% | 19 / 2 / 2% | 0 / 0 / 0% | 452k / 50k / 42k |
| homegrown | mantém o elenco fundador | 69 / 55 / 50% | 67 / 52 / 43% | 17 / 2 / 2% | 2 / 5 / 19% | 548k / 101k / 63k |
| experienced | negocia, poupa, renova seletivo | 76 / 40 / 38% | 69 / 38 / 26% | 14 / 2 / 0% | 0 / 0 / 0% | 481k / 112k / 65k |
| stars | junta dinheiro para estrelas reais | 55 / 36 / 14% | 50 / 36 / 14% | 7 / 2 / 0% | 0 / 0 / 2% | 132k / 47k / 41k |

Jovens contra o resto, no **Normal**, por elenco inicial (título do Worlds até a S10, temporada mediana):

| Elenco | Jovens (`academy` + `prospectsOnly`) | Outros perfis base | Perfis de um fator |
|---|---|---|---|
| Promessas | **93% (S6)** | 3% (S7) | 3% (S9) |
| Rodados | **61% (S9)** | 1% (S9) | 1% (S9) |
| Equilibrado | **39% (S7)** | 0% | 1% (S9) |

**Leitura simples:** com jovens, o ritmo até fica perto da meta (título na S6–S9). O problema é que esse é o
**único** estilo que vence. Comprar estrelas (`stars`) é o pior caminho: 7% de título no Easy e 2% no Normal,
porque um 90+ é caro demais. A taxa de um 90+ só cabe no caixa em 17% das temporadas.

### 2.4 Decisões isoladas (perfis de um fator contra o controle, 126 pares cada)

| Decisão | Major | Worlds | Título Worlds | Leitura |
|---|---|---|---|---|
| plan-preparation | +9 pp | +2 | 0 | Major mais cedo, sem título extra |
| style-clutch | +5 | +2 | +3 | levemente melhor |
| focus-mechanics-lab | 0 | −1 | +4 | levemente melhor no título |
| focus-film-room / scrim-easy / focus-set-plays | +2 / −3 / 0 | −1 / −4 / 0 | +3 / +3 / +2 | ruído |
| style-*, plan-development, plan-recovery, scrim-auto | ±2 | ±2 | ±3 | ruído |
| load-light / load-heavy | −1 / −2 | −2 | −2 | ruído |
| scrim-off | −2 | −4 | −2 | sem scrim é um pouco pior |
| plan-delegated | −3 | −4 | −2 | delegar é um pouco pior |
| **plan-base** | **−9** | **−10** | **−5** | não escolher plano é claramente pior |
| briefing-none / keep / recover / prepare | +2 / +2 / 0 / −1 | ±2 | ±2 | preleção quase não muda nada (`keep` ≡ `none`) |

**Leitura simples:** nenhuma escolha é obrigatória, o que é bom. Mas também quase nenhuma faz diferença
sentida, e isso tira graça das decisões. A ideia de "mais opções de progressão com buffs e contrapartidas"
é apoiada pelos dados.

---

## Parte 3: falhas e finanças

### 3.1 Falências
- **Base:** 10% (Easy 2%, Normal 7%, Hard 21%); **um fator:** 1%. A quebra acontece na mediana da S5
  (p10 S3, p90 S9). Causas: estouro do limite (breach) 89, prazo do empréstimo (deadline) 85.
- **Por perfil:** `novice` 58%, `ambitious` 27%, `buyAll` 24%, `homegrown` 9%, `learner` 6%. `academy`,
  `known` e `experienced` ficam em 0%.
- **Por elenco (todas as carreiras):** Easy 1% · Normal 2–3% · Hard 8–11% (promessas é o elenco mais arriscado).
- **Por região (Hard):** EU 19%, SAM 12%, NA 11%, OCE 9%, MENA 8%, APAC 4%, SSA 3%.

### 3.2 Crise (perfis base)

| Grupo | Ficou negativo | Recuperou | Dias negativos p50 / p90 | ≤ −4 semanas | ≤ −8 semanas |
|---|---|---|---|---|---|
| Easy | 46% | 94% | 0 / 177 | 26% | 8% |
| Normal | 64% | 86% | 15 / 408 | 38% | 17% |
| Hard | 81% | 73% | 43 / 351 | 55% | 26% |
| Um fator | 55% | 97% | 2 / 63 | 22% | 2% |

- **Oferta de crédito:** aparece e é aceita em 89% das carreiras base (principal p50 $177k; 6 ofertas p50).
- **Venda de emergência:** oferecida a 39–53% das carreiras, aceita conforme o perfil (`novice` 100%,
  `buyAll` 92%). Valor das vendas abaixo do mercado, p50 nos perfis que aceitam: $10k–800k.
- **Empréstimo emergencial ("backer"):** 19% das carreiras base, 4% no fim de temporada.
- 39 registros com saldo mínimo abaixo de −$1M (todos de perfis imprudentes).

**Leitura simples:** a rede de segurança funciona. Quase todo mundo usa crédito em algum momento, e quem joga
com cuidado quase nunca quebra.

### 3.3 Caixa

| Grupo | S1 p50 | S2 p50 | S3 p50 | S10 p50 / p90 | Temporadas dominantes p50 / p90 | Cobre a taxa de um 90+ | Estrela em S6–S10 |
|---|---|---|---|---|---|---|---|
| Base | 5,5k | 13,5k | 16,0k | 229k / 1,16M | 751k / 1,87M | 17% | 38% |
| Easy | 8,7k | 22,3k | 37,0k | 581k / 1,48M | 713k / 1,75M | 15% | 66% |
| Normal | 5,4k | 12,9k | 13,9k | 170k / 1,04M | 931k / 2,03M | 24% | 35% |
| Hard | 4,0k | 9,7k | 9,1k | 105k / 0,84M | 1,03M / 2,01M | 22% | 14% |

**Leitura simples:** o começo é apertado como deve ser. No fim de jogo, quem domina tem dinheiro, mas uma
estrela 90+ ainda cabe pouco. Isso explica por que o perfil `stars` sofre.

---

## Parte 4: endgame

### 4.1 Folha salarial dividida pela receita

| Faixa | Easy | Normal | Hard |
|---|---|---|---|
| S6–S10, razão p50 (% de temporadas com prejuízo) | 0,65 (20%) | 0,87 (39%) | 1,02 (52%) |
| S11–S20, campeões | 0,71 (20%) | 0,95 (47%) | 0,99 (49%) |

Por temporada (todas as carreiras até a S10, campeões depois):

| Temp. | Folha p50 | Prêmio líquido p50 | Patrocínio p50 | Receita p50 | Razão p50 |
|---|---|---|---|---|---|
| S6 | 146k | 41k | 105k | 145k | 0,79 |
| S8 | 259k | 68k | 157k | 233k | 0,86 |
| S10 | 363k | 117k | 254k | 375k | 0,84 |
| S11 | 1,99M | 1,25M | 1,32M | 2,58M | 0,82 |
| S15 | 2,59M | 2,02M | 2,19M | 4,23M | 0,67 |
| S20 | 6,05M | 3,40M | 4,11M | 7,63M | 0,86 |

### 4.2 Mercado (1ª visita à janela, pedido por split)

| Temp. | Pedido p50 | 85–89 | 90+ | Taxa do 90+ | Folha própria / split | Folha ÷ pedido p50 |
|---|---|---|---|---|---|---|
| S2 | 1,9k | 46k | 108k | 417k | 9k | 4,8× |
| S5 | 6,7k | 69k | 333k | 1,04M | 36k | 5,7× |
| S10 | 13,6k | 130k | 525k | 1,73M | 110k | 8,1× |
| S15 | 26,6k | 237k | 960k | 3,48M | 771k | 28× |
| S20 | 47,5k | 475k | 1,55M | 5,11M | 1,94M | 41× |

### 4.3 Prêmios do campeão (p50)

| Evento | S1–2 | S5–6 | S9–10 | S11–15 | S16–20 |
|---|---|---|---|---|---|
| Regional | 15k | 22k | 39k | 61k | 124k |
| Major | n/a | 112k | 172k | 295k | 519k |
| Worlds | n/a | 487k | 742k | 1,28M | 2,61M |

### 4.4 Depois do título (S11–S20, 155 campeões)
- **95% voltam a ser campeões do Worlds**; só 2 quebram; caixa S20 p10 / p50 / p90 = 1,3M / 4,0M / 17,8M.
- Ninguém fica 8 semanas negativo, e a razão folha ÷ receita p50 é 0,74.

**Leitura simples:** os salários sobem muito na endless (a folha triplica em 10 temporadas), mas os prêmios e
os patrocínios sobem junto, e o campeão fica rico e imbatível. O feedback "salários inflam" é real, mas o
problema maior é a endless **não ter desafio** para quem já venceu. O prêmio do Worlds sozinho paga só ~43%
da folha da S20; quem fecha a conta é o patrocínio.

---

## Parte 5: Worlds mais difícil (rivais +0,5 / +1 só no Worlds)

| Braço | Títulos | Carreiras com ≥ 1 título até a S10 | Colocação média | Caixa S10 p50 |
|---|---|---|---|---|
| Jogo atual | 725 | 33% | 7,14 | 547k |
| +0,5 | 584 (−19%) | 28% | 7,51 | 530k |
| +1 | 424 (−42%) | 20% | 8,01 | 502k |

Por dificuldade, % de carreiras expostas com título: Easy 50 → 44 → 33 · Normal 19 → 17 → 10 · Hard 17 → 12 → 7.
O +0,5 muda o resultado de 28% das carreiras expostas (109 ganham mais, 179 ganham menos); o +1, de 28%
(56 mais, 221 menos).

**Leitura simples:** endurecer o Worlds para todo mundo deixaria o título quase impossível no Normal e no
Hard. Faz sentido **depois do primeiro título** (para frear o "campeão eterno" da endless) ou no Easy.
O +0,5 é o tamanho certo para começar.

---

## Parte 6: química

| Trio (pares com mesmo país / mesma região / nenhum) | Química p50 | Teto |
|---|---|---|
| Ninguém em comum (0/0/3) | **67%** | 67% em 100% das temporadas com ≥ 2 splits juntos |
| Dois da mesma região (0/1/2) | 75% | 75% |
| Dois do mesmo país (1/0/2) | 81% | 81% |
| Todos da mesma região (0/3/0) | 92% | 92% |
| Dois do mesmo país + terceiro da região (1/2/0) | 97% | 97% |
| Todos do mesmo país (3/0/0) | 100% | 100% |

Tempo juntos: 2–4, 4–8 e 8+ splits têm a **mesma** química p50. O tempo só importa nos 2 primeiros splits.

**Leitura simples:** a química é decidida pela nacionalidade, não pela convivência. É exatamente o
feedback "travada em 67% depois de 4 anos". A sua ideia (jogos, scrims e tempo juntos) é o caminho.

---

## Parte 7: renovações

Razão = novo salário ÷ pedido de mercado do jogador no dia.

| Recorte | n | Razão p10 / p50 / p90 | ≤ 10% do mercado | Desconto ≥ 25% |
|---|---|---|---|---|
| Todas S1–S10 | 13.393 | 0,12 / 0,61 / 1,23 | 9% | 59% |
| Teto de salto manda (43%) | 5.783 | 0,05 / **0,25** / 0,54 | 20% | 100% |
| 2ª renovação | 1.221 | 0,05 / 0,46 / 1,23 | 32% | 62% |
| Todas S11–S20 | 912 | 0,05 / 0,78 / 1,30 | 21% | 46% |
| Teto de salto S11–S20 | 412 | 0,02 / **0,11** / 0,56 | 47% | 100% |

Probe isolado: um 90/98 que ganhava $1.000/split renova por $2.500, ou **1,3% do pedido de mercado**
($191.750). Na 2ª e na 3ª renovação, 1,4% e 1,2%.

**Leitura simples:** o jogador que era barato e virou craque continua barato. A renovação só pode subir 2,5×
a 3× o salário antigo, e isso ainda fica longe do preço dele. É o "renovação barata" do feedback, e é parte
da força do caminho dos jovens.

---

## Parte 8: reputação

| Resultado | Δrep p50 | Rep zero | Rep antes p50 | Já no teto (100) |
|---|---|---|---|---|
| Campeão do Major | 0 | 98% | 100 | 98% |
| Campeão do Worlds | 0 | 94% | 100 | 98% |
| Worlds top 6–8 | 0 (p10 −7) | 62% | 100 | 83–90% |
| Campeão Regional | 0 | 73% | 100 | 73% |
| Regional 3º–8º | +1 a +2 | 1–14% | 41–64 | 1–14% |
| Swiss 3-0 / 3-1 / 3-2 (S1–S3) | +2,6 / +1,8 / +1,4 | 0% | 16–57 | n/a |
| Saída no Swiss | 0 | 100% | 16–32 | n/a |

- **16% dos resultados de Worlds perdem reputação**, inclusive de campeões (até −7). Provável causa: a
  penalidade da meta da temporada, que cai no fechamento logo depois do Worlds. A verificar.
- **Qualifiers:** os 214.507 aparecem como `swiss_exit`, e o formato não registra quem avançou (problema de dado).
- Inversão medida no código: uma saída 1–3 no qualifier pode render +1, enquanto uma saída 2–3 no Regional
  rende 0 (rota de novato, rep < 25).

**Leitura simples:** a reputação enche cedo. Depois disso, ganhar não "vale" nada em reputação, e não há o
que desbloquear acima de 80. A sua ideia de critérios que mudam conforme a reputação cresce resolve isso.

---

## Parte 9: compras, coach, psicóloga, preleções

Efeito marginal medido depois dos limites (amostras semanais com o item ativo):

| Item | Carreiras | Compras | Rating marginal S1–3 / S4–6 / S7–10 / S11–20 | Outros efeitos |
|---|---|---|---|---|
| Performance center | 51% | 2.504 | 2,69 / 2,44 / 2,28 / 1,83 | consistência +1,5 |
| Bootcamp | 95% | 84.989 | 1,26 / 1,46 / 1,38 / 1,11 | gasto total $957M |
| Coach | 100% | 10.704 | 1,13 / 1,46 / 1,61 / 1,44 | mecânica +1,6, ataque +0,8 |
| PCs | 98% | 4.802 | 0,60 / 0,56 / 0,54 / 0,38 | consistência +0,8 |
| Monitores / periféricos | 99–100% | ~4.900 | 0 | só bônus de treino +0,05 |
| **Psicóloga** | 66% | 5.175 | **0 / 0 / 0 / 0** (609k amostras) | clutch +3,0, consistência +3,0 |

- **Coach:** é comprado em 100% das carreiras, por ~$1k cada. Ele só melhora (+0,5 a +1 de qualidade por
  temporada), nunca envelhece, e o salário fica congelado no valor da contratação. Os 317 coaches reais do
  dataset nunca podem ser contratados.
- **Psicóloga:** sobe clutch e consistência, mas o rating da partida ignora esses atributos. Hoje é dinheiro
  jogado fora: um bug de design ou de cálculo.
- **Preleções:** com coach, 37–40% dos pedidos em Major e Worlds viram outra preleção efetiva. O efeito no
  funil é ±2 pp, e `keep` dá o mesmo resultado que `none`.

---

## Parte 10: comparação com a baseline de 04/11 (rc.36.10, 315 pares)

| Recorte | Major | Título Major | Worlds | Título Worlds | Falência | Caixa final p50 |
|---|---|---|---|---|---|---|
| Todas | 68 → 65% | 34 → 30% | 65 → 61% | 26 → 24% | 9 → 7% | 234k → 292k |
| academy | 86 → 94% | 70 → 73% | 84 → 90% | 57 → **67%** | 0 → 0% | 1,45M → 1,48M |
| learner | 70 → 54% | 28 → 15% | 63 → 53% | 22 → 9% | 15 → 5% | 166k → 210k |
| ambitious | 77 → 68% | 26 → 22% | 73 → 62% | 18 → 15% | 15 → 23% | 298k → 259k |

**Leitura simples:** o rc.37 deixou o jogo um pouco mais difícil e as finanças mais estáveis, mas aumentou
a vantagem dos jovens. A forma do funil (cedo ou nunca) não mudou.

---

## Parte 11: feedback do staging e ideias do Miguel × dados

| Item | Veredito | O que o dado mostra |
|---|---|---|
| Renovação barata | **confirmado** | p50 0,61 do mercado; 0,25 com o teto de salto; 0,11 na endless |
| Salários inflam na endless | **confirmado** | folha ×3 em 10 temporadas; pedido do 90+ ×3,4 |
| Prêmio baixo no endgame | **parcial** | o prêmio do Worlds paga ~43% da folha S20, mas o campeão termina com $4M |
| Coaches reais / troca com o tempo | **apoiado** | coach eterno, barato e congelado; 317 reais sem uso |
| Química travada em 67% | **confirmado** | 100% das temporadas de trio sem país/região em comum |
| Mais compras com reputação | **apoiado** | rep no teto cedo; nada desbloqueia acima de 80 |
| Vários patrocínios na endless | **cautela** | o campeão já sobra em dinheiro; só faz sentido junto com custo novo |
| Histórico de campeões | fora do escopo | o dataset não tem campeões; precisa de dado novo |
| Crédito com 4 semanas negativo | **já existe em parte** | a oferta de crédito abre com 4 semanas de fôlego; o empréstimo emergencial segue em −8 |
| Mais ofertas de emergência quando negativo | **apoiado** | hoje há no máximo 1 por janela (cooldown 14 dias) |
| Testar dificuldade do Major/Worlds | **feito** | +0,5 tira 19% dos títulos, +1 tira 42% (Parte 5) |
| Mais opções com buffs e trade-offs | **apoiado** | quase nenhuma escolha muda o resultado (Parte 2.4) |
| Química por jogos, scrims e tempo | **apoiado** | o tempo para de contar após 2 splits (Parte 6) |
| Worlds da Season X cancelado | design | a S1 tem Worlds no calendário; vira notícia ou exceção de calendário |
| Times de 2027 na endless | design | precisa de uma 7ª linha em `CAREER_SEASONS` (migração de save) |
| Prêmio e pontos antes do evento | **apoiado** | as funções existem (`prizeScheduleFor`, `pointsFor`), falta tela |
| Reputação por resultado com critérios móveis | **apoiado** | rep satura e títulos rendem 0 (Parte 8) |

---

## Parte 12: melhorias em linguagem simples

1. **Craque formado em casa tem que custar caro para manter.** Quando um jovem vira estrela, a renovação deve
   chegar perto do preço de mercado. Isso cria a decisão "renovo caro, vendo, ou deixo sair?" em vez de
   "renovo de graça".
2. **Os jovens crescem um pouco mais devagar**, para o caminho da base continuar bom, mas não ser o único.
3. **Estrelas um pouco mais acessíveis**, para o caminho "compro craques" funcionar no meio e no fim da
   carreira.
4. **Rivais calibrados por região:** regiões fracas ficam mais duras, Europa e América do Norte um pouco mais
   abertas. A ideia é que nenhuma região garanta ou bloqueie o Worlds.
5. **Começo mais duro e meio mais suave:** é difícil ganhar algo nas duas primeiras temporadas, e a S3–S6 é
   onde o time sobe degrau por degrau.
6. **Endless com desafio:** depois do primeiro título os rivais do Worlds ficam mais fortes, os salários
   crescem mais devagar e o prêmio tardio sobe um pouco. Ser campeão vira manter-se campeão.
7. **Química pela convivência:** jogar, treinar e ficar junto aumenta a química até 100%; a nacionalidade
   só acelera.
8. **Reputação por patamares:** cada faixa pede resultados maiores, títulos nunca rendem zero e há o que
   desbloquear acima de 80.
9. **Coach com contrato e idade:** o coach pede aumento, envelhece e um dia precisa ser trocado; os coaches
   reais podem ser contratados.
10. **Itens que funcionam:** a psicóloga passa a mexer no resultado, e a preleção vira uma decisão que
    se sente.
11. **Mostrar prêmios e pontos antes de entrar em cada evento.**

---

## Parte 13: sugestões técnicas com números

Valores atuais lidos no código de `claude/rc37-integration`. Os valores propostos são **pontos de partida para
calibrar** na F6, e todos pedem rerodar os tiers A + B (~11 h) para conferir.

### T1. Renovação com piso de mercado (prioridade 1)
- **Hoje** (`renewal.ts:95-186`): ask = min(core, max(wage × 1,75, min(core × 0,6, wage × maxJump))).
  `maxJump` vale ×2,5 na 1ª renovação (ou tenure ≤ 2) e sobe +0,25 por temporada até ×3,0.
  `floorPerSeason` = 0. O teto de salto manda em 43% das renovações.
- **Proposta:** piso de mercado `renewalMarketFloor`: **0,55 × freshAsk na 1ª renovação, 0,70 na 2ª e
  0,80 a partir da 3ª**, aplicado depois do teto de salto. Alternativa mais suave: `maxJump` 2,5 → 4,0 e
  `jumpMax` 3,0 → 5,0.
- **Efeito esperado:** a razão p50 do caso "teto de salto" sobe de 0,25 para ≥ 0,55; a folha S6–S10 do
  `academy` sobe ~1,5–2×.
- **Validar:** a razão p50 de todas as renovações fica em 0,75–0,95; `academy` e `prospectsOnly` ficam
  com título do Worlds no Normal ≤ 40%, sem subir a falência deles acima de 5%.

### T2. Crescimento dos jovens (prioridade 1)
- **Hoje** (`balance.ts:1759`, `CAREER_AGE.growthMult`): u16 1,5 · 17–18 1,25 · 19–20 1,0 · 21–22 0,8 ·
  23–24 0,45 · 25+ 0,2.
- **Proposta:** u16 **1,30** · 17–18 **1,12** · resto igual (−13% e −10%). Opcional: no mercado, a faixa de
  potencial visível do jovem fica mais larga até ele ser observado (o `academy` filtra faixa ≥ 88 sem custo).
- **Efeito esperado:** o jovem chega ao pico ~1 temporada depois; o título dos perfis de jovens no Normal
  cai de 61–93% para ~35–50%, com mediana S7–8.
- **Validar:** os jovens continuam no topo, mas a menos de 2× o segundo melhor perfil.

### T3. Estrelas acessíveis (prioridade 2)
- **Hoje** (`economy.ts:532-553`): a curva das estrelas faz ×1,2 e depois ×1,03 por ponto acima de 80;
  um 90 custa **3,35×** um 85. A taxa do 90+ cabe no caixa em 17% das temporadas.
- **Proposta:** baixar `starGrowthPerPoint` para que um 90 custe **~2,5×** um 85.
- **Efeito esperado:** a taxa do 90+ cabe em ~30% das temporadas; o título do perfil `stars` sobe do
  patamar de 0–7%.
- **Validar:** `stars` e `ambitious` com título no Normal de 10–20%.

### T4. Força dos rivais por região (prioridade 1)
- **Hoje:** as vagas no Worlds são NA 4, EU 4, SAM 2, MENA 2, OCE 2, APAC 1, SSA 1 (`balance.ts:984-987`),
  e só a dificuldade mexe na força dos rivais: `opponentRatingShift` Easy −1,6 / Normal −0,6 / Hard −0,2,
  igual para todas as regiões (`balance.ts:3505-3527`). No Normal, o Worlds até a S10 vai de 4% (EU) a
  100% (SSA).
- **Proposta:** um termo `regionFieldShift` somado ao shift da dificuldade, só nos eventos regionais e
  qualifiers: **SSA +2,0 · APAC +2,0 · OCE +1,0 · MENA +0,3 · SAM 0 · NA −0,5 · EU −1,0**. Não mexer
  nas vagas.
- **Efeito esperado:** pela escala medida (1 ponto nos rivais do Worlds tirou 42% dos títulos), o Worlds até
  a S10 no Normal fica entre ~25% e 60% em todas as regiões, e nenhuma vai ao Worlds na S1.
- **Validar:** Worlds no Normal entre 25% e 60% por região; mediana do 1º Worlds ≥ S4 em todas.

### T5. Rampa de início (prioridade 2)
- **Hoje:** Regional no 1º split em 51% das carreiras do Normal; até o 2º split, 77% (alvo < 50%).
- **Proposta:** um extra no shift dos rivais nas temporadas iniciais, `earlyFieldShift`: **S1 +1,0 ·
  S2 +0,5 · S3+ 0**, só em regionais e qualifiers, aplicado por cima do T4.
- **Efeito esperado:** Regional até o 2º split no Normal cai para ~40–50%, e o Major passa a sair na S4–5
  em vez de cedo ou nunca.
- **Validar:** a mediana incondicional do Major no Normal fica em S4–S6 e a do Worlds em S6–S8.

### T6. Endless com desafio (prioridade 2)
- **Hoje:** 95% dos campeões revencem; o `moneyIndex` é 1,15^s sem teto (S10 3,52 → S20 14,23,
  `economy.ts:89-91`); o passo tardio é Worlds ×1,25 e Major ×1,15 a partir da S4.
- **Proposta:**
  1. rivais do Worlds **+0,5 depois do 1º título** do jogador (o termo por nível que hoje não existe);
  2. `moneyIndex` igual até a S10 e depois **×1,08 por temporada** (S20: 7,6 em vez de 14,23), valendo
     para salários e prêmios;
  3. Worlds tardio ×1,25 → **×1,40 a partir da S11**.
- **Efeito esperado:** revencer cai de 95% para ~50–65% e a folha S20 p50 fica perto de $3M em vez de $6M.
- **Validar:** S11–S20 com razão p50 entre 0,85 e 1,0 e revencer entre 40% e 65%.

### T7. Química por convivência (prioridade 3)
- **Hoje** (`worldSim.ts:539-589`, `balance.ts:1122-1136`): a conexão de cada par é min(4,0, 2 × splits
  juntos), mais 2,5 por mesmo país ou 1,5 por mesma região, dividido por 6,0 × 3. O teto chega em 2 splits.
- **Proposta:** `connMaxPerPair` 4,0 → **6,0**, crescendo **1,0 por split junto** (em vez de 2,0), mais
  **+0,02 por partida oficial juntos**. Nacionalidade mantida como acelerador.
- **Efeito esperado:** o trio sem nada em comum vai de 67% para 100% em ~2 temporadas juntas; trocar
  jogador passa a custar química de verdade.
- **Validar:** química p50 com posse 8+ splits ≥ 90% em qualquer mistura de nacionalidades.

### T8. Reputação por patamares (prioridade 3)
- **Hoje:** os ganhos caem pela metade a partir de rep 60; o título do Worlds leva a rep direto a 100;
  o último desbloqueio é em 80 (banco $90k); 16% dos Worlds tiram rep.
- **Proposta:**
  1. o título do Worlds rende **+20** (com teto em 100), em vez de levar direto a 100;
  2. ganhos ×0,5 a partir de 60 e **×0,35 a partir de 85**;
  3. desbloqueios novos em **85 / 90 / 95** (por exemplo: 2º patrocínio, coach de elite, centro premium);
  4. aplicar a penalidade da meta da temporada **antes** do Worlds ou não aplicá-la quando o time foi ao Worlds;
  5. corrigir a inversão de novato (saída 2–3 no Regional rendendo ≥ a saída 1–3 no qualifier).
- **Validar:** títulos com Δrep > 0 em ≥ 80% dos casos e Worlds com Δrep negativo < 3%.

### T9. Itens sem efeito (prioridade 3)
- **Psicóloga:** clutch +3 e consistência +3 com 0 de rating em 609k amostras. Ligar consistência e clutch
  ao resultado, por exemplo reduzindo a variância da partida (consistência) ou dando um bônus em jogo
  decisivo (clutch). Meta: rating marginal ~+0,5 a +1, abaixo do bootcamp.
- **Preleções:** hoje `keep` dá +0,1 / +0,1, `prepare` +0,40 / −0,15 e `recover` −0,15 / +0,40.
  Proposta: **prepare +0,6 / −0,25 · recover −0,25 / +0,6 · keep +0,15**. Meta: um efeito de ±5 pp no
  título entre a melhor e a pior escolha.

### T10. Rede de crise (ideias do Miguel, prioridade 4)
- **Hoje:** a oferta de crédito abre com fôlego ≤ 4 semanas; o empréstimo emergencial abre a −8 × a conta
  semanal (−4 já foi testado e rejeitado, `balance.ts:2952-2955`); a venda de emergência tem cooldown de
  14 dias e uma pendente, ou seja, **no máximo 1 por janela**.
- **Proposta:** venda de emergência com `cooldownDays` 14 → **5** e `maxPending` **2** (2–3 ofertas por
  janela, abaixo do mercado, além das ofertas normais). Manter o empréstimo emergencial em −8 e reforçar o
  crédito em 4 semanas negativo como a "oferta de socorro".
- **Validar:** falência no Hard entre 15% e 25% e recuperação ≥ 80%.

### T11. Coaches (feature, prioridade 4)
- **Hoje:** o `CoachState` não tem duração, idade nem fim; o salário fica congelado na contratação
  (`training.ts:179`); 317 coaches reais do dataset nunca são contratáveis.
- **Proposta:** contrato de **2 temporadas** com renovação a `coachWageFor` atual; **−1 de qualidade por
  temporada depois de 4 no clube** (ou a partir de 50 anos); coaches reais entram no shortlist (livres) e
  podem ser comprados de orgs IA por uma taxa de ~1 split de salário.

### T12. Patrocínios múltiplos (feature, prioridade 5)
- **Hoje:** um slot (`sponsor: SponsorState | null`).
- **Proposta:** a partir da S7 ou do primeiro título, **2º slot**, com uma oferta por split e duração de
  3 splits. Só junto com o T6, para não piorar a riqueza dos campeões.

### T13. Tela antes do evento e dados (rápido)
- Mostrar a tabela de prêmio e pontos por colocação antes de inscrever, com `prizeScheduleFor`
  (`economy.ts:231`) e `pointsFor` (`economy.ts:320`).
- Registrar no qualifier quem avançou: hoje tudo é `swiss_exit`.

---

## Parte 14: ordem sugerida e próximos passos

1. **F6-a (equilíbrio central):** T1 + T2 + T4 + T5 juntos, porque mexem no mesmo funil. Depois, rerodar os
   tiers A + B (~11 h).
2. **F6-b (endgame):** T3 + T6. Rerodar só o tier A (~6,5 h, inclui a extensão S20).
3. **F6-c (sistemas):** T7 + T8 + T9 + T13. Os testes unitários bastam, mais uma rodada A ao final.
4. **Playtest no staging** de uma versão com F6-a e F6-b, para o seu teste de jogo e o Gate 3b.
5. **Frentes novas, depois da F6:** coaches (T11), patrocínios (T12), histórico de campeões (dataset novo),
   Worlds da Season X cancelado (notícia ou exceção de calendário), times de 2027 na endless (7ª linha em
   `CAREER_SEASONS` + migração), reputação por patamares completa.
6. **F5 (replay):** só depois da sua aprovação do contrato.

**Metas para aceitar a F6 (Normal, perfis base):**
- Regional até o 2º split < 50%;
- mediana do Major em S4–S6 e do Worlds em S6–S8;
- título do Worlds até a S10 entre 20% e 35% (mediana S7–S9 entre quem vence);
- nenhuma região fora de 25–60% de Worlds;
- nenhum perfil acima de 2× o segundo em títulos;
- falência 5–10%;
- revencer na endless ≤ 65%.

## Parte 15: pendências a investigar (possíveis bugs)
1. A psicóloga não afeta o rating (clutch e consistência ignorados no cálculo).
2. Δrep negativo em 16% dos Worlds, inclusive de campeões.
3. O placement do qualifier é sempre `swiss_exit`.
4. Na telemetria, `season.training.prompts` e `season.training.unavailable` ficam sempre em 0.
5. 39 registros abaixo de −$1M de saldo mínimo (imprudentes), para conferir se o piso do banco segura.
6. Comentários antigos no código ainda dizem +1 de rep por saída no Swiss do Regional (`balance.ts:2474-2477`,
   `careerFlow.ts:3804`), zerada no rc.36.3.
