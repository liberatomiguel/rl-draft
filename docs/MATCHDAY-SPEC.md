# Matchday — especificação da Etapa 1 (v2.1)

> Proposta de 17/11/2026, para aprovação do Miguel. Nenhum código escrito.
> Roadmap: ROADMAP-RTW-2026-11-17.md. Só a carreira muda; o Draft fica como
> está. Todos os números são ponto de partida e não foram medidos: a bateria
> da fatia 6 decide os valores finais.

## 1. Como a partida funciona hoje (conferido no código)

- `simulateSeries` (`src/engine/match.ts`) resolve a série inteira de uma vez.
  Cada jogo soma, por time: rating total, forma da série (um sorteio de ±4,5
  por série), um sorteio por jogo, ataque e defesa, uma chance de "high roll"
  de mecânica, clutch no jogo decisivo e experiência nos playoffs.
- Quem perdeu o jogo anterior ganha +1,5 no seguinte (`momentumBounce`).
- Diferença menor que 0,9 leva à prorrogação.
- O placar e os gols por jogador são enfeite: saem depois do vencedor.
- `playSwissRound` (`swiss.ts`) e `playoffs.ts` simulam a rodada inteira num
  laço, com um único RNG; a série do usuário é uma entre as outras.
- A única decisão do manager que entra no resultado é o briefing de domingo:
  de −0,15 a +0,6 de rating (`CAREER_SUNDAY.briefing`). Bootcamp e briefing
  dividem um teto de 2,0 (`CAREER_GEAR.tempRatingMax`).
- Âncoras de balanceamento: +2 de rating vence de 62% a 72% das séries, +6
  vence 90% ou mais, +12 vence 98% ou mais (`balance.test.ts`).
- O jogador da carreira já tem `archetype`, `attrOffsets`, `potential`,
  `peakAge` e `declineRate`, derivados por seed (`career/types.ts`).
- `matchTimeline.ts` já monta a ordem e o relógio dos gols como apresentação,
  com RNG local, sem tocar no resultado.

## 2. O que muda, em uma frase

A série do usuário passa a ser jogada jogo a jogo, com um plano antes e
decisões entre os jogos; todo time da carreira ganha um estilo; todo jogador
ganha traços; e cada jogo produz súmula e eventos.

## 3. Arquitetura em três camadas

**A. Resultado.** Continua em `match.ts`, no mesmo modelo de pontuação
efetiva. Entram modificadores novos e limitados: confronto de estilos, plano,
traços, embalo. Os dados novos são campos opcionais em `TournamentTeam`
(`style`, `plan`, `traits`), no padrão que `rollRange` já usa: campo ausente =
caminho antigo, byte a byte. O Draft nunca preenche esses campos, então
`regression.golden.test.ts` continua valendo sem alteração.

**B. Série em passos.** `simulateSeries` vira um laço sobre três funções
novas: `startSeries`, `playNextGame`, `finishSeries`. A série do usuário usa
um RNG próprio, derivado da rodada e dos dois times (`career/seeds.ts`, como
o `matchTimeline` faz). Assim o resto da rodada é simulado na hora e a série
do usuário pode parar entre os jogos. O estado da série em andamento fica num
campo opcional do save.

**C. Súmula e eventos.** Apresentação pura, com RNG local semeado pelo
resultado, extensão do `matchTimeline.ts`. Não muda vencedor nem placar. Só é
gerada para séries que alguém abre, então o mundo simulado não fica mais
lento.

## 4. Estilos de jogo

Cinco estilos, calculados a partir do `archetype` e dos atributos dos três
titulares:

| Estilo | Como joga | Leva vantagem sobre |
|---|---|---|
| Pressão | Sobe a marcação, rouba boost, demole | Posse |
| Posse | Controla a bola, joga com calma | Contra-ataque |
| Contra-ataque | Espera o erro e sai rápido | Individual |
| Individual | Jogadas mecânicas de um jogador | Jogada em equipe |
| Jogada em equipe | Passes e infiltrações | Pressão |

- Cada time tem um **estilo natural** e um **encaixe** (0 a 1) em cada um dos
  cinco. Jogar fora do estilo natural é permitido, com o bônus de confronto
  multiplicado pelo encaixe.
- O ciclo acima é proposta: ver pergunta P1.
- O confronto de estilos vale em toda série da carreira, inclusive entre
  times da IA (uma consulta de tabela, sem custo de tempo).

## 5. Traços por seed

Cada jogador recebe de zero a dois traços, sorteados a partir do id com pesos
por `archetype` e overall. São derivados, não gravados no save.

| Traço de forma | Efeito na partida |
|---|---|
| Decisivo | Bônus no jogo decisivo e na prorrogação |
| Irregular | Sorteio por jogo mais largo, para cima e para baixo |
| Constante | Sorteio por jogo mais estreito |
| Começa devagar | Pior no jogo 1, melhor do jogo 3 em diante |
| Jogador de LAN | Bônus em Major e Worlds |

| Traço de comportamento | Efeito na partida |
|---|---|
| Líder | O time perde menos com o abalo |
| Temperamental | Abalo maior depois de derrota apertada |
| Sangue frio | Ignora o embalo do adversário |

