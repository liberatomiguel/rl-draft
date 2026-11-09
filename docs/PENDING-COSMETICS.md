# Pendências de cosméticos — acompanhamento

Atualizado em 09/11/2026, rc.38.1. Este é o ponto de entrada para retomar as
pendências; não marcar como concluído apenas porque o código foi publicado.

- [ ] **Permitir a concessão online de 50/50 Staff no Supabase de staging.**
  A migração `docs/sql/rc38-staff-grant.sql` está pronta, mas NÃO foi executada:
  não havia conexão administrativa identificada para o projeto de staging.
  Confirmar o destino de staging e aplicar a migração, que apenas acrescenta
  `50-50-staff` à validação de IDs; não concede itens nem altera RLS.
  Depois testar a leitura do grant com uma conta de QA autorizada. O export
  isolado atual tem contas desligadas. Não executar em produção por extensão
  dessa tarefa. Registrar projeto, data e resultado quando for aplicada.

- [ ] **Receber e integrar a arte da badge 50/50 Staff.**
  Miguel enviará o asset. Enquanto isso, manter o fallback de texto branco,
  sem inventar imagem. Integrar ao design-fonte
  `data-sources/badges/badges-gema-moldura.html`; `npm run build:badges` deve
  gerar `public/badges/50-50-staff.svg`. Executar `npm run build:images`,
  versionar o manifesto e validar o build. A arte construída substitui o
  fallback automaticamente. O title 50/50 Staff é branco por decisão de Miguel.

- [ ] **Adicionar as 21 fotos de special cards que faltam.**
  Nomes, IDs e arquivos exatos em `docs/SPECIAL-CARDS-MISSING-rc38.md`.
  Adicionar os PNGs em `public/cards/specials/<specialId>.png`, executar
  `build:images` e validar o export. Não inferir IDs por nome de jogador.

- [ ] **Decisão de Miguel sobre textos de desbloqueio.**
  Inventário exato EN/PT, condição e tela em `docs/UNLOCK-COPY-AUDIT-rc38.md`.
  Os textos foram preservados; só a prévia antecipada do cosmético no rank-up
  foi retirada. Aguardar seleção explícita antes de remover outros textos.

- [ ] **Selecionar futuras recompensas.**
  `docs/COSMETIC-SUGGESTIONS-rc38.md` contém 14 sugestões, NÃO implementadas,
  incluindo challenges de três estrelas e marcos Classic/RTW. Aguardar decisão
  de Miguel antes de cadastrar IDs, contadores, condições ou artes.

## Decisões visuais vigentes

Exclusive é uma raridade acima de Epic e abaixo de Legendary. Sua identificação
usa ciano, separada do violeta de Epic. Isso NÃO muda a arte dos titles manuais:
eles preservam as cores individuais, stroke, glow, gradiente e efeitos que
tinham antes de rc.38. 50/50 Staff usa branco com esse mesmo tratamento.
No rank-up, o emblema e os nomes dos ranks ficam diretamente no fundo escuro;
o card contém apenas a área inferior de desbloqueios e o botão de continuar.
