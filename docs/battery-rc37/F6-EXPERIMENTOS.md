# Rocket Draft rc.37 F6: integração, diagnóstico e primeiros experimentos

**Data:** 09/11/2026 · **Branch:** `claude/rc37-balance` (a partir do `staging` rc.37 `7cccb34`) ·
**Base de comparação:** a bateria de 06/11 (`docs/battery-rc37/RELATORIO-COMPLETO.md`), dados brutos em
`C:\Users\Miguel\CLAUDE\rc37-battery\run1`.

> Nenhum valor de jogo foi mudado no `staging`. Tudo abaixo roda no branch de balanceamento, com as
> alavancas novas **desligadas por padrão**: o jogo do branch é idêntico ao do `staging` até um pacote ser
> aprovado.

---

## 0. Resumo em uma página

RESUMO_PLACEHOLDER

---

## 1. Integração

- O `staging` estava em rc.36.21 (desafios, Draft Labs, dailies, UI de recompensas, badges). O trabalho
  separado era o `claude/rc37-integration` (F1 mercado, F2 finanças, F3 dia de jogo, F4a ferramenta da
  bateria, F5 só documento) e o relatório em `claude/rc37-battery-report`.
- Fusão: o código de jogo mesclou **sem conflito** (o `balance.ts` do rc.36.16 só ganhou o bloco
  `DAILY_CHALLENGE`, disjunto dos blocos de carreira). Conflitos só em versão (agora **2.0.0-rc.37**), STATUS,
  CHANGELOG e o fingerprint do balance: os dois lados tinham subido `BALANCE_VERSION` de 13 para 14 com
  ajustes diferentes, então o balance fundido é o **15**.
- Gates: typecheck e lint limpos, **2.095 testes passando** (28 pulados), export estático com as flags do
  staging (carreira ligada, noindex) ok. Publicado em `staging` (`7cccb34`).
- O lado staging não tocou em nenhum arquivo de carreira. **Verificado na prática:** quatro carreiras da
  bateria (SAM/academy, EU/stars, SSA/homegrown, OCE/trader) rodadas no código integrado deram registros
  **idênticos** aos de 06/11.

## 2. Método e limiar de amostras

**Por que não precisamos rerodar 4.914 carreiras a cada mudança**

1. **O controle já existe.** A simulação é determinística e o código integrado reproduz a bateria bit a
   bit. Toda célula da bateria (região × dificuldade × elenco × perfil × seed) é o braço de controle de
   qualquer experimento, sem rerodar. Cada experimento compara **a mesma carreira** com e sem a mudança
   (pareado).
2. **Contrafactual offline antes de simular.** As 13.393 renovações, os caixas e as receitas da bateria
   permitem estimar quem uma regra atinge e quanto custa, em segundos, sem simular. Isso descarta opções
   extremas antes de gastar máquina.
3. **Triagem pequena e focada.** Um braço de triagem roda no **Normal**, nas **21 situações** (7 regiões ×
   3 elencos), **1 seed**, só com os perfis que a mudança atinge: 48 a 147 carreiras, **8 a 25 minutos** com 6
   processos (medido: ~6 carreiras por minuto, ~45–60 s por carreira até a S10).
4. **Confirmação do pacote**, uma vez: 3 dificuldades × 21 situações × 1 seed × ~8 perfis (um ou dois por
   família), ~500 carreiras, ~1h30.
5. **Validação final**, uma vez antes do staging: os 14 perfis base × 63 situações na **segunda seed**
   (17019, réplica nova), 882 carreiras, ~2h30.

Ciclo completo de um pacote: ~5–6 h de máquina, contra ~86 h-processo (21 h de relógio) da bateria cheia.

**O que a amostra de triagem consegue ver:** com 21 carreiras por perfil, uma mudança de ±25 pp no título
do Worlds aparece com clareza; com 42 (dois perfis da mesma família), ±15–20 pp. Serve para **decidir
direção e ordem de grandeza**, não para afinar casas decimais. A afinação fica para a confirmação, nas três
dificuldades.

