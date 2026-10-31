# Rocket Draft rc.36.4 — endgame, cobertura e decisões

Base: último `origin/staging` conferido, rc.36.3 (`9d5690a`). Candidato:
rc.36.4, `BALANCE_VERSION=9`. Escopo: o pedido deste chat. O roadmap é
planejamento; nenhuma feature das Etapas 4–6 foi iniciada.

## O que os dados permitem concluir

**O jogo ainda não está validado como bem balanceado do início ao fim.**
O começo estava acelerado em reputação/classificações; a rodada anterior
reduziu isso, mas o regional continua cedo em vários caminhos. Ao mesmo
tempo, construir uma equipe que vença o Worlds nas últimas 2–3 seasons
históricas ainda não foi demonstrado de forma consistente. São problemas
em partes diferentes da curva; endurecer toda a simulação não resolve ambos.

Há **6 seasons históricas**. S7–8 são observação do infinito e não contam
como sucesso na meta de lançamento. Os resultados são de políticas
automáticas específicas, não taxas de sucesso previstas para humanos.

## Por que os testes não ganham o Worlds?

1. **Classificar na região não significa ter nível mundial.** Na matriz
   anterior aos novos benefícios, os 16 Worlds disputados foram no Fácil:
   rating mediano do usuário 86,9 e distância mediana de 9,3 para o melhor
   adversário. O jogador precisa sobreviver a várias séries, não apenas
   conseguir uma vitória isolada. No suplemento Normal/prospects, eram
   89,0 e uma distância de 7,9.
2. **O elenco precisa mudar conforme sua vocação.** Veteranos começam mais
   fortes, mas com potencial baixo; o elenco equilibrado também não vira
   automaticamente três estrelas. Prospects precisam de tempo e investimento.
   Os agentes não fazem todas as combinações de trocas, vendas e contratos
   que um humano pode planejar.
3. **Cobertura de contratação não equivale a cobertura de estrelas.** Na
   matriz antiga desta rodada houve 663 contratações nas S1–6, mas nenhuma
   de jogador com overall ≥88 na assinatura. Na candidata, 672 e somente
   duas. O suplemento teve uma contratação desse nível por versão.
4. **Nem todos chegam à estrutura final.** Na candidata completa, Centro
   de Performance em 9/63 carreiras até S6; no suplemento, 6/14. Reputação,
   pré-requisitos, preço e reserva de caixa limitam a compra. Não forçamos
   itens, dinheiro, overall nem classificação nas carreiras medidas.

Portanto, zero títulos nessas carreiras não prova que vencer seja impossível
para um humano. Também não autoriza declarar a curva resolvida. A evidência
aponta para acesso tardio à força competitiva e limitações das estratégias
testadas, além do peso do torneio mundial.

## O que os testes realmente incluem

| Pergunta | Cobertura real |
|---|---|
| Evolução de overall, idade, potencial e declínio? | Sim: calendário, treinos, scrims e partidas do jogo, com desenvolvimento real e manutenção/declínio. |
| Salários crescem com o overall? | As ofertas e renovações usam a curva real. O salário assinado fica fixo até renovar; não aumenta automaticamente a cada ponto ganho. |
| Compra de jogadores melhores e mais caros? | Sim: mercado, rep gate, assinatura/transferência, salário, negociação e folha reais. Poucas estrelas efetivamente compradas: essa rota ainda está sub-representada. |
| Premiações maiores nas seasons seguintes? | Sim: prêmios, novos contratos e demais valores usam o índice de 15% por season. Participação contratual dos jogadores, bônus/multas e custos também contam. |
| Compra de itens de progressão? | Na bateria antiga, só algumas políticas compravam instalações; não havia psicóloga e bootcamps na comparação de pacing. Nesta, todas as políticas tentam comprar instalações, staff e camps com recursos reais e reserva de caixa. |
| Todos com todos os itens? | Não. Isso ocultaria o problema de acesso econômico/reputacional. O relatório registra as compras que de fato aconteceram. |
| Três dificuldades, três elencos e sete regiões? | Agora, sim, **todas as 63 combinações** antes/depois. Antes havia todos os valores desses eixos, mas não seu cruzamento completo. |
| Todos os caminhos humanos? | Não. Uma seed por célula na matriz; duas no suplemento. Isso detecta diferenças e gargalos, não certifica cada estratégia nem estima uma população de jogadores. |

Os contratos antigos, a progressão conquistada e as regras de save permanecem
compatíveis. O teste de psicologia confirma que dispensá-la remove seu efeito;
o de instalações confirma benefício competitivo sem aumentar o overall
permanente dos jogadores.

