# Relatório pós-lançamento 2.0 — PostHog, 12 a 14/11/2026

> Janela: do deploy (12/11 14:00 UTC) até 14/11 16:48 UTC, cerca de 51 horas.
> Fonte: PostHog (projeto 204375), eventos do catálogo 2.0. Código: `main` em v2.0.13.
> Números são contagens brutas de eventos; "usuários" são pessoas anônimas do PostHog
> (um jogador em dois aparelhos conta duas vezes).
>
> **Limites dos dados.** Sem gravação de sessão e sem `$exception` (desligados de
> propósito). Erros de tela: no máximo 3 por carregamento de página. 49 aparelhos bateram
> no teto de 400 eventos por dia, e depois dele nada é enviado, nem erro. Os números de
> erro são, portanto, um piso.

## 1. Resumo

1. **A carreira é o que segura o jogador.** Dos novos de 12/11, 63% dos que tocaram na
   carreira voltaram no dia seguinte, contra 11% dos que não tocaram.
2. **O crash principal tem causa única: tradução automática do navegador.** 44 dos 95
   erros de tela, 16 dos 28 jogadores com erro. Corrigido na v2.0.14.
3. **A "tela preta" é a tela de erro global padrão do Next**, que aparecia quando a tela
   de erro da rota falhava ao limpar o DOM quebrado. Substituída na v2.0.14.
4. **Nenhum soft lock de motor aparece nos dados.** Zero `quality_save_error`, zero
   `quality_slow_advance`, nenhum acúmulo de carreiras paradas numa semana específica, e
   a sondagem do repositório passou sem achados. Ver a ressalva na seção 4.
5. **O volume de eventos está perto de 1 milhão por mês**, o limite do plano gratuito.

## 2. O que está bom

| Indicador | Valor |
|---|---|
| Usuários por dia | 60–139 na semana anterior → 230 (12/11), 419 (13/11), 253 (14/11, dia parcial) |
| Novos usuários | 163 (12/11), 307 (13/11), 133 (14/11 parcial) |
| Carreiras criadas | 345, por 272 usuários |
| Criou carreira → jogou o primeiro evento | 209 de 271 (77%) |
| Temporadas concluídas | 1.056, por 150 usuários |
| Carreiras encerradas | 105: 75 linha do tempo completa, 20 Worlds vencido, 10 insolvência |
| Contas | 173 usuários entraram com conta (700 logins) |
| Migração de saves | 138 migrações de perfil, nenhuma falha de leitura ou gravação reportada |

**Retorno no dia seguinte, novos usuários** (cálculo avulso, não é métrica salva):

| Entrou em | Tocou na carreira | Não tocou |
|---|---|---|
| 12/11 | 37 de 59 (63%) | 11 de 104 (11%) |
| 13/11 | 41 de 106 (39%, dia seguinte ainda em curso) | 13 de 201 (6%) |

É correlação: quem cria carreira já chega mais engajado. Mas a diferença é grande o
bastante para tratar a carreira como a porta de entrada principal.

**Profundidade.** 95 carreiras pararam na temporada 0, 74 passaram da 5ª, 2 chegaram à
27ª. Há jogadores com mais de 400 torneios em dois dias.

**Regiões e dificuldade (carreiras criadas).** EU Normal 87, NA Normal 84, SAM Normal 64;
Easy 56 no total, Hard 27. MENA, APAC, OCE e SSA somam 42.

**Draft.** 7.170 runs concluídas no catálogo 2.0. Classic Legacy 3.457 (88 usuários,
1,5% de título), Normal 1.714 (155 usuários, 33%), Hard 1.107 (18%), Easy 809 (69%).

## 3. Erros de tela (`quality_error`): 95 eventos, 28 usuários

| Grupo | Eventos | Usuários | Leitura | Situação |
|---|---|---|---|---|
| `NotFoundError` em `insertBefore` / `removeChild` | 44 | 16 | Tradução automática da página ou extensão moveu nós do React | **Corrigido na v2.0.14** |
| `Script error.` (Safari iOS) | 20 | 2 | Erro de script de outra origem; o navegador não informa o conteúdo | Sem ação possível |
| `TypeError: Cannot read properties of undefined (reading …)` | 10 | 5 | Promessa rejeitada em 6 rotas; o filtro apagava o nome da propriedade | **Passa a ser rastreável na v2.0.14**; causa ainda desconhecida |
| `ChunkLoadError` | 8 | 2 | Arquivo JS que o deploy novo não serve mais (13 deploys em dois dias) | **Recarrega sozinho na v2.0.14** |
| `Java object is gone` | 4 | 4 | WebView de app no Android (navegador embutido) | Ruído |
| `RangeError: Maximum call stack` (Chrome iOS) | 2 | 1 | Mesmo aparelho do `NotFoundError` de tradução | Provável efeito da tradução |
| `k.specialIds is not iterable` em `/play` | 1 | 1 | Resultado salvo antes da v1.3.3 sem o campo | **Corrigido na v2.0.14** |

### 3.1 O crash da tradução

Chrome, Edge e Firefox traduzem a página embrulhando cada nó de texto num `<font>`. O
React continua achando que o nó está no pai original; a próxima remoção ou inserção
lança `NotFoundError` no meio da atualização da tela.

Evidência de que é tradução, por idioma do navegador:

| Idioma do navegador (interface do jogo) | Usuários | Com o crash |
|---|---|---|
| Inglês (EN) | 347 | 2 (0,6%) |
| Francês (EN) | 69 | 6 (8,7%; 10% dos que jogaram carreira) |
| Espanhol (EN) | 30 | 2 |
| Alemão (EN) | 19 | 1 |
| Japonês (EN) | 3 | 1 |
| Português (PT) | 70 | 2 |
| Português (EN) | 121 | 0 |

