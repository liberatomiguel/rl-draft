# Concorrentes — o que reaproveitar e o que fazer melhor (19/11/2026)

> Complementa o PLANO-PROXIMO-NIVEL-2026-11-19.md (§3). Fontes: páginas,
> bundles JavaScript, repositórios e releases públicos lidos em 19/11 por
> três pesquisas paralelas. **Só ideias**: nenhum código deles pode ser
> reaproveitado. Veredito por recurso: **REUSAR** (a ideia serve como está),
> **FAZER MELHOR** (a ideia serve, a execução deles tem um furo) ou **PULAR**.

## 1. RLCS Draft (draftrlcs.app)

**Por baixo:** PWA em Vite na Vercel, uma função serverless (`/api/suggest`),
Supabase para perfil, coleção, economia, resultados diários, XP de temporada e
salas em tempo real. Login só pelo Discord. Anúncios AdSense, Ko-fi e Patreon
(adesivos e títulos). Um bundle de ~2 MB com todos os dados, só em inglês.

**Comunidade e ritmo:** lançamento em 7/6/2026 (tweet com ~100 mil
visualizações), Discord com 343 membros (79 online em 19/11). Changelog com
entradas em junho e nada datado depois de 29/6; carreira, Zero to Hero e
Season Pass entraram sem data. Muitos modos em beta.

| Recurso | Como funciona | Veredito |
|---|---|---|
| **Multiplayer ao vivo** | Sala com código ou link `?join=`, anfitrião e convidado no Supabase Realtime. 45 s por escolha com escolha automática; duelo ou chave com CPU completando, espectador. A mesma sala serve os jogos de festa | **FAZER MELHOR.** Passo 1: desafio assíncrono por link, mesma seed para os dois, sem servidor. Passo 2: draft 1v1 em tempo real pelo Supabase Realtime, que roda no cliente e não toca no limite do Worker |
| **Carreira ("manage a pro")** | Larga e rasa: quatro começos (desconhecido de 60, ex-pro, prodígio de 16, streamer), peneiras, e-mails com escolha, ladder de 6 Mans, franquias históricas, clubes que quebram, caminhos de agente, dono e coach; ao se aposentar vira coach ou funda org. Guia vazio | **PULAR a largura.** Levar dois detalhes: os **começos por arquétipo** e a **continuação aposentado → coach/dono** |
| **Zero to Hero** | Roguelite de ~15 min: capitão de 60 escolhe 2 colegas e coach mais uma vantagem; liga de 7 séries, top 4 vai ao Worlds; cada vitória dá um upgrade e permite roubar um jogador do time batido; rival na final; versão com seed diária e cartão para compartilhar | **REUSAR.** Ocupa o buraco entre o Quick Draft e a carreira, e o nosso motor de carreira pode rodá-lo |
| Gauntlet 1v1/2v2/3v3 | Nota por formato para cada carta; série melhor de 9 | **PULAR por ora:** exige avaliar cada carta mais duas vezes, notas contestáveis |
| **Daily Showmatch** | Seis ofertas fixas por dia e um chefe, uma tentativa, 4-0 é perfeito. Os puzzles vêm pré-calculados com o caminho ótimo e o teto; depois revela o draft ótimo. Compartilha em quadradinhos estilo Wordle | **FAZER MELHOR** no nosso Daily: revelar o **draft ótimo e o teto** (calculados no build pelo motor determinístico) e o **percentil** do jogador contra todos (Supabase) |
| Hard Carry (diário) | Um jogador-âncora fixo no P1, uma tentativa por dia, química com conterrâneos e ex-colegas vale até +6, placar próprio | **REUSAR:** variante diária barata sobre a química que já temos |
| **Jogos de festa** | Blind Rank, Guess Who (8 palpites com dicas de país, região, org, era, nota e colegas), Higher or Lower, Bidding Wars, Speed Rating, Stat Duel; diário, ilimitado e contra amigo | **REUSAR** o Guess Who como "RLCS-dle" diário e o Higher or Lower: estáticos, compartilháveis, ao lado do Daily Quiz |
| Coleção, fusão, brilhante | Ganhar o Worlds com o jogador coleciona a carta; fechar um conjunto (temporada, região, org) cunha uma carta única. Créditos, pacotes com piedade, fusão de duplicatas (10/20/50) | **FAZER MELHOR:** "colecione vencendo" e prêmio por conjunto completo, pagos em badges, banners e títulos. **PULAR** pacotes e piedade (beira aposta) e o grind de duplicatas |
| **Season Pass** | 30 níveis, tarefas diárias e semanais, cadeias, prêmios por colocação | **FAZER MELHOR:** trilha de recompensas visível nas nossas temporadas, com tarefas que levam aos nossos modos e só cosméticos como prêmio |
| **Notas da comunidade** | Bandeira em cada carta abre controles e um campo de motivo; vai para um webhook do Discord; caixa de admin aprova ou rejeita; página pública de notas; mudanças aceitas no changelog. O criador é ex-coach de RLCS, o que dá autoridade | **REUSAR:** tabela só-inserção no Supabase (sem código de servidor), página de notas estática e indexável, registro público do que mudou. Liga com a planilha de sugestões que já existe |
| Placares | Por modo e dificuldade, Hard Carry, colecionadores, XP de temporada; placar diário postado no Discord | **REUSAR** colecionadores e percentil diário |
| Compartilhar | X, WhatsApp, Discord, PNG via html2canvas, grade de quadradinhos | **REUSAR** a grade onde ainda não temos |