**Regra de decisão de cada braço:** a métrica-alvo anda na direção certa; as guardas ficam dentro dos
limites (falência por família ≤ +3 pp, caixa da S1–S3 sem piorar, nenhuma família desaba); e os
movimentos pareados (carreiras que ganham × perdem o título) apontam para o mesmo lado.

**Ferramentas (no branch):**
- `src/store/auditHumanExperiment.test.ts` (`HUMAN_EXPERIMENT=1`): roda um subconjunto de células com um
  *patch* de balance aplicado em memória (merge estrito: chave errada falha). Mesmo formato JSONL da bateria.
- `src/store/auditHumanSummaryF6.mjs`: comparação pareada braço × controle da bateria, por perfil, família
  ou região.
- `src/engine/career/f6Probes.test.ts` (`F6_PROBE=1`): Monte Carlo do motor de partidas (psicóloga).

---

## 3. Diagnóstico (dados da bateria, sem simular de novo)

### 3.1 Por que os jovens dominam: a escala dos preços

No Normal, os times de jovens têm uma economia de outra ordem de grandeza (p50 por temporada):

| Família | Receita S6 | Folha S6 | Folha ÷ receita S6 | Receita S10 | Folha S10 |
|---|---|---|---|---|---|
| jovens (`academy`, `prospectsOnly`) | **437k** | **97k** | **0,22** | 1,69M | 912k |
| comprar (`stars`, `ambitious`, `buyAll`, `known`) | 165k | 195k | 1,18 | 389k | 339k |
| manter (`homegrown`, `coachFixed`, `experienced`) | 134k | 101k | 0,75 | 234k | 298k |
| negociar (`trader`, `continuous`) | 181k | 224k | 1,24 | 481k | 520k |

A causa não é só a renovação. **O preço de mercado de um craque é maior que a receita de qualquer time na
S1–S10:** um 88+ que renova na S6 pediria ~$857k por temporada a preço de mercado, e o time de jovens fatura
$437k. Ninguém consegue **comprar** um 90+ (a taxa só cabe no caixa em 17% das temporadas), então
desenvolver é o único jeito de ter estrelas, e o teto de salto mantém essas estrelas baratas. Daí o círculo:
estrelas baratas → títulos → prêmios → sobra de caixa → bootcamps e estrutura.

**Quem a renovação barata atinge (13.393 renovações da S1–S10, perfis base):** 80% das renovações de
jogadores ≤ 20 anos e 80% das de 90+ são presas pelo teto de salto, com o novo salário p50 em **0,19** do
preço de mercado (0,05 para um ≤ 20 anos com 90+). Entre 24 e 27 anos, só 15%. Os fundadores comuns quase
não são atingidos.

**Pisos aplicados às renovações registradas (estático: mesmas renovações, sem o bot reagir):**

| Piso por renovação (1ª / 2ª / 3ª+) | Renovações elevadas | Reajuste × salário antigo p50 / p90 / máx | Jovens Normal: folha extra S1–S10 p50 (caixa S10 p50 = 1,14M) | Manter Normal: carreiras atingidas |
|---|---|---|---|---|
| 55 / 70 / 80% (proposta do relatório) | 51% | 6,6 / 45 / 172 | **2,75M** | 64% |
| 30 / 45 / 60% | 33% | 7,5 / 39 / 111 | 1,10M | 40% |

Lido sem simular, os 55/70/80% parecem impagáveis. A simulação (Parte 4) mostra o que o bot faz: vende e
deixa sair, e quase não quebra.

### 3.2 Progressão: por que umas carreiras decolam e outras empacam (Normal, perfis base)

Classificando as carreiras por quando chegam ao primeiro Major:

| Grupo | n | Rating S2 → S4 → S10 | Reputação S4 / S10 | Séries contra rival ≥ 2 pontos mais forte, S4 / S10 | Receita S6 | Folha S6 | Ganho de treino por jogador S6 |
|---|---|---|---|---|---|---|---|
| não-jovens, Major até a S4 | 204 | 84 → 92 → 93 | 100 / 100 | 10% / 8% | 628k | 355k | −0,3 |
| não-jovens, Major S5–S10 | 43 | 78 → 84 → 93 | 42 / 100 | 37% / 10% | 189k | 163k | 0 |
| **não-jovens, nunca** | **257** | **78 → 80 → 81** | **31 / 40** | **57% / 54%** | **91k** | **96k** | **−0,2** |
| jovens, Major S5–S10 | 43 | 77 → 82 → 97 | 34 / 100 | 49% / 0% | 164k | 82k | +2,2 |

