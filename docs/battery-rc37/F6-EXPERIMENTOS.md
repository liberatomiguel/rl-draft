# Rocket Draft rc.37 F6: integração, diagnóstico e primeiros experimentos

**Data:** 09/11/2026 · **Branch:** `claude/rc37-balance` (a partir do `staging` rc.37 `7cccb34`) ·
**Base de comparação:** a bateria de 06/11 (`docs/battery-rc37/RELATORIO-COMPLETO.md`), dados brutos em
`C:\Users\Miguel\CLAUDE\rc37-battery\run1`.

> Nenhum valor de jogo foi mudado no `staging`. Tudo abaixo roda no branch de balanceamento, com as
> alavancas novas **desligadas por padrão**: o jogo do branch é idêntico ao do `staging` até um pacote ser
> aprovado.

---

## 0. Resumo em uma página

**O que foi feito**
- **Integração:** `staging` = **v2.0.0-rc.37** (rc.36.21 + a rodada rc.37 + o relatório da bateria),
  publicado; 2.095 testes, lint, tipos e export estático ok.
- **Branch de balanceamento** `claude/rc37-balance` com a ferramenta de experimento e alavancas novas
  **desligadas**: o jogo do branch é igual ao do `staging`.
- **~1.250 carreiras** em 17 braços de triagem, cada uma comparada com a mesma carreira da bateria (o código
  integrado reproduz a bateria bit a bit, então o controle não precisa ser rerodado).

**O que os dados mostram**
1. **A vantagem dos jovens tem fontes separáveis:** retenção barata (−21 pp de título no Normal com a
   alavanca J4), contratação barata (−12 pp) e o próprio desenvolvimento. A alavanca de crescimento proposta
   no relatório (`growthMult`) **não age** no modelo de crescimento atual.
2. **A causa de fundo é a escala dos preços:** um craque custa mais que a receita de qualquer time na
   S1–S10. Ninguém compra estrelas, e o mercado intermediário é inalcançável para quem não ganha.
3. **Corrigir só a renovação deixa o jogo mais difícil sem criar caminhos.** Uma curva salarial um pouco
   mais plana (1,20 → 1,17 por ponto) faz o "comprar prontos" funcionar e ainda baixa a falência.
4. **Juntos (P1, Normal):** jovens 52% → 38% de título do Worlds; comprar 0% → 24%; título geral estável
   (16% → 15%); Major 20% → 24%; falência 3% → 2%. Jovens × melhor não-jovem: **~10× → 1,6×**.
5. **Regiões:** as fáceis chegam cedo e fracas (em SSA, 61% dos Worlds terminam no Swiss); as difíceis
   chegam pouco e fortes. Fundadores mais fracos (a ideia do Miguel) atrasam o começo sem punir o meio da
   carreira; um pouco de cena regional mais forte completa. Na dose do P2, o 1º Worlds de SSA e APAC passa
   para a S3 e o alcance de APAC cai de 100% para 67%, com EU e NA intactos.
6. **Progressão:** metade das carreiras não-jovens nunca chega ao Major (EU 97%). O gargalo é o mercado
   intermediário, não a S1–S2.
7. **Endless:** o campeão vence em 54% das temporadas seguintes; quem chega sem título, em 4%. A defesa de
   título +0,5 não muda nada; +1 freia pouco e quebra 8% dos campeões. É uma questão de desenho.
8. **Sistemas:** a psicóloga funciona (~+0,2 de rating); o coach nunca troca a preleção; "recuperar" é quase
   sempre pior que "preparar"; a reputação negativa no Worlds é a meta da temporada; a química trava em 67%
   por desenho. Registros da telemetria corrigidos.

**Recomendação objetiva**
- **Aplicar, depois de confirmar nas 3 dificuldades:** A1 saltos de renovação ×4/×5 · B1 curva salarial
  1,17 · C1 regiões fáceis (fundadores e cena, dose do P2).
- **Rejeitar:** pisos de 55/70/80% · taxa de compra mais barata · teto de reputação mais alto · defesa de
  título +0,5.
- **Manter:** crescimento dos jovens · faixa de potencial (DEV-04) · receitas e prêmios · dificuldade da
  S1–S2 · EU e NA.
- **Testar a seguir:** química por convivência (para "manter o elenco") · tabela de preleção de campeonato ·
  reputação após título mundial · solução de desenho para a endless.

**Limiar de amostras adotado:** triagem de 48–147 carreiras (8–40 min por braço), confirmação de ~500
carreiras (~2 h) e validação de 882 (~3 h), contra 4.914 carreiras (21 h de relógio) da bateria.

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
falência e a folha ÷ receita de quem vive no limite. `stars` e `known` continuam presos por só aceitarem jogadores reais
conhecidos (o teto por reputação não é o gargalo, ver E2-CAP).

**E2-FEE: taxa de compra ~45% menor** (`CAREER_TRANSFER.contractLoadBase` 0,70 → 0,35,
`contractLoadPerSplit` 0,15 → 0,10; salários iguais):

| Perfil | Título do Worlds | Ganhou / perdeu | Falência | Folha ÷ receita S6–10 | Vendas S1–S10 |
|---|---|---|---|---|---|
| `academy` | 57% → 52% | +3 / −4 | 0% → 0% | 0,51 → 0,87 | 1 → 2 |
| `ambitious` | 0% → 33% | +7 / −0 | **10% → 19%** | **0,82 → 2,01** | **12 → 25** |
| `learner` | 0% → 10% | +2 / −0 | 5% → 5% | 1,30 → 1,84 | 17 → 29 |
| `trader` | 0% → 0% | +0 / −0 | 0% → 0% | 1,19 → 1,45 | 14 → 19 |
| `homegrown` | 0% → 10% | +2 / −0 | 10% → 10% | 0,81 → 0,82 | 1 → 1 |
| `stars` / `known` | 5% / 0% → 0% / 0% | — | 0% | ≈ | ≈ |
| **todos** | 9% → 15% | +14 / −5 | 3% → **5%** | 0,86 → **0,99** | 7 → 8 |