**Fraquezas deles:** comunidade pequena depois do pico, changelog parado,
muitos betas, login só por Discord (convidado perde a coleção ao limpar o
navegador), só inglês, bundle pesado no celular, notas marcadas como
provisórias, regras dos modos novos sem texto. O bundle publica nome real e
data de nascimento dos jogadores.

**Os cinco movimentos que mais nos custariam se ignorados:**
1. Draft contra amigo (assíncrono primeiro, ao vivo depois).
2. Jogos de festa diários com grade para compartilhar.
3. Trilha de recompensas da temporada com tarefas.
4. Ciclo público de notas da comunidade.
5. "Colecione vencendo" com prêmio por conjunto; um roguelite diário logo atrás.

## 2. Rocket League Manager — RLM (itsaminus) e Manageur (Umbul)

**Por baixo:** app Electron/TypeScript com um SQLite por carreira; partidas
jogadas no próprio Rocket League por bots (RLBot + BakkesMod). **Risco deles:**
o Rocket League recebeu o Easy Anti-Cheat em 28/4/2026 e o BakkesMod parou;
as partidas do RLM dependem de abrir o jogo sem anti-cheat.

**Alcance real:** ~70 instalações completas pelos downloads do GitHub, base
ativa na casa das dezenas; 0 estrelas, 2 issues (uma de soft lock em julho de
2027 ainda aberta). 12 versões em 23 dias (18/10 a 9/11), nada depois de 9/11.
Instalação de 7,3 GB, 30 GB livres, instalador sem assinatura. IA declarada em
código, arte, som e texto.