## Benefícios avançados implementados para o playtest

| Item existente | Antes | rc.36.4 |
|---|---|---|
| Centro de Performance, rep 55 | Treino +15% e dois níveis de buff da org | Mantém esses efeitos e ganha **+1,5 no rating competitivo da equipe**, separado do limite compartilhado do buff da org. |
| Bootcamp estruturado, rep 38 | +1,0 de preparação competitiva | **+1,75**, com duração/regras atuais e limite temporário total preservados. |
| Psicóloga, rep 46 | +1 Clutch e +1 Consistência | **+3 em ambos**, enquanto contratada. |

Preços, manutenção, gates e o início da carreira não mudam nesta rodada.
Centro não significa +1,5 de overall individual; psicóloga não concede
três pontos de overall. Os benefícios aparecem nos detalhes da progressão.
Não há título obrigatório por season nem aumento automático de potencial.

## Nova comparação, com compras pagas

**77 carreiras por versão, 154 no total:** matriz completa de 63 com política
de melhorias atuais e suplemento de 14 Normal/prospects em sete regiões,
duas seeds, desenvolvendo jovens e passando a contratar força após um Major.
Mesmos pontos de partida e decisões por política em cada comparação.

Resultados nas seis seasons históricas; falências incluem toda a janela de
oito seasons e continuam no denominador dos inícios:

| Grupo | Inícios por versão | Chegaram ao Worlds: antes → depois | Títulos de Major: antes → depois | Títulos de Worlds: antes → depois |
|---|---:|---:|---:|---:|
| Matriz, Fácil | 21 | 7 → 9 | 0 → 1 | 0 → 0 |
| Matriz, Normal | 21 | 0 → 1 | 0 → 0 | 0 → 0 |
| Matriz, Difícil | 21 | 0 → 0 | 0 → 0 | 0 → 0 |
| Suplemento, Normal/prospects | 14 | 5 → 6 | 0 → 1 | 0 → 0 |

Na matriz, seis falências em cada versão, nenhuma trava de fluxo; no
suplemento, nenhuma falência/trava. No Normal da matriz, 8/21 passaram por
saldo negativo na primeira season e 3/21 faliram em oito seasons. No
suplemento, ambos foram zero. **Isso é dependente da política**, não uma
estimativa do risco para qualquer humano. Despesa frequente em consumíveis
e trocas modestas pode disputar caixa com o desenvolvimento do núcleo.

No suplemento, participações em Worlds sobem de 6 para 10 e o rating mediano
nesses eventos de 89,0 para 94,2. A distância mediana para o melhor adversário
cai de 7,9 para 3,5. Os próprios eventos/elencos divergem após resultados
diferentes; esses deltas não isolam sozinhos o efeito de cada bônus.
Também houve menos carreiras chegando ao Major no suplemento (8 → 7),
apesar de mais participações/título depois: o conjunto não melhora
uniformemente cada trajetória.

### Experimento controlado: o bônus faz diferença?

Congelamos o último Worlds histórico realmente alcançado por cada carreira
candidata. Repetimos cada campo 128 vezes com as mesmas seeds e adversários,
mantendo elenco, psicologia e dificuldade. Só retiramos/recolocamos o bônus
novo de rating do Centro/bootcamp. Essa repetição **não são novas carreiras**
e **não mede chance de título desde o início de um save**.

- Suplemento Normal: seis campos, **768 torneios por variante**. Títulos
  **0 → 21**; playoffs **271 → 486**. São aproximadamente 2,7% de títulos
  no conjunto condicionado a já ter chegado àqueles Worlds com aqueles times.
- Matriz: dez campos, 1.280 por variante. Títulos **0 → 5**; playoffs
  **394 → 664**. Nove campos são do Fácil; não misturar esse número com o Normal.
- Nos dois campos Normal mais fortes, ambos S6, a candidata ganhou 7/128
  e 12/128. O bônus ajuda um elenco competitivo; não transforma qualquer
  equipe em favorita mundial.

Conclusão: aumentar benefícios avançados é uma alavanca útil, agora com efeito
mensurável. **Ainda não fecha a meta de vencer Worlds no fim da campanha.**
Não aumentamos novamente os números até aparecer um título em uma seed;
isso seria ajustar para a amostra. O gate continua aberto.

## O que ainda precisa de balanceamento

1. **Rotas de elenco e economia de estrelas.** Medir dinheiro de entrada,
   folha sustentável, renovação de atletas desenvolvidos, venda e transição
   para jogadores 85/88/90+. Mostrar quantas contratações são possíveis e
   quantas temporadas sobrevivem, com prêmios realistas e também anos ruins.
   A curva salarial exponencial e o prêmio por overall/reputação merecem
   esse teste dirigido antes de qualquer redução global.