**Leitura:** baratear só a taxa estimula a rotatividade (compra e vende o dobro) com salários ainda caros: o
título sobe, mas a folha passa da receita e a falência sobe. A curva plana entrega o mesmo ganho de título com
a economia mais saudável. **G117 domina FEE: rejeitar FEE.**

**E2-CAP: teto de contratação +4** (`CAREER_UNLOCKS.signableCapBase` 71 → 75; `stars`, `known`,
`learner`, 63 carreiras): título do Worlds 2% → 2% (+0 / −0); só o alcance do Major do `learner` sobe
(48% → 71%). **O gargalo é dinheiro, não reputação: rejeitar.** `stars` e `known` continuam em 0–10% em
qualquer braço porque só aceitam jogadores reais conhecidos, que são poucos e caros. É um nicho do protocolo,
não um caminho que precise ser equalizado.

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

### P1. Combinação A + B + C (a pergunta que importa: o pacote junto cria caminhos sem endurecer o jogo?)

`renewalMaxJump` 4,0 + `jumpMax` 5,0 (J4) · `growthPerPoint` 1,17 (G117) · fundadores SSA −3 / APAC −2 /
OCE −1 e cena SSA +1,5 / APAC +1,0 / OCE +0,5. Normal · 7 regiões × 3 elencos · seed 9100 · 7 perfis ·
147 carreiras.

| Perfil | Título do Worlds | Ganhou / perdeu | Título do Major | Alcance do Worlds | Falência | Folha ÷ receita | Reajuste p90 |
|---|---|---|---|---|---|---|---|
| `academy` | 57% → **38%** | +2 / −6 | 67% → 52% | 90% → 76% | 0% → 0% | 0,51 → 0,62 | 3,9 → 6,2 |
| `prospectsOnly` | 48% → **38%** | +1 / −3 | 52% → 48% | 62% → 71% | 0% → 5% | 0,67 → 0,56 | 3,9 → 6,2 |
| `ambitious` | 0% → **24%** | +5 / −0 | 5% → 29% | 62% → 76% | 10% → 10% | 0,82 → 0,74 | 2,7 → 3,5 |
| `learner` | 0% → 5% | +1 / −0 | 0% → 19% | 48% → 52% | 5% → 0% | 1,30 → 1,07 | 3,7 → 4,0 |
| `trader` | 0% → 0% | +0 / −0 | 5% → 19% | 43% → 43% | 0% → 0% | 1,19 → 0,98 | 3,1 → 3,7 |
| `homegrown` | 0% → 0% | +0 / −0 | 5% → 0% | 52% → **33%** | 10% → 0% | 0,81 → 0,72 | 3,9 → 6,2 |
| `stars` | 5% → 0% | +0 / −1 | 5% → 0% | 33% → 19% | 0% → 0% | 0,92 → 0,83 | 3,7 → 3,8 |
| **todos** | **16% → 15%** | +9 / −10 | **20% → 24%** | 56% → 53% | 3% → 2% | 0,82 → 0,75 | 3,9 → 6,2 |

Metas do relatório (mesmas 147 carreiras):

| | Regional até o 2º split | Mediana 1º Major / 1º Worlds | Título até S10 | Jovens × melhor não-jovem | Falência | Alcance do Worlds por região |
|---|---|---|---|---|---|---|
| controle | 76% | S8 / S9 | 16% | 52% × 5% (**~10×**) | 3% | SSA 100 · APAC 100 · OCE 81 · MENA 33 · SAM 33 · NA 29 · EU 14 |
| P1 | 65% | S9 / S10 | 15% | 38% × 24% (**1,6×**) | 2% | SSA 81 · APAC 86 · OCE 76 · MENA 43 · SAM 43 · NA 29 · EU 14 |

**Leitura:**
- **Funciona sem endurecer o jogo:** o título geral fica igual (16% → 15%), o de Major sobe (20% → 24%), a
  falência cai, e passam a existir dois caminhos que vencem (formar e comprar), com o formar ainda à frente
  (1,6×, dentro da meta de ≤ 2×).
- **C ficou fraco na combinação:** SSA ainda vai ao Worlds na S2 (mediana) e o título em SSA até subiu
  (24% → 38%), porque a curva plana também fortalece quem compra. O P2 (rodando) testa a dose cheia dos
  fundadores (−4 / −3 / −2 / −1) com cena SSA +2,0 / APAC +1,5 / OCE +0,5.
- **`homegrown` é quem paga a conta de C** (alcance 52% → 33%, concentrado nas regiões fáceis): quem mantém
  os fundadores fica com fundadores mais fracos. A alavanca natural para dar fôlego a "manter o elenco" é a
  química por convivência (3.5), que recompensa exatamente o elenco estável.
- Nas regiões do meio, MENA e SAM sobem (33% → 43% de alcance, efeito da curva plana); EU e NA ficam iguais
  (14% e 29%), coerente com "o pool mais forte é o mais difícil".

### P2. Dose regional mais forte (no pacote)

Igual ao P1, com fundadores SSA −4 / APAC −3 / OCE −2 / MENA −1 e cena SSA +2,0 / APAC +1,5 / OCE +0,5.
Só as 4 regiões fáceis (84 carreiras), comparadas com as **mesmas carreiras do P1**.

| Região | Alcance do Worlds P1 → P2 | 1º Worlds p50 P1 → P2 | Título do Worlds P1 → P2 |
|---|---|---|---|
| SSA | 81% → 81% | S2 → **S3** | 38% → 33% |
| APAC | 86% → **67%** | S3 → S3 | 29% → 19% |
| OCE | 76% → 71% | S5 → S5 | 19% → 19% |
| MENA | 43% → 52% | S6 → S7 | 10% → 24% |

**Leitura:** a dose cheia tira o Worlds da S2 em SSA e traz APAC para a faixa-alvo. SSA continua alto (81%):
na confirmação, testar a cena a +2,5. Em MENA, o fundador −1 deixa a folha inicial mais barata e, com a curva
plana, isso vira mercado: o alcance sobe em vez de cair. Para MENA, fundador 0 é o mais coerente.

### E4. Endless: quem chegou sem vencer, e a defesa de título

