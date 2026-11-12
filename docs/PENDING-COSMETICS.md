# Pendências de cosméticos — acompanhamento

Atualizado em 12/11/2026, rc.51. Este é o ponto de entrada para retomar as
pendências; não marcar como concluído apenas porque o código foi publicado.

- [ ] **Permitir a concessão online de 50/50 Staff no Supabase de staging.**
  A migração `docs/sql/rc38-staff-grant.sql` está pronta, mas NÃO foi executada:
  não havia conexão administrativa identificada para o projeto de staging.
  Confirmar o destino de staging e aplicar a migração, que apenas acrescenta
  `50-50-staff` à validação de IDs; não concede itens nem altera RLS.
  Depois testar a leitura do grant com uma conta de QA autorizada. O export
  isolado atual tem contas desligadas. Não executar em produção por extensão
  dessa tarefa. Registrar projeto, data e resultado quando for aplicada.

- [x] **Arte da badge 50/50 Staff integrada (rc.51).** Veio no arquivo de
  badges revisadas com a chave `5050`; o build exporta como `50-50-staff`. O
  title 50/50 Staff foi REMOVIDO na revisão de 11/11 (fica só a badge).

- [ ] **Permitir a concessão online de Creator (rc.51).** Badge + title novos,
  concessão manual `creator`. Migração pronta e NÃO executada:
  `docs/sql/rc51-creator-grant.sql` (também cobre `50-50-staff`, caso a rc38
  não tenha sido aplicada). Mesmo cuidado: staging primeiro, registrar projeto,
  data e resultado.

- [x] **Supernova: 90 estrelas (rc.53).** Decisão de Miguel em 12/11. Escada
  de estrelas: 25 / 50 / 90 / 120, de 135 no total (45 challenges).

- [ ] **Jogar e validar as recompensas novas da rc.51.** Technician, Clean
  Sweep, Trade Minister (Classic) e Day One, Regional Dynasty, Passport Stamped
  (RTW) têm testes automáticos, mas nenhuma foi conquistada em jogo real.
  Carreiras já iniciadas só registram os titulares do Day One no split 1 da
  temporada seguinte.

- [ ] **Adicionar as 21 fotos de special cards que faltam.**
  Nomes, IDs e arquivos exatos em `docs/SPECIAL-CARDS-MISSING-rc38.md`.
  Adicionar os PNGs em `public/cards/specials/<specialId>.png`, executar
  `build:images` e validar o export. Não inferir IDs por nome de jogador.

- [ ] **Decisão de Miguel sobre textos de desbloqueio.**
  Inventário exato EN/PT, condição e tela em `docs/UNLOCK-COPY-AUDIT-rc38.md`.
  Os textos foram preservados; só a prévia antecipada do cosmético no rank-up
  foi retirada. Aguardar seleção explícita antes de remover outros textos.

- [x] **Futuras recompensas selecionadas (rc.51).** A lista revisada de 11/11
  substituiu `docs/COSMETIC-SUGGESTIONS-rc38.md`: 16 itens implementados
  (Perfect Circuit ficou de fora; One Flag virou Technician, On the Grid virou
  Roster Architect, From Day One virou Day One, Home and Away virou Trade
  Minister). Catálogo atual: `docs/COSMETICS-CATALOG.md`.

## Decisões visuais vigentes

Exclusive é uma raridade acima de Epic e abaixo de Legendary. Sua identificação
usa ciano, separada do violeta de Epic. Isso NÃO muda a arte dos titles manuais:
eles preservam as cores individuais, stroke, glow, gradiente e efeitos que
tinham antes de rc.38. Creator usa fúcsia/magenta com esse mesmo tratamento
(o title 50/50 Staff, que era branco, saiu na rc.51).
No rank-up, o emblema e os nomes dos ranks ficam diretamente no fundo escuro;
o card contém apenas a área inferior de desbloqueios e o botão de continuar.
