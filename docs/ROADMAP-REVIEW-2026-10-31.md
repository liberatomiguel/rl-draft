# Rocket Draft 2.0 — revisão do plano de 28/10

Referência: `rocket-draft-2.0-plano-executavel.md`, snapshot rc.29
(`4faffe9`). Base desta sessão: último `origin/staging`, rc.36.2
(`1afddcc`), conferido por fetch. O anexo é referência de roadmap;
não autoriza executar seu backlog nesta sessão.

## O que já foi feito

| Frente do anexo | Estado verificado no staging atual | O que falta para encerrar |
|---|---|---|
| GAME-01..04: Swiss, qualifier/regional, Major/Worlds em dois dias, gols/OT | Implementados, com regressões de fim de semana e reload | Aceite integrado com saves reais e playtest |
| Integração rc.29, direct-8, saves/nomenclatura legados | rc.30 unificou o commit de segunda, migrou agenda e reparou mundo/nomes; código morto removido | Fixtures reais antigas e cloud/multiaba, não só saves sintéticos |
| DEV-01/02: prospects, potencial, especiais, pico individual, manutenção/declínio | Modelo 2 desde rc.32; raros prospects históricos 93–98, pico individual e especiais elegíveis; idade mínima 13, aposentadoria 24–29 | Calibração de tempo de evolução e longevidade, experiência humana |
| DEV-03: treino, scrims e coaches | Rotinas integradas de 28 dias, foco, intensidade, três dificuldades de scrim, execução automática, resumo e delegação; coaches com experiência/especialidade/evolução | Validar diferenças e acúmulo de benefícios nas carreiras longas |
| ECO-01..05: economia, mercado e sponsors | Índice comum por season, contratos/renovações, prêmio por contrato, sponsors por perfil com metas e multas; empréstimos e avisos | Curva de caixa, recuperação após dívida e acesso a estrelas por estratégia |
| Exploit de contratação como sub | Preço separado da vaga, contrato de reserva sem desconto artificial, substituição atômica; bids iniciais bloqueados | Regressão com saves reais |
| RTW-01/03/04/05/06: mundo e circuito | Locais pontuam e podem classificar; orgs entram na era correta; menos ex-pros esquecidos em FA; elenco mínimo/skip explícito | Playtest regional e distribuição competitiva |
| UX-01/06, CAL-01, SUN-01..03 | HQ por decisões, finanças, ladder, novidades por save, contratos, calendário visual, escudos, parada no sábado, briefing e intro fullscreen, espectador após eliminação | Gate 3b continua em playtest; esta sessão corrige seus pontos de balanceamento/feedback |
| COL-01/02 | Antecipados para rc.33: álbum/formação, descoberta separada de coleta, NOVO antes da oferta, visual nacional e indicadores entre áreas | Ritmo de completar o álbum, sync de novidades, evento de descoberta e revisão visual |
| ENG-01/02, DATA-01, OBS-01/02 | Auditorias/documentos, harness de carreira, telemetria separada por modo e eventos versionados | Evidência de uso real; testes de recuperação e aprovação de experiência |
| PT/WEB-02 | Chrome inicial PT corrigido; budget de requests já foi reduzido | Revisão PT completa, CWV/Lighthouse e condições reais de produção |

“Implementado” não significa “aprovado em playtest”. Os bugs relatados pelo
Miguel continuam abertos até reprodução ou teste explícito; documentos de
deploy não comprovam execução de SQL, grants, freeze ou publicação.

## O que mudou em relação ao anexo

- O treino passou por ciclos de 28 → 14 → **28 dias**. Hoje só executa
  a rotina depois da escolha; com coach, ele pode planejar os próximos ciclos.
- O limite abrupto por split saiu do modelo novo. O crescimento tem ritmo
  distribuído pela season e teto de segurança; potencial não é um prêmio no rollover.
- O apoio financeiro inicial mudou: partner de fundação e renda de merch/streams
  foram retirados das carreiras novas. A folha dos fundadores é ajustada ao orçamento.
- O resgate virou **empréstimo emergencial do banco**, com prazo, limites e
  amortização. O investidor ajuda apenas no primeiro empréstimo do Fácil.
  Dívida em aberto permite negociar/contratar; continua havendo limite de crédito.
- Sponsors viraram contratos por perfil/risco. Renovação de jogador passou
  a negociação com salário, assinatura, duração e participação em prêmios.
- A coleção foi antecipada da Etapa 4 para rc.33. Os bullets do anexo que
  dizem “encontrar concede todas as cartas” descrevem o estado antigo.
- Economia agora usa **15% por season** para novos valores; contratos assinados
  guardam sua quantia. Treino, sponsors e HQ receberam novos ajustes até rc.36.2.
- Esta sessão substitui a meta estatística antiga de “Major cedo” pela direção
  de timing dita no chat: regional por volta do 3º split, Major nas seasons 3–4,
  título de Major no fim e Worlds nas últimas 2–3 seasons. Não são travas por data.
- O aviso de unlock deixa de abrir uma tela de compra automaticamente;
  scrims da semana passam a aparecer sob o avanço no calendário da HQ.

## Pendências reais antes da 2.0

1. **Fechar Gate 3b:** progressão e economia ao longo da carreira, diferenciação
   das dificuldades, caminhos de elenco e playtest humano. Não confundir
   taxa de partidas, séries, classificação e títulos.
2. **Restante da Etapa 4:** Challenges variados e prova de cada estrela;
   decisão/teste de diários; preview de recompensa de rank, login diário,
   revisão individual de banners/badges. Fechar ritmo/sync do álbum já construído.
   Venda ativa/troca continuam decisão explícita, não entrega já feita.
3. **Etapa 5:** tutorial/novidades, PT e mobile integrados; calibração final
   do Draft e carreira, arte/catálogo, SEO por URL e performance medida,
   notas da versão e material 50/50. Corpus de notícias ainda é parcial.
4. **Etapa 6:** fixtures reais, contas/sync, ensaio de migração e rollback;
   datas, freeze, snapshot, grants e recompensas únicas; configuração de
   Supabase/Cloudflare e validação de produção. Dependem de ações/aceite do Miguel.

FIFAe/EWC, forma temporária e modificador extra de Worlds continuam
**propostas**, fora do trabalho de hoje e do mínimo já contratado para lançar.

## Caminho mais curto para concluir

- Manter uma lista única em `ROADMAP.md`; os contratos e decisões existentes
  são a referência. Não reiniciar treino/HQ/economia já construídos a cada sessão.
- Após o aceite desta rodada, fechar a **Etapa 4 em um pacote de pendências
  concretas**, revalidando o que já existe em vez de reconstruir a coleção.
- Fazer **um RC integrado de acabamento e regressão** para a Etapa 5:
  cenários salvos para EN/PT, mobile, velha/nova carreira, contratos e Season.
  Resolver primeiro erros de integridade; qualquer redução de P1 exige decisão expressa.
- Enquanto o RC estabiliza, preparar o ensaio de cutover em cópias e os
  acessos/configurações do Miguel. Executar a virada só após o gate final.
- Encerrar cada pacote com evidência, uma lista curta do que jogar e
  patch notes. Novas mecânicas opcionais ficam para depois da 2.0 mediante escopo explícito.

Nesta sessão não foram iniciadas as Etapas 4–6 nem executado backlog do anexo.
Mudanças e medidas do playtest de hoje: `CAREER-PACING-rc36-3.md`.