**E4-NC (balance atual):** 30 carreiras do Normal **sem título do Worlds até a S10** (regiões e perfis
variados), estendidas até a S20.

| | n | ≥ 1 título S11–S20 | Temporadas com título | Rating S11 → S20 | Compras / vendas S11–S20 | Caixa S20 p50 | Falência |
|---|---|---|---|---|---|---|---|
| não-campeões até a S10 | 30 | **13%** | **4%** | 88,2 → 89,5 | 15 / 5 | 509k | 0% |
| campeões até a S10 (bateria, 155) | 155 | 95% | 54% | 95,6 → 95,5 | 9 / 3 | 3,73M | 1% |

**Leitura:** a endless é polarizada. Quem já venceu vence em mais da metade das temporadas; quem não venceu
quase nunca vence depois (87% passam dez temporadas sem título), com o rating parado ~6 pontos abaixo. O
problema da endless não é só o "campeão eterno": é também a falta de caminho para quem chega sem título. A
curva plana (B1) deve ajudar este grupo (mercado mais acessível); medir na confirmação.

**E4-TD05 / E4-TD10 (defesa de título):** rivais do Worlds +0,5 / +1,0 a partir do 1º título do usuário
(`CAREER_TITLE_DEFENSE.worldsShiftPerTitle`, até 1 título), nos 39 campeões de Normal e Hard da bateria,
S1–S20 (a carreira é idêntica até o 1º título). Pareado com as mesmas 39 carreiras estendidas na bateria.

| Braço | ≥ 1 título S11–S20 | Temporadas com título S11–S20 | Sequência p50 / p90 | Espera pelo novo título p50 | Caixa S20 p50 | Falência |
|---|---|---|---|---|---|---|
| controle | 95% | **52%** | 4 / 6 | 2 | 11,8M | 3% |
| +0,5 | 92% | 52% | 4 / 7 | 3 | 11,2M | 3% |
| +1,0 | 90% | **45%** | 3 / 6 | 4 | 8,3M | **8%** |

Por que o efeito é pequeno: na S11–S20, o campeão enfrenta rivais **≥ 2 pontos mais fracos em 70–76% das
séries** e vence 96–100% delas (com 2 pontos de vantagem o motor já dá ~95% de vitória). Somar +0,5 ou +1 no
Worlds só aproxima algumas séries. A dominância é estrutural: o campeão monta um elenco de ~96, tem caixa de
oito dígitos e a IA da era infinita não acompanha.

**Leitura:**
- **+0,5 não muda nada: rejeitar.** +1,0 freia pouco (52% → 45%) e cria falência no topo (folha de milhões
  sem o prêmio do Worlds): também não recomendo sozinho.
- O que mexeria de verdade é de desenho, para decidir com o Miguel: (a) orgs de IA que se reforçam na era
  infinita (contratam do topo do pool, como o usuário); (b) assédio às estrelas de uma dinastia (propostas
  que o craque quer aceitar); (c) um teto suave pela folha (o prêmio de título na renovação já existe, mas
  com caixa de 8–12M ele não pesa).

### A-dim. As outras fontes da vantagem dos jovens, uma de cada vez

Normal · 7 regiões × 3 elencos · seed 9100 · `academy` e `prospectsOnly` · 42 carreiras por braço, cada
braço com **uma** mudança só (a retenção já foi medida no E1).

- **A-INFO, informação de potencial** (faixa visível sem relatório 5 → 12 pontos, topo até 5 acima do real):
  **não medido.** Com a faixa larga, a busca de mercado do bot da academia fica ~15× mais lenta e uma
  carreira por shard estourou o orçamento de 10 min ainda na S1–S2 (carreiras truncadas). Encerrei o braço.
  Como a faixa estreita é decisão do Miguel (DEV-04, 30/10), a informação fica como está. Se for preciso
  medir depois, a forma mais barata é cobrar para ver a faixa (custo do relatório), não alargá-la.

- **A-HIRE, preço de contratar talentos** (`CAREER_TALENT.upsideTiers` ×1,5 por ponto de alcance): jovens
  **52% → 40%** (−6 / +1; `academy` 57% → 38%, `prospectsOnly` 48% → 43%), alcance do Worlds igual (76%),
  caixa igual. Contratar promessas barato explica cerca de um quarto da vantagem.
- **A-GROW, crescimento** (`CAREER_AGE.growthMult` u16 1,5 → 1,30, 17–18 1,25 → 1,12, a proposta T2 do
  relatório): resultado **idêntico ao controle** em todas as 42 carreiras. O parâmetro não chega ao
  desenvolvimento do usuário: no modelo de crescimento atual (contrato de crescimento, modelo 2+), o jogador
  sobe pelo ritmo até o potencial na idade de pico (`contractPacePerWeek`, limitado por
  `CAREER_DEV.seasonGainCap` = 7 por temporada). `growthMult` só vale para o modelo antigo (rc.31) e para os
  jogadores da IA. **Correção ao relatório:** a T2 não teria efeito. Se um dia for preciso frear os jovens, a
  alavanca certa é o ritmo do contrato (por exemplo, `seasonGainCap` 7 → 6), não `growthMult`.

**Decomposição da vantagem dos jovens (Normal, título do Worlds 52%, uma mudança por vez):** retenção barata
(J4) −21 pp · contratação barata (A-HIRE) −12 pp · informação de potencial: não medida · crescimento: a
alavanca do relatório não age. O resto é o próprio desenvolvimento (o jovem chega ao potencial), que é o
que o Miguel quer preservar.

---

## 5. Pacote provisório (para aprovação de direção; nada aplicado ao staging)

Valores medidos só no **Normal, 1 seed**: a direção está clara, e os números finais saem da confirmação
(Parte 6). Nada disto está no `staging`.

**Aplicar (depois da confirmação)**