- **Metade das carreiras não-jovens nunca chega ao Major até a S10.** O time para em ~80 a partir da S4: o
  elenco envelhece (ganho de treino negativo a partir da S5, potencial ~82), a reputação para em 31–40, o
  que barra contratar 85+ (teto de contratação = 71 + 0,4 × rep), e a folha empata com a receita.
- **O mercado intermediário é o gargalo.** Um jogador 80–84 custa quase a folha inteira de um time que não
  ganha. Para quem empaca, não há degrau entre o elenco inicial (~75) e as estrelas.
- **Decolar cedo é quase só região:** os não-jovens que chegam ao Major até a S4 estão em SSA (100%), APAC
  (94%) e OCE (53%). Na **EU, 97% dos não-jovens nunca chegam ao Major** (NA 89%, SAM 82%).
- **Endurecer a S1–S2 de forma geral não resolve:** nas regiões fortes a S1–S2 já é dura (rank 17–19), e o
  problema está na S3–S10. O excesso de facilidade inicial é regional (SSA e APAC já são rank 1 na S2).
- **Custo de ficar sem classificar:** os "nunca" terminam a S10 com caixa p50 de $56k e folha acima da
  receita. Eles não quebram (falência só nos imprudentes), mas também não conseguem crescer. Na EU, uma
  carreira típica joga ~90 qualifiers em 10 temporadas e passa em 1.

### 3.3 Regiões: acesso × competitividade depois de classificar (Normal, perfis base)

| Região | Vagas no Worlds | Chega ao Major | Chega ao Worlds | Título por Regional jogado | No Worlds: top 4 / título / sai no Swiss |
|---|---|---|---|---|---|
| SSA | 1 | 100% | 100% | 82% | 13% / 4% / **61%** |
| APAC | 1 | 98% | 96% | 67% | 17% / 5% / 51% |
| OCE | 2 | 77% | 77% | 50% | 16% / 3% / 55% |
| MENA | 2 | 45% | 43% | 3% | 35% / 9% / 35% |
| SAM | 2 | 27% | 23% | 8% | 45% / 17% / 16% |
| NA | 4 | 21% | 17% | 6% | 59% / 16% / 14% |
| EU | 4 | 13% | 12% | 5% | **65% / 27%** / 12% |

**Leitura:** a dificuldade regional está invertida entre acesso e competitividade. Nas regiões fáceis o time
chega ao Worlds cedo e fraco e cai no Swiss (61% em SSA). Nas difíceis quase nunca chega, mas quem chega é
forte. Endurecer só a **cena regional** das regiões fáceis atrasa o acesso até o time estar pronto, sem mexer
no Worlds, nas vagas nem na identidade das regiões.

### 3.4 Endless (155 campeões estendidos até a S20)

| Recorte | n | ≥ 1 título S11–S20 | Temporadas com título S11–S20 | Sequência mais longa p50 / p90 | Espera pelo 1º título após a S10 p50 | Titulares da S11 ainda titulares na S20 | Caixa S20 p50 |
|---|---|---|---|---|---|---|---|
| Todos | 155 | 95% | **54%** | 4 / 8 | 2 temporadas | 0 de 3 | 3,73M |
| Easy / Normal / Hard | 116 / 24 / 15 | 96 / 96 / 93% | 54 / 54 / 48% | 5 / 4 / 4 | 2 / 3 / 1 | 0 / 1 / 0 | 3,3M / 10,4M / 11,8M |
| jovens / resto | 74 / 81 | 100 / 91% | 67 / 42% | 6 / 4 | 2 / 2 | 1 / 0 | 11,8M / 2,5M |

- Os 95% escondem a escala do domínio: o campeão vence o Worlds em **mais da metade das temporadas
  seguintes**, inclusive no Hard (48%), com o rating estável em ~95,5 e o elenco totalmente renovado.
