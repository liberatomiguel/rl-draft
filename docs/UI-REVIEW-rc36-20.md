# Calendário compacto e movimento dos banners — rc.36.20

Feedback de Miguel em 08/11/2026, sobre rc.36.19 no clone isolado.

- Login: células compactas, ícone de XP também nos dias sem cosmético,
  títulos com seu próprio visual, sem legendas extras de nomes. O dia 30
  ocupa uma célula comum, com badge/banner/título e XP. Mantidos os checks
  desta sequência, XP creditado hoje e acesso ao dia atual ao abrir.
- Challenges: removida a barra de formato/seeds. Overlay translúcido,
  conteúdo visível por baixo e rank em um pequeno painel de contraste.
  Unlock Path aparece somente com pré-requisitos/milestones, sem repetir
  “unlocks at”. Briefing mantém brasão/rank e bloqueio real no store.
- Perfil: retiradas instrução de seleção, legendas de recompensa e texto
  sobre quando se recebe. Títulos reais na linha de progresso e na prévia;
  painel da recompensa menor e gráfico de rating de 44 para 80 px.
  Miniaturas de títulos mantêm cores/brilho sem holo contínuo; prévias maiores
  continuam animadas. Banners com planos próprios dispensam brilhos genéricos.
- Banners: planos separados para trilhas de Slipstream, chamas/brasas de
  Wildfire, pulso/inclinação/poeira de Singularity, ondas de Heatwave e
  órbitas opostas de Cosmic Ascension, com faíscas e radiância no mesmo plano.
  Overdrive permanece
  com uma única sequência de anéis, sem a cópia duplicada.
- Causa de parte da perda visual: a extração seguia url(#id), mas não href,
  omitindo formas reutilizadas de chamas e órbitas. Agora preserva também
  dependências transitivas. Testes verificam referências válidas, cada forma
  em um único plano, ausência de filtros/SMIL nos rasters e os dez anéis únicos.

Revisão visual em navegador: desktop 1280×720 e celular 320×900; login nos
dias 7, 30 e 31, progresso 30/30 no ciclo completo, título dentro da célula,
dia 30 visível ao reabrir no celular. Conferida cópia EN/PT, trilha do perfil,
gráfico de rating, bloqueios por rank e por milestones. As cinco animações
estão ativas quando visíveis; Heatwave pausa fora da tela e retoma ao entrar.
A rota temporária de QA foi removida antes dos checks finais.

Regressão: 2.000 testes aprovados, 22 auditorias opcionais ignoradas; lint,
TypeScript e export aprovados. A primeira execução simultânea aos checks teve
dois timeouts de 5 s em testes de carreira, sem falha de asserção; a suíte
completa repetida com quatro workers passou sem alterar esses testes.
Export com 1.989 arquivos e 51,24 MB, contas/analytics desligados e carreira
ligada. Probe final: perfil 63 ms/s (limite 80), ranking 20 ms/s (limite 60),
zero falhas de composição. As medições iniciais do perfil ficaram em 83/84
ms/s; consolidadas as faíscas na radiância e retirados os brilhos genéricos
dos banners com planos próprios antes da publicação.

Lighthouse: acessibilidade 100/100 no perfil/login e nas Challenges, sem
auditorias reprovadas. Export final conferido em 320 px (página com 312 px,
sem transbordamento horizontal); títulos pequenos sem animação contínua.
Com efeitos reduzidos, todas as camadas de Overdrive e Cosmic Ascension
estão ocultas e com animation:none, incluindo os novos planos orbitais.

Nenhuma alteração em motor, regras de desbloqueio, seeds, valores de XP,
persistência, catálogo de recompensas ou código/store/balance de carreira.
Produção permanece WebP com transform/opacity; nenhum filtro SVG ou SMIL
é executado por frame. Main e o trabalho local de carreira não são alterados.