Os demais traços de comportamento (ambicioso, leal, difícil) e seus efeitos
fora da partida são da Etapa 3. Um arquivo opcional de exceções manuais pode
vir depois, para lendas.

## 6. O que o manager decide

**Antes da série** (tela nova, com relatório do adversário: estilo, forma,
jogador em destaque e traços conhecidos):

- **Estilo:** o natural ou outro, pesando encaixe e confronto.
- **Kickoff:** seguro (menos variação), padrão ou agressivo (mais variação,
  para os dois lados). O azarão quer variação; o favorito, não.
- **Marcar um jogador:** reduz a chance de jogada especial do marcado. Marcar
  o jogador errado custa um pouco de defesa.

**Entre um jogo e outro** (só na série do usuário):

- **Timeout,** um por série: zera o embalo do adversário.
- **Troca:** o reserva entra; muda encaixe, química e traços em quadra.
- **Ajuste:** trocar estilo ou kickoff depois de ver o que o adversário fez.

**Embalo e abalo.** Um medidor de −2 a +2 por time, movido pelo tipo de
resultado (goleada, virada, derrota na prorrogação) e pelos traços. Substitui
o `momentumBounce` fixo nas séries da carreira.

**"Deixar com o coach".** Um botão resolve o plano e as pausas sozinho, com
qualidade proporcional ao coach. Sem coach, o plano é o padrão. Quem joga
rápido não é obrigado a parar em toda série.

**IA.** Usa o estilo natural e o plano padrão; a chance de ajustar entre os
jogos cresce com a qualidade do coach.

## 7. Limites de impacto (D3)

Regra do Miguel: decisões relevantes, sem milagre. Proposta, em pontos de
rating por jogo:

| Fonte | Limite |
|---|---|
| Confronto de estilos, com encaixe total | ±0,6 |
| Plano (kickoff + marcação) | ±0,4 |
| Timeout bem usado | +0,75 no jogo seguinte |
| Soma de plano, confronto e briefing | ±1,2 |
| Embalo / abalo | ±1,5 (o valor do bounce atual) |

Pelas âncoras atuais (+2 de rating dá cerca de 67% numa série), ±1,2 deve
valer por volta de 10 pontos percentuais numa série equilibrada e quase nada
contra um adversário 6 pontos melhor. É estimativa: a bateria mede. Tudo fica
em um bloco novo `CAREER_MATCHDAY` em `balance.ts`.

## 8. Súmula e eventos

- **Por jogador, por jogo:** gols, assistências, chutes, defesas, demolições,
  pontuação. Somados na série e guardados no histórico da temporada.
- **Melhor da série** sai da pontuação, no lugar do sorteio de `starName`.
- **Fluxo de eventos** com relógio: kickoff, chute, defesa, demolição, gol,
  fim do tempo, prorrogação. É o que o visualizador 2D da Etapa 2 vai ler.
- O estilo aparece na súmula: pressão gera mais demolições, posse menos
  chutes sofridos.

## 9. Compatibilidade

- **Draft, desafios e quiz:** sem mudança de resultado.
- **Saves:** só campos opcionais; `persist version` 3 e `saveVersion` 5
  ficam. Um evento em andamento na atualização termina no motor antigo.
- **Mundo simulado:** a camada A só soma consultas de tabela; sem súmula.
- **Briefing de domingo:** continua e entra no teto de ±1,2.
- **Textos:** `copy.career.en.ts` e `copy.career.pt.ts`.

## 10. Fatias de implementação

| # | Fatia | Prova |
|---|---|---|
| 1 | Série em passos, sem mudar nenhum resultado | Teste golden intacto; suíte completa |
| 2 | Estilos e traços derivados; confronto no motor | Testes de determinismo; âncoras de balanço |
| 3 | Plano, pausas, embalo; série do usuário persistida | Testes de fluxo; recarregar no meio da série |
| 4 | Súmula e fluxo de eventos | Totais iguais ao motor; determinismo |
| 5 | Telas: pré-série, pausa, estatísticas no Match Center | Navegador em 320 px e desktop, EN e PT |
| 6 | Bateria, sonda de soft lock, ajuste dos números | Relatório comparado com a rc.37 |

Arquivos principais: `engine/match.ts`, `engine/swiss.ts`,
`engine/playoffs.ts`, `engine/career/matchTimeline.ts`, novos
`engine/career/styles.ts`, `traits.ts`, `boxScore.ts`; `store/careerFlow.ts`,
`careerSunday.ts`; `config/balance.ts`; telas em `app/career/event`.

Frentes paralelas da etapa, com especificação própria: save da carreira na
nuvem (D4), vender e trocar jogadores (ECO-06), sondagem do motor no
servidor, estudo de replays.

## 11. Perguntas para o Miguel

> 17/11: Miguel aprovou seguir com a proposta como está ("podemos continuar
> assim"). P1 a P4 valem como ponto de partida e voltam no gate da etapa,
> depois de jogar.

- **P1.** O ciclo de estilos da seção 4 bate com o que você vê na cena?
- **P2.** Os nomes e a lista dos traços.
- **P3.** "Deixar com o coach" ligado ou desligado por padrão.
- **P4.** Os limites da seção 7 como ponto de partida para a bateria.