- A amostra é viciada para o Easy (116 de 155) e **não há dado de quem chegou à endless sem vencer** (a
  bateria só estendeu campeões). O experimento E4 cobre os dois pontos.

### 3.5 Sistemas complementares

- **Psicóloga: funciona, a medição é que não via.** O `match.ts` usa clutch (jogos decisivos e prorrogação)
  e consistência (amortece rolagens e a forma da série ruins); o rating do time, que a telemetria media, não
  muda. Monte Carlo no motor, times iguais, 40 mil séries por ponto: o +3 clutch / +3 consistência dá **+2 a
  +4 pp de vitória na série**, equivalente a **+0,13 a +0,31 de rating** (cerca de 1/3 dos PCs). Não é bug.
- **Preleções: o coach nunca troca a escolha.** Com coach e jogando, a única diferença entre pedido e efeito
  é `none → keep` (o padrão, por desenho). Os "37–40% trocados" do relatório são domingos em que o time já
  estava eliminado (espectador recebe `keep`) ou sem coach. O efeito é ±0,4 de rating na rodada (≈ ±4 pp por
  série). Medido nos perfis de um fator da bateria (idênticos exceto a preleção), título entre eventos em
  que o time chegou aos playoffs com coach:

  | Preleção | Worlds: título / final (n ≈ 200 cada) | Major: título (n ≈ 550) | Regional: título |
  |---|---|---|---|
  | preparar | **15,1% / 27,4%** | 15,7% | 4,3% |
  | adaptativa (favorito → recuperar, senão preparar) | 14,7% / 26,1% | 16,0% | 5,0% |
  | manter (= nenhuma, idêntico por desenho) | 9,9% / 18,7% | 13,8% | 4,8% |
  | recuperar | **9,3% / 21,1%** | 12,7% | 3,8% |

  No domingo de campeonato, a tabela atual soma +0,5 para "preparar" (+0,4 QF, +0,25 SF, −0,15 final) e
  +0,1 para "recuperar" (−0,15, −0,15, +0,4): **recuperar é quase sempre a escolha pior**, e a decisão não
  depende do contexto como o texto da tela sugere. Na carreira inteira, o efeito some no ruído (0–2 pp de
  título até a S10).
- **Reputação negativa no Worlds = meta da temporada.** Terminar o Worlds (último evento) roda o fechamento
  da temporada no mesmo passo: o campeão vai a 100 e, se não cumpriu a meta, perde `repRisk` logo em
  seguida. A telemetria atribuía isso ao Worlds. Saturação confirmada: 98% dos campeões de Major/Worlds já
  estavam em 100.
- **Química travada em 67% (trio sem herança):** por par, `min(4,0; splits × 2,0)` + herança sobre um máximo
  de 6,0. Na carreira, a química vale até +2,0 de rating no Normal (1,3 Easy, 2,4 Hard), só para o usuário:
  ir de 67% a 100% = **+0,67 de rating** para elencos estáveis. É um buff relevante, que precisa de
  contrapartida.
- **Registros corrigidos (telemetria, no branch):** o qualifier gravava `swiss_exit` para todos porque a
  telemetria usava uma função de colocação que não trata torneio só-Swiss (o jogo usa a certa: `top8` =
  passou). `prompts` = 0 porque desde o rc.36 nenhuma proposta de treino fica esperando: agora conta o
  plano escolhido pelo gestor. `unavailable` = 0 está **correto**: todo elenco de bot tem 3 jogadores, e
  ninguém é afastado sem reserva. Observação de design: um elenco de 3 é imune à indisponibilidade, então
  ter reserva hoje só traz risco.

---

## 4. Experimentos (triagem, pareados com a bateria)

### E1. Renovação sozinha (sem mexer no crescimento dos jovens)

Normal · 7 regiões × 3 elencos · seed 9100 · perfis `academy`, `prospectsOnly` (jovens), `homegrown`,
`experienced` (manter) · 84 carreiras por braço.