| Recurso | Como funciona | Veredito |
|---|---|---|
| **Metas da diretoria** | Meta de reputação em 3 anos acima de três eixos anuais (vitórias, jogadores sub-22, teto de folha), negociados com contraproposta. Revisão aos 365 dias; demissão exige meses de caixa negativo e aviso final; título dá 180 dias de proteção. Versões antigas apagavam o save ao demitir | **FAZER MELHOR** na Etapa 3: um controle de pré-temporada "ambição × orçamento" ligado às metas de patrocínio, com o efeito mostrado na hora. Nunca apagar save: demitido escolhe outro clube |
| **Scouting e promessas** | Sem ver overall, potencial ou atributos de outros clubes até mandar um olheiro (individual, regional ou de time, com custo e prazo); relatório perde precisão em 120 dias; 5 jovens gerados por região com 2,5% de chance de teto excepcional | **FAZER MELHOR:** esconder o overall de pros reais briga com o que o fã já sabe. Esconder só jovens gerados e potencial, como faixas que estreitam, com missões de olheiro no calendário |
| **Negociação e agentes** | Primeiro o acordo entre clubes, depois o salário com o agente. Contraproposta vence em 7 dias e não muda ao reabrir a tela. Agências lembram a relação com o clube. Cláusulas: percentual de revenda, recompra, promessa de tempo de jogo revista após 6 séries (quebrar custa moral e gera pedido de saída) | **REUSAR** a contraproposta que vence e não muda (acaba com o "reabrir até sair") e a promessa de tempo de jogo. **PULAR** recompra e salário pago pelo vendedor no celular |
| Parcelamento | À vista ou em 3, 6 ou 12 meses com 30% de entrada; a diretoria confere as parcelas contra a receita prevista | **REUSAR:** é contabilidade pura, ao lado dos empréstimos |
| Departamentos de staff | Recrutamento, treino e cuidado do jogador, com custo e tempo de contratação; os próprios documentos dizem que o efeito não está definido | **FAZER MELHOR:** o nosso staff já existe; mostrar o efeito exato de cada um |
| **Vestiário** | Três medidores (coesão, clima, apoio ao manager); jogadores influentes por tempo de casa e profissionalismo, não por nota; contratação, venda e troca de coach custam química; conversas de equipe | **REUSAR** os três medidores e o "jogador influente", recompensando escolhas do jogador (não um bônus global de química) |
| **Rede social "Chirp"** | Um modelo de linguagem local escreve posts e brigas usando identidades reais de jogadores; exige ~3 GB de RAM. O destaque: a provocação do manager antes da série volta como "recibo" depois da derrota | **REUSAR** em modelos de texto EN/PT: resumo diário de transferências, filtro "só minha região", o recibo da provocação. **PULAR** o modelo de linguagem e qualquer frase inventada atribuída a pro real (risco jurídico e de imagem) |
| **Mesa do analista** | Antes de cada série: escalações, diferença de nível, forma, confrontos diretos, notas táticas e caminho no torneio; áudio narrado só em Major e Worlds. Banco de 100 situações × 3 variações (revanche, sobrevivente de virada, estreia no palco grande); uma "dinastia" só é dita com prova nos dados | **REUSAR** como textos EN/PT do plano pré-série do Matchday. **Copiar o princípio:** a narrativa só afirma o que os dados provam |
| Path To Glory | Você escolhe seu rank real (Bronze a SSL), que define o nível inicial e o dos rivais; 41 desafios com XP. Peneiras citadas no README não existem no código | **REUSAR** a escada de desafios com XP no Pro; **PULAR** o jogar-você-mesmo |
| Partidas no jogo real | Bots com precisão pelos atributos; 11 ajustes táticos que mudam a força em só ±3; câmera de transmissão e replays. A maior fonte de bugs deles | **PULAR** o jogo real. **Aproveitar a lição:** tática que quase não muda nada é decoração; os estilos do Matchday precisam ser visíveis e ter contra. A simulação deles gera estatística barata por jogador (gols por Poisson a partir da diferença, autor ponderado por chute e posicionamento, 70% de chance de assistência, defesas a partir dos chutes perdidos): bom modelo para a súmula do Matchday |
| Desenvolvimento | Um ponto de overall exige 30+ sessões produtivas, 35+ dias e 6+ séries com bom desempenho por função; vitória sozinha não conta | **REUSAR com leveza:** tempo de jogo como condição de crescimento, sem nunca tirar rating |
| Editores | Editor completo da carreira e importação de jogadores | **PULAR:** quebraria placares e ligas. No máximo, um relatório de correção de dados |
| **Seleções nacionais** | Emprego paralelo ao clube; 3 convocados por nacionalidade; torneio de 16 seleções (fase de grupos e mata-mata) | **REUSAR:** as bandeiras e nacionalidades já existem no dataset |
| Clube próprio | Região, logo enviado, 3 jogadores criados; editor de escudo e uniforme | Já temos escudo e cores; nada novo |
| **Manageur: criadores de conteúdo** | Contratar criadores; a receita dos vídeos se divide entre criador, jogadores e clube | **REUSAR** como linha de receita de mídia (já prevista na Etapa 4 como "conteúdo como receita") |

## 3. Carreiras de jogador (RL Career, Rift Career, Road To Pro, Rocket Life)

Os quatro são muito novos e pequenos, e **nenhum tem um mundo com dados reais
do RLCS**. Não achamos reações de jogadores específicas de Rocket League
(Reddit e X bloquearam a leitura).