| # | Item | Valor atual → proposto | Efeito medido (Normal) | Impacto em save existente |
|---|---|---|---|---|
| A1 | Renovação: saltos maiores, sem piso de valor | `CAREER_SALARY.renewalMaxJump` 2,5 → **4,0**; `CAREER_RENEWAL_TENURE.jumpMax` 3,0 → **5,0** | jovens 52% → 31% sozinho, 38% no pacote; reajuste p90 ~6×, máximo 6,2× por renovação | só renovações futuras; o craque barato sobe por degraus, sem migração |
| B1 | Curva salarial mais plana acima de 70 | `CAREER_SALARY.growthPerPoint` 1,20 → **1,17** | título geral 9% → 18% sozinho; `ambitious` 0% → 33%; falência 3% → 1% | contratos atuais mantidos; pedidos, valores e taxas futuros mais baratos (85 −31%, 90 −40%); venda dos próprios craques rende menos; abaixo de 70, +13% no 65; coaches não mudam (curva própria) |
| C1 | Começo mais lento nas regiões fáceis | `CAREER_REGION_FIELD.starterOvrOffset` 0 → **SSA −4, APAC −3, OCE −2** (MENA 0); `.shift` 0 → **SSA +2,0 a +2,5, APAC +1,5, OCE +0,5** (só qualifier e Regional) | P2 no pacote: 1º Worlds de SSA e APAC na S3 (era S2); alcance APAC 100% → 67%, SSA 100% → 81%; EU/NA intactos | fundadores: só carreiras novas; cena: vale já nos próximos eventos regionais de saves em SSA/APAC/OCE |
| F1 | Telemetria da bateria corrigida | qualifier com `advanced`; `prompts` = plano escolhido | — | nenhum (ferramenta de teste) |

**Manter (não mexer agora)**
- Crescimento dos jovens: com A1 + B1 os jovens já ficam a 1,6× do melhor não-jovem, e a alavanca do
  relatório (`growthMult`) nem age no modelo atual (A-dim). Fica como está.
- Em reserva, se a confirmação mostrar os jovens acima de 2× o melhor não-jovem: talentos mais caros de
  contratar (`CAREER_TALENT.upsideTiers` ×1,5; sozinho, jovens 52% → 40%).
- Faixa de potencial visível (DEV-04, decisão do Miguel em 30/10): medição só informativa (A-INFO).
- Receitas e prêmios: o P1 manteve o título geral e baixou a falência **sem** mexer em receita.
- Dificuldade geral da S1–S2: o excesso de facilidade inicial é regional (C1), não global.
- Vagas e força de EU e NA (decisão do Miguel: os pools mais fortes ficam mais difíceis).
- Psicóloga (funciona, ~+0,2 de rating equivalente): só falta a tela dizer o que ela faz.

**Rejeitar**
- Pisos de valor 55/70/80% (e 30/45/60% como padrão): tiram quase todo o retorno de formar craques e
  produzem reajustes de até 38–54×.
- Taxa de compra mais barata sozinha (E2-FEE): dobra a rotatividade, a folha passa da receita, a falência
  sobe.
- Teto de contratação mais alto (E2-CAP): nenhum efeito em título.
- Cena regional de SSA a +2,5 sozinha: forte demais (SSA abaixo de APAC e OCE).
- Defesa de título por rating no Worlds: +0,5 não muda nada; +1,0 freia pouco (52% → 45% das temporadas)
  e leva o campeão à falência em 8% dos casos.

**Ainda precisa ser testado**
- Dose de SSA: na combinação, SSA ainda chega ao Worlds em 81% (alvo 55–75%); testar cena +2,5 na
  confirmação.
- Química por convivência: dar fôlego a "manter o elenco" (`homegrown` é quem perde com C1). Precisa de uma
  alavanca de duas inclinações (até 67% como hoje, depois devagar até 100%) e de contrapartida, porque 67% →
  100% vale +0,67 de rating.
- Tabela de preleção de campeonato: tornar "recuperar" uma escolha boa quando o time é favorito (por exemplo,
  final +0,6), medido por contrafactual no domingo.
- Reputação: o título do Worlds cumprir qualquer meta da temporada (o campeão não perde reputação no
  fechamento); separar na telemetria a meta do resultado.
- Confirmação em Easy e Hard e validação com a segunda seed (Parte 6).

**Decisões que ficam com o Miguel**
1. **Direção A1 + B1 + C1:** aprovar para eu rodar a confirmação (Parte 6) com esses valores.
2. **EU e NA no Normal:** 14% e 29% de alcance do Worlds até a S10 no P1, e na EU 97% das carreiras
   não-jovens do controle nunca chegam ao Major. É o "mais difícil de propósito" ou difícil demais?
3. **Meta da temporada depois de um título mundial:** o campeão deixa de perder reputação no fechamento?
4. **Química por convivência** com contrapartida: seguir para teste?
5. **Elenco de 3 imune à indisponibilidade:** hoje ter reserva só traz risco. Manter assim?
6. **Endless:** a dominância do campeão é estrutural (elenco ~96 contra IA ~90–93). Qual caminho de desenho
   seguir: IA que se reforça na era infinita, assédio às estrelas de uma dinastia ou teto suave pela folha?
   E para quem chega sem título (13% vencem depois): a curva plana basta, ou precisa de algo próprio?

---

## 6. Próximos passos e custo

1. **Confirmação do pacote** (depois da aprovação de direção): A1 + B1 + C1 nas **3 dificuldades** × 21
   situações × seed 9100 × 8 perfis (`academy`, `prospectsOnly`, `ambitious`, `stars`, `trader`,
   `homegrown`, `learner`, `coachUpgrades`) = 504 carreiras, **~2 h** de máquina. Pareada com a bateria.
2. **Ajuste fino**, se a confirmação pedir: um ou dois braços de triagem (25–40 min cada).
3. **Validação final**, uma vez: os 14 perfis base × 63 situações na **seed 17019** (réplica nova) = 882
   carreiras, **~3 h**, mais uma amostra pequena da endless (S20) se a defesa de título entrar.
4. **Pacote no staging:** um commit de versão nova (depois da rc.38.3 atual do staging) com os valores, `BALANCE_VERSION` 16, testes de
   regressão atualizados (os que fixam números da renovação e da curva), CHANGELOG, DESIGN/ROAD-TO-WORLDS
   decisions e STATUS. Só depois do seu OK no pacote final.

Custo total até o staging: ~5–6 h de máquina e pouco tempo de análise, contra ~21 h de relógio da bateria.