| Braço | O que muda | Jovens: título do Worlds (perdeu / ganhou, pareado) | Jovens: alcance do Worlds | Manter: título / falência | Reajuste × salário antigo p90 / máx | Renovação ÷ mercado p50 (jovens) | Folha ÷ receita S6–S10 (jovens) |
|---|---|---|---|---|---|---|---|
| controle | rc.37 | **52%** | 76% | 2% / 5% | 3,9 / 3,9 | 0,36 | 0,60 |
| R15 | piso de valor 15 / 25 / 35% | 36% (−8 / +1) | 76% | 0% / 5% | 6,2 / 30 | 0,45 | 0,76 |
| R30 | piso de valor 30 / 45 / 60% | 19% (−15 / +1) | 71% | 0% / 2% | 11 / 38 | 0,52 | 0,91 |
| R55 | piso de valor 55 / 70 / 80% (relatório) | 14% (−16 / 0) | 60% | 0% / 2% | 16,5 / 54 | 0,70 | 0,88 |
| **J4** | **salto ×2,5 → ×4,0 na 1ª, teto ×3,0 → ×5,0** | **31% (−10 / +1)** | 71% | 0% / 2% | **5,5 / 6,2** | 0,60 | 0,78 |

Por perfil: `academy` 57% → R15 33% · R30 24% · R55 14% · J4 33%; `prospectsOnly` 48% → 38% · 14% · 14% ·
29%. Nenhum braço quebrou os jovens (falência 0–2%): o bot vende os craques que não cabem (vendas S1–S10 de
1 → 3–5 com os pisos altos). Por isso a leitura estática do item 3.1 superestimava a quebra.

**Leitura:**
- **Quanto da vantagem a retenção barata explica:** de um terço (R15, J4) a três quartos (R55) dos títulos
  dos jovens. O resto vem do desenvolvimento em si, que o Miguel quer preservar.
- **A renovação sozinha não cria diversidade.** Os outros perfis continuam em 0–5% de título, e a taxa geral
  de títulos cai (27% → 7–18% neste recorte). Corrigir A sem B deixa o jogo inteiro mais difícil, que é o que
  queremos evitar.
- **J4 é a melhor relação efeito × atrito:** corta a vantagem como o R15, mas o reajuste por renovação fica
  limitado a ~5–6× (os pisos chegam a 30–54×), usa dois parâmetros que já existem e não dá choque em save
  existente (o craque barato sobe por degraus nas próximas renovações). O jovem de contrato curto renova com
  frequência, e os saltos acumulam (×4 → ×4,25 → ×4,5…).
- Os pisos de 55/70/80% fazem o que prometem, mas tiram quase todo o retorno de formar craques (jovens a
  14%, com o alcance do Worlds caindo de 76% para 60%) e produzem reajustes de até 54×. **Rejeitar como
  valor de partida.**

### E3. Regiões fáceis (vagas intactas; EU, NA e SAM sem mudança)

Normal · SSA, APAC, OCE, MENA × 3 elencos · seed 9100 · perfis `academy`, `coachUpgrades`, `stars`,
`homegrown` · 48 carreiras por braço (12 por região: leitura de direção, não de casa decimal).

| Região | Braço | Chega ao Worlds | 1º Worlds p50 | Título do Worlds | Rating S6 | Caixa S10 p50 |
|---|---|---|---|---|---|---|
| SSA | controle | 100% | S2 | 25% | 92,9 | 443k |
| | E3-F (cena +2,5) | **42%** | S5 | 17% | 83,8 | 111k |
| | E3-S (fundadores −4) | **75%** | S4 | 17% | **92,9** | 353k |
| APAC | controle | 100% | S2 | 33% | 94,2 | 454k |
| | E3-F (cena +2,0) | **58%** | S4 | 8% | 88,5 | 152k |
| | E3-S (fundadores −3) | **67%** | S4 | 17% | 91,2 | 308k |
| OCE | controle | 58% | S7 | 8% | 83,7 | 239k |
| | E3-F (cena +1,0) | 58% | S6 | 25% | 84,5 | 214k |
| | E3-S (fundadores −2) | 58% | S6 | 8% | 82,2 | 242k |
| MENA | controle | 33% | S7 | 8% | 85,5 | 113k |
| | E3-F (cena +0,5) | 25% | S6 | 8% | 81,8 | 64k |
| | E3-S (fundadores −1) | 33% | S5 | 8% | 83,6 | 88k |

