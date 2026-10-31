# rc.36.3 — progressão, caixa e feedback da semana

Base conferida: staging rc.36.2, `1afddcc`. Candidato: rc.36.3,
`BALANCE_VERSION=8`. Escopo: o pedido de 31/10 no chat; o anexo foi usado
somente para a revisão em `ROADMAP-REVIEW-2026-10-31.md`.

## Resultado principal

**O início estava acelerado, mas o fim da carreira não estava fácil nas
políticas testadas.** Esta rodada reduz o salto inicial e a reputação por
resultados modestos. **Não encerra o balanceamento de Major/Worlds.**

A campanha histórica tem **6 seasons**. Os testes percorrem 8 para observar
também 2 anos do infinito. A direção de Miguel é regional perto do split 3,
primeiro Major nas seasons 3–4, título de Major no fim e Worlds nas últimas
2–3 seasons históricas (S4–6), com variação por dificuldade e estratégia.
Não há bloqueios por season, derrotas obrigatórias ou títulos garantidos.

## Antes/depois com as mesmas carreiras

98 carreiras em cada snapshot, seed 9100, 7 regiões, 3 dificuldades:
manter elenco, contratar melhorias, formar jovens e gastar em estrelas;
no Normal também investir em estrutura e manter a base com coach/treino.
Comparação pareada por região/dificuldade/política/seed, incluindo falências.
Índices abaixo começam em 1.

| Medida — Normal, mesmas 42 carreiras | rc.36.2 | rc.36.3 |
|---|---:|---:|
| Já chegou ao regional no primeiro split | 29/42 (69%) | 18/42 (43%) |
| Já chegou ao regional até o segundo split | 39/42 (93%) | 32/42 (76%) |
| Primeiro regional, mediana entre quem chegou | split 1 | split 2 |
| Primeiro Major antes da season 3 | 11/42 | 1/42 |
| Primeiro Major até a season 4 | 15/42 | 4/42 |
| Primeiro Major, mediana **entre classificados** | season 2 | season 4 |
| Reputação ao fim da primeira season, mediana | 22,5 | 13 |
| Ganho dos jogadores da política de jovens, mediana na S1 | 4,1 | 3,6 |
| Saldo negativo em algum momento da S1 | 2/42 | 5/42 |
| Falência em toda a observação de 8 seasons | 1/42 | 3/42 |
| Softlocks | 0 | 0 |

**Leitura:** o primeiro Major aproxima-se do timing desejado entre quem
consegue chegar, mas a taxa de chegada caiu. O regional ainda vem cedo para
muitos caminhos; o objetivo de split 3 não está aprovado. Não usar a mediana
de classificados para esconder quem nunca alcançou o Major.

Há diferenças grandes por região. A identidade dos elencos e as quotas
foram preservadas. EU continua especialmente exigente; um resultado global
não é evidência de que cada região cumpre o mesmo arco.

Tabelas completas: `CAREER-PACING-rc36-3-before.md`,
`CAREER-PACING-rc36-3-after.md`. A medição adicional com a política de academia
está em `CAREER-PACING-rc36-3-all.md` (105 carreiras depois, 7 novas).

## Estratégia mista e limite da conclusão sobre títulos

Mais **28 carreiras no Normal**, 4 seeds × 7 regiões, com uma política mista:
formar jovens, investir em treino/coach/estrutura e comprar força atual
depois de classificar ao primeiro Major. A mudança depende de um marco
visível, não de uma trava de calendário. Mesmo preço, regras e RNG do jogo.

14/28 chegaram ao Worlds durante as 6 seasons históricas. Houve títulos de
Major na season 6 em MENA e OCE; outros só no infinito. **Não houve título
de Worlds nessa amostra.** Também não houve no Normal das 42 carreiras
pareadas, antes ou depois. Portanto, não há evidência para chamar o arco
de título do Worlds de fechado. Relatório: `CAREER-PACING-rc36-3-mixed.md`.

Exemplo de desenvolvimento real, SAM/academia/seed 9100: rating de equipe
72,1 → 77,7 → 83,3 → 88,5 → 93,7 → 94,7 nas seasons 1–6; primeiro Major na
S4. O time continua avançando, mas terminar perto do nível mundial não
garante a vaga regional no Worlds nem o título.

Os agentes são regras simples, não jogadores humanos: horários fixos de
compra/renovação, preferências fixas de sponsor, margens de compra, sem
planejamento completo de vendas/trocas ou todas as combinações de elenco.
A política legada de jovens usa a faixa de scouting dos candidatos e um
limiar baseado no potencial salvo do titular; isso limita sua equivalência
a uma decisão humana. Uma seed por célula na comparação ampla não estima
a taxa populacional de sucesso. A amostra mista amplia seeds, não substitui
playtest humano nem prova impossibilidade de vencer.

## Ajustes aplicados

- Cena local: faixa de força relativa ao anchor de **−7…+1 → −1…+4**.
  O freeze por season e os contratos de seeding continuam iguais.