2. **Acesso ao endgame.** Separar não comprar por falta de reputação,
   pré-requisito, caixa ou escolha. Compra de quase todos os itens é uma
   hipótese de comportamento que ainda precisa ser confrontada com o custo
   e o calendário. Evitar que uma barreira de salário e outra de reputação
   fechem juntas a mesma saída de recuperação.
3. **Pacing regional e diferenças de dificuldade.** Reavaliar o split 3,
   Major S3–4 e Worlds S4–6 por região e estratégia, incluindo quem nunca
   chega. Preservar a identidade/quotas regionais; não exigir taxas iguais.
   Evitar novo nerf geral de reputação ou desenvolvimento: o fim já é lento
   em muitos caminhos.
4. **Playtest humano e mais seeds das rotas viáveis.** Casos salvos de
   academia, manutenção/reconstrução e compra de estrela; equipamento pago
   prioritário versus investimento no elenco. Só então fechar taxas-alvo e
   o gate. As políticas automáticas não são gerentes ótimos.

O valor financeiro do late game não é demonstrado só porque o simulador
contabiliza inflação. Prêmios e despesas subirem juntos não garante que um
elenco mundial caiba nas receitas e reservas de uma equipe emergente.

## Ideias de novos desbloqueios — propostas, não implementadas

Priorizar duas ou três escolhas compreensíveis, evitando uma pilha obrigatória
de bônus permanentes. Definir custo, duração e limite antes de programar:

- **Departamento de análise internacional:** preparação específica para o
  próximo Major/Worlds, com escolha de adversário ou perfil e benefício
  limitado ao evento. Útil para transformar investimento em decisão semanal.
- **Bootcamp de elite:** tier tardio, caro, uso limitado por season e ganho
  superior de preparação. Compartilha um limite explícito com outros efeitos
  temporários; não acumula sem teto a cada compra.
- **Rede internacional de scouting/recrutamento:** informação melhor e mais
  opções de mercado para formar um trio mundial. Não entrega estrelas grátis;
  só faz sentido depois de validar que contratar/sustentar uma seja viável.

Essas ideias não são necessárias para declarar a sessão concluída e não
foram adicionadas ao escopo aprovado de lançamento. Antes de criar outro
sistema, vale validar os benefícios existentes e o acesso ao mercado.

## Interface entregue

- Scrims em linhas maiores, empilhadas sob Avançar no card do calendário,
  com dia, escudo da equipe, escudo/nome do adversário e placar destacado.
  Só resultados registrados na semana; reload não simula novamente.
- E-mail conserva identidade de caixa de entrada, envelope e remetente.
  Notícia usa cabeçalho The Wire/Plantão, data, editoria, manchete serifada,
  resumo e escudo, com aparência de chamada jornalística.
- Desbloqueios continuam sem modal automático ou botão de compra no aviso.

## Evidência e reprodução

Tabelas e cada célula da matriz: `CAREER-ENDGAME-rc36-4-data.md`. O pacote de
evidências contém os JSONs brutos, replays com campos congelados, scripts,
logs, imagens e o identificador da publicação em staging.

`src/store/careerEndgame.probe.test.ts`: `ENDGAME=1`, `ENDGAME_OUT`,
`ENDGAME_SLICE=0/4` a `3/4`. Comparação usa `ENDGAME_CONTROL` apontando ao
dump de parâmetros antigo; replay opcional `ENDGAME_REPLAY=128`. Suplemento:
`ENDGAME_POLICY=contender ENDGAME_DIFFS=normal ENDGAME_ROSTERS=prospects
ENDGAME_SEEDS=2`. Controle com os parâmetros anteriores:
`ENDGAME_VARIANT=baseline`; candidato: `candidate`. Não misturar cohortes.
Geração das tabelas: `node scripts/report-career-endgame.mjs <pasta-dos-dumps>`.

Verificação da entrega: suíte completa **1.452 aprovados / 16 opt-in
ignorados**, tipo/lint sem erros, regeneração de dados sem mudança semântica
e 45 validações de dados aprovadas. Export estático com carreira ligada,
contas/analytics desligados e noindex; **97 verificações de browser** EN/PT
em desktop/mobile, sem erros de execução. Requests de Classic: **62/75**;
home fria: **27/28**, em ambos os tamanhos. Publicação e identificadores
registrados nas notas de verificação junto deste relatório.

Próximos pacotes do roadmap, sem execução nesta rodada:
`ROADMAP-NEXT-2026-10-31.md`.