| Jogo | Como é | Pontos fortes e fracos |
|---|---|---|
| **RL Career** (sarpbc.org) | Código aberto (Apache-2.0, Nuxt/Vue), lançado em 19/9/2026. Criação: nome, região, país, função (ataque, técnico, defesa) e origem (prodígio, esforçado, 1v1, freestyler). Começa no time mais fraco da região. Antes de cada etapa, 1 a N eventos de texto com 2 ou 3 escolhas e efeito fixo em rating, forma e moral, mais uma "inclinação de destino" (largar, virar streamer, virar coach) e um risco de dar errado. Você nunca joga partida: força do time = 55% você + 45% elenco, mais ruído | Final com destino, apelido ("The Wall", "LAN Tourist"), troféus e link para compartilhar com o resultado na URL. Mundo de 24 times fictícios fixos. EN/FR, sem conta |
| **Rift Career** (riftscore.net) | Fechado; a mesma casca roda LoL, Valorant e CS2. Nome e região, 50 de OVR, 16 anos; escolhe time, simula a temporada inteira, recebe propostas, repete | Carreira em ~3 minutos, "viciante" na versão de Valorant (40 respostas); reclamações: OVR trava nos 80, queda de 88 para 77 logo depois de ganhar o Worlds, 17 títulos de segunda divisão sem proposta da primeira |
| **Road To Pro** (GitHub) | Criado em 18/11/2026, **sem licença** (só ideias). Cada ação custa uma semana; treino com energia ou partida em 1v1, 2v2, 3v3 ou torneio; chance de vitória logística a partir de 6 atributos; 26 ranks até World Champion; 10 clubes liberados por MMR, sem custo para sair | Energia só recarrega ao subir de nível, créditos sem uso. O visualizador 3D é uma demo de física separada (Three.js, ~150–300 KB comprimido, sem toque): **o placar que você assiste não é o placar que a carreira grava** |
| **Rocket Life** (itch.io) | App Windows que lê suas partidas reais pela API local de estatísticas (só PC; console digita à mão). Nota 0–10 por jogo, 4 divisões com acesso e rebaixamento numa temporada no formato RLCS | Negociação de salário e luvas com risco de o clube desistir; coletiva com 48 perguntas (os próprios jogadores pediram menos: a frequência padrão caiu); relações que esfriam; clássicos, ex-colegas no rival, disputa de titularidade, confiança da diretoria; gala de fim de temporada; edição para streamer |

**O molde por trás de RL Career e Rift:** o Copero, carreira de futebol no
navegador que viralizou em 2026 (85 a 100 milhões de partidas, 4 milhões de
usuários, espalhado por streamers): sem conta, carreira de 2 minutos, modos em
que você decide a cada 3, 2 ou 1 temporadas, e um **cartão de aposentadoria
feito para compartilhar**. Em fóruns de Valorant, os jogadores dizem que
surgem vários desses por ano e pedem mais decisões.

