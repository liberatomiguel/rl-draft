# Pro — especificação da Etapa 2 (v2.2)

> 24/11/2026. Versão 2, com as respostas do Miguel à versão 1 (P1–P12) e o
> OK para começar. Plano: PLANO-PROXIMO-NIVEL-2026-11-19.md §5 "Etapa 2";
> concorrentes: CONCORRENTES-2026-11-19.md §3. Parte da linha do staging
> (2.1.0-rc.4). O Manager e o Draft ficam como estão. Os números são ponto de
> partida; a bateria da fatia 7 decide os finais. Decisão: R148.

## 1. Como a carreira funciona hoje (conferido no código)

- **Save do Manager:** `store/careerStore.ts`, chave `rocket-draft:career:v1`
  (persist 3, `saveVersion` 5), três slots de `CareerSave`: org, elenco,
  finanças, `clock` (temporada + dia 1..224), `competition`, `world`.
- **O mundo** (`WorldState`) não depende do usuário: ~16 orgs de IA por
  região, titulares e reservas, agentes livres, novatos. Todo jogador se
  resolve por id em `development.playerViewById` (prefixo → gerador).
- **O usuário entra no mundo por um assento**, o ref `"user"`
  (`withUserSeat`); campos em `worldSim.fieldForEvent`, eventos sem ele em
  `simulateAiEvent`. Times amadores de `localScene.ts` (por hash, nunca
  gravados) preenchem copas e qualifiers e se ancoram na força do time do
  usuário. `rocketStreet.ts` cobre a cena amadora.
- **A série** (Matchday): `startSeries` / `playNextGame` / `finishSeries`;
  estilos e traços; súmula com **nota 0-10 por jogador por jogo**, MVP e
  momentos-chave (`boxScore.ts`).
- **O jogador do mundo:** overall 60-99 com desvios por atributo (seis:
  offense, defense, mechanics, consistency, experience, clutch), arquétipo,
  potencial oculto, pico e declínio. Novatos entram com 13-16 anos e 60-72.
- **O tempo** anda em `careerFlow.processDayArrival` (~600 linhas, preso ao
  `CareerSave`).

## 2. O Pro em uma frase

Uma carreira de **jogador** no mesmo mundo e no mesmo calendário: começa aos
13 ou 14 anos no ranqueado, sobe pela cena amadora, recebe propostas de orgs
reais, briga por titularidade e decide lances nas partidas. O quanto ele
chega longe depende de como você o treina, o descansa e o conduz.

**Sem modo expresso** (decisão do Miguel: as pessoas querem profundidade). O
ritmo vem de atalhos: "plano do técnico" para a semana, "repetir a semana",
"simular até o próximo jogo".

## 3. O que os concorrentes ensinam

| O que eles fazem | O que fazemos |
|---|---|
| RL Career / Rift: OVR único, trava nos 80, cai de 88 para 77 depois do Worlds sem explicação | Seis atributos com teto real de 99; toda mudança de overall explicada; declínio tardio e gradual |
| Rift: 17 títulos na segunda divisão e nenhuma proposta | Propostas reagem à nota 0-10 e à fama, com olheiros e motivo escrito |
| Road To Pro: energia que só recarrega ao subir de nível | Energia semanal que o descanso recupera; cansaço com risco visível |
| RL Career: força = 55% você + 45% elenco, nunca joga | Você joga as séries com o motor da Etapa 1; seu atributo decide o lance |
| Rocket Life: titularidade, relações, gala, coletiva | Titularidade e confiança do técnico; gala de fim de temporada; coletiva fica para a Etapa 3 |
| Todos: mundo fictício | **O nosso fosso:** pros e orgs reais de 2016 a 2027 e a continuação |

## 4. A progressão (o coração do modo)

### 4.1 Atributos e overall

O Pro tem os seis atributos do jogo, **sem potencial fixo** (P7). Overall =
média dos seis. Começa aos 13 com overall ~50 (nível Champion) ou aos 14 com
~54; o estilo (arquétipo, P4) dá +4 aos seus dois atributos e −2 aos outros.