- Desenvolvimento: unidade de treino **50,25 → 60**, reduzindo a taxa-base
  por sessão/série em **16,25%**. Potencial, overall já conquistado, idade de
  pico e teto de segurança de 8,5 por season são preservados. Sem parada por split.
- Reputação: no máximo **1** premiação de Community Cup por split em vez de
  2; saída na Swiss do regional não concede outro ponto só pela presença.
  O qualifier continua reconhecendo a classificação. Para não bloquear o
  novato em região forte, uma vitória de série como underdog pode render
  +1, limitado a uma vez por split e enquanto rep <25. Soft cap em 60, antes 80.
- Mercado: teto de novos signings **74 + 0,3×rep → 71 + 0,4×rep**. Exemplo:
  rep 5 abre 73 em vez de 75; rep 25 abre 81; rep 50 abre 91.
  Renovações e atletas já contratados não são expulsos por esse teto.
- Primeiro sponsor disponível em rep **10**, alinhado ao primeiro nível da
  ladder. Continua sendo uma decisão de contrato, sem renda automática de fundação.
- Folha de fundadores, carreiras novas: cobertura mínima **32 semanas no
  Normal** e **18 no Difícil**, antes 24/13; Fácil permanece 44. Orçamento
  inicial e valores de contratos já assinados são preservados.

Foram descartados os experimentos de endurecer todas as partidas e de
abrir rapidamente o mercado de estrelas (base 70, inclinação 0,65): eles
não resolveram o arco tardio das políticas testadas. Os perfis de partida
de Fácil/Normal/Difícil permanecem os da rc.36.2; Draft não foi retunado.

## Caixa inicial e empréstimo

O probe financeiro percorreu **63 carreiras de 8 seasons**, 7 regiões ×
3 dificuldades × 3 políticas (manter, jovens, estrelas), com receitas,
despesas, dívidas, avisos e renovações observados no fluxo real. Tabelas:
`ECONOMY-rc36-3.md`. O probe de crescimento usa 24 seeds; a amostra dedicada
de treino usa 2 seeds, com fluxos completos cobertos pelas carreiras acima.

Na comparação Normal, as políticas de manter elenco e formar jovens não
ficaram negativas na primeira season. Os casos negativos foram compras/
trocas em EU/OCE e a estratégia de estrelas em NA. **Nenhuma carreira da
comparação pareada faliu na primeira season**, mas isso não prova que qualquer
compra humana seja sustentável. Nas 8 seasons, falências foram 0/28 Fácil,
3/42 Normal e 7/28 Difícil; o limite do Difícil merece atenção no playtest.

Não foi reproduzida falta de empréstimo após uma quebra válida. O gatilho
continua sendo **segunda-feira fechando abaixo do piso de crédito**, hoje
8 semanas da folha (com mínimo de base), não simplesmente ficar negativo.
Acima do piso é uso de crédito. O aviso da HQ agora explica a regra e o piso.
Testes cobrem as 3 dificuldades, concessão única, notificação e reload sem
duplicar dívida/pagamento. O relato pessoal do Miguel não foi reconstruído
com seu save, portanto não é declarado resolvido por suposição.

Um erro real de arredondamento foi corrigido: escalar salários a partir de
uma folha semanal já arredondada podia exceder o orçamento de cobertura.
O ajuste agora confere a folha que será efetivamente cobrada. Só afeta
novos contratos de fundação; não aumenta/reduz retroativamente salários.

## Interface e validação

- Unlock: notificação e inbox, sem compra no aviso nem modal automático.
  Clicar no aviso abre a progressão da HQ. Os detalhes/compra continuam
  disponíveis quando o usuário escolhe abri-los. Unlock por decisão semanal
  também emite o aviso; antes alterava rep sem anunciar o cruzamento do gate.
- Linha fina de scrims sob o avanço, dentro do calendário da HQ: dia,
  placar e adversário, só resultados já registrados da semana. Estado vazio
  fala da semana, não da season inteira. Reload não simula outra partida.
- **1.449 testes normais passaram**, 15 opt-in pulados; typecheck e lint
  limpos. Dados regenerados sem mudança de conteúdo e validação aprovada.
- Export estático de staging aprovado: carreira ON, noindex, contas e
  analytics OFF. **65 verificações de navegador**, EN/PT × 1366×900 e
  375×667, sem erros/overflow: resultados, posição no calendário, reload,
  registros de outras semanas/seasons, vazio, crédito, unlock real via decisão,
  ausência de compra no aviso e abertura manual dos detalhes.
- Duas runs Classic completas: **62 requests**, budget 75; home fria **27**,
  budget 28. Não houve alteração de efeitos que exigisse repetir `perf:probe`.

## Próximo aceite

Miguel deve jogar os primeiros 3 splits e o planejamento de uma carreira
forte no final histórico. Conferir se as escolhas de elenco/estrutura são
legíveis, se o caixa permite errar sem abandonar a run e se a dificuldade
regional faz sentido. **O timing de título de Worlds e a aderência ao split
3 continuam pendências explícitas do Gate 3b.** Não avançar silenciosamente
para Etapa 4 nem publicar em produção com base apenas nos testes automáticos.