| Mecânica | Quem tem | Veredito para o nosso Pro |
|---|---|---|
| Origem e função na criação | RL Career | **REUSAR**, começando aos 15–16 no ranqueado, país real ligado à região |
| **Modo expresso + cartão final** | RL Career, Rift, Copero | **FAZER MELHOR.** Um modo expresso (uma decisão por split, ~5 min) ao lado do modo semanal. Cartão gerado no navegador (canvas → PNG, Web Share) e uma página de resultado na URL, que funciona no export estático. O cartão coloca o jogador ao lado das lendas reais do dataset |
| Eventos de texto com efeito fixo | RL Career (29 eventos), Copero, coletivas do Rocket Life | **FAZER MELHOR:** eventos presos ao calendário real (a cidade do Major, os rivais de verdade, a história da org), dependentes do estado, com a chance insinuada. Banco pequeno repete |
| OVR único com teto e declínio | RL Career, Rift | **FAZER MELHOR:** poucos atributos ligados aos eventos do motor v2 (chute → gols, defesa → defesas), para o treino aparecer na súmula. Explicar toda mudança de OVR; declínio tardio e gradual (a queda sem explicação é a maior queixa do Rift) |
| Ranqueado até o profissional | Road To Pro, Rocket Life | **REUSAR** como prólogo curto (a arte dos ranks já existe), depois Open Qualifiers |
| Ser notado e receber propostas | Todos, com tensões diferentes | **FAZER MELHOR:** olheiros reagem às notas 0–10; propostas de orgs reais da época com função (titular ou reserva), duração e salário; uma contraproposta com risco de o clube desistir |
| Nota por partida e súmula | Rocket Life (dados reais), Road To Pro (sorteada depois) | **FAZER MELHOR:** o motor v2 gera os eventos primeiro e o placar sai deles |
| Semana com energia | Road To Pro (quebrado) | **FAZER MELHOR:** nosso calendário, 1–2 escolhas por semana (foco de treino, descanso, live, scrim), cansaço que recupera, gastos reais |
| Disputa de titularidade, confiança, relações | Rocket Life | **REUSAR:** três titulares e um reserva tornam isso natural |
| Coletivas e rede social | Rocket Life | **REUSAR com moderação**, com ajuste de frequência; cada linha custa texto EN + PT |
| Destino, apelido, gala de prêmios | RL Career, Rocket Life | **REUSAR:** barato e compartilhável |
| Ranking mundial vivo | RL Career (24 times fictícios), Road To Pro (bots) | **FAZER MELHOR:** ranquear o jogador entre pros e orgs reais de 2016 a 2027 e a continuação. É o nosso fosso |
| Partidas reais, Twitch/OBS, códigos de amigo | Rocket Life | **PULAR:** exigem app de desktop ou servidor |
| Minijogos de sorte por créditos | Rocket Life | **PULAR:** cara de aposta para um público jovem |

**Visualizador 3D: não vale agora.** Uma física de verdade não reproduz o
resultado do nosso motor, coreografar carros e bola para cada evento é muito
trabalho, e o peso do Three.js mais a bateria do celular pesam num site
pensado para o celular. Melhor custo: narração lance a lance para cada evento
do v2 (chute, defesa, demolição, gol), barra de embalo, súmula com notas 0–10
e cartões de momento-chave. Se um dia quisermos movimento, um minicampo 2D em
SVG com pontos que vão para a posição de cada evento custa poucos KB e é fiel
ao resultado.

## 4. O que muda no plano

1. **O Pro ganha um modo expresso e um cartão final para compartilhar.** É o
   motor de viralização do gênero (Copero, RL Career, Rift) e o que mais nos
   diferencia deles é colocar o jogador ao lado das lendas reais.
2. **O "Broadcast" deixa de ser um visualizador 2D grande.** Vira narração
   lance a lance, barra de embalo, súmula e momentos-chave na Etapa 1; o
   minicampo em SVG fica como opção depois. Ninguém vence o RLM no
   espetáculo, e o RLM está preso ao BakkesMod depois do anti-cheat.
3. **Narrativa só afirma o que os dados provam** (o princípio da mesa do
   analista do RLM) e depende do estado e do calendário real, não de um banco
   fixo de eventos.
4. **Estilos e plano do Matchday precisam aparecer e ter contra:** a tática
   do RLM muda ±3 e é decoração.
5. **Contrapropostas que vencem e não mudam ao reabrir** em todo o mercado
   (transferências, patrocínio, contratos do Pro).
6. **Demissão nunca apaga nem encerra o save:** abre o mercado de técnicos
   (D5 do roadmap continua de pé).
7. **Seleções nacionais** como evento internacional da carreira: os dados de
   país já existem e nenhum concorrente de navegador tem.
8. **Trilha Draft:** desafio contra amigo por link, um "RLCS-dle" diário no
   estilo Guess Who, a revelação do draft ótimo no Daily com percentil, a
   trilha de recompensas da temporada, o ciclo público de notas da comunidade
   e "colecione vencendo" com prêmio por conjunto. Um roguelite de 15 minutos
   (como o Zero to Hero) pode servir também de entrada da carreira no
   celular.
9. **O que não copiar:** pacotes e piedade, minijogos de sorte, modelo de
   linguagem local, frases inventadas de pros reais, editor de carreira,
   esconder o overall de pros reais.