**Como ele cresce:** cada semana de treino dá pontos ao atributo escolhido:

> ganho = base × talento × idade × distância do teto × técnico × energia

- **Talento** (oculto, da seed): ×0,85 a ×1,15. É a "seed boa".
- **Idade:** 1,0 até os 17, 0,85 até 20, 0,6 até 23, 0,35 até o pico, 0,1
  depois.
- **Distância do teto:** quanto mais perto de 99, menos sobe, com um piso
  (nunca zero). 99 é alcançável.
- **Técnico:** o técnico da org (`coachOverall`) acelera; amador não tem;
  com dinheiro, um técnico particular por temporada.
- **Energia:** treinar cansado rende menos.

Mais duas fontes: **XP de partida** (série oficial, maior em Major e Worlds,
maior quando a sua nota é alta e o adversário é forte: jogar contra os
melhores te faz melhor) e um pouco de **ranqueado**.

**Metas de calibração** (Normal, bot, fatia 7):

| Perfil | Overall no pico |
|---|---|
| Talento alto, tudo certo (treino, descanso, titular numa org forte) | 96-99 |
| Talento médio, tudo certo | 90-93 |
| Talento médio, sem cuidado (só conteúdo, sem descanso) | 82-86 |

Primeira org por volta dos 15-16; pico entre 20 e 24 anos (da seed).

**Declínio:** depois do pico, −0,5 a −1,5 por temporada, crescendo com os
anos. Experiência e clutch seguram mais (veterano lê melhor o jogo). Toda
temporada o cartão diz por quê ("os reflexos começam a cair"). Nunca uma
queda grande de uma vez.

### 4.2 Mecânicas

Treinar mecânica abre **mecânicas assinatura** em ordem (wavedash, speedflip,
air dribble, ceiling shot, double tap, musty flick, flip reset). Cada uma
acrescenta uma opção nos lances da partida (§6). É a ponte visível entre o
treino e o jogo.

### 4.3 Forma, energia e confiança

- **Energia** 0-100: atividades gastam, descanso recupera. Abaixo de 30, pior
  forma e chance de **burnout** (uma ou duas semanas fora, com aviso antes).
- **Confiança** −2 a +2, das notas recentes: entra na nota do jogo e no
  lance.
- **Fama** (seguidores) e **dinheiro**: vêm de conteúdo, resultados e
  salário; dinheiro paga técnico particular, bootcamp e equipamento (bônus
  pequeno e com teto).

## 5. A semana

Segunda-feira: **três blocos** (segunda-terça, quarta-quinta, sexta), cada um
com uma atividade; o fim de semana é dos eventos.

| Atividade | Efeito | Energia |
|---|---|---|
| Treino (atributo ou mecânica) | Pontos no atributo | −20 |
| Ranqueado | MMR, pouco XP, fama se transmitido | −15 |
| Scrim (só com time) | XP de experiência, química com os colegas | −15 |
| Conteúdo (live, vídeo) | Dinheiro e fama | −10 |
| Descanso | +35 de energia | — |

Atalhos: "plano do técnico" (decide pelo calendário: descanso antes de LAN,
treino no resto), "repetir a semana". Notícias e propostas chegam no meio,
como no Manager.

## 6. A partida

A série do time do Pro roda em passos (Matchday fatia 1). Em cada jogo,
**um** lance do Pro (P6, a medir no playtest) sai dos momentos-chave da
súmula e vira escolha de duas a quatro opções: "chutar de primeira", "segurar
e esperar o apoio", "tentar o air dribble" (só se você tem a mecânica). A
chance vem do atributo ligado ao lance, da confiança e da energia; a chance
aparece insinuada ("arriscado", "você domina isso").

| Fonte | Limite |
|---|---|
| Lance, por jogo | ±0,5 de rating do time naquele jogo |
| Lances somados numa série | ±1,0 |
| Nota do Pro no jogo | ±1,5 sobre a da súmula |

Sem decidir: "no instinto" escolhe pelo estilo, com valor esperado neutro.

## 7. A subida

