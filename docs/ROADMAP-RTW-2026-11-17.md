# Road to Worlds — roadmap pós-2.0 (proposta de 17/11/2026)

> Estado: **proposta, nada aprovado**. Parte das ideias do Miguel de 17/11, do
> relatório pós-lançamento (POSTLAUNCH-2.0-REPORT.md) e da pesquisa de
> concorrentes do mesmo dia. Versões e ordem são sugestões. Cada etapa termina
> num gate: rc em `staging`, lista do que jogar e decidir, e espera pela
> aprovação. Tamanhos: P (dias), M (uma a duas semanas), G (várias semanas).

## Ponto de partida (conferido no código em 17/11)

| Ideia | O que já existe | O que falta |
|---|---|---|
| Decisões de partida | Briefing de domingo (`keep` / `recover` / `prepare`), troca de titular no HQ | Plano de jogo, estilos, decisões entre jogos |
| Assistir aos jogos | Match Center com linha do tempo de gols (`matchTimeline.ts`); o motor resolve vencedor, placar, prorrogação e gols por jogador (`match.ts`) | Assistências, defesas, chutes, demolições, posse; visualizador 2D |
| Traços | Nada. `players.json` tem só id, apelido, país e região; a carta tem só `overall` | Fonte de dados de estilo e traço por jogador |
| Metas | `seasonGoals.ts` e metas de patrocinador por contrato | Metas obrigatórias com consequência |
| Vender / trocar | Propostas da IA com aceitar / recusar | Listar jogador, propor troca (ECO-06, em aberto) |
| Saves entre dispositivos | A conta sincroniza o perfil (`profileSync.ts`); da carreira só marcos e Worlds vencidos | O save da carreira na nuvem |
| Time existente | Só fundar clube | Assumir organização real, propostas de emprego |
| Online | Perfis, placares, uma função de apagar conta | Tudo |

## Princípios

1. **É Rocket League, não futebol.** Três titulares, um reserva, um coach; sem
   posição fixa; séries melhor de 5 ou 7; receita de patrocínio, prêmio e
   conteúdo; talento que vem do ranqueado e estreia aos 15 ou 16 anos.
2. **O motor de partida vem primeiro.** Decisões, traços, visualizador, modo
   jogador e online dependem todos de uma partida que produza eventos e
   estatísticas, não só um placar.
3. **Contratos mantidos:** lógica em `src/engine`, números em `balance.ts`,
   textos EN + PT, export estático, campos de save sempre aditivos.
4. **Toda mudança de motor passa por bateria** e pela sonda de soft lock antes
   de ir a `staging`.

## Etapa 1 — v2.1 "Matchday" (G)

Objetivo: a série deixa de ser um resultado e vira um jogo que o manager
influencia.

- **Motor de partida v2.** Cada jogo passa a gerar eventos (kickoff, chute,
  defesa, assistência, demolição, gol) e estatísticas por jogador. Embalo e
  abalo passam de um jogo para o outro dentro da série.
- **Estilos de jogo.** Cada time tem um estilo (pressão, posse, contra-ataque,
  jogada em equipe, individual) que nasce dos três titulares. Estilos se
  favorecem e se anulam.
- **Plano antes da série:** estilo, estratégia de kickoff, jogador adversário a
  marcar. O efeito é limitado em `balance.ts`: decide séries equilibradas, não
  vira uma série desigual.
- **Entre um jogo e outro:** um timeout por série (corta o embalo do
  adversário), troca de titular, ajuste do plano. O timeout é uma abstração de
  jogo; o RLCS não tem timeout tático formal.
- **Match Center com estatísticas** e melhor jogador da série.
- **Dados de estilo por jogador** (ver decisão D1): a etapa não começa sem isso.

Frentes paralelas, independentes do motor. **Save na nuvem e vender / trocar
vão para `main` assim que ficarem prontas** (decisão de 17/11: os jogadores
estão pedindo), sem esperar o gate da etapa:

