# Coleção limitada e badges no login — rc.36.21

Feedback de Miguel em 08/11/2026, aplicado sobre rc.36.20 no clone isolado.

- Overlay das Challenges em preto a 60%, com conteúdo visível por baixo.
  Removido o fundo retangular do rank; os milestones mantêm seu painel legível.
- No desktop, a altura da coleção acompanha exclusivamente a coluna que termina
  no rating history. A lista de badges não pode esticar a linha do grid.
  ResizeObserver calcula quantas linhas inteiras cabem; as demais badges ficam
  acessíveis por View more / Ver mais, que abre o armário na aba de badges.
  A redução usa apenas a prévia, sem omitir itens do inventário.
- Badges da coleção de 64 para 52 px, sem partículas individuais. No desktop
  1280×720, a prévia mostrou 24/35 e View more (11); a coleção e o histórico
  terminaram exatamente no mesmo ponto. No celular 320×900, 9/35 e View more
  (26), sem transbordamento horizontal. O armário abriu em ambos os tamanhos.
  Conferido também o alinhamento após selecionar outra recompensa de rank.
- Login: XP com raio fino em cor neutra, sem moeda, preenchimento ou halo.
  Os valores dos dias só de XP ficam discretos; badges crescem 24→40 px com
  um fundo quente suave. Conferidos dias 7/30, checks da sequência e célula
  final com badge/banner/título também em 320 px. Calendário continua rolável,
  com resumo/ação fixos e o dia recebido à vista.

Rota temporária de QA removida antes dos checks finais.
Validação concluída em 09/11/2026: 2.000 testes aprovados, 22 auditorias opcionais
ignoradas; lint, TypeScript e export aprovados. Export: 1.989 arquivos, 51,24 MB,
contas/analytics desligados e carreira ligada.

Probe: perfil 29 ms/s (limite 80), ranking 13 ms/s (limite 60), zero falhas de
composição. Lighthouse: acessibilidade 100/100 no perfil/login e nas Challenges,
sem auditorias reprovadas. Verificação visual/funcional em desktop e celular
concluída antes das medições, incluindo o botão de acesso ao armário.

Nenhuma alteração em animações de banners, motor, regras de desbloqueio,
seeds, valores de XP, inventário, persistência ou código/store/balance de carreira.
Main e o trabalho local de carreira permanecem separados.