- **E3-F (cena regional mais forte, só qualifier e Regional):** efeito persistente e amplificado pela
  economia. Sem os prêmios precoces, o time de SSA chega na S6 com 9 pontos a menos. A +2,5, SSA ficou abaixo
  de APAC e OCE: forte demais. Corta o acesso de todos os perfis (`stars` 58% → 25%, `homegrown` 75% → 42%).
- **E3-S (fundadores mais fracos, a hipótese do Miguel):** efeito transitório. Atrasa o 1º Worlds da S2 para a
  S4, e o time alcança o nível normal até a S6. Pesa sobre quem mantém os fundadores (`homegrown` 75% → 42%) e
  quase nada sobre quem troca o elenco.
- **Nas duas, a ordem "pool mais forte = mais difícil" continua** (EU 12%, NA 17% de alcance, intactos), e
  nenhuma região fácil vai mais ao Worlds na S1–S2.
- **Proposta para a confirmação:** uma mistura em doses menores, que tira a facilidade inicial sem punir o meio
  da carreira: fundadores SSA −3 / APAC −2 / OCE −1 e cena SSA +1,5 / APAC +1,0 / OCE +0,5 / MENA 0.
  Alvo por região no Normal (alcance do Worlds até a S10): SSA e APAC 55–75%, OCE 45–60%, MENA 25–40%, sem
  1º Worlds antes da S3.

### E2. Mercado acessível a quem já evoluiu (B)

Normal · 7 regiões × 3 elencos · seed 9100 · um ou dois perfis por família · 147 carreiras por braço
(E2-CAP: 63, só os perfis presos pela reputação).

**E2-G117: curva salarial mais plana** (`CAREER_SALARY.growthPerPoint` 1,20 → 1,17 por ponto acima de 70).
Pedidos e valores ficam mais baratos quanto mais alto o overall: 75 −12%, 80 −22%, 85 −31%, 90 −40%
(abaixo de 70 ficam um pouco mais caros: 65 +13%).

| Perfil (família) | Título do Worlds | Ganhou / perdeu | Título do Major | Alcance do Major | Falência | Folha ÷ receita S6–10 | Rating S10 |
|---|---|---|---|---|---|---|---|
| `academy` (jovens) | 57% → 52% | +1 / −2 | 67% → 71% | 95% → 90% | 0% → 0% | 0,51 → 0,59 | 95,3 → 96,5 |
| `ambitious` (comprar) | **0% → 33%** | **+7 / −0** | 5% → 24% | 71% → 81% | 10% → 10% | 0,82 → 0,72 | 93,3 → 95,2 |
| `learner` (outros) | 0% → 14% | +3 / −0 | 0% → 14% | 48% → 67% | 5% → 0% | 1,30 → 1,00 | 91,4 → 94,2 |
| `stars` (comprar) | 5% → 10% | +2 / −1 | 5% → 10% | 33% → 33% | 0% → 0% | 0,92 → 0,83 | 80,1 → 79,8 |
| `known` (comprar) | 0% → 5% | +1 / −0 | 0% → 10% | 33% → 38% | 0% → 0% | 0,91 → 0,79 | 80,0 → 81,3 |
| `trader` (negociar) | 0% → 5% | +1 / −0 | 5% → 24% | 48% → 52% | 0% → 0% | 1,19 → 0,88 | 88,3 → 91,7 |
| `homegrown` (manter) | 0% → 5% | +1 / −0 | 5% → 10% | 52% → 52% | 10% → 0% | 0,81 → 0,64 | 80,9 → 81,9 |
| **todos** | **9% → 18%** | **+16 / −3** | 12% → 23% | 54% → 59% | 3% → 1% | 0,86 → 0,72 | 88,6 → 93,0 |

**Leitura:** é o complemento do A. O mercado intermediário fica alcançável e o caminho "comprar prontos"
(`ambitious`) passa a ganhar, enquanto a academia quase não se beneficia (ela não compra). Também baixa a
falência e a folha ÷ receita de quem vive no limite. `stars` e `known` continuam presos, pelo teto de
contratação por reputação e por só aceitarem jogadores reais (ver E2-CAP).

E2_REST_PLACEHOLDER

EXPERIMENTOS3_PLACEHOLDER