**Como rodar um braço** (Git Bash, a partir de um worktree fixado no commit do experimento, com
`node_modules` em junction):

```bash
HUMAN_EXPERIMENT=1 HUMAN_EXP=C:/caminho/spec.json HUMAN_DIR=C:/Users/Miguel/CLAUDE/rc37-battery/f6/<braço> HUMAN_SHARDS=6 HUMAN_SHARD=0 node node_modules/vitest/vitest.mjs run src/store/auditHumanExperiment.test.ts
```

**Atenção ao desmontar o worktree:** apague antes só a junction (PowerShell
`[System.IO.Directory]::Delete("<worktree>
ode_modules")`) e confira que o `node_modules` do projeto
continua lá. O `git worktree remove --force` segue a junction e apaga o `node_modules` real (aconteceu em
09/11; restaurado com `npm ci`).

Um processo por shard (0 a 5). Comparar: `node src/store/auditHumanSummaryF6.mjs --arm <pasta> --by
profile|family|region`. As specs e as pastas de resultado ficam em `C:\Users\Miguel\CLAUDE\rc37-battery\f6`.

---

## 7. Rodada de 09–10/11: pacote aplicado, frentes A–F, correção do banco e validação

**Estado:** tudo no branch `claude/rc37-balance`, um commit por etapa, `BALANCE_VERSION` 16. **Nada no
`staging`.** Decisões R100–R108 em `ROAD-TO-WORLDS-DECISIONS.md`. Dados brutos em
`C:\Users\Miguel\CLAUDE\rc37-battery\f6`.

### 7.0 Resumo em uma página

**O pacote final (o que está no branch)**

| # | Item | Valor |
|---|---|---|
| 1 | Renovação em degraus maiores (aprovado) | salto ×4,0 a ×5,0 no Easy e no Normal; **no Hard fica o do staging** (×2,5 a ×3,1) |
| 2 | Curva salarial mais plana (aprovado) | 1,20 → 1,17 por ponto, nas três dificuldades |
| 3 | Regiões fáceis mais lentas (aprovado) | fundadores SSA −4 / APAC −3 / OCE −2; cena SSA +2,0 / APAC +1,5 / OCE +0,5 no Easy e no Normal; **sem reforço de cena no Hard** |
| 4 | Química por convivência | cresce até 100% com tempo e séries oficiais; trio de regiões diferentes fica Perfeito em ~4 temporadas; trocar um titular de um núcleo antigo custa 100% → 78% |
| 5 | Reserva | elenco de 3 também sofre ausência (4% por evento oficial); sem reserva o time não joga aquele evento; reserva só assina na janela; 1ª temporada isenta |
| 6 | Reputação proporcional | org de 50–74 ganha inteiro por título, Major e Worlds; org de 75+ não ganha mais com qualifier e Regional; título nunca rende zero; campeão mundial não perde pela meta |
| 7 | Psicóloga | +5/+5 por 4.500 por split (era +3/+3 por 4.000) |
| 8 | Preleção de campeonato | "recuperar": final +0,4 → +0,6 |
| 9 | Banco | sem empréstimo comum com o caixa negativo; no vermelho só o de emergência, que é contado |
| 10 | Rivais de dinastia | alavanca criada, **desligada** |

**Validação final contra o staging** (seed 17019, 147 carreiras por dificuldade, cada carreira comparada com
ela mesma na bateria):

| | Easy | Normal | Hard |
|---|---|---|---|
| Título do Worlds até a S10 | 45% → **57%** | 22% → **21%** | 14% → **16%** |
| Título: formar jovens | 98% → 93% | 76% → **62%** | 48% → 52% |
| Título: comprar | 24% → **50%** | 0% → **7%** | 0% → 0% |
| Título: outros estilos | 24% → 38% | 2% → 3% | 0% → 2% |
| Alcance do Worlds | 82% → 75% | 63% → **51%** | 46% → 37% |
| 1º Major (mediana de todas as carreiras) | S4 → S4 | S7 → **S10** | depois da S10 nos dois |
| Falência | 1% → 1% | 3% → 5% | 19% → 15% |
| Caixa na S10 (mediana) | 598k → 800k | 226k → 161k | 84k → 88k |

Easy e Hard rodaram com a química a 0,15; a dose final é 0,10 (medida no Normal). O efeito esperado nos
dois é um título um pouco menor do que o da tabela.

**Leitura**
- **Dificuldade geral:** Normal e Hard ficaram no nível do staging em título; o Easy ficou mais fácil.
- **Estilos:** comprar passou a vencer no Easy e no Normal; formar jovens caiu no Normal (76% → 62%) mas
  continua sendo o melhor caminho. No Hard só os jovens vencem, como já era.
- **Progressão:** está mais lenta no Normal. O alcance do Worlds caiu 12 pontos e o 1º Major mediano foi da
  S7 para a S10. É o custo somado das regiões fáceis mais lentas (aprovado), da regra de reserva e da
  correção do banco. É o ponto que mais merece a sua atenção (7.9).
- **Falência:** estável no Easy, +2 pontos no Normal (a correção do banco tira a muleta dos empréstimos em
  série), melhor no Hard.

### 7.1 Como os testes foram reduzidos

A rodada inteira usou ~6 h de máquina em segundo plano ao longo de uma noite, em blocos de 10 a 30 minutos,
contra as 21 h da bateria. O que permitiu:

1. **O Normal do pacote aprovado não precisou de carreira nova:** com os valores no `balance.ts`, o código
   reproduz bit a bit as carreiras dos braços P1 e P2 (6 de 6 idênticas). As 147 já rodadas viraram a base
   do pacote (`f6/PKN`).
2. **Quadrado latino na triagem:** 7 regiões × 7 perfis com o elenco inicial em rodízio (49 carreiras por
   braço, ~10 minutos), e elencos completos só onde estava a pergunta.
3. **Sondas do motor em vez de carreiras** para valores que só agem na partida (psicóloga, preleção).
4. **Métrica sensível antes da rara:** além do título, a comparação pareada lê rating, química, reputação,
   caixa e reserva por temporada (`f6/cmp.mjs`, `f6/sum.mjs`).