Rotas: `/career` 18, `/career/event` 15, `/career/training` 6, `/play` 3, outras 2.
Dos 16 jogadores, 6 não registraram mais nenhum torneio depois do erro (um argentino teve
4 erros em 9 minutos e saiu; um mexicano, 3 em 2 minutos).

**Por que virava tela preta.** A tela de erro da rota precisa remover a árvore quebrada
para se desenhar. Essa remoção falha pelo mesmo motivo, o erro sobe, e o Next mostra o
erro global padrão: uma linha cinza em fundo preto, sem botão. "Tentar de novo" na tela
de erro normal também não resolvia: a árvore continuava quebrada.

**Correção (v2.0.14).**
- `src/lib/domGuard.ts`: as duas chamadas de DOM deixam de lançar. Se o nó foi embrulhado,
  a operação é feita no embrulho; se sumiu, a remoção é ignorada e a inserção vai para o
  fim. Testado no navegador contra o DOM real: a chamada nativa lança `NotFoundError`, a
  protegida deixa a árvore correta.
- `src/app/global-error.tsx`: tela de último recurso no visual do jogo, com "Recarregar a
  página" e link para o menu.
- `src/app/error.tsx`: para esse tipo de erro o botão principal passa a ser recarregar, com
  a dica sobre tradução.

**Limite conhecido.** Com a tradução ligada, um texto que o React atualiza dentro de um
embrulho pode ficar desatualizado até a próxima navegação. Tela errada, não tela morta.

**Não verificado.** O crash não foi reproduzido de ponta a ponta com o tradutor real do
Chrome; a verificação foi o mecanismo no DOM real mais os testes. A confirmação é a queda
do `NotFoundError` no PostHog nos dias seguintes ao deploy.

## 4. Soft locks

O que os dados permitem afirmar:

- **Nenhuma ação da carreira lançou erro em produção.** O store reporta
  `quality_save_error` quando um fluxo falha (foi esse o soft lock da rc.47–rc.49). Zero
  eventos desde o lançamento.
- **Nenhum avanço lento** (`quality_slow_advance`: zero).
- **Nenhum acúmulo de carreiras paradas num ponto.** As paradas se concentram nas semanas
  3 a 6 da primeira temporada (desistência normal de início) e nos fins de temporada.
- **Sondagem do repositório** (`careerSoftlock.probe.test.ts`) em NA, EU e SAM, Normal, 4
  temporadas: 255 lobbies, 0 achados. A sondagem completa (7 regiões, 7 temporadas) foi
  interrompida aos 24 minutos sem terminar; não há resultado dela.

O que os dados **não** enxergam: uma ação recusada de propósito (elenco curto, evento
pausado, decisão pendente) devolve o mesmo save e não envia evento. Se alguma tela não
explica a recusa, o jogador fica preso e nada chega ao PostHog. Dois candidatos fracos
apareceram (um jogador que recarregou só `/career/training` quatro vezes em 11 horas na
semana 3; outro parado em `/career/market`), sem como distinguir de aba esquecida.

A leitura mais provável dos relatos é que "soft lock" e "tela preta" são o mesmo crash de
tradução visto de fora: a tela de erro voltava a cada "Tentar de novo". Se houver relato
de jogador com interface em inglês e sem tradução, preciso da tela e do navegador.

## 5. O que precisamos mexer

| # | Item | Por quê | Tamanho |
|---|---|---|---|
| 1 | **Evento para avanço recusado na carreira** (motivo + tela, uma vez por sessão) | É a única forma de ver soft lock de interface | Pequeno |
| 2 | **Orçamento de eventos** | 28–33 mil eventos por dia, cerca de 1 milhão por mês. `career_event_completed` é 36% do total. `analytics-budget.json` diz 120 jogadores/dia; o real é 230–420 | Decisão do Miguel |
| 3 | **Erros fora do teto diário** | 49 aparelhos bateram no teto de 400/dia; os erros deles se perdem, e são os jogadores mais ativos | Pequeno |
| 4 | **Francês e espanhol** | França é o 3º país (62 usuários), 69 navegadores em francês e 30 em espanhol jogando em inglês. Tradução oficial elimina a causa do crash | Grande |
| 5 | **Carreira no celular** | Celular: 414 usuários, 136 criaram carreira (33%), 97 jogaram o primeiro evento (71% dos que criaram). Desktop: 253, 134 (53%), 110 (82%) | Investigar |
| 6 | **Falha de sincronização da conta** | 29 falhas em 21 usuários, 12% de quem entrou com conta; 16 na gravação, 13 na leitura | Investigar |
| 7 | **`TypeError` em promessa, 6 rotas, 5 usuários** | Com a v2.0.14 o nome da propriedade passa a chegar; reavaliar em alguns dias | Aguardar dados |
| 8 | **Draft Legacy** | 48% das runs, 88 usuários, 47 s por run, 1,5% de título: uso de farm de rating | Já em ajuste (2.0.9–2.0.12) |

## 6. Como conferir depois do deploy da v2.0.14

No PostHog, filtrar `release = 2.0.14`:
- `quality_error` com `name = NotFoundError` deve cair para perto de zero.
- `quality_error` com `message` contendo `reading` passa a mostrar a propriedade.
- `ChunkLoadError` pode continuar aparecendo (o erro é reportado antes do recarregamento),
  mas sem repetição do mesmo usuário em minutos seguidos.