- **Save da carreira na nuvem (M).** Cópia do save na conta, com resolução de
  conflito por data e aviso antes de sobrescrever. Corrige antes as falhas de
  sincronização (12% das contas). O `localStorage` continua sendo a fonte;
  exige entrada em DESIGN-DECISIONS porque toca a regra dos saves.
- **Vender e trocar (M, fecha ECO-06).** Listar jogador com preço pedido,
  propor troca jogador por jogador, propostas da IA em 1 a 3 dias.
- **Sondagens técnicas (P cada):** o motor v2 rodando numa Edge Function do
  Supabase (viabilidade do online); estudo de replays para o visualizador.

Gate: jogar NA / EU / SAM no Normal e no Hard; decidir se as decisões pesam
demais ou de menos; bateria comparada com a rc.37.

## Etapa 2 — v2.2 "Broadcast" (G)

Objetivo: assistir à partida, no estilo Football Manager.

- **Visualizador 2D** visto de cima: campo, seis carros, bola, boost, placar e
  relógio. Velocidades 1x, 2x, só os lances, pular.
- **Apresentação, não simulação.** O motor v2 já decidiu os eventos; o
  visualizador os coreografa a partir de uma biblioteca de jogadas (kickoffs,
  rotação de três, passe para o meio, jogada aérea, disputa de bola,
  demolição, defesa, limpeza de área). O resultado nunca depende do desenho, e
  o mundo simulado continua rápido.
- **Movimento realista:** a biblioteca sai do estudo de replays reais
  (trajetórias, tempos de rotação, alturas). A sondagem da Etapa 1 define a
  ferramenta e o que pode ser usado.
- **Decisões ao vivo:** as paradas entre jogos da Etapa 1 acontecem dentro da
  transmissão.
- **Desempenho:** canvas, alvo de celular médio, variante leve para "Lite
  effects".

Gate: assistir a uma série inteira no celular e no desktop; decidir se o
movimento "parece Rocket League".

## Etapa 3 — v2.3 "Vestiário e diretoria" (G)

Objetivo: jogadores com personalidade e um manager com carreira própria.

- **Traços de forma:** decisivo, irregular, cresce em LAN, começa devagar.
- **Traços de comportamento:** líder, ambicioso, leal, difícil. Afetam química,
  renovação e reação ao banco.
- **Moral e forma recente** visíveis, alimentadas pelas estatísticas do motor.
- **Diretoria com missões.** As metas de temporada viram missões obrigatórias
  com prazo, recompensa e consequência: orçamento, confiança, demissão.
- **Assumir uma organização real** no início da carreira, com elenco, caixa e
  expectativa da diretoria.
- **Propostas de outros times** conforme a reputação do manager (nova,
  separada da reputação do clube). Demissão deixa de encerrar a carreira.
- No clube fundado, a "diretoria" são os investidores e patrocinadores.

Gate: uma carreira num clube real e uma num clube fundado; decidir a dureza
das consequências.

## Etapa 4 — v2.4 "Dinastia" (M)

Objetivo: motivo para continuar depois do Worlds e para recomeçar.

- **Desafios pós-Worlds:** bicampeonato, Grand Slam da temporada, título com
  elenco só da região, título com a menor folha.
- **Nova carreira com modificadores** e recompensas cosméticas próprias.
- **Cenários:** carreiras curtas com objetivo fechado; também servem de
  entrada para quem chega pelo celular.
- **Hall da Fama** do clube e do manager.
- **Talento do ranqueado:** prospectos gerados de 15 e 16 anos nas temporadas
  infinitas, com potencial parcialmente oculto.
- **Conteúdo como receita:** criadores contratados pelo clube, no lugar de
  bilheteria.

Gate: vencer o Worlds e continuar por três temporadas.

## Etapa 5 — v2.5 "Pro" (G)

Objetivo: carreira como jogador.