5. **Validação grande só uma vez, no fim, numa seed nova:** 147 carreiras por dificuldade na seed 17019,
   que a bateria também tem como controle.
6. **Worktree de execução sem junction** (`.claude/worktrees/f6-run*`): o Node acha o `node_modules`
   subindo de pasta.

**O limite, medido na prática:** com 49 carreiras, diferenças de 2 ou 3 títulos são ruído. Três decisões
desta rodada só ficaram claras com 147 carreiras (a dose da química, o Hard e a diferença entre seeds: quem
forma jovens vence 52% na seed 9100 e 76% na 17019, no mesmo jogo).

### 7.2 Pacote aprovado nas três dificuldades (antes das frentes novas)

| Dificuldade | n | Título do Worlds | Alcance do Worlds | Falência |
|---|---|---|---|---|
| Easy (controle → pacote) | 49 | 49% → 59% | 76% → 71% | 2% → 2% |
| Normal (P1 + P2) | 147 | 16% → 13–15% | 56% → 50–53% | 3% → 2% |
| Hard (EU e NA em peso triplo) | 77 | 9% → **1%** | 32% → 14% | **18% → 27%** |

O pacote era neutro no Normal e quebrava o Hard: quem renova tudo sem vender ia à falência
(`prospectsOnly` 18% → 64%), e APAC caía de 100% para 14% de alcance do Worlds.

**Decomposição do Hard** (44 carreiras por braço, 4 perfis, contra o staging: título 16%, alcance 43%,
falência 14%):

| Braço | Título | Alcance do Worlds | Falência |
|---|---|---|---|
| Pacote completo, salto ×4,0 | 2% | 14% | 23% |
| Salto ×3,25 | 7% | 20% | 18% |
| Salto ×2,5 (staging) | 5–7% | 18–23% | 11–14% |
| Salto ×2,5 e curva 1,20 (staging) | 2% | 27% | 20% |

- O salto de renovação maior é a causa da falência no Hard.
- A curva salarial não é: devolver 1,20 só piorou.
- O resto da queda vem das regiões fáceis, calibradas no Normal.

**Decisão (R108):** o Hard fica com o salto do staging e sem o reforço de cena nas regiões fáceis. Os
fundadores mais fracos continuam valendo no Hard, porque o assistente mostra o elenco antes de o jogador
escolher a dificuldade.

### 7.3 A. Química por convivência (R102)

**Regra:** até dois splits juntos, como hoje (trio de três regiões chega a 67%, mesma região a 92%). Depois
o par continua ganhando devagar até 100%, e cada série oficial jogada junto conta como tempo. A
nacionalidade só define de onde o par parte. O recém-chegado herda apenas a fase rápida.

**Dose, medida no Normal** (seed 17019, 147 carreiras por braço):

| Química | Título geral | Formar jovens | Comprar | Outros | Alcance do Worlds |
|---|---|---|---|---|---|
| Staging | 22% | 76% | 0% | 2% | 63% |
| Pacote final **sem** a fase lenta | 17% | 52% | 5% | 2% | 48% |
| **0,10 (escolhida)** | **21%** | **62%** | **7%** | **3%** | **51%** |
| 0,15 | 25% | 74% | 10% | 3% | 52% |

Antes disso, na seed 9100 (63 carreiras): a dose 0,25 sozinha, com a herança sem limite, levou os dois
perfis de jovens de 14–29% para **71%** de título, com os outros estilos parados.

**Leitura:**
- Quem mais ganha com a química não é o `homegrown` (os fundadores já partem de 92% pela região e o limite
  deles é o potencial): é quem forma jovens, porque mantém por anos um trio de regiões diferentes.
- Sem a fase lenta, o pacote completo deixa o Normal mais duro que o staging (17% contra 22%). A dose 0,10
  devolve a dificuldade geral ao nível do staging e mantém o corte nos jovens (76% → 62%).
- **Contrapartida rejeitada:** rivais de Major e Worlds +0,5. Sobre o pacote completo só tirou títulos
  (10% → 6%). A alavanca (`CAREER_REGION_FIELD.tierShift`) fica em 0.

### 7.4 B. Reserva e indisponibilidade (R103)

**Regra:**
- Um titular de um elenco de 3 pode ficar fora de um evento oficial, como qualquer outro.
- Sem reserva, o time **não joga aquele evento**, seja Regional, Major ou Worlds. O cartão do HQ nomeia o
  ausente e oferece "Ficar fora deste evento"; o Mercado só aparece se uma janela estiver aberta.
- **Reserva só assina na janela de transferências** (Miguel, 10/11).
- A primeira temporada é isenta para quem não tem reserva (decisão minha).
- Três jogadores sob contrato continuam fazendo scrim durante a ausência.
- **Frequência: 4% por evento oficial** (era 8%), cerca de uma ausência a cada duas temporadas. Até aqui
  ninguém sentia essa taxa, porque elenco de 3 era imune. A 8% custava perto de um evento por temporada e
  ~8 pontos de alcance do Worlds no Normal (decisão minha).
- **Aviso ao jogador (EN/PT):** o slot vazio de reserva na tela de Elenco, a entrada de ajuda, um e-mail do
  clube no começo da 2ª temporada, o e-mail da ausência e o e-mail do evento perdido.
- **Bots:** mantêm um reserva modesto a partir da 2ª temporada, contratado na janela. Ficam com reserva em
  ~53% das temporadas.

**Custo medido** (Normal, 49 carreiras, a 8%, sem química, contra o pacote): título 10% → 4%, alcance do
Worlds 49% → 43%. Foi o que motivou cortar a frequência pela metade.

### 7.5 C. Reputação proporcional (R104)

**Regra:** o tamanho da org é dado pelos portões 25 / 50 / 75. No nível da org ou acima, o resultado paga
inteiro; um nível abaixo, metade arredondada **para cima**; mais abaixo, nada. Título nunca paga menos de
+1. O campeão mundial da temporada não perde reputação pela meta.

