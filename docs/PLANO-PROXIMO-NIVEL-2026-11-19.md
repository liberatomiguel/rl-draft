# Rocket Draft — próximo nível (proposta de 19/11/2026)

> Estado: **proposta, nada aprovado**. Base: a pesquisa com 28 jogadores
> (formulário de 18/11), a varredura de concorrentes de 19/11, o
> ROADMAP-RTW-2026-11-17.md (que esta proposta reordena), o
> MATCHDAY-SPEC.md e o POSTLAUNCH-2.0-REPORT.md. Tamanhos como no roadmap:
> P (dias), M (uma a duas semanas), G (várias semanas). Cada etapa continua
> terminando num gate em `staging`.

## 1. Resumo

1. A base gosta muito do jogo (nota média **8,8**, ninguém abaixo de 7) e o
   que mais segura o jogador é a carreira: 63% de quem tocou nela voltou no
   dia seguinte, contra 11% de quem não tocou.
2. O pedido número 1 é **carreira de jogador** (12 de 28 como prioridade
   máxima, 24 de 28 marcaram). Todo concorrente de carreira já tem uma; nós
   não. No roadmap de 17/11 ela é a Etapa 5.
3. A maior reclamação da carreira não é falta de recurso, é **o mundo**:
   fácil demais depois de 100+ de overall, poucas zebras, organizações
   sumindo do Worlds, temporadas iguais e, na outra ponta, anos parado numa
   região difícil.
4. Proposta: **antecipar o Pro** para logo depois do Matchday, fazer do
   **"Mundo vivo"** uma frente da Etapa 1, empurrar o visualizador 2D para
   depois e começar o online por degraus baratos já.
5. No Draft, o RLCS Draft (draftrlcs.app) já tem multiplayer ao vivo, carreira
   e seis jogos de festa. O Classic é o modo mais jogado da pesquisa (27 de
   28) e precisa de uma trilha própria.
6. 71% acham que o jogo foi feito com IA ou não têm certeza. Todo concorrente
   também usa IA; o risco é **parecer genérico** num mercado de clones.

## 2. O que a pesquisa diz

**Quem respondeu:** 28 pessoas, 82% jogam toda semana e 57% quase todo dia;
só 3 jogavam pela primeira vez. É o núcleo fiel, não o jogador novo. O
"escolha até 3" das adições foi ignorado (média de 5,4 marcadas), então a
pergunta de **prioridade máxima** é o sinal mais limpo.

| Pergunta | Resultado |
|---|---|
| Nota (0–10) | 10: 8 · 9: 9 · 8: 8 · 7: 3 (média 8,8) |
| Modos jogados | Classic 27 · Road to Worlds 26 · Challenges 25 · Daily 21 · Region Locked 19 · Legacy 19 · Quiz 17 · Quick 13 |
| Visual | 22 de 28 atraente; 3 pouco atraente |
| Navegação | 23 de 28 fácil; 2 difícil |
| Prioridade máxima | Carreira de jogador 12 · Online 6 · Táticas 2 · Org real 2 · Histórias 2 · Análise de partida 1 · Copas da comunidade 1 · Torneios custom 1 · Histórico 1 |
| Marcaram (qualquer) | Carreira de jogador 24 · Online 18 · Histórias 18 · Org real 17 · Histórico/resumos 14 · Torneios custom 13 · Desafios de carreira 13 · Táticas 13 · Análise 11 · Copas 8 |
| Parece IA? | Sim 11 · Não sei 9 · Não 8 |