- Criar um jogador de 15 anos, com região e estilo.
- Subir do ranqueado para a cena amadora, receber propostas, disputar a vaga
  de titular, negociar contrato.
- Decisões de treino, de conteúdo e de vestiário; na partida, momentos-chave
  do próprio jogador dentro do visualizador.
- Reaproveita motor v2, traços, propostas e visualizador; por isso vem depois
  das Etapas 1 a 3.

Gate: uma carreira do ranqueado ao Worlds.

## Etapa 6 — v3.0 "Online" (G, em três partes)

Objetivo: jogadores numa liga compartilhada. Só começa se a sondagem da Etapa
1 passar.

- **A, liga assíncrona:** ligas de 24 managers, draft de abertura por lista de
  preferência, rodadas resolvidas pelo servidor em horário fixo, tabela, ver o
  elenco dos outros.
- **B, eventos:** copa de sábado com regra rotativa, finais, Worlds entre
  ligas, divisões, placar geral.
- **C, mercado único:** leilões fechados dentro da liga, trocas entre managers.
- **Chat (decidido em 17/11):** texto livre com moderação automática. Toda
  mensagem passa por uma função no servidor antes de ser publicada (filtro de
  termos, limite de frequência), com botão de denúncia e silenciamento.
- Regras desde o primeiro dia: uma conta por pessoa, sem bots, banimento.

Gate por parte; a A vai ao ar sozinha para medir adesão.

## Trilha contínua

- Francês e espanhol (a França é o 3º país; elimina a causa do crash de
  tradução).
- Entrada da carreira no celular (33% criam carreira, contra 53% no desktop).
- Evento de avanço recusado e orçamento de eventos do PostHog.

## Ideias em reserva (17/11, sem etapa definida)

- **Carro do clube no visualizador:** as cores e o escudo já escolhidos
  aparecem nos carros do 2D (Etapa 2).
- **Narração em texto e resumo compartilhável:** frases de transmissão durante
  a partida e um cartão da série para postar (Etapa 2).
- **Relatório do adversário:** antes da série, estilo, forma e ponto fraco do
  outro time, como base para o plano (Etapa 1).
- **LAN e online:** viagem, torcida e traços que reagem ao palco (Etapa 3).
- **Eventos paralelos de 1v1 e 2v2:** convites em que pesa o traço individual
  (Etapa 4).
- **Era de início:** começar a carreira numa temporada histórica do dataset
  (Etapa 4; conferir antes o que o calendário atual permite).
- **Editor e exportação da carreira:** arquivo do save para guardar ou
  compartilhar (junto do save na nuvem).
- **Modo streamer:** o chat da Twitch vota nas decisões (depois da Etapa 2).
- **Desafio semanal de seed compartilhada:** mesmo clube e seed para todos,
  com placar; primeiro passo barato do online.

## Decisões do Miguel antes da Etapa 1

- **D1 (decidido em 17/11): estilo e traços por seed.** Gerados de forma
  determinística a partir do id do jogador e do overall; sem curadoria manual
  nesta fase.
- **D2 (decidido em 17/11, por velocidade): "Pro" antes de "Online".** Miguel
  acha que o online pode valer mais; a ordem segue o que sai mais rápido. O
  "Pro" reaproveita as Etapas 1 a 3 e não exige servidor. O desafio semanal de
  seed compartilhada pode sair antes como primeiro passo do online. Rever no
  gate da Etapa 3.
- **D3 (decidido em 17/11): decisões relevantes, sem milagre.** Decidem uma
  série equilibrada e quase não mexem numa série desigual. Números em
  MATCHDAY-SPEC.md §7.
- **D4 (decidido em 17/11): save na nuvem só com conta.** Convidado recebe
  exportar / importar o save em arquivo. Código de transferência sem conta
  exigiria guardar saves anônimos no servidor.
- **D5 (decidido em 17/11): a diretoria pode demitir** também no clube
  fundado.

Especificação da Etapa 1: MATCHDAY-SPEC.md.