| Resultado | Rep < 50 | Rep 50–74 (antes, de 60 em diante) | Rep 75+ (antes) |
|---|---|---|---|
| Passar do qualifier (+1) | +1 | +1 (+1) | **0** (+1) |
| Top 8 de Regional (+1) | +1 | +1 (+1) | **0** (+1) |
| Top 4 de Regional (+2) | +2 | +1 (+1) | **0** (+1) |
| Título de Regional (+4) | +4 | **+4** (+2) | +2 (+2) |
| Vaga em Major (+2) | +2 | **+2** (+1) | +1 (+1) |
| Top 4 / título de Major (+4 / +7) | +4 / +7 | **+4 / +7** (+2 / +4) | **+4 / +7** (+2 / +4) |
| Vaga / top 4 no Worlds (+8 / +10) | +8 / +10 | **+8 / +10** (+4 / +5) | **+8 / +10** (+4 / +5) |

**Primeira versão rejeitada:** metade arredondada para baixo. Travou as orgs médias em torno de 50 de
reputação (mediana na S10 de 67 para 46). Com o arredondamento para cima, a mediana na S10 fica em 63 (pacote sem as frentes novas: 67).

### 7.6 D. Psicóloga e E. preleção (R105), por sonda do motor

**Psicóloga +5/+5** (12 mil séries por ponto):

| Atributos do time | Bo3 (Swiss) | Bo5 (playoffs) | Bo7 (playoffs) |
|---|---|---|---|
| 78 | 50,7% → 54,4% (≈ +0,32 de rating) | 50,6% → 53,5% (+0,30) | 50,6% → 53,6% (+0,23) |
| 84 | 49,3% → 56,1% (+0,50) | 50,6% → 55,8% (+0,50) | 50,0% → 55,5% (+0,37) |
| 90 | 50,1% → 56,3% (+0,40) | 50,5% → 56,3% (+0,48) | 50,5% → 54,8% (+0,30) |

Em pontos de rating, +0,23 a +0,50 (com +3/+3 era +0,13 a +0,31). **Preço: 4.500 por split** (Miguel,
10/11). A 6.000 ela custava ~22% da folha no momento em que desbloqueia e 2,6× o preço do mesmo rating
comprado em salário.

**Preleção de campeonato** (chance de título no domingo; quartas Bo5, semi e final Bo7; 30 mil séries):

| Situação | Manter | Recuperar antes (final +0,4) | **Recuperar agora (final +0,6)** | Preparar |
|---|---|---|---|---|
| Muito favorito | 42,9% | 42,2% | **43,9%** | 42,6% |
| Favorito | 25,3% | 25,0% | **26,1%** | 25,4% |
| Equilibrado | 10,4% | 10,1% | 10,9% | 10,7% |
| Azarão | 2,2% | 2,1% | 2,3% | 2,3% |

"Recuperar" nunca compensava; agora é a escolha do favorito (+1 ponto de título). "Preparar" continua sendo
o plano de quem precisa primeiro passar das quartas.

### 7.7 Banco: sem empréstimo comum no vermelho (R107)

Relato do Miguel jogando no staging (10/11): com o caixa negativo o banco continuava oferecendo
empréstimo, várias vezes, quando a carreira já devia ter falido.

- **Causa:** a oferta de segunda-feira olhava só o fôlego de caixa, "também quando já negativo", a cada 8
  semanas, e o pedido na tela de Finanças não tinha regra de saldo. Um déficit permanente emendava
  empréstimos comuns e nunca chegava ao piso, onde entra o de emergência (o único contado).
- **Correção:** com o caixa abaixo de zero o banco não faz empréstimo comum, nem por oferta nem por pedido.
  A tela de Finanças diz o motivo. No vermelho só existe o empréstimo de emergência, no piso, com o limite
  de sempre (3 / 2 / 1 por dificuldade).
- **Não mudou:** o piso (8 semanas de contas). O de emergência continua entrando só nele.

### 7.8 F. Endless e rivais de dinastia (R106)

Normal, 28 carreiras do pacote final estendidas até a S20:

| | Campeões até a S10 (10) | Sem título até a S10 (18) |
|---|---|---|
| Temporadas com título, alavanca desligada | 66% | 32% |
| Temporadas com título, rivais +1,5 por título (teto +3) | 45% | 27% |
| Sequência mais longa (mediana) | 7 → 4 | 3 → 1 |
| Caixa na S20 (mediana) | 3,4 M → 3,6 M | 1,3 M → 1,2 M |
| Falência | 0% → 10% | 0% → 6% |

- Quem chega à era infinita sem título agora vence (32% das temporadas; na bateria do staging, 4%, numa
  amostra diferente).
- O campeão domina mais do que antes (66% contra 54% na bateria): a química ajuda.
- Os rivais de dinastia freiam de verdade, mas 1 campeão em 10 quebra. A alavanca fica **desligada**.

### 7.9 O que fica para o Miguel decidir

1. **Aprovar o pacote final** (tabela 7.0) para ir ao `staging` como o próximo rc.
2. **Progressão no Normal:** o alcance do Worlds caiu de 63% para 51% e o 1º Major mediano foi da S7 para a
   S10. Se for demais, as alavancas mais limpas são a cena das regiões fáceis (SSA +2,0 → +1,5) e a
   frequência de ausências (4% → 3%).
3. **EU no Normal:** alcance do Worlds 33% → 14% e falência 5% → 14% na seed 17019 (na seed 9100 ficou
   igual, 14% → 14%). Com 21 carreiras é em parte ruído, mas é a região para olhar no playtest.
4. **Primeira temporada isenta** da regra de reserva: manter?
5. **Empréstimo de emergência só no piso:** manter, ou entrar assim que o caixa negativar?
6. **Rivais de dinastia:** lançar desligado (recomendado) e decidir a dose depois, com mais carreiras.
7. **Comprar no Hard** continua sem vencer (0%). Aceitar como "o Hard é de quem forma", ou tratar na
   2.0.1 junto com o segundo patrocinador (Parte 8)?

### 7.10 O que não foi verificado

- **Telas:** os avisos novos (slot de reserva, cartão "Sem reserva", recusa do banco) não foram conferidos
  no app; a prévia local não carregou a carreira com a máquina ocupada. Estão cobertos por testes de fluxo
  e de textos, não por olho.