1. **Ranqueado (prólogo).** Bronze a SSL com as insígnias do Draft. Sessões
   contra o seu MMR; ganhar depende do overall, da energia e da confiança.
   Grand Champion abre os convites das copas.
2. **Time amador.** Um time local te chama (dois colegas da `localScene`, da
   sua força). Ele ocupa o assento `"user"` nas copas e no qualifier (Open
   Qualifiers); a Rocket Street cobre. Times amadores melhores chamam quando
   você cresce.
3. **Org.** Propostas nas janelas: salário, duração (1 ou 2 temporadas) e
   **papel prometido** (titular ou rotação); uma contraproposta, com risco de
   a org desistir. Valor = overall + nota média recente + fama + idade.
   Quem assina desloca um titular real (P8), que vai para a reserva ou agente
   livre pelo Mundo vivo. A idade mínima é a do RLCS (13), mas as orgs quase
   nunca assinam antes dos 15.
4. **Titularidade.** A cada split o técnico escala os três melhores por
   overall, forma e **confiança do técnico** (cumprir o que ele pede sobe;
   reclamar em público, burnout, notas baixas descem). Reserva joga pouco,
   cresce menos e pode pedir transferência.
5. **Topo.** Regional, Major, Worlds. O ranking mundial do mundo real (orgs e
   pros de verdade) mostra onde você está.
6. **Fim.** Aposentadoria por idade, por escolha ou sem contrato por um ano.

## 8. Gala, apelido e ponte (P9, P10)

- **Gala de fim de temporada** (o que a pergunta P9 chamava de "gala"): uma
  cerimônia com prêmios do ano: MVP, revelação, seleção da temporada,
  jogador mais decisivo. Para a IA, sem súmula, o cálculo usa resultado do
  time e overall. Dá ao Pro uma meta além dos títulos.
- **Apelido:** marcos dão um apelido da cena ("The Wall" para quem vive de
  defesas, "Mr. LAN"), usado nas notícias e no cartão.
- **Ponte jogador → coach/manager** (ideia aprovada, desenho a fechar): na
  aposentadoria, três saídas. **Manager:** fundar uma org no mesmo mundo e
  na mesma data (`bridgeFromPro(save) → CareerSave`), com a fama virando
  reputação inicial e ex-colegas mais dispostos a assinar. **Coach:** virar
  técnico de uma org (precisa da carreira de coach, Etapa 3). **Lenda:** fim
  com o cartão. Na v2.2 entram o campo `bridge` e a saída Lenda; Manager só
  se couber na fatia 7.

## 9. Cartão final para compartilhar

Nome, bandeira, estilo, overall de pico, temporadas, orgs, títulos, prêmios
da gala, melhor nota de temporada, apelido, e ao lado de quais lendas reais
ele fica no ranking. Página `/career/pro/card#<payload>` (base64url no hash,
site continua estático) e "baixar imagem" por canvas no navegador. A prévia
nas redes é uma imagem geral do modo (P11).

## 10. Arquitetura

- **Engine** em `src/engine/career/pro/` (puro, determinístico pelo
  `careerSeed` e pelos streams de `career/seeds.ts`): `types`, `create`,
  `growth`, `week`, `ranked`, `moments`, `offers`, `retire`, `card`.
- **O Pro no mundo:** id `pro:self`. O save guarda o jogador; um retrato
  derivado vai para `world.proSelf` (opcional, aditivo), que
  `playerViewById` lê. Estar numa org = `pro:self` em `playerIds` ou
  `reserveIds`. O mundo nunca sabe que é você.
- **Tempo:** `store/proFlow.ts`. As partes de `processDayArrival` que só
  tocam o mundo saem para `engine/career/worldTick.ts`, chamadas pelos dois
  fluxos; prova: carreira de Manager de seed fixa, dez temporadas, igual antes
  e depois.
- **Números** em `CAREER_PRO` (`balance.ts`); **flag** `FEATURES.proCareer`
  (`STAGING_BUILD || NEXT_PUBLIC_PRO_CAREER === "1"`), em
  `stagingFlags.test.ts`. **Textos** no grupo `PRO` de `copy.career.*`.
  **Telas** em `src/app/career/pro/**`, celular primeiro, seguindo `DESIGN.md`.