**O que amam:** a carreira ("construir o time até o Worlds", "não conheço
outro jogo que deixe controlar uma org de RL"), os times e jogadores reais de
todas as temporadas, as cartas especiais, o polimento ("muitos detalhes de
QOL"), e o dev.

**Problemas, agrupados (respostas abertas):**

| Tema | Respostas | Exemplos |
|---|---|---|
| Curva da carreira | 7 | Fácil demais com overall alto; time do jogador forte demais com jogadores fracos; resultado previsível, poucas zebras; prospectos sem variação. Na outra ponta: APAC no Normal levou 6 a 7 temporadas até a primeira final regional |
| Mundo que se desfaz | 3 | Organizações somem da briga pelo Worlds e times "Local" tomam o lugar; a competição fica parada; stacks sem org (o Ikkaku atual) cobram multa como se fossem org |
| Repetição | 2 | Toda temporada tem o mesmo formato; pedem os formatos reais do RLCS, sorteados depois de 2026 |
| Profundidade | 4 | "Football Manager de Rocket League", mais estatísticas e mundo; gols, assistências, MVPs e nota no elenco; a reputação do clube pesar na contratação |
| Realismo de apresentação | 3 | Série desigual quase sempre "em 7 gols"; nomes gerados repetitivos ("Kimchi II", "TikiTaka", sempre "Substantivo Substantivo") |
| Usabilidade | 4 | Gerir a própria org confunde; barra de abas da carreira no celular; pediram várias carreiras e a mesma conta no PC e no celular (já existem desde 17/11: é descoberta, não recurso); índice de times e cartas |
| Draft | 8 | Draft de uma temporada só ou só do elenco atual; montar time sem sorteio e simular; deixar coach/reserva vazio; juntar regiões sem tanta perda; foto padrão do jogador; recompensa por número de especiais; o giro do desafio não muda ao reiniciar |
| Bugs | 3 | Meta de patrocínio impossível quando começa no meio da temporada (ex.: vencer 8 regionais); a MATE sem bônus de Worlds no Draft; preso depois de 2025 (o soft lock da rc.47–49, já corrigido) |

**Por que parece IA:** "o visual", "a fonte", "menus", "o conceito todo", e
uma frase que resume o risco: quem fez o próprio simulador de RLCS com o
Claude diz que ele tem "exatamente o mesmo estilo". Um disse que não vê
problema no uso de IA.

## 3. Concorrentes (19/11)

> Estudo a fundo, recurso por recurso, com o que reaproveitar ou fazer melhor:
> **CONCORRENTES-2026-11-19.md**. A seção 4 de lá ajusta este plano: modo
> expresso e cartão final no Pro, narração e súmula no lugar do visualizador
> 2D, narrativa só com prova nos dados, contrapropostas que não mudam ao
> reabrir, seleções nacionais, e uma trilha Draft mais social.

| Jogo | Tipo | Onde roda | O que tem que nós não temos |
|---|---|---|---|
| [RLCS Draft](https://www.draftrlcs.app/) | Draft e cartas | Navegador, login Discord | **Multiplayer ao vivo** com amigo, carreira de jogador, "Zero to Hero", Gauntlet 1v1/2v2/3v3, sandbox, 6 jogos de festa, coleção com fusão e versões brilhantes, Season Pass, notas sugeridas pela comunidade. A marca é buscada ~1,7× a nossa |
| [Rocket League Manager (RLM)](https://itsaminus.itch.io/rlm) | Manager e "Path to Glory" | Windows, exige o RL, BakkesMod e ~7 GB | Partidas reais com bots e transmissão (câmeras, POV, replays), metas negociadas com a diretoria, scouting com promessas ocultas, agentes, parcelamento, departamentos de staff, vestiário, notícias, editor de carreira. **10 versões entre 22/10 e 9/11.** IA declarada em código, arte, som e texto |
| [Manageur](https://umbul.itch.io/rocket-league-manageur-careere-mod) | Manager | Windows, protótipo 0.1.0 | Táticas pré-jogo, influenciadores como receita, FR/EN |
| [RL Career](https://sarpbc.org/game/career) | Carreira de jogador | Navegador, sem conta | Dos 16 à aposentadoria, ranking mundial vivo; dentro de um site de notícias com SEO forte |
| [Rift Career](https://riftscore.net/rocket-league) | Carreira de jogador | Navegador | 7 regiões, Open Qualifiers → Majors → EWC → Worlds, 4 idiomas (EN, ES, FR, KO) |
| [Road To Pro](https://github.com/voken3959/rl-career-mode) | Carreira de jogador | Navegador | Ranqueado do Bronze ao World Champion, 1v1/2v2/3v3, **visualizador 3D** com 5 câmeras. Sem comunidade |
| [Rocket Life](https://repput.itch.io/rocket-life) | Carreira a partir das suas partidas reais | Windows + RL | Lê a API de estatísticas, nota 0–10 por jogo, coletiva de imprensa, clássicos, disputa de titularidade, chat da Twitch decide |
| [RLCS Fantasy](https://rlcsfantasy.com/) | Fantasy com estatísticas reais | iOS/Android | Ligas privadas por código |

**Leitura:**

1. **Carreira de jogador virou o básico do gênero.** Quatro jogos de
   navegador ou download já têm uma, mais o RLM e o RLCS Draft. É a maior
   lacuna e o maior pedido.
2. **Espetáculo é uma corrida que o navegador perde.** O RLM usa o motor do
   próprio Rocket League e o Road To Pro tem 3D. Nossa vantagem é outra: mundo
   profundo, história real de 2016 a 2027, economia, nenhuma instalação,
   celular (61% dos usuários do pós-lançamento) e conta com save na nuvem.
3. **O Draft está sendo atacado pelo lado social.** O RLCS Draft já tem o que
   falta para nós nos dois lados: multiplayer e carreira.
4. **Velocidade visível conta.** O RLM lança três versões por semana. Nós
   também (v2.0.24 → v2.0.33 numa semana), mas o jogador não vê.
5. **Todo mundo usa IA.** Usar IA não diferencia ninguém; parecer igual ao
   próximo clone, sim. A defesa é o que um clone não copia num fim de semana:
   dados curados, sistemas acumulados, comunidade e identidade própria.

## 4. A tese: o universo do RLCS que continua depois de 2027

Ninguém mais tem a história real inteira **e** um mundo que segue a partir
dela. O próximo nível do Road to Worlds é transformar isso no produto:

- **Um mundo, três cadeiras.** No mesmo mundo, você funda um clube, assume uma
  org real ou vive a carreira de um jogador. O gancho que nenhum concorrente
  tem: **o jogador se aposenta e vira coach ou manager no mesmo save**, de
  jogador a lenda a dono.
- **Um mundo que reage.** Organizações com ambição, que se reconstroem,
  formam supertimes contra você e contratam os stacks locais que surpreendem.
  Zebras que nascem do confronto de estilos, não de sorte pura. O circuito
  muda de formato como o RLCS real.
- **Um mundo que lembra.** Toda partida alimenta estatísticas, recordes,
  rivalidades e um Hall da Fama. No fim: uma **wiki do seu universo**, com
  página de cada time, jogador e torneio que aconteceu no seu save. É o que
  o jogador "nerd" da pesquisa descreve.
- **Um mundo compartilhado.** Primeiro o mesmo desafio para todos com placar,
  depois ligas.

## 5. Plano

### Sequência consolidada (19/11, depois da v2.0.34)

Junta a pesquisa, o estudo de concorrentes e o estado do projeto. Cada etapa
fecha num gate em `staging`; frentes paralelas vão para `main` assim que
ficam prontas.

| # | Etapa | O que entra | Tamanho | Gate |
|---|---|---|---|---|
| 0 | **Identidade nova** (próximo patch) | `design/broadcast-pilot` junta o `main` (recebe a v2.0.34), a barra de abas do celular do Miguel, revisão final, `main` | M | Miguel aprova no celular e no desktop |
| 1 | **v2.1 Matchday + Mundo vivo** | MATCHDAY-SPEC (série em passos, estilos com contra visível, plano, pausas, súmula, nota 0–10, estatísticas no elenco); **narração lance a lance, barra de embalo e momentos-chave** no Match Center (no lugar do visualizador 2D); Mundo vivo M1–M4 (orgs que se renovam, rival que reage a quem domina, curva por região, zebras com causa); textos de pré-série só com o que os dados provam | G | NA/EU/SAM no Normal e no Hard; orgs no Worlds depois de 10 temporadas; um time de 100+ ainda perde séries |
| 2 | **v2.2 Pro** | Carreira de jogador no mesmo mundo: origem e função, ranqueado como prólogo, propostas de orgs reais com contraproposta, disputa de titularidade, eventos presos ao calendário real; **modo expresso** e **cartão final para compartilhar** (página de resultado na URL); destino, apelido, gala | G | Uma carreira do ranqueado ao Worlds nos dois modos, no celular |
| 3 | **v2.3 Diretoria e histórias** | Assumir org real; diretoria "ambição × orçamento"; reputação do manager e propostas de emprego (mesmo sistema do Pro); vestiário em três medidores e jogador influente; rivalidades, coletiva com frequência ajustável; resumo da temporada, recordes, Hall da Fama; **seleções nacionais** | G | Uma carreira em org real e uma em clube fundado |
| 4 | **Online ao vivo** | Draft 1v1 ao vivo (Supabase Realtime), depois ligas assíncronas (após a sondagem da Edge Function) | G | Adesão medida na copa semanal e no desafio por link |

**Frentes paralelas** (P–M cada, sem esperar gate):

| Quando | Frente | Por quê |
|---|---|---|
| Durante a Etapa 1 | **Desafio entre amigos por link** no Draft (mesma seed, sem servidor) | O laço social que falta; resposta ao multiplayer do RLCS Draft |
| Durante a Etapa 1 | **Daily com draft ótimo revelado e percentil** | Hábito diário; o RLCS Draft já faz |
| Durante a Etapa 1 | **"RLCS-dle"** diário (adivinhe o jogador) com grade para compartilhar | Barato, estático, viraliza |
| Durante a Etapa 1 | **Notas da comunidade**: bandeira na carta, tabela só-inserção no Supabase, página pública do que mudou | A credibilidade das notas é o centro do gênero; liga com a planilha de sugestões |
| Durante a Etapa 1 | A4: stacks sem org | Depende da lista do Miguel |
| Durante a Etapa 2 | **Copa semanal da carreira** (mesmo cenário e seed, placar) | Primeiro degrau do online; "desafios de RTW" pedidos na pesquisa |
| Durante a Etapa 2 | **Trilha de recompensas da temporada** com tarefas diárias e semanais, só cosméticos | Retenção; o Season Pass do RLCS Draft |
| Contínua | FR e ES; nova pesquisa em ~6 semanas com as mesmas perguntas | França é o 3º país; medir a identidade nova e a v2.1 |

**Em reserva:** minicampo 2D em SVG, roguelite de 15 minutos (também como
entrada da carreira no celular), modo streamer, começar numa era histórica,
criadores de conteúdo como receita.

### Agora — lote "Ouvimos vocês" (v2.0.34 a v2.0.36, P cada)

Correções e descobertas tiradas direto da pesquisa. Nada aqui muda balanço de
carreira em andamento.

> **19/11: A1, A2, A3, A6, A8 e A9 publicados na v2.0.34** (em `main`, na
> identidade atual; CHANGELOG 2.0.34). A4 espera a lista de stacks sem org
> do Miguel; A5 não é bug (o bônus de org é o prestígio curado); A7 é do
> Miguel. O `design/broadcast-pilot` recebe a v2.0.34 quando juntar o `main`.

| # | Item | Observação |
|---|---|---|
| A1 | Metas de patrocínio proporcionais ao que falta da temporada | Conferir a regra do R122 antes; bugfix com causa raiz |
| A2 | Placar realista em série desigual | O placar sai depois do vencedor (`match.ts`); é apresentação, não muda resultados |
| A3 | Nomes gerados: padrões de org ("X Gaming", "Team X", nome único, sigla, "X Esports") e de jogador; trocar o sufixo " II" por outro nome do banco | `engine/career/names.ts` e o catálogo; só carreiras novas |
| A4 | Stack sem org não cobra multa nem age como org | Conferir como o dataset marca time sem org |
| A5 | Bônus de Worlds da MATE no Draft | Conferir em `teams.md` |
| A6 | Contar o que já existe: várias carreiras, save na nuvem entre PC e celular | Card de novidades no HQ e post no Discord |
| A7 | Barra de abas da carreira no celular | **Miguel faz separadamente.** Celular cria carreira em 33% dos casos contra 53% no desktop |
| A8 | Índice de times e jogadores (as páginas `/rlcs` já existem) ligado da coleção e do menu; lista de cartas sem atributos | Ajuda SEO também |
| A9 | Recompensa por marcos de especiais desbloqueadas | Cosméticos existentes |

### Etapa 1 — v2.1 "Matchday + Mundo vivo" (G)

O Matchday segue como está no MATCHDAY-SPEC.md, com dois ajustes de foco:
a súmula (fatia 4) gera, já nesta etapa, **estatísticas no elenco** (gols,
assistências, defesas, MVPs, nota média) e uma **nota 0–10 por jogo**, que o
Pro vai usar.

Frente paralela **"Mundo vivo"** (M a G), medida na mesma bateria:

- **M1. Ciclo de vida das orgs.** Achar a causa raiz de orgs sumindo do
  Worlds nas temporadas infinitas (suspeita: o preenchimento por times locais
  do R130 cobre a falta sem repor orgs). Orgs novas entram na cena, orgs
  contratam o stack local que se classifica ("stack X assinou com Y"), e
  times Local ficam no cenário local.
- **M2. O mundo reage a quem domina.** Rivais montam supertimes, a IA tenta
  tirar suas estrelas (proposta que você pode recusar, com efeito na
  história), o adversário passa a jogar contra o seu estilo. **Nenhum rating
  é tirado de ninguém**: o fim de jogo fica difícil porque o mundo cresce.
- **M3. Curva por região.** No Normal, toda região tem um caminho de vitória
  nas primeiras temporadas (copas locais, primeira regional); conferir o caso
  APAC na bateria.
- **M4. Zebras com causa.** O confronto de estilos do Matchday é a ferramenta.
  Meta de bateria: série equilibrada mais aberta, série desigual ainda quase
  certa (D3).
- **M5. O circuito muda.** As temporadas infinitas sorteiam entre formatos
  reais do RLCS, anunciados no feed de notícias. Toca o calendário: sonda de
  soft lock obrigatória. Pode ficar para a Etapa 3 se pesar.

Gate: o de 17/11 mais duas perguntas: as orgs continuam no Worlds depois de 10
temporadas? Um time de 100+ ainda perde séries?

### Etapa 2 — v2.2 "Pro" (G, antecipada da Etapa 5)

Carreira de jogador no mesmo motor e no mesmo mundo. Depende das fatias 1, 2
e 4 do Matchday (série em passos, estilos e traços, súmula). **Não depende** do
visualizador nem da diretoria.

- Criar o jogador: apelido, país e região, 15 ou 16 anos, estilo, potencial
  parcialmente oculto.
- Subida: ranqueado → copas da comunidade (`localScene`, `rocketStreet` já
  existem) → time amador → Open Qualifiers → Majors → Worlds.
- Semana: treino, conteúdo (dinheiro e fama), descanso. Partida: nota 0–10 e
  um ou dois momentos-chave em texto com uma decisão sua.
- Propostas de contrato por desempenho e reputação, disputa de titularidade,
  transferências.
- Idade, pico, declínio e aposentadoria, com a **ponte para virar coach ou
  manager** no mesmo save (pode vir numa etapa seguinte; o save já nasce
  preparado para ela).

Gate: uma carreira do ranqueado ao Worlds, no celular e no desktop.

### Etapa 3 — v2.3 "Diretoria e histórias" (G)

O conteúdo da antiga Etapa 3 mais o que a pesquisa pediu de narrativa:

- Assumir uma org real (17 marcaram), metas da diretoria com consequência,
  reputação do manager e propostas de emprego. O sistema de propostas é o
  mesmo do Pro: uma pessoa com reputação recebendo ofertas de orgs.
- Traços e moral; a reputação do clube no discurso da contratação ("um time
  que está surgindo").
- Histórias: rivalidades que nascem de reencontros em playoffs, sagas de
  transferência, coletiva de imprensa com escolhas, o time azarão que sobe.
- **Memória:** resumo da temporada compartilhável, livro de recordes, Hall da
  Fama, confronto direto. A wiki do universo começa aqui.

### Online por degraus (começa durante a Etapa 1)

| Degrau | O quê | Tamanho |
|---|---|---|
| O1 | **Copa semanal da carreira**: mesmo cenário e seed para todos (reconstruir um time, uma temporada), placar. Usa a infraestrutura de placares. Responde a "desafios de RTW", "copas da comunidade" e "desafios de carreira" | M |
| O2 | **Desafio entre amigos no Draft**: link com seed, os dois fazem o mesmo draft, resultado comparado. Sem servidor | M |
| O3 | Draft ao vivo com amigo (Supabase Realtime), resposta ao RLCS Draft | M a G |
| O4 | Ligas assíncronas (antiga Etapa 6 A), depois da sondagem da Edge Function | G |

### Trilha Draft (contínua)

- **Draft de temporada:** escolher uma temporada (ou só os elencos atuais) e
  jogar o Worlds dela (M).
- **Sandbox e torneio custom:** montar o time sem sorteio e simular, sem XP nem
  rating para não virar farm (M).
- Coach e reserva opcionais (decisão de balanço; P).
- O1/O2 acima.

### Trilha Identidade (contínua)

- **Direção de arte deliberada: feita no `design/broadcast-pilot`**
  (v2.0.33-design.1, em `staging`): Industry como fonte de títulos, Barlow no
  corpo no lugar da Geist, carreira, placares, mesa, notícias e home num
  padrão só. Falta levar para `main` e medir na próxima pesquisa. O lote
  "Ouvimos vocês" é feito em cima dele (branch `claude/survey-fixes`).
- **Voz humana:** novidades no jogo com a voz do Miguel, mural de créditos da
  comunidade (houve pedido de "membro honorário"), créditos nas especiais
  sugeridas.
- **Programa de criadores:** criadores de conteúdo da cena como jogadores ou
  criadores contratáveis, **só com consentimento** de cada um. É conteúdo e
  divulgação ao mesmo tempo.
- Medida: repetir a pergunta "parece IA?" na próxima pesquisa.

### Depois

- **Broadcast (visualizador 2D):** depois da Etapa 3. Até lá, o Match Center
  ganha placar ao vivo, gráfico de embalo e lances em texto a partir da súmula.
- **Dinastia:** desafios pós-Worlds e cenários migram em parte para O1; Hall
  da Fama vai para a Etapa 3; era de início e talento do ranqueado ficam aqui.
- Francês e espanhol seguem na trilha contínua (Rift Career já tem 4 idiomas).

## 6. O que não fazer agora

- Correr atrás de 3D ou do motor real do jogo.
- Tirar rating do jogador para resolver o fim de jogo; quem fica forte é o
  mundo.
- Começar o online pelo tempo real ou pelo chat.
- Profundidade sem atalho: todo sistema novo vem com "deixar com o coach" ou
  um padrão automático (gerir a org já confunde quem respondeu).

## 7. Como medir

- Retenção D1/D7 de quem toca na carreira, hoje 63% no D1.
- Temporadas por carreira e em que temporada as carreiras longas param (o
  "fica fácil e chato").
- Criação de carreira no celular contra o desktop (33% contra 53%).
- Adesão ao Pro e à copa semanal; draft com amigos por semana.
- Nova pesquisa em ~6 semanas com as mesmas perguntas, incluindo "parece IA?".

## 8. Decisões do Miguel

Para começar a sequência consolidada (19/11), as que destravam trabalho já:

- **E0.** Quando a identidade nova vai para `main`, e com qual número
  (v2.0.35 ou v2.1)?
- **E1.** A ordem Matchday → Pro → Diretoria → Online ao vivo (N1 e N3
  abaixo juntos).
- **E2.** Qual frente paralela primeiro: desafio por link (recomendada),
  Daily com draft ótimo, RLCS-dle ou notas da comunidade?
- **E3.** A lista de times que são stacks sem org (A4).

As anteriores:

- **N1.** Antecipar o Pro para a v2.2, antes do Broadcast e da Diretoria?
- **N2.** "Mundo vivo" como frente da Etapa 1, ou uma etapa curta antes do
  Matchday?
- **N3.** Visualizador 2D para depois da Etapa 3?
- **N4.** Começar o lote "Ouvimos vocês" agora?
- **N5.** ~~Direção de arte~~ feita no `design/broadcast-pilot`; falta a data
  de ir para `main`.
- **N6.** Programa de criadores e mural da comunidade: sim ou não, e quem
  entra?
- **N7.** Copa semanal da carreira como primeiro degrau do online?