- **Easy e Hard com a química a 0,10:** rodaram a 0,15.
- **`npm run build`:** não rodado (nada foi publicado).
- **Vaga de Major ou Worlds perdida por falta de reserva:** o caminho foi exercitado pelas carreiras dos
  bots sem travamento, mas não tem teste unitário próprio além do de permissão.

---

## 8. Propostas de desenho (não implementadas): progressão por reputação e patrocinadores simultâneos

Pedido do Miguel em 10/11. Nada aqui está no código: são propostas para decidir, com o dado que as
sustenta. Cada item precisa de tela, texto EN/PT e uma rodada de medição antes de entrar.

### 8.1 O buraco na escada de hoje

A escada atual: periféricos (8) → coach (10) → patrocínio local (10) → monitores (14) → PCs (20) →
coaches ex-pro (23) → bootcamp (26) → patrocínio challenger (30) → bootcamp estruturado (38) → psicóloga
(46) → patrocínio global (50) → centro de performance (55) → patrocínio headline (75).

- **Entre 55 e 75 não desbloqueia nada**, e é a faixa em que a maioria das carreiras passa mais tempo.
- **Acima de 80 não existe nada**: o campeão chega a 100 de reputação e a reputação deixa de importar.
- A reputação proporcional (R104) faz a faixa 50–100 depender de resultado grande. Ela precisa de
  recompensa à altura.

### 8.2 Meio de carreira (reputação 35 a 70)

| Rep | Desbloqueio | Buff | Tradeoff |
|---|---|---|---|
| 35 | **Olheiro regional** (mensal) | A faixa de potencial dos prospects de UMA região à escolha fica mais estreita, e um prospect a mais aparece por janela nela | Custo por split; trocar de região zera o conhecimento acumulado |
| 42 | **Analista de adversários** | A preleção escolhida vale 1,5× (o plano certo pesa mais) | O plano errado também pesa 1,5×; custo por split |
| 50 | **Segundo patrocinador** (8.4) | Uma segunda receita, menor | Dois objetivos para cumprir; falhar custa reputação |
| 60 | **Time academy** | Uma vaga extra para um jogador de até 18 anos, fora do limite do elenco, que treina a 70% do ritmo e **serve de reserva** | Depois de 2 temporadas sem jogar ele pede vaga de titular ou sai de graça; salário e manutenção |
| 65 | **Casa de conteúdo** | +10% de bônus de patrocínio e torcida | Os jogadores pedem +5% de salário nas renovações (querem a vitrine) |
| 70 | **Mudança de região** (já previsto, adiado) | Trocar o circuito da org | Reputação cai 15, química zera a herança de região |

### 8.3 Endgame (reputação 80 a 100)

| Rep | Desbloqueio | Buff | Tradeoff |
|---|---|---|---|
| 80 | **Laboratório de performance** (caro + manutenção alta) | Jogadores de 26+ caem um ano mais tarde | Manutenção indexada à inflação da carreira, para sempre |
| 85 | **Status de franquia** | Vaga direta no Regional (sem qualifier): menos desgaste, menos risco no sábado | A meta mínima da temporada vira "top 4 de Major"; errar custa o dobro de reputação |
| 90 | **Marca global** | Patrocínio headline +20% e um terceiro patrocinador | Os 3 rivais mais fortes de Major e Worlds sobem (a alavanca `CAREER_DYNASTY`, R106): a fama atrai quem quer derrubar você |
| 95 | **Legado** (sala de troféus, hall da fama, arena) | Só prestígio: conquistas do perfil e uma marca visual na org | Sumidouro de dinheiro puro, em degraus de US$ 1 M |
| 100 | **Segunda org** (pós-lançamento) | Começar uma carreira nova herdando um bônus da primeira | — |

Com isso o campeão tem onde gastar os US$ 8–12 M, e cada degrau do endgame troca dinheiro ou risco por uma
vantagem estreita. O "status de franquia" e a "marca global" são os dois que deixam o topo mais difícil de
propósito, e é o jogador que escolhe entrar.

### 8.4 Mais de um patrocinador ao mesmo tempo: faz sentido?

**Faz, e resolve um problema que os dados mostram.** Hoje existe um único contrato de patrocínio, e a
receita não acompanha a folha no meio da carreira:

- Quando a psicóloga desbloqueia (reputação 46, tipicamente na 4ª temporada), o patrocínio base rende
  ~30 mil por split contra uma folha de ~47 mil.
- No Hard a folha passa da receita (folha ÷ receita 0,96 na bateria; 1,13 com o pacote), e é lá que as
  carreiras quebram.
- No topo o problema é o inverso: o campeão acumula US$ 8–12 M e o patrocínio já não é decisão.

**Desenho proposto:**

| Vaga | Libera em | Valor | Regra |
|---|---|---|---|
| Principal | como hoje (10 / 30 / 50 / 75) | 100% | como hoje |
| Secundário | reputação 50 | ~40% do valor do nível **abaixo** do principal | objetivo próprio, diferente do principal |
| Terceiro (manga) | reputação 90, com a "marca global" | ~25% | só bônus por resultado, sem valor fixo |

- **Tradeoff:** cada patrocinador traz um objetivo. Falhar em qualquer um custa reputação, e dois objetivos
  podem puxar para lados diferentes (um quer top 8 de Regional toda semana, outro quer Major).
- **Efeito esperado:** +15% a +20% de receita de patrocínio a partir da reputação 50. É o que falta para o
  meio da carreira respirar sem mexer em prêmio nem em salário, e chega só para quem já provou resultado.
- **Por que não entrou agora:** o save guarda UM patrocinador (`sponsor`), e o formato do save está
  congelado por contrato de persistência. Virar lista pede migração de save, telas de Finanças novas e uma
  rodada de medição, porque mexe na receita de todas as carreiras. É trabalho de 2 a 3 dias com teste: cabe
  na primeira atualização depois do lançamento, não nos 2 dias que restam.

**Recomendação:** aprovar o desenho agora e implementar na 2.0.1, junto com o item 8.2 da reputação 50.