## 11. O save

Chave nova **`rocket-draft:pro:v1`** com três slots próprios, ao lado dos três
do Manager: dá para ter carreiras de jogador e de manager ao mesmo tempo, e
mais de uma de cada (P1). Muda o `CONTRACT` de `persistContract.test.ts` de
propósito (linha nova, version 1, `migrate` aditivo), com entrada em
DESIGN-DECISIONS. Nenhuma chave existente muda. Na v2.2 o save fica no
aparelho; a cópia na conta vem depois do gate, na mesma tabela
`career_saves` (P2, decidido).

O `ProSave` usa os mesmos tipos de `clock`, `world` e `competition` do
`CareerSave`, então a ponte para Manager não precisa de migração. Campos:
jogador (atributos, talento oculto, pico, declínio, mecânicas, energia,
confiança, fama, dinheiro, MMR), estágio (ranqueado, amador, org, livre,
aposentado), time e contrato, semana, propostas, histórico por temporada,
honrarias, notícias, `bridge`.

## 12. Fatias

| # | Fatia | Prova |
|---|---|---|
| 1 | **O jogador e o save.** Tipos, criação (apelido, país e região, 13 ou 14 anos, estilo), atributos e crescimento por treino, `pro:self` no mundo, `proStore`, CONTRACT, flag, telas de criação e do jogador | Determinismo; teto 99; curva de crescimento; contrato de persist; flags; criar no staging e recarregar |
| 2 | **A semana e o ranqueado.** Três blocos, energia, burnout, confiança, MMR e ranks, convite às copas | Testes da semana; da criação a GC numa faixa de semanas |
| 3 | **Mundo e calendário.** `worldTick.ts`; o time amador no assento; copas e qualifier; série em passos com a nota do Pro; XP de partida | Manager idêntico; `P1_SOFT=1`; um ano amador sem travar |
| 4 | **Org.** Propostas, contraproposta, titularidade, confiança do técnico, transferência, agente livre | Deslocado vai para reserva/FA; `pro:self` nunca duplicado |
| 5 | **Lances e mecânicas.** Momentos com escolha, mecânicas assinatura, "no instinto" | Limites da §6; valor esperado do instinto |
| 6 | **Idade, fim, cartão.** Pico, declínio explicado, aposentadoria, `bridge`, página do cartão | Carreira inteira por bot; payload ida e volta |
| 7 | **Gala, apelido, polimento, bateria.** 320 px e desktop, EN e PT; bateria NA/EU/SAM × Normal/Hard | Metas da §4.1 e da §13 |

Cada fatia vai para o staging atrás de `FEATURES.proCareer`, com suíte,
typecheck, lint e, a partir da 3, a sonda de soft lock.

## 13. Gate

Uma carreira do ranqueado ao Worlds, no celular e no desktop, EN e PT.
Metas da bateria (bots, a confirmar): primeira org aos 15-16 no Normal;
Worlds jogado em ~40% das carreiras com talento médio bem conduzidas; título
possível, não garantido; 0 soft lock; o Manager de seed fixa igual ao rc.5.

## 14. Respostas do Miguel (24/11) e o que fica aberto

- **P1** saves de jogador e de manager ao mesmo tempo, mais de um de cada →
  chave própria, três slots. **P2** a meu critério → nuvem depois do gate.
- **P3** começar antes → 13 ou 14 (o RLCS aceita 13 desde 2024).
- **P4, P5, P8, P11, P12** ok como recomendado.
- **P6** um lance por jogo, a medir no playtest.
- **P7** sem potencial fixo; 99 possível com tudo certo e seed boa → §4.1.
- **P9** explicado na §8 (gala = prêmios do ano). **Aberto:** gala e
  apelido entram? Recomendo os dois, na fatia 7.
- **P10** ponte aprovada como ideia → §8. **Aberto:** a saída Manager na
  v2.2 ou na Etapa 3? Recomendo Etapa 3, junto com a carreira de coach.
- **Modo expresso:** fora.
